const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
     fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for file uploads
const storage = multer.diskStorage({
     destination: (req, file, cb) => {
          cb(null, uploadsDir);
     },
     filename: (req, file, cb) => {
          const uniqueName = `${uuidv4()}-${file.originalname}`;
          cb(null, uniqueName);
     }
});

const upload = multer({
     storage,
     limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
     fileFilter: (req, file, cb) => {
          // Allow images only
          const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
          if (allowedTypes.includes(file.mimetype)) {
               cb(null, true);
          } else {
               cb(new Error('Only image files are allowed'), false);
          }
     }
});

// Cleanup function - delete expired content
function cleanupExpiredContent() {
     const now = Math.floor(Date.now() / 1000);

     // Find all expired content
     const expiredItems = db.prepare(`
        SELECT * FROM contents 
        WHERE deleted = 0 
        AND auto_delete = 1 
        AND first_viewed_at IS NOT NULL 
        AND (first_viewed_at + (delete_after_minutes * 60)) < ?
    `).all(now);

     expiredItems.forEach(item => {
          // Delete file if exists
          if (item.file_path && fs.existsSync(item.file_path)) {
               fs.unlinkSync(item.file_path);
          }

          // Mark as deleted
          db.prepare('UPDATE contents SET deleted = 1 WHERE id = ?').run(item.id);
          console.log(`Deleted expired content: ${item.uuid}`);
     });
}

// Run cleanup every 30 seconds
setInterval(cleanupExpiredContent, 30000);

// API Routes

// Create new content
app.post('/api/content', upload.single('file'), (req, res) => {
     try {
          const { type, content, autoDelete, deleteAfterMinutes, burnAfterRead, ipRestriction } = req.body;
          const uuid = uuidv4();

          let filePath = null;
          let fileName = null;

          if (req.file) {
               filePath = req.file.path;
               fileName = req.file.originalname;
          }

          const stmt = db.prepare(`
            INSERT INTO contents (uuid, type, content, file_path, file_name, auto_delete, delete_after_minutes, burn_after_read, ip_restriction)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

          stmt.run(
               uuid,
               type || 'text',
               content || null,
               filePath,
               fileName,
               autoDelete === 'true' || autoDelete === true ? 1 : 0,
               parseInt(deleteAfterMinutes) || 1,
               burnAfterRead === 'true' || burnAfterRead === true ? 1 : 0,
               ipRestriction === 'true' || ipRestriction === true ? 1 : 0
          );

          res.json({
               success: true,
               uuid,
               url: `/view/${uuid}`
          });
     } catch (error) {
          console.error('Error creating content:', error);
          res.status(500).json({ success: false, error: error.message });
     }
});

// Get content by UUID
app.get('/api/content/:uuid', (req, res) => {
     try {
          const { uuid } = req.params;
          const now = Math.floor(Date.now() / 1000);

          // Get client IP (from X-Forwarded-For or direct connection)
          const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
               || req.headers['x-real-ip']
               || req.socket.remoteAddress
               || 'unknown';

          const item = db.prepare('SELECT * FROM contents WHERE uuid = ? AND deleted = 0').get(uuid);

          if (!item) {
               return res.status(404).json({ success: false, error: 'Контент не найден или был удалён' });
          }

          // Check IP restriction
          if (item.ip_restriction) {
               const existingView = db.prepare(
                    'SELECT * FROM content_views WHERE content_id = ? AND ip_address = ?'
               ).get(item.id, clientIP);

               if (existingView) {
                    return res.status(403).json({
                         success: false,
                         error: 'Этот контент уже был просмотрен с вашего IP-адреса'
                    });
               }
          }

          // Check if already expired (for auto_delete with timer)
          if (item.auto_delete && item.first_viewed_at) {
               const expiresAt = item.first_viewed_at + (item.delete_after_minutes * 60);
               if (now > expiresAt) {
                    // Mark as deleted
                    db.prepare('UPDATE contents SET deleted = 1 WHERE id = ?').run(item.id);
                    if (item.file_path && fs.existsSync(item.file_path)) {
                         fs.unlinkSync(item.file_path);
                    }
                    return res.status(404).json({ success: false, error: 'Срок действия контента истёк' });
               }
          }

          // Record IP view (for IP restriction tracking)
          if (item.ip_restriction) {
               try {
                    db.prepare('INSERT INTO content_views (content_id, ip_address) VALUES (?, ?)').run(item.id, clientIP);
               } catch (e) { /* ignore duplicate */ }
          }

          // If first view with auto_delete, record the time
          if (item.auto_delete && !item.first_viewed_at) {
               db.prepare('UPDATE contents SET first_viewed_at = ? WHERE id = ?').run(now, item.id);
               item.first_viewed_at = now;
          }

          // Calculate remaining time
          let remainingSeconds = null;
          if (item.auto_delete && item.first_viewed_at) {
               const expiresAt = item.first_viewed_at + (item.delete_after_minutes * 60);
               remainingSeconds = Math.max(0, expiresAt - now);
          }

          // Check for burn after read - delete AFTER sending response
          const shouldBurn = item.burn_after_read === 1;

          res.json({
               success: true,
               content: {
                    type: item.type,
                    content: item.content,
                    fileName: item.file_name,
                    hasFile: !!item.file_path,
                    autoDelete: item.auto_delete === 1,
                    burnAfterRead: shouldBurn,
                    ipRestriction: item.ip_restriction === 1,
                    remainingSeconds,
                    createdAt: item.created_at
               }
          });

          // Burn after read - delete content after sending response
          if (shouldBurn) {
               setTimeout(() => {
                    if (item.file_path && fs.existsSync(item.file_path)) {
                         fs.unlinkSync(item.file_path);
                    }
                    db.prepare('UPDATE contents SET deleted = 1 WHERE id = ?').run(item.id);
                    console.log(`Burned content after read: ${uuid}`);
               }, 100);
          }

     } catch (error) {
          console.error('Error getting content:', error);
          res.status(500).json({ success: false, error: error.message });
     }
});

// Download file
app.get('/api/content/:uuid/download', (req, res) => {
     try {
          const { uuid } = req.params;
          const item = db.prepare('SELECT * FROM contents WHERE uuid = ? AND deleted = 0').get(uuid);

          if (!item || !item.file_path) {
               return res.status(404).json({ success: false, error: 'File not found' });
          }

          if (!fs.existsSync(item.file_path)) {
               return res.status(404).json({ success: false, error: 'File not found on server' });
          }

          res.download(item.file_path, item.file_name);
     } catch (error) {
          console.error('Error downloading file:', error);
          res.status(500).json({ success: false, error: error.message });
     }
});

// Delete content manually
app.delete('/api/content/:uuid', (req, res) => {
     try {
          const { uuid } = req.params;
          const item = db.prepare('SELECT * FROM contents WHERE uuid = ?').get(uuid);

          if (item && item.file_path && fs.existsSync(item.file_path)) {
               fs.unlinkSync(item.file_path);
          }

          db.prepare('UPDATE contents SET deleted = 1 WHERE uuid = ?').run(uuid);

          res.json({ success: true });
     } catch (error) {
          console.error('Error deleting content:', error);
          res.status(500).json({ success: false, error: error.message });
     }
});

// Serve uploaded files (for images preview)
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/api/health', (req, res) => {
     res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
     console.log(`Server running on port ${PORT}`);
     // Run initial cleanup
     cleanupExpiredContent();
});
