rm -rf ~/atlas/frontend
mkdir -p ~/atlas/frontend/src/components
mkdir -p ~/atlas/frontend/public

cat << 'EOF' > ~/atlas/frontend/package.json
{
  "name": "atlas-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@phosphor-icons/react": "^2.1.5"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.2.0"
  }
}
EOF

cat << 'EOF' > ~/atlas/frontend/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
EOF

cat << 'EOF' > ~/atlas/frontend/index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Atlas</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

cat << 'EOF' > ~/atlas/frontend/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
EOF

cat << 'EOF' > ~/atlas/frontend/src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
EOF

cat << 'EOF' > ~/atlas/frontend/src/App.jsx
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
EOF