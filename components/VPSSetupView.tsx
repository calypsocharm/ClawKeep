
import React, { useState } from 'react';
import {
    Server, Globe, Terminal, Shield, Copy, Check, ChevronRight,
    ExternalLink, Cpu, HardDrive, Wifi, Lock, Rocket, Package,
    ArrowRight, AlertTriangle, CheckCircle2, Zap, BookOpen, Cloud
} from 'lucide-react';

type SetupStep = 'why' | 'provider' | 'prepare' | 'upload' | 'launch' | 'connect' | 'ssl' | 'update';

interface StepConfig {
    id: SetupStep;
    label: string;
    icon: React.ElementType;
    color: string;
}

const STEPS: StepConfig[] = [
    { id: 'why', label: 'Why a VPS?', icon: BookOpen, color: 'cyan' },
    { id: 'provider', label: 'Get a VPS', icon: Cloud, color: 'violet' },
    { id: 'prepare', label: 'Prepare VPS', icon: Terminal, color: 'amber' },
    { id: 'upload', label: 'Upload Code', icon: Package, color: 'emerald' },
    { id: 'launch', label: 'Launch Server', icon: Rocket, color: 'rose' },
    { id: 'connect', label: 'Connect Frontend', icon: Wifi, color: 'cyan' },
    { id: 'ssl', label: 'SSL & Domain', icon: Lock, color: 'indigo' },
    { id: 'update', label: 'Updates', icon: Zap, color: 'amber' },
];

const CopyBlock: React.FC<{ code: string; label?: string }> = ({ code, label }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="my-3">
            {label && <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest mb-1 block">{label}</span>}
            <div className="relative group bg-black/60 border border-white/10 rounded-xl p-4 font-mono text-xs text-emerald-400/90 overflow-x-auto">
                <pre className="whitespace-pre-wrap break-all leading-relaxed">{code}</pre>
                <button
                    onClick={handleCopy}
                    className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all opacity-0 group-hover:opacity-100"
                >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-white/40" />}
                </button>
            </div>
        </div>
    );
};

const CalloutBox: React.FC<{ type: 'info' | 'warning' | 'success'; children: React.ReactNode }> = ({ type, children }) => {
    const styles = {
        info: 'bg-cyan-500/5 border-cyan-500/20 text-cyan-400',
        warning: 'bg-amber-500/5 border-amber-500/20 text-amber-400',
        success: 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400',
    };
    const icons = {
        info: <Globe className="w-4 h-4 shrink-0 mt-0.5" />,
        warning: <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />,
        success: <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />,
    };
    return (
        <div className={`p-4 rounded-xl border flex gap-3 my-4 ${styles[type]}`}>
            {icons[type]}
            <div className="text-xs leading-relaxed font-mono">{children}</div>
        </div>
    );
};

const VPSSetupView: React.FC = () => {
    const [activeStep, setActiveStep] = useState<SetupStep>('why');

    const renderStepContent = () => {
        switch (activeStep) {
            case 'why':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">Why Do You Need a VPS?</h2>
                        <p className="text-white/60 text-sm leading-relaxed font-mono">
                            OpenCrabShell runs as a web app in your browser. But it needs a <strong className="text-white">backend server</strong> to unlock the full power:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { icon: HardDrive, title: 'Persistent Storage', desc: 'Without a VPS, all your data lives in browser localStorage — which can be wiped. A VPS stores your files permanently in vault_data/.' },
                                { icon: Globe, title: 'Live Browser (BrowserPilot)', desc: 'The AI needs a real headless Chrome browser on the server to scrape websites, navigate pages, and extract data for you.' },
                                { icon: Wifi, title: 'Access From Anywhere', desc: 'Host your shell on a VPS with a domain and access it from any device — phone, tablet, work computer.' },
                                { icon: Cpu, title: 'Trading Bots & Agents', desc: 'Your bots need a 24/7 server to run tasks, monitor markets, scrape news, and send alerts even when your laptop is off.' },
                            ].map((item, i) => (
                                <div key={i} className="p-5 bg-white/[0.03] border border-white/10 rounded-2xl">
                                    <item.icon className="w-6 h-6 text-cyan-400 mb-3" />
                                    <h4 className="text-sm font-bold text-white mb-2">{item.title}</h4>
                                    <p className="text-[11px] text-white/40 leading-relaxed font-mono">{item.desc}</p>
                                </div>
                            ))}
                        </div>

                        <CalloutBox type="info">
                            <strong>Without a VPS:</strong> OpenCrabShell runs in "Local Simulation Mode" — everything is in localStorage, no BrowserPilot, no persistent vault, no remote access. It works, but it's limited.
                        </CalloutBox>

                        <h3 className="text-lg font-bold text-white mt-8">Architecture Overview</h3>
                        <div className="p-5 bg-black/40 border border-white/10 rounded-2xl font-mono text-xs text-white/60 leading-loose">
                            <pre>{`┌─── YOUR DEVICE ────────────────┐
│  Browser → OpenCrabShell UI    │
│  (React app, runs locally)     │
└────────┬───────────────────────┘
         │  WebSocket (port 18789)
         ▼
┌─── YOUR VPS ───────────────────┐
│  server.js (Node.js)           │
│  ├── HTTP (port 8080)          │
│  │   └── Serves dist/ frontend │
│  ├── WebSocket (port 18789)    │
│  │   ├── WRITE_FILE / READ     │
│  │   ├── SYNC_VAULT            │
│  │   └── BROWSER_* commands    │
│  ├── BrowserPilot (Puppeteer)  │
│  │   └── Headless Chrome       │
│  └── vault_data/               │
│      ├── DOCUMENTS/            │
│      ├── CONTRACTS/            │
│      └── downloads/            │
└────────────────────────────────┘`}</pre>
                        </div>

                        <CalloutBox type="success">
                            <strong>Total cost:</strong> A VPS starts at ~$5/month. Hostinger's VPS KVM 1 plan is roughly $5-7/mo and is more than enough to run OpenCrabShell with BrowserPilot.
                        </CalloutBox>
                    </div>
                );

            case 'provider':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">Get a VPS — We Recommend Hostinger</h2>
                        <p className="text-white/60 text-sm leading-relaxed font-mono">
                            You need a Linux VPS with root access. We recommend <strong className="text-violet-400">Hostinger</strong> for the best price-to-performance ratio.
                        </p>

                        <div className="p-6 bg-violet-500/5 border border-violet-500/20 rounded-2xl">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 bg-violet-500/10 rounded-2xl flex items-center justify-center border border-violet-500/20">
                                    <Cloud className="w-6 h-6 text-violet-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Hostinger VPS KVM 1</h4>
                                    <span className="text-[10px] text-violet-400 font-mono">Recommended — Best Value</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                {[
                                    { label: 'RAM', value: '4 GB' },
                                    { label: 'CPU', value: '1 vCPU' },
                                    { label: 'Storage', value: '50 GB NVMe' },
                                    { label: 'Price', value: '~$5-7/mo' },
                                ].map((s, i) => (
                                    <div key={i} className="p-3 bg-black/40 rounded-xl text-center">
                                        <div className="text-lg font-bold text-white">{s.value}</div>
                                        <div className="text-[8px] text-white/30 uppercase tracking-widest font-bold">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                            <a
                                href="https://www.hostinger.com/vps-hosting"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all"
                            >
                                Get Hostinger VPS <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>

                        <h3 className="text-lg font-bold text-white">Setup Steps on Hostinger</h3>
                        <ol className="space-y-3 text-sm text-white/60 font-mono leading-relaxed">
                            <li className="flex gap-3"><span className="text-violet-400 font-bold shrink-0">1.</span> Sign up at hostinger.com and purchase a <strong className="text-white">VPS KVM 1</strong> (or higher) plan.</li>
                            <li className="flex gap-3"><span className="text-violet-400 font-bold shrink-0">2.</span> Choose <strong className="text-white">Ubuntu 22.04</strong> as your operating system (recommended).</li>
                            <li className="flex gap-3"><span className="text-violet-400 font-bold shrink-0">3.</span> Set a <strong className="text-white">root password</strong> — you'll need this to SSH in.</li>
                            <li className="flex gap-3"><span className="text-violet-400 font-bold shrink-0">4.</span> Note your VPS <strong className="text-white">IP address</strong> from the Hostinger dashboard — this is your server.</li>
                            <li className="flex gap-3"><span className="text-violet-400 font-bold shrink-0">5.</span> Proceed to the next step to prepare your VPS.</li>
                        </ol>

                        <CalloutBox type="info">
                            <strong>Other providers that work:</strong> DigitalOcean, Linode (Akamai), Vultr, Hetzner, or any VPS with Ubuntu/Debian and root SSH access. The setup steps below work on all of them.
                        </CalloutBox>
                    </div>
                );

            case 'prepare':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">Prepare Your VPS</h2>
                        <p className="text-white/60 text-sm leading-relaxed font-mono">
                            SSH into your VPS and install the required software. All commands are copy-paste ready.
                        </p>

                        <h3 className="text-base font-bold text-white">Step 1: SSH Into Your Server</h3>
                        <p className="text-xs text-white/40 font-mono">Open Terminal (Mac/Linux) or PowerShell (Windows) and run:</p>
                        <CopyBlock code="ssh root@72.62.129.226" label="Replace 72.62.129.226 with your actual IP" />
                        <p className="text-xs text-white/30 font-mono italic">Enter the root password you set during VPS creation.</p>

                        <h3 className="text-base font-bold text-white mt-6">Step 2: Update & Install Node.js</h3>
                        <CopyBlock code={`# Update system packages
apt update && apt upgrade -y

# Install Node.js 18+ (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installation
node -v    # Should show v18.x or higher
npm -v     # Should show 9.x or higher`} />

                        <h3 className="text-base font-bold text-white mt-6">Step 3: Install PM2 (Process Manager)</h3>
                        <p className="text-xs text-white/40 font-mono">PM2 keeps your server running 24/7 and auto-restarts it if it crashes or the VPS reboots.</p>
                        <CopyBlock code={`# Install PM2 globally
npm install -g pm2`} />

                        <h3 className="text-base font-bold text-white mt-6">Step 4: Create Your App Directory</h3>
                        <CopyBlock code={`# Create the directory where OpenCrabShell will live
mkdir -p /opt/opencrabshell
cd /opt/opencrabshell`} />

                        <h3 className="text-base font-bold text-white mt-6">Step 5: Open Firewall Ports</h3>
                        <CopyBlock code={`# Allow the HTTP server (frontend)
ufw allow 8080/tcp

# Allow the WebSocket server (gateway bridge)
ufw allow 18789/tcp

# If you plan to use a domain with SSL later:
ufw allow 80/tcp
ufw allow 443/tcp

# Enable the firewall
ufw enable`} />

                        <CalloutBox type="warning">
                            <strong>Hostinger note:</strong> Some Hostinger VPS plans have an additional firewall in the Hostinger control panel. Make sure ports 8080 and 18789 are also allowed there, not just in ufw.
                        </CalloutBox>
                    </div>
                );

            case 'upload':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">Upload Your Code</h2>
                        <p className="text-white/60 text-sm leading-relaxed font-mono">
                            You need to upload <strong className="text-white">3 things</strong> to your VPS:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { file: 'dist/', desc: 'The built frontend (HTML/JS/CSS)', how: 'Run npm run build locally first' },
                                { file: 'server.js', desc: 'The VPS backend gateway server', how: 'Already included in your repo' },
                                { file: 'package.json', desc: 'Dependency manifest', how: 'Already included in your repo' },
                            ].map((f, i) => (
                                <div key={i} className="p-4 bg-white/[0.03] border border-white/10 rounded-xl">
                                    <code className="text-emerald-400 text-xs font-bold">{f.file}</code>
                                    <p className="text-[10px] text-white/40 font-mono mt-1">{f.desc}</p>
                                    <p className="text-[9px] text-white/20 font-mono mt-1 italic">{f.how}</p>
                                </div>
                            ))}
                        </div>

                        <h3 className="text-base font-bold text-white mt-6">Step 1: Build the Frontend Locally</h3>
                        <p className="text-xs text-white/40 font-mono">Run this on your <strong className="text-white">local machine</strong> (not on the VPS):</p>
                        <CopyBlock label="Windows PowerShell / Mac / Linux" code={`npx vite build`} />
                        <CalloutBox type="info">
                            <strong>No API key needed for the build!</strong> Users enter their own Gemini API key in <strong>Settings → Secrets</strong> after deployment. Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">aistudio.google.com/apikey</a>
                        </CalloutBox>

                        <h3 className="text-base font-bold text-white mt-6">Step 2: Upload to VPS via SCP</h3>
                        <p className="text-xs text-white/40 font-mono">From your <strong className="text-white">local machine</strong>, run:</p>
                        <CopyBlock code={`# Upload the built frontend
scp -r dist root@72.62.129.226:/opt/opencrabshell/

# Upload the server and package.json
scp server.js package.json root@72.62.129.226:/opt/opencrabshell/`} />

                        <h3 className="text-base font-bold text-white mt-6">Step 3: Install Server Dependencies on VPS</h3>
                        <p className="text-xs text-white/40 font-mono">SSH back into your VPS and run:</p>
                        <CopyBlock code={`cd /opt/opencrabshell

# Install the WebSocket library (required)
npm install ws

# Install Puppeteer for BrowserPilot (optional but recommended)
npm install puppeteer`} />

                        <CalloutBox type="info">
                            <strong>What is Puppeteer?</strong> It's a headless Chrome browser that runs on the server. It powers the Live Browser / Market Feed — letting the AI scrape websites, click buttons, and take screenshots. Without it, those features are disabled.
                        </CalloutBox>
                    </div>
                );

            case 'launch':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">Launch the Server</h2>
                        <p className="text-white/60 text-sm leading-relaxed font-mono">
                            Start <code className="text-emerald-400">server.js</code> using PM2. This is the gateway that bridges your browser to the VPS.
                        </p>

                        <h3 className="text-base font-bold text-white">What server.js Does</h3>
                        <div className="p-5 bg-black/40 border border-white/10 rounded-2xl font-mono text-xs text-white/50 leading-loose">
                            <pre>{`server.js runs TWO services:

1. HTTP Server (port 8080)
   → Serves your built frontend (dist/ folder)
   → Users visit http://72.62.129.226:8080 to access the app

2. WebSocket Server (port 18789)
   → Real-time bridge between frontend and backend
   → Handles: file storage, vault sync, BrowserPilot
   → All BROWSER_* commands go through here

3. BrowserPilot (requires Puppeteer)
   → Controls headless Chrome on the server
   → Navigate, click, type, screenshot, extract data
   → Powers: Live Browser, Market Feed, Trading Bots`}</pre>
                        </div>

                        <h3 className="text-base font-bold text-white mt-6">Start with PM2</h3>
                        <CopyBlock code={`cd /opt/opencrabshell

# Start the server with PM2
pm2 start server.js --name opencrabshell

# Save PM2 config (survives reboot)
pm2 save

# Enable auto-start on VPS reboot
pm2 startup`} />

                        <h3 className="text-base font-bold text-white mt-6">Verify It's Running</h3>
                        <CopyBlock code={`# Check PM2 status
pm2 status

# View live logs
pm2 logs opencrabshell

# You should see:
# =========================================
#    🦀 OpenCrabShell Server v7.1
#    "Your Shell, Your Rules"
# =========================================
# STATUS:  Online
# HTTP:    8080
# WS:      18789`} />

                        <CalloutBox type="success">
                            <strong>Test it:</strong> Open <code>http://72.62.129.226:8080</code> in your browser. You should see the OpenCrabShell interface. 🎉
                        </CalloutBox>

                        <h3 className="text-base font-bold text-white mt-6">PM2 Cheat Sheet</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                                { cmd: 'pm2 status', desc: 'Check if server is running' },
                                { cmd: 'pm2 restart opencrabshell', desc: 'Restart after code changes' },
                                { cmd: 'pm2 logs opencrabshell', desc: 'View live output' },
                                { cmd: 'pm2 stop opencrabshell', desc: 'Stop the server' },
                                { cmd: 'pm2 delete opencrabshell', desc: 'Remove from PM2' },
                                { cmd: 'pm2 monit', desc: 'Dashboard with CPU/RAM stats' },
                            ].map((c, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5">
                                    <code className="text-emerald-400 text-[10px] font-bold flex-1">{c.cmd}</code>
                                    <span className="text-[9px] text-white/30 font-mono">{c.desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'connect':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">Connect Your Frontend</h2>
                        <p className="text-white/60 text-sm leading-relaxed font-mono">
                            The frontend needs to know where the VPS WebSocket server is. There are two scenarios:
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                                <h4 className="text-sm font-bold text-emerald-400 mb-2">✅ Scenario A: Frontend Served from VPS</h4>
                                <p className="text-xs text-white/40 font-mono">
                                    If you access the app at <code className="text-white">http://72.62.129.226:8080</code>, the frontend auto-detects the WebSocket server. <strong className="text-white">No configuration needed.</strong>
                                </p>
                            </div>
                            <div className="p-5 bg-cyan-500/5 border border-cyan-500/20 rounded-2xl">
                                <h4 className="text-sm font-bold text-cyan-400 mb-2">⚙️ Scenario B: Frontend Runs Locally</h4>
                                <p className="text-xs text-white/40 font-mono">
                                    If you're running <code className="text-white">npm run dev</code> locally but want to connect to the VPS gateway, set the host manually.
                                </p>
                            </div>
                        </div>

                        <h3 className="text-base font-bold text-white mt-6">For Scenario B — Set Gateway Host</h3>
                        <p className="text-xs text-white/40 font-mono">Go to <strong className="text-white">Settings → Keys</strong> in the app and set the Gateway Host to:</p>
                        <CopyBlock code="ws://72.62.129.226:18789" />
                        <p className="text-xs text-white/30 font-mono italic">Or set it via browser console:</p>
                        <CopyBlock code={`localStorage.setItem('claw_gateway_host', 'ws://72.62.129.226:18789');
location.reload();`} />

                        <h3 className="text-base font-bold text-white mt-6">How the Connection Works</h3>
                        <div className="p-5 bg-black/40 border border-white/10 rounded-2xl font-mono text-xs text-white/50 leading-loose">
                            <pre>{`1. Browser opens → Frontend loads in your browser
2. gatewayService.ts creates WebSocket to VPS IP:18789
3. AUTH handshake → email + password sent
4. Server responds AUTH_SUCCESS → bridge is live
5. All vault operations + BrowserPilot go through this tunnel
6. Heartbeat PING/PONG every 10 seconds keeps it alive

Status indicators:
  🟢 "Active Uplink"   = Connected to VPS
  🔴 "Tunnel Closed"   = Not connected (local mode)`}</pre>
                        </div>

                        <CalloutBox type="warning">
                            <strong>Firewall check:</strong> If the connection fails, make sure port <code>18789</code> is open in both ufw AND your VPS provider's firewall panel.
                        </CalloutBox>
                    </div>
                );

            case 'ssl':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">SSL & Domain Setup</h2>
                        <p className="text-white/60 text-sm leading-relaxed font-mono">
                            Set up a subdomain on <strong className="text-white">clawkeep.cloud</strong> and an SSL certificate so you can access your shell at <code className="text-indigo-400">https://shell.clawkeep.cloud</code>.
                        </p>

                        <h3 className="text-base font-bold text-white">Step 1: Point Your Domain</h3>
                        <p className="text-xs text-white/40 font-mono">
                            In your domain registrar (Namecheap, Cloudflare, etc.), add an <strong className="text-white">A record</strong>:
                        </p>
                        <div className="grid grid-cols-3 gap-2 my-3">
                            <div className="p-3 bg-black/30 rounded-xl text-center"><span className="text-[9px] text-white/30 block uppercase font-bold tracking-widest">Type</span><span className="text-xs text-white font-mono">A</span></div>
                            <div className="p-3 bg-black/30 rounded-xl text-center"><span className="text-[9px] text-white/30 block uppercase font-bold tracking-widest">Name</span><span className="text-xs text-white font-mono">shell</span></div>
                            <div className="p-3 bg-black/30 rounded-xl text-center"><span className="text-[9px] text-white/30 block uppercase font-bold tracking-widest">Value</span><span className="text-xs text-white font-mono">72.62.129.226</span></div>
                        </div>

                        <h3 className="text-base font-bold text-white mt-6">Step 2: Install Nginx (Reverse Proxy)</h3>
                        <CopyBlock code={`apt install -y nginx`} />

                        <h3 className="text-base font-bold text-white mt-4">Step 3: Configure Nginx</h3>
                        <CopyBlock label="Create: /etc/nginx/sites-available/opencrabshell" code={`server {
    listen 80;
    server_name shell.clawkeep.cloud;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket bridge
    location /ws {
        proxy_pass http://127.0.0.1:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}`} />
                        <CopyBlock code={`# Enable the config
ln -s /etc/nginx/sites-available/opencrabshell /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx`} />

                        <h3 className="text-base font-bold text-white mt-6">Step 4: Install SSL with Certbot</h3>
                        <CopyBlock code={`apt install -y certbot python3-certbot-nginx
certbot --nginx -d shell.clawkeep.cloud`} />

                        <CalloutBox type="success">
                            <strong>Done!</strong> Your shell is now accessible at <code>https://shell.clawkeep.cloud</code> with full SSL encryption. Certbot auto-renews your certificate.
                        </CalloutBox>
                    </div>
                );

            case 'update':
                return (
                    <div className="space-y-6">
                        <h2 className="text-2xl font-bold text-white">Updating Your Deployment</h2>
                        <p className="text-white/60 text-sm leading-relaxed font-mono">
                            When you make changes to the frontend or server code, here's how to push updates to your VPS.
                        </p>

                        <h3 className="text-base font-bold text-white">Frontend Changes (UI, components, styles)</h3>
                        <CopyBlock label="Run on your local machine" code={`# 1. Rebuild the frontend
npx vite build

# 2. Upload the new dist/ to VPS
scp -r dist root@72.62.129.226:/opt/opencrabshell/

# No server restart needed — just refresh the browser!`} />

                        <h3 className="text-base font-bold text-white mt-6">Server Changes (server.js)</h3>
                        <CopyBlock label="Run on your local machine" code={`# 1. Upload the new server.js
scp server.js root@72.62.129.226:/opt/opencrabshell/

# 2. Restart the server
ssh root@72.62.129.226 "pm2 restart opencrabshell"`} />

                        <h3 className="text-base font-bold text-white mt-6">Quick One-Liner Deploy</h3>
                        <CopyBlock label="Full deploy in one command" code={`npx vite build; scp -r dist server.js root@72.62.129.226:/opt/opencrabshell/; ssh root@72.62.129.226 "pm2 restart opencrabshell"`} />

                        <h3 className="text-base font-bold text-white mt-6">Troubleshooting</h3>
                        <div className="space-y-2">
                            {[
                                { problem: '"Frontend not built" at port 8080', fix: 'Run npx vite build locally and upload dist/ to VPS' },
                                { problem: 'WebSocket won\'t connect', fix: 'Check firewall: ufw allow 18789/tcp and VPS provider firewall panel' },
                                { problem: '"Local Mode" showing in sidebar', fix: 'VPS not reachable — verify IP, ports, and pm2 status' },
                                { problem: 'BrowserPilot disabled', fix: 'Install Puppeteer on VPS: npm install puppeteer' },
                                { problem: 'PM2 not restarting on reboot', fix: 'Run: pm2 startup && pm2 save' },
                                { problem: 'SSL certificate expired', fix: 'Run: certbot renew' },
                            ].map((t, i) => (
                                <div key={i} className="flex gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                        <span className="text-[10px] text-white/60 font-mono font-bold">{t.problem}</span>
                                        <span className="text-[10px] text-emerald-400/60 font-mono"> → {t.fix}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="p-10 h-full flex flex-col overflow-hidden">
            <header className="mb-8 shrink-0">
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tighter drop-shadow-md flex items-center gap-4">
                    <Server className="w-10 h-10 text-cyan-500" />
                    VPS Setup Guide
                </h1>
                <p className="text-white/40 text-[10px] font-black tracking-[0.3em] uppercase flex items-center gap-2">
                    <Rocket className="w-3 h-3 text-cyan-500" /> Step-by-step deployment for your own server
                </p>
            </header>

            <div className="flex-1 flex gap-8 min-h-0">
                {/* Step Navigation */}
                <div className="w-56 shrink-0">
                    <nav className="space-y-2 sticky top-0">
                        {STEPS.map((step, i) => {
                            const isActive = activeStep === step.id;
                            return (
                                <button
                                    key={step.id}
                                    onClick={() => setActiveStep(step.id)}
                                    className={`w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3 group ${isActive
                                        ? `bg-${step.color}-500/10 border border-${step.color}-500/30 shadow-glow`
                                        : 'bg-white/[0.02] border border-transparent hover:border-white/10 hover:bg-white/[0.04]'
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${isActive
                                        ? `bg-${step.color}-500 text-white`
                                        : 'bg-white/5 text-white/30 group-hover:text-white/60'
                                        }`}>
                                        <span className="text-[10px] font-black">{i + 1}</span>
                                    </div>
                                    <div>
                                        <span className={`text-xs font-bold uppercase tracking-wide block ${isActive ? 'text-white' : 'text-white/50'}`}>
                                            {step.label}
                                        </span>
                                    </div>
                                    {isActive && <ChevronRight className={`w-3 h-3 ml-auto text-${step.color}-400`} />}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1 glass-panel p-8 rounded-[32px] overflow-y-auto scrollbar-hide border-white/5">
                    {renderStepContent()}

                    {/* Navigation Buttons */}
                    <div className="flex justify-between items-center mt-10 pt-6 border-t border-white/5">
                        {activeStep !== 'why' ? (
                            <button
                                onClick={() => {
                                    const idx = STEPS.findIndex(s => s.id === activeStep);
                                    if (idx > 0) setActiveStep(STEPS[idx - 1].id);
                                }}
                                className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-white/40 hover:text-white hover:bg-white/10 transition-all uppercase tracking-widest"
                            >
                                ← Previous
                            </button>
                        ) : <div />}
                        {activeStep !== 'update' && (
                            <button
                                onClick={() => {
                                    const idx = STEPS.findIndex(s => s.id === activeStep);
                                    if (idx < STEPS.length - 1) setActiveStep(STEPS[idx + 1].id);
                                }}
                                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-xs font-bold text-white uppercase tracking-widest transition-all flex items-center gap-2"
                            >
                                Next Step <ArrowRight className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VPSSetupView;
