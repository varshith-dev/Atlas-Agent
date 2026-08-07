import { useState } from 'react'
import './App.css'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import Integrations from './components/Integrations'

function App() {
  const [activeTab, setActiveTab] = useState('chat')

  return (
    <div className="app-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main-content">
        {activeTab === 'chat' ? <ChatArea /> : <Integrations />}
      </div>
    </div>
  )
}

export default App
