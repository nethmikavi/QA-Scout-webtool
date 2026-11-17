const cheerio = require('cheerio');

function checkSeoAndAccessibility(page) {
    const issues = [];
    const $ = cheerio.load(page.html);

    // ---- SEO ----
    const title = $('title').first().text().trim();
    if (!title) {
        issues.push({
            type: 'SEO',
            severity: 'Major',
            message: 'Page is missing a <title> tag.',
            fix: 'Add a descriptive <title> tag within the <head> section.'
        });
    }

    const metaDesc = ($('meta[name="description"]').attr('content') || '').trim();
    if (!metaDesc) {
        issues.push({
            type: 'SEO',
            severity: 'Major',
            message: 'Page is missing a meta description.',
            fix: 'Add <meta name="description" content="..."> to improve search engine rankings.'
        });
    }

    if ($('h1').length === 0) {
        issues.push({
            type: 'SEO',
            severity: 'Minor',
            message: 'Page has no <h1> heading.',
            fix: 'Add one clear <h1> heading describing the page content.'
        });
    }

    if (!$('meta[name="viewport"]').length) {
        issues.push({
            type: 'SEO',
            severity: 'Minor',
            message: 'Missing viewport meta tag (not mobile friendly).',
            fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.'
        });
    }

    // ---- Accessibility ----
    // alt="" is valid for decorative images, so only a MISSING alt attribute is flagged.
    let missingAlt = 0;
    $('img').each((i, el) => {
        if ($(el).attr('alt') === undefined) missingAlt++;
    });
    if (missingAlt > 0) {
        issues.push({
            type: 'Accessibility',
            severity: 'Major',
            message: `Found ${missingAlt} image(s) missing 'alt' text.`,
            fix: 'Add descriptive alt attributes to all <img> tags for screen readers.'
        });
    }

    if (!($('html').attr('lang') || '').trim()) {
        issues.push({
            type: 'Accessibility',
            severity: 'Minor',
            message: 'The <html> element has no lang attribute.',
            fix: 'Add a lang attribute, e.g. <html lang="en">.'
        });
    }

    let unlabeled = 0;
    $('input, select, textarea').each((i, el) => {
        const $el = $(el);
        const type = ($el.attr('type') || 'text').toLowerCase();
        if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) return;
        const id = $el.attr('id');
        const hasLabel =
            $el.attr('aria-label') || $el.attr('aria-labelledby') || $el.attr('title') ||
            (id && $(`label[for="${id}"]`).length) || $el.closest('label').length;
        if (!hasLabel) unlabeled++;
    });
    if (unlabeled > 0) {
        issues.push({
            type: 'Accessibility',
            severity: 'Major',
            message: `Found ${unlabeled} form field(s) without an associated label.`,
            fix: 'Associate each form field with a <label for="..."> or an aria-label.'
        });
    }

    return issues;
}

module.exports = checkSeoAndAccessibility;
