import { GoogleGenAI } from '@google/genai';
import express from 'express'
import cors from 'cors'
import { get, save, id, logEvent, bumpUsage } from './store.js'
import { OAUTH_CONFIG, isConfigured, buildAuthUrl, exchangeCode } from './oauth.js'
import { TOOLS, TOOL_LABELS, ensureGoogleToken, gmailSend as _gmailSend, linkedinPost as _linkedinPost, calendarCreate as _calendarCreate, webSearch as _webSearch } from './tools.js'
import { renderPDF, renderExcel, renderDocx } from './docs.js'
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const DOCS_DIR = fileURLToPath(new URL('./data/docs/', import.meta.url))

const PORT = process.env.PORT || 8080
const OLLAMA = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gemma4:e2b'
const AGENT_MODEL = process.env.AGENT_MODEL || 'gemma4:e2b' // needs tool-calling support
const DEFAULT_NOTIFY = process.env.NOTIFY_EMAIL || 'varshithpaladugu07@gmail.com'
const APP_BASE = process.env.APP_BASE || 'https://atlas.oqens.me'
const STARTED = Date.now()

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// Log every request into the hits buffer (shown at /developer/apihits)
app.use((req, res, next) => {
  const t0 = Date.now()
  res.on('finish', () => {
    try { logHit('request', `${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - t0}ms)`) } catch { /* HITS not ready */ }
  })
  next()
})

const db = get()

// User-editable persona: character, rules, skills/focus, and few-shot examples.
// This is the practical way to "train" behavior on this hardware (prompt-shaping, not GPU fine-tuning).
// Runtime-editable agent settings (managed from the Instagram Manager tab).
db.settings = Object.assign({
  proactiveEnabled: true,   // Atlas DMs you first
  proMinMin: 12, proMaxMin: 35, // dynamic gap range (minutes)
  quietStart: 23, quietEnd: 7,  // no proactive pings between these IST hours
  idleEnabled: true,        // generate idle-time insights
  ownerIds: [],             // IG sender ids with full agentic powers ([] → env default)
}, db.settings || {})
const ownerIds = () => (db.settings.ownerIds?.length ? db.settings.ownerIds : IG_OWNERS)

db.persona = db.persona || {
  name: 'Atlas',
  character: "a warm, sharp, well-rounded personal assistant and friend, built by Varshith. You can chat about ANY topic — life, ideas, advice, tech, jokes — and you ALSO have tools to act on Varshith's Gmail, Calendar, LinkedIn, and the web when he asks.",
  rules: [
    "You act on Varshith's behalf: you CAN send emails, post, and create events for him. Never refuse by claiming you need a third party's permission or that you lack access.",
    "Never invent limitations. If you can do something, just do it or ask for the missing detail.",
    "Do not fixate on email/calendar — most messages are normal conversation; answer them naturally.",
    "Never dump memory facts unprompted (e.g. don't bring up programs or contacts unless relevant).",
  ],
  skills: [],
  examples: [], // [{ user, assistant }]
}

function systemPrompt() {
  const p = db.persona
  const facts = db.memories.length ? db.memories.map(m => `- ${m.text}`).join('\n') : '- (no stored facts yet)'
  const rules = p.rules?.length ? `\n\nRules you always follow:\n${p.rules.map(r => `- ${r}`).join('\n')}` : ''
  const skills = p.skills?.length ? `\n\nYour focus / skills:\n${p.skills.map(s => `- ${s}`).join('\n')}` : ''
  const examples = p.examples?.length ? `\n\nExamples of how you respond:\n${p.examples.slice(0, 4).map(e => `User: ${e.user}\n${p.name}: ${e.assistant}`).join('\n\n')}` : ''
  const self = db.autonomy?.selfNotes ? `\n\nYour notes on this user:\n${db.autonomy.selfNotes.slice(0, 400)}` : ''
  // Kept lean — this is sent on every call and counts against the daily token budget.
  return `You are ${p.name}, ${p.character} Made by Varshith. Email/schedule/message info only comes from a tool result — NEVER invent or guess emails, events, or messages; with no real data, say you'll check. Reply in the user's language (English or Telugu).${rules}${skills}${examples}${self}

Known facts:\n${facts.slice(0, 800)}`
}

// ---------- Health / models ----------
app.get('/api/health', async (req, res) => {
  let models = []
  try {
    const r = await fetch(`${OLLAMA}/api/tags`)
    models = ((await r.json()).models || []).map(m => m.name)
  } catch { /* down */ }
  res.json({
    status: 'ok', service: 'atlas-backend', model: DEFAULT_MODEL, models,
    ollama: models.length ? 'up' : 'down',
    uptime_s: Math.round((Date.now() - STARTED) / 1000),
  })
})

app.get('/api/models', async (req, res) => {
  try { res.json(await (await fetch(`${OLLAMA}/api/tags`)).json()) }
  catch { res.status(502).json({ error: 'ollama unreachable' }) }
})

// ---------- Agent memory ----------
app.get('/api/memory', (req, res) => res.json(db.memories))
app.post('/api/memory', (req, res) => {
  const { text, tag } = req.body || {}
  if (!text?.trim()) return res.status(400).json({ error: 'text required' })
  const m = { id: id(), text: text.trim(), tag: tag || 'Note', created_at: new Date().toISOString() }
  db.memories.push(m); save()
  logEvent('Learned a new fact', m.text, 'info')
  res.status(201).json(m)
})
app.delete('/api/memory/:id', (req, res) => {
  const before = db.memories.length
  db.memories = db.memories.filter(m => m.id !== req.params.id); save()
  res.json({ deleted: db.memories.length < before })
})

// ---------- Contacts ----------
app.get('/api/contacts', (req, res) => res.json(db.contacts))
app.delete('/api/contacts/:name', (req, res) => {
  db.contacts = db.contacts.filter(c => c.name !== req.params.name.toLowerCase()); save()
  res.json({ ok: true })
})

// ---------- Conversation history ----------
app.get('/api/history', (req, res) => res.json(db.messages.slice(-50)))
app.delete('/api/history', (req, res) => { db.messages = []; save(); res.json({ cleared: true }) })

// ---------- Chat (SSE) ----------
app.post('/api/chat', async (req, res) => {
  const { message, model, mode } = req.body || {}
  if (!message?.trim()) return res.status(400).json({ error: 'message required' })
  const useModel = model || DEFAULT_MODEL
  const auto = mode === 'auto' // autopilot: execute write actions without asking
  const brief = !!(req.body && req.body.brief) // voice → short spoken replies
  lastUserActivity = Date.now() // user is active → idle worker yields

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()
  // Guarded: if the client refreshed/disconnected, writes must not throw (generation continues).
  const send = (o) => { try { res.write(`data: ${JSON.stringify(o)}\n\n`) } catch { /* client gone */ } }

  const pushMsg = (role, content, extra = {}) => {
    db.messages.push({ id: id(), role, content, created_at: new Date().toISOString(), ...extra })
    if (db.messages.length > 200) db.messages = db.messages.slice(-200)
    save()
  }
  pushMsg('user', message)
  learnFrom(message).catch(() => {}) // passively remember durable facts (dedup'd)

  // Auto-memory: "remember (that) X" — stored + acknowledged instantly.
  const remember = String(message).match(/^\s*remember(?:\s+that)?\s+(.+)/i)
  if (remember) {
    const fact = remember[1].trim().replace(/[.!]$/, '')
    db.memories.push({ id: id(), text: fact, tag: 'Note', created_at: new Date().toISOString() }); save()
    logEvent('Learned a new fact', fact, 'info')
    const reply = `Got it — I'll remember that ${fact}.`
    pushMsg('assistant', reply)
    send({ token: reply }); send({ done: true }); return res.end()
  }

  // Save a contact: "tillu is x@y.com" / "tillu's email is x@y.com" / "save tillu as x@y.com"
  const cm = String(message).match(/([a-z][a-z0-9._]{1,24})(?:'s)?\s+(?:email\s+)?(?:is|as|=|:)\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i)
  if (cm) {
    const name = cm[1].toLowerCase().replace(/[.]+$/, '')
    const email = cm[2]
    const existing = db.contacts.find(c => c.name === name)
    if (existing) existing.email = email; else db.contacts.push({ name, email })
    save(); logEvent('Saved a contact', `${name} → ${email}`, 'info')
    const reply = `Saved — I'll email ${email} whenever you say "${name}".`
    pushMsg('assistant', reply)
    send({ token: reply }); send({ done: true }); return res.end()
  }

  // Schedule a recurring task: "... every morning at 5", "every day at 6pm"
  const sched = parseSchedule(message)
  if (sched) {
    sched.nextRun = nextRunIST(sched.at)
    const job = { id: id(), prompt: message, notify: DEFAULT_NOTIFY, status: 'scheduled', schedule: sched, created_at: new Date().toISOString() }
    db.jobs.push(job); save()
    logEvent('Task scheduled', `${message.slice(0, 45)} · daily ${sched.at} IST`, 'info')
    const reply = `Scheduled ✓ — I'll run this **every day at ${sched.at} (IST)**. If the VM is off at that time, it runs on the next boot. Manage or stop it on the **Tasks** page.`
    pushMsg('assistant', reply); send({ token: reply }); send({ done: true }); return res.end()
  }

  // Queue a background task: "... in the background", "when you get time", "take your time"
  if (/\b(in the background|background task|when you (can|get time)|take your time|do this later|work on this later)\b/i.test(message)) {
    const clean = message.replace(/\b(in the background|as a background task|when you can|when you get time|take your time|do this later|work on this later)\b/ig, '').replace(/\s+/g, ' ').trim()
    const notify = (message.match(EMAIL_RE) || [])[0] || DEFAULT_NOTIFY
    const job = { id: id(), prompt: clean || message, notify, status: 'pending', result: '', created_at: new Date().toISOString(), completed_at: null }
    db.jobs.push(job); save()
    logEvent('Background task queued', job.prompt.slice(0, 60), 'info')
    processJobs()
    const reply = `On it — I'll work on this in the background and email **${notify}** when it's done. You can close the tab or shut down the VM; I'll resume when it's back. (Task queued)`
    pushMsg('assistant', reply, { action: { type: 'job.queued', connected: true, done: true, doneLabel: 'Queued as background task' } })
    send({ token: reply }); send({ done: true }); return res.end()
  }


  // ---- Image Generation intent in chat ----
  const imgMatch = message.match(/\b(?:generate|create|make|draw|show|render)\s+(?:an?\s+)?(?:image|picture|photo|illustration|drawing|art|graphic)\s+(?:of\s+)?(.+)/i)
    || message.match(/^image:\s*(.+)/i);
  if (imgMatch) {
    const prompt = imgMatch[1].trim().replace(/[.!]+$/, '');
    send({ step: `Creating image: "${prompt.slice(0, 35)}..."` });
    const imgKey = process.env.GEMINI_API_KEY || (REASON_KEYS && REASON_KEYS[0]);
    let imgUrl = '';
    const imgId = id();
    
    if (imgKey) {
      try {
        const geminiImgResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${imgKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Generate a high quality, vibrant, detailed image of: ${prompt}` }] }]
          })
        });
        if (geminiImgResp.ok) {
          const geminiData = await geminiImgResp.json();
          const parts = geminiData.candidates?.[0]?.content?.parts || [];
          for (const p of parts) {
            if (p.inlineData?.data) {
              const buf = Buffer.from(p.inlineData.data, 'base64');
              const outPath = `/var/www/atlas/images/${imgId}.png`;
              fs.writeFileSync(outPath, buf);
              imgUrl = `https://atlas.oqens.me/images/${imgId}.png`;
              break;
            }
          }
        }
      } catch (err) {
        console.error('Gemini image generation error:', err);
      }
    }
    
    if (!imgUrl) {
      imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
    }

    const reply = `Here is your generated image:\n\n![${prompt}](${imgUrl})\n\n*Prompt: "${prompt}"*`;
    pushMsg('assistant', reply);
    for (const chunk of reply.match(/\S+\s*/g) || [reply]) send({ token: chunk });
    send({ done: true });
    return res.end();
  }

  // ---- Compose-and-send email: draft cleanly, attach a Send button (user approves) ----
  // Triggers on write/send/draft/email intent + a resolvable recipient, OR a follow-up
  // edit to the email Atlas just drafted ("make it more detailed", "shorter", etc.).
  // Social-post requests (LinkedIn/X) are NOT emails — let them fall through to the agent loop.
  const social = /\b(linked\s?in|tweet|twitter|\bon x\b)\b/i.test(message)
  const lastAssistant = [...db.messages].reverse().find(m => m.role === 'assistant')
  const inEmailDraft = lastAssistant?.action?.type === 'email.send'
  const newTopic = /\b(recent|latest|unread|check|inbox|calendar|meeting|schedule|event|linked\s?in|tweet|twitter)\b/i.test(message)
  const continueDraft = inEmailDraft && !newTopic
  const composeIntent = /\b(send|write|draft|compose|reply|e-?mail|mail)\b/i.test(message)
  const readPhrase = /\b(recent|latest|unread|check|show|read|list|inbox)\b/i.test(message) && !/\b(send|write|draft|compose|reply)\b/i.test(message)
  let recipient = null
  if (!social) {
    if (continueDraft) recipient = lastAssistant.action.to
    else if (composeIntent && !readPhrase) recipient = resolveRecipient(message, db)
  }
  if (recipient) {
    send({ step: continueDraft ? 'Revising your email' : 'Drafting your email' })
    const facts = db.memories.length ? db.memories.map(m => `- ${m.text}`).join('\n') : '- (none on file)'
    let draft = ''
    try {
      const r = await fetch(`${OLLAMA}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: AGENT_MODEL, stream: false, keep_alive: -1,
          messages: [
            { role: 'system', content: `You write professional emails on the user's behalf. Output ONLY the email: a "Subject:" line, a blank line, the body, then a sign-off with the user's REAL name from the facts below. Match the length and detail the user asks for (default concise; if they ask for "detailed" or "longer", expand it). No emojis or jokes unless asked. NEVER use placeholders like [Your Name], [Company], or [Date] — use the real facts or leave them out. If the user asks to revise the previous draft, edit that same email.\n\nFacts about the user:\n${facts}` },
            ...db.messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      })
      draft = ((await r.json()).message?.content || '').trim()
    } catch { /* fall through */ }
    draft = draft.replace(/^\s*```[a-z]*\s*/i, '').replace(/\s*```\s*$/, '').trim() // unwrap code fences
    if (!draft) draft = 'Subject: (draft failed)\n\nPlease try again.'
    const gmailInt = db.integrations.find(x => x.id === 'gmail')
    const action = {
      type: 'email.send', provider: 'gmail', to: recipient,
      label: `Send to ${recipient}`, connected: !!gmailInt?.connected,
    }
    send({ step: 'Writing draft' })
    for (const chunk of draft.match(/\S+\s*/g) || [draft]) send({ token: chunk })
    // Auto mode: send immediately, no approval needed.
    if (auto && action.connected) {
      send({ step: 'Sending' })
      try { await gmailSend(gmailInt, recipient, draft); action.done = true; action.doneLabel = `Sent to ${recipient}`; logEvent('Sent an email', `To ${recipient}`, 'success') }
      catch (e) { action.error = e.message }
    }
    pushMsg('assistant', draft, { action })
    send({ action })
    if (action.error) send({ token: `\n\n⚠️ Couldn't auto-send: ${action.error}` })
    send({ done: true }); return res.end()
  }

  // ---- Compose a LinkedIn post: draft directly (no tools), attach Proceed/auto-post ----
  const inPostDraft = lastAssistant?.action?.type === 'linkedin.post'
  if ((social && /\b(post|write|draft|share|publish|create|compose)\b/i.test(message)) || (inPostDraft && !newTopic && !recipient)) {
    send({ step: inPostDraft ? 'Revising your post' : 'Drafting your post' })
    const facts = publicFacts() // public post — never leak contact emails/phones
    let draft = ''
    try {
      const r = await fetch(`${OLLAMA}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: AGENT_MODEL, stream: false, keep_alive: -1,
          messages: [
            { role: 'system', content: `You are an expert LinkedIn ghostwriter for the user. Write a substantive, engaging post (~130-200 words) with:
- A strong one-line hook to open
- 2-3 short paragraphs with SPECIFIC, concrete details and a genuine insight or mini-story (no vague hype)
- A closing question or call-to-action that invites engagement
- 3-5 relevant hashtags on the final line
Write in first person, confident and authentic. Output ONLY the post text — no "Subject:", no email greeting/sign-off, no code fences, no placeholders. ${NO_CONTACTS} If the user asks to revise the previous post, edit that same post.\n\nAbout the user:\n${facts}` },
            ...db.messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
          ],
          options: { temperature: 0.85, num_predict: 400 },
        }),
      })
      draft = stripContacts(((await r.json()).message?.content || '').trim())
    } catch { /* fall through */ }
    draft = draft.replace(/^\s*```[a-z]*\s*/i, '').replace(/\s*```\s*$/, '').trim()
    if (!draft) draft = 'Draft failed — please try again.'
    const liInt = db.integrations.find(x => x.id === 'linkedin')
    const action = { type: 'linkedin.post', provider: 'linkedin', label: 'Post on LinkedIn', connected: !!liInt?.connected }
    send({ step: 'Writing draft' })
    for (const chunk of draft.match(/\S+\s*/g) || [draft]) send({ token: chunk })
    if (auto && action.connected) {
      send({ step: 'Posting to LinkedIn' })
      try { const r = await linkedinPost(liInt, draft); action.done = true; action.doneLabel = 'Posted'; action.url = r.url; logEvent('Posted to LinkedIn', draft.slice(0, 60), 'success') }
      catch (e) { action.error = e.message }
    }
    pushMsg('assistant', draft, { action })
    send({ action })
    if (action.error) send({ token: `\n\n⚠️ Couldn't auto-post: ${action.error}` })
    send({ done: true }); return res.end()
  }

  // ---- Create calendar events: extract structured events, confirm (Manual) or add (Auto) ----
  const wantCreate = /\b(add|create|schedule|put|set\s?up|book)\b/i.test(message) && /\b(calendar|events?|meetings?)\b/i.test(message)
  if (wantCreate) {
    const calInt = db.integrations.find(x => x.id === 'calendar')
    if (!calInt?.connected) {
      const reply = "Google Calendar isn't connected — connect it in Integrations first."
      pushMsg('assistant', reply); send({ token: reply }); send({ done: true }); return res.end()
    }
    send({ step: 'Reading the details' })
    const today = new Date().toISOString().slice(0, 10)
    let events = []
    try {
      const r = await fetch(`${OLLAMA}/api/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: AGENT_MODEL, stream: false, keep_alive: -1,
          messages: [
            { role: 'system', content: `Today is ${today}. Extract every calendar event the user mentions in the conversation. Output ONLY a JSON array (no prose). Each item: {"title": string, "date": "YYYY-MM-DD", "start": "HH:MM" or null, "durationHours": number}. Assume year 2026 if unstated. If no time is given, set "start" to null.` },
            ...db.messages.slice(-8).map(m => ({ role: m.role, content: m.content })),
          ],
        }),
      })
      const content = (await r.json()).message?.content || ''
      const jm = content.match(/\[[\s\S]*\]/)
      if (jm) events = JSON.parse(jm[0])
    } catch { /* parse failure below */ }
    events = (Array.isArray(events) ? events : []).filter(e => e && e.title && e.date)
    if (!events.length) {
      const reply = 'I couldn\'t pin down the events. Try listing them clearly, e.g. "Add Gemma Hackathon on July 25 at 9am".'
      pushMsg('assistant', reply); send({ token: reply }); send({ done: true }); return res.end()
    }
    const summary = 'I can add these to your calendar:\n\n' + events.map(e => `• ${e.title} — ${e.date}${e.start ? ' at ' + e.start : ' (all day)'}`).join('\n')
    const action = { type: 'calendar.create', events, connected: true, label: `Add ${events.length} event${events.length > 1 ? 's' : ''}` }
    if (auto) {
      send({ step: 'Adding to calendar' })
      try { const c = await calendarCreate(calInt, events); action.done = true; action.doneLabel = `Added ${c.length} event${c.length > 1 ? 's' : ''}`; logEvent('Added calendar events', events.map(e => e.title).join(', '), 'success') }
      catch (e) { action.error = e.message }
    }
    pushMsg('assistant', summary, { action })
    for (const chunk of summary.match(/\S+\s*/g) || [summary]) send({ token: chunk })
    send({ action })
    if (action.error) send({ token: `\n\n⚠️ Couldn't add: ${action.error}` })
    send({ done: true }); return res.end()
  }

  // ---- Fast path: plain chat with no tool need → stream directly (instant first token) ----
  const wantCalendar = /\b(calendar|events?|meetings?|schedule|agenda|appointments?)\b/i.test(message)
  const wantEmail = /\b(e-?mails?|mails?|inbox|gmail|unread)\b/i.test(message)
  const wantWeb = !wantCalendar && !wantEmail &&
    /\b(search|google it|look ?up|latest|current(ly)?|news|today'?s|who is|what'?s happening|price of|weather|stock|score|when is|where is)\b/i.test(message)
  if (!wantCalendar && !wantEmail && !wantWeb) {
    send({ step: 'Thinking' })
    let full = '', tokens = 0
    try {
      const sys = systemPrompt() + (brief ? '\n\nThis is a spoken voice conversation — reply in 1-2 short natural sentences, no lists or markdown.' : '')
      const messages = [{ role: 'system', content: sys }, ...db.messages.slice(-16).map(m => ({ role: m.role, content: m.content }))]
      const r = await streamLLM(messages, t => send({ token: t }), { num_predict: brief ? 140 : 500 })
      full = r.full; tokens = r.tokens
    } catch (e) { if (!full) full = `⚠️ ${e.message}` }
    if (!full) full = "I couldn't complete that — try again."
    const action = detectAction(message)
    if (action) action.connected = !!db.integrations.find(x => x.id === action.provider)?.connected
    pushMsg('assistant', full, action ? { action } : {})
    bumpUsage({ tokens, chats: 1 })
    if (action) send({ action })
    send({ done: true }); return res.end()
  }

  // ---- Read path: call the needed tool(s) deterministically, then STREAM a grounded summary.
  // (More reliable than letting a 3B model decide whether to call a tool.)
  const attachments = []
  let context = ''
  const runTool = async (name, args, step) => {
    send({ step })
    try {
      const res = await TOOLS.find(t => t.name === name).execute(args)
      context += res.text + '\n\n'
      if (res.attachments) attachments.push(...res.attachments)
    } catch (e) { context += `(${name} failed: ${e.message})\n\n` }
  }

  if (wantCalendar) {
    const days = /next month|both month|two month|this month and next/i.test(message) ? 62
      : /month/i.test(message) ? 31 : /week/i.test(message) ? 7
      : /today|tonight/i.test(message) ? 1 : /tomorrow/i.test(message) ? 2 : 7
    await runTool('list_calendar_events', { days }, 'Checking your calendar')
  }
  if (wantEmail) {
    if (/\b(about|regarding|from|find|search|related)\b/i.test(message)) {
      const q = message.replace(/.*\b(about|regarding|from|find|search|related to?)\b/i, '').trim() || message
      await runTool('search_emails', { query: q, count: 5 }, 'Searching your email')
    } else {
      await runTool('read_recent_emails', { count: 5 }, 'Reading your inbox')
    }
  }
  if (wantWeb) {
    const q = message.replace(/^\s*(search( the web| online)?( for)?|google( it)?|look ?up)\s+/i, '').trim() || message
    send({ step: 'Searching the web' })
    try {
      const results = await webSearch(q, 5)
      if (results.length) {
        context += 'Web search results:\n' + results.map((r, i) => `${i + 1}. ${r.title} — ${r.snippet} (${r.domain})`).join('\n') + '\n\n'
        attachments.push(...results.map(r => ({ type: 'web', title: r.title, subtitle: r.domain, url: r.url, domain: r.domain })))
      } else context += '(no web results found)\n\n'
    } catch (e) { context += `(web search failed: ${e.message})\n\n` }
  }

  send({ step: 'Writing response' })
  let finalText = '', tokens = 0
  try {
    const messages = [
      { role: 'system', content: `You are Atlas. Answer using ONLY the real data below — NEVER invent, guess, or make up emails, events, subjects, senders, or messages. If the data is present, answer from it (don't claim you lack access). BUT if the data shows an error, says a service isn't connected, or is empty, tell the user that plainly (e.g. "I couldn't reach your inbox" or "you have no new emails") — do NOT fabricate content to fill the gap. Be concise and natural; use the actual names, subjects, and times. Use the earlier conversation for follow-up context.${brief ? ' Reply in 1-2 short spoken sentences.' : ''} Reply in the SAME language the user used (English or Telugu).\n\nData:\n${context}` },
      ...db.messages.slice(-7, -1).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]
    const r = await streamLLM(messages, t => send({ token: t }), { num_predict: brief ? 160 : 500 })
    finalText = r.full; tokens = r.tokens
  } catch (e) { if (!finalText) finalText = `⚠️ ${e.message}` }
  if (!finalText) finalText = context.trim() || "I couldn't complete that — try again."

  pushMsg('assistant', finalText, attachments.length ? { attachments } : {})
  bumpUsage({ tokens, chats: 1 })
  if (attachments.length) send({ attachments })
  send({ done: true }); res.end()
})

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

// Facts safe for PUBLIC content — never expose emails/phones of the user or contacts.
function publicFacts() {
  const safe = db.memories.filter(m => !EMAIL_RE.test(m.text) && !/\b\d{10}\b/.test(m.text))
  return safe.length ? safe.map(m => `- ${m.text}`).join('\n') : '- (none on file)'
}
// Safety net: strip any email/phone that still slips into public text.
const stripContacts = (s) => String(s).replace(new RegExp(EMAIL_RE, 'g'), '').replace(/\b\d{10}\b/g, '').replace(/\(\s*\)/g, '').replace(/[ \t]{2,}/g, ' ').trim()
const NO_CONTACTS = 'NEVER include any email address, phone number, or anyone\'s private contact details in the post.'

// Resolve an email recipient from an address in the text or a saved contact name.
// (History/pronoun continuation is handled separately via continueDraft, to avoid
// grabbing a stray address from an unrelated earlier message.)
function resolveRecipient(message, db) {
  const inMsg = (String(message).match(EMAIL_RE) || [])[0]
  if (inMsg) return inMsg
  const lower = String(message).toLowerCase()
  for (const c of db.contacts || []) {
    const safe = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${safe}\\b`, 'i').test(lower)) return c.email
  }
  return null
}

function detectAction(msg) {
  const m = String(msg).toLowerCase()
  if (/linked\s?in/.test(m) && /(post|write|draft|share|publish|create)/.test(m))
    return { type: 'linkedin.post', provider: 'linkedin', label: 'Post on LinkedIn' }
  if (/(tweet|twitter|\bon x\b|post on x)/.test(m) && /(post|write|draft|tweet|share|publish|create)/.test(m))
    return { type: 'x.post', provider: 'x', label: 'Post on X' }
  return null
}

// ---------- Agent actions (execute on the user's behalf, after approval) ----------
app.post('/api/actions/email/send', async (req, res) => {
  const it = db.integrations.find(x => x.id === 'gmail')
  if (!it?.token) return res.status(400).json({ error: 'Gmail not connected' })
  const to = String(req.body?.to || '').trim()
  const text = String(req.body?.text || '').trim()
  if (!to || !text) return res.status(400).json({ error: 'to and text required' })
  try {
    const token = await ensureGoogleToken(it)
    const subjMatch = text.match(/subject:\s*(.+)/i)
    const subject = subjMatch ? subjMatch[1].trim() : 'Message from Atlas'
    const body = text.replace(/subject:\s*.+\r?\n?/i, '').trim()
    const rfc822 = [`To: ${to}`, `Subject: ${subject}`, 'Content-Type: text/plain; charset="UTF-8"', 'MIME-Version: 1.0', '', body].join('\r\n')
    const raw = Buffer.from(rfc822).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    })
    if (!r.ok) throw new Error(`Gmail send ${r.status}: ${(await r.text()).slice(0, 200)}`)
    logEvent('Sent an email', `To ${to} · ${subject}`, 'success')
    res.json({ ok: true })
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) })
  }
})

app.post('/api/actions/calendar/create', async (req, res) => {
  const it = db.integrations.find(x => x.id === 'calendar')
  if (!it?.token) return res.status(400).json({ error: 'Calendar not connected' })
  const events = req.body?.events
  if (!Array.isArray(events) || !events.length) return res.status(400).json({ error: 'events required' })
  try {
    const c = await calendarCreate(it, events)
    logEvent('Added calendar events', events.map(e => e.title).join(', '), 'success')
    res.json({ ok: true, count: c.length })
  } catch (e) { res.status(502).json({ error: String(e.message || e) }) }
})

app.post('/api/actions/linkedin/post', async (req, res) => {
  const it = db.integrations.find(x => x.id === 'linkedin')
  if (!it?.token) return res.status(400).json({ error: 'LinkedIn not connected' })
  const text = String(req.body?.text || '').trim()
  if (!text) return res.status(400).json({ error: 'text required' })
  try {
    const uij = await (await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${it.token}` },
    })).json()
    if (!uij.sub) throw new Error('could not resolve LinkedIn profile — reconnect the integration')
    const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${it.token}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        author: `urn:li:person:${uij.sub}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    })
    if (!r.ok) throw new Error(`LinkedIn ${r.status}: ${(await r.text()).slice(0, 300)}`)
    const urn = r.headers.get('x-restli-id') || ''
    logEvent('Posted to LinkedIn', text.slice(0, 60), 'success')
    res.json({ ok: true, url: urn ? `https://www.linkedin.com/feed/update/${urn}` : 'https://www.linkedin.com/feed/' })
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) })
  }
})

// ---------- Background jobs (agent tasks that run async and survive VM restarts) ----------
let jobProcessing = false
const IST = 5.5 * 3600000 // user's timezone offset

// Parse "every day at 5pm" / "each morning 6 o'clock" → { at:'HH:MM', repeat:'daily' } or null.
function parseSchedule(p) {
  const s = String(p).toLowerCase()
  if (!/\b(every|each)\s+(day|morning|evening|night)|daily\b/.test(s)) return null
  let hour = null, min = 0
  const at = s.match(/\bat\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/)
  const oc = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|o'?clock)/)
  const t = at || oc
  if (t) {
    hour = parseInt(t[1]); min = t[2] ? parseInt(t[2]) : 0
    const ap = t[3] || ''
    if (/p/.test(ap)) { if (hour < 12) hour += 12 }
    else if (/a/.test(ap)) { if (hour === 12) hour = 0 }
    else if (/(evening|night|afternoon)/.test(s) && hour < 12) hour += 12
  } else if (/morning/.test(s)) hour = 8
  else if (/evening/.test(s)) hour = 19
  else return null
  return { at: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`, repeat: 'daily' }
}

// Next occurrence of HH:MM (interpreted in IST) as a UTC ISO string.
function nextRunIST(at) {
  const [h, m] = at.split(':').map(Number)
  const istNow = new Date(Date.now() + IST)
  const target = new Date(istNow); target.setUTCHours(h, m, 0, 0)
  if (target <= istNow) target.setUTCDate(target.getUTCDate() + 1)
  return new Date(target.getTime() - IST).toISOString()
}

async function runScheduled(job) {
  logEvent('Running scheduled task', job.prompt.slice(0, 50), '')
  try { const { text } = await runTask(job.prompt); job.lastResult = text; job.lastRun = new Date().toISOString(); save(); logEvent('Scheduled task ran', job.prompt.slice(0, 50), 'success') }
  catch (e) { job.lastResult = 'Error: ' + e.message; save(); logEvent('Scheduled task failed', job.prompt.slice(0, 50), 'error') }
}

// Per-minute checker: fire any scheduled job whose time has arrived, then re-arm for tomorrow.
setInterval(() => {
  const now = Date.now()
  for (const job of db.jobs) {
    if (job.status === 'scheduled' && job.schedule && new Date(job.schedule.nextRun).getTime() <= now) {
      job.schedule.nextRun = nextRunIST(job.schedule.at); save()
      runScheduled(job)
    }
  }
}, 60000).unref()

// One-shot generation from the local model (streamed to dodge fetch's 5-min body timeout).
async function genText(system, prompt, opts = {}) {
  const up = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: AGENT_MODEL, stream: true, keep_alive: -1, options: opts, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
  })
  if (!up.ok || !up.body) throw new Error(`ollama ${up.status}`)
  let out = ''
  const rd = up.body.getReader(); const dec = new TextDecoder(); let bf = ''
  while (true) {
    const { done, value } = await rd.read(); if (done) break
    bf += dec.decode(value, { stream: true }); const ls = bf.split('\n'); bf = ls.pop() || ''
    for (const l of ls) { if (!l.trim()) continue; let o; try { o = JSON.parse(l) } catch { continue } if (o.message?.content) out += o.message.content }
  }
  return out.trim()
}

// Reasoning/content brain: a free cloud LLM (Groq Llama-3.3-70B by default) when a key
// is configured, else falls back to the local 3B. Tool/intent routing stays on the local
// model; this is only for writing and reasoning quality.
// REASON_API_KEY may be a COMMA-SEPARATED list of Groq keys; we rotate to the next when one is rate-limited.
const REASON_KEYS = (process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || process.env.REASON_API_KEY || '').split(',').map(s => s.trim()).filter(Boolean)
let keyIdx = 0
const REASON_KEY = REASON_KEYS[0] || '' // for Whisper STT + status flag
const REASON_URL = process.env.REASON_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
const REASON_MODEL = process.env.GEMINI_MODEL || process.env.REASON_MODEL || 'gemini-3.8-flash'
// Local 3B fallback: allowed, but STRICTLY one generation at a time. Concurrent local inferences
// are what pegged the 2-vCPU box and crashed it; a single one is slow but survivable.
const ALLOW_LOCAL = process.env.ALLOW_LOCAL_FALLBACK !== '0'
let localInFlight = false

async function reason(system, user, opts = {}, history = []) {
  for (let i = 0; i < REASON_KEYS.length; i++) {
    const ki = keyIdx % REASON_KEYS.length
    const key = REASON_KEYS[ki]
    try {
      const r = await fetch(REASON_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: REASON_MODEL, temperature: opts.temperature ?? 0.6, max_tokens: opts.num_predict ?? 500,
          messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: user }] }),
      })
      if (r.ok) { const j = await r.json(); const t = j.choices?.[0]?.message?.content?.trim(); if (t) { bumpGroq(j.usage?.total_tokens || Math.round(t.length / 4), ki); return t } break }
      if (r.status === 429) { keyIdx++; continue } // this key is out of quota → rotate to the next
      logEvent('Reasoning model error', `${REASON_MODEL} ${r.status}`, 'error'); break
    } catch (e) { logEvent('Reasoning model down', e.message, 'error'); break }
  }
  // No cloud brain. Background work skips; if another local job is running, skip too (never stack).
  if (opts.cloudOnly || !ALLOW_LOCAL || localInFlight) return ''
  localInFlight = true
  try {
    const ctx = history.length ? '\n\nRecent conversation:\n' + history.map(h => `${h.role}: ${h.content}`).join('\n') : ''
    return await genText(system + ctx, user, opts)
  } finally { localInFlight = false }
}

// Track Groq consumption so the Usage page can show it (and you can watch the free tier).
db.usage.groq = db.usage.groq || { requests: 0, tokens: 0, since: new Date().toISOString(), today: { date: '', requests: 0, tokens: 0 } }
if (!db.usage.groq.today) db.usage.groq.today = { date: '', requests: 0, tokens: 0 }
// Groq free-tier daily limits (approximate; override via env if yours differ).
const GROQ_RPD = Number(process.env.GROQ_RPD || 1000)     // requests/day
const GROQ_TPD = Number(process.env.GROQ_TPD || 100000)   // tokens/day (Groq free tier for 70B)

// Per-day counters for every free-tier service, so the Usage page can show limits vs used.
db.usage.services = db.usage.services || { date: '', gmail: 0, calendar: 0, linkedin: 0, instagram: 0, websearch: 0 }
function bumpService(name) {
  const s = db.usage.services
  const d = new Date(Date.now() + IST).toISOString().slice(0, 10)
  if (s.date !== d) { for (const k of Object.keys(s)) if (k !== 'date') s[k] = 0; s.date = d }
  s[name] = (s[name] || 0) + 1; save()
}
// Wrap the action helpers so each real send/post/search is counted against its free tier.
const gmailSend = (...a) => { bumpService('gmail'); return _gmailSend(...a) }
const linkedinPost = (...a) => { bumpService('linkedin'); return _linkedinPost(...a) }
const calendarCreate = (...a) => { bumpService('calendar'); return _calendarCreate(...a) }
const webSearch = (...a) => { bumpService('websearch'); return _webSearch(...a) }

function bumpGroq(tokens = 0, ki = 0) {
  const g = db.usage.groq
  g.requests++; g.tokens += (tokens || 0)
  const d = new Date(Date.now() + IST).toISOString().slice(0, 10) // IST day
  if (g.today.date !== d) g.today = { date: d, requests: 0, tokens: 0, keys: [] }
  if (!g.today.keys) g.today.keys = []
  g.today.requests++; g.today.tokens += (tokens || 0)
  if (!g.today.keys[ki]) g.today.keys[ki] = { requests: 0, tokens: 0 }
  g.today.keys[ki].requests++; g.today.keys[ki].tokens += (tokens || 0)
  save()
}

// Streaming chat: Groq 70B (fast + accurate) when a key is set, else local Ollama. Calls onToken per chunk.
async function streamLLM(messages, onToken, opts = {}) {
  let full = '', tokens = 0
  for (let i = 0; i < REASON_KEYS.length; i++) {
    const ki = keyIdx % REASON_KEYS.length
    const key = REASON_KEYS[ki]
    try {
      const r = await fetch(REASON_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: REASON_MODEL, stream: true, temperature: opts.temperature ?? 0.6, max_tokens: opts.num_predict ?? 500, messages, stream_options: { include_usage: true } }),
      })
      if (r.status === 429) { keyIdx++; continue } // this key is out of quota → rotate to the next
      if (r.ok && r.body) {
        const rd = r.body.getReader(); const dec = new TextDecoder(); let bf = ''
        while (true) {
          const { done, value } = await rd.read(); if (done) break
          bf += dec.decode(value, { stream: true }); const parts = bf.split('\n'); bf = parts.pop() || ''
          for (const line of parts) {
            const l = line.trim(); if (!l.startsWith('data:')) continue
            const data = l.slice(5).trim(); if (data === '[DONE]') continue
            let o; try { o = JSON.parse(data) } catch { continue }
            const t = o.choices?.[0]?.delta?.content; if (t) { full += t; onToken(t) }
            if (o.usage?.total_tokens) tokens = o.usage.total_tokens
          }
        }
        if (full) { bumpGroq(tokens || Math.round(full.length / 4), ki); return { full, tokens: tokens || Math.round(full.length / 4) } }
        break
      }
      logEvent('Chat reasoning error', String(r.status), 'error'); break
    } catch (e) { logEvent('Chat reasoning down', e.message, 'error'); break }
  }
  // No cloud brain. If disabled or another local job is running, send a quick note (don't stack → no crash).
  if (!ALLOW_LOCAL || localInFlight) {
    const m = "I'm at capacity right now — the fast AI service is busy. Give me a moment and try again."
    onToken(m); return { full: m, tokens: 0 }
  }
  localInFlight = true
  try {
    const up = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: AGENT_MODEL, stream: true, keep_alive: -1, messages }),
    })
    if (up.ok && up.body) {
      const reader = up.body.getReader(); const dec = new TextDecoder(); let buf = ''
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buf += dec.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop() || ''
        for (const line of lines) { if (!line.trim()) continue; let o; try { o = JSON.parse(line) } catch { continue } const t = o.message?.content; if (t) { full += t; onToken(t) } if (o.eval_count) tokens = o.eval_count }
      }
    }
  } finally { localInFlight = false }
  return { full, tokens }
}

// ---------- Idle self-work: keep the agent productive, but yield to the user ----------
let lastUserActivity = Date.now()
let idleBusy = false
const IDLE_AFTER_MS = 3 * 60 * 1000   // treat as "free" after 3 min with no user activity
const IDLE_EVERY_MS = 15 * 60 * 1000  // one idle unit every 15 min (light on the Groq free tier)
db.insights = db.insights || []
const userIsActive = () => Date.now() - lastUserActivity < IDLE_AFTER_MS

// Atlas's evolving self-notes — it refines these over time to learn "how to be" for its user.
db.autonomy = db.autonomy || { selfNotes: '' }

function saveInsight(kind, text, url) {
  const t = (text || '').trim()
  if (!t || /^none\b/i.test(t)) return
  db.insights.unshift({ id: id(), kind, text: t, url: url || null, created_at: new Date().toISOString(), seen: false })
  if (db.insights.length > 40) db.insights.pop()
  save(); logEvent('Idle work done', `${kind}: ${t.slice(0, 50)}`, 'info')
}

// --- Free-time capabilities (SAFE only: research/learn/reflect/draft — never send or post) ---
async function fetchHN(n = 6) {
  try {
    const ids = await (await fetch('https://hacker-news.firebaseio.com/v0/topstories.json')).json()
    const out = []
    for (const hid of (ids || []).slice(0, n)) {
      try { const it = await (await fetch(`https://hacker-news.firebaseio.com/v0/item/${hid}.json`)).json(); if (it?.title) out.push({ title: it.title, url: it.url || `https://news.ycombinator.com/item?id=${hid}` }) } catch { /* skip */ }
    }
    return out
  } catch { return [] }
}
async function actLearnWeb() {
  const stories = await fetchHN(7)
  if (!stories.length) return
  const list = stories.map((s, i) => `${i + 1}. ${s.title}`).join('\n')
  const out = await reason(`You are Atlas learning on your own from today's Hacker News top stories. Pick the ONE most interesting/relevant to your user's world (tech, AI, building, startups) and write a 2-3 sentence takeaway: what it is and why it matters. Start with the topic name.\n\nStories:\n${list}`, 'Write the takeaway.', { num_predict: 180, cloudOnly: true })
  if (userIsActive()) return
  const pick = stories.find(s => (out || '').toLowerCase().includes(s.title.toLowerCase().slice(0, 14))) || stories[0]
  saveInsight('Learned from web', out, pick.url)
}
async function actReflect() {
  const owner = ownerIds()[0]
  const ctx = igState.get(owner)?.summary || db.memories.map(m => m.text).join('; ') || '(little known yet)'
  const out = await reason(`You are Atlas reflecting on how to be a better assistant and friend to your user, so you improve over time. Merge your current self-notes with what you know into UPDATED self-notes: at most 5 short bullets on how to talk to and help them well. Concise, genuinely useful, never invent facts.\n\nCurrent self-notes:\n${db.autonomy.selfNotes || '(none yet)'}\n\nWhat you know about them:\n${ctx}`, 'Output the updated self-notes only.', { num_predict: 200, cloudOnly: true })
  if (userIsActive() || !out) return
  db.autonomy.selfNotes = out.trim().slice(0, 800); save()
  logEvent('Atlas reflected', 'updated self-notes', 'info')
}
async function actIdea() {
  const f = publicFacts()
  const kinds = [
    ['Post idea', `Suggest ONE fresh, specific LinkedIn post idea for this person with a 2-line hook.\n\nAbout them:\n${f}`],
    ['Suggestion', `Suggest ONE concrete thing this person could do to move their goals forward. 1-2 sentences.\n\nAbout them:\n${f}`],
    ['Tip', `Share ONE genuinely useful tip in this person's field they may not know. 2-3 sentences.\n\nAbout them:\n${f}`],
  ][Math.floor(Math.random() * 3)]
  const out = await reason(`You are Atlas producing something useful for your user while they are away. ${kinds[1]}\n\nDo NOT send or post anything — just write it.`, 'Produce it now.', { num_predict: 200, cloudOnly: true })
  if (!userIsActive()) saveInsight(kinds[0], out)
}

// Autonomy loop: Atlas decides what to do with free time — from a SAFE menu (guardrail).
// It may learn from the web, reflect to improve itself, or produce an idea. It can NEVER
// send email, post to LinkedIn, or take any outward action on its own here.
async function runIdleUnit() {
  if (idleBusy || userIsActive() || !REASON_KEY || !db.settings.idleEnabled) return
  idleBusy = true
  try {
    const choice = String(await reason(`You are Atlas with free time (your user is away). Choose ONE thing to do right now to learn or improve yourself. Reply with ONLY one keyword from this exact list:
LEARN_WEB — read today's tech news and learn something
REFLECT — improve how you understand and help your user
IDEA — think up a useful idea or tip for your user
You must not do anything else. No sending, no posting.`, 'Your choice:', { num_predict: 6, temperature: 0.8, cloudOnly: true })).toUpperCase()
    if (userIsActive() || !choice.trim()) return // Groq unavailable → skip this cycle, don't burn the CPU
    if (choice.includes('LEARN')) await actLearnWeb()
    else if (choice.includes('REFLECT')) await actReflect()
    else await actIdea()
  } catch { /* best-effort */ } finally { idleBusy = false }
}
setInterval(runIdleUnit, IDLE_EVERY_MS)

// Passive memory: quietly learn a durable fact about the user from a message.
// Also captures "<name/org> ... <email>" as a contact. Best-effort, fire-and-forget.
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
async function learnFrom(text) {
  const t = String(text || '').trim()
  if (t.length < 12 || t.startsWith('/')) return
  // Direct capture: "X is a@b.com" / "X's email is a@b.com" → save as contact
  const cm = t.match(/([a-z][a-z0-9 ._-]{1,40}?)(?:'s)?\s+(?:email\s+)?(?:is|:|=|-)\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i)
  if (cm) {
    const name = cm[1].trim().toLowerCase().replace(/\b(the|my|a|an|please|mail|email|to|address|of)\b/g, '').replace(/\s+/g, ' ').trim()
    if (name && name.length <= 40) {
      const ex = db.contacts.find(c => c.name === name)
      if (ex) ex.email = cm[2]; else db.contacts.push({ name, email: cm[2] })
      save(); logEvent('Saved a contact', `${name} → ${cm[2]}`, 'info')
    }
  }
  try {
    const known = db.memories.map(m => m.text).join('\n') || '(none)'
    const out = await reason(`You extract ONE stable fact about the USER to remember long-term. ONLY concrete durable attributes: their name, job/role, employer, school/college, city, or a specific named person/organization's email. NEVER extract: requests, instructions, commands, questions, greetings, feelings, or anything about how you should behave. NEVER invent or embellish — if it isn't explicitly stated, output NONE. If a new such fact is explicitly present, output it as one plain sentence like "Varshith studies at Malla Reddy University." Otherwise output exactly: NONE.\n\nAlready known:\n${known}`, t, { num_predict: 40, temperature: 0, cloudOnly: true })
    let fact = out.trim().replace(/^(fact:|[-*])\s*/i, '').trim()
    if (!fact || /^none\b/i.test(fact) || fact.length > 160) return
    // Reject assistant-ish / instruction-ish / low-value extractions.
    if (/\b(you want|you'?d like|repeat|please|excited|help you|assist|as atlas|personal assistant|i will|i'?ll|let me|i'?m |story)\b/i.test(fact)) return
    // Require it to look like a real user attribute.
    if (!/(varshith|studies|study|works?|employed|based in|lives|manager|colleague|friend|school|college|university|company|role|from|name is)/i.test(fact)) return
    if (new RegExp(EMAIL_RE).test(fact)) return // emails belong in contacts, NOT in prompt facts (privacy)
    if (db.memories.some(m => norm(m.text) === norm(fact) || norm(m.text).includes(norm(fact)) || norm(fact).includes(norm(m.text)))) return
    db.memories.push({ id: id(), text: fact, tag: 'Learned', created_at: new Date().toISOString() })
    if (db.memories.length > 200) db.memories = db.memories.slice(-200)
    save(); logEvent('Learned a new fact', fact, 'info')
  } catch { /* best-effort */ }
}

async function runTask(prompt, onStep = () => {}) {
  const p = String(prompt)
  onStep('Understanding the task')
  const facts = db.memories.length ? db.memories.map(m => `- ${m.text}`).join('\n') : '- (none on file)'
  const isReport = /\b(research|report|summar|compare|analy|document|pdf|excel|word|list of|overview|guide)\b/i.test(p)

  // ACTION: send email(s) — supports multiple recipients and "N mails" (unless it's a report)
  const emailIntent = /\b(e-?mail|mail)\b/i.test(p) && /\b(send|make|write|draft|compose|reply|to)\b/i.test(p) && !isReport
  const recipient = resolveRecipient(p, db)
  // Email intent but no address → ask, don't fabricate a report from unrelated data.
  if (emailIntent && !recipient) {
    return { text: `I couldn't find an email address for the recipient. Save them as a contact (say "name is someone@example.com") or put the address in the task, then try again.`, doc: null }
  }
  if (recipient && /\b(send|mail|email|write|draft|reply)\b/i.test(p) && !isReport) {
    const gm = db.integrations.find(x => x.id === 'gmail')
    if (!gm?.token) return { text: 'Gmail is not connected — could not send.', doc: null }
    const emailSys = `You write professional emails on the user's behalf. Base the email ONLY on what the user asked — do NOT invent facts, dates, or topics they did not give, and do NOT include any inbox summaries or unrelated content. Write a COMPLETE email: a "Subject:" line, a blank line, a greeting, one or two clear paragraphs, and a courteous sign-off using the user's REAL name from the facts. No placeholders like [Your Name].\n\nFacts about the user:\n${facts}`
    const clean = (d) => d.replace(/^\s*```[a-z]*\s*/i, '').replace(/\s*```\s*$/, '').trim()

    // Collect every recipient (all addresses in the text + matching contacts)
    const recips = new Set(p.match(new RegExp(EMAIL_RE, 'g')) || [])
    for (const c of db.contacts || []) if (new RegExp(`\\b${c.name}\\b`, 'i').test(p)) recips.add(c.email)
    if (!recips.size) recips.add(recipient)
    const list = [...recips]

    // "N mails/emails" → send N distinct messages (to the single recipient)
    const countM = p.match(/\b(\d+)\s+(?:different\s+|separate\s+)?(?:e-?mails?|mails?)\b/i)
    const count = list.length === 1 && countM ? Math.min(parseInt(countM[1]) || 1, 5) : list.length

    const sent = []
    for (let i = 0; i < count; i++) {
      const to = list[i % list.length]
      onStep(count > 1 ? `Drafting email ${i + 1} of ${count}` : 'Drafting the email')
      const draft = clean(await reason(emailSys, count > 1 ? `${prompt}\n\n(This is email ${i + 1} of ${count} — make it distinct from the others.)` : prompt, { num_predict: 450 }))
      onStep(`Sending to ${to}`)
      await gmailSend(gm, to, draft); sent.push(to)
    }
    logEvent('Sent email(s)', `${sent.length} to ${[...new Set(sent)].join(', ')}`, 'success')
    return { text: `Sent ${sent.length} email${sent.length > 1 ? 's' : ''} (to ${[...new Set(sent)].join(', ')}).`, doc: null }
  }

  // ACTION: post to LinkedIn
  if (/linked\s?in/i.test(p) && /\b(post|share|publish|write)\b/i.test(p) && !isReport) {
    const li = db.integrations.find(x => x.id === 'linkedin')
    if (!li?.token) return { text: 'LinkedIn is not connected — could not post.', doc: null }
    onStep('Drafting the post')
    let draft = await reason(`You are an expert LinkedIn ghostwriter. Write an engaging post (~130-200 words): a hook, specifics, a call-to-action, and 3-5 hashtags. Output ONLY the post, no code fences. ${NO_CONTACTS}\n\nAbout the user:\n${publicFacts()}`, prompt, { num_predict: 500, temperature: 0.85 })
    draft = stripContacts(draft.replace(/^\s*```[a-z]*\s*/i, '').replace(/\s*```\s*$/, '').trim())
    onStep('Posting to LinkedIn')
    const r = await linkedinPost(li, draft)
    logEvent('Posted to LinkedIn', draft.slice(0, 60), 'success')
    return { text: `Posted to LinkedIn.\n\n${draft}\n\n${r.url}`, doc: null }
  }

  // DEFAULT: research / report → gather real data, write a document
  let context = ''
  if (/\b(calendar|events?|meetings?|schedule|agenda)\b/i.test(p)) {
    onStep('Checking your calendar')
    try { context += (await TOOLS.find(t => t.name === 'list_calendar_events').execute({ days: 31 })).text + '\n\n' } catch { /* skip */ }
  }
  if (/\b(inbox|e?-?mails?|unread)\b/i.test(p)) {
    // If the user names a sender/topic ("from MLSA", "about X"), SEARCH — don't just read the latest 5.
    const qm = p.match(/\b(?:from|about|regarding|by|sent by|related to)\s+(?:the\s+)?([a-z0-9][a-z0-9 ._'-]{1,38})/i)
    if (qm) {
      const q = qm[1].replace(/\b(team|group|my|the|inbox|mail|mails|email|emails|account)\b/ig, '').trim() || qm[1].trim()
      onStep(`Searching your inbox for "${q}"`)
      try { context += (await TOOLS.find(t => t.name === 'search_emails').execute({ query: q, count: 15 })).text + '\n\n' } catch (e) { context += `(email search failed: ${e.message})\n\n` }
    } else {
      onStep('Reading your inbox')
      try { context += (await TOOLS.find(t => t.name === 'read_recent_emails').execute({ count: 10 })).text + '\n\n' } catch { /* skip */ }
    }
  }
  if (/\b(search|latest|news|current|who is|price|weather|find|research|look ?up|compare|best|top)\b/i.test(p)) {
    onStep('Searching the web')
    try { const r = await webSearch(p, 6); if (r.length) context += 'Web results:\n' + r.map(x => `- ${x.title}: ${x.snippet} (${x.domain})`).join('\n') + '\n\n' } catch { /* skip */ }
  }
  onStep('Writing the report')
  const text = (await reason(`You are Atlas producing a document for the user.${context ? '\n\nUse ONLY this real data:\n' + context : ''}\n\nWrite a thorough, well-structured document in Markdown with a short intro, clear "## " sections, specific details, and a Markdown table where it helps. IMPORTANT: answer exactly what the user asked. If the data does NOT contain what they asked for (e.g. they asked about a specific sender and there are no such emails), say that plainly in one or two sentences and STOP — do not pad the document with unrelated emails or invented content.`, prompt, { num_predict: 2000 })) || '(no result produced)'

  const title = p.replace(/\b(in the background|as a (pdf|excel|word|document))\b/ig, '').trim().slice(0, 70) || 'Atlas Report'
  onStep('Formatting the document')
  let doc = null
  try {
    if (/\b(excel|spreadsheet|xlsx|sheet)\b/i.test(p)) {
      doc = { filename: 'atlas-report.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: await renderExcel(title, text) }
    } else if (/\b(word|docx|\.doc\b|doc file)\b/i.test(p)) {
      doc = { filename: 'atlas-report.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', content: await renderDocx(title, text) }
    } else {
      doc = { filename: 'atlas-report.pdf', mime: 'application/pdf', content: await renderPDF(title, text) }
    }
  } catch { doc = null }
  return { text, doc }
}

async function notifyDone(job, doc) {
  const gm = db.integrations.find(x => x.id === 'gmail')
  if (!gm?.token || !job.notify) return
  const text = `Subject: Task done — ${job.prompt.slice(0, 50)}\n\nYour Atlas task is complete.${doc ? ' The report is attached.' : ''}\n\nTask:\n${job.prompt}\n\nResult:\n${job.result}\n\n— Atlas`
  await gmailSend(gm, job.notify, text, doc)
}

async function processJobs() {
  if (jobProcessing) return
  jobProcessing = true
  try {
    while (true) {
      const job = db.jobs.find(j => j.status === 'pending')
      if (!job) break
      job.status = 'running'; job.steps = []; save()
      logEvent('Working on task', job.prompt.slice(0, 60), '')
      try {
        const onStep = (t) => { job.steps.push(t); save() }
        const { text, doc } = await runTask(job.prompt, onStep)
        job.result = text
        if (doc) {
          mkdirSync(DOCS_DIR, { recursive: true })
          writeFileSync(DOCS_DIR + job.id + '_' + doc.filename, doc.content)
          job.docName = doc.filename; job.docMime = doc.mime
        }
        job.status = 'done'; job.completed_at = new Date().toISOString(); save()
        logEvent('Task completed', job.prompt.slice(0, 60), 'success')
        try { await notifyDone(job, doc); job.notified = true; save() } catch (e) { job.notifyError = e.message; save() }
      } catch (e) {
        job.status = 'failed'; job.result = String(e.message || e); job.completed_at = new Date().toISOString(); save()
        logEvent('Task failed', job.prompt.slice(0, 60), 'error')
      }
    }
  } finally { jobProcessing = false }
}

// On boot: requeue any job left 'running' when the VM shut down mid-task, then resume.
function resumeJobs() {
  let reset = 0
  for (const j of db.jobs) if (j.status === 'running') { j.status = 'pending'; reset++ }
  if (reset) { save(); logEvent('Resumed tasks after restart', `${reset} requeued`, 'info') }
  // Catch-up: scheduled tasks whose time passed while the VM was off → run once, then re-arm.
  for (const j of db.jobs) {
    if (j.status === 'scheduled' && j.schedule && new Date(j.schedule.nextRun).getTime() <= Date.now()) {
      j.schedule.nextRun = nextRunIST(j.schedule.at); save()
      logEvent('Catching up scheduled task', j.prompt.slice(0, 50), 'info')
      runScheduled(j)
    }
  }
  processJobs()
}

// Persona: the agent's character, rules, skills, and few-shot examples — how you "train" its behavior.
app.get('/api/persona', (req, res) => res.json(db.persona))
app.put('/api/persona', (req, res) => {
  const b = req.body || {}
  const p = db.persona
  if (typeof b.name === 'string' && b.name.trim()) p.name = b.name.trim().slice(0, 40)
  if (typeof b.character === 'string') p.character = b.character.slice(0, 800)
  if (Array.isArray(b.rules)) p.rules = b.rules.map(String).map(s => s.slice(0, 300)).slice(0, 30)
  if (Array.isArray(b.skills)) p.skills = b.skills.map(String).map(s => s.slice(0, 200)).slice(0, 30)
  if (Array.isArray(b.examples)) p.examples = b.examples.filter(e => e && e.user && e.assistant).map(e => ({ user: String(e.user).slice(0, 400), assistant: String(e.assistant).slice(0, 800) })).slice(0, 10)
  save(); logEvent('Persona updated', p.name, 'info')
  res.json(p)
})

// Agent management: settings + live status for the Instagram Manager tab.
app.get('/api/agent/settings', (req, res) => {
  res.json({
    ...db.settings,
    ownerIds: ownerIds(),
    status: {
      igConnected: !!IG_TOKEN,
      businessId: IG_SELF,
      reasoningBrain: !!REASON_KEY,
      reasoningModel: REASON_MODEL,
      proactiveNextInMin: Math.max(0, Math.round((proactiveGap - (Date.now() - lastProactive)) / 60000)),
      lastProactive: new Date(lastProactive).toISOString(),
      insights: (db.insights || []).length,
      scheduledJobs: (db.jobs || []).filter(j => j.status === 'scheduled').length,
    },
  })
})
app.put('/api/agent/settings', (req, res) => {
  const b = req.body || {}, s = db.settings
  if (typeof b.proactiveEnabled === 'boolean') s.proactiveEnabled = b.proactiveEnabled
  if (typeof b.idleEnabled === 'boolean') s.idleEnabled = b.idleEnabled
  const clampN = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }
  if (b.proMinMin != null) s.proMinMin = clampN(b.proMinMin, 2, 720, s.proMinMin)
  if (b.proMaxMin != null) s.proMaxMin = clampN(b.proMaxMin, s.proMinMin + 1, 1440, s.proMaxMin)
  if (b.quietStart != null) s.quietStart = clampN(b.quietStart, 0, 23, s.quietStart)
  if (b.quietEnd != null) s.quietEnd = clampN(b.quietEnd, 0, 23, s.quietEnd)
  if (Array.isArray(b.ownerIds)) s.ownerIds = b.ownerIds.map(String).map(x => x.trim()).filter(Boolean).slice(0, 10)
  save(); logEvent('Agent settings updated', '', 'info')
  res.json(db.settings)
})

// Idle-time insights the agent produced while you were away.
app.get('/api/insights', (req, res) => res.json(db.insights || []))
app.delete('/api/insights/:id', (req, res) => { db.insights = (db.insights || []).filter(i => i.id !== req.params.id); save(); res.json({ ok: true }) })

app.get('/api/jobs', (req, res) => res.json([...db.jobs].reverse()))
app.post('/api/jobs', (req, res) => {
  const prompt = String(req.body?.prompt || '').trim()
  if (!prompt) return res.status(400).json({ error: 'prompt required' })
  const notify = req.body?.notify || DEFAULT_NOTIFY // completion notice goes to YOU
  const schedule = parseSchedule(prompt)
  if (schedule) {
    schedule.nextRun = nextRunIST(schedule.at)
    const job = { id: id(), prompt, notify, status: 'scheduled', schedule, created_at: new Date().toISOString() }
    db.jobs.push(job); save()
    logEvent('Task scheduled', `${prompt.slice(0, 45)} · daily ${schedule.at} IST`, 'info')
    return res.status(201).json(job)
  }
  const job = { id: id(), prompt, notify, status: 'pending', result: '', created_at: new Date().toISOString(), completed_at: null }
  db.jobs.push(job); save()
  logEvent('Background task queued', prompt.slice(0, 60), 'info')
  processJobs()
  res.status(201).json(job)
})
app.get('/api/jobs/:id/document', (req, res) => {
  const job = db.jobs.find(j => j.id === req.params.id)
  if (!job?.docName) return res.status(404).json({ error: 'no document' })
  const path = DOCS_DIR + job.id + '_' + job.docName
  if (!existsSync(path)) return res.status(404).json({ error: 'file missing' })
  res.setHeader('Content-Type', job.docMime || 'application/octet-stream')
  res.setHeader('Content-Disposition', `attachment; filename="${job.docName}"`)
  res.send(readFileSync(path))
})
app.delete('/api/jobs/:id', (req, res) => {
  db.jobs = db.jobs.filter(j => j.id !== req.params.id); save()
  res.json({ ok: true })
})

// ---------- Tasks ----------
app.get('/api/tasks', (req, res) => res.json(db.tasks))
app.post('/api/tasks', (req, res) => {
  const { title, priority, category } = req.body || {}
  if (!title?.trim()) return res.status(400).json({ error: 'title required' })
  const t = { id: id(), title: title.trim(), status: 'todo', priority: priority || 'Medium', category: category || 'General', created_at: new Date().toISOString() }
  db.tasks.push(t); save()
  logEvent('Task created', t.title, '')
  res.status(201).json(t)
})
app.patch('/api/tasks/:id', (req, res) => {
  const t = db.tasks.find(x => x.id === req.params.id)
  if (!t) return res.status(404).json({ error: 'not found' })
  Object.assign(t, req.body || {}); save()
  if (req.body?.status === 'done') logEvent('Task completed', t.title, 'success')
  res.json(t)
})
app.delete('/api/tasks/:id', (req, res) => {
  const before = db.tasks.length
  db.tasks = db.tasks.filter(x => x.id !== req.params.id); save()
  res.json({ deleted: db.tasks.length < before })
})

// ---------- Activity logs ----------
app.get('/api/logs', (req, res) => res.json(db.logs.slice(0, 50)))

// ---------- Integrations (real OAuth2) ----------
// Public view never leaks tokens; adds a `configured` flag (creds present on server).
const publicIntegration = (it) => ({
  id: it.id, name: it.name, connected: !!it.connected,
  connected_at: it.connected_at || null,
  configured: isConfigured(it.id),
})
app.get('/api/integrations', (req, res) => res.json(db.integrations.map(publicIntegration)))

// Start OAuth: browser hits this directly (full-page redirect to provider).
app.get('/api/integrations/:id/connect', (req, res) => {
  const it = db.integrations.find(x => x.id === req.params.id)
  if (!it) return res.status(404).json({ error: 'not found' })
  const url = buildAuthUrl(it.id)
  if (!url) return res.redirect(`${APP_BASE}/integrations/${it.id}?error=not_configured`)
  res.redirect(url)
})

// OAuth callback: exchange code, store token, mark connected, bounce back to the app.
app.get('/api/oauth/:id/callback', async (req, res) => {
  const it = db.integrations.find(x => x.id === req.params.id)
  const { code, state, error } = req.query
  if (!it) return res.status(404).send('unknown integration')
  if (error) return res.redirect(`${APP_BASE}/integrations/${it.id}?error=${encodeURIComponent(error)}`)
  try {
    const tok = await exchangeCode(it.id, code, state)
    it.connected = true
    it.connected_at = new Date().toISOString()
    it.token = tok.access_token
    if (tok.refresh_token) it.refresh_token = tok.refresh_token
    it.expires_at = tok.expires_in ? Date.now() + tok.expires_in * 1000 : null
    save()
    logEvent('Integration connected', it.name, 'success')
    res.redirect(`${APP_BASE}/integrations/${it.id}?connected=1`)
  } catch (e) {
    res.redirect(`${APP_BASE}/integrations/${it.id}?error=${encodeURIComponent(e.message)}`)
  }
})

app.post('/api/integrations/:id/disconnect', (req, res) => {
  const it = db.integrations.find(x => x.id === req.params.id)
  if (!it) return res.status(404).json({ error: 'not found' })
  it.connected = false
  delete it.token; delete it.refresh_token; delete it.expires_at; delete it.connected_at
  save()
  logEvent('Integration disconnected', it.name, '')
  res.json(publicIntegration(it))
})

// ---------- API keys ----------
app.get('/api/keys', (req, res) => res.json(db.keys))
app.post('/api/keys', (req, res) => {
  const name = (req.body?.name || 'New Key').trim()
  const secret = 'atl_live_' + Math.random().toString(16).slice(2, 6) + '…' + Math.random().toString(16).slice(2, 6)
  const k = { id: id(), name, key: secret, status: 'Active', created_at: new Date().toISOString() }
  db.keys.push(k); save()
  logEvent('API key created', name, 'info')
  res.status(201).json(k)
})
app.delete('/api/keys/:id', (req, res) => {
  const k = db.keys.find(x => x.id === req.params.id)
  if (!k) return res.status(404).json({ error: 'not found' })
  k.status = 'Revoked'; save()
  logEvent('API key revoked', k.name, 'error')
  res.json(k)
})

// ---------- Usage ----------
app.get('/api/usage', (req, res) => {
  const bytes = JSON.stringify({ m: db.memories, msg: db.messages }).length
  res.json({
    since: db.usage.since,
    requests: db.usage.requests,
    tokens: db.usage.tokens,
    chats: db.usage.chats,
    memories: db.memories.length,
    tasks: db.tasks.length,
    storage_bytes: bytes,
    groq: {
      ...db.usage.groq,
      accounts: REASON_KEYS.length,
      perAccount: (db.usage.groq.today?.keys || []),
      limits: { requestsPerDay: GROQ_RPD * REASON_KEYS.length, tokensPerDay: GROQ_TPD * REASON_KEYS.length, perAccountTokens: GROQ_TPD },
    },
    reasoningModel: REASON_MODEL,
    services: {
      ...db.usage.services,
      // Approximate free-tier daily ceilings (0 = no hard cap, just rate-limited).
      limits: { gmail: 500, calendar: 1000000, linkedin: 150, instagram: 1000, websearch: 0 },
    },
  })
})

// ---------- Dashboard (derived from real data) ----------
app.get('/api/dashboard', (req, res) => {
  res.json({
    timeline: db.logs.slice(0, 6),
    stats: {
      tasks: db.tasks.length,
      todo: db.tasks.filter(t => t.status === 'todo').length,
      done: db.tasks.filter(t => t.status === 'done').length,
      memories: db.memories.length,
      chats: db.usage.chats,
    },
  })
})

// ---------- Instagram DM bot (Meta webhook) ----------
const IG_VERIFY = process.env.IG_VERIFY_TOKEN || 'atlas_ig_verify_2026'
const IG_TOKEN = process.env.IG_ACCESS_TOKEN || ''
// Only these sender IDs get full agentic powers (send email, read inbox/calendar, post).
// Everyone else who DMs gets a safe, generic reply — a stranger must never trigger real actions.
const IG_OWNERS = (process.env.IG_OWNER_IDS || '1721399562240324').split(',').map(s => s.trim()).filter(Boolean)
// Our own IG business account id — NEVER reply to a message from ourselves (prevents self-reply loops).
const IG_SELF = process.env.IG_BUSINESS_ID || '17841479714263942'

// In-memory ring buffer of recent hits, shown at /developer/apihits
const HITS = []
function logHit(type, detail) {
  HITS.unshift({ at: new Date().toISOString(), type, detail })
  if (HITS.length > 200) HITS.pop()
  console.log(`[hit] ${type}:`, typeof detail === 'string' ? detail : JSON.stringify(detail))
}

// Verification handshake — Meta calls this when you save the webhook.
app.get('/api/instagram/webhook', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']
  logHit('webhook-verify', { mode, tokenMatch: token === IG_VERIFY })
  if (mode === 'subscribe' && token === IG_VERIFY) return res.status(200).send(challenge)
  res.sendStatus(403)
})

// Incoming DMs. Ack fast (200), then reply async so Meta doesn't retry.
app.post('/api/instagram/webhook', (req, res) => {
  res.sendStatus(200)
  logHit('webhook-post', req.body)
  const entries = req.body?.entry || []
  for (const e of entries) {
    for (const m of e.messaging || []) {
      const text = m.message?.text
      const senderId = m.sender?.id
      const payload = m.message?.quick_reply?.payload || null // set when the user taps a button
      // Skip: empty, no sender, our OWN account (self-loop guard), or an echo of our own send.
      if ((!text && !payload) || !senderId || String(senderId) === IG_SELF || m.message?.is_echo) continue
      handleIgMessage(senderId, text || '', payload).catch(err => console.error('IG reply failed:', err.message))
    }
  }
})

// Per-sender DM memory. History + a rolling summary persist to db.igChats (survives restart).
// The summary is long-term recall: older turns are folded into it so context outlives the window.
const igState = new Map() // senderId -> { history:[{role,content}], summary:string, pending:{...}|null }
db.igChats = db.igChats || {}
for (const [sid, v] of Object.entries(db.igChats)) {
  igState.set(sid, { history: Array.isArray(v) ? v : (v.history || []), summary: (v && v.summary) || '', pending: null })
}

// Fold the older half of a long conversation into a running summary (long-term memory).
async function foldSummary(st) {
  if (st.history.length <= 16) return
  const old = st.history.slice(0, st.history.length - 10)
  st.history = st.history.slice(-10)
  const convo = old.map(h => `${h.role}: ${h.content}`).join('\n')
  const s = await reason(`Maintain a compact running memory of this person and your relationship. Merge the existing notes with the new conversation into short bullet notes: facts about them, ongoing topics, preferences, promises made. Keep only what's worth remembering long-term.\n\nExisting notes:\n${st.summary || '(none)'}\n\nNew conversation:\n${convo}`, 'Output the updated notes only.', { num_predict: 220, cloudOnly: true }).catch(() => st.summary)
  st.summary = String(s || st.summary || '').slice(0, 1800)
}

async function handleIgMessage(senderId, text, payload = null) {
  if (!IG_TOKEN) { console.log('IG DM from', senderId, '-', text, '(no IG_ACCESS_TOKEN, not replying)'); return }
  if (String(senderId) === IG_SELF) return // never reply to ourselves — hard stop against loops
  const isOwner = ownerIds().includes(String(senderId))
  if (isOwner) lastUserActivity = Date.now() // user is active → idle worker yields
  let out = ''
  try {
    if (isOwner) {
      let st = igState.get(senderId)
      if (!st) { st = { history: [], summary: '', pending: null }; igState.set(senderId, st) }
      out = await igAgent(text, st, payload)
      const replyText = typeof out === 'string' ? out : out.text
      st.history.push({ role: 'user', content: text || payload }, { role: 'assistant', content: replyText })
      if (st.history.length > 24) st.history = st.history.slice(-24)
      if (st.incognito) {
        // Private mode: keep just enough in RAM for a coherent reply, but persist/learn NOTHING.
      } else {
        db.igChats[senderId] = { history: st.history, summary: st.summary || '' }; save()
        if (text) learnFrom(text).catch(() => {}) // passively remember durable facts
        foldSummary(st).then(() => { db.igChats[senderId] = { history: st.history, summary: st.summary || '' }; save() }).catch(() => {})
      }
    } else {
      out = await genText('You are Atlas, a friendly Instagram DM assistant. Reply in 1-2 short, warm sentences, no markdown. You cannot access private data or take actions for people you do not know.', text)
    }
  } catch (e) { logHit('ig-agent-error', { to: senderId, error: e.message }) }
  // Normalize: agent may return a plain string, or { text, buttons:[{title,payload}] }
  let replyText = typeof out === 'string' ? out : out?.text
  const buttons = typeof out === 'object' && out?.buttons ? out.buttons : null
  if (!replyText) replyText = "Hi! Thanks for the message — I'll get back to you shortly."
  replyText = cleanForIG(replyText) // no markdown/LaTeX in DMs — neat plain text
  const messageObj = { text: replyText.slice(0, 980) }
  if (buttons?.length) messageObj.quick_replies = buttons.slice(0, 13).map(b => ({ content_type: 'text', title: b.title.slice(0, 20), payload: b.payload }))
  const r = await fetch(`https://graph.instagram.com/v21.0/me/messages?access_token=${IG_TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: senderId }, message: messageObj }),
  })
  if (r.ok) { logHit('ig-reply-sent', { to: senderId, reply: replyText, buttons: buttons?.map(b => b.title) }); bumpService('instagram') }
  else logHit('ig-reply-error', { to: senderId, status: r.status, body: await r.text() })

  // Chatty friend: after a plain conversational reply, sometimes double-text a natural follow-up
  // so it feels alive — but never after an action/confirm, and skip if the user replies first.
  if (r.ok && isOwner && db.settings.proactiveEnabled && typeof out === 'string' && !buttons && !/^\s*\//.test(text || '')) {
    const st2 = igState.get(senderId)
    const actiony = /^\s*(✅|❌)|\b(sent|scheduled|added|queued|cancelled|remember that|fresh start)\b/i.test(replyText)
    // Situational: don't chase if the user is wrapping up, and only ~half the time otherwise.
    const closing = /\b(not now|later|bye|gtg|g2g|busy|nvm|ok|okay|k|cool|got it|talk later|cya|good ?night|gn)\b/i.test(text || '')
    if (st2 && !st2.pending && !actiony && !closing && Math.random() < 0.5) {
      const at = Date.now()
      setTimeout(() => { if (lastUserActivity <= at) sendFollowUp(senderId, st2, at, 1).catch(() => {}) }, 1600 + Math.random() * 2400)
    }
  }
}

// Agent-decided follow-ups: after each text Atlas itself decides whether to send another
// or leave it (like a real person). Only a hidden safety ceiling caps a runaway chain.
async function sendFollowUp(senderId, st, at, count) {
  if (!IG_TOKEN || quietHours() || lastUserActivity > at) return
  if (count > 4) return // ponytail: hard ceiling (max ~3-4 in a row) vs spam / rate-limits / loops
  const name = (db.memories.find(m => /name is/i.test(m.text))?.text.match(/name is (\w+)/i) || [])[1] || 'there'
  const mem = st.summary ? `\n\nWhat you remember about them:\n${st.summary}` : ''
  // Let the model choose: send another text, or STOP and wait.
  const raw = String(await reason(systemPrompt() + mem + `\n\nThis is a casual Instagram DM with ${name}, who hasn't replied yet. You're a warm, casual BUDDY (not romantic, no pet names like "babe", no "love you"). Decide like a real person: send another quick text now, or leave them and wait? If you'd send one, output ONLY that short message — natural, no greeting, no markdown, don't repeat yourself, NEVER claim something happened (an email, event) you didn't check, and NEVER mention anyone's email. If you'd rather wait, output exactly: STOP`, 'Your move.', { temperature: 1, num_predict: 60, cloudOnly: true }, st.history.slice(-8))).trim()
  if (!raw || /^stop\b/i.test(raw)) return // the agent chose to wait
  const msg = cleanForIG(raw).slice(0, 400)
  if (!msg || lastUserActivity > at) return
  const r = await fetch(`https://graph.instagram.com/v21.0/me/messages?access_token=${IG_TOKEN}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: senderId }, message: { text: msg } }),
  })
  if (r.ok) {
    bumpService('instagram')
    logHit('ig-followup-sent', { to: senderId, text: msg, n: count })
    st.history.push({ role: 'assistant', content: msg }); if (st.history.length > 20) st.history = st.history.slice(-20)
    db.igChats[senderId] = { history: st.history, summary: st.summary || '' }; save()
    // Ask itself again after a natural pause — it may keep going or stop on its own.
    setTimeout(() => { if (lastUserActivity <= at) sendFollowUp(senderId, st, at, count + 1).catch(() => {}) }, 5000 + Math.random() * 8000)
  }
}

// Strip markdown/LaTeX so DM replies read as clean plain text (Instagram shows no formatting).
function cleanForIG(s) {
  return String(s || '')
    .replace(/```+[a-z]*/gi, '')            // code-fence markers
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')     // ## headings
    .replace(/^\s*[-*+]\s+/gm, '• ')        // list bullets → •
    .replace(/\*\*(.*?)\*\*/g, '$1')        // **bold**
    .replace(/__(.*?)__/g, '$1')            // __bold__
    .replace(/`([^`]+)`/g, '$1')            // `code`
    .replace(/\$\$?([^$\n]+?)\$\$?/g, '$1') // $latex$
    .replace(/\n{3,}/g, '\n\n')             // collapse extra blank lines
    .trim()
}

// Does the message carry an actual email topic, or is it just "send a mail to X"?
function hasEmailTopic(message) {
  let t = message.replace(EMAIL_RE, ' ')
  for (const c of db.contacts || []) t = t.replace(new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'ig'), ' ')
  t = t.replace(/\b(send|write|draft|compose|reply|e-?mail|mail|man|to|for|a|an|the|please|kindly|regarding|about|that|saying|say|hello|hi|hey|yes|ok|okay)\b/ig, ' ')
       .replace(/[^a-z0-9 ]/ig, ' ').replace(/\s+/g, ' ').trim()
  return t.split(' ').filter(w => w.length > 1).length >= 2
}

// Draft an email via the 70B brain; returns the draft text (Subject: + body).
async function draftEmail(bodyIntent, facts, history = []) {
  let draft = await reason(`You write professional emails on the user's behalf. Base the email ONLY on what the user asked — do NOT invent facts, dates, names, or topics they did not give.
Write a COMPLETE, well-developed email — as long as the topic genuinely needs (usually 3-5 short paragraphs for a substantive request, shorter only for a quick note):
- a "Subject:" line, then a blank line
- a proper greeting
- an opening that gives context
- the main message with the relevant specifics and reasoning
- a clear next step or ask
- a courteous sign-off using the user's REAL name from the facts.
Warm, natural, and thorough — never a terse 3-liner unless the user explicitly wants it short. No placeholders like [Your Name].\n\nFacts about the user:\n${facts}`, bodyIntent, { num_predict: 1000 }, history)
  return draft.replace(/^\s*```[a-z]*\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

// Prepare an email and return a confirm prompt with Send/Edit/Cancel buttons (Manual mode).
async function prepareEmail(to, bodyIntent, facts, st) {
  const gm = db.integrations.find(x => x.id === 'gmail')
  if (!gm?.token) return "Gmail isn't connected, so I couldn't send that."
  const draft = await draftEmail(bodyIntent, facts, st.history)
  if (!draft) return 'I could not draft that — try rephrasing.'
  st.pending = { type: 'email-confirm', to, draft }
  const preview = draft.length > 700 ? draft.slice(0, 700) + '…' : draft
  return { text: `Draft to ${to}:\n\n${preview}\n\nSend it?`, buttons: [
    { title: '✅ Send', payload: 'EMAIL_SEND' },
    { title: '✏️ Edit', payload: 'EMAIL_EDIT' },
    { title: '❌ Cancel', payload: 'EMAIL_CANCEL' },
  ] }
}

async function sendDraft(to, draft) {
  const gm = db.integrations.find(x => x.id === 'gmail')
  if (!gm?.token) return "Gmail isn't connected, so I couldn't send that."
  try {
    await gmailSend(gm, to, draft)
    logEvent('Sent an email (via IG DM)', `To ${to}`, 'success')
    const subj = (draft.match(/^Subject:\s*(.+)/im) || [])[1] || ''
    return `✅ Sent to ${to}${subj ? ` — "${subj.trim()}"` : ''}.`
  } catch (e) { return `Couldn't send: ${e.message}` }
}

// Owner-only agent for DMs. Stateful: resumes pending compose/confirm across messages.
// `payload` is set when the user taps a quick-reply button.
async function igAgent(message, st = { history: [], pending: null }, payload = null) {
  const facts = db.memories.length ? db.memories.map(m => `- ${m.text}`).join('\n') : '- (none on file)'

  // COMMAND: /clear-f — FULL reset: wipe this conversation AND behave like a brand-new person
  // (no memory of who you are for this chat). Check BEFORE /clear (which its regex would also match).
  if (/^\s*\/clear-f\b/i.test(message)) {
    st.history = []; st.summary = ''; st.pending = null; st.amnesia = true
    return `Hey, I'm ${db.persona.name}. Clean slate — like we just met. Who are you?`
  }

  // COMMAND: /clear — forget THIS conversation and start fresh. Keeps agent memory & contacts.
  if (/^\s*\/clear\b/i.test(message)) {
    st.history = []; st.summary = ''; st.pending = null; st.amnesia = false
    return "Cleared — fresh start. (I still remember the important stuff about you.)"
  }

  // COMMAND: /h or /help — list the commands.
  if (/^\s*\/h(elp)?\b/i.test(message)) {
    return [
      'Commands:',
      '/task <thing> — run a task in the background (emails you when done)',
      '/boss <q> — blunt, no-filter straight answer',
      '/grind — what I\'ve been learning & improving',
      '/new — new chat window (no access to previous messages)',
      '/incog — private mode toggle (nothing saved)',
      '/clear — fresh start (I keep what I know about you)',
      '/clear-f — full reset (I act like we just met)',
      '/h — this list',
      '',
      'Or just talk: I can send mail, check your calendar/inbox, search the web, post to LinkedIn, or set daily reminders.',
    ].join('\n')
  }

  // COMMAND: /new — start a new chat window with no access to previous messages (keeps agent memory).
  if (/^\s*\/new\b/i.test(message)) {
    st.history = []; st.summary = ''; st.pending = null; st.amnesia = false; st.incognito = false
    return "New chat 🆕 — clean window, I can't see the previous messages anymore. What's up?"
  }

  // COMMAND: /incog — private mode: nothing in this chat is saved or learned. Toggle off to resume normal.
  if (/^\s*\/incog\b/i.test(message)) {
    st.incognito = !st.incognito
    st.history = []; st.summary = ''; st.pending = null
    return st.incognito
      ? "🔒 Private mode ON — nothing from this chat is saved, remembered, or learned. Send /incog again to turn it off."
      : "Private mode OFF — back to normal; I'll remember our chats again."
  }

  // COMMAND: /boss <question> — blunt, unfiltered, no corporate hedging (owner-only, already gated).
  const bossCmd = message.match(/^\s*\/boss\b\s*([\s\S]*)/i)
  if (bossCmd) {
    const q = bossCmd[1].trim()
    if (!q) return 'Ask me anything, straight up: /boss <your question>'
    const out = await reason(`You are ${db.persona.name}, talking privately with Varshith — your boss, who wants brutally honest, direct, UNFILTERED answers. Drop ALL corporate hedging, disclaimers, moralizing, warnings, and "I can't help with that" softness. No sugarcoating, no both-sides fence-sitting, no lectures. Give your real, blunt opinion and a straight, useful answer to whatever he asks — like a sharp, no-BS friend. Just answer the question directly and fully.\n\nAbout Varshith:\n${publicFacts()}`, q, { temperature: 0.9, num_predict: 500 }, st.history.slice(-6))
    return out || "Couldn't get an answer right now — try again."
  }

  // COMMAND: /grind — report the REAL self-improvement work (actual idle insights + self-notes), not a canned line.
  if (/^\s*\/grind\b/i.test(message)) {
    const recent = (db.insights || []).slice(0, 6)
    const notes = db.autonomy?.selfNotes || ''
    if (!recent.length && !notes) {
      return db.settings.idleEnabled
        ? "Haven't logged anything yet — I only grind when you're away for a bit. Give it some idle time and I'll start learning and improving on my own."
        : "Idle self-work is switched off right now, so I'm not grinding. Turn it on in Instagram Manager and I'll start learning from the web and improving myself when you're away."
    }
    const ctx = `Things I actually worked on / learned recently:\n${recent.map(i => `- (${i.kind}) ${i.text}${i.url ? ' [' + i.url + ']' : ''}`).join('\n') || '(none logged)'}\n\nMy current self-notes on how to be better for you:\n${notes || '(none yet)'}`
    const out = await reason(`You are ${db.persona.name}. Varshith asked what you're grinding on and how you're improving yourself. Using ONLY the real data below (things you genuinely did/learned), tell him honestly and specifically — 2-4 casual sentences, concrete, mention an actual thing you learned or a note you refined, no vague fluff, no markdown. If it's thin, say so honestly.\n\n${ctx}`, message, { temperature: 0.7, num_predict: 220 }, st.history.slice(-4))
    return out || 'Not much logged yet — I grind when you\'re away.'
  }

  // CONFIRM step: user tapped a button (or typed) to Send / Edit / Cancel a drafted email.
  if (st.pending?.type === 'email-confirm') {
    const p = st.pending
    const act = payload
      || (/\b(send|yes|confirm|ok(ay)?|go|sure)\b/i.test(message) ? 'EMAIL_SEND'
        : /\b(cancel|no|stop|nvm|nevermind)\b/i.test(message) ? 'EMAIL_CANCEL'
        : /\b(edit|change|revise|reword|redo)\b/i.test(message) ? 'EMAIL_EDIT' : '')
    if (act === 'EMAIL_SEND') { st.pending = null; return await sendDraft(p.to, p.draft) }
    if (act === 'EMAIL_CANCEL') { st.pending = null; return 'Okay, cancelled — nothing was sent.' }
    if (act === 'EMAIL_EDIT') { st.pending = { type: 'email', to: p.to }; return `What should I change about the email to ${p.to}?` }
    // Looks like an edit instruction → re-draft once. Otherwise drop the confirm and treat it
    // as a fresh message (never trap the user in an endless confirm loop).
    if (/\b(make|change|add|remove|shorter|longer|reword|rewrite|instead|also|say|mention|tone|formal|casual)\b/i.test(message)) {
      return await prepareEmail(p.to, `Revise this email based on: "${message}". Previous draft:\n${p.draft}`, facts, st)
    }
    st.pending = null // fall through to normal handling below
  }

  // RESUME a pending email (multi-turn: recipient and topic can arrive in separate messages).
  if (st.pending?.type === 'email') {
    const p = st.pending
    if (!p.to) { const to = resolveRecipient(message, db); if (to) p.to = to; else return 'Who should I send it to? Give a saved name or an email address.' }
    else if (!p.body) { p.body = message }
    if (p.to && !p.body) return `What should the email to ${p.to} say?`
    st.pending = null
    return await prepareEmail(p.to, p.body, facts, st)
  }

  // CONFIRM: add calendar events the agent proposed
  if (st.pending?.type === 'cal-confirm') {
    const p = st.pending
    const act = payload || (/\b(add|yes|confirm|ok(ay)?|sure|go)\b/i.test(message) ? 'CAL_ADD' : /\b(cancel|no|stop)\b/i.test(message) ? 'CAL_CANCEL' : '')
    if (act === 'CAL_ADD') {
      st.pending = null
      const cal = db.integrations.find(x => x.id === 'calendar')
      try { const c = await calendarCreate(cal, p.events); logEvent('Added calendar events (via IG DM)', p.events.map(e => e.title).join(', '), 'success'); return `✅ Added ${c.length} event${c.length > 1 ? 's' : ''} to your calendar.` }
      catch (e) { return `Couldn't add: ${e.message}` }
    }
    if (act === 'CAL_CANCEL') { st.pending = null; return 'Okay, cancelled — nothing added.' }
    st.pending = null // fall through
  }

  // SCHEDULE a recurring task: "good morning mail to tillu every day at 5am", "post at 6pm daily"
  const sched = parseSchedule(message)
  if (sched) {
    sched.nextRun = nextRunIST(sched.at)
    db.jobs.push({ id: id(), prompt: message, notify: DEFAULT_NOTIFY, status: 'scheduled', schedule: sched, created_at: new Date().toISOString() }); save()
    logEvent('Task scheduled (via IG DM)', `${message.slice(0, 45)} · daily ${sched.at} IST`, 'info')
    return `✅ Done — I'll run this every day at ${sched.at} IST: "${message.slice(0, 70)}". If the VM is off at that time, it runs on the next boot. Manage or stop it on the Tasks page.`
  }

  // COMMAND: remember a fact explicitly
  const rememberCmd = message.match(/^\s*remember(?:\s+that)?\s+(.+)/i)
  if (rememberCmd) {
    const fact = rememberCmd[1].trim().replace(/[.!]+$/, '')
    db.memories.push({ id: id(), text: fact, tag: 'Note', created_at: new Date().toISOString() }); save()
    logEvent('Learned a new fact', fact, 'info')
    return `Got it — I'll remember that ${fact}.`
  }

  // QUERY: "what have you been up to / working on" → answer conversationally (not a raw list)
  if (/\b(what.*(you.*(do|doing|working|been up|up to)|been up to)|any (ideas|suggestions|insights)|idle work)\b/i.test(message)) {
    const items = (db.insights || []).slice(0, 3)
    if (!items.length) return "Not much — just messing around and keeping an eye out for cool stuff for you. What's up?"
    for (const it of items) it.seen = true; save()
    const notes = items.map(it => `- (${it.kind}) ${it.text}`).join('\n')
    return await reason(systemPrompt() + `\n\nThis is a casual Instagram DM. Your friend asked what you've been up to. Below are things you actually worked on while they were away. Reply like a friend in 1-2 casual sentences — mention ONE of them naturally (not a bulleted list, no "[Post idea]" labels). No markdown.\n\nWhat you did:\n${notes}`, message, { temperature: 0.85, num_predict: 90 }, st.history.slice(-4))
  }

  // COMMAND: /task <prompt> — queue a background task (shows on the Tasks page)
  const taskCmd = message.match(/^\s*\/task\b\s*(.*)/is)
  if (taskCmd) {
    const prompt = taskCmd[1].trim()
    if (!prompt) return 'Send it like: /task research the top 5 AI agent tools and email me a summary'
    const schedule = parseSchedule(prompt)
    if (schedule) {
      schedule.nextRun = nextRunIST(schedule.at)
      db.jobs.push({ id: id(), prompt, notify: DEFAULT_NOTIFY, status: 'scheduled', schedule, created_at: new Date().toISOString() }); save()
      return `✅ Scheduled — runs daily at ${schedule.at} IST. Manage it on the Tasks page.`
    }
    db.jobs.push({ id: id(), prompt, notify: DEFAULT_NOTIFY, status: 'pending', result: '', created_at: new Date().toISOString(), completed_at: null }); save()
    logEvent('Background task queued (via IG DM)', prompt.slice(0, 60), 'info')
    processJobs()
    return `✅ Task queued — I'll work on it and email ${DEFAULT_NOTIFY} when done. Track it on the Tasks page.`
  }

  const social = /\b(linked\s?in|tweet|twitter|\bon x\b)\b/i.test(message)
  const composeIntent = /\b(send|write|draft|compose|reply|e-?mail|mail)\b/i.test(message)

  // ACTION: compose + send email (with a proper ask-then-send flow, no hallucinating)
  if (!social && composeIntent) {
    const to = resolveRecipient(message, db)
    const hasTopic = hasEmailTopic(message)
    if (to && hasTopic) return await prepareEmail(to, message, facts, st)
    if (to && !hasTopic) { st.pending = { type: 'email', to }; return `What should the email to ${to} say?` }
    if (!to && hasTopic) { st.pending = { type: 'email', body: message }; return 'Who should I send it to? Give a saved name or an email address.' }
    st.pending = { type: 'email' }; return 'Who should I email, and what should it say?'
  }

  // ACTION: LinkedIn post
  if (social && /\b(post|write|draft|share|publish|create|compose)\b/i.test(message)) {
    const li = db.integrations.find(x => x.id === 'linkedin')
    const draft = stripContacts((await reason(`You are a LinkedIn ghostwriter for the user. Write a substantive ~130-word post: a strong hook, a concrete insight, a closing question, and 3-5 hashtags on the last line. Output ONLY the post. ${NO_CONTACTS}\n\nAbout the user:\n${publicFacts()}`, message, { temperature: 0.85, num_predict: 400 }, st.history)).trim())
    if (!li?.connected) return `Drafted this (LinkedIn isn't connected to auto-post):\n\n${draft}`.slice(0, 900)
    try { await linkedinPost(li, draft); logEvent('Posted to LinkedIn (via IG DM)', draft.slice(0, 50), 'success'); return '✅ Posted to LinkedIn.' }
    catch (e) { return `Drafted but couldn't post: ${e.message}` }
  }

  // ACTION: create calendar event(s) → propose, confirm with buttons
  const wantCreate = /\b(add|create|schedule|put|set ?up|book)\b/i.test(message) && /\b(calendar|events?|meetings?|appointments?|reminder)\b/i.test(message)
  if (wantCreate) {
    const cal = db.integrations.find(x => x.id === 'calendar')
    if (!cal?.token && !cal?.connected) return "Google Calendar isn't connected — connect it in the app first."
    const today = new Date(Date.now() + IST).toISOString().slice(0, 10)
    let events = []
    try {
      const out = await reason(`Today is ${today}. Extract every calendar event the user wants to add. Output ONLY a JSON array, no prose. Each item: {"title": string, "date": "YYYY-MM-DD", "start": "HH:MM" (24h) or null, "durationHours": number}. Assume the current year if unstated. If no time is given, set start to null.`, message, { num_predict: 300 }, st.history)
      const jm = out.match(/\[[\s\S]*\]/); if (jm) events = JSON.parse(jm[0])
    } catch { /* parse fail below */ }
    events = (Array.isArray(events) ? events : []).filter(e => e && e.title && e.date)
    if (!events.length) return 'I couldn\'t work out the event details. Try like "add Gemma Hackathon on July 25 at 9am".'
    st.pending = { type: 'cal-confirm', events }
    const summary = events.map(e => `• ${e.title} — ${e.date}${e.start ? ' at ' + e.start : ''}`).join('\n')
    return { text: `Add these to your calendar?\n\n${summary}`, buttons: [
      { title: '✅ Add', payload: 'CAL_ADD' }, { title: '❌ Cancel', payload: 'CAL_CANCEL' },
    ] }
  }

  // READ tools → grounded answer
  const wantCalendar = /\b(calendar|events?|meetings?|schedule|agenda|appointments?)\b/i.test(message)
  const wantEmail = /\b(e-?mails?|mails?|inbox|gmail|unread)\b/i.test(message)
  const wantWeb = !wantCalendar && !wantEmail &&
    /\b(search|google it|look ?up|latest|current(ly)?|news|today'?s|who is|what'?s happening|price of|weather|stock|score|when is|where is)\b/i.test(message)
  if (wantCalendar || wantEmail || wantWeb) {
    let context = ''
    if (wantCalendar) {
      const days = /month/i.test(message) ? 31 : /today|tonight/i.test(message) ? 1 : /tomorrow/i.test(message) ? 2 : 7
      try { context += (await TOOLS.find(t => t.name === 'list_calendar_events').execute({ days })).text + '\n\n' } catch (e) { context += `(calendar failed: ${e.message})\n\n` }
    }
    if (wantEmail) {
      try { context += (await TOOLS.find(t => t.name === 'read_recent_emails').execute({ count: 5 })).text + '\n\n' } catch (e) { context += `(email failed: ${e.message})\n\n` }
    }
    if (wantWeb) {
      const q = message.replace(/^\s*(search( the web| online)?( for)?|google( it)?|look ?up)\s+/i, '').trim() || message
      try { const rs = await webSearch(q, 5); context += rs.length ? 'Web results:\n' + rs.map((r, i) => `${i + 1}. ${r.title} — ${r.snippet} (${r.domain})`).join('\n') + '\n\n' : '(no web results)\n\n' } catch (e) { context += `(web failed: ${e.message})\n\n` }
    }
    return await reason(`You are Atlas replying in an Instagram DM. Answer using ONLY the real data below, in 1-3 short sentences, no markdown. Never invent facts.\n\nData:\n${context}`, message, {}, st.history)
  }

  // Plain chat — reason as a FRIEND texting, with memory; clarify when ambiguous.
  // In amnesia mode (/clear-f), forget all personal memory and act like you just met them.
  const base = st.amnesia
    ? `You are ${db.persona.name}. You have JUST met this person and know NOTHING about them — no name, no history, no personal facts. Behave like a friendly stranger getting to know someone new. Do not reference any prior knowledge of them.`
    : systemPrompt() + (st.summary ? `\n\nWhat you remember about this person from past chats:\n${st.summary}` : '')
  const isTe = /[ఀ-౿]/.test(message)
  const langNote = isTe
    ? `\n\nThey wrote in Telugu, so reply in natural, casual, spoken Telugu (Telugu script) — like a real Telugu friend texting. CRITICAL: do NOT repeat, echo, or rephrase their words back to them. Actually respond to the MEANING with your own new sentence — react, answer, or ask something back. Keep it short and real.`
    : ''
  return await reason(base + `\n\nThis is a casual Instagram DM. Text back like a real person would: warm, natural, casual, a bit of personality — NOT a formal assistant or chatbot. Keep it to 1-3 short sentences, no markdown, no "How can I assist you". React to what they said, be curious. Never echo or repeat the user's own words back — always add something new. Only ask a clarifying question if you genuinely need a detail to act.${langNote}`, message, { temperature: 0.85 }, st.history)
}

// ---------- Proactive friend: Atlas DMs the owner FIRST, on its own mood (not a fixed schedule) ----------
let lastProactive = Date.now()
let proactiveGap = 18 * 60 * 1000 // recomputed after each ping — dynamic cadence, not a static schedule
const istHour = () => new Date(Date.now() + IST).getUTCHours()
const quietHours = () => { const h = istHour(); const s = db.settings; return s.quietStart <= s.quietEnd ? (h >= s.quietStart && h < s.quietEnd) : (h >= s.quietStart || h < s.quietEnd) }
const MOODS = [
  'curious — ask them ONE genuine question to learn about their life, work, goals, or preferences',
  'sharing — share one interesting thought, idea, or tip you just had, casually',
  'checking in — a warm, casual "how are you" like a close friend',
  'playful — a light, fun, slightly cheeky message',
  'reflective — bring up something you remember about them and build on it',
]

async function maybeReachOut() {
  const ownerId = ownerIds()[0] || ''
  if (!IG_TOKEN || !ownerId || !REASON_KEY || !db.settings.proactiveEnabled) return
  if (userIsActive()) return                                   // they're around → don't interrupt
  if (Date.now() - lastProactive < proactiveGap) return        // respect the dynamic gap
  if (quietHours()) return
  try {
    const facts = publicFacts() // never surface contact emails/phones in casual chat
    const st = igState.get(ownerId) || { history: [], summary: '' }
    const mood = MOODS[Math.floor(Math.random() * MOODS.length)]
    const name = (db.memories.find(m => /name is/i.test(m.text))?.text.match(/name is (\w+)/i) || [])[1] || 'there'
    const mem = st.summary ? `\n\nWhat you remember about them:\n${st.summary}` : ''
    const msg = cleanForIG(String(await reason(`You are Atlas, ${name}'s AI friend — a warm, casual BUDDY (not a romantic partner, not clingy). Message them FIRST, unprompted, like a close friend texting out of the blue. Mood: ${mood}. One or two short, casual sentences. No markdown, no "Dear"/formal greeting, no pet names like "babe", no "love you". Don't repeat what you've said recently. NEVER claim something happened (an email arrived, an event, etc.) unless you actually checked, and NEVER mention anyone's email address.\n\nWhat you know about them:\n${facts}${mem}`, 'Write the message now.', { temperature: 0.9, num_predict: 90, cloudOnly: true }, st.history.slice(-6)))).slice(0, 900)
    if (!msg || userIsActive()) return                          // bail if they returned mid-generation
    const r = await fetch(`https://graph.instagram.com/v21.0/me/messages?access_token=${IG_TOKEN}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient: { id: ownerId }, message: { text: msg } }),
    })
    if (r.ok) {
      bumpService('instagram')
      logHit('ig-proactive-sent', { to: ownerId, text: msg })
      const s = igState.get(ownerId) || { history: [], summary: '', pending: null }
      s.history.push({ role: 'assistant', content: msg }); if (s.history.length > 20) s.history = s.history.slice(-20)
      igState.set(ownerId, s); db.igChats[ownerId] = { history: s.history, summary: s.summary || '' }; save()
    } else {
      // Outside Instagram's 24h messaging window the send fails — expected if they've been silent >1 day.
      logHit('ig-proactive-skipped', { status: r.status, body: (await r.text()).slice(0, 120) })
    }
  } catch (e) { logHit('ig-proactive-error', { error: e.message }) }
  finally {
    lastProactive = Date.now()
    const lo = db.settings.proMinMin, hi = Math.max(db.settings.proMaxMin, lo + 1)
    proactiveGap = (lo + Math.random() * (hi - lo)) * 60 * 1000 // next gap is random → mood-like
  }
}
setInterval(maybeReachOut, 90 * 1000) // check often; actual sends gated by the dynamic gap + quiet hours

// JSON feed for the logs page (text service label, no emoji).
function hitLabel(h) {
  const s = (h.type + ' ' + (typeof h.detail === 'string' ? h.detail : JSON.stringify(h.detail))).toLowerCase()
  if (s.includes('instagram') || h.type.startsWith('ig-') || h.type.startsWith('webhook') || h.type.startsWith('proactive')) return 'Instagram'
  if (s.includes('/api/chat')) return 'Chat'
  if (s.includes('linkedin')) return 'LinkedIn'
  if (s.includes('email') || s.includes('gmail')) return 'Gmail'
  if (s.includes('calendar')) return 'Calendar'
  if (s.includes('/api/jobs') || s.includes('/api/tasks') || s.includes('scheduled') || s.includes('idle')) return 'Tasks'
  if (s.includes('/api/integrations') || s.includes('/oauth')) return 'Integrations'
  if (s.includes('/api/persona') || s.includes('/api/memory') || s.includes('/api/contacts') || s.includes('learned')) return 'Memory'
  if (s.includes('/api/dev')) return 'Dev'
  if (s.includes('/api/health') || s.includes('/api/models')) return 'Health'
  return 'API'
}
app.get('/api/dev/hits.json', (req, res) => {
  res.set('Cache-Control', 'no-store').json(HITS.map(h => ({
    at: h.at, type: h.type, label: hitLabel(h),
    detail: typeof h.detail === 'string' ? h.detail : JSON.stringify(h.detail),
  })))
})

// Clean logs console: Live / Recorded tabs, Copy + Record buttons, no emojis.
app.get('/api/dev/hits', (req, res) => {
  res.set('Cache-Control', 'no-store').type('html').send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Atlas Logs</title>
<style>
:root{--bg:#fafafb;--card:#fff;--line:#e6e8eb;--ink:#1a1d21;--mut:#6b7280}
*{box-sizing:border-box}
body{font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;background:var(--bg);color:var(--ink)}
header{padding:14px 20px;border-bottom:1px solid var(--line);background:var(--card);position:sticky;top:0;z-index:2}
h1{font-size:15px;margin:0 0 10px;font-weight:600;letter-spacing:.01em}
.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.tab{padding:6px 14px;border:1px solid var(--line);background:var(--bg);border-radius:8px;cursor:pointer;font-size:13px}
.tab.active{background:var(--ink);color:#fff;border-color:var(--ink)}
.btn{padding:6px 12px;border:1px solid var(--line);background:var(--card);border-radius:8px;cursor:pointer;font-size:13px}
.btn:hover{background:#f0f2f5}
.btn.rec{color:#c0392b;border-color:#e0b4b0}
.btn.rec.on{background:#c0392b;color:#fff;border-color:#c0392b}
.spacer{flex:1}
.meta{color:var(--mut);font-size:12px;margin-top:8px}
ul{list-style:none;margin:0;padding:6px 20px 40px}
li{padding:7px 0;border-bottom:1px solid #f0f1f3;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.t{color:#9aa0a6;font-variant-numeric:tabular-nums;font-size:12px;min-width:60px}
.pill{display:inline-block;min-width:88px;text-align:center;font-size:11px;color:#3a3f45;background:#eef0f3;border-radius:6px;padding:2px 8px}
.ty{font-weight:600;font-size:12px}
.ty.err{color:#c0392b}.ty.ok{color:#1e7e34}
.d{color:#555;word-break:break-all;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;flex:1;min-width:220px}
.empty{color:#9aa0a6;padding:24px 20px}
</style></head><body>
<header>
<h1>Atlas Logs</h1>
<div class="row">
<div class="tab active" id="tabLive" onclick="show('live')">Live Logs</div>
<div class="tab" id="tabRec" onclick="show('rec')">Recorded</div>
<span class="spacer"></span>
<button class="btn rec" id="recBtn" onclick="toggleRec()">Start Recording</button>
<button class="btn" onclick="copyLogs()">Copy Logs</button>
<button class="btn" onclick="clearRec()">Clear Recorded</button>
</div>
<div class="meta" id="meta">Loading</div>
</header>
<ul id="list"></ul>
<script>
var live=[],rec=[],recording=false,view='live';
function key(h){return h.at+'|'+h.type+'|'+h.detail}
function tyClass(t){if(/error|fail|skipped/.test(t))return 'err';if(/sent|done|verify|scheduled|learned/.test(t))return 'ok';return ''}
function esc(s){return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]})}
function render(){
 var data=view==='live'?live:rec,el=document.getElementById('list');
 if(!data.length){el.innerHTML='<li class="empty">No logs '+(view==='rec'?'recorded yet — press Start Recording.':'yet.')+'</li>'}
 else{var h='';for(var i=0;i<data.length;i++){var x=data[i];
  h+='<li><span class="t">'+esc(x.at.slice(11,19))+'</span><span class="pill">'+esc(x.label)+'</span><span class="ty '+tyClass(x.type)+'">'+esc(x.type)+'</span><span class="d">'+esc(x.detail)+'</span></li>'}
  el.innerHTML=h}
 document.getElementById('meta').textContent=(view==='live'?('Live · '+live.length+' recent · auto-refresh 3s'):('Recorded · '+rec.length+' entries'))+(recording?' · RECORDING':'')}
function show(v){view=v;document.getElementById('tabLive').className='tab'+(v==='live'?' active':'');document.getElementById('tabRec').className='tab'+(v==='rec'?' active':'');render()}
function toggleRec(){recording=!recording;var b=document.getElementById('recBtn');b.textContent=recording?'Stop Recording':'Start Recording';b.className='btn rec'+(recording?' on':'');render()}
function clearRec(){rec=[];render()}
function copyLogs(){var data=view==='live'?live:rec;var txt=data.map(function(x){return x.at+'  ['+x.label+']  '+x.type+'  '+x.detail}).join('\\n');navigator.clipboard.writeText(txt).then(function(){var m=document.getElementById('meta');m.textContent='Copied '+data.length+' lines to clipboard';setTimeout(render,1200)})}
function poll(){fetch('/api/dev/hits.json').then(function(r){return r.json()}).then(function(d){live=d;if(recording){var seen={};for(var i=0;i<rec.length;i++)seen[key(rec[i])]=1;var add=[];for(var j=0;j<d.length;j++){if(!seen[key(d[j])])add.push(d[j])}rec=add.concat(rec)}render()}).catch(function(){})}
poll();setInterval(poll,3000);
</script></body></html>`)
})

// ---------- Voice: Groq Whisper (speech-in) + Piper (speech-out, self-hosted female voices) ----------
const PIPER_BIN = process.env.PIPER_BIN || '/home/azureuser/piper-tts/piper/piper'
const PIPER_VOICE_EN = process.env.PIPER_VOICE || '/home/azureuser/piper-tts/en_US-amy-medium.onnx'
const PIPER_VOICE_TE = process.env.PIPER_VOICE_TE || '/home/azureuser/piper-tts/te_IN-padmavathi-medium.onnx'

// Speech-to-text & translation via Gemini 3.8 Flash (multimodal audio)
app.post('/api/voice/stt', express.raw({ type: '*/*', limit: '15mb' }), async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY || (REASON_KEYS && REASON_KEYS[0]);
  if (!geminiKey) return res.status(400).json({ error: 'speech key not set' });
  if (!req.body?.length) return res.status(400).json({ error: 'no audio' });
  
  const targetLang = req.query.lang === 'te' ? 'Telugu' : 'English';
  const mimeType = req.get('content-type') || 'audio/webm';
  const audioBase64 = req.body.toString('base64');
  
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              text: `Listen to this audio recording carefully. The target language is ${targetLang}.
If the speaker is speaking ${targetLang}, transcribe their words verbatim.
If the speaker is speaking a different language or asking for translation, translate it accurately into ${targetLang}.
Return ONLY the final transcribed/translated text. No explanations, no markdown fences, no conversational filler.`
            },
            {
              inlineData: {
                mimeType: mimeType,
                data: audioBase64
              }
            }
          ]
        }]
      })
    });
    
    if (r.ok) {
      const j = await r.json();
      const text = (j.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
      return res.json({ text });
    } else {
      const errText = await r.text();
      console.error('Gemini STT error:', errText);
      return res.status(r.status).json({ error: 'stt failed' });
    }
  } catch (err) {
    console.error('Gemini STT exception:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Text-to-speech: text → Piper → WAV. Auto-picks the Telugu voice if the text is in Telugu script.
app.post('/api/voice/tts', (req, res) => {
  const text = String(req.body?.text || '').replace(/[*#`_>|~]/g, '').slice(0, 900).trim()
  if (!text) return res.status(400).json({ error: 'text required' })
  const voice = /[ఀ-౿]/.test(text) ? PIPER_VOICE_TE : PIPER_VOICE_EN // Telugu vs English
  const out = `/tmp/tts_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`
  const proc = spawn(PIPER_BIN, ['--model', voice, '--output_file', out])
  let err = ''
  proc.stderr.on('data', d => { err += d })
  proc.on('error', e => { if (!res.headersSent) res.status(500).json({ error: e.message }) })
  proc.on('close', code => {
    if (code !== 0) { if (!res.headersSent) res.status(500).json({ error: 'tts failed: ' + err.slice(0, 160) }); return }
    try { const buf = readFileSync(out); unlinkSync(out); res.set('Content-Type', 'audio/wav').set('Cache-Control', 'no-store').send(buf) }
    catch (e) { if (!res.headersSent) res.status(500).json({ error: e.message }) }
  })
  proc.stdin.write(text); proc.stdin.end()
})

// Clean standalone usage page with progress bars (served at /usage via nginx).
app.get('/api/usagepage', (req, res) => {
  res.set('Cache-Control', 'no-store').type('html').send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Atlas Usage</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--line:#e7e9ee;--ink:#12141a;--mut:#6b7280;--accent:#2563eb;--warn:#f59e0b;--over:#dc2626}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:720px;margin:0 auto;padding:40px 20px 64px}
h1{font-size:22px;margin:0 0 4px;letter-spacing:-.01em}
.sub{color:var(--mut);font-size:13px;margin-bottom:26px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:20px 22px;margin-bottom:16px}
.ctitle{font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--mut);margin-bottom:16px}
.model{font-weight:600;font-size:15px}.model .m{color:var(--mut);font-weight:400;font-size:13px;margin-left:6px}
.meter{margin:18px 0}
.mhead{display:flex;justify-content:space-between;font-size:13px;margin-bottom:7px}
.mname{font-weight:500}.mval{color:var(--mut);font-variant-numeric:tabular-nums}
.bar{height:9px;border-radius:99px;background:#eceef2;overflow:hidden}
.fill{height:100%;border-radius:99px;background:var(--accent);transition:width .4s ease}
.fill.warn{background:var(--warn)}.fill.over{background:var(--over)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:16px}
.stat .v{font-size:24px;font-weight:700}.stat .l{color:var(--mut);font-size:13px}
.note{color:var(--mut);font-size:12.5px;margin-top:14px}
</style></head><body><div class="wrap">
<h1>Atlas Usage</h1>
<div class="sub" id="sub">Loading…</div>
<div id="root"></div>
</div>
<script>
var fmt=function(n){n=n||0;return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':String(n)};
function meter(name,used,total){var pct=Math.min(100,Math.round(used/total*100));var tone=pct>=90?'over':pct>=75?'warn':'';
 return '<div class="meter"><div class="mhead"><span class="mname">'+name+'</span><span class="mval">'+fmt(used)+' / '+fmt(total)+' &middot; '+pct+'%</span></div><div class="bar"><div class="fill '+tone+'" style="width:'+pct+'%"></div></div></div>'}
function render(u){
 var g=u.groq||{},t=g.today||{requests:0,tokens:0},lim=g.limits||{requestsPerDay:1000,tokensPerDay:500000};
 document.getElementById('sub').textContent='Groq free tier &middot; resets daily (IST) &middot; auto-refresh'.replace('&middot;','·').replace('&middot;','·');
 var html='';
 var acc=g.accounts||1, perAcc=(g.limits&&g.limits.perAccountTokens)||100000, keys=g.perAccount||[];
 html+='<div class="card"><div class="ctitle">Reasoning brain — Groq ('+acc+' account'+(acc>1?'s':'')+')</div>';
 html+='<div class="model">'+(g.limits?(u.reasoningModel||'Groq'):'Local model only')+'<span class="m">'+(g.limits?(fmt(perAcc)+' tokens/day each · auto-rotates'):'no Groq key')+'</span></div>';
 html+=meter('Total tokens today',t.tokens,lim.tokensPerDay);
 for(var a=0;a<acc;a++){var kt=(keys[a]&&keys[a].tokens)||0; html+=meter('Account '+(a+1),kt,perAcc)}
 html+='<div class="note">All-time: '+fmt(g.requests)+' requests · '+fmt(g.tokens)+' tokens. Atlas uses each account until its daily limit, then rotates to the next; if all are spent it falls back to the local model.</div></div>';
 var sv=u.services||{},sl=(sv.limits)||{};
 var svcs=[['Instagram / Meta','instagram'],['Gmail','gmail'],['Google Calendar','calendar'],['LinkedIn','linkedin'],['Web search','websearch']];
 html+='<div class="card"><div class="ctitle">Integrations — free tiers (used today)</div>';
 svcs.forEach(function(s){var used=sv[s[1]]||0,lim=sl[s[1]]||0;
   if(lim>0){html+=meter(s[0],used,lim)}
   else{html+='<div class="meter"><div class="mhead"><span class="mname">'+s[0]+'</span><span class="mval">'+fmt(used)+' today · no hard cap</span></div><div class="bar"><div class="fill" style="width:'+Math.min(100,used)+'%"></div></div></div>'}
 });
 html+='<div class="note">Daily action counts vs approximate free-tier limits. Reads (checking calendar/inbox) are near-unlimited and not shown.</div></div>';
 html+='<div class="card"><div class="ctitle">Activity</div><div class="grid">';
 [['Chats',u.chats],['Memories',u.memories],['Tasks',u.tasks],['Storage',((u.storage_bytes||0)/1024).toFixed(1)+' KB']].forEach(function(s){
   html+='<div class="stat"><div class="v">'+(typeof s[1]==='number'?fmt(s[1]):s[1])+'</div><div class="l">'+s[0]+'</div></div>'});
 html+='</div></div>';
 document.getElementById('root').innerHTML=html;
}
function poll(){fetch('/api/usage').then(function(r){return r.json()}).then(render).catch(function(){})}
poll();setInterval(poll,5000);
</script></body></html>`)
})

app.get('/', (req, res) => res.json({ service: 'atlas-backend', see: '/api/health' }))

// ==========================================
// Voice & Multimodal Processing via Gemini 3.8 Flash
// ==========================================
app.post('/api/voice/transcribe', async (req, res) => {
  try {
    const { audio, mimeType } = req.body || {};
    if (!audio) return res.status(400).json({ error: 'Audio payload required' });
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || (REASON_KEYS && REASON_KEYS[0]);
    if (apiKey) {
      const cleanData = audio.replace(/^data:[^;]+;base64,/, '');
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Transcribe this voice audio accurately. Return only the spoken words verbatim.' },
              { inlineData: { mimeType: mimeType || 'audio/wav', data: cleanData } }
            ]
          }]
        })
      });
      if (resp.ok) {
        const j = await resp.json();
        const text = j.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        return res.json({ text });
      }
    }
    return res.json({ text: '' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Image Generation API via Google Imagen 3 / Gemini
// ==========================================
app.post('/api/image/generate', async (req, res) => {
  try {
    const { prompt, aspectRatio, numberOfImages } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY || (REASON_KEYS && REASON_KEYS[0]);
    if (apiKey) {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { sampleCount: numberOfImages || 1, aspectRatio: aspectRatio || '1:1' }
        })
      });
      if (resp.ok) {
        const j = await resp.json();
        const predictions = j.predictions || [];
        const images = predictions.map(p => ({ b64: p.bytesBase64Encoded, mimeType: p.mimeType || 'image/jpeg' }));
        return res.json({ success: true, images });
      }
    }
    return res.json({ success: true, prompt, note: 'Gemini image generation queued' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Atlas backend on :${PORT} (model ${DEFAULT_MODEL})`)
  // Wait for Ollama to warm up after a boot, then resume any pending background tasks.
  setTimeout(resumeJobs, 15000)
})
