/* Advanced features: Dashboard, Performance, Bug Tracker, API Tester, PDF export.
   Uses helpers from script.js (escapeHtml, getHistory, scoreColor, downloadBlob, csvCell). */
(function () {
    const $ = id => document.getElementById(id);
    const BUGS_KEY = 'qaScoutBugs';
    const SEV_COLOR = { Critical: '#f85149', Major: '#f0883e', Medium: '#eab308', Minor: '#58a6ff' };

    /* ---------- Bug storage ---------- */
    function getBugs() {
        try {
            const parsed = JSON.parse(localStorage.getItem(BUGS_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }
    function saveBugs(bugs) {
        try { localStorage.setItem(BUGS_KEY, JSON.stringify(bugs)); } catch (e) { console.warn(e); }
    }
    function logBug(issue, url) {
        const bugs = getBugs();
        bugs.unshift({
            id: Date.now() + Math.random(),
            title: `[${issue.type}] ${issue.message}`.slice(0, 200),
            severity: SEV_COLOR[issue.severity] ? issue.severity : 'Medium',
            status: 'Open',
            notes: `URL: ${url}\nSuggested fix: ${issue.fix || ''}`,
            created: new Date().toISOString()
        });
        saveBugs(bugs);
    }

    /* ---------- Dashboard ---------- */
    function statCard(label, value, color) {
        return `<div class="stat"><span>${label}</span><strong style="color:${color || '#fff'}">${value}</strong></div>`;
    }

    function barRows(counts, colorFn) {
        const entries = Object.entries(counts);
        if (!entries.length) return '<p style="color:#3fb950;">No issues in the latest scan.</p>';
        const max = Math.max(...entries.map(e => e[1]));
        return entries.map(([k, v]) => `
            <div class="bar-row"><span class="label">${escapeHtml(k)}</span>
                <div class="bar"><div style="width:${(v / max) * 100}%; background:${colorFn(k)};"></div></div>
                <strong>${v}</strong></div>`).join('');
    }

    function trendSvg(points) {
        const W = 640, H = 210, P = 34;
        const n = points.length;
        const x = i => P + (n === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (n - 1));
        const y = s => P + ((100 - s) / 100) * (H - 2 * P);
        const line = points.map((p, i) => `${x(i)},${y(p.score)}`).join(' ');
        const grid = [0, 50, 100].map(v => `<line x1="${P}" x2="${W - P}" y1="${y(v)}" y2="${y(v)}" stroke="#30363d" stroke-dasharray="4"/><text x="4" y="${y(v) + 4}" fill="#8b949e" font-size="11">${v}</text>`).join('');
        const dots = points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.score)}" r="4" fill="${scoreColor(p.score)}"/><text x="${x(i)}" y="${y(p.score) - 9}" fill="#c9d1d9" font-size="11" text-anchor="middle">${p.score}</text>`).join('');
        return `<svg viewBox="0 0 ${W} ${H}" style="width:100%; height:auto;" role="img" aria-label="Score trend chart">${grid}<polyline points="${line}" fill="none" stroke="#58a6ff" stroke-width="2"/>${dots}</svg>`;
    }

    function renderDashboard() {
        const out = $('dashboardOutput');
        if (!out) return;
        const h = getHistory();
        if (!h.length) {
            out.innerHTML = '<div class="panel-card"><p style="color:#8b949e;">No data yet. Run a scan in the Website Audit tab and the dashboard will fill in.</p></div>';
            return;
        }
        const scores = h.map(r => r.score);
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const bugs = getBugs();
        const openBugs = bugs.filter(b => b.status !== 'Fixed').length;
        const latest = h[0];

        const byType = {}, bySev = {};
        (latest.issues || []).forEach(i => {
            byType[i.type] = (byType[i.type] || 0) + 1;
            bySev[i.severity] = (bySev[i.severity] || 0) + 1;
        });
        const typeColors = { Link: '#58a6ff', Security: '#f85149', SEO: '#a371f7', Accessibility: '#3fb950', Performance: '#f0883e' };
        const trend = h.slice(0, 10).reverse();

        out.innerHTML = `
            <div class="stat-grid">
                ${statCard('Total scans', h.length)}
                ${statCard('Average score', avg + '/100', scoreColor(avg))}
                ${statCard('Best score', Math.max(...scores) + '/100', '#3fb950')}
                ${statCard('Latest score', latest.score + '/100', scoreColor(latest.score))}
                ${statCard('Open bugs', openBugs, openBugs ? '#f0883e' : '#3fb950')}
            </div>
            <div class="panel-card"><h3>Score trend (last ${trend.length} scans)</h3>${trendSvg(trend)}</div>
            <div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
                <div class="panel-card" style="margin:0;"><h3>Issues by category (latest scan)</h3>${barRows(byType, k => typeColors[k] || '#8b949e')}</div>
                <div class="panel-card" style="margin:0;"><h3>Issues by severity (latest scan)</h3>${barRows(bySev, k => SEV_COLOR[k] || '#8b949e')}</div>
            </div>
            <p style="color:#8b949e; font-size:13px; margin-top:12px;">Latest scan: ${escapeHtml(latest.url)}</p>`;
    }

    /* ---------- Performance ---------- */
    function rate(value, good, ok) { return value <= good ? 'good' : value <= ok ? 'ok' : 'poor'; }
    const RATE_COLOR = { good: '#3fb950', ok: '#eab308', poor: '#f85149' };

    function perfCard(label, display, rating, hint) {
        return `<div class="stat"><span>${label}</span><strong style="color:${RATE_COLOR[rating]}">${display}</strong>
            <div style="font-size:11px; color:#8b949e; margin-top:4px;">${hint}</div></div>`;
    }

    function renderPerfDetails() {
        const out = $('performanceOutput');
        const sel = $('perfScanSelect');
        const scan = getHistory()[parseInt(sel.value, 10)];
        const m = scan && scan.performance;
        if (!m) {
            out.innerHTML = '<div class="panel-card"><p style="color:#8b949e;">No performance data. Run a new scan in the Website Audit tab.</p></div>';
            return;
        }
        const perfIssues = (scan.issues || []).filter(i => i.type === 'Performance');
        out.innerHTML = `
            <div class="stat-grid">
                ${perfCard('Download time', m.loadTimeMs + ' ms', rate(m.loadTimeMs, 1500, 3000), 'Good under 1500 ms')}
                ${perfCard('HTML size', m.htmlSizeKb + ' KB', rate(m.htmlSizeKb, 200, 500), 'Good under 200 KB')}
                ${perfCard('Est. requests', m.estimatedRequests, rate(m.estimatedRequests, 30, 60), 'HTML + images + scripts + CSS')}
                ${perfCard('Compression', escapeHtml(m.compression), m.compression === 'none' ? 'poor' : 'good', 'gzip or brotli recommended')}
            </div>
            <div class="panel-card"><h3>Page resources</h3>
                <div class="kv">
                    <span>Images</span><span>${m.images} (${m.lazyImages} lazy-loaded)</span>
                    <span>External scripts</span><span>${m.scripts} (${m.blockingScripts} render-blocking)</span>
                    <span>Stylesheets</span><span>${m.stylesheets}</span>
                    <span>Cache-Control</span><span>${escapeHtml(m.cacheControl)}</span>
                </div></div>
            <div class="panel-card"><h3>Performance recommendations (${perfIssues.length})</h3>
                ${perfIssues.length ? perfIssues.map(i => `<div class="issue-card"><strong>[${escapeHtml(i.severity)}]</strong> ${escapeHtml(i.message)}<br><small><strong>Fix:</strong> ${escapeHtml(i.fix)}</small></div>`).join('') : '<p style="color:#3fb950;">No performance problems found.</p>'}
            </div>`;
    }

    function renderPerformance() {
        const sel = $('perfScanSelect');
        if (!sel) return;
        const h = getHistory();
        const withPerf = h.map((r, i) => ({ r, i })).filter(x => x.r.performance);
        if (!withPerf.length) {
            sel.innerHTML = '<option value="">No scans with performance data</option>';
        } else {
            sel.innerHTML = withPerf.map(x => `<option value="${x.i}">${escapeHtml(x.r.url)} (${escapeHtml(new Date(x.r.created_at).toLocaleString())})</option>`).join('');
        }
        renderPerfDetails();
    }
    if ($('perfScanSelect')) $('perfScanSelect').addEventListener('change', renderPerfDetails);

    /* ---------- Bug Tracker ---------- */
    function renderBugs() {
        const list = $('bugList');
        if (!list) return;
        const filter = $('bugFilter').value;
        const bugs = getBugs().filter(b => filter === 'All' || b.status === filter);
        if (!bugs.length) {
            list.innerHTML = '<p style="color:#8b949e;">No bugs to show.</p>';
            return;
        }
        list.innerHTML = bugs.map(b => `
            <div class="bug-item ${b.status === 'Fixed' ? 'fixed' : ''}">
                <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;">
                    <strong style="color:#fff; word-break:break-word;">${escapeHtml(b.title)}</strong>
                    <span class="pill" style="background:${SEV_COLOR[b.severity] || '#8b949e'}; color:#0d1117;">${escapeHtml(b.severity)}</span>
                </div>
                ${b.notes ? `<p style="white-space:pre-wrap; font-size:13px; color:#8b949e; margin:8px 0; word-break:break-word;">${escapeHtml(b.notes)}</p>` : ''}
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <select class="qa-select bug-status" data-id="${b.id}" style="width:auto;">
                        ${['Open', 'In Progress', 'Fixed'].map(s => `<option ${s === b.status ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                    <button class="btn-small bug-del" data-id="${b.id}">Delete</button>
                    <span style="font-size:12px; color:#6e7681;">${escapeHtml(new Date(b.created).toLocaleString())}</span>
                </div>
            </div>`).join('');
    }

    function initBugs() {
        if (!$('addBugBtn')) return;
        $('addBugBtn').addEventListener('click', () => {
            const title = $('bugTitle').value.trim();
            if (!title) { alert('Please enter a bug title.'); return; }
            const bugs = getBugs();
            bugs.unshift({
                id: Date.now() + Math.random(),
                title,
                severity: $('bugSeverity').value,
                status: 'Open',
                notes: $('bugNotes').value.trim(),
                created: new Date().toISOString()
            });
            saveBugs(bugs);
            $('bugTitle').value = '';
            $('bugNotes').value = '';
            renderBugs();
        });
        $('bugFilter').addEventListener('change', renderBugs);
        $('bugList').addEventListener('change', e => {
            if (!e.target.classList.contains('bug-status')) return;
            const bugs = getBugs();
            const bug = bugs.find(b => String(b.id) === e.target.dataset.id);
            if (bug) { bug.status = e.target.value; saveBugs(bugs); renderBugs(); }
        });
        $('bugList').addEventListener('click', e => {
            if (!e.target.classList.contains('bug-del')) return;
            saveBugs(getBugs().filter(b => String(b.id) !== e.target.dataset.id));
            renderBugs();
        });
        $('exportBugsBtn').addEventListener('click', () => {
            let csv = 'Title,Severity,Status,Notes,Created\n';
            getBugs().forEach(b => { csv += [b.title, b.severity, b.status, b.notes, b.created].map(csvCell).join(',') + '\n'; });
            downloadBlob(csv, 'text/csv;charset=utf-8', 'qa-scout-bugs.csv');
        });
    }

    /* ---------- API Tester ---------- */
    function initApiTester() {
        const btn = $('runApiBtn');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const out = $('apiOutput');
            const url = $('apiUrl').value.trim();
            if (!url) { alert('Please enter a URL.'); return; }

            let headers;
            const rawHeaders = $('apiHeaders').value.trim();
            if (rawHeaders) {
                try { headers = JSON.parse(rawHeaders); }
                catch (e) { alert('Headers must be valid JSON.'); return; }
            }

            btn.disabled = true;
            out.innerHTML = '<p style="color:#8b949e;">Sending request...</p>';
            try {
                const resp = await fetch('/api/test-api', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url,
                        method: $('apiMethod').value,
                        headers,
                        body: $('apiBody').value,
                        expectedStatus: $('apiExpected').value,
                        maxTimeMs: $('apiMaxTime').value,
                        bodyContains: $('apiContains').value
                    })
                });
                const d = await resp.json();
                if (!resp.ok) {
                    out.innerHTML = `<p style="color:#f85149;">Error: ${escapeHtml(d.error || 'Request failed')}</p>`;
                    return;
                }
                const statusColor = d.status < 300 ? '#3fb950' : d.status < 400 ? '#eab308' : '#f85149';
                const checks = d.checks.length
                    ? d.checks.map(c => `<div style="margin-bottom:6px;">${c.passed ? '✅' : '❌'} ${escapeHtml(c.name)} <span style="color:#8b949e;">${escapeHtml(c.detail)}</span></div>`).join('')
                    : '<p style="color:#8b949e;">No assertions set.</p>';
                const hdrs = Object.entries(d.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n');
                out.innerHTML = `
                    <div class="stat-grid">
                        ${statCard('Status', d.status + ' ' + escapeHtml(d.statusText || ''), statusColor)}
                        ${statCard('Time', d.timeMs + ' ms')}
                        ${statCard('Size', d.sizeBytes + ' B')}
                    </div>
                    <div class="panel-card"><h3>Test results</h3>${checks}</div>
                    <div class="panel-card"><h3>Response headers</h3><pre class="code">${escapeHtml(hdrs)}</pre></div>
                    <div class="panel-card"><h3>Body preview</h3><pre class="code">${escapeHtml(d.bodyPreview || '(empty)')}</pre></div>`;
            } catch (err) {
                out.innerHTML = '<p style="color:#f85149;">Failed to connect to the server.</p>';
            } finally {
                btn.disabled = false;
            }
        });
    }

    /* ---------- PDF export (browser print dialog -> Save as PDF) ---------- */
    function exportPdf(data) {
        const w = window.open('', '_blank');
        if (!w) { alert('Please allow pop-ups to export the PDF.'); return; }
        const m = data.performance;
        const rows = (data.issues || []).map(i => `
            <tr><td>${escapeHtml(i.type)}</td><td>${escapeHtml(i.severity)}</td><td>${escapeHtml(i.message)}</td><td>${escapeHtml(i.fix)}</td></tr>`).join('');
        w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>QA Scout Report</title>
            <style>
                body{font-family:Arial,sans-serif;color:#111;margin:30px;}
                h1{margin-bottom:4px;} .meta{color:#555;margin-bottom:20px;}
                .score{font-size:34px;font-weight:bold;color:${data.score >= 80 ? '#1a7f37' : data.score >= 50 ? '#9a6700' : '#cf222e'};}
                table{border-collapse:collapse;width:100%;margin-top:10px;font-size:12px;}
                th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top;}
                th{background:#f0f0f0;} td:nth-child(3),td:nth-child(4){word-break:break-word;}
            </style></head><body>
            <h1>QA Scout Report</h1>
            <div class="meta">${escapeHtml(data.url)}<br>Scanned: ${escapeHtml(new Date(data.scannedAt || Date.now()).toLocaleString())}</div>
            <div>Overall score: <span class="score">${escapeHtml(data.score)}/100</span></div>
            ${m ? `<h3>Performance</h3><p>Download time: ${m.loadTimeMs} ms &middot; HTML size: ${m.htmlSizeKb} KB &middot; Estimated requests: ${m.estimatedRequests} &middot; Compression: ${escapeHtml(m.compression)}</p>` : ''}
            <h3>Issues (${(data.issues || []).length})</h3>
            ${rows ? `<table><thead><tr><th>Category</th><th>Severity</th><th>Issue</th><th>Suggested fix</th></tr></thead><tbody>${rows}</tbody></table>` : '<p>No issues found.</p>'}
            <script>window.onload=function(){window.print();};<\/script>
            </body></html>`);
        w.document.close();
    }

    /* ---------- Wire up ---------- */
    initBugs();
    initApiTester();
    window.QA = { logBug, exportPdf };
    window.QA_HOOKS = {
        'dashboard-view': renderDashboard,
        'performance-view': renderPerformance,
        'bugs-view': renderBugs
    };
})();
