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
