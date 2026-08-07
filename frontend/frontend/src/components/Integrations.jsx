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
