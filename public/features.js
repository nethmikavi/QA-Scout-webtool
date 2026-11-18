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

    /* ---------- Test case storage ---------- */
    const TESTS_KEY = 'qaScoutTests';
    function getTests() {
        try {
            const parsed = JSON.parse(localStorage.getItem(TESTS_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }
    function saveTests(list) {
        try { localStorage.setItem(TESTS_KEY, JSON.stringify(list)); } catch (e) { console.warn(e); }
    }
    function testStats(list) {
        const pass = list.filter(t => t.status === 'Pass').length;
        const fail = list.filter(t => t.status === 'Fail').length;
        const executed = pass + fail;
        return { total: list.length, pass, fail, notRun: list.length - executed, rate: executed ? Math.round((pass / executed) * 100) : null };
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
                ${(() => { const t = testStats(getTests()); return statCard('Test pass rate', t.rate === null ? '—' : t.rate + '%', t.rate === null ? '#8b949e' : scoreColor(t.rate)); })()}
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
                ${perfCard('HTML size', m.htmlSizeKb + ' KB', rate(m.htmlSizeKb, 200, 500), 'Good under 200 KB' + (m.transferSizeKb ? ' · ' + m.transferSizeKb + ' KB transferred' : ''))}
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


    /* ---------- AI helpers ---------- */
    async function aiPost(path, body) {
        let resp, data;
        try {
            resp = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            data = await resp.json();
        } catch (e) {
            return { ok: false, error: 'Could not reach the server. Please try again.' };
        }
        if (!resp.ok) {
            const msg = data && data.code === 'NO_KEY'
                ? 'AI is not set up on this server yet. The site owner needs to add the GEMINI_API_KEY setting.'
                : (data && data.error) || 'AI request failed.';
            return { ok: false, error: msg };
        }
        return { ok: true, data };
    }

    // Tiny, safe formatter: escapes everything, then supports **bold**, line breaks and ``` code blocks.
    function mdLite(text) {
        return String(text || '').split(/```[a-zA-Z]*\n?/).map((part, i) =>
            i % 2
                ? `<pre class="code">${escapeHtml(part.replace(/\n$/, ''))}</pre>`
                : escapeHtml(part).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')
        ).join('');
    }

    async function aiSummary(scan, box, btn) {
        const label = btn.textContent;
        btn.disabled = true; btn.textContent = '✨ Thinking...';
        box.innerHTML = '';
        const r = await aiPost('/api/ai/summary', { url: scan.url, score: scan.score, issues: scan.issues, performance: scan.performance });
        btn.disabled = false; btn.textContent = label;
        if (!r.ok) { box.innerHTML = `<div class="ai-box" style="color:#f85149;">${escapeHtml(r.error)}</div>`; return; }
        const sm = r.data.summary || {};
        const fixes = Array.isArray(sm.topFixes) ? sm.topFixes : [];
        box.innerHTML = `<div class="ai-box">
            <strong style="color:#fff;">✨ AI Summary</strong>
            <p style="margin:8px 0;">${escapeHtml(sm.overview)}</p>
            ${fixes.length ? '<h4>Fix these first</h4>' + fixes.map((f, i) => `<p style="margin:6px 0;"><strong>${i + 1}. ${escapeHtml(f.title)}</strong><br><span style="color:#8b949e;">Why:</span> ${escapeHtml(f.why)}<br><span style="color:#8b949e;">How:</span> ${escapeHtml(f.how)}</p>`).join('') : ''}
            ${sm.positives ? `<h4>What is already good</h4><p style="margin:4px 0;">${escapeHtml(sm.positives)}</p>` : ''}
            <small style="color:#6e7681;">AI-generated advice. Always verify before changing production.</small></div>`;
    }

    async function aiFix(issue, url, box, btn) {
        const label = btn.textContent;
        btn.disabled = true; btn.textContent = '✨ Thinking...';
        box.innerHTML = '';
        const r = await aiPost('/api/ai/fix', { url, issue });
        btn.disabled = false; btn.textContent = label;
        box.innerHTML = r.ok
            ? `<div class="ai-box">${mdLite(r.data.fix)}</div>`
            : `<div class="ai-box" style="color:#f85149;">${escapeHtml(r.error)}</div>`;
    }

    /* ---------- Test Case Manager ---------- */
    function nextTestId(list) {
        const max = list.reduce((m, t) => Math.max(m, parseInt(String(t.id).replace(/\D/g, ''), 10) || 0), 0);
        return 'TC-' + String(max + 1).padStart(3, '0');
    }

    function addTests(newOnes) {
        const list = getTests();
        const added = [];
        newOnes.forEach(t => {
            const id = nextTestId(list.concat(added));
            added.push({
                id, title: t.title, type: t.type || 'Manual', priority: t.priority || 'Medium',
                steps: t.steps || [], expected: t.expected || '', status: 'Not Run',
                source: t.source || 'Manual', created: new Date().toISOString(), bugLogged: false
            });
        });
        saveTests(added.reverse().concat(list));
    }

    function renderTests() {
        const listEl = $('tcList');
        if (!listEl) return;
        const all = getTests();
        const st = testStats(all);

        $('tcSummary').innerHTML = all.length ? `
            <div class="stat-grid">
                ${statCard('Total', st.total)}
                ${statCard('Passed', st.pass, '#3fb950')}
                ${statCard('Failed', st.fail, st.fail ? '#f85149' : '#fff')}
                ${statCard('Not run', st.notRun, '#8b949e')}
                ${statCard('Pass rate', st.rate === null ? '—' : st.rate + '%', st.rate === null ? '#8b949e' : scoreColor(st.rate))}
            </div>
            <div class="progress"><div style="width:${st.total ? Math.round((st.pass / st.total) * 100) : 0}%"></div></div>` : '';

        const filter = $('tcFilter').value;
        const shown = all.filter(t => filter === 'All' || t.status === filter);
        if (!shown.length) {
            listEl.innerHTML = `<p style="color:#8b949e;">${all.length ? 'No test cases match this filter.' : 'No test cases yet. Generate some with AI or add one manually.'}</p>`;
            return;
        }
        const prColor = { High: '#f85149', Medium: '#eab308', Low: '#58a6ff' };
        listEl.innerHTML = shown.map(t => `
            <div class="tc-case ${t.status === 'Pass' ? 'pass' : t.status === 'Fail' ? 'fail' : ''}">
                <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; align-items:center;">
                    <strong style="color:#fff; word-break:break-word;">${escapeHtml(t.id)} &middot; ${escapeHtml(t.title)}</strong>
                    <span>
                        ${t.source === 'AI' ? '<span class="pill" style="background:#8957e5; color:#fff;">✨ AI</span> ' : ''}
                        <span class="pill" style="background:#30363d; color:#c9d1d9;">${escapeHtml(t.type)}</span>
                        <span class="pill" style="background:${prColor[t.priority] || '#8b949e'}; color:#0d1117;">${escapeHtml(t.priority)}</span>
                    </span>
                </div>
                ${t.steps && t.steps.length ? `<ol>${t.steps.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ol>` : ''}
                ${t.expected ? `<p style="font-size:13px; color:#8b949e; margin:4px 0 8px;"><strong style="color:#c9d1d9;">Expected:</strong> ${escapeHtml(t.expected)}</p>` : ''}
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <select class="qa-select tc-status" data-id="${escapeHtml(t.id)}" style="width:auto;">
                        ${['Not Run', 'Pass', 'Fail'].map(x => `<option ${x === t.status ? 'selected' : ''}>${x}</option>`).join('')}
                    </select>
                    ${t.status === 'Fail' ? `<button class="btn-small tc-bug" data-id="${escapeHtml(t.id)}" ${t.bugLogged ? 'disabled' : ''}>${t.bugLogged ? '✅ Bug logged' : '🐞 Log bug'}</button>` : ''}
                    <button class="btn-small tc-del" data-id="${escapeHtml(t.id)}">Delete</button>
                </div>
            </div>`).join('');
    }

    function initTests() {
        if (!$('addTcBtn')) return;

        $('addTcBtn').addEventListener('click', () => {
            const title = $('tcTitle').value.trim();
            if (!title) { alert('Please enter a test case title.'); return; }
            addTests([{
                title, priority: $('tcPriority').value, type: 'Manual', source: 'Manual',
                steps: $('tcSteps').value.split('\n').map(x => x.trim()).filter(Boolean),
                expected: $('tcExpected').value.trim()
            }]);
            ['tcTitle', 'tcSteps', 'tcExpected'].forEach(id => { $(id).value = ''; });
            renderTests();
        });

        $('aiGenBtn').addEventListener('click', async () => {
            const feature = $('aiFeature').value.trim();
            const msg = $('aiGenMsg');
            if (feature.length < 5) { msg.style.color = '#f85149'; msg.textContent = 'Please describe the feature first.'; return; }
            const btn = $('aiGenBtn');
            btn.disabled = true; btn.textContent = '✨ Generating...';
            msg.style.color = '#8b949e'; msg.textContent = 'This can take a few seconds.';
            const r = await aiPost('/api/ai/testcases', { feature, count: $('aiCount').value });
            btn.disabled = false; btn.textContent = '✨ Generate with AI';
            if (!r.ok) { msg.style.color = '#f85149'; msg.textContent = r.error; return; }
            const cases = r.data.testCases || [];
            if (!cases.length) { msg.style.color = '#f85149'; msg.textContent = 'The AI returned no test cases. Try describing the feature in more detail.'; return; }
            addTests(cases.map(c => ({ ...c, source: 'AI' })));
            msg.style.color = '#3fb950';
            msg.textContent = `Added ${cases.length} AI test cases below. Review them and delete any you don't need.`;
            renderTests();
        });

        $('tcFilter').addEventListener('change', renderTests);

        $('tcList').addEventListener('change', e => {
            if (!e.target.classList.contains('tc-status')) return;
            const list = getTests();
            const t = list.find(x => x.id === e.target.dataset.id);
            if (t) { t.status = e.target.value; saveTests(list); renderTests(); }
        });

        $('tcList').addEventListener('click', e => {
            const id = e.target.dataset && e.target.dataset.id;
            if (!id) return;
            const list = getTests();
            if (e.target.classList.contains('tc-del')) {
                saveTests(list.filter(x => x.id !== id));
                renderTests();
            } else if (e.target.classList.contains('tc-bug')) {
                const t = list.find(x => x.id === id);
                if (!t || t.bugLogged) return;
                const bugs = getBugs();
                bugs.unshift({
                    id: Date.now() + Math.random(),
                    title: `Test failed: ${t.id} ${t.title}`.slice(0, 200),
                    severity: t.priority === 'High' ? 'Major' : t.priority === 'Low' ? 'Minor' : 'Medium',
                    status: 'Open',
                    notes: `Steps:\n${(t.steps || []).map((x, i) => `${i + 1}. ${x}`).join('\n')}\nExpected: ${t.expected || ''}`,
                    created: new Date().toISOString()
                });
                saveBugs(bugs);
                t.bugLogged = true;
                saveTests(list);
                renderTests();
            }
        });

        $('exportTcBtn').addEventListener('click', () => {
            let csv = 'ID,Title,Type,Priority,Status,Steps,Expected,Source\n';
            getTests().forEach(t => {
                csv += [t.id, t.title, t.type, t.priority, t.status, (t.steps || []).join(' | '), t.expected, t.source].map(csvCell).join(',') + '\n';
            });
            downloadBlob(csv, 'text/csv;charset=utf-8', 'qa-scout-test-cases.csv');
        });

        $('clearTcBtn').addEventListener('click', () => {
            if (getTests().length && confirm('Delete ALL test cases? This cannot be undone.')) {
                saveTests([]);
                renderTests();
            }
        });
    }

    /* ---------- Wire up ---------- */
    initBugs();
    initApiTester();
    initTests();
    window.QA = { logBug, exportPdf, aiSummary, aiFix };
    window.QA_HOOKS = {
        'dashboard-view': renderDashboard,
        'performance-view': renderPerformance,
        'bugs-view': renderBugs,
        'testcases-view': renderTests
    };
})();
