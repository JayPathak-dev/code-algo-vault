const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Pool } = require('pg'); // NEW: Import Postgres driver
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

// NEW: Initialize Database Connection
const pool = new Pool({
    // Docker automatically translates 'db' to the Postgres container's internal IP!
    connectionString: process.env.DATABASE_URL || 'postgres://vault_user:vault_password@db:5432/vault_db'
});

// NEW: Auto-create table on startup and insert a test row
pool.query(`
  CREATE TABLE IF NOT EXISTS snippets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    code TEXT NOT NULL
  );
`).then(() => {
    console.log("Database table verified.");
    // Insert a dummy row just so we have something to see!
    pool.query(`INSERT INTO snippets (title, code) VALUES ('Hello DB', 'console.log("Fetched from Postgres!");') ON CONFLICT DO NOTHING;`);
}).catch(err => console.error("Database connection error:", err));


// UPDATED Route: Fetch Snippets from the Database
app.get('/api/snippets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM snippets ORDER BY id DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

// Existing Route: Generate S3 Upload URL
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

app.listen(PORT, () => {
    console.log(`Backend API server running on port ${PORT}`);
});