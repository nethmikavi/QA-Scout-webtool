const axios = require('axios');
const cheerio = require('cheerio');
const { assertPublicUrl, USER_AGENT } = require('./fetchPage');

const MAX_LINKS = 15;
const LINK_TIMEOUT = 4000;

async function probe(link) {
    const opts = {
        timeout: LINK_TIMEOUT,
        maxRedirects: 5,
        validateStatus: () => true,
        headers: { 'User-Agent': USER_AGENT }
    };
    try {
        let res = await axios.head(link, opts);
        // Many servers reject HEAD - retry with a streamed GET before calling it broken.
        if ([400, 403, 404, 405, 501].includes(res.status)) {
            res = await axios.get(link, { ...opts, responseType: 'stream' });
            if (res.data && typeof res.data.destroy === 'function') res.data.destroy();
        }
        return { status: res.status };
    } catch (err) {
        return { error: err.code || err.message };
    }
}

async function checkLinks(page) {
    const issues = [];
    const $ = cheerio.load(page.html);
    const base = page.finalUrl || page.url;
    const links = new Set();

    $('a[href]').each((i, el) => {
        const href = ($(el).attr('href') || '').trim();
        if (!href || /^(#|mailto:|tel:|javascript:|data:)/i.test(href)) return;
        try {
            const abs = new URL(href, base);
            if (/^https?:$/.test(abs.protocol)) {
                abs.hash = '';
                links.add(abs.toString());
            }
        } catch (e) { /* ignore malformed href */ }
    });

    const toCheck = [...links].slice(0, MAX_LINKS);

    // Run all checks in parallel so the serverless function stays fast.
    const results = await Promise.all(toCheck.map(async (link) => {
        try {
            await assertPublicUrl(link);
        } catch (e) {
            return null; // skip private/unresolvable targets
        }
        return { link, ...(await probe(link)) };
    }));

    for (const r of results) {
        if (!r) continue;
        // 401/403/429 usually mean "bot blocked", not "broken"
        const broken = r.error
            ? ['ENOTFOUND', 'ECONNREFUSED', 'ERR_BAD_REQUEST'].includes(r.error)
            : (r.status >= 400 && ![401, 403, 429, 999].includes(r.status));
        if (broken) {
            issues.push({
                type: 'Link',
                severity: 'Major',
                message: `Broken link found: ${r.link} (${r.error ? 'Error: ' + r.error : 'Status: ' + r.status})`,
                fix: 'Update or remove the broken hyperlink.'
            });
        }
    }
    return issues;
}

module.exports = checkLinks;
