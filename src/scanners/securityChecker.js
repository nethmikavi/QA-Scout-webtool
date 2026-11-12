const axios = require('axios');

async function checkSecurity(targetUrl) {
    const issues = [];
    try {
        const response = await axios.get(targetUrl, { timeout: 10000 });
        const headers = response.headers;

        if (!targetUrl.startsWith('https://')) {
            issues.push({
                type: 'Security',
                severity: 'Critical',
                message: 'Website is not using HTTPS.',
                fix: 'Install an SSL certificate and redirect all HTTP traffic to HTTPS.'
            });
        }

        if (!headers['strict-transport-security']) {
            issues.push({
                type: 'Security',
                severity: 'Major',
                message: 'Missing HSTS (Strict-Transport-Security) header.',
                fix: 'Enable HSTS in your server configuration to enforce secure connections.'
            });
        }

        if (!headers['x-frame-options']) {
            issues.push({
                type: 'Security',
                severity: 'Minor',
                message: 'Missing X-Frame-Options header (vulnerable to clickjacking).',
                fix: 'Set X-Frame-Options to DENY or SAMEORIGIN.'
            });
        }
    } catch (err) {}
    return issues;
}

module.exports = checkSecurity;