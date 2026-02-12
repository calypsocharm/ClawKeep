// Run on VPS: node migrate.cjs
const { db } = require('./db.cjs');

// Add missing columns to existing tables (ALTER TABLE is safe – ignores if column exists)
const alterSafe = (sql) => {
  try { db.exec(sql); } catch (e) {
    if (!e.message.includes('duplicate column')) console.warn('[MIGRATE]', e.message);
  }
};

// Agents table fixes
alterSafe('ALTER TABLE agents ADD COLUMN color TEXT DEFAULT ""');
alterSafe('ALTER TABLE agents ADD COLUMN lastDirective TEXT DEFAULT ""');

// Checklists table fixes
alterSafe('ALTER TABLE checklists ADD COLUMN emoji TEXT DEFAULT ""');

// New tables
db.exec(`
  CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    fact TEXT NOT NULL,
    category TEXT DEFAULT 'GENERAL',
    source TEXT DEFAULT 'conversation',
    confidence REAL DEFAULT 0.8,
    createdAt TEXT DEFAULT (datetime('now')),
    lastAccessed TEXT DEFAULT (datetime('now')),
    accessCount INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS agent_logs (
    id TEXT PRIMARY KEY,
    agentId TEXT NOT NULL,
    type TEXT DEFAULT 'REPORT',
    content TEXT NOT NULL,
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

console.log('[MIGRATE] All migrations applied');
