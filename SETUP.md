# 🦀 OpenCrabShell — Full Setup Guide

> **From zero to a running shell on your own VPS.**

---

## 1. Prerequisites

| Requirement | Version | Why |
|---|---|---|
| **Node.js** | 18+ | Runtime for both build and server |
| **npm** | 9+ | Package manager |
| **VPS** | Ubuntu 22+ / Debian 12+ | Production host |
| **Gemini API Key** | — | AI engine ([get one free](https://aistudio.google.com/apikey)) |

Optional: `puppeteer` for headless browser features (BrowserPilot).

---

## 2. Local Development

```bash
# Clone the repo
git clone https://github.com/your-org/opencrabshell.git
cd opencrabshell

# Install dependencies
npm install

# Create your .env from template
cp .env.example .env
# Edit .env → set API_KEY at minimum

# Start dev server (hot-reload)
npm run dev
```

The app runs at `http://localhost:5173`. Without a VPS backend, it works in **Local Simulation Mode** — all data lives in your browser's localStorage.

---

## 3. Build for Production

```bash
# Inject your API key and build
API_KEY=your-api-key-here npx vite build
```

**Windows PowerShell:**
```powershell
$env:API_KEY="your-api-key-here"; npx vite build
```

This creates a `dist/` folder with the optimized frontend.

---

## 4. VPS Deployment (from scratch)

### 4a. Prepare the VPS

```bash
# SSH into your VPS
ssh root@YOUR_VPS_IP

# Update packages
apt update && apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install pm2 (process manager)
npm install -g pm2

# Create app directory
mkdir -p /opt/opencrabshell
cd /opt/opencrabshell
```

### 4b. Upload Your Build

From your **local machine**, upload the built files:

```bash
# Upload the dist folder (built frontend)
scp -r dist root@YOUR_VPS_IP:/opt/opencrabshell/

# Upload the server
scp server.js package.json root@YOUR_VPS_IP:/opt/opencrabshell/
```

### 4c. Install Server Dependencies

```bash
# On the VPS
cd /opt/opencrabshell

# Install only what the server needs
npm install ws

# Optional: for BrowserPilot (headless Chrome)
npm install puppeteer
```

### 4d. Start the Server

```bash
# Start with pm2
pm2 start server.js --name opencrabshell

# Save pm2 config so it restarts on reboot
pm2 save
pm2 startup
```

The server is now running:
- **HTTP** → port `8080` (serves the frontend)
- **WebSocket** → port `18789` (vault + BrowserPilot bridge)

### 4e. Open Firewall Ports

```bash
# Allow HTTP traffic
ufw allow 8080/tcp

# Allow WebSocket traffic  
ufw allow 18789/tcp

# If using a reverse proxy (recommended), only open 80/443 instead:
ufw allow 80/tcp
ufw allow 443/tcp
```

---

## 5. Connect Your Frontend to the VPS

The frontend auto-discovers the VPS using the browser's hostname. If the frontend is served from the VPS itself (recommended), it connects automatically.

If running the frontend separately, set the gateway host in the Settings → Keys panel inside the app, or via `localStorage`:

```js
localStorage.setItem('claw_gateway_host', 'ws://YOUR_VPS_IP:18789');
location.reload();
```

---

## 6. Reverse Proxy (Optional but Recommended)

### With Nginx

```nginx
server {
    listen 80;
    server_name shell.yourdomain.com;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### With Traefik

An `opencrabshell.yml` is included in the repo for Traefik-based deployments. Edit `DEPLOY_HOST` in `.env` and place the config in your Traefik directory.

### SSL with Certbot

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d shell.yourdomain.com
```

---

## 7. Updating

When you make changes locally:

```bash
# 1. Rebuild
API_KEY=your-key npx vite build

# 2. Upload new dist
scp -r dist root@YOUR_VPS_IP:/opt/opencrabshell/

# 3. Restart (only needed if server.js changed)
ssh root@YOUR_VPS_IP "pm2 restart opencrabshell"
```

---

## 8. Server Architecture

```
server.js (Node.js)
├── HTTP Server (port 8080)
│   └── Serves dist/ as SPA (index.html fallback)
├── WebSocket Server (port 18789)
│   ├── AUTH          → Client handshake
│   ├── PING/PONG    → Heartbeat
│   ├── WRITE_FILE   → Save files to vault_data/
│   ├── READ_FILE    → Read files from vault_data/
│   ├── SYNC_VAULT   → Full vault index
│   └── BROWSER_*    → BrowserPilot commands
└── vault_data/      → Persistent file storage
    ├── DOCUMENTS/
    ├── CONTRACTS/
    └── ...
```

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `Frontend not built` at port 8080 | Run `npx vite build` and upload `dist/` |
| WebSocket won't connect | Check firewall: `ufw allow 18789/tcp` |
| `Local Mode` in the sidebar | VPS not reachable — check IP and ports |
| BrowserPilot disabled | Install puppeteer: `npm install puppeteer` |
| pm2 not restarting on reboot | Run `pm2 startup` and `pm2 save` |

---

## 10. What Each File Does

| File | Role |
|---|---|
| `server.js` | VPS backend — HTTP + WebSocket + BrowserPilot |
| `App.tsx` | Main React shell |
| `personas.ts` | 5 persona presets (Assistant, Trader, Business, Household, Custom) |
| `soul.md` | AI personality definition |
| `skill.md` | AI tool/capability manifest |
| `.env.example` | Environment variable template |
| `opencrabshell.yml` | Traefik deploy config |
