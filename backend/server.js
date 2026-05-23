const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

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

// Initialize Database Connection & Schema
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://vault_user:vault_password@db:5432/vault_db'
});

pool.query(`
  CREATE TABLE IF NOT EXISTS snippets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    code TEXT NOT NULL,
    image_url TEXT
  );
  -- If the table already exists from yesterday, this safely adds the new column!
  ALTER TABLE snippets ADD COLUMN IF NOT EXISTS image_url TEXT;
`).then(() => {
    console.log("Database table verified with image support.");
}).catch(err => console.error("Database connection error:", err));


// --- ROUTES ---

// 1. Fetch Snippets from the Database
app.get('/api/snippets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM snippets ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// 2. Add a New Snippet to the Database
app.post('/api/snippets', async (req, res) => {
    try {
        const { title, code, imageUrl } = req.body;
        
        const result = await pool.query(
            'INSERT INTO snippets (title, code, image_url) VALUES ($1, $2, $3) RETURNING *',
            [title, code, imageUrl]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save snippet" });
    }
});

// 3. Generate S3 Upload URL
app.post('/api/upload-url', async (req, res) => {
    try {
        const { fileName, fileType } = req.body;
        const uniqueFileName = `${Date.now()}-${fileName}`;
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

// 4. UPDATE a Snippet
app.put('/api/snippets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, code } = req.body;
        const result = await pool.query(
            'UPDATE snippets SET title = $1, code = $2 WHERE id = $3 RETURNING *',
            [title, code, id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update snippet" });
    }
});

// 5. DELETE a Snippet
app.delete('/api/snippets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM snippets WHERE id = $1', [id]);
        res.json({ message: "Snippet deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete snippet" });
    }
});

// --- SERVER STARTUP ---
// THIS MUST ALWAYS BE THE VERY LAST THING IN THE FILE!
app.listen(PORT, () => {
    console.log(`Backend API server running on port ${PORT}`);
});