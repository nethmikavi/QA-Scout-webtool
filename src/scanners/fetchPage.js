const axios = require('axios');
const dns = require('dns').promises;
const net = require('net');
const zlib = require('zlib');

const USER_AGENT = 'Mozilla/5.0 (compatible; QAScoutBot/1.1; +https://github.com/nethmikavi/QA-Scout-webtool)';

/** Add https:// when the user typed "example.com" and validate the result. */
function normalizeUrl(input) {
    let value = String(input || '').trim();
    if (!value) throw new Error('URL is required');
    if (!/^https?:\/\//i.test(value)) value = 'https://' + value;
    let parsed;
    try {
        parsed = new URL(value);
    } catch (e) {
        throw new Error('Invalid URL format');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Only http and https URLs are supported');
    }
    return parsed.toString();
}

function isPrivateIp(ip) {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return (
            a === 10 || a === 127 || a === 0 ||
            (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 100 && b >= 64 && b <= 127)
        );
    }
    if (net.isIPv6(ip)) {
        const v = ip.toLowerCase();
        return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') ||
            v.startsWith('fe80') || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') ||
            v.startsWith('::ffff:192.168.');
    }
    return true;
}

/** Block localhost / private network targets (SSRF protection). */
async function assertPublicUrl(url) {
    // Local development/testing only. Never set this on Vercel.
    if (process.env.QA_ALLOW_PRIVATE === '1') return;
    const { hostname } = new URL(url);
    const host = hostname.replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
        throw new Error('Scanning private or local addresses is not allowed');
    }
    if (net.isIP(host)) {
        if (isPrivateIp(host)) throw new Error('Scanning private or local addresses is not allowed');
        return;
    }
    let records;
    try {
        records = await dns.lookup(host, { all: true });
    } catch (e) {
        throw new Error(`Could not resolve domain "${host}"`);
    }
    if (records.some(r => isPrivateIp(r.address))) {
        throw new Error('Scanning private or local addresses is not allowed');
    }
}

/** Download the page ONCE and share it with every scanner. */
async function fetchPage(url) {
    const started = Date.now();
    // decompress:false keeps the real Content-Encoding header, so we can report
    // compression accurately. We decompress the body ourselves below.
    const response = await axios.get(url, {
        timeout: 8000,
        maxRedirects: 5,
        maxContentLength: 3 * 1024 * 1024,
        responseType: 'arraybuffer',
        decompress: false,
        validateStatus: () => true,
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br'
        }
    });
    const timeMs = Date.now() - started;
    const finalUrl =
        (response.request && response.request.res && response.request.res.responseUrl) || url;

    const raw = Buffer.from(response.data || []);
    const encoding = String(response.headers['content-encoding'] || '').toLowerCase().trim();
    let body = raw;
    try {
        if (encoding === 'gzip' || encoding === 'x-gzip') body = zlib.gunzipSync(raw);
        else if (encoding === 'br') body = zlib.brotliDecompressSync(raw);
        else if (encoding === 'deflate') {
            try { body = zlib.inflateSync(raw); } catch (e) { body = zlib.inflateRawSync(raw); }
        }
    } catch (e) {
        body = raw; // could not decode; analyse whatever we received
    }

    return {
        url,
        finalUrl,
        timeMs,
        status: response.status,
        headers: response.headers || {},
        transferBytes: raw.length,
        html: body.toString('utf8')
    };
}

module.exports = { normalizeUrl, assertPublicUrl, fetchPage, USER_AGENT };
