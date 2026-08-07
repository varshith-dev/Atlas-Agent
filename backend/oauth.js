// Generic OAuth2 authorization-code flow, config-driven for all providers.
// ponytail: in-memory state map (lost on restart) — fine, OAuth states are short-lived.
import { randomBytes, createHash } from 'node:crypto'

const APP_BASE = process.env.APP_BASE || 'https://atlas.oqens.me'
const CB = (id) => `${APP_BASE}/api/oauth/${id}/callback`

// OAuth servers. Credentials come from env (see .env).
const SERVERS = {
  github: {
    authorize: 'https://github.com/login/oauth/authorize',
    token: 'https://github.com/login/oauth/access_token',
    clientId: () => process.env.GITHUB_CLIENT_ID,
    secret: () => process.env.GITHUB_CLIENT_SECRET,
    tokenAuth: 'body', pkce: false,
  },
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    secret: () => process.env.GOOGLE_CLIENT_SECRET,
    tokenAuth: 'body', pkce: false,
    extraAuth: { access_type: 'offline', prompt: 'consent' },
  },
  linkedin: {
    authorize: 'https://www.linkedin.com/oauth/v2/authorization',
    token: 'https://www.linkedin.com/oauth/v2/accessToken',
    clientId: () => process.env.LINKEDIN_CLIENT_ID,
    secret: () => process.env.LINKEDIN_CLIENT_SECRET,
    tokenAuth: 'body', pkce: false,
  },
}

// Each integration id -> which OAuth server + scopes it needs.
export const OAUTH_CONFIG = {
  github: { server: 'github', scope: 'repo read:org read:user' },
  google: { server: 'google', scope: 'openid email profile' },
  gmail: { server: 'google', scope: 'https://www.googleapis.com/auth/gmail.modify' },
  calendar: { server: 'google', scope: 'https://www.googleapis.com/auth/calendar' },
  meet: { server: 'google', scope: 'https://www.googleapis.com/auth/calendar.events' },
  linkedin: { server: 'linkedin', scope: 'openid profile w_member_social' },
}

const states = new Map() // state -> { id, verifier, created }
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000
  for (const [k, v] of states) if (v.created < cutoff) states.delete(k)
}, 60 * 1000).unref()

export function isConfigured(id) {
  const cfg = OAUTH_CONFIG[id]
  if (!cfg) return false
  const s = SERVERS[cfg.server]
  return Boolean(s.clientId() && s.secret())
}

// Build the provider authorize URL; returns null if not configured.
export function buildAuthUrl(id) {
  const cfg = OAUTH_CONFIG[id]
  if (!cfg || !isConfigured(id)) return null
  const s = SERVERS[cfg.server]
  const state = randomBytes(16).toString('hex')
  const entry = { id, created: Date.now() }
  const params = new URLSearchParams({
    client_id: s.clientId(),
    redirect_uri: CB(id),
    response_type: 'code',
    scope: cfg.scope,
    state,
    ...(s.extraAuth || {}),
  })
  if (s.pkce) {
    const verifier = randomBytes(32).toString('base64url')
    entry.verifier = verifier
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    params.set('code_challenge', challenge)
    params.set('code_challenge_method', 'S256')
  }
  states.set(state, entry)
  return `${s.authorize}?${params.toString()}`
}

// Exchange the callback code for tokens. Returns { access_token, refresh_token, expires_in } or throws.
export async function exchangeCode(id, code, state) {
  const cfg = OAUTH_CONFIG[id]
  const entry = states.get(state)
  if (!cfg || !entry || entry.id !== id) throw new Error('invalid state')
  states.delete(state)
  const s = SERVERS[cfg.server]

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: CB(id),
    client_id: s.clientId(),
  })
  if (s.pkce && entry.verifier) body.set('code_verifier', entry.verifier)

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
  if (s.tokenAuth === 'basic') {
    headers.Authorization = 'Basic ' + Buffer.from(`${s.clientId()}:${s.secret()}`).toString('base64')
  } else {
    body.set('client_secret', s.secret())
  }

  const r = await fetch(s.token, { method: 'POST', headers, body })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || `token exchange failed (${r.status})`)
  }
  return data
}
