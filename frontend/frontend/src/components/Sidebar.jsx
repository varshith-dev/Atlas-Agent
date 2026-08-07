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
