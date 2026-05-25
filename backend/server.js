const express = require('express');
const cors = require('cors');
const axios = require('axios'); 
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Pool } = require('pg');
const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// Initialize AWS S3
const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
});

// Initialize Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://vault_user:vault_password@db:5432/vault_db'
});


// ==========================================
// --- MULTI-TENANCY & TYPE MIGRATION ---
// ==========================================
pool.query(`
  ALTER TABLE snippets ADD COLUMN IF NOT EXISTS user_id VARCHAR(255);
  
  CREATE TABLE IF NOT EXISTS folders (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  ALTER TABLE snippets ADD COLUMN IF NOT EXISTS folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL;
  ALTER TABLE snippets ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'code';
`).then(() => {
    console.log("Database tables verified with folder and type support.");
}).catch(err => console.error("Database connection error:", err));


// ==========================================
// --- FOLDER ROUTES ---
// ==========================================

app.get('/api/folders', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const result = await pool.query('SELECT * FROM folders WHERE user_id = $1 ORDER BY created_at ASC', [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch folders" });
    }
});

app.post('/api/folders', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { name } = req.body;
        const result = await pool.query(
            'INSERT INTO folders (name, user_id) VALUES ($1, $2) RETURNING *',
            [name, userId]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create folder" });
    }
});

app.delete('/api/folders/:id', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { id } = req.params;
        await pool.query('DELETE FROM folders WHERE id = $1 AND user_id = $2', [id, userId]);
        res.json({ message: "Folder deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete folder" });
    }
});


// ==========================================
// --- SNIPPET ROUTES ---
// ==========================================

app.get('/api/snippets', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const result = await pool.query('SELECT * FROM snippets WHERE user_id = $1 ORDER BY id DESC', [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

app.post('/api/snippets', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { title, code, imageUrl, folderId, type } = req.body; 
        
        const result = await pool.query(
            'INSERT INTO snippets (title, code, image_url, user_id, folder_id, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [title, code, imageUrl, userId, folderId || null, type || 'code'] 
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save snippet" });
    }
});

app.put('/api/snippets/:id', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { id } = req.params;
        const { title, code, folderId, type } = req.body;
        
        const result = await pool.query(
            'UPDATE snippets SET title = $1, code = $2, folder_id = $3, type = $4 WHERE id = $5 AND user_id = $6 RETURNING *',
            [title, code, folderId || null, type || 'code', id, userId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update snippet" });
    }
});

app.delete('/api/snippets/:id', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const userId = req.auth.userId;
        const { id } = req.params;
        await pool.query('DELETE FROM snippets WHERE id = $1 AND user_id = $2', [id, userId]);
        res.json({ message: "Snippet deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete snippet" });
    }
});


// ==========================================
// --- AWS S3 UPLOAD ROUTE ---
// ==========================================

app.post('/api/upload-url', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const { fileName, fileType } = req.body;
        const uniqueFileName = `${req.auth.userId}-${Date.now()}-${fileName}`;
        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: uniqueFileName,
            ContentType: fileType,
        });
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });
        const publicUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;
        res.json({ uploadUrl, publicUrl });
    } catch (error) {
        console.error("Error generating presigned URL:", error);
        res.status(500).json({ error: "Failed to generate upload URL" });
    }
});


// ==========================================
// --- HYBRID PISTON COMPILER ROUTE ---
// ==========================================

app.post('/api/execute', ClerkExpressRequireAuth(), async (req, res) => {
    try {
        const { source_code, language, stdin } = req.body;

        // 1. Define highly stable fallback versions
        const fallbackVersions = {
            'javascript': '18.15.0',
            'python': '3.10.0',
            'cpp': '10.2.0',
            'c': '10.2.0'
        };

        let targetVersion = fallbackVersions[language] || '*';

        // 2. Attempt to fetch live versions (with a strict 3-second timeout so it doesn't hang)
        try {
            const runtimesRes = await axios.get('https://emkc.org/api/v2/piston/runtimes', { timeout: 3000 });
            const runtime = runtimesRes.data.find(r => r.language === language || r.aliases.includes(language));
            if (runtime) {
                targetVersion = runtime.version;
            }
        } catch (fetchError) {
            console.log(`Dynamic fetch failed, using fallback version ${targetVersion} for ${language}`);
        }

        // 3. Execute the code
        const response = await axios.post('https://emkc.org/api/v2/piston/execute', {
            language: language,
            version: targetVersion,
            files: [{ content: source_code }],
            stdin: stdin || ""
        });

        // 4. Return standard output or compilation errors
        res.json({
            output: response.data.run.stdout,
            error: response.data.run.stderr || (response.data.compile && response.data.compile.stderr)
        });

    } catch (error) {
        console.error("Execution API Error:", error.message);
        if (error.response) {
            console.error("Piston Response Data:", error.response.data);
        }
        res.status(500).json({ error: "Execution failed. Check backend logs for exact details." });
    }
});


// ==========================================
// --- SERVER STARTUP ---
// ==========================================
app.listen(PORT, () => {
    console.log(`Backend API server running on port ${PORT}`);
});