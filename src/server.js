const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const checkLinks = require('./scanners/linkChecker');
const checkSecurity = require('./scanners/securityChecker');
const checkSeoAndAccessibility = require('./scanners/seoAccessibilityChecker');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../public')));

// Rate Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

// SQLite Database Setup
const dbPath = path.resolve(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            url TEXT,
            score INTEGER,
            data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Real Scan API Route
app.post('/api/scan', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Run scanner modules
        const linkIssues = await checkLinks(url);
        const securityIssues = await checkSecurity(url);
        const seoA11yIssues = await checkSeoAndAccessibility(url);

        const allIssues = [...linkIssues, ...securityIssues, ...seoA11yIssues];
        
        // Calculate basic score out of 100
        let score = 100 - (allIssues.length * 15);
        if (score < 20) score = 20;

        const scanResult = {
            url,
            score,
            issues: allIssues
        };

        // Save report into SQLite database
        db.run(
            `INSERT INTO reports (url, score, data) VALUES (?, ?, ?)`,
            [url, score, JSON.stringify(scanResult)],
            function (err) {
                if (err) {
                    console.error('Error saving report', err.message);
                }
            }
        );

        res.json(scanResult);
    } catch (err) {
        res.status(500).json({ error: 'Failed to scan website. Please check the URL.' });
    }
});

// Fetch Scan History API Route (For Scan History Tab)
app.get('/api/reports', (req, res) => {
    db.all(`SELECT id, url, score, created_at FROM reports ORDER BY created_at DESC LIMIT 20`, [], (err, rows) => {
        if (err) {
            console.error('Database Error:', err.message);
            return res.status(500).json({ error: 'Failed to load scan history' });
        }
        res.json(rows);
    });
});

// Fetch Single Report by ID API Route
app.get('/api/reports/:id', (req, res) => {
    db.get(`SELECT * FROM reports WHERE id = ?`, [req.params.id], (err, row) => {
        if (err || !row) {
            return res.status(404).json({ error: 'Report not found' });
        }
        res.json({
            id: row.id,
            url: row.url,
            score: row.score,
            data: JSON.parse(row.data),
            created_at: row.created_at
        });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`QA Scout server is running on http://localhost:${PORT}`);
});