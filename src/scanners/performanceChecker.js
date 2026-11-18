const cheerio = require('cheerio');

function checkPerformance(page) {
    const $ = cheerio.load(page.html);
    const headers = page.headers || {};
    const bytes = Buffer.byteLength(page.html || '');

    const images = $('img').length;
    const lazyImages = $('img[loading="lazy"]').length;
    const scripts = $('script[src]').length;
    const stylesheets = $('link[rel="stylesheet"]').length;
    const blockingScripts = $('head script[src]:not([async]):not([defer])').length;

    const metrics = {
        loadTimeMs: page.timeMs || 0,
        htmlSizeKb: Math.round((bytes / 1024) * 10) / 10,
        transferSizeKb: Math.round(((page.transferBytes || bytes) / 1024) * 10) / 10,
        images,
        lazyImages,
        scripts,
        stylesheets,
        blockingScripts,
        estimatedRequests: 1 + images + scripts + stylesheets,
        compression: headers['content-encoding'] || 'none',
        cacheControl: headers['cache-control'] || 'not set'
    };

    const issues = [];
    const add = (severity, message, fix) => issues.push({ type: 'Performance', severity, message, fix });

    if (metrics.loadTimeMs > 3000) {
        add('Major', `Slow server response: page took ${metrics.loadTimeMs} ms to download.`, 'Use caching, a CDN and faster hosting to cut response time below 1.5 seconds.');
    } else if (metrics.loadTimeMs > 1500) {
        add('Minor', `Page download took ${metrics.loadTimeMs} ms (target is under 1500 ms).`, 'Enable caching or a CDN to improve response time.');
    }

    if (metrics.htmlSizeKb > 500) {
        add('Major', `HTML document is very large (${metrics.htmlSizeKb} KB).`, 'Reduce inline content and split large pages.');
    } else if (metrics.htmlSizeKb > 200) {
        add('Minor', `HTML document is large (${metrics.htmlSizeKb} KB).`, 'Minify HTML and move heavy inline data out of the page.');
    }

    if (metrics.compression === 'none' && bytes > 1024) {
        add('Major', 'Response is not compressed (no gzip or brotli).', 'Enable gzip or brotli compression on your server.');
    }

    if (metrics.cacheControl === 'not set') {
        add('Minor', 'No Cache-Control header on the page.', 'Set Cache-Control headers so browsers and CDNs can cache responses.');
    }

    if (blockingScripts > 0) {
        add('Minor', `${blockingScripts} render-blocking script(s) in <head>.`, 'Add async or defer to scripts, or move them to the end of <body>.');
    }

    if (scripts > 15) {
        add('Minor', `Page loads ${scripts} external scripts.`, 'Bundle and remove unused scripts to reduce requests.');
    }

    if (images > 10 && lazyImages === 0) {
        add('Minor', `${images} images found and none use lazy loading.`, 'Add loading="lazy" to below-the-fold images.');
    }

    return { metrics, issues };
}

module.exports = checkPerformance;
