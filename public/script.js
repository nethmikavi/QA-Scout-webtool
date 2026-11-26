/* Inline SVG icons (sprite lives in index.html) */
function qaIcon(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
}

/* ========== Helpers ========== */
const HISTORY_KEY = 'qaScoutHistory';
const MAX_HISTORY = 20;

function escapeHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeHref(url) {
    return /^https?:\/\//i.test(url) ? escapeHtml(url) : '#';
}

function normalizeUrlInput(value) {
    const v = value.trim();
    if (!v) return '';
    return /^https?:\/\//i.test(v) ? v : 'https://' + v;
}

function scoreColor(score) {
    if (score >= 80) return '#1a7f37';
    if (score >= 50) return '#b7791f';
    return '#d1242f';
}

/* ========== Scan history (browser localStorage) ========== */
function getHistory() {
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

function saveToHistory(scan) {
    const history = getHistory();
    history.unshift({
        id: Date.now(),
        url: scan.url,
        score: scan.score,
        created_at: scan.scannedAt || new Date().toISOString(),
        issues: scan.issues || [],
        performance: scan.performance || null
    });
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
    } catch (e) {
        console.warn('Could not save scan history:', e);
    }
}

function clearHistory() {
    try { localStorage.removeItem(HISTORY_KEY); } catch (e) { /* ignore */ }
}

/* ========== Tab switching ========== */
const navTabs = document.querySelectorAll('.nav-tab');
const viewPanels = document.querySelectorAll('.view-panel');

function switchView(targetId) {
    viewPanels.forEach(panel => {
        panel.classList.toggle('hidden', panel.id !== targetId);
    });

    navTabs.forEach(tab => {
        const active = tab.getAttribute('data-target') === targetId;
        if (tab.closest('.nav-links')) {
            tab.style.color = active ? '#ffffff' : '#6b6455';
            tab.style.fontWeight = active ? '600' : '400';
        }
    });

    if (targetId === 'history-view') loadScanHistory();
    if (targetId === 'comparison-view') loadComparisonDropdowns();
    if (window.QA_HOOKS && window.QA_HOOKS[targetId]) window.QA_HOOKS[targetId]();
}

function routeFromHash() {
    const hash = window.location.hash || '#audit';
    const tab = Array.from(navTabs).find(t => t.getAttribute('href') === hash);
    switchView(tab ? tab.getAttribute('data-target') : 'audit-view');
}

navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        const href = tab.getAttribute('href');
        if (window.location.hash !== href) {
            history.pushState(null, '', href);
        }
        switchView(tab.getAttribute('data-target'));
    });
});

window.addEventListener('hashchange', routeFromHash);
window.addEventListener('popstate', routeFromHash);
document.addEventListener('DOMContentLoaded', routeFromHash);

/* ========== Scan History tab ========== */
function loadScanHistory() {
    const out = document.getElementById('historyOutput');
    if (!out) return;

    const reports = getHistory();
    if (reports.length === 0) {
        out.innerHTML = '<p style="color: #6b6455;">No recent scan history found. Run your first audit to see it logged here!</p>';
        return;
    }

    let html = `
        <div style="display:flex; justify-content:flex-end; margin-bottom:10px;">
            <button id="clearHistoryBtn" style="padding:6px 12px; background:#17130f; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px;">Clear history</button>
        </div>
        <div style="overflow-x:auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
            <thead>
                <tr style="border-bottom: 1px solid #17130f; color: #6b6455;">
                    <th style="padding: 10px;">Target URL</th>
                    <th style="padding: 10px;">Score</th>
                    <th style="padding: 10px;">Issues</th>
                    <th style="padding: 10px;">Date</th>
                </tr>
            </thead>
            <tbody>`;

    reports.forEach(r => {
        html += `
            <tr style="border-bottom: 1px solid #d9d2c3;">
                <td style="padding: 10px; word-break: break-all;"><a href="${safeHref(r.url)}" target="_blank" rel="noopener noreferrer" style="color: #5b3fd1; text-decoration: none;">${escapeHtml(r.url)}</a></td>
                <td style="padding: 10px; font-weight: bold; color: ${scoreColor(r.score)};">${escapeHtml(r.score)}/100</td>
                <td style="padding: 10px; color: #3a352c;">${(r.issues || []).length}</td>
                <td style="padding: 10px; color: #6b6455;">${escapeHtml(new Date(r.created_at).toLocaleString())}</td>
            </tr>`;
    });

    html += '</tbody></table></div>';
    out.innerHTML = html;

    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
        clearHistory();
        loadScanHistory();
    });
}

/* ========== Scan Comparison tab ========== */
function loadComparisonDropdowns() {
    const selectA = document.getElementById('compareScanA');
    const selectB = document.getElementById('compareScanB');
    if (!selectA || !selectB) return;

    const reports = getHistory();
    if (reports.length === 0) {
        const empty = '<option value="">No history available - run a scan first</option>';
        selectA.innerHTML = empty;
        selectB.innerHTML = empty;
        return;
    }

    // value = index into the history array (safe for any URL characters)
    const options = reports.map((r, i) =>
        `<option value="${i}">${escapeHtml(r.url)} (${escapeHtml(r.score)}/100 - ${escapeHtml(new Date(r.created_at).toLocaleString())})</option>`
    ).join('');

    selectA.innerHTML = options;
    selectB.innerHTML = options;
    // Baseline = older scan, Recent = newest scan
    if (reports.length > 1) {
        selectA.selectedIndex = 1;
        selectB.selectedIndex = 0;
    }
}

function issueKey(i) {
    return `${i.type}|${i.message}`;
}

function issueListHtml(list, color) {
    if (list.length === 0) return '<p style="color:#6b6455; font-size:13px; margin:0;">None</p>';
    return list.map(i =>
        `<div style="padding:8px 10px; margin-bottom:6px; background:#f3eee3; border-left:3px solid ${color}; border-radius:4px; font-size:13px;">
            <strong>[${escapeHtml(i.severity)}] ${escapeHtml(i.type)}</strong>: ${escapeHtml(i.message)}
        </div>`).join('');
}

document.getElementById('runComparisonBtn').addEventListener('click', () => {
    const idxA = document.getElementById('compareScanA').value;
    const idxB = document.getElementById('compareScanB').value;
    const output = document.getElementById('comparisonOutput');

    const reports = getHistory();
    const scanA = reports[parseInt(idxA, 10)];
    const scanB = reports[parseInt(idxB, 10)];

    if (!scanA || !scanB) {
        alert('Please select two valid scans to compare.');
        return;
    }

    const scoreDiff = scanB.score - scanA.score;
    const diffColor = scoreDiff > 0 ? '#1a7f37' : scoreDiff < 0 ? '#d1242f' : '#6b6455';

    const issuesA = scanA.issues || [];
    const issuesB = scanB.issues || [];
    const keysA = new Set(issuesA.map(issueKey));
    const keysB = new Set(issuesB.map(issueKey));

    const fixed = issuesA.filter(i => !keysB.has(issueKey(i)));
    const added = issuesB.filter(i => !keysA.has(issueKey(i)));
    const remaining = issuesB.filter(i => keysA.has(issueKey(i)));

    output.innerHTML = `
        <div style="background: #fffdf8; padding: 20px; border-radius: 8px; border: 1px solid #17130f; color: #3a352c;">
            <h3 style="margin-bottom: 15px; color:#17130f;">Comparison Summary</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="background: #f3eee3; padding: 15px; border-radius: 6px;">
                    <span style="color: #6b6455; font-size: 12px;">Baseline (A)</span>
                    <h4 style="color: #5b3fd1; margin: 5px 0; word-break: break-all;">${escapeHtml(scanA.url)}</h4>
                    <p>Score: <strong>${escapeHtml(scanA.score)}/100</strong> &middot; ${issuesA.length} issue(s)</p>
                </div>
                <div style="background: #f3eee3; padding: 15px; border-radius: 6px;">
                    <span style="color: #6b6455; font-size: 12px;">Recent (B)</span>
                    <h4 style="color: #5b3fd1; margin: 5px 0; word-break: break-all;">${escapeHtml(scanB.url)}</h4>
                    <p>Score: <strong>${escapeHtml(scanB.score)}/100</strong> &middot; ${issuesB.length} issue(s)</p>
                </div>
            </div>
            <div style="background: #f3eee3; padding: 15px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
                <p style="margin: 0; font-size: 16px;">Net Score Change: <strong style="color: ${diffColor};">${scoreDiff > 0 ? '+' : ''}${scoreDiff} Points</strong></p>
            </div>
            <h4 style="color:#1a7f37; margin-bottom:8px;">Fixed issues (${fixed.length})</h4>
            ${issueListHtml(fixed, '#1a7f37')}
            <h4 style="color:#d1242f; margin:16px 0 8px;">New issues (${added.length})</h4>
            ${issueListHtml(added, '#d1242f')}
            <h4 style="color:#b7791f; margin:16px 0 8px;">Still present (${remaining.length})</h4>
            ${issueListHtml(remaining, '#b7791f')}
        </div>
    `;
});

/* ========== Run a scan ========== */
function downloadBlob(content, mime, filename) {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function fileSafeName(url) {
    return url.replace(/^https?:\/\//i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'report';
}

function csvCell(value) {
    return `"${String(value == null ? '' : value).replace(/"/g, '""')}"`;
}

async function runScan() {
    const input = document.getElementById('urlInput');
    const scanBtn = document.getElementById('scanBtn');
    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    const outputDiv = document.getElementById('output');

    const url = normalizeUrlInput(input.value);
    if (!url) {
        alert('Please enter a valid website URL.');
        return;
    }

    scanBtn.disabled = true;
    loadingDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    outputDiv.innerHTML = '';

    try {
        const response = await fetch('/api/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
            throw new Error(response.status === 504
                ? 'The scan timed out. Try a lighter page.'
                : `Server returned an unexpected response (HTTP ${response.status}).`);
        }

        loadingDiv.classList.add('hidden');
        resultsDiv.classList.remove('hidden');

        if (!response.ok) {
            outputDiv.innerHTML = `<p style="color: #d1242f;">Error: ${escapeHtml(data.error || 'Scan failed')}</p>`;
            return;
        }

        saveToHistory(data);

        const has = type => data.issues.some(i => i.type === type);
        const badge = (label, bad) => `
            <span style="display:inline-flex; align-items:center; gap:6px; padding: 5px 10px; border-radius: 6px; border:2px solid #17130f; background: ${bad ? '#fff3cd' : '#d4edda'}; color: ${bad ? '#856404' : '#155724'}; font-size: 13px; font-weight: 500;">
                ${label}: ${bad ? 'Issues Found' : 'Passed'}
            </span>`;

        const issuesHtml = data.issues.length > 0
            ? data.issues.map((issue, idx) => `
                <div class="issue-card" style="margin-bottom: 10px; padding: 12px;">
                    <strong>[${escapeHtml(issue.severity)}] ${escapeHtml(issue.type)}</strong>: ${escapeHtml(issue.message)}
                    <br><small><strong>Fix:</strong> ${escapeHtml(issue.fix)}</small>
                    <br><button class="btn-small log-bug-btn" data-idx="${idx}" style="margin-top:6px;">${qaIcon('bug')} Log as bug</button>
                    <button class="btn-small ai-fix-btn" data-idx="${idx}" style="margin-top:6px;">${qaIcon('sparkles')} AI fix</button>
                    <div class="ai-fix-box"></div>
                </div>`).join('')
            : '<p style="color: #1a7f37; font-weight: bold;">No major issues found! Great job.</p>';

        outputDiv.innerHTML = `
            <div class="result-card">
                <h3 style="word-break: break-all;">Scan Report for: ${escapeHtml(data.url)}</h3>
                <p><strong>Overall QA Score:</strong> <span style="font-size: 20px; color: ${scoreColor(data.score)}; font-weight: bold;">${escapeHtml(data.score)}/100</span></p>

                <div style="margin: 15px 0; display: flex; gap: 8px; flex-wrap: wrap;">
                    ${badge(qaIcon('link') + ' Links', has('Link'))}
                    ${badge(qaIcon('shield') + ' Security', has('Security'))}
                    ${badge(qaIcon('trending-up') + ' SEO', has('SEO'))}
                    ${badge(qaIcon('accessibility') + ' Accessibility', has('Accessibility'))}
                    ${badge(qaIcon('zap') + ' Performance', has('Performance'))}
                </div>

                <div class="export-row" style="margin: 15px 0; display: flex; flex-wrap: wrap; gap: 10px;">
                    <button id="downloadJsonBtn" style="padding: 8px 14px; background: #2ea043; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">${qaIcon('braces')} Export JSON</button>
                    <button id="downloadCsvBtn" style="padding: 8px 14px; background: #17130f; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">${qaIcon('table')} Export CSV</button>
                    <button id="downloadPdfBtn" style="padding: 8px 14px; background: #17130f; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">${qaIcon('file-text')} Export PDF</button>
                    <button id="aiSummaryBtn" style="padding: 8px 14px; background: #8957e5; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">${qaIcon('sparkles')} AI Summary</button>
                </div>

                <div id="aiSummaryBox"></div>

                <h4 style="margin-top: 15px;">Detected Issues (${data.issues.length}):</h4>
                ${issuesHtml}
            </div>
        `;

        document.getElementById('downloadPdfBtn').addEventListener('click', () => window.QA && window.QA.exportPdf(data));
        document.getElementById('aiSummaryBtn').addEventListener('click', (e) => {
            if (window.QA) window.QA.aiSummary(data, document.getElementById('aiSummaryBox'), e.currentTarget);
        });
        outputDiv.querySelectorAll('.ai-fix-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const card = btn.closest('.issue-card');
                if (window.QA) window.QA.aiFix(data.issues[parseInt(btn.dataset.idx, 10)], data.url, card.querySelector('.ai-fix-box'), btn);
            });
        });
        outputDiv.querySelectorAll('.log-bug-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (window.QA) window.QA.logBug(data.issues[parseInt(btn.dataset.idx, 10)], data.url);
                btn.innerHTML = qaIcon('check') + ' Logged in Bug Tracker';
                btn.disabled = true;
            });
        });

        document.getElementById('downloadJsonBtn').addEventListener('click', () => {
            downloadBlob(JSON.stringify(data, null, 2), 'application/json', `qa-report-${fileSafeName(data.url)}.json`);
        });

        document.getElementById('downloadCsvBtn').addEventListener('click', () => {
            let csv = 'Type,Severity,Message,Fix\n';
            data.issues.forEach(i => {
                csv += [i.type, i.severity, i.message, i.fix].map(csvCell).join(',') + '\n';
            });
            downloadBlob(csv, 'text/csv;charset=utf-8', `qa-report-${fileSafeName(data.url)}.csv`);
        });
    } catch (err) {
        loadingDiv.classList.add('hidden');
        resultsDiv.classList.remove('hidden');
        outputDiv.innerHTML = `<p style="color: #d1242f;">${escapeHtml(err.message || 'Failed to connect to the server.')}</p>`;
    } finally {
        scanBtn.disabled = false;
    }
}

document.getElementById('scanBtn').addEventListener('click', runScan);
document.getElementById('urlInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runScan();
});
