# 🧭 Atlas Agent

<p align="center">
  <img src="https://img.shields.io/badge/Atlas-Agent-7C3AED?style=for-the-badge&logo=probot&logoColor=white" alt="Atlas Agent"/>
  <img src="https://img.shields.io/badge/AI%20Assistant-06B6D4?style=for-the-badge&logo=openai&logoColor=white" alt="AI Assistant"/>
  <img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge&logo=ollama&logoColor=white" alt="Ollama"/>
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React"/>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"/>
</p>

<p align="center">
  <strong>A personal AI agent that doesn't just answer — it can remember, search, schedule, communicate, create, and act.</strong>
</p>

<p align="center">
  <em>Built around local LLM inference, persistent memory, real-world integrations, and an agentic execution layer.</em>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-configuration">Configuration</a> •
  <a href="#-integrations">Integrations</a> •
  <a href="#-roadmap">Roadmap</a>
</p>

---

## 🧠 What is Atlas?

**Atlas Agent** is a personal AI assistant designed to go beyond conventional chatbot behavior.

Instead of only generating text, Atlas is designed to operate as a **personal digital agent** capable of interacting with external services, maintaining long-term context, executing tasks, generating documents, searching the web, and performing actions on behalf of its user.

At its core, Atlas combines:

* 🧠 **Local LLM inference**
* 💾 **Persistent agent memory**
* 🔎 **Web search**
* 📧 **Gmail integration**
* 📅 **Google Calendar integration**
* 💼 **LinkedIn integration**
* 🐙 **GitHub integration**
* 🎙️ **Text-to-speech infrastructure**
* 📄 **PDF / Excel / Word generation**
* ⚙️ **Background tasks**
* ⏰ **Scheduled tasks**
* 🔐 **OAuth-based integrations**
* ⚡ **Streaming AI responses**
* 🖥️ **React-based frontend**
* 🛠️ **Agent tools and deterministic execution paths**

The backend currently uses **Express + Ollama + a JSON-backed persistent store**, while the frontend is implemented using **React + Vite**.

---

# ✨ Why Atlas?

Most AI assistants stop at:

> **User → Prompt → AI → Text**

Atlas aims for:

> **User → Intent → Reasoning → Tools → Real-world action → Result**

For example:

```text
"Check my emails and tell me if anything important arrived."

             ↓

        Atlas Agent
             ↓
      Intent detection
             ↓
        Gmail Tool
             ↓
       Gmail API
             ↓
     Real email data
             ↓
     Local LLM summary
             ↓
        User response
```

Or:

```text
"Create a meeting tomorrow at 10 AM."

             ↓
        Atlas Agent
             ↓
     Extract event details
             ↓
    Google Calendar API
             ↓
      Calendar event
             ↓
       Confirmation
```

The goal is to turn the assistant from a **conversation interface** into an **action interface**.

---

# 🤖 AI DEVELOPMENT DISCLOSURE

> ### 🟣 Built with AI-assisted development
>
> Approximately **90% of the current implementation was developed with assistance from Anthropic Claude**, with the remaining work consisting of human direction, architecture decisions, testing, integration, configuration, debugging, deployment, refinement, and project-level decisions.
>
> **Claude was used as a development partner — not as the project owner.**
>
> The architecture, product direction, requirements, integration choices, deployment decisions, and final responsibility remain with the project author.

### Development philosophy

```text
        HUMAN
          │
          │ Product vision
          │ Architecture
          │ Requirements
          │ Decisions
          ▼
       ┌─────────┐
       │ CLAUDE  │
       │   AI    │
       └────┬────┘
            │
            │ Implementation
            │ Refactoring
            │ Debugging
            │ Exploration
            ▼
       ┌───────────┐
       │   ATLAS   │
       │   AGENT   │
       └───────────┘
```

This project intentionally documents its **AI-assisted development workflow** because building software with modern coding agents is itself part of the experiment.

---

# 🌟 Feature Overview

| Feature                   | Status |
| ------------------------- | :----: |
| 💬 AI Chat                |    ✅   |
| 🧠 Persistent Memory      |    ✅   |
| 📧 Gmail Reading          |    ✅   |
| 📤 Gmail Sending          |    ✅   |
| 📅 Calendar Reading       |    ✅   |
| ➕ Calendar Creation       |    ✅   |
| 🔎 Web Search             |    ✅   |
| 💼 LinkedIn Posting       |    ✅   |
| 🐙 GitHub Integration     |   🟡   |
| ⏰ Scheduled Tasks         |    ✅   |
| ⚙️ Background Tasks       |    ✅   |
| 📄 PDF Generation         |    ✅   |
| 📊 Excel Generation       |    ✅   |
| 📝 Word Generation        |    ✅   |
| 🔐 OAuth 2.0              |    ✅   |
| 🎙️ TTS Infrastructure    |   🟡   |
| 📡 Streaming Responses    |    ✅   |
| 📈 Usage Tracking         |    ✅   |
| 🗃️ Persistent JSON Store |    ✅   |
| 🖥️ React Dashboard       |    ✅   |
| 🐳 Docker Deployment      |    ✅   |
| 🌐 Nginx Deployment       |    ✅   |

---

# 🧩 Core Capabilities

## 💬 1. Natural AI Conversation

Atlas supports normal conversational interactions through a local LLM powered by **Ollama**.

The backend uses configurable models, with environment variables controlling the Ollama endpoint and default/agent models.

Example:

```text
You:
Tell me something interesting about Hyderabad.

Atlas:
...
```

Atlas can respond in the user's conversational language and is configured to support **English and Telugu**.

---

# 🧠 2. Persistent Memory

Atlas isn't intended to forget everything after a single request.

The backend maintains persistent state including:

```text
memories
messages
tasks
logs
integrations
contacts
jobs
usage
```

The current persistence layer uses a JSON file with atomic temporary-file replacement before renaming it into place.

### Example

```text
User:
Remember that I prefer concise emails.

Atlas:
Got it — I'll remember that I prefer concise emails.
```

The stored memory can subsequently become part of Atlas's system context.

---

# 📧 3. Gmail Integration

Atlas can connect to Gmail through Google's OAuth infrastructure.

Supported operations include:

* 📥 Read recent inbox messages
* 🔎 Search emails
* 📤 Send emails
* 📎 Send attachments
* 🧾 Generate email drafts
* ✏️ Revise generated drafts
* 🧠 Use stored context when drafting

The Gmail tool retrieves sender, subject, date and snippets through the Gmail API.

Example:

```text
"Show me my latest emails."

"Find emails about the hackathon."

"Draft an email to Alex about tomorrow's meeting."

"Send this email."
```

Atlas intentionally separates **drafting** from **sending** in normal interaction so an external side effect can require user approval.

---

# 📅 4. Google Calendar

Atlas can interact with Google Calendar to:

* 📆 Read upcoming events
* 🔎 Inspect schedules
* ➕ Create calendar events
* 🕐 Interpret dates and times
* 🌏 Handle Indian Standard Time for created events

Calendar event extraction is performed before the event is created, allowing Atlas to transform natural language such as:

```text
"Add project review tomorrow at 10 AM."
```

into structured event information.

The backend explicitly creates timed events using the `Asia/Kolkata` timezone.

---

# 🌐 5. Web Search

Atlas includes a lightweight web-search tool using **DuckDuckGo HTML results**.

No dedicated search API key is required for this implementation.

The search pipeline:

```text
User question
      ↓
Intent detection
      ↓
Search query
      ↓
DuckDuckGo
      ↓
HTML extraction
      ↓
Title + URL + domain + snippet
      ↓
Atlas
      ↓
Grounded response
```

The tool extracts result titles, URLs, domains and snippets before passing the retrieved context into the response-generation stage.

Example:

```text
"Search the web for the latest React release."

"What's happening in AI today?"

"Look up the current price of ..."
```

---

# 💼 6. LinkedIn Automation

Atlas can generate and publish LinkedIn posts.

The workflow is:

```text
Idea
 ↓
Atlas
 ↓
Generate post
 ↓
Review / Proceed
 ↓
LinkedIn API
 ↓
Published post
```

The implementation creates a LinkedIn post through the LinkedIn API and returns the resulting post URL when available.

Atlas can also revise a previously generated post before publishing.

---

# 📄 7. Document Generation

Atlas includes a document rendering layer capable of converting generated Markdown-like content into:

### 📕 PDF

Powered by:

```text
PDFKit
```

### 📊 Excel

Powered by:

```text
ExcelJS
```

### 📝 Word

Powered by:

```text
docx
```

The document renderer supports headings, lists, tables and basic Markdown formatting.

Example:

```text
"Create a PDF report about this project."

"Turn this data into an Excel spreadsheet."

"Generate a Word document from this report."
```

---

# ⏰ 8. Scheduled Tasks

Atlas can interpret scheduling language such as:

```text
"Every morning at 8."

"Every day at 6 PM."

"Remind me about this every morning."
```

The backend converts the request into a persistent task and calculates its next execution time.

Tasks can survive application restarts because their state is persisted.

---

# ⚙️ 9. Background Tasks

Atlas can queue work for background execution.

Examples:

```text
"Do this in the background."

"Work on this when you get time."

"Take your time and finish this later."
```

The backend stores the task as a job and begins processing it asynchronously.

This allows the user to leave the browser while Atlas continues processing.

---

# 🔐 10. OAuth Integrations

Atlas contains a configuration-driven OAuth authorization layer.

Currently represented providers include:

| Provider    | OAuth |
| ----------- | :---: |
| 🐙 GitHub   |   ✅   |
| 🔵 Google   |   ✅   |
| 💼 LinkedIn |   ✅   |

Google OAuth scopes are separately configured for:

* Gmail
* Calendar
* Google Meet

GitHub and LinkedIn have their own configured OAuth scopes.

OAuth states are generated dynamically and expire after a short period.

---

# 🎙️ 11. Voice / TTS Infrastructure

The repository contains a dedicated `tts/` directory with Piper-related assets and voice configuration files, including:

```text
tts/
├── piper/
├── piper.tgz
├── en_US-amy-medium.onnx.json
└── te_IN-padmavathi-medium.onnx.json
```

This provides infrastructure for English and Telugu speech generation.

---

# 📊 12. Usage Tracking

Atlas tracks basic usage information including:

```json
{
  "requests": 0,
  "tokens": 0,
  "chats": 0,
  "since": "..."
}
```

Usage counters are updated during AI interactions and persisted with the rest of the application state.

---

# 🏗️ Architecture

Atlas is structured as a multi-layer application:

```text
                         ┌─────────────────────┐
                         │       USER          │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   React Frontend    │
                         │      + Vite         │
                         └──────────┬──────────┘
                                    │
                             HTTP / SSE
                                    │
                                    ▼
                    ┌─────────────────────────────┐
                    │       Express Backend      │
                    │                             │
                    │  ┌───────────────────────┐  │
                    │  │    Agent Controller    │  │
                    │  └───────────┬───────────┘  │
                    │              │              │
                    │      ┌───────┴────────┐     │
                    │      ▼                ▼     │
                    │   AI / Ollama       Tools   │
                    │                        │     │
                    └────────────────────────┼─────┘
                                             │
              ┌──────────────┬───────────────┼──────────────┐
              ▼              ▼               ▼              ▼
          🧠 Memory       📧 Gmail        📅 Calendar    🌐 Web
              │              │               │              │
              └──────────────┴───────────────┴──────────────┘
                                             │
                                             ▼
                                     External Services
```

---

# 🔬 Agent Execution Model

Atlas uses a hybrid strategy instead of relying entirely on an LLM to decide every action.

### Fast path

For ordinary conversation:

```text
User
 ↓
Intent detection
 ↓
Local Ollama
 ↓
Streaming response
```

### Tool path

For requests involving real-world data:

```text
User
 ↓
Intent detection
 ↓
Required tool identified
 ↓
Tool execution
 ↓
Real data collected
 ↓
LLM receives grounded context
 ↓
Streaming response
```

The backend explicitly checks for calendar, email and web-search intents before executing the corresponding tools, which helps avoid making a small local model responsible for every tool-selection decision.

---

# 🛠️ Tool Architecture

Atlas maintains a centralized tool registry.

Current tool categories include:

```text
TOOLS
│
├── 📧 read_recent_emails
│
├── 🔎 search_emails
│
└── 📅 list_calendar_events
```

Write operations are exposed separately through backend functions such as:

```text
gmailSend()
calendarCreate()
linkedinPost()
```

This creates a useful separation between:

```text
READ
 ↓
Safe autonomous retrieval

WRITE
 ↓
Potential side effect
 ↓
User approval / Auto mode
```

The project explicitly distinguishes read-only tools from side-effecting operations.

---

# ⚡ Streaming Responses

Atlas uses **Server-Sent Events (SSE)** for chat responses.

The client receives incremental events such as:

```text
step
token
action
attachments
done
```

Conceptually:

```text
Backend
   │
   ├── step: Thinking
   │
   ├── token: Hello
   │
   ├── token: there
   │
   ├── token: ...
   │
   ├── action: ...
   │
   └── done: true
```

This allows the frontend to display progress and generated content without waiting for the entire response.

The `/api/chat` endpoint configures the response as `text/event-stream`.

---

# 🖥️ Frontend

The frontend is built with:

* ⚛️ React 18
* ⚡ Vite
* 🎨 CSS
* 🧩 Phosphor Icons

The current React application is divided into major UI components including:

```text
src/
├── App.jsx
├── App.css
├── index.css
├── main.jsx
└── components/
```

The primary application currently switches between:

```text
💬 Chat
🔌 Integrations
```

through the main application shell.

---

# 📁 Project Structure

```text
Atlas-Agent/
│
├── backend/
│   ├── data/
│   │   └── ... persistent application data
│   │
│   ├── docs.js
│   ├── oauth.js
│   ├── package.json
│   ├── package-lock.json
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
│   │   ├── index.html
│   │   ├── package.json
│   │   └── vite.config.js
│   │
│   ├── nginx/
│   ├── compose.yaml
│   ├── deploy_frontend.sh
│   ├── frontend_components.sh
│   ├── frontend_init.sh
│   ├── setup.sh
│   └── setup_ssl.sh
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

The repository currently contains separate backend, frontend, TTS and deployment infrastructure.

---

# 🧰 Technology Stack

## Backend

| Technology             | Purpose                      |
| ---------------------- | ---------------------------- |
| 🟢 Node.js             | Runtime                      |
| 🚂 Express             | HTTP API                     |
| 🧠 Ollama              | Local LLM inference          |
| 🔐 OAuth 2.0           | Service authentication       |
| 📧 Gmail API           | Email                        |
| 📅 Google Calendar API | Scheduling                   |
| 💼 LinkedIn API        | Social publishing            |
| 🌐 DuckDuckGo HTML     | Web search                   |
| 💾 JSON                | Persistent application state |
| 📕 PDFKit              | PDF generation               |
| 📊 ExcelJS             | Excel generation             |
| 📝 docx                | Word generation              |

The backend package currently declares Express, CORS, PDFKit, ExcelJS and docx as its primary dependencies.

## Frontend

| Technology        | Purpose                   |
| ----------------- | ------------------------- |
| ⚛️ React 18       | UI                        |
| ⚡ Vite            | Development/build tooling |
| 🎨 CSS            | Interface styling         |
| 🎯 Phosphor Icons | UI icons                  |

## Infrastructure

```text
🐳 Docker
🌐 Nginx
🐧 Ubuntu/Linux
🟢 Node.js 20
🔵 Go
🧠 Ollama
```

The VM setup script installs Docker/Compose, Go and Node.js 20 on Ubuntu-based environments.

---

# 🚀 Quick Start

## 1️⃣ Clone

```bash
git clone https://github.com/varshith-dev/Atlas-Agent.git

cd Atlas-Agent
```

---

# 2️⃣ Install Backend

```bash
cd backend

npm install
```

The backend exposes a simple start command:

```bash
npm start
```

The backend package defines `node server.js` as its production/start command.

---

# 3️⃣ Install Frontend

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

The frontend uses Vite's standard development, build and preview scripts.

---

# 4️⃣ Install Ollama

Install Ollama on the machine running Atlas.

Then pull a compatible model.

For example:

```bash
ollama pull phi3
```

You can also configure a separate agent model through:

```bash
AGENT_MODEL=qwen2.5:3b
```

Atlas currently defaults to:

```text
OLLAMA_URL
http://127.0.0.1:11434

DEFAULT_MODEL
phi3

AGENT_MODEL
qwen2.5:3b
```

These values are configurable through environment variables.

---

# 🔐 Configuration

Create a `.env` file in the backend environment.

Example:

```env
PORT=8080

OLLAMA_URL=http://127.0.0.1:11434

DEFAULT_MODEL=phi3
AGENT_MODEL=qwen2.5:3b

APP_BASE=https://your-domain.example

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

NOTIFY_EMAIL=your_email@example.com
```

> ⚠️ **Never commit `.env` or OAuth secrets to Git.**

---

# 🔌 Integrations

Atlas currently models integrations such as:

```text
┌─────────────────────────────┐
│       ATLAS INTEGRATIONS    │
├─────────────────────────────┤
│ 🟦 Google Workspace         │
│ 📧 Gmail                    │
│ 📅 Google Calendar          │
│ 🐙 GitHub                   │
│ 🎥 Google Meet              │
│ 💼 LinkedIn                 │
└─────────────────────────────┘
```

These integration states are represented in the persistent backend store.

---

# 🔐 OAuth Flow

Atlas follows a standard authorization-code flow.

```text
┌────────┐
│  User  │
└───┬────┘
    │
    ▼
Atlas /authorize
    │
    ▼
Provider OAuth
    │
    │ User approves
    ▼
Callback
    │
    ▼
Authorization code
    │
    ▼
Token exchange
    │
    ▼
Access token
    │
    ▼
Stored integration
```

OAuth state values are generated for authorization requests and cleaned up after expiration.

---

# 🧪 Health Check

The backend exposes:

```http
GET /api/health
```

Example:

```bash
curl http://localhost:8080/api/health
```

The health endpoint reports:

* service status
* configured model
* available Ollama models
* Ollama availability
* uptime

---

# 🔗 API Overview

## Health

```http
GET /api/health
```

## Models

```http
GET /api/models
```

## Memory

```http
GET    /api/memory
POST   /api/memory
DELETE /api/memory/:id
```

## Contacts

```http
GET    /api/contacts
DELETE /api/contacts/:name
```

## Conversation

```http
GET    /api/history
DELETE /api/history
```

## Chat

```http
POST /api/chat
```

The chat endpoint accepts the user's message and optional model/mode parameters and streams results using SSE.

---

# 🧠 Example Agent Requests

Atlas is designed around natural language rather than command-heavy interfaces.

### 💬 Conversation

```text
Tell me a joke.
```

### 🧠 Memory

```text
Remember that my favorite editor is VS Code.
```

### 📧 Email

```text
Show me my latest emails.
```

```text
Find emails about the GitHub event.
```

```text
Draft an email to Alex about the meeting.
```

### 📅 Calendar

```text
What's on my calendar this week?
```

```text
Add a project meeting tomorrow at 10 AM.
```

### 🌐 Web

```text
Search the web for the latest AI news.
```

### 💼 LinkedIn

```text
Write a LinkedIn post about launching Atlas.
```

### ⚙️ Background work

```text
Work on this in the background.
```

### ⏰ Scheduled work

```text
Do this every morning at 8.
```

---

# 🛡️ Safety & Action Model

Atlas differentiates between:

### 🟢 Read operations

These can generally be performed automatically:

```text
📧 Read email
🔎 Search email
📅 Read calendar
🌐 Search web
```

### 🟠 Write operations

These can create external side effects:

```text
📤 Send email
📅 Create calendar event
💼 Publish LinkedIn post
```

The application supports an `auto` mode for automated execution, while normal interaction can attach an action to the response for user approval.

This distinction is important because:

> **Generating an action is not the same thing as executing an action.**

---

# 🗃️ Persistence Model

The current storage layer is intentionally lightweight.

```text
backend/data/store.json
```

Conceptually:

```json
{
  "memories": [],
  "messages": [],
  "tasks": [],
  "logs": [],
  "integrations": [],
  "keys": [],
  "contacts": [],
  "jobs": [],
  "usage": {}
}
```

The store performs synchronous writes and uses a temporary file followed by a rename operation to replace the main store.

### Future scaling path

For a larger deployment, the current JSON persistence layer could evolve into:

```text
JSON
 ↓
SQLite
 ↓
PostgreSQL
 ↓
Vector / semantic memory
```

---

# 🐳 Deployment

Atlas includes infrastructure for containerized and VM-based deployment.

The repository contains:

```text
Docker
Docker Compose
Nginx
SSL setup
Frontend deployment scripts
VM setup script
```

The VM bootstrap script prepares Ubuntu with Docker Engine/Compose, Go and Node.js 20.

A typical production architecture can look like:

```text
                    INTERNET
                       │
                       ▼
                 ┌───────────┐
                 │   NGINX   │
                 │ SSL / TLS │
                 └─────┬─────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
        React Frontend     Express API
                              │
                 ┌────────────┼─────────────┐
                 ▼            ▼             ▼
              Ollama       JSON Store    External APIs
```

---

# 📈 Current Architecture Characteristics

### ⚡ Local-first AI

LLM inference can run locally through Ollama instead of requiring every conversation to be sent to a hosted AI provider.

### 🧠 Stateful

Atlas maintains persistent memory, conversations, contacts, jobs and integration states.

### 🔌 Extensible

The tool registry makes it possible to add new capabilities without rewriting the entire agent.

### 🌐 Connected

Atlas can bridge a local AI model with real-world APIs.

### 🧩 Modular

Frontend, backend, TTS and infrastructure are separated into distinct areas.

---

# 🗺️ Roadmap

Atlas is an evolving project.

## 🟢 Current

* [x] Local LLM integration
* [x] Agent memory
* [x] Chat streaming
* [x] Gmail
* [x] Google Calendar
* [x] LinkedIn
* [x] Web search
* [x] Scheduled tasks
* [x] Background jobs
* [x] PDF generation
* [x] Excel generation
* [x] Word generation
* [x] OAuth infrastructure
* [x] React frontend
* [x] Docker/Nginx deployment infrastructure
* [x] English/Telugu TTS assets

## 🟡 In Progress

* [ ] More agent tools
* [ ] Improved task orchestration
* [ ] Better long-term memory
* [ ] More robust authentication
* [ ] Expanded voice interaction
* [ ] More integrations
* [ ] Better autonomous planning
* [ ] Improved observability

## 🔵 Future

```text
🧠 Semantic memory
🕸️ Knowledge graph
🤖 Multi-agent workflows
🎙️ Full voice conversation
📱 Mobile client
🖥️ Desktop client
🔐 Fine-grained permissions
📊 Advanced analytics
🧪 Agent evaluation framework
🧰 Plugin / skill system
🔄 More autonomous workflows
```

---

# 🧪 Development Philosophy

Atlas is not intended to be just another chatbot UI.

The project explores a larger question:

> **What happens when a local AI model is given persistent context, tools, integrations and the ability to execute real-world tasks?**

The architecture therefore treats the LLM as one component inside a larger system:

```text
             ┌────────────────────┐
             │       USER         │
             └─────────┬──────────┘
                       │
                       ▼
             ┌────────────────────┐
             │       ATLAS        │
             │    Agent Layer     │
             └─────────┬──────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
       Memory        Tools        Model
          │            │            │
          │      ┌─────┼─────┐      │
          │      │     │     │      │
          ▼      ▼     ▼     ▼      ▼
       Context   Gmail Calendar Web Ollama
```

---

# 🔍 Design Principles

### 1. 🧠 Context before action

The assistant should understand the user's request and available context before executing an operation.

### 2. 🔐 Side effects deserve attention

Reading information and changing the outside world are different operations.

### 3. ⚡ Fast responses matter

Streaming allows the interface to feel responsive while the model is still generating.

### 4. 🏠 Local inference matters

Ollama allows Atlas to operate around locally hosted models.

### 5. 🧩 Tools should be replaceable

Individual capabilities should be independent enough to evolve without replacing the entire agent.

### 6. 📦 Keep infrastructure practical

The project aims to remain deployable on relatively modest infrastructure rather than assuming a massive GPU cluster.

---

# 🤝 Contributing

Contributions are welcome.

A useful contribution could be:

```text
🐛 Bug fix
✨ New tool
🔌 New integration
🧠 Memory improvement
🎨 UI improvement
⚡ Performance optimization
🔐 Security improvement
📚 Documentation
🧪 Tests
```

## Development flow

```bash
git checkout -b feature/my-feature

# make your changes

git add .

git commit -m "feat: add my feature"

git push origin feature/my-feature
```

Then open a pull request.

---

# 🔒 Security

Atlas interacts with services that may contain highly sensitive personal information.

Before deploying:

* 🔑 Never commit OAuth secrets
* 🔑 Never expose access tokens
* 🔐 Use HTTPS in production
* 🛡️ Restrict backend access
* 🧹 Avoid logging sensitive content
* 📁 Protect persistent storage
* 👤 Use least-privilege OAuth scopes where possible
* 🧪 Test integrations in a development account first

**Do not run an internet-facing instance with development credentials or unrestricted access.**

---

# ⚠️ Current Limitations

Atlas is an actively developed project and should not be treated as a finished enterprise platform.

Current architectural limitations include:

* JSON-based persistence is better suited to a single-user / low-volume environment.
* Some integrations depend on provider OAuth configuration.
* Local model quality depends heavily on the selected Ollama model and available hardware.
* Web search currently relies on HTML extraction from DuckDuckGo.
* Some capabilities are implemented more deeply than others.
* Autonomous actions should be used carefully.
* Production deployments require proper authentication, HTTPS and infrastructure hardening.

The current storage implementation itself describes the JSON approach as appropriate for a single user / low-volume scenario, with SQLite/PostgreSQL suggested as a future upgrade path.

---

# 📊 Project at a Glance

```text
╔══════════════════════════════════════════════════════╗
║                    ATLAS AGENT                      ║
╠══════════════════════════════════════════════════════╣
║                                                      ║
║   🧠 Local AI          💾 Persistent Memory          ║
║                                                      ║
║   📧 Gmail             📅 Calendar                  ║
║                                                      ║
║   🌐 Web Search        💼 LinkedIn                  ║
║                                                      ║
║   ⚙️ Background Jobs   ⏰ Scheduling                 ║
║                                                      ║
║   📕 PDF               📊 Excel                     ║
║                                                      ║
║   📝 Word              🎙️ TTS                       ║
║                                                      ║
║   🔐 OAuth             🐳 Deployment                 ║
║                                                      ║
╚══════════════════════════════════════════════════════╝
```

---

# 🧑‍💻 Author

**Varshith**

Atlas Agent is an independent project exploring practical, tool-enabled personal AI.

The project combines:

```text
Human product direction
        +
AI-assisted software development
        +
Local LLM inference
        +
Real-world APIs
        +
Agentic workflows
        =
Atlas Agent
```

---

# 🤖 AI-Assisted Development

### Approximately 90% Claude-assisted

A significant portion of Atlas was developed using **Anthropic Claude as an AI coding partner**.

Claude was used extensively for:

* 🧱 Initial implementation
* 🧩 Component development
* 🔧 Backend development
* 🐛 Debugging
* ♻️ Refactoring
* 🧪 Problem solving
* 📚 Documentation
* ⚙️ Deployment scripting
* 🔌 Integration work

Human involvement remained central to:

* Product vision
* Architecture direction
* Feature requirements
* Integration decisions
* Testing
* Deployment
* Review
* Iteration
* Final acceptance

> **Atlas is therefore also an experiment in AI-assisted software engineering — exploring how far a developer can push a complex software project by treating an AI model as an active engineering collaborator.**

---

# ⭐ Support the Project

If you find Atlas interesting:

```text
⭐ Star the repository
🐛 Open an issue
💡 Suggest a feature
🔧 Submit a PR
📢 Share the project
```

Every contribution helps Atlas become more capable.

---

# 📜 License

This project is distributed under the license included in the repository.

See:

```text
LICENSE
```

---

<p align="center">

### 🧭 Atlas Agent

<strong>Remember more. Connect more. Do more.</strong>

<br/>

<em>Built with humans, AI, code, and a lot of experimentation.</em>

<br/><br/>

🧠 • 🔌 • ⚡ • 🛠️ • 🚀

</p>
