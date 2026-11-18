const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { normalizeUrl, assertPublicUrl, fetchPage } = require('./scanners/fetchPage');
const checkLinks = require('./scanners/linkChecker');
const checkSecurity = require('./scanners/securityChecker');
const checkSeoAndAccessibility = require('./scanners/seoAccessibilityChecker');
const checkPerformance = require('./scanners/performanceChecker');
const axios = require('axios');

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

        const perf = checkPerformance(page);
        const issues = [...linkIssues, ...securityIssues, ...seoA11yIssues, ...perf.issues];

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
            performance: perf.metrics,
            issues
        });
    } catch (err) {
        console.error('Scan error:', err);
        res.status(500).json({ error: 'Failed to scan website. Please check the URL.' });
    }
});

// ---- API Tester: send a request to a public URL and run simple assertions ----
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];

app.post('/api/test-api', async (req, res) => {
    const b = req.body || {};
    const method = String(b.method || 'GET').toUpperCase();
    if (!ALLOWED_METHODS.includes(method)) {
        return res.status(400).json({ error: 'Unsupported HTTP method' });
    }

    let url;
    try {
        url = normalizeUrl(b.url);
        await assertPublicUrl(url);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }

    let headers = {};
    if (b.headers && typeof b.headers === 'object') {
        for (const [k, v] of Object.entries(b.headers).slice(0, 20)) {
            if (/^[\w-]+$/.test(k) && typeof v === 'string') headers[k] = v.slice(0, 500);
        }
    }

    const started = Date.now();
    try {
        const r = await axios.request({
            url, method, headers,
            data: ['GET', 'HEAD'].includes(method) ? undefined : (b.body || undefined),
            timeout: 10000,
            maxRedirects: 3,
            maxContentLength: 1024 * 1024,
            responseType: 'text',
            transformResponse: [d => d],
            validateStatus: () => true
        });
        const timeMs = Date.now() - started;
        const bodyText = typeof r.data === 'string' ? r.data : '';
        const contentType = String(r.headers['content-type'] || '');
        const checks = [];

        const expected = parseInt(b.expectedStatus, 10);
        if (expected) {
            checks.push({ name: `Status code is ${expected}`, passed: r.status === expected, detail: `Got ${r.status}` });
        }
        const maxTime = parseInt(b.maxTimeMs, 10);
        if (maxTime) {
            checks.push({ name: `Response time under ${maxTime} ms`, passed: timeMs <= maxTime, detail: `Took ${timeMs} ms` });
        }
        if (/json/i.test(contentType)) {
            let valid = true;
            try { JSON.parse(bodyText); } catch (e) { valid = false; }
            checks.push({ name: 'Response body is valid JSON', passed: valid, detail: valid ? 'OK' : 'Could not parse JSON' });
        }
        if (b.bodyContains) {
            checks.push({ name: `Body contains "${String(b.bodyContains).slice(0, 60)}"`, passed: bodyText.includes(String(b.bodyContains)), detail: '' });
        }

        res.json({
            status: r.status,
            statusText: r.statusText,
            timeMs,
            sizeBytes: Buffer.byteLength(bodyText),
            headers: r.headers,
            bodyPreview: bodyText.slice(0, 2000),
            checks
        });
    } catch (err) {
        res.status(502).json({ error: `Request failed: ${err.code || err.message}` });
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
