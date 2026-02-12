# 🦀 OpenCrabShell

An open-source, AI-powered autonomous business operating system. Run your own intelligent business shell with payroll, contracts, email sentinel, knowledge vault, and more — all driven by a configurable AI agent.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your API keys and hosts

# 3. Run development server
npm run dev
```

## Configuration

All configuration is done via environment variables. See [`.env.example`](.env.example) for the full list:

| Variable | Purpose |
|---|---|
| `API_KEY` | Google Gemini API key for AI features |
| `VITE_API_HOST` | Your backend API base URL |
| `GATEWAY_TOKEN` | Handshake token for VPS gateway |
| `SENTINEL_EMAIL` | Bot email for outbound comms |
| `DEPLOY_HOST` | Your domain for Traefik routing |

## Architecture

```
OpenCrabShell/
├── App.tsx              # Main application shell
├── components/          # React UI components
├── services/            # API, AI, gateway, and agent services
├── soul.md              # AI persona definition
├── skill.md             # AI capability manifest
├── opencrabshell.yml    # Traefik deploy config
└── .env.example         # Environment template
```

## Features

- 🤖 **AI Agent** — Autonomous assistant with persistent memory and RAG search
- 📊 **Payroll** — Employee management and PDF pay stub generation
- 📝 **Contracts** — Document vault with AI-powered analysis
- 📧 **Email Sentinel** — Automated email monitoring and response
- 🔒 **Secrets Manager** — Secure credential storage and `.env` generation
- 📅 **Calendar** — Smart scheduling with commitment tracking
- 🌐 **Browser Pilot** — AI-controlled web browsing and scraping
- 💬 **Agent Chat** — Multi-agent squad coordination

## License

Open source. See LICENSE for details.
