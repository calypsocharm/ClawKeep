/*
 * ClawKeep REST API Router
 * Adds /api/* endpoints to the HTTP server for persistent CRUD
 */

const { getAll, getById, insert, update, deleteById, deleteAll, getConfig, setConfig, bulkInsert } = require('./db.cjs');

// --- Helper: Parse JSON body from IncomingMessage ---
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch (e) { reject(new Error('Invalid JSON')); }
        });
        req.on('error', reject);
    });
}

// --- Helper: Send JSON response ---
function json(res, data, status = 200) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(JSON.stringify(data));
}

// --- CRUD route factory ---
function crudRoutes(table) {
    return {
        async GET(req, res, id) {
            if (id) {
                const row = getById(table, id);
                if (!row) return json(res, { error: 'Not found' }, 404);
                // Parse JSON fields
                return json(res, parseJsonFields(row));
            }
            const rows = getAll(table).map(parseJsonFields);
            json(res, rows);
        },
        async POST(req, res) {
            const body = await parseBody(req);
            if (!body.id) body.id = `${table.slice(0, -1)}_${Date.now()}`;
            insert(table, body);
            json(res, body, 201);
        },
        async PUT(req, res, id) {
            if (!id) return json(res, { error: 'ID required' }, 400);
            const body = await parseBody(req);
            update(table, id, body);
            const updated = getById(table, id);
            json(res, parseJsonFields(updated || {}));
        },
        async DELETE(req, res, id) {
            if (!id) return json(res, { error: 'ID required' }, 400);
            deleteById(table, id);
            json(res, { success: true });
        }
    };
}

// Parse JSON string fields (tags, items) back to arrays
function parseJsonFields(row) {
    if (!row) return row;
    const out = { ...row };
    for (const key of ['tags', 'items']) {
        if (typeof out[key] === 'string') {
            try { out[key] = JSON.parse(out[key]); } catch { }
        }
    }
    return out;
}

// --- Route Table ---
const tables = {
    tasks: crudRoutes('tasks'),
    agents: crudRoutes('agents'),
    expenses: crudRoutes('expenses'),
    checklists: crudRoutes('checklists'),
    chat: crudRoutes('chat_messages'),
    contacts: crudRoutes('contacts'),
    cron: crudRoutes('cron_jobs'),
    events: crudRoutes('events'),
    documents: crudRoutes('documents'),
    memories: crudRoutes('memories'),
    agent_logs: crudRoutes('agent_logs')
};

// --- Main API handler ---
async function handleApiRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.split('/').filter(Boolean); // ['api', 'tasks', 'id?']

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        return res.end();
    }

    if (parts[0] !== 'api') return false;

    const resource = parts[1]; // 'tasks', 'agents', etc.
    const id = parts[2] || null;

    // --- Special: /api/config ---
    if (resource === 'config') {
        if (req.method === 'GET') {
            const key = id;
            if (key) {
                const val = getConfig(key);
                return json(res, { key, value: val });
            }
            // Return all config
            const { getAll: ga } = require('./db.cjs');
            const all = ga('config');
            const configMap = {};
            all.forEach(row => {
                try { configMap[row.key] = JSON.parse(row.value); } catch { configMap[row.key] = row.value; }
            });
            return json(res, configMap);
        }
        if (req.method === 'PUT' || req.method === 'POST') {
            const body = await parseBody(req);
            if (body.key && body.value !== undefined) {
                setConfig(body.key, body.value);
                return json(res, { success: true });
            }
            // Bulk set
            for (const [k, v] of Object.entries(body)) {
                setConfig(k, v);
            }
            return json(res, { success: true });
        }
    }

    // --- Special: /api/sync (bulk upload all data) ---
    if (resource === 'sync') {
        if (req.method === 'POST') {
            const body = await parseBody(req);
            const synced = [];
            for (const [table, items] of Object.entries(body)) {
                if (tables[table] && Array.isArray(items) && items.length > 0) {
                    const dbTable = table === 'chat' ? 'chat_messages' : table === 'cron' ? 'cron_jobs' : table;
                    bulkInsert(dbTable, items);
                    synced.push(`${table}: ${items.length}`);
                }
            }
            return json(res, { success: true, synced });
        }
    }

    // --- Special: /api/sync/pull (download all data at once) ---
    if (resource === 'sync' && parts[2] === 'pull') {
        if (req.method === 'GET') {
            const data = {};
            for (const name of Object.keys(tables)) {
                const dbTable = name === 'chat' ? 'chat_messages' : name === 'cron' ? 'cron_jobs' : name;
                data[name] = getAll(dbTable).map(parseJsonFields);
            }
            data.config = {};
            getAll('config').forEach(row => {
                try { data.config[row.key] = JSON.parse(row.value); } catch { data.config[row.key] = row.value; }
            });
            return json(res, data);
        }
    }

    // --- Standard CRUD ---
    const handler = tables[resource];
    if (!handler) {
        return json(res, { error: `Unknown resource: ${resource}` }, 404);
    }

    try {
        const method = req.method;
        if (handler[method]) {
            await handler[method](req, res, id);
        } else {
            json(res, { error: `Method ${method} not allowed` }, 405);
        }
    } catch (err) {
        console.error(`[API] Error:`, err.message);
        json(res, { error: err.message }, 500);
    }

    return true;
}

module.exports = { handleApiRequest };
