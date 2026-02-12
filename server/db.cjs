/*
 * ClawKeep Database Module (SQLite)
 * Persistent storage for all Claw data
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'claw.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// --- Schema Initialization ---
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'TODO',
    priority TEXT DEFAULT 'MEDIUM',
    dueDate TEXT,
    tags TEXT DEFAULT '[]',
    emoji TEXT DEFAULT '',
    color TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now')),
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'MISC',
    type TEXT DEFAULT 'NOTE',
    status TEXT DEFAULT 'ACTIVE',
    lastModified TEXT DEFAULT (datetime('now')),
    content TEXT DEFAULT '',
    size TEXT DEFAULT '',
    emoji TEXT DEFAULT '',
    color TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mascot TEXT DEFAULT '',
    specialty TEXT DEFAULT '',
    quest TEXT DEFAULT '',
    status TEXT DEFAULT 'ACTIVE',
    color TEXT DEFAULT '',
    lastDirective TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT DEFAULT 'OTHER',
    date TEXT DEFAULT (datetime('now')),
    notes TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS checklists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    items TEXT DEFAULT '[]',
    category TEXT DEFAULT 'GENERAL',
    emoji TEXT DEFAULT '',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT DEFAULT '',
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    role TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cron_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    command TEXT NOT NULL,
    schedule TEXT NOT NULL,
    lastRun TEXT,
    nextRun TEXT,
    status TEXT DEFAULT 'ACTIVE',
    channel TEXT DEFAULT 'silent'
  );

  CREATE TABLE IF NOT EXISTS config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT DEFAULT '',
    type TEXT DEFAULT 'MEETING',
    description TEXT DEFAULT '',
    color TEXT DEFAULT ''
  );
`);

console.log(`[DB] SQLite initialized at ${DB_PATH}`);

// --- Generic CRUD Helpers ---

function getAll(table) {
  return db.prepare(`SELECT * FROM ${table} ORDER BY rowid DESC`).all();
}

function getById(table, id) {
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
}

function insert(table, data) {
  const keys = Object.keys(data);
  const placeholders = keys.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`);
  return stmt.run(...keys.map(k => {
    const v = data[k];
    // Serialize arrays/objects as JSON
    return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  }));
}

function update(table, id, data) {
  const keys = Object.keys(data).filter(k => k !== 'id');
  if (keys.length === 0) return null;
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const stmt = db.prepare(`UPDATE ${table} SET ${setClause}, updatedAt = datetime('now') WHERE id = ?`);
  return stmt.run(...keys.map(k => {
    const v = data[k];
    return (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  }), id);
}

function deleteById(table, id) {
  return db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
}

function deleteAll(table) {
  return db.prepare(`DELETE FROM ${table}`).run();
}

// Config helpers
function getConfig(key) {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setConfig(key, value) {
  const serialized = typeof value === 'object' ? JSON.stringify(value) : String(value);
  db.prepare('INSERT OR REPLACE INTO config (key, value, updatedAt) VALUES (?, ?, datetime("now"))').run(key, serialized);
}

// Bulk insert (for syncing)
function bulkInsert(table, items) {
  const tx = db.transaction((rows) => {
    for (const row of rows) {
      insert(table, row);
    }
  });
  tx(items);
}

module.exports = {
  db,
  getAll,
  getById,
  insert,
  update,
  deleteById,
  deleteAll,
  getConfig,
  setConfig,
  bulkInsert
};
