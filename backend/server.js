const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001; // Using 5001 to avoid conflicts with Mac default services

// Middleware
app.use(cors());
app.use(express.json()); // Allows our server to read JSON data sent from React

// Sample Route (We will connect Oracle and S3 here later)
app.get('/api/snippets', (req, res) => {
    res.json([
        { id: 1, title: "C++ Binary Search", code: "bool search(int arr[], int n, int x) { ... }" },
        { id: 2, title: "React State Hook", code: "const [data, setData] = useState(null);" }
    ]);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Backend API server running on port ${PORT}`);
});