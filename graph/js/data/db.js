const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const uuidv4 = () => crypto.randomUUID();

const DB_PATH = path.join(__dirname, '../../data/learning_graph.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
     fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
     if (err) {
          console.error('Error opening database:', err.message);
     } else {
          console.log('Connected to the SQLite database.');
          initSchema();
     }
});

function initSchema() {
     db.serialize(() => {
          db.run(`CREATE TABLE IF NOT EXISTS graphs (
            id TEXT PRIMARY KEY,
            name TEXT,
            username TEXT DEFAULT 'anonymous',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

          db.run(`CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            graph_id TEXT,
            label TEXT,
            description TEXT,
            category TEXT,
            x REAL,
            y REAL,
            z REAL,
            FOREIGN KEY(graph_id) REFERENCES graphs(id) ON DELETE CASCADE
        )`);

          db.run(`CREATE TABLE IF NOT EXISTS edges (
            id TEXT PRIMARY KEY, -- Composite key simulation or just unique id
            graph_id TEXT,
            from_node TEXT,
            to_node TEXT,
            type TEXT,
            label TEXT,
            FOREIGN KEY(graph_id) REFERENCES graphs(id) ON DELETE CASCADE
        )`);
     });
}

// Helper to wrap db.run in Promise
function run(sql, params = []) {
     return new Promise((resolve, reject) => {
          db.run(sql, params, function (err) {
               if (err) reject(err);
               else resolve(this);
          });
     });
}

// Helper to wrap db.all in Promise
function all(sql, params = []) {
     return new Promise((resolve, reject) => {
          db.all(sql, params, (err, rows) => {
               if (err) reject(err);
               else resolve(rows);
          });
     });
}

// Helper to wrap db.get in Promise
function get(sql, params = []) {
     return new Promise((resolve, reject) => {
          db.get(sql, params, (err, row) => {
               if (err) reject(err);
               else resolve(row);
          });
     });
}

const DB = {
     async createGraph(name = 'Untitled Graph', username = 'anonymous') {
          const id = uuidv4();
          await run('INSERT INTO graphs (id, name, username) VALUES (?, ?, ?)', [id, name, username]);
          return id;
     },

     async getGraph(id) {
          const graph = await get('SELECT * FROM graphs WHERE id = ?', [id]);
          if (!graph) return null;

          const nodes = await all('SELECT * FROM nodes WHERE graph_id = ?', [id]);
          const edges = await all('SELECT * FROM edges WHERE graph_id = ?', [id]);

          // Transform for frontend (renaming columns if needed, but we used compatible names)
          // Edges in DB: from_node, to_node. Frontend: from, to.
          const mappedEdges = edges.map(e => ({
               ...e,
               from: e.from_node,
               to: e.to_node,
               edgeType: e.type // Frontend uses edgeType
          }));

          return { ...graph, nodes, edges: mappedEdges };
     },

     async updateGraph(id, nodes, edges, name) {
          return new Promise((resolve, reject) => {
               db.serialize(async () => {
                    try {
                         await run('BEGIN TRANSACTION');

                         // Update graph metadata
                         if (name) {
                              await run('UPDATE graphs SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, id]);
                         } else {
                              await run('UPDATE graphs SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
                         }

                         // Delete existing
                         await run('DELETE FROM nodes WHERE graph_id = ?', [id]);
                         await run('DELETE FROM edges WHERE graph_id = ?', [id]);

                         // Insert new nodes
                         const nodeStmt = db.prepare('INSERT INTO nodes (id, graph_id, label, description, category, x, y, z) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
                         for (const n of nodes) {
                              await new Promise((res, rej) => {
                                   nodeStmt.run(n.id, id, n.label, n.description || '', n.category, n.x || 0, n.y || 0, n.z || 0, (err) => {
                                        if (err) rej(err);
                                        else res();
                                   });
                              });
                         }
                         nodeStmt.finalize();

                         // Insert new edges
                         const edgeStmt = db.prepare('INSERT INTO edges (id, graph_id, from_node, to_node, type, label) VALUES (?, ?, ?, ?, ?, ?)');
                         for (const e of edges) {
                              const edgeId = e.id || uuidv4();
                              await new Promise((res, rej) => {
                                   edgeStmt.run(edgeId, id, e.from, e.to, e.edgeType || 'causal', e.label || '', (err) => {
                                        if (err) rej(err);
                                        else res();
                                   });
                              });
                         }
                         edgeStmt.finalize();

                         await run('COMMIT');
                         resolve();
                    } catch (error) {
                         await run('ROLLBACK');
                         reject(error);
                    }
               });
          });
     },

     async getRecentGraphs(limit = 10, username = null) {
          if (username) {
               return await all('SELECT id, name, updated_at, username FROM graphs WHERE username = ? ORDER BY updated_at DESC LIMIT ?', [username, limit]);
          } else {
               // For backward compatibility or admin view, maybe show all? 
               // Or just anonymous ones? Let's show all for now if no user specified, 
               // but frontend should always send user.
               return await all('SELECT id, name, updated_at, username FROM graphs ORDER BY updated_at DESC LIMIT ?', [limit]);
          }
     }
};

module.exports = DB;
