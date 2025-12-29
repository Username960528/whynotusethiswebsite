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

// Create contents table
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
        first_viewed_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        deleted INTEGER DEFAULT 0
    )
`);

// Create index for faster lookups
db.exec(`CREATE INDEX IF NOT EXISTS idx_uuid ON contents(uuid)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_deleted ON contents(deleted)`);

module.exports = db;
