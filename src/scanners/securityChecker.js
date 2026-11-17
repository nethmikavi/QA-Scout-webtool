function checkSecurity(page) {
    const issues = [];
    const headers = page.headers || {};
    const isHttps = (page.finalUrl || page.url).startsWith('https://');

    if (!isHttps) {
        issues.push({
            type: 'Security',
            severity: 'Critical',
            message: 'Website is not using HTTPS.',
            fix: 'Install an SSL certificate and redirect all HTTP traffic to HTTPS.'
        });
    }

    if (isHttps && !headers['strict-transport-security']) {
        issues.push({
            type: 'Security',
            severity: 'Major',
            message: 'Missing HSTS (Strict-Transport-Security) header.',
            fix: 'Enable HSTS in your server configuration to enforce secure connections.'
        });
    }

    const csp = headers['content-security-policy'] || '';
    if (!csp) {
        issues.push({
            type: 'Security',
            severity: 'Medium',
            message: 'Missing Content-Security-Policy header.',
            fix: 'Add a Content-Security-Policy header to reduce XSS and injection risk.'
        });
    }

    if (!headers['x-frame-options'] && !/frame-ancestors/i.test(csp)) {
        issues.push({
            type: 'Security',
            severity: 'Minor',
            message: 'Missing X-Frame-Options header (vulnerable to clickjacking).',
            fix: 'Set X-Frame-Options to DENY or SAMEORIGIN.'
        });
    }

    if (!headers['x-content-type-options']) {
        issues.push({
            type: 'Security',
            severity: 'Minor',
            message: 'Missing X-Content-Type-Options header.',
            fix: 'Set X-Content-Type-Options to nosniff.'
        });
    }

    return issues;
}

module.exports = checkSecurity;
