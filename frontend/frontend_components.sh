cat << 'EOF' > ~/atlas/frontend/src/index.css
:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f9f9f9;
  --bg-tertiary: #f0f0f0;
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --accent: #2d2d2d;
  --border: #e5e5e5;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { background-color: var(--bg-primary); color: var(--text-primary); -webkit-font-smoothing: antialiased; height: 100vh; overflow: hidden; }
#root { height: 100%; }
EOF

cat << 'EOF' > ~/atlas/frontend/src/App.css
.app-container { display: flex; height: 100vh; width: 100vw; }
.sidebar { width: 260px; background-color: var(--bg-secondary); border-right: 1px solid var(--border); display: flex; flex-direction: column; transition: all 0.2s ease; }
.sidebar-header { padding: 20px; display: flex; align-items: center; gap: 12px; font-weight: 600; font-size: 16px; border-bottom: 1px solid var(--border); }
.sidebar-content { flex: 1; padding: 16px; overflow-y: auto; }
.sidebar-footer { padding: 16px; border-top: 1px solid var(--border); }
.nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; color: var(--text-primary); cursor: pointer; transition: background-color 0.15s ease; font-size: 14px; }
.nav-item:hover, .nav-item.active { background-color: var(--bg-tertiary); }
.main-content { flex: 1; display: flex; flex-direction: column; background-color: var(--bg-primary); }
.chat-container { flex: 1; display: flex; flex-direction: column; max-width: 800px; margin: 0 auto; width: 100%; padding: 24px; }
.messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 24px; padding-bottom: 24px; }
.message { display: flex; gap: 16px; max-width: 85%; }
.message.user { align-self: flex-end; flex-direction: row-reverse; }
.avatar { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.avatar.user { background-color: var(--bg-tertiary); color: var(--text-primary); }
.avatar.agent { background-color: var(--accent); color: white; }
.message-content { background-color: var(--bg-secondary); padding: 12px 16px; border-radius: 12px; font-size: 15px; line-height: 1.5; color: var(--text-primary); }
.message.user .message-content { background-color: var(--bg-tertiary); }
.input-area { padding: 24px 0 0; }
.input-wrapper { display: flex; align-items: center; background-color: var(--bg-primary); border: 1px solid var(--border); border-radius: 16px; padding: 8px 16px; box-shadow: var(--shadow-sm); transition: border-color 0.2s ease, box-shadow 0.2s ease; }
.input-wrapper:focus-within { border-color: #ccc; box-shadow: var(--shadow-md); }
.chat-input { flex: 1; border: none; outline: none; background: transparent; padding: 10px 0; font-size: 15px; font-family: inherit; resize: none; max-height: 150px; }
.chat-input::placeholder { color: var(--text-secondary); }
.send-button { background: transparent; border: none; color: var(--text-secondary); cursor: pointer; padding: 8px; border-radius: 8px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
.send-button:hover { background-color: var(--bg-tertiary); color: var(--text-primary); }
.integrations-panel { padding: 48px 24px; max-width: 800px; margin: 0 auto; width: 100%; overflow-y: auto; height: 100%; }
.integration-card { display: flex; align-items: center; justify-content: space-between; padding: 20px; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 16px; background-color: var(--bg-primary); transition: box-shadow 0.2s ease; }
.integration-card:hover { box-shadow: var(--shadow-sm); }
.integration-info { display: flex; align-items: center; gap: 16px; }
.integration-icon { width: 48px; height: 48px; background-color: var(--bg-secondary); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: var(--text-primary); }
.integration-details h3 { font-size: 16px; font-weight: 500; margin-bottom: 4px; }
.integration-details p { font-size: 14px; color: var(--text-secondary); }
.connect-btn { padding: 8px 16px; background-color: var(--bg-primary); border: 1px solid var(--border); border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s ease; }
.connect-btn:hover { background-color: var(--bg-tertiary); }
.connect-btn.connected { background-color: #f0fdf4; border-color: #bbf7d0; color: #166534; }
EOF

cat << 'EOF' > ~/atlas/frontend/src/components/Sidebar.jsx
import { ChatCircle, Plugs, Gear } from '@phosphor-icons/react'

export default function Sidebar({ activeTab, setActiveTab }) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="avatar agent">A</div>
        Atlas OS
      </div>
      <div className="sidebar-content">
        <div 
          className={\
av-item \\}
          onClick={() => setActiveTab('chat')}
        >
          <ChatCircle size={20} />
          <span>Chat</span>
        </div>
        <div 
          className={\
av-item \\}
          onClick={() => setActiveTab('integrations')}
        >
          <Plugs size={20} />
          <span>Integrations</span>
        </div>
      </div>
      <div className="sidebar-footer">
        <div className="nav-item">
          <Gear size={20} />
          <span>Settings</span>
        </div>
      </div>
    </div>
  )
}
EOF

cat << 'EOF' > ~/atlas/frontend/src/components/ChatArea.jsx
import { useState, useRef, useEffect } from 'react'
import { PaperPlaneRight } from '@phosphor-icons/react'

export default function ChatArea() {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello from Atlas. How can I assist you today?", sender: "agent" }
  ])
  const [input, setInput] = useState("")
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return
    const userMsg = { id: Date.now(), text: input, sender: "user" }
    setMessages(prev => [...prev, userMsg])
    setInput("")

    try {
      const res = await fetch('/api/health')
      if (res.ok) {
        setTimeout(() => {
          setMessages(prev => [...prev, { id: Date.now()+1, text: "Backend is healthy! Phase 2 will enable full chat.", sender: "agent" }])
        }, 500)
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map(m => (
          <div key={m.id} className={\message \\}>
            <div className={\vatar \\}>
              {m.sender === 'user' ? 'U' : 'A'}
            </div>
            <div className="message-content">
              {m.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="input-area">
        <div className="input-wrapper">
          <textarea 
            className="chat-input" 
            placeholder="Message Atlas..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            rows={1}
          />
          <button className="send-button" onClick={handleSend}>
            <PaperPlaneRight size={20} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  )
}
EOF

cat << 'EOF' > ~/atlas/frontend/src/components/Integrations.jsx
import { EnvelopeSimple, Calendar, GithubLogo, GoogleLogo } from '@phosphor-icons/react'

export default function Integrations() {
  const integrations = [
    { id: 'google', name: 'Google Login', desc: 'Sign in with Google', icon: <GoogleLogo size={24} weight="fill" />, connected: false },
    { id: 'gmail', name: 'Gmail API', desc: 'Read and send emails via Hermes', icon: <EnvelopeSimple size={24} weight="fill" />, connected: true },
    { id: 'calendar', name: 'Calendar API', desc: 'Manage your schedule', icon: <Calendar size={24} weight="fill" />, connected: false },
    { id: 'github', name: 'GitHub', desc: 'Interact with repositories and issues', icon: <GithubLogo size={24} weight="fill" />, connected: false },
  ]

  return (
    <div className="integrations-panel">
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontWeight: 600, fontSize: '24px', marginBottom: '8px' }}>Integrations</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Connect external apps and services to enable Hermes agents.</p>
      </div>

      <div className="integrations-list">
        {integrations.map(app => (
          <div key={app.id} className="integration-card">
            <div className="integration-info">
              <div className="integration-icon">{app.icon}</div>
              <div className="integration-details">
                <h3>{app.name}</h3>
                <p>{app.desc}</p>
              </div>
            </div>
            <button className={\connect-btn \\}>
              {app.connected ? 'Connected' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
EOF