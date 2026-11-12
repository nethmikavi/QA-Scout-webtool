const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

async function checkLinks(targetUrl) {
    const issues = [];
    try {
        const response = await axios.get(targetUrl, { timeout: 10000 });
        const html = response.data;
        const $ = cheerio.load(html);
        const links = [];

        $('a').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                try {
                    const absoluteUrl = new URL(href, targetUrl).toString();
                    if (absoluteUrl.startsWith('http')) {
                        links.push(absoluteUrl);
                    }
                } catch (e) {}
            }
        });

        const uniqueLinks = [...new Set(links)].slice(0, 10);

        for (const link of uniqueLinks) {
            try {
                await axios.head(link, { timeout: 5000 });
            } catch (error) {
                if (error.response && error.response.status >= 400) {
                    issues.push({
                        type: 'Broken Link',
                        severity: 'Major',
                        message: `Broken link found: ${link} (Status: ${error.response.status})`,
                        fix: 'Update or remove the broken hyperlink.'
                    });
                }
            }
        }
    } catch (err) {
        issues.push({
            type: 'Link Crawler',
            severity: 'Critical',
            message: `Could not crawl links for URL: ${err.message}`,
            fix: 'Ensure the URL is publicly accessible and allows crawling.'
        });
    }
    return issues;
}

module.exports = checkLinks;