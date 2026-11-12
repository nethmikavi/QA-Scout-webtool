const axios = require('axios');
const cheerio = require('cheerio');

async function checkSeoAndAccessibility(targetUrl) {
    const issues = [];
    try {
        const response = await axios.get(targetUrl, { timeout: 10000 });
        const $ = cheerio.load(response.data);

        // SEO Checks
        const title = $('title').text().trim();
        if (!title) {
            issues.push({
                type: 'SEO',
                severity: 'Major',
                message: 'Page is missing a <title> tag.',
                fix: 'Add a descriptive <title> tag within the <head> section.'
            });
        }

        const metaDesc = $('meta[name="description"]').attr('content');
        if (!metaDesc) {
            issues.push({
                type: 'SEO',
                severity: 'Major',
                message: 'Page is missing a meta description.',
                fix: 'Add <meta name="description" content="..."> to improve search engine rankings.'
            });
        }

        // Accessibility Checks
        let missingAltCount = 0;
        $('img').each((i, el) => {
            const alt = $(el).attr('alt');
            if (!alt || alt.trim() === '') {
                missingAltCount++;
            }
        });

        if (missingAltCount > 0) {
            issues.push({
                type: 'Accessibility',
                severity: 'Major',
                message: `Found ${missingAltCount} image(s) missing 'alt' text.`,
                fix: 'Add descriptive alt attributes to all <img> tags for screen readers.'
            });
        }

    } catch (err) {
        // Handled by main crawler if unreachable
    }
    return issues;
}

module.exports = checkSeoAndAccessibility;