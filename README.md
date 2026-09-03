# 🧭 Atlas Agent

<p align="center">
  <img src="https://img.shields.io/badge/ATLAS%20AGENT-7C3AED?style=for-the-badge&logo=probot&logoColor=white" alt="Atlas Agent">
  <img src="https://img.shields.io/badge/AI%20ASSISTANT-06B6D4?style=for-the-badge" alt="AI Assistant">
  <img src="https://img.shields.io/badge/CLAUDE-90%25-8B5CF6?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude">
  <img src="https://img.shields.io/badge/Ollama-Local%20AI-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama">
</p>

<p align="center">
  <strong>A personal AI agent that can understand, remember, search, connect and act.</strong>
</p>

<p align="center">
  Atlas combines local LLM inference, persistent memory, real-world integrations,
  automation and an agentic execution layer into one personal AI system.
</p>

<p align="center">
  <a href="#-overview">Overview</a> •
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-integrations">Integrations</a> •
  <a href="#-roadmap">Roadmap</a>
</p>

---

## 🌌 Overview

Atlas Agent is a personal AI assistant designed to go beyond a traditional chatbot.

Instead of only generating text, Atlas is designed to interact with external services, maintain persistent context, search the web, manage tasks, generate documents and perform real-world actions.

### Traditional AI

```text
User
  ↓
Prompt
  ↓
LLM
  ↓
Response
````

### Atlas

```text
                         ┌─────────────────┐
                         │      USER       │
                         └────────┬────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │   ATLAS AGENT   │
                         └────────┬────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
              ▼                   ▼                   ▼
         ┌──────────┐       ┌──────────┐       ┌──────────┐
         │  MEMORY  │       │   TOOLS  │       │   MODEL  │
         └──────────┘       └─────┬────┘       └──────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
                  Gmail       Calendar         Web
```

The objective is simple:

> **Don't just make an AI that talks. Build an AI that can actually do things.**

---

# ✨ Features

<table>
<tr>
<td width="50%">

### 🧠 Personal Intelligence

* Persistent memory
* Conversation history
* Context-aware responses
* Local LLM inference
* Usage tracking
* Multi-language support

</td>

<td width="50%">

### ⚡ Agent Capabilities

* Tool execution
* Web search
* Background jobs
* Scheduled tasks
* Streaming responses
* Action-based workflows

</td>
</tr>

<tr>
<td>

### 🔌 Integrations

* Gmail
* Google Calendar
* GitHub
* LinkedIn
* Google OAuth
* External web services

</td>

<td>

### 📄 Content Generation

* PDF generation
* Excel generation
* Word documents
* Email drafting
* Social media content
* Structured reports

</td>
</tr>
</table>

---

# 🧠 Local AI

Atlas is built around local LLM inference using [Ollama](https://ollama.com/).

Instead of sending every AI request to a hosted model provider, Atlas can communicate with a model running on your own machine or server.

```text
┌───────────────┐
│ Atlas Agent   │
└───────┬───────┘
        │
        │ HTTP
        ▼
┌───────────────┐
│    Ollama     │
└───────┬───────┘
        │
        ▼
┌───────────────────────┐
│ Local Language Model  │
└───────────────────────┘
```

This makes the architecture suitable for:

* Self-hosted AI
* Privacy-focused deployments
* Low-cost AI infrastructure
* Local experimentation
* Personal AI systems
* Offline-capable development environments

---

# 🧠 Persistent Memory

Atlas maintains persistent information instead of treating every conversation as completely isolated.

The backend currently maintains application state for:

```text
Memories
Messages
Tasks
Jobs
Contacts
Integrations
Logs
Usage
```

The memory lifecycle is:

```text
Conversation
     ↓
Context
     ↓
Memory
     ↓
Persistent Storage
     ↓
Future Conversations
```

This creates a basic:

```text
LEARN → STORE → RETRIEVE → USE
```

cycle.

---

# 📧 Gmail Integration

Atlas can connect to Gmail using Google's OAuth infrastructure.

Typical workflows include:

```text
"Show me my latest emails."

"Find emails about the event."

"Search my inbox for GitHub."

"Draft an email to Alex."

"Send this email."
```

The general workflow is:

```text
User
 ↓
Atlas
 ↓
Intent Detection
 ↓
Gmail Tool
 ↓
Gmail API
 ↓
Email Data
 ↓
Atlas
 ↓
Response
```

Atlas separates information retrieval from external write actions so that operations such as sending an email can be treated differently from simply reading an inbox.

---

# 📅 Google Calendar

Atlas can work with Google Calendar through OAuth.

Natural-language requests can be converted into structured calendar operations.

Example:

```text
"Schedule a project review tomorrow at 10 AM."
```

becomes:

```text
Natural Language
       ↓
Intent Extraction
       ↓
Event Details
       ↓
Google Calendar API
       ↓
Calendar Event
```

Atlas can also retrieve upcoming calendar information.

---

# 🌐 Web Search

Atlas includes a web-search capability for retrieving current information.

The workflow is:

```text
Question
   ↓
Search Query
   ↓
Web Search
   ↓
Result Extraction
   ↓
Relevant Context
   ↓
Atlas
   ↓
Answer
```

This allows Atlas to supplement local model knowledge with information retrieved from the web.

---

# 💼 LinkedIn Integration

Atlas can generate and publish LinkedIn content.

Example workflow:

```text
Idea
 ↓
Atlas
 ↓
Generate Post
 ↓
Review
 ↓
Publish
 ↓
LinkedIn
```

Example:

```text
"Create a LinkedIn post about launching Atlas."
```

Atlas can generate the content before publishing it through the configured LinkedIn integration.

---

# 🐙 GitHub Integration

GitHub is part of the integration architecture and OAuth configuration.

This creates a foundation for future GitHub-oriented workflows such as:

```text
Repository information
Issues
Pull requests
Commits
Developer activity
Project automation
```

---

# ⚙️ Background Tasks

Atlas is designed to support tasks that don't necessarily need to finish during the initial request.

```text
User Request
     ↓
Create Job
     ↓
Persistent Job State
     ↓
Background Execution
     ↓
Result
```

This enables longer-running workflows without forcing the user to keep the chat open.

---

# ⏰ Scheduled Tasks

Atlas can maintain scheduled tasks and calculate future execution times.

Examples:

```text
"Remind me tomorrow."

"Run this every morning."

"Do this every day at 8 AM."
```

The task engine can persist scheduled work so that it can continue across application restarts.

---

# ⚡ Streaming Responses

Atlas uses Server-Sent Events (SSE) for streaming AI responses.

Instead of waiting for one large response:

```text
REQUEST
   ↓
WAIT
   ↓
WAIT
   ↓
COMPLETE
```

Atlas can stream incremental events:

```text
REQUEST
   ↓
STEP
   ↓
TOKEN
   ↓
TOKEN
   ↓
ACTION
   ↓
TOKEN
   ↓
DONE
```

This makes the interface more responsive and allows the frontend to display agent progress.

---

# 📄 Document Generation

Atlas includes a document generation layer.

| Format | Technology |
| ------ | ---------- |
| PDF    | PDFKit     |
| Excel  | ExcelJS    |
| Word   | docx       |

Example:

```text
"Create a PDF report from this information."
```

Workflow:

```text
User
 ↓
Atlas
 ↓
Structured Content
 ↓
Document Generator
 ↓
Generated File
```

---

# 🎙️ Text-to-Speech

Atlas contains TTS infrastructure using Piper assets.

The repository includes voice assets for:

```text
English
Telugu
```

This creates a foundation for future voice-first interactions.

---

# 🔐 OAuth Architecture

Atlas uses OAuth for integrations that require authorization.

```text
┌────────┐
│  User  │
└───┬────┘
    │
    ▼
Atlas Authorization
    │
    ▼
OAuth Provider
    │
    │ User Approval
    ▼
Authorization Code
    │
    ▼
Token Exchange
    │
    ▼
Access Token
    │
    ▼
Atlas Integration
```

Configured integration providers include:

```text
Google
GitHub
LinkedIn
```

---

# 🏗️ Architecture

```text
                         ┌─────────────────────┐
                         │        USER         │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    REACT FRONTEND  │
                         │       + VITE       │
                         └──────────┬──────────┘
                                    │
                               HTTP / SSE
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │       EXPRESS BACKEND         │
                    │                               │
                    │   API     Agent     Tasks     │
                    │            Engine              │
                    └───────────────┬───────────────┘
                                    │
               ┌────────────────────┼────────────────────┐
               │                    │                    │
               ▼                    ▼                    ▼
        ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
        │   OLLAMA    │      │   MEMORY    │      │    TOOLS    │
        │ Local LLM   │      │   STORE     │      │             │
        └─────────────┘      └─────────────┘      └──────┬──────┘
                                                         │
                              ┌──────────────────────────┼───────────────┐
                              │                          │               │
                              ▼                          ▼               ▼
                           GMAIL                    CALENDAR            WEB
                              │                          │               │
                              └──────────────────────────┼───────────────┘
                                                         │
                                                         ▼
                                                EXTERNAL SERVICES
```

---

# 🔬 Agent Execution Model

Atlas uses a combination of deterministic tool routing and local model generation.

### Normal conversation

```text
User
 ↓
Atlas
 ↓
Ollama
 ↓
Streaming Response
```

### Tool-based request

```text
User
 ↓
Intent Detection
 ↓
Tool Selection
 ↓
Tool Execution
 ↓
External Service
 ↓
Retrieved Data
 ↓
Ollama
 ↓
Final Response
```

This architecture reduces the amount of responsibility placed entirely on the language model.

The model generates intelligence.

The application controls execution.

---

# 🛡️ Read vs Write Operations

Atlas distinguishes between operations that retrieve information and operations that create external side effects.

### Read operations

```text
Read Gmail
Search Gmail
Read Calendar
Search Web
Retrieve information
```

### Write operations

```text
Send Gmail
Create Calendar Event
Publish LinkedIn Post
Generate files
```

The distinction is important for building safer agentic systems.

```text
READ
 ↓
Retrieve information

WRITE
 ↓
External side effect
 ↓
Approval / controlled execution
```

---

# 📊 Usage Tracking

Atlas maintains usage information for the application.

Example structure:

```json
{
  "requests": 0,
  "tokens": 0,
  "chats": 0,
  "since": "..."
}
```

This provides a foundation for future:

* Usage analytics
* Token monitoring
* Cost estimation
* Performance tracking
* Agent observability

---

# 📁 Project Structure

```text
Atlas-Agent/
│
├── backend/
│   ├── data/
│   ├── docs.js
│   ├── oauth.js
│   ├── package.json
│   ├── server.js
│   ├── store.js
│   └── tools.js
│
├── frontend/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── App.jsx
│   │   │   ├── App.css
│   │   │   ├── index.css
│   │   │   └── main.jsx
│   │   │
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── vite.config.js
│   │
│   ├── nginx/
│   ├── compose.yaml
│   ├── setup.sh
│   ├── setup_ssl.sh
│   └── deploy_frontend.sh
│
├── tts/
│   ├── piper/
│   ├── piper.tgz
│   ├── en_US-amy-medium.onnx.json
│   └── te_IN-padmavathi-medium.onnx.json
│
├── atlas-nginx.conf
├── setup_vm.sh
├── warmup.json
└── LICENSE
```

---

# 🧰 Tech Stack

<p align="center">

<img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB">
<img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white">
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white">
<img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white">
<img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white">

</p>

<p align="center">

<img src="https://img.shields.io/badge/Gmail-EA4335?style=for-the-badge&logo=gmail&logoColor=white">
<img src="https://img.shields.io/badge/Google%20Calendar-4285F4?style=for-the-badge&logo=googlecalendar&logoColor=white">
<img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white">
<img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white">

</p>

<p align="center">

<img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white">
<img src="https://img.shields.io/badge/Nginx-009639?style=for-the-badge&logo=nginx&logoColor=white">
<img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black">

</p>

---

# 🚀 Installation

## Requirements

Before running Atlas, install:

* Node.js
* npm
* Git
* Ollama
* Docker (optional)

---

## 1. Clone the repository

```bash
git clone https://github.com/varshith-dev/Atlas-Agent.git

cd Atlas-Agent
```

---

## 2. Install backend dependencies

```bash
cd backend

npm install
```

Start the backend:

```bash
npm start
```

---

## 3. Install frontend dependencies

Open another terminal:

```bash
cd frontend/frontend

npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

---

# 🧠 Configure Ollama

Install Ollama:

[https://ollama.com/](https://ollama.com/)

Pull a model:

```bash
ollama pull phi3
```

You can configure the model through environment variables.

Example:

```env
OLLAMA_URL=http://127.0.0.1:11434

DEFAULT_MODEL=phi3

AGENT_MODEL=qwen2.5:3b
```

---

# 🔐 Environment Configuration

Create your environment configuration for the backend.

```env
PORT=8080

OLLAMA_URL=http://127.0.0.1:11434

DEFAULT_MODEL=phi3

AGENT_MODEL=qwen2.5:3b

APP_BASE=https://your-domain.com

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=

NOTIFY_EMAIL=
```

> **Never commit `.env` files, OAuth credentials, access tokens or secrets to GitHub.**

---

# 🩺 Health Check

Atlas exposes a health endpoint:

```http
GET /api/health
```

Example:

```bash
curl http://localhost:8080/api/health
```

The endpoint provides information about:

* Backend status
* Ollama availability
* Configured model
* Available models
* Application uptime

---

# 🔗 API Overview

### Health

```http
GET /api/health
```

### Models

```http
GET /api/models
```

### Memory

```http
GET    /api/memory
POST   /api/memory
DELETE /api/memory/:id
```

### Contacts

```http
GET    /api/contacts
DELETE /api/contacts/:name
```

### Conversation

```http
GET    /api/history
DELETE /api/history
```

### Chat

```http
POST /api/chat
```

The chat endpoint supports streaming responses using Server-Sent Events.

---

# 💬 Example Commands

Atlas is designed around natural language.

### Conversation

```text
Tell me something interesting about AI agents.
```

### Memory

```text
Remember that I prefer concise emails.
```

### Gmail

```text
Show me my latest emails.
```

```text
Find emails about GitHub.
```

```text
Draft an email to Alex about tomorrow's meeting.
```

### Calendar

```text
What's on my calendar this week?
```

```text
Schedule a project review tomorrow at 10 AM.
```

### Web

```text
Search the web for the latest AI news.
```

### LinkedIn

```text
Create a LinkedIn post about launching Atlas.
```

### Background tasks

```text
Work on this in the background.
```

### Scheduled tasks

```text
Remind me every morning at 8 AM.
```

---

# 🐳 Deployment

Atlas contains deployment infrastructure for Docker, Nginx and VM environments.

The repository includes:

```text
Docker
Docker Compose
Nginx
SSL configuration
VM setup
Frontend deployment scripts
```

A typical deployment architecture:

```text
                    INTERNET
                       │
                       ▼
                ┌─────────────┐
                │    NGINX    │
                │  SSL / TLS  │
                └──────┬──────┘
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
       React Frontend      Express API
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
                 ▼              ▼              ▼
              Ollama         Storage      External APIs
```

---

# 🗃️ Storage

Atlas currently uses a lightweight persistent JSON store.

The data layer maintains information such as:

```text
Memories
Messages
Tasks
Jobs
Contacts
Integrations
Logs
Usage
```

This approach keeps the project simple for personal and low-volume deployments.

For larger production environments, the architecture can eventually move toward:

```text
JSON
  ↓
SQLite
  ↓
PostgreSQL
  ↓
Vector Database
  ↓
Semantic Memory
```

---

# 🎨 Interface

Atlas uses a React-based frontend with Vite.

The interface is designed around:

```text
Chat
Integrations
Agent Actions
Streaming Responses
```

Add your actual screenshots here:

```markdown
## Screenshots

### Atlas Chat

<p align="center">
  <img src="./docs/screenshots/atlas-chat.png" width="90%">
</p>

### Integrations

<p align="center">
  <img src="./docs/screenshots/integrations.png" width="90%">
</p>
```

---

# 🤖 AI-Assisted Development

<p align="center">
  <img src="https://img.shields.io/badge/Approximately-90%25%20Claude%20Assisted-8B5CF6?style=for-the-badge&logo=anthropic&logoColor=white">
</p>

A significant portion of Atlas was developed with **Anthropic Claude** as an AI engineering collaborator.

Claude was extensively used during the development process for:

* Backend implementation
* Frontend implementation
* Agent logic
* API integration
* Refactoring
* Debugging
* Deployment work
* Documentation
* Problem solving
* Feature exploration

The project author remained responsible for:

* Product direction
* Architecture decisions
* Requirements
* Technology choices
* Integration configuration
* Testing
* Deployment
* Code review
* Final decisions

### Development model

```text
                   PRODUCT VISION
                         │
                         ▼
                 ┌───────────────┐
                 │     HUMAN     │
                 │ Direction + QA│
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │    CLAUDE     │
                 │ AI Engineering│
                 │   Assistance  │
                 └───────┬───────┘
                         │
                         ▼
                 ┌───────────────┐
                 │     ATLAS     │
                 │     AGENT     │
                 └───────────────┘
```

> **Atlas is intentionally an AI-assisted software engineering project. The approximately 90% figure represents the project's development experience and is not presented as a machine-audited line-by-line authorship measurement.**

---

# 🧪 Development Philosophy

Atlas explores a simple question:

> **What happens when a local AI model is given memory, tools, integrations and the ability to execute real-world tasks?**

The architecture therefore focuses on:

```text
LLM
 +
Memory
 +
Tools
 +
Context
 +
Execution
 =
Agent
```

The language model is only one part of the system.

The surrounding infrastructure is what allows the model to become an actual assistant.

---

# 🗺️ Roadmap

## Current

* [x] Local LLM integration
* [x] Persistent memory
* [x] Conversation history
* [x] Gmail integration
* [x] Google Calendar integration
* [x] Web search
* [x] LinkedIn integration
* [x] OAuth infrastructure
* [x] Streaming responses
* [x] Background tasks
* [x] Scheduled tasks
* [x] PDF generation
* [x] Excel generation
* [x] Word generation
* [x] React frontend
* [x] Docker deployment infrastructure
* [x] Nginx deployment infrastructure
* [x] English and Telugu TTS assets

## Planned

* [ ] Semantic memory
* [ ] Vector database
* [ ] Improved agent planning
* [ ] More integrations
* [ ] Better voice interaction
* [ ] Advanced authentication
* [ ] Agent observability
* [ ] Agent evaluation framework
* [ ] Plugin / skill system
* [ ] Mobile application
* [ ] Desktop application
* [ ] Multi-agent workflows

---

# 🔒 Security

Atlas interacts with services that may contain sensitive information.

Before deploying publicly:

* Use HTTPS
* Protect OAuth credentials
* Never expose access tokens
* Secure persistent storage
* Avoid logging sensitive information
* Use least-privilege OAuth scopes
* Add authentication before exposing APIs publicly
* Review all external write operations

> Atlas is an evolving personal-agent project and should be properly hardened before being used as a public production service.

---

# 🤝 Contributing

Contributions are welcome.

You can contribute through:

```text
Bug fixes
New integrations
New agent tools
UI improvements
Performance improvements
Security improvements
Documentation
Testing
```

Create a branch:

```bash
git checkout -b feature/my-feature
```

Commit your changes:

```bash
git add .

git commit -m "feat: add my feature"
```

Push:

```bash
git push origin feature/my-feature
```

Then open a Pull Request.

---

# ⭐ Support Atlas

If you find the project interesting:

* ⭐ Star the repository
* 🐛 Report bugs
* 💡 Suggest features
* 🔧 Submit pull requests
* 📢 Share Atlas with other developers

---

# 📜 License

Atlas Agent is released under the **Apache License 2.0**.

See the [`LICENSE`](./LICENSE) file for details.

---

<p align="center">
  <img src="https://img.shields.io/badge/BUILT%20WITH-AI%20%2B%20ENGINEERING-7C3AED?style=for-the-badge">
</p>

<p align="center">
  <strong>Atlas Agent</strong>
  <br>
  <em>A personal AI that doesn't just talk. It acts.</em>
</p>

<p align="center">
  <a href="https://github.com/varshith-dev/Atlas-Agent">
    GitHub Repository
  </a>
</p>
