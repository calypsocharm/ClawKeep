
/*
 * OpenClaw VPS Bridge Server v8.0 — Auth Hardened
 * Run this on your VPS to enable local file storage: node server.js
 * Requires: npm install ws better-sqlite3 bcryptjs jsonwebtoken
 * Serves the built frontend on HTTP_PORT and WebSocket on WS_PORT
 */

const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

// Auth dependencies
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const WS_PORT = 'same as HTTP';  // WebSocket now shares the HTTP port
const HTTP_PORT = process.env.PORT || 8080;
const VAULT_DIR = path.join(__dirname, 'vault_data');
const DIST_DIR = path.join(__dirname, 'dist');
const DATA_DIR = path.join(__dirname, 'data');

// Ensure directories exist
[VAULT_DIR, DATA_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[Init] Created directory: ${dir}`);
    }
});

// --- JWT Secret (persistent, generated once) ---
const JWT_SECRET_PATH = path.join(DATA_DIR, '.jwt_secret');
let JWT_SECRET;
if (fs.existsSync(JWT_SECRET_PATH)) {
    JWT_SECRET = fs.readFileSync(JWT_SECRET_PATH, 'utf8').trim();
} else {
    JWT_SECRET = crypto.randomBytes(64).toString('hex');
    fs.writeFileSync(JWT_SECRET_PATH, JWT_SECRET);
    console.log('[Auth] Generated new JWT secret');
}

// --- SQLite Database ---
const db = new Database(path.join(DATA_DIR, 'openclaw.db'));
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT DEFAULT '',
        role TEXT DEFAULT 'user',
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS user_data (
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT DEFAULT '{}',
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
`);
console.log('[DB] SQLite initialized');

// --- Auth Helpers ---
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '30d' }
    );
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

function getAuthUser(req) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    return verifyToken(token);
}

// --- Request Body Parser ---
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; if (body.length > 1e7) reject(new Error('Body too large')); });
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch { reject(new Error('Invalid JSON')); }
        });
    });
}

// --- CORS + JSON Response Helpers ---
function sendJSON(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    res.end(JSON.stringify(data));
}

// --- Static HTTP Server for Frontend ---
const MIME_TYPES = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.webp': 'image/webp', '.webm': 'video/webm', '.mp4': 'video/mp4',
    '.map': 'application/json'
};

const httpServer = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    // --- CORS Preflight ---
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
        });
        return res.end();
    }

    // =============================================
    // === AUTH ROUTES (public, no token needed) ===
    // =============================================

    if (url === '/api/auth/register' && req.method === 'POST') {
        try {
            const { email, password, name } = await parseBody(req);
            if (!email || !password) return sendJSON(res, 400, { error: 'Email and password required' });
            if (password.length < 6) return sendJSON(res, 400, { error: 'Password must be at least 6 characters' });

            // Check if email already taken
            const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
            if (existing) return sendJSON(res, 409, { error: 'Email already registered' });

            const id = crypto.randomUUID();
            const password_hash = bcrypt.hashSync(password, 12);

            // First user auto-becomes admin
            const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
            const role = userCount === 0 ? 'admin' : 'user';

            db.prepare('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)')
                .run(id, email, password_hash, name || '', role);

            const user = { id, email, name: name || '', role };
            const token = generateToken(user);

            console.log(`[Auth] New ${role} registered: ${email}`);
            return sendJSON(res, 201, { user, token });
        } catch (err) {
            console.error('[Auth] Register error:', err.message);
            return sendJSON(res, 500, { error: err.message });
        }
    }

    if (url === '/api/auth/login' && req.method === 'POST') {
        try {
            const { email, password } = await parseBody(req);
            if (!email || !password) return sendJSON(res, 400, { error: 'Email and password required' });

            const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
            if (!user) return sendJSON(res, 401, { error: 'Invalid credentials' });

            const valid = bcrypt.compareSync(password, user.password_hash);
            if (!valid) return sendJSON(res, 401, { error: 'Invalid credentials' });

            const token = generateToken(user);
            console.log(`[Auth] Login: ${email} (${user.role})`);
            return sendJSON(res, 200, {
                user: { id: user.id, email: user.email, name: user.name, role: user.role },
                token
            });
        } catch (err) {
            console.error('[Auth] Login error:', err.message);
            return sendJSON(res, 500, { error: err.message });
        }
    }

    if (url === '/api/auth/me' && req.method === 'GET') {
        const decoded = getAuthUser(req);
        if (!decoded) return sendJSON(res, 401, { error: 'Not authenticated' });

        const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(decoded.id);
        if (!user) return sendJSON(res, 401, { error: 'User not found' });

        return sendJSON(res, 200, { user });
    }

    // =============================================
    // === PROTECTED API ROUTES (token required) ===
    // =============================================

    if (url.startsWith('/api/')) {
        const authUser = getAuthUser(req);
        if (!authUser) return sendJSON(res, 401, { error: 'Authentication required' });

        // --- User Data (scoped per user) ---

        // GET /api/sync/pull — pull all user data
        if (url === '/api/sync/pull' && req.method === 'GET') {
            const rows = db.prepare('SELECT key, value FROM user_data WHERE user_id = ?').all(authUser.id);
            const result = { config: {} };
            for (const row of rows) {
                try {
                    const parsed = JSON.parse(row.value);
                    if (row.key.startsWith('config_')) {
                        result.config[row.key.replace('config_', '')] = parsed;
                    } else {
                        result[row.key] = parsed;
                    }
                } catch { result[row.key] = row.value; }
            }
            return sendJSON(res, 200, result);
        }

        // POST /api/sync — push data
        if (url === '/api/sync' && req.method === 'POST') {
            const body = await parseBody(req);
            const upsert = db.prepare(`
                INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            `);
            const txn = db.transaction(() => {
                for (const [key, value] of Object.entries(body)) {
                    upsert.run(authUser.id, key, JSON.stringify(value));
                }
            });
            txn();
            return sendJSON(res, 200, { ok: true });
        }

        // GET /api/config/:key
        const configGetMatch = url.match(/^\/api\/config\/(.+)$/);
        if (configGetMatch && req.method === 'GET') {
            const key = decodeURIComponent(configGetMatch[1]);
            const row = db.prepare('SELECT value FROM user_data WHERE user_id = ? AND key = ?').get(authUser.id, `config_${key}`);
            if (!row) return sendJSON(res, 200, { value: null });
            try { return sendJSON(res, 200, { value: JSON.parse(row.value) }); }
            catch { return sendJSON(res, 200, { value: row.value }); }
        }

        // PUT /api/config
        if (url === '/api/config' && req.method === 'PUT') {
            const { key, value } = await parseBody(req);
            if (!key) return sendJSON(res, 400, { error: 'Key required' });
            const upsert = db.prepare(`
                INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            `);
            upsert.run(authUser.id, `config_${key}`, JSON.stringify(value));
            return sendJSON(res, 200, { ok: true });
        }

        // --- CRUD resources (tasks, documents, agents, etc.) ---
        const resourceMatch = url.match(/^\/api\/(tasks|documents|agents|expenses|checklists|chat|contacts|cron|events)(?:\/(.+))?$/);
        if (resourceMatch) {
            const resource = resourceMatch[1];
            const resourceId = resourceMatch[2] ? decodeURIComponent(resourceMatch[2]) : null;
            const dataKey = resource;

            if (req.method === 'GET') {
                const row = db.prepare('SELECT value FROM user_data WHERE user_id = ? AND key = ?').get(authUser.id, dataKey);
                const items = row ? JSON.parse(row.value) : [];
                if (resourceId) {
                    const item = items.find(i => i.id === resourceId);
                    return item ? sendJSON(res, 200, item) : sendJSON(res, 404, { error: 'Not found' });
                }
                return sendJSON(res, 200, items);
            }

            if (req.method === 'POST') {
                const body = await parseBody(req);
                const row = db.prepare('SELECT value FROM user_data WHERE user_id = ? AND key = ?').get(authUser.id, dataKey);
                const items = row ? JSON.parse(row.value) : [];
                items.unshift(body);
                db.prepare(`INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
                    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
                    .run(authUser.id, dataKey, JSON.stringify(items));
                return sendJSON(res, 201, body);
            }

            if (req.method === 'PUT' && resourceId) {
                const body = await parseBody(req);
                const row = db.prepare('SELECT value FROM user_data WHERE user_id = ? AND key = ?').get(authUser.id, dataKey);
                const items = row ? JSON.parse(row.value) : [];
                const idx = items.findIndex(i => i.id === resourceId);
                if (idx >= 0) items[idx] = { ...items[idx], ...body };
                db.prepare(`INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
                    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
                    .run(authUser.id, dataKey, JSON.stringify(items));
                return sendJSON(res, 200, items[idx] || body);
            }

            if (req.method === 'DELETE' && resourceId) {
                const row = db.prepare('SELECT value FROM user_data WHERE user_id = ? AND key = ?').get(authUser.id, dataKey);
                const items = row ? JSON.parse(row.value) : [];
                const filtered = items.filter(i => i.id !== resourceId);
                db.prepare(`INSERT INTO user_data (user_id, key, value, updated_at) VALUES (?, ?, ?, datetime('now'))
                    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
                    .run(authUser.id, dataKey, JSON.stringify(filtered));
                return sendJSON(res, 200, { ok: true });
            }
        }

        // --- Admin Routes (admin role only) ---
        if (url.startsWith('/api/admin/')) {
            if (authUser.role !== 'admin') return sendJSON(res, 403, { error: 'Admin access required' });

            // GET /api/admin/users
            if (url === '/api/admin/users' && req.method === 'GET') {
                const users = db.prepare('SELECT id, email, name, role, created_at FROM users').all();
                return sendJSON(res, 200, users);
            }

            // PUT /api/admin/users/:id/role
            const roleMatch = url.match(/^\/api\/admin\/users\/(.+)\/role$/);
            if (roleMatch && req.method === 'PUT') {
                const targetId = decodeURIComponent(roleMatch[1]);
                const { role } = await parseBody(req);
                if (!['admin', 'user'].includes(role)) return sendJSON(res, 400, { error: 'Invalid role' });
                db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetId);
                console.log(`[Admin] Changed role for ${targetId} to ${role}`);
                return sendJSON(res, 200, { ok: true });
            }

            // DELETE /api/admin/users/:id
            const deleteMatch = url.match(/^\/api\/admin\/users\/(.+)$/);
            if (deleteMatch && req.method === 'DELETE') {
                const targetId = decodeURIComponent(deleteMatch[1]);
                if (targetId === authUser.id) return sendJSON(res, 400, { error: 'Cannot delete yourself' });
                db.prepare('DELETE FROM user_data WHERE user_id = ?').run(targetId);
                db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
                console.log(`[Admin] Deleted user: ${targetId}`);
                return sendJSON(res, 200, { ok: true });
            }
        }

        // Catch-all for unknown API routes
        return sendJSON(res, 404, { error: 'API route not found' });
    }

    // =============================================
    // === STATIC FILE SERVING (frontend)       ===
    // =============================================

    let filePath = path.join(DIST_DIR, url === '/' ? 'index.html' : url);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const file = fs.readFileSync(filePath);
        const headers = { 'Content-Type': contentType };
        // HTML must always be re-validated (prevents stale index.html caching)
        if (ext === '.html') {
            headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            headers['Pragma'] = 'no-cache';
            headers['Expires'] = '0';
        } else if (filePath.includes('/assets/') || filePath.includes('\\assets\\')) {
            // Hashed assets — immutable, cache forever
            headers['Cache-Control'] = 'public, max-age=31536000, immutable';
        }
        res.writeHead(200, headers);
        res.end(file);
    } else {
        // SPA fallback — serve index.html for all routes
        const indexPath = path.join(DIST_DIR, 'index.html');
        if (fs.existsSync(indexPath)) {
            const file = fs.readFileSync(indexPath);
            res.writeHead(200, {
                'Content-Type': 'text/html',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            });
            res.end(file);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Frontend not built. Run: npm run build');
        }
    }
});

httpServer.listen(HTTP_PORT, () => {
    console.log(`[HTTP] Frontend serving on port ${HTTP_PORT}`);
});

// --- BrowserPilot: Headless Chrome Controller ---
let puppeteer;
try {
    // Prefer puppeteer-extra with stealth plugin for anti-bot evasion
    const puppeteerExtra = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteerExtra.use(StealthPlugin());
    puppeteer = puppeteerExtra;
    console.log('[BrowserPilot] Using puppeteer-extra + stealth plugin ✅');
} catch (e) {
    try { puppeteer = require('puppeteer'); console.log('[BrowserPilot] Stealth plugin not found — using vanilla Puppeteer'); }
    catch (e2) { console.log('[BrowserPilot] Puppeteer not installed — browser features disabled'); }
}

class BrowserPilot {
    constructor() {
        this.browser = null;
        this.page = null;
        this.cdp = null;
        this.isActive = false;
        this.screencastActive = false;
        this.broadcastFrame = null; // set by WS handler
        this.downloadPath = path.join(VAULT_DIR, 'downloads');
        if (!fs.existsSync(this.downloadPath)) fs.mkdirSync(this.downloadPath, { recursive: true });
    }

    async launch() {
        if (this.browser) return;
        this.browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
                '--disable-gpu', '--window-size=1280,800',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--lang=en-US,en',
                '--disable-infobars',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
            ]
        });
        this.page = await this.browser.newPage();
        await this.page.setViewport({ width: 1280, height: 800 });

        // Stealth: Modern Chrome user-agent
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');
        await this.page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
        });

        // Comprehensive stealth evasions (supplements puppeteer-extra-plugin-stealth)
        await this.page.evaluateOnNewDocument(() => {
            // Hide webdriver flag
            Object.defineProperty(navigator, 'webdriver', { get: () => false });

            // Realistic navigator properties
            Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

            // Realistic plugins array (PDF viewer like real Chrome)
            Object.defineProperty(navigator, 'plugins', {
                get: () => {
                    const plugins = [
                        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
                        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
                        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
                    ];
                    plugins.length = 3;
                    return plugins;
                }
            });

            // Chrome runtime object
            window.chrome = {
                runtime: { onMessage: { addListener: () => { }, removeListener: () => { } }, sendMessage: () => { }, connect: () => ({ onMessage: { addListener: () => { } }, postMessage: () => { } }) },
                loadTimes: () => ({ requestTime: Date.now() / 1000, startLoadTime: Date.now() / 1000, commitLoadTime: Date.now() / 1000, finishDocumentLoadTime: Date.now() / 1000, finishLoadTime: Date.now() / 1000, firstPaintTime: 0, firstPaintAfterLoadTime: 0, navigationType: 'Other', wasFetchedViaSpdy: true, wasNpnNegotiated: true, npnNegotiatedProtocol: 'h2', wasAlternateProtocolAvailable: false, connectionInfo: 'h2' }),
                csi: () => ({ onloadT: Date.now(), startE: Date.now(), pageT: 0 }),
                app: { isInstalled: false, InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' }, RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' } }
            };

            // Fake permissions API
            const origQuery = window.navigator.permissions?.query;
            if (origQuery) {
                window.navigator.permissions.query = (params) =>
                    params.name === 'notifications'
                        ? Promise.resolve({ state: Notification.permission })
                        : origQuery(params);
            }

            // WebGL vendor/renderer spoofing
            const getParameterOrig = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (param) {
                if (param === 37445) return 'Google Inc. (NVIDIA)';        // UNMASKED_VENDOR_WEBGL
                if (param === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)'; // UNMASKED_RENDERER_WEBGL
                return getParameterOrig.call(this, param);
            };
            // Also cover WebGL2
            if (typeof WebGL2RenderingContext !== 'undefined') {
                const getParam2Orig = WebGL2RenderingContext.prototype.getParameter;
                WebGL2RenderingContext.prototype.getParameter = function (param) {
                    if (param === 37445) return 'Google Inc. (NVIDIA)';
                    if (param === 37446) return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 SUPER Direct3D11 vs_5_0 ps_5_0, D3D11)';
                    return getParam2Orig.call(this, param);
                };
            }

            // Connection API
            Object.defineProperty(navigator, 'connection', {
                get: () => ({ effectiveType: '4g', rtt: 50, downlink: 10, saveData: false })
            });

            // Notification constructor
            if (!window.Notification) {
                window.Notification = { permission: 'default', requestPermission: () => Promise.resolve('default') };
            }
        });

        // CDP session for screencast + downloads
        this.cdp = await this.page.createCDPSession();
        await this.cdp.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: this.downloadPath
        });

        this.isActive = true;
        console.log('[BrowserPilot] Chrome launched (stealth mode)');
    }

    // --- CDP Screencast: stream frames to frontend ---
    async startScreencast() {
        if (!this.cdp || this.screencastActive) return;
        this.screencastActive = true;

        this.cdp.on('Page.screencastFrame', async (frame) => {
            // Acknowledge frame so Chrome sends the next one
            await this.cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => { });
            // Broadcast to connected frontend
            if (this.broadcastFrame) {
                this.broadcastFrame({
                    type: 'BROWSER_FRAME',
                    data: frame.data, // base64 JPEG
                    metadata: frame.metadata
                });
            }
        });

        await this.cdp.send('Page.startScreencast', {
            format: 'jpeg',
            quality: 50,
            maxWidth: 1280,
            maxHeight: 800,
            everyNthFrame: 1
        });
        console.log('[BrowserPilot] Screencast started');
    }

    async stopScreencast() {
        if (!this.cdp || !this.screencastActive) return;
        await this.cdp.send('Page.stopScreencast').catch(() => { });
        this.screencastActive = false;
        console.log('[BrowserPilot] Screencast stopped');
    }

    // --- Input forwarding via CDP ---
    async dispatchMouseEvent(type, x, y, button = 'left', clickCount = 1) {
        if (!this.cdp) return;
        await this.cdp.send('Input.dispatchMouseEvent', {
            type, x, y, button,
            clickCount: type === 'mousePressed' || type === 'mouseReleased' ? clickCount : 0
        });
    }

    async dispatchScroll(x, y, deltaX, deltaY) {
        if (!this.cdp) return;
        await this.cdp.send('Input.dispatchMouseEvent', {
            type: 'mouseWheel', x, y, deltaX, deltaY
        });
    }

    async dispatchKeyEvent(type, key, code, text, modifiers = 0) {
        if (!this.cdp) return;
        const params = { type, modifiers };
        if (key) params.key = key;
        if (code) params.code = code;
        if (text && type === 'keyDown') params.text = text;
        // For special keys
        if (key === 'Enter') { params.key = 'Enter'; params.code = 'Enter'; params.text = '\r'; }
        if (key === 'Tab') { params.key = 'Tab'; params.code = 'Tab'; params.text = '\t'; }
        if (key === 'Backspace') { params.key = 'Backspace'; params.code = 'Backspace'; }
        await this.cdp.send('Input.dispatchKeyEvent', params);
    }

    async navigate(url) {
        await this.launch();
        if (!url.startsWith('http')) url = 'https://' + url;
        try {
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (e) {
            // Timeout is OK — page may still be loading assets
            console.log(`[BrowserPilot] Navigate partial: ${e.message}`);
        }
        // Small delay for rendering
        await new Promise(r => setTimeout(r, 800));
        return this.getState('Navigated to ' + url);
    }

    async click(selector) {
        await this.launch();
        try {
            await this.page.waitForSelector(selector, { timeout: 5000 });
            await this.page.click(selector);
            await this.page.waitForNetworkIdle({ timeout: 5000 }).catch(() => { });
            return this.getState(`Clicked: ${selector}`);
        } catch (e) {
            return this.getState(`Click failed: ${e.message}`);
        }
    }

    async clickXY(x, y) {
        await this.launch();
        await this.page.mouse.click(x, y);
        await this.page.waitForNetworkIdle({ timeout: 3000 }).catch(() => { });
        return this.getState(`Clicked at (${x}, ${y})`);
    }

    async type(text) {
        await this.launch();
        await this.page.keyboard.type(text, { delay: 30 });
        return this.getState(`Typed: "${text}"`);
    }

    async pressKey(key) {
        await this.launch();
        await this.page.keyboard.press(key);
        await new Promise(r => setTimeout(r, 500));
        return this.getState(`Pressed key: ${key}`);
    }

    async scroll(direction = 'down', amount = 400) {
        await this.launch();
        await this.page.evaluate((dir, amt) => {
            window.scrollBy(0, dir === 'down' ? amt : -amt);
        }, direction, amount);
        return this.getState(`Scrolled ${direction} ${amount}px`);
    }

    async extract() {
        await this.launch();
        const data = await this.page.evaluate(() => {
            const getText = (el) => el ? el.innerText.slice(0, 3000) : '';

            // Helper: generate a CSS selector for an element
            const getSelector = (el) => {
                if (el.id) return '#' + el.id;
                if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
                if (el.type && el.tagName === 'INPUT') return `input[type="${el.type}"]`;
                if (el.className && typeof el.className === 'string') {
                    const cls = el.className.trim().split(/\s+/)[0];
                    if (cls) return `${el.tagName.toLowerCase()}.${cls}`;
                }
                if (el.getAttribute('aria-label')) return `[aria-label="${el.getAttribute('aria-label')}"]`;
                if (el.getAttribute('placeholder')) return `[placeholder="${el.getAttribute('placeholder')}"]`;
                return el.tagName.toLowerCase();
            };

            // Links
            const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({
                text: a.innerText.trim().slice(0, 80),
                href: a.href,
                selector: getSelector(a)
            })).filter(l => l.text);

            // Buttons
            const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]')).slice(0, 30).map(b => ({
                text: (b.innerText || b.value || b.getAttribute('aria-label') || '').trim().slice(0, 80),
                selector: getSelector(b),
                type: b.type || 'button',
                disabled: b.disabled || false
            })).filter(b => b.text);

            // Input fields
            const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select')).slice(0, 30).map(inp => ({
                type: inp.type || inp.tagName.toLowerCase(),
                name: inp.name || '',
                placeholder: inp.placeholder || '',
                selector: getSelector(inp),
                value: inp.value || '',
                label: inp.labels && inp.labels[0] ? inp.labels[0].innerText.trim().slice(0, 60) : ''
            }));

            // Forms
            const forms = Array.from(document.querySelectorAll('form')).slice(0, 10).map(f => ({
                action: f.action || '',
                method: f.method || 'get',
                selector: getSelector(f),
                fieldCount: f.querySelectorAll('input, textarea, select').length
            }));

            return {
                title: document.title,
                url: window.location.href,
                text: getText(document.body).slice(0, 5000),
                links,
                buttons,
                inputs,
                forms
            };
        });
        const state = await this.getState('Extracted page content');
        return { ...state, extraction: data };
    }

    async screenshot() {
        await this.launch();
        return this.getState('Screenshot captured');
    }

    async downloadFile(url) {
        await this.launch();
        try {
            // Try direct HTTP download first (more reliable for PDFs)
            const fileName = path.basename(new URL(url).pathname) || 'download.pdf';
            const filePath = path.join(this.downloadPath, fileName);

            const downloaded = await new Promise((resolve, reject) => {
                const proto = url.startsWith('https') ? require('https') : require('http');
                const options = {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                        'Accept': 'application/pdf,*/*'
                    }
                };
                const request = (reqUrl) => {
                    const p = reqUrl.startsWith('https') ? require('https') : require('http');
                    p.get(reqUrl, options, (res) => {
                        // Follow redirects
                        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                            console.log(`[BrowserPilot] Following redirect to ${res.headers.location}`);
                            request(res.headers.location);
                            return;
                        }
                        if (res.statusCode !== 200) {
                            reject(new Error(`HTTP ${res.statusCode}`));
                            return;
                        }
                        const file = fs.createWriteStream(filePath);
                        res.pipe(file);
                        file.on('finish', () => { file.close(); resolve(fileName); });
                        file.on('error', reject);
                    }).on('error', reject);
                };
                request(url);
                setTimeout(() => reject(new Error('Download timeout')), 60000);
            });

            console.log(`[BrowserPilot] Downloaded ${downloaded} to ${filePath}`);

            // Navigate browser to URL for visual feedback
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });

            return this.getState(`Downloaded: ${downloaded} (${(fs.statSync(filePath).size / 1024).toFixed(0)} KB)`);
        } catch (e) {
            console.error(`[BrowserPilot] Download failed: ${e.message}`);

            // Fallback: try browser-based download
            try {
                await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
                await new Promise(r => setTimeout(r, 5000));

                const files = fs.readdirSync(this.downloadPath);
                const latest = files.sort((a, b) => {
                    return fs.statSync(path.join(this.downloadPath, b)).mtime -
                        fs.statSync(path.join(this.downloadPath, a)).mtime;
                })[0];

                return this.getState(latest ? `Downloaded: ${latest}` : 'Download attempted via browser');
            } catch (e2) {
                return this.getState(`Download error: ${e.message}`);
            }
        }
    }

    async goBack() {
        await this.launch();
        await this.page.goBack({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { });
        return this.getState('Navigated back');
    }

    async goForward() {
        await this.launch();
        await this.page.goForward({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { });
        return this.getState('Navigated forward');
    }

    async reload() {
        await this.launch();
        await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { });
        return this.getState('Page reloaded');
    }

    async getState(action = '') {
        if (!this.page) return { url: '', title: '', screenshot: '', action, status: 'IDLE' };

        const screenshot = await this.page.screenshot({
            encoding: 'base64',
            type: 'jpeg',
            quality: 60
        });

        return {
            url: this.page.url(),
            title: await this.page.title(),
            screenshot: 'data:image/jpeg;base64,' + screenshot,
            action,
            status: 'READY'
        };
    }

    async close() {
        if (this.browser) {
            await this.stopScreencast();
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.cdp = null;
            this.isActive = false;
            console.log('[BrowserPilot] Chrome closed');
        }
    }
}

const pilot = new BrowserPilot();

// --- Solana Trading Bot (per-user isolation) ---
const SolanaTrader = require('./solanaTrader');
const traders = new Map(); // userId → SolanaTrader instance

// Legacy root-level files that need migration to per-user dirs
const TRADER_FILES = ['burner_wallet.json', 'trading_rules.json', 'trade_log.json', 'strategies.json', 'positions.json'];

function getTraderForUser(userId) {
    if (!userId) return null;
    if (traders.has(userId)) return traders.get(userId);

    // Each user gets isolated data directory
    const userTraderDir = path.join(DATA_DIR, 'traders', userId);
    if (!fs.existsSync(userTraderDir)) fs.mkdirSync(userTraderDir, { recursive: true });

    // One-time migration: if root-level trader files exist AND user is admin (first user)
    // move them into this user's folder so existing wallet is preserved
    const adminRow = db.prepare('SELECT id FROM users WHERE role = ? ORDER BY created_at ASC LIMIT 1').get('admin');
    if (adminRow && adminRow.id === userId) {
        for (const file of TRADER_FILES) {
            const src = path.join(DATA_DIR, file);
            const dst = path.join(userTraderDir, file);
            if (fs.existsSync(src) && !fs.existsSync(dst)) {
                try {
                    fs.copyFileSync(src, dst);
                    fs.renameSync(src, src + '.migrated');
                    console.log(`[Trader] Migrated ${file} → traders/${userId}/`);
                } catch (e) {
                    console.error(`[Trader] Migration failed for ${file}:`, e.message);
                }
            }
        }
    }

    const t = new SolanaTrader(userTraderDir);
    traders.set(userId, t);
    console.log(`[Trader] Created isolated instance for user ${userId}`);
    return t;
}

// --- WebSocket Server (shares HTTP port) ---
const wss = new WebSocket.Server({ server: httpServer });


console.log(`
=========================================
   🦀 OpenCrabShell Server v8.0
   "Your Shell, Your Rules — Auth Hardened"
=========================================
STATUS:  Online
HTTP:    ${HTTP_PORT}
WS:      ${HTTP_PORT} (shared)
VAULT:   ${VAULT_DIR}
DB:      ${path.join(DATA_DIR, 'openclaw.db')}
-----------------------------------------
Waiting for frontend connection...
`);

// Helper to recursively get files and build the Truth Index
const getFilesRecursively = (dir, fileList = []) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getFilesRecursively(filePath, fileList);
        } else {
            // Determine category from folder structure
            const relativePath = path.relative(VAULT_DIR, filePath);
            const category = path.dirname(relativePath) !== '.' ? path.dirname(relativePath) : 'MISC';

            fileList.push({
                id: `vault_${Buffer.from(relativePath).toString('base64')}`,
                name: path.basename(file),
                category: category,
                size: `${(stat.size / 1024).toFixed(1)} KB`,
                lastModified: stat.mtime.toISOString(),
                type: file.endsWith('.pdf') ? 'REPORT' : file.endsWith('.png') || file.endsWith('.jpg') ? 'IMAGE' : 'PROTOCOL',
                path: relativePath
            });
        }
    });
    return fileList;
};

wss.on('connection', (ws) => {
    console.log('[Link] Frontend connected. Synchronizing Truth Source...');
    let wsAuthUser = null; // Track authenticated user for this WS connection

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            // Debug: log all message types
            if (data.type && data.type !== 'PING') console.log(`[WS] Received: ${data.type}`);

            // Authentication Handshake — now validates JWT
            if (data.type === 'AUTH') {
                if (data.token) {
                    wsAuthUser = verifyToken(data.token);
                    if (wsAuthUser) {
                        console.log(`[Auth] WS authenticated: ${wsAuthUser.email} (${wsAuthUser.role})`);
                        ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', status: 'connected', user: wsAuthUser }));
                    } else {
                        ws.send(JSON.stringify({ type: 'AUTH_FAILED', error: 'Invalid token' }));
                    }
                } else {
                    // Legacy: accept but mark as unauthenticated
                    console.log(`[Auth] WS client connected without token (legacy mode)`);
                    ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', status: 'connected' }));
                }
            }

            // Heartbeat
            if (data.type === 'PING') {
                ws.send(JSON.stringify({ type: 'PONG' }));
            }

            // --- BrowserPilot Commands ---
            if (data.type && data.type.startsWith('BROWSER_') && puppeteer) {
                // Wire up screencast frame broadcasting to this client
                pilot.broadcastFrame = (frameMsg) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(frameMsg));
                    }
                };

                const sendUpdate = (result) => {
                    ws.send(JSON.stringify({
                        type: 'BROWSER_UPDATE',
                        url: result.url || '',
                        title: result.title || '',
                        screenshot: result.screenshot || '',
                        action: result.action || '',
                        status: result.status || 'READY',
                        extraction: result.extraction || null
                    }));
                };

                try {
                    let result;
                    switch (data.type) {
                        case 'BROWSER_NAVIGATE':
                            console.log(`[BrowserPilot] Navigate: ${data.url}`);
                            result = await pilot.navigate(data.url);
                            sendUpdate(result);
                            // Auto-start screencast after first navigate
                            await pilot.startScreencast();
                            break;

                        // --- CDP Input Forwarding (new real-time events) ---
                        case 'BROWSER_MOUSE':
                            await pilot.dispatchMouseEvent(data.eventType, data.x, data.y, data.button, data.clickCount);
                            break;
                        case 'BROWSER_WHEEL':
                            await pilot.dispatchScroll(data.x, data.y, data.deltaX || 0, data.deltaY || 0);
                            break;
                        case 'BROWSER_KEYEVENT':
                            await pilot.dispatchKeyEvent(data.eventType, data.key, data.code, data.text, data.modifiers);
                            break;

                        // --- Legacy commands (still used by Claw AI agent) ---
                        case 'BROWSER_CLICK':
                            console.log(`[BrowserPilot] Click: ${data.selector || `(${data.x},${data.y})`}`);
                            result = data.selector
                                ? await pilot.click(data.selector)
                                : await pilot.clickXY(data.x, data.y);
                            sendUpdate(result);
                            break;
                        case 'BROWSER_TYPE':
                            console.log(`[BrowserPilot] Type: ${data.text}`);
                            result = await pilot.type(data.text);
                            sendUpdate(result);
                            break;
                        case 'BROWSER_KEY':
                            console.log(`[BrowserPilot] Key: ${data.key}`);
                            result = await pilot.pressKey(data.key);
                            sendUpdate(result);
                            break;
                        case 'BROWSER_SCROLL':
                            result = await pilot.scroll(data.direction, data.amount);
                            sendUpdate(result);
                            break;
                        case 'BROWSER_EXTRACT':
                            console.log('[BrowserPilot] Extracting page content...');
                            result = await pilot.extract();
                            sendUpdate(result);
                            break;
                        case 'BROWSER_SCREENSHOT':
                            result = await pilot.screenshot();
                            sendUpdate(result);
                            break;
                        case 'BROWSER_DOWNLOAD':
                            console.log(`[BrowserPilot] Download: ${data.url}`);
                            result = await pilot.downloadFile(data.url);
                            sendUpdate(result);
                            break;
                        case 'BROWSER_BACK':
                            result = await pilot.goBack();
                            sendUpdate(result);
                            break;
                        case 'BROWSER_FORWARD':
                            result = await pilot.goForward();
                            sendUpdate(result);
                            break;
                        case 'BROWSER_RELOAD':
                            result = await pilot.reload();
                            sendUpdate(result);
                            break;
                        case 'BROWSER_CLOSE':
                            await pilot.close();
                            ws.send(JSON.stringify({ type: 'BROWSER_UPDATE', status: 'CLOSED', url: '', title: '', screenshot: '', action: 'Browser closed' }));
                            break;
                    }
                } catch (e) {
                    console.error(`[BrowserPilot] Error: ${e.message}`);
                    ws.send(JSON.stringify({ type: 'BROWSER_UPDATE', status: 'ERROR', action: `Error: ${e.message}`, url: '', title: '', screenshot: '' }));
                }
            }

            // Write File to Disk (The Commitment Protocol)
            if (data.type === 'WRITE_FILE') {
                const category = (data.category || 'MISC').toUpperCase().replace(/[^A-Z0-9]/g, '_');
                const safeName = path.basename(data.name).replace(/[^a-zA-Z0-9._-]/g, '');

                // Create category directory if it doesn't exist
                const categoryDir = path.join(VAULT_DIR, category);
                if (!fs.existsSync(categoryDir)) {
                    fs.mkdirSync(categoryDir, { recursive: true });
                }

                const filePath = path.join(categoryDir, safeName);

                let fileData = data.content;
                let isBinary = false;

                if (typeof fileData === 'string' && fileData.includes('base64,')) {
                    const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        fileData = Buffer.from(matches[2], 'base64');
                        isBinary = true;
                    }
                }

                fs.writeFile(filePath, fileData, isBinary ? null : 'utf8', (err) => {
                    if (err) {
                        console.error(`[Error] Write failed for ${category}/${safeName}:`, err);
                        ws.send(JSON.stringify({ type: 'OP_ERROR', message: err.message }));
                    } else {
                        console.log(`[Vault] Committed: ${category}/${safeName}`);
                        ws.send(JSON.stringify({ type: 'OP_SUCCESS', message: `Saved ${safeName} to ${category} Vault.` }));

                        // Auto-trigger re-index to confirm truth state
                        const index = getFilesRecursively(VAULT_DIR);
                        ws.send(JSON.stringify({ type: 'VAULT_INDEX', files: index }));
                    }
                });
            }

            // Read Full Vault Index (The Retrieval Protocol)
            if (data.type === 'SYNC_VAULT') {
                try {
                    const index = getFilesRecursively(VAULT_DIR);
                    ws.send(JSON.stringify({ type: 'VAULT_INDEX', files: index }));
                    console.log(`[Sync] Sent ${index.length} vault records to client.`);
                } catch (err) {
                    ws.send(JSON.stringify({ type: 'OP_ERROR', message: "Vault indexing failed." }));
                }
            }

            // Read a specific file from the vault (The Retrieval Protocol)
            if (data.type === 'READ_FILE') {
                try {
                    const safePath = path.normalize(data.path).replace(/\.\./g, '');
                    const filePath = path.join(VAULT_DIR, safePath);

                    if (!filePath.startsWith(VAULT_DIR)) {
                        ws.send(JSON.stringify({ type: 'OP_ERROR', message: 'Path traversal blocked.' }));
                        return;
                    }

                    if (!fs.existsSync(filePath)) {
                        ws.send(JSON.stringify({ type: 'OP_ERROR', message: `File not found: ${safePath}` }));
                        return;
                    }

                    const stat = fs.statSync(filePath);
                    const ext = path.extname(filePath).toLowerCase();
                    const binaryExts = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.mp4', '.webm', '.mp3', '.wav', '.zip', '.rar', '.xlsx', '.xls', '.docx', '.pptx'];

                    if (binaryExts.includes(ext)) {
                        const fileBuffer = fs.readFileSync(filePath);
                        const mimeTypes = {
                            '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                            '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
                            '.bmp': 'image/bmp', '.mp4': 'video/mp4', '.webm': 'video/webm',
                            '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.zip': 'application/zip',
                            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                            '.xls': 'application/vnd.ms-excel', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
                        };
                        const mime = mimeTypes[ext] || 'application/octet-stream';
                        const base64 = fileBuffer.toString('base64');
                        const dataUrl = `data:${mime};base64,${base64}`;

                        ws.send(JSON.stringify({
                            type: 'FILE_CONTENT',
                            requestId: data.requestId,
                            path: safePath,
                            content: dataUrl,
                            size: `${(stat.size / 1024).toFixed(1)} KB`,
                            binary: true
                        }));
                        console.log(`[Read] Served binary file: ${safePath} (${(stat.size / 1024).toFixed(1)} KB)`);
                    } else {
                        const content = fs.readFileSync(filePath, 'utf8');
                        ws.send(JSON.stringify({
                            type: 'FILE_CONTENT',
                            requestId: data.requestId,
                            path: safePath,
                            content: content,
                            size: `${(stat.size / 1024).toFixed(1)} KB`,
                            binary: false
                        }));
                        console.log(`[Read] Served text file: ${safePath} (${(stat.size / 1024).toFixed(1)} KB)`);
                    }
                } catch (err) {
                    console.error(`[Error] Read failed:`, err.message);
                    ws.send(JSON.stringify({ type: 'OP_ERROR', message: `Read failed: ${err.message}` }));
                }
            }

            // --- SolanaTrader Commands (per-user isolated) ---
            if (data.type && data.type.startsWith('TRADER_')) {
                if (!wsAuthUser || !wsAuthUser.id) {
                    ws.send(JSON.stringify({ type: 'TRADER_ERROR', error: 'Authentication required for trader commands' }));
                    return;
                }
                const trader = getTraderForUser(wsAuthUser.id);
                if (!trader) {
                    ws.send(JSON.stringify({ type: 'TRADER_ERROR', error: 'Could not initialize trader' }));
                    return;
                }
                console.log(`[SolanaTrader] ${wsAuthUser.email}: ${data.type}`);
                // Wire broadcast to this WS client
                trader.broadcastFn = (msg) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify(msg));
                    }
                };

                try {
                    switch (data.type) {
                        case 'TRADER_STATUS': {
                            // Timeout getStatus to prevent hanging on RPC
                            const statusPromise = trader.getStatus();
                            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Status timeout')), 8000));
                            let status;
                            try {
                                status = await Promise.race([statusPromise, timeoutPromise]);
                            } catch (e) {
                                console.error('[SolanaTrader] getStatus timeout/error:', e.message);
                                // Return status without balance
                                status = {
                                    type: 'TRADER_STATUS',
                                    walletCreated: !!trader.keypair,
                                    publicKey: trader.keypair ? trader.keypair.publicKey.toBase58() : '',
                                    balance: 0,
                                    isRunning: trader.isRunning,
                                    rules: trader.rules,
                                    recentTrades: trader.tradeLog.slice(0, 30),
                                    lastCheck: trader.lastCheck,
                                };
                            }
                            console.log('[SolanaTrader] Sending status:', JSON.stringify(status).slice(0, 200));
                            ws.send(JSON.stringify(status));
                            break;
                        }
                        case 'TRADER_GENERATE_WALLET': {
                            const result = trader.generateWallet();
                            if (result.error) {
                                ws.send(JSON.stringify({ type: 'TRADER_ERROR', error: result.error }));
                            } else {
                                ws.send(JSON.stringify({ type: 'TRADER_WALLET', publicKey: result.publicKey, mnemonic: result.mnemonic || null }));
                            }
                            break;
                        }
                        case 'TRADER_IMPORT_KEY': {
                            const result = trader.importKey(data.key);
                            if (result.error) {
                                ws.send(JSON.stringify({ type: 'TRADER_ERROR', error: result.error }));
                            } else {
                                ws.send(JSON.stringify({ type: 'TRADER_WALLET', publicKey: result.publicKey }));
                            }
                            break;
                        }
                        case 'TRADER_EXPORT_KEY': {
                            const result = trader.exportKey();
                            if (result.error) {
                                ws.send(JSON.stringify({ type: 'TRADER_ERROR', error: result.error }));
                            } else {
                                ws.send(JSON.stringify({ type: 'TRADER_KEY_EXPORT', secretKey: result.secretKey, mnemonic: result.mnemonic || null }));
                            }
                            break;
                        }
                        case 'TRADER_RESET_WALLET': {
                            trader.resetWallet();
                            ws.send(JSON.stringify({ type: 'TRADER_WALLET_RESET' }));
                            break;
                        }
                        case 'TRADER_START': {
                            await trader.start(data.interval || 30000);
                            ws.send(JSON.stringify({ type: 'TRADER_STARTED' }));
                            break;
                        }
                        case 'TRADER_STOP': {
                            trader.stop();
                            ws.send(JSON.stringify({ type: 'TRADER_STOPPED' }));
                            break;
                        }
                        case 'TRADER_ADD_RULE': {
                            const rule = trader.addRule(data.rule || data);
                            ws.send(JSON.stringify({ type: 'TRADER_RULE_ADDED', rule }));
                            break;
                        }
                        case 'TRADER_REMOVE_RULE': {
                            trader.removeRule(data.ruleId);
                            ws.send(JSON.stringify({ type: 'TRADER_RULE_REMOVED', ruleId: data.ruleId }));
                            break;
                        }
                        case 'TRADER_TOGGLE_RULE': {
                            trader.toggleRule(data.ruleId);
                            ws.send(JSON.stringify({ type: 'TRADER_RULE_TOGGLED', ruleId: data.ruleId }));
                            break;
                        }
                        case 'TRADER_SWAP': {
                            const result = await trader.manualSwap(
                                data.inputMint, data.outputMint, data.amount, data.slippageBps
                            );
                            if (result.error) {
                                ws.send(JSON.stringify({ type: 'TRADER_ERROR', error: result.error }));
                            } else {
                                ws.send(JSON.stringify({ type: 'TRADER_SWAP_RESULT', ...result }));
                            }
                            break;
                        }
                        case 'TRADER_WITHDRAW': {
                            const result = await trader.withdraw(data.destination, data.amount);
                            if (result.error) {
                                ws.send(JSON.stringify({ type: 'TRADER_ERROR', error: result.error }));
                            } else {
                                ws.send(JSON.stringify({ type: 'TRADER_WITHDRAW_RESULT', signature: result.signature }));
                            }
                            break;
                        }
                        case 'TRADER_HISTORY': {
                            ws.send(JSON.stringify({ type: 'TRADER_HISTORY', history: trader.tradeLog.slice(0, 50) }));
                            break;
                        }
                        // Phase 1: Indicators + Strategy Engine
                        case 'TRADER_INDICATORS': {
                            const ind = await trader.getIndicators(data.pair || 'SOL/USDC', data.timeframe || 'day');
                            ws.send(JSON.stringify({ type: 'TRADER_INDICATORS', ...ind }));
                            break;
                        }
                        case 'TRADER_CANDLES': {
                            const result = await trader.getCandles(data.pair || 'SOL/USDC', data.timeframe || 'day', data.limit || 300);
                            ws.send(JSON.stringify({ type: 'TRADER_CANDLES', ...result }));
                            break;
                        }
                        case 'TRADER_SAVE_STRATEGY': {
                            const result = trader.saveStrategy(data.strategy);
                            ws.send(JSON.stringify({ type: 'TRADER_STRATEGIES', ...result }));
                            break;
                        }
                        case 'TRADER_DELETE_STRATEGY': {
                            const result = trader.deleteStrategy(data.name);
                            ws.send(JSON.stringify({ type: 'TRADER_STRATEGIES', ...result }));
                            break;
                        }
                        case 'TRADER_GET_STRATEGIES': {
                            ws.send(JSON.stringify({ type: 'TRADER_STRATEGIES', ...trader.getStrategies() }));
                            break;
                        }
                        case 'TRADER_GET_POSITIONS': {
                            ws.send(JSON.stringify({ type: 'TRADER_POSITIONS', positions: trader.getPositions(data.status || 'all') }));
                            break;
                        }
                        case 'TRADER_EVALUATE': {
                            const result = await trader.evaluateStrategy(data.strategyName, data.pair || 'SOL/USDC');
                            ws.send(JSON.stringify({ type: 'TRADER_EVALUATION', ...result }));
                            break;
                        }
                        // Phase 3: Jupiter Perps
                        case 'TRADER_OPEN_PERP': {
                            const result = await trader.openPerp(data.market, data.side, data.collateralUsd, data.leverage, data.collateralToken);
                            if (result.error) {
                                ws.send(JSON.stringify({ type: 'TRADER_ERROR', error: result.error }));
                            } else {
                                ws.send(JSON.stringify({ type: 'TRADER_PERP_OPENED', ...result }));
                            }
                            break;
                        }
                        case 'TRADER_CLOSE_PERP': {
                            const result = await trader.closePerp(data.positionKey);
                            if (result.error) {
                                ws.send(JSON.stringify({ type: 'TRADER_ERROR', error: result.error }));
                            } else {
                                ws.send(JSON.stringify({ type: 'TRADER_PERP_CLOSED', signature: result.signature }));
                            }
                            break;
                        }
                        case 'TRADER_GET_PERPS': {
                            const result = await trader.getPerps();
                            ws.send(JSON.stringify({ type: 'TRADER_PERPS_POSITIONS', ...result }));
                            break;
                        }
                        case 'TRADER_GET_PERPS_MARKETS': {
                            const result = await trader.getPerpsMarkets();
                            ws.send(JSON.stringify({ type: 'TRADER_PERPS_MARKETS', ...result }));
                            break;
                        }
                        case 'TRADER_KEEP_ALIVE': {
                            trader.keepAlive = data.enabled;
                            console.log(`[SolanaTrader] Keep-alive: ${data.enabled ? 'ON' : 'OFF'}`);
                            ws.send(JSON.stringify({ type: 'TRADER_KEEP_ALIVE_ACK', enabled: data.enabled }));
                            break;
                        }
                        case 'TRADER_PERPS_AUTO': {
                            trader.perpsAutoEnabled = data.enabled;
                            console.log(`[SolanaTrader] Auto perps: ${data.enabled ? 'ON' : 'OFF'}`);
                            ws.send(JSON.stringify({ type: 'TRADER_PERPS_AUTO_ACK', enabled: data.enabled }));
                            break;
                        }
                    }
                } catch (e) {
                    console.error('[SolanaTrader] WS handler error:', e.message);
                    ws.send(JSON.stringify({ type: 'TRADER_ERROR', error: e.message }));
                }
            }

        } catch (e) {
            console.error('[Error] Malformed message:', e.message);
        }
    });

    ws.on('close', () => {
        console.log('[Link] Frontend disconnected.');
    });
});
