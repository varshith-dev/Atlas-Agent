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
          className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <ChatCircle size={20} />
          <span>Chat</span>
        </div>
        <div 
          className={`nav-item ${activeTab === 'integrations' ? 'active' : ''}`}
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
          <div key={m.id} className={`message ${m.sender}`}>
            <div className={`avatar ${m.sender}`}>
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
            <button className={`connect-btn ${app.connected ? 'connected' : ''}`}>
              {app.connected ? 'Connected' : 'Connect'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
EOF

cd ~/atlas
sudo docker compose build frontend
sudo docker compose up -d
