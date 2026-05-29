const express = require('express');
const cors = require('express');
const { Pool } = require('pg');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

const app = express();
app.use(express.json());

// Enable CORS for frontend communication
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' ? false : true, // Adjust based on your setup
    credentials: true,
};
app.use(require('cors')(corsOptions));

// ==========================================
// --- DATABASE CONNECTION POOL ---
// ==========================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Database Initialization (Auto-run migrations)
const initDb = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS folders (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                user_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS snippets (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                code TEXT NOT NULL,
                image_url TEXT,
                user_id VARCHAR(255) NOT NULL,
                folder_id INT REFERENCES folders(id) ON DELETE SET NULL,
                type VARCHAR(50) DEFAULT 'code',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Database schema initialized successfully.");
    } catch (err) {
        console.error("Database initialization error:", err.message);
    }
};
initDb();

// ==========================================
// --- AWS S3 CONFIGURATION ---
// ==========================================
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

// Generate Pre-signed URL for direct S3 uploads
app.post('/api/storage/presigned-url', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const { fileName, fileType } = req.body;
        const userId = req.auth.userId;
        const uniqueFileName = `${userId}-${Date.now()}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: uniqueFileName,
            ContentType: fileType,
        });

        // URL expires in 60 seconds for security
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });
        const publicUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;

        res.json({ uploadUrl, publicUrl });
    } catch (error) {
        console.error("S3 Presigned URL error:", error.message);
        res.status(500).json({ error: "Failed to generate upload access window." });
    }
});

// ==========================================
// --- FOLDERS ENDPOINTS ---
// ==========================================
app.get('/api/folders', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const result = await pool.query('SELECT * FROM folders WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/folders', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const { name } = req.body;
        const userId = req.auth.userId;
        const result = await pool.query(
            'INSERT INTO folders (name, user_id) VALUES ($1, $2) RETURNING *',
            [name, userId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/folders/:id', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.auth.userId;
        await pool.query('DELETE FROM folders WHERE id = $1 AND user_id = $2', [id, userId]);
        res.json({ message: "Folder deleted successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// --- SNIPPETS ENDPOINTS ---
// ==========================================
app.get('/api/snippets', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const result = await pool.query('SELECT * FROM snippets WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/snippets', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const { title, code, image_url, folder_id, type } = req.body;
        const userId = req.auth.userId;
        const result = await pool.query(
            'INSERT INTO snippets (title, code, image_url, folder_id, user_id, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title, code, image_url, folder_id || null, userId, type || 'code']
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/snippets/:id', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.auth.userId;
        await pool.query('DELETE FROM snippets WHERE id = $1 AND user_id = $2', [id, userId]);
        res.json({ message: "Snippet deleted successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// --- NATIVE IN-HOUSE COMPILER ROUTE ---
// ==========================================
app.post('/api/execute', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const { source_code, language } = req.body;
        
        // Generate a unique ID so multiple execution requests don't collide
        const fileId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        let filePath, command, outPath;

        // 1. Prepare execution profile matching runtime languages
        if (language === 'python') {
            filePath = path.join(__dirname, `${fileId}.py`);
            await fs.writeFile(filePath, source_code);
            command = `python3 ${filePath}`;
        } else if (language === 'javascript') {
            filePath = path.join(__dirname, `${fileId}.js`);
            await fs.writeFile(filePath, source_code);
            command = `node ${filePath}`;
        } else if (language === 'cpp' || language === 'c') {
            const ext = language === 'cpp' ? 'cpp' : 'c';
            const compiler = language === 'cpp' ? 'g++' : 'gcc';
            filePath = path.join(__dirname, `${fileId}.${ext}`);
            outPath = path.join(__dirname, `${fileId}.out`);
            await fs.writeFile(filePath, source_code);
            // Compile sequence then immediate run
            command = `${compiler} ${filePath} -o ${outPath} && ${outPath}`;
        } else {
            return res.status(400).json({ error: "Unsupported language" });
        }

        // 2. Execute process securely utilizing native architecture with 5-second defensive timeout
        exec(command, { timeout: 5000 }, async (error, stdout, stderr) => {
            
            // 3. Complete system disk garbage collection
            try {
                await fs.unlink(filePath).catch(() => {});
                if (outPath) await fs.unlink(outPath).catch(() => {});
            } catch (cleanupErr) {
                console.error("Cleanup error:", cleanupErr);
            }

            // 4. Send back evaluation payload
            if (error) {
                return res.json({ error: stderr || error.message });
            }
            res.json({ output: stdout || "Execution finished with no output." });
        });

    } catch (error) {
        console.error("Native Execution Error:", error.message);
        res.status(500).json({ error: "Failed to execute code natively." });
    }
});

// Global central authorization error boundary handling
app.use((err, req, res, next) => {
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Authentication missing or token expired.' });
    }
    res.status(500).json({ error: 'Internal system error occurred.' });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
    console.log(`Backend runtime execution server deployed securely on port ${PORT}`);
});