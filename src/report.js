/**
 * QA Scout - professional PDF report builder (A4, built with PDFKit).
 * Usage: buildReport(scanData, writableStream)
 */
const PDFDocument = require('pdfkit');

/* ---------- palette ---------- */
const C = {
    ink: '#17130f', accent: '#6c4fd6', accentSoft: '#ece6ff', muted: '#6b6455',
    line: '#d9d2c3', paper: '#fffdf8', cream: '#f4efe4',
    good: '#1a7f37', warn: '#b7791f', bad: '#c62828'
};
const SEV = {
    Critical: { color: '#c62828', weight: 0 },
    Major: { color: '#e65100', weight: 1 },
    Medium: { color: '#b7791f', weight: 2 },
    Minor: { color: '#5b6b7a', weight: 3 }
};
const PENALTY = { Critical: 25, Major: 12, Medium: 8, Minor: 5 };
const CATEGORIES = [
    { key: 'Link', label: 'Links' },
    { key: 'Security', label: 'Security' },
    { key: 'SEO', label: 'SEO' },
    { key: 'Accessibility', label: 'Accessibility' },
    { key: 'Performance', label: 'Performance' }
];

const M = 48;                 // page margin
const PW = 595.28, PH = 841.89;
const CW = PW - M * 2;        // content width
const BOTTOM = PH - 70;       // lowest y content may reach (footer lives below)

/* ---------- helpers ---------- */
// Built-in PDF fonts only cover Latin-1: map common typography, replace the rest.
function clean(v, max = 600) {
    let s = String(v == null ? '' : v)
        .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...').replace(/[\u2022\u00B7]/g, '-')
        .replace(/\u00A0/g, ' ').replace(/[\r\n\t]+/g, ' ')
        .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, '?')
        .replace(/\s+/g, ' ').trim();
    if (s.length > max) s = s.slice(0, max - 3) + '...';
    return s;
}

function grade(score) {
    if (score >= 90) return { label: 'Excellent', color: C.good, text: 'Your page is in great shape. Only minor polish is left.' };
    if (score >= 80) return { label: 'Good', color: C.good, text: 'Solid result. A few quick fixes will push the score higher.' };
    if (score >= 50) return { label: 'Needs work', color: C.warn, text: 'Several issues were found. Start with the highest severity items.' };
    return { label: 'Critical', color: C.bad, text: 'Serious problems were detected. Fix these before going live.' };
}

function reportId(data) {
    const base = clean(data.url, 200) + '|' + (data.scannedAt || '');
    let h = 0;
    for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
    return 'QA-' + h.toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
}

function fmtDate(iso) {
    const d = new Date(iso || Date.now());
    const date = isNaN(d) ? new Date() : d;
    return date.toUTCString().replace(' GMT', ' UTC');
}

/* ---------- builder ---------- */
function buildReport(data, stream) {
    const issues = [...data.issues].sort((a, b) =>
        (SEV[a.severity] ? SEV[a.severity].weight : 9) - (SEV[b.severity] ? SEV[b.severity].weight : 9));
    const g = grade(data.score);
    const id = reportId(data);

    const doc = new PDFDocument({
        size: 'A4', margin: M, bufferPages: true,
        info: {
            Title: 'QA Scout Website Audit Report',
            Author: 'QA Scout',
            Subject: 'Website audit for ' + clean(data.url, 150),
            Keywords: 'website audit, SEO, security, accessibility, performance'
        }
    });
    doc.pipe(stream);

    /* --- small drawing primitives --- */
    const pill = (x, y, text, bg, fg = '#fff', size = 7.5) => {
        doc.font('Helvetica-Bold').fontSize(size);
        const w = doc.widthOfString(text) + 14, h = size + 8;
        doc.roundedRect(x, y, w, h, h / 2).fill(bg);
        doc.fillColor(fg).text(text, x + 7, y + 4.2, { lineBreak: false });
        return w;
    };

    const pillRight = (rightX, y, text, bg) => {
        doc.font('Helvetica-Bold').fontSize(7.5);
        return pill(rightX - (doc.widthOfString(text) + 14), y, text, bg);
    };

    const sectionTitle = (title, y) => {
        doc.font('Helvetica-Bold').fontSize(13).fillColor(C.ink).text(title, M, y, { lineBreak: false });
        const w = doc.widthOfString(title);
        doc.moveTo(M + w + 12, y + 8).lineTo(PW - M, y + 8).lineWidth(1.5).strokeColor(C.ink).stroke();
        return y + 28;
    };

    const runningHeader = () => {
        doc.rect(0, 0, PW, 6).fill(C.accent);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.ink).text('QA Scout', M, 24, { lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor(C.muted)
            .text(clean(data.url, 70), M, 24, { width: CW, align: 'right', lineBreak: false });
        doc.moveTo(M, 40).lineTo(PW - M, 40).lineWidth(.6).strokeColor(C.line).stroke();
    };

    const newPage = () => { doc.addPage(); runningHeader(); return 62; };
    const ensure = (y, need) => (y + need > BOTTOM ? newPage() : y);

    /* ================= PAGE 1: cover header ================= */
    doc.rect(0, 0, PW, 112).fill(C.ink);
    doc.rect(0, 112, PW, 5).fill(C.accent);
    doc.roundedRect(M, 34, 42, 42, 9).fill(C.accent);
    doc.roundedRect(M, 34, 42, 42, 9).lineWidth(2).strokeColor('#ffffff').stroke();
    doc.font('Helvetica-Bold').fontSize(15).fillColor('#ffffff').text('QA', M, 48, { width: 42, align: 'center', lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(21).fillColor('#ffffff').text('QA Scout', M + 56, 38, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor('#cfc8b8').text('Website quality auditor', M + 56, 64, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#cfc8b8')
        .text('WEBSITE QUALITY REPORT', M, 40, { width: CW, align: 'right', lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).fillColor('#ffffff')
        .text(id, M, 56, { width: CW, align: 'right', lineBreak: false });

    let y = 144;
    doc.font('Helvetica-Bold').fontSize(27).fillColor(C.ink).text('Website Audit Report', M, y, { lineBreak: false });
    y += 38;
    doc.font('Helvetica-Bold').fontSize(11.5).fillColor(C.accent)
        .text(clean(data.url, 220), M, y, { width: CW, link: /^https?:\/\//i.test(data.url) ? data.url : undefined, underline: true });
    y = doc.y + 6;
    doc.font('Helvetica').fontSize(9).fillColor(C.muted)
        .text('Scanned: ' + fmtDate(data.scannedAt) + '    |    Report ID: ' + id, M, y, { width: CW });
    y = doc.y + 22;

    /* ================= score card ================= */
    const cardH = 150;
    doc.roundedRect(M + 4, y + 4, CW, cardH, 12).fill(C.ink);          // hard shadow
    doc.roundedRect(M, y, CW, cardH, 12).fillAndStroke(C.paper, C.ink);
    doc.lineWidth(1.5);

    // gauge
    const gx = M + 84, gy = y + cardH / 2, gr = 46;
    doc.lineWidth(10).strokeColor(C.line).circle(gx, gy, gr).stroke();
    const pct = Math.max(0, Math.min(100, data.score)) / 100;
    if (pct > 0) {
        const start = -Math.PI / 2, steps = Math.max(2, Math.round(pct * 120));
        doc.lineCap('round').lineWidth(10).strokeColor(g.color);
        for (let i = 0; i <= steps; i++) {
            const a = start + (2 * Math.PI * pct * i) / steps;
            const px = gx + gr * Math.cos(a), py = gy + gr * Math.sin(a);
            if (i === 0) doc.moveTo(px, py); else doc.lineTo(px, py);
        }
        doc.stroke();
        doc.lineCap('butt');
    }
    doc.font('Helvetica-Bold').fontSize(32).fillColor(C.ink)
        .text(String(data.score), gx - 40, gy - 20, { width: 80, align: 'center', lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor(C.muted)
        .text('out of 100', gx - 40, gy + 16, { width: 80, align: 'center', lineBreak: false });

    // verdict
    const tx = M + 170, tw = CW - 170 - 22;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted).text('OVERALL RESULT', tx, y + 30, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(24).fillColor(g.color).text(g.label, tx, y + 44, { lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor(C.ink).text(g.text, tx, y + 78, { width: tw });
    const total = issues.length;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.muted)
        .text(total === 0 ? 'No issues detected' : `${total} issue${total === 1 ? '' : 's'} detected across ${new Set(issues.map(i => i.type)).size} categor${new Set(issues.map(i => i.type)).size === 1 ? 'y' : 'ies'}`,
            tx, y + cardH - 40, { width: tw });
    y += cardH + 30;

    /* ================= severity summary ================= */
    y = sectionTitle('Summary', y);
    const sevKeys = ['Critical', 'Major', 'Medium', 'Minor'];
    const gap = 12, bw = (CW - gap * 3) / 4;
    sevKeys.forEach((k, i) => {
        const n = issues.filter(x => x.severity === k).length;
        const bx = M + i * (bw + gap);
        doc.roundedRect(bx, y, bw, 62, 8).fillAndStroke(C.paper, C.ink);
        doc.rect(bx + 1, y + 8, 4, 46).fill(SEV[k].color);
        doc.font('Helvetica-Bold').fontSize(24).fillColor(n ? SEV[k].color : C.line).text(String(n), bx + 16, y + 10, { lineBreak: false });
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted).text(k.toUpperCase(), bx + 16, y + 42, { lineBreak: false });
    });
    y += 62 + 24;

    /* ================= category breakdown ================= */
    y = sectionTitle('Category breakdown', y);
    const rowH = 30;
    doc.roundedRect(M, y, CW, rowH * CATEGORIES.length, 8).fillAndStroke(C.paper, C.ink);
    CATEGORIES.forEach((cat, i) => {
        const ry = y + i * rowH;
        const list = issues.filter(x => x.type === cat.key);
        if (i > 0) doc.moveTo(M, ry).lineTo(PW - M, ry).lineWidth(.6).strokeColor(C.line).stroke();
        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.ink).text(cat.label, M + 16, ry + 10, { lineBreak: false });
        // penalty bar
        const pen = list.reduce((s, x) => s + (PENALTY[x.severity] || 5), 0);
        const barX = M + 170, barW = 170;
        doc.roundedRect(barX, ry + 11, barW, 8, 4).fill(C.cream);
        const health = Math.max(0, 1 - Math.min(pen, 50) / 50);
        if (health > 0) doc.roundedRect(barX, ry + 11, Math.max(8, barW * health), 8, 4).fill(list.length === 0 ? C.good : (health > .5 ? C.warn : C.bad));
        if (list.length === 0) pillRight(PW - M - 16, ry + 7, 'PASSED', C.good);
        else pillRight(PW - M - 16, ry + 7, `${list.length} ISSUE${list.length === 1 ? '' : 'S'}`,
            list.some(x => x.severity === 'Critical' || x.severity === 'Major') ? C.bad : C.warn);
    });
    y += rowH * CATEGORIES.length + 28;

    /* ================= performance snapshot ================= */
    const m = data.performance;
    if (m) {
        y = ensure(y, 180);
        y = sectionTitle('Performance snapshot', y);
        const cells = [
            ['Download time', m.loadTimeMs != null ? `${m.loadTimeMs} ms` : 'n/a'],
            ['HTML size', m.htmlSizeKb != null ? `${m.htmlSizeKb} KB` : 'n/a'],
            ['Estimated requests', m.estimatedRequests != null ? String(m.estimatedRequests) : 'n/a'],
            ['Compression', clean(m.compression || 'none', 20)],
            ['Images (lazy)', m.images != null ? `${m.images} (${m.lazyImages || 0})` : 'n/a'],
            ['Scripts', m.scripts != null ? String(m.scripts) : 'n/a'],
            ['Stylesheets', m.stylesheets != null ? String(m.stylesheets) : 'n/a'],
            ['Blocking scripts', m.blockingScripts != null ? String(m.blockingScripts) : 'n/a']
        ];
        const cg = 12, cw = (CW - cg * 3) / 4, ch = 52;
        cells.forEach((c, i) => {
            const cx = M + (i % 4) * (cw + cg), cy = y + Math.floor(i / 4) * (ch + cg);
            doc.roundedRect(cx, cy, cw, ch, 8).fillAndStroke(C.paper, C.ink);
            doc.font('Helvetica-Bold').fontSize(14).fillColor(C.ink).text(c[1], cx + 12, cy + 10, { width: cw - 20, lineBreak: false });
            doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(c[0].toUpperCase(), cx + 12, cy + 33, { width: cw - 20, lineBreak: false });
        });
        y += ch * 2 + cg + 16;
        if (m.cacheControl) {
            doc.font('Helvetica').fontSize(9).fillColor(C.muted)
                .text('Cache-Control: ', M, y, { continued: true }).fillColor(C.ink).text(clean(m.cacheControl, 120), { width: CW });
            y = doc.y + 24;
        }
    }

    /* ================= detailed findings ================= */
    y = ensure(y, 120);
    y = sectionTitle(`Detailed findings (${issues.length})`, y);

    if (issues.length === 0) {
        doc.roundedRect(M, y, CW, 64, 10).fillAndStroke('#e8f5ec', C.good);
        doc.font('Helvetica-Bold').fontSize(13).fillColor(C.good).text('No issues found', M + 20, y + 16, { lineBreak: false });
        doc.font('Helvetica').fontSize(10).fillColor(C.ink).text('All automated checks passed for this page. Keep monitoring after each release.', M + 20, y + 36, { width: CW - 40 });
        y += 84;
    }

    issues.forEach((it, idx) => {
        const sev = SEV[it.severity] || SEV.Minor;
        const msg = clean(it.message, 500), fix = clean(it.fix, 600);
        const pad = 14, textW = CW - pad * 2 - 6;
        doc.font('Helvetica-Bold').fontSize(10.5);
        const hMsg = doc.heightOfString(msg, { width: textW });
        doc.font('Helvetica').fontSize(9.5);
        const hFix = doc.heightOfString(fix, { width: textW });
        const h = pad + 18 + hMsg + 10 + 12 + hFix + pad;

        y = ensure(y, h + 12);
        doc.roundedRect(M + 3, y + 3, CW, h, 8).fill(C.line);                 // soft shadow
        doc.roundedRect(M, y, CW, h, 8).fillAndStroke(C.paper, C.ink);
        doc.save().roundedRect(M, y, 7, h, 3).clip().rect(M, y, 7, h).fill(sev.color).restore();

        let cy = y + pad;
        const w1 = pill(M + pad + 6, cy - 2, it.severity ? it.severity.toUpperCase() : 'ISSUE', sev.color);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(C.muted)
            .text(clean(it.type, 30).toUpperCase(), M + pad + 6 + w1 + 10, cy + 1.5, { lineBreak: false });
        doc.font('Helvetica').fontSize(8).fillColor(C.muted)
            .text('#' + String(idx + 1).padStart(2, '0'), M, cy + 1.5, { width: CW - pad, align: 'right', lineBreak: false });
        cy += 22;

        doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.ink).text(msg, M + pad + 6, cy, { width: textW });
        cy += hMsg + 10;

        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.accent).text('RECOMMENDED FIX', M + pad + 6, cy, { lineBreak: false });
        cy += 12;
        doc.font('Helvetica').fontSize(9.5).fillColor('#3a352c').text(fix, M + pad + 6, cy, { width: textW });
        y += h + 12;
    });

    /* ================= about ================= */
    y = ensure(y + 10, 150);
    y = sectionTitle('About this report', y);
    doc.roundedRect(M, y, CW, 118, 8).fillAndStroke(C.accentSoft, C.ink);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink).text('How the score is calculated', M + 16, y + 14, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor('#3a352c').text(
        'Every scan starts at 100 points. Each issue deducts points by severity: Critical -25, Major -12, Medium -8, Minor -5. ' +
        'Grades: 90+ Excellent, 80-89 Good, 50-79 Needs work, below 50 Critical.', M + 16, y + 28, { width: CW - 32 });
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.ink).text('Scope and limits', M + 16, y + 66, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor('#3a352c').text(
        'This report covers one page and up to 15 of its links. Automated checks find machine-detectable problems only and do not replace manual accessibility, security and usability testing.',
        M + 16, y + 80, { width: CW - 32 });

    /* ================= footers (all pages) ================= */
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const oldBottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.moveTo(M, PH - 46).lineTo(PW - M, PH - 46).lineWidth(.6).strokeColor(C.line).stroke();
        doc.font('Helvetica').fontSize(8).fillColor(C.muted)
            .text('Generated by QA Scout  |  ' + id, M, PH - 34, { lineBreak: false });
        doc.text(`Page ${i + 1} of ${range.count}`, M, PH - 34, { width: CW, align: 'right', lineBreak: false });
        doc.page.margins.bottom = oldBottom;
    }

    doc.end();
}

/* ---------- validate + normalise untrusted client payload ---------- */
function sanitizeScan(body) {
    if (!body || typeof body !== 'object') return null;
    const url = clean(body.url, 300);
    const score = Number(body.score);
    if (!url || !Number.isFinite(score)) return null;
    const issues = (Array.isArray(body.issues) ? body.issues : []).slice(0, 150).map(i => ({
        type: clean(i && i.type, 30) || 'General',
        severity: SEV[i && i.severity] ? i.severity : 'Minor',
        message: clean(i && i.message, 500),
        fix: clean(i && i.fix, 600) || 'No suggestion available.'
    }));
    let performance = null;
    if (body.performance && typeof body.performance === 'object') {
        const p = body.performance, num = v => (Number.isFinite(Number(v)) ? Number(v) : null);
        performance = {
            loadTimeMs: num(p.loadTimeMs), htmlSizeKb: num(p.htmlSizeKb), estimatedRequests: num(p.estimatedRequests),
            images: num(p.images), lazyImages: num(p.lazyImages), scripts: num(p.scripts), stylesheets: num(p.stylesheets),
            blockingScripts: num(p.blockingScripts), compression: clean(p.compression, 30), cacheControl: clean(p.cacheControl, 150)
        };
    }
    return { url: String(body.url).slice(0, 300), score: Math.max(0, Math.min(100, Math.round(score))), scannedAt: body.scannedAt, issues, performance };
}

module.exports = { buildReport, sanitizeScan };
