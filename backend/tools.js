// Tool registry the agent can call. Read-only tools run autonomously;
// side-effecting actions (post/send) stay behind explicit user approval — never here.
import { get, save } from './store.js'

const integration = (id) => get().integrations.find(x => x.id === id)

// --- Google auth: refresh access token when expired ---
export async function ensureGoogleToken(it) {
  if (it.token && it.expires_at && Date.now() < it.expires_at - 60000) return it.token
  if (!it.refresh_token) return it.token
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: it.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const j = await r.json()
  if (j.access_token) { it.token = j.access_token; it.expires_at = Date.now() + (j.expires_in || 3600) * 1000; save() }
  return it.token
}

async function gmailList(it, { q = '', count = 5 } = {}) {
  const token = await ensureGoogleToken(it)
  const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
  url.searchParams.set('maxResults', String(Math.min(count || 5, 10)))
  if (q) url.searchParams.set('q', q); else url.searchParams.set('labelIds', 'INBOX')
  const listRes = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!listRes.ok) throw new Error(`Gmail ${listRes.status}: ${(await listRes.text()).slice(0, 160)}`)
  const ids = ((await listRes.json()).messages || []).map(m => m.id)
  const emails = []
  for (const id of ids) {
    const m = await (await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${token}` } })).json()
    const h = Object.fromEntries((m.payload?.headers || []).map(x => [x.name.toLowerCase(), x.value]))
    emails.push({
      from: h.from || 'Unknown', subject: h.subject || '(no subject)', date: h.date || '',
      snippet: (m.snippet || '').replace(/&#39;/g, "'").replace(/&amp;/g, '&').slice(0, 180),
      link: `https://mail.google.com/mail/u/0/#inbox/${id}`,
    })
  }
  return emails
}

async function calendarList(it, { days = 7 } = {}) {
  const token = await ensureGoogleToken(it)
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
  url.searchParams.set('timeMin', new Date().toISOString())
  url.searchParams.set('timeMax', new Date(Date.now() + (days || 7) * 864e5).toISOString())
  url.searchParams.set('singleEvents', 'true')
  url.searchParams.set('orderBy', 'startTime')
  url.searchParams.set('maxResults', '10')
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`Calendar ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return ((await r.json()).items || []).map(e => ({
    title: e.summary || '(no title)',
    start: e.start?.dateTime || e.start?.date || '',
    link: e.htmlLink,
  }))
}

// Create one or more Google Calendar events. Each: { title, date 'YYYY-MM-DD', start 'HH:MM'|null, durationHours }
export async function calendarCreate(it, events) {
  const token = await ensureGoogleToken(it)
  const created = []
  for (const e of events) {
    if (!e.title || !e.date) continue
    const body = { summary: e.title }
    if (e.start) {
      const startDate = new Date(`${e.date}T${e.start}:00+05:30`)
      const endDate = new Date(startDate.getTime() + (e.durationHours || 1) * 3600000)
      body.start = { dateTime: startDate.toISOString(), timeZone: 'Asia/Kolkata' }
      body.end = { dateTime: endDate.toISOString(), timeZone: 'Asia/Kolkata' }
    } else {
      body.start = { date: e.date }
      body.end = { date: e.date }
    }
    const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (r.ok) { const j = await r.json(); created.push({ title: e.title, link: j.htmlLink }) }
    else throw new Error(`Calendar create ${r.status}: ${(await r.text()).slice(0, 160)}`)
  }
  return created
}

// Web search via DuckDuckGo HTML (no API key). ponytail: HTML scrape — swap to
// Tavily/Brave if DDG rate-limits or changes markup.
function stripHtml(h) {
  return h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}
export async function webSearch(query, n = 5) {
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' },
  })
  if (!r.ok) throw new Error(`search ${r.status}`)
  const html = await r.text()
  const titleRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g
  const snipRe = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
  const snips = []; let sm
  while ((sm = snipRe.exec(html))) snips.push(stripHtml(sm[1]))
  const results = []; let m, i = 0
  while ((m = titleRe.exec(html)) && results.length < n) {
    let url = m[1]
    const ud = url.match(/uddg=([^&]+)/); if (ud) url = decodeURIComponent(ud[1])
    if (url.startsWith('//')) url = 'https:' + url
    const title = stripHtml(m[2]); if (!title) { i++; continue }
    let domain = ''; try { domain = new URL(url).hostname.replace(/^www\./, '') } catch { /* ignore */ }
    results.push({ title, url, domain, snippet: snips[i] || '' }); i++
  }
  return results
}

// --- Tool registry (JSON-schema params, OpenAI/Ollama function format) ---
export const TOOLS = [
  {
    name: 'read_recent_emails',
    description: "Read the user's most recent inbox emails (sender, subject, preview). Use for questions about recent, latest, or new email.",
    parameters: { type: 'object', properties: { count: { type: 'integer', description: 'how many, default 5' } } },
    async execute({ count = 5 } = {}) {
      const it = integration('gmail')
      if (!it?.connected || !it.token) return { text: 'Gmail is not connected. Tell the user to connect Gmail in Integrations.' }
      const emails = await gmailList(it, { count })
      if (!emails.length) return { text: 'No emails found in the inbox.' }
      return {
        text: 'Recent inbox emails (newest first):\n' + emails.map((e, i) => `${i + 1}. From ${e.from} — "${e.subject}" — ${e.snippet}`).join('\n'),
        attachments: emails.map(e => ({ type: 'email', title: e.subject, subtitle: e.from, url: e.link })),
      }
    },
  },
  {
    name: 'search_emails',
    description: "Search the user's email by keywords, sender, or subject (Gmail search syntax). Use when they ask about a specific email or topic.",
    parameters: { type: 'object', properties: { query: { type: 'string' }, count: { type: 'integer' } }, required: ['query'] },
    async execute({ query, count = 5 } = {}) {
      const it = integration('gmail')
      if (!it?.connected || !it.token) return { text: 'Gmail is not connected.' }
      const emails = await gmailList(it, { q: query, count })
      if (!emails.length) return { text: `No emails found for "${query}".` }
      return {
        text: `Emails matching "${query}":\n` + emails.map((e, i) => `${i + 1}. From ${e.from} — "${e.subject}" — ${e.snippet}`).join('\n'),
        attachments: emails.map(e => ({ type: 'email', title: e.subject, subtitle: e.from, url: e.link })),
      }
    },
  },
  {
    name: 'list_calendar_events',
    description: "List the user's upcoming Google Calendar events. Use for questions about their schedule, meetings, or agenda.",
    parameters: { type: 'object', properties: { days: { type: 'integer', description: 'how many days ahead, default 7' } } },
    async execute({ days = 7 } = {}) {
      const it = integration('calendar')
      if (!it?.connected || !it.token) return { text: 'Google Calendar is not connected.' }
      const events = await calendarList(it, { days })
      if (!events.length) return { text: `No events in the next ${days} days.` }
      return {
        text: 'Upcoming events:\n' + events.map((e, i) => `${i + 1}. ${e.title} — ${e.start}`).join('\n'),
        attachments: events.map(e => ({ type: 'event', title: e.title, subtitle: e.start, url: e.link })),
      }
    },
  },
]

// --- Write actions (reused by the Proceed button AND auto mode) ---
// RFC 2047: encode a header value if it has non-ASCII (emoji, em-dash, etc.)
function encodeHeader(s) {
  return /^[\x00-\x7F]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer.from(s, 'utf8').toString('base64') + '?='
}

export async function gmailSend(it, to, text, attachment) {
  const token = await ensureGoogleToken(it)
  const subjMatch = text.match(/subject:\s*(.+)/i)
  const subject = encodeHeader((subjMatch ? subjMatch[1].trim() : 'Message from Atlas'))
  const body = text.replace(/subject:\s*.+\r?\n?/i, '').trim()
  let rfc822
  if (attachment) {
    const b = 'atlas_' + Math.random().toString(36).slice(2)
    rfc822 = [
      `To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${b}"`, '',
      `--${b}`, 'Content-Type: text/plain; charset="UTF-8"', '', body, '',
      `--${b}`, `Content-Type: ${attachment.mime}; name="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64', `Content-Disposition: attachment; filename="${attachment.filename}"`, '',
      attachment.content.toString('base64'), '', `--${b}--`,
    ].join('\r\n')
  } else {
    rfc822 = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset="UTF-8"', 'MIME-Version: 1.0', '', body].join('\r\n')
  }
  const raw = Buffer.from(rfc822).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw }),
  })
  if (!r.ok) throw new Error(`Gmail send ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return { subject }
}

export async function linkedinPost(it, text) {
  const uij = await (await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${it.token}` } })).json()
  if (!uij.sub) throw new Error('could not resolve LinkedIn profile — reconnect the integration')
  const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${it.token}`, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      author: `urn:li:person:${uij.sub}`, lifecycleState: 'PUBLISHED',
      specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text }, shareMediaCategory: 'NONE' } },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  })
  if (!r.ok) throw new Error(`LinkedIn ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const urn = r.headers.get('x-restli-id') || ''
  return { url: urn ? `https://www.linkedin.com/feed/update/${urn}` : 'https://www.linkedin.com/feed/' }
}

export const TOOL_LABELS = {
  read_recent_emails: 'Reading your inbox',
  search_emails: 'Searching your email',
  list_calendar_events: 'Checking your calendar',
}
