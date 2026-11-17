const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { normalizeUrl, assertPublicUrl, fetchPage } = require('./scanners/fetchPage');
const checkLinks = require('./scanners/linkChecker');
const checkSecurity = require('./scanners/securityChecker');
const checkSeoAndAccessibility = require('./scanners/seoAccessibilityChecker');

const app = express();
const PORT = process.env.PORT || 3000;

// Vercel sits behind a proxy; required so rate-limiting can read the real client IP.
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
}));

const SEVERITY_PENALTY = { Critical: 25, Major: 12, Medium: 8, Minor: 5 };

function calculateScore(issues) {
    const penalty = issues.reduce((sum, i) => sum + (SEVERITY_PENALTY[i.severity] || 5), 0);
    return Math.max(0, 100 - penalty);
}

// NOTE: Scan history is stored in the user's browser (localStorage).
// Vercel serverless functions have no persistent memory, so server-side
// in-memory history would randomly appear empty between requests.
app.post('/api/scan', async (req, res) => {
    let url;
    try {
        url = normalizeUrl(req.body && req.body.url);
        await assertPublicUrl(url);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    let page;
    try {
        page = await fetchPage(url);
    } catch (err) {
        console.error('Fetch error:', err.message);
        return res.status(502).json({
            error: `Could not reach ${url} (${err.code || err.message}). Check that the site is online and public.`
        });
    }

    try {
        const [linkIssues, securityIssues, seoA11yIssues] = await Promise.all([
            checkLinks(page).catch(e => { console.error('linkChecker:', e.message); return []; }),
            Promise.resolve(checkSecurity(page)),
            Promise.resolve(checkSeoAndAccessibility(page))
        ]);

        const issues = [...linkIssues, ...securityIssues, ...seoA11yIssues];

        if (page.status >= 400) {
            issues.unshift({
                type: 'Link',
                severity: 'Critical',
                message: `The page itself returned HTTP status ${page.status}.`,
                fix: 'Make sure the URL is correct and publicly accessible.'
            });
        }

        res.json({
            url,
            score: calculateScore(issues),
            scannedAt: new Date().toISOString(),
            issues
        });
    } catch (err) {
        console.error('Scan error:', err);
        res.status(500).json({ error: 'Failed to scan website. Please check the URL.' });
    }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found' }));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`QA Scout server is running on http://localhost:${PORT}`);
    });
}

module.exports = app;
