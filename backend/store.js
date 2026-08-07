// Unified persistent store for Atlas backend.
// ponytail: single JSON file, synchronous writes. Fine for one user / low volume.
// Upgrade path: SQLite/pgvector if this grows or needs semantic recall.
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const FILE = fileURLToPath(new URL('./data/store.json', import.meta.url))

const DEFAULTS = () => ({
  memories: [],
  messages: [],
  tasks: [],
  logs: [],
  integrations: [
    { id: 'google', name: 'Google Workspace', connected: false },
    { id: 'gmail', name: 'Gmail API', connected: false },
    { id: 'calendar', name: 'Google Calendar', connected: false },
    { id: 'github', name: 'GitHub', connected: false },
    { id: 'meet', name: 'Google Meet', connected: false },
    { id: 'linkedin', name: 'LinkedIn', connected: false },
  ],
  keys: [],
  contacts: [],
  jobs: [],
  usage: { requests: 0, tokens: 0, chats: 0, since: new Date().toISOString() },
})

function load() {
  try {
    if (!existsSync(FILE)) return DEFAULTS()
    return { ...DEFAULTS(), ...JSON.parse(readFileSync(FILE, 'utf8')) }
  } catch {
    return DEFAULTS()
  }
}

let state = load()

function save() {
  mkdirSync(dirname(FILE), { recursive: true })
  const tmp = FILE + '.tmp'
  writeFileSync(tmp, JSON.stringify(state, null, 2))
  renameSync(tmp, FILE)
}

export const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
export const get = () => state
export { save }

// --- Activity log (internal helper, called on notable actions) ---
export function logEvent(title, detail = '', tone = '') {
  const entry = { id: id(), title, detail, tone, created_at: new Date().toISOString() }
  state.logs.unshift(entry)
  if (state.logs.length > 200) state.logs.length = 200
  save()
  return entry
}

// --- Usage counters ---
export function bumpUsage({ tokens = 0, chats = 0 } = {}) {
  state.usage.requests += 1
  state.usage.tokens += tokens
  state.usage.chats += chats
  save()
}
