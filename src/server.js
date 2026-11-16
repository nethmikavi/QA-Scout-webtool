const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const checkLinks = require('./scanners/linkChecker');
const checkSecurity = require('./scanners/securityChecker');
const checkSeoAndAccessibility = require('./scanners/seoAccessibilityChecker');

const app = express();
const PORT = process.env.PORT || 3000;

// Security & Middleware
app.use(helmet({
    contentSecurityPolicy: false
}));
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

// In-Memory Storage for Serverless Compatibility on Vercel
let reports = [
    {
        id: 1,
        url: 'https://example.com',
        score: 85,
        data: {
            url: 'https://example.com',
            score: 85,
            issues: [
                { category: 'Security', severity: 'Medium', message: 'Missing Content-Security-Policy header' }
            ]
        },
        created_at: new Date().toISOString()
    }
];
let nextId = 2;

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

        // Save report into memory
        reports.unshift({
            id: nextId++,
            url,
            score,
            data: scanResult,
            created_at: new Date().toISOString()
        });

        // Keep last 20 reports
        if (reports.length > 20) reports.pop();

        res.json(scanResult);
    } catch (err) {
        console.error('Scan error:', err);
        res.status(500).json({ error: 'Failed to scan website. Please check the URL.' });
    }
});

// Fetch Scan History API Route (For Scan History Tab)
app.get('/api/reports', (req, res) => {
    const summaryList = reports.map(({ id, url, score, created_at }) => ({
        id,
        url,
        score,
        created_at
    }));
    res.json(summaryList);
});

// Fetch Single Report by ID API Route
app.get('/api/reports/:id', (req, res) => {
    const report = reports.find(r => r.id === parseInt(req.params.id, 10));
    if (!report) {
        return res.status(404).json({ error: 'Report not found' });
    }
    res.json(report);
});

// Fallback route to serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start Server locally; export app for Vercel serverless
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`QA Scout server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;