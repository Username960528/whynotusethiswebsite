const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'content.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create contents table with new fields
db.exec(`
    CREATE TABLE IF NOT EXISTS contents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('text', 'link', 'file')),
        content TEXT,
        file_path TEXT,
        file_name TEXT,
        auto_delete INTEGER DEFAULT 0,
        delete_after_minutes INTEGER DEFAULT 1,
        burn_after_read INTEGER DEFAULT 0,
        ip_restriction INTEGER DEFAULT 0,
        first_viewed_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        deleted INTEGER DEFAULT 0
    )
`);

// Add new columns if they don't exist (for existing databases)
try {
    db.exec(`ALTER TABLE contents ADD COLUMN burn_after_read INTEGER DEFAULT 0`);
} catch (e) { /* column already exists */ }

try {
    db.exec(`ALTER TABLE contents ADD COLUMN ip_restriction INTEGER DEFAULT 0`);
} catch (e) { /* column already exists */ }

// Create IP views tracking table
db.exec(`
    CREATE TABLE IF NOT EXISTS content_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_id INTEGER NOT NULL,
        ip_address TEXT NOT NULL,
        viewed_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (content_id) REFERENCES contents(id),
        UNIQUE(content_id, ip_address)
    )
`);

// Create indexes for faster lookups
db.exec(`CREATE INDEX IF NOT EXISTS idx_uuid ON contents(uuid)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_deleted ON contents(deleted)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_content_views ON content_views(content_id, ip_address)`);

module.exports = db;
