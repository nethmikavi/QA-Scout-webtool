// Tab Switching Router Logic
const navTabs = document.querySelectorAll('.nav-tab');
const viewPanels = document.querySelectorAll('.view-panel');

function switchView(targetId) {
    viewPanels.forEach(panel => {
        if (panel.id === targetId) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    });

    navTabs.forEach(tab => {
        if (tab.getAttribute('data-target') === targetId) {
            tab.style.color = '#ffffff';
            tab.style.fontWeight = '600';
        } else {
            tab.style.color = '#8b949e';
            tab.style.fontWeight = '400';
        }
    });
}

navTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.preventDefault();
        const target = tab.getAttribute('data-target');
        window.location.hash = tab.getAttribute('href');
        switchView(target);

        // Load scan history when the history tab is clicked
        if (target === 'history-view') {
            loadScanHistory();
        }

        // Load comparison dropdowns when the comparison tab is clicked
        if (target === 'comparison-view') {
            loadComparisonDropdowns();
        }
    });
});

window.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash || '#audit';
    const matchingTab = Array.from(navTabs).find(t => t.getAttribute('href') === hash);
    if (matchingTab) {
        const targetId = matchingTab.getAttribute('data-target');
        switchView(targetId);
        if (targetId === 'history-view') {
            loadScanHistory();
        }
        if (targetId === 'comparison-view') {
            loadComparisonDropdowns();
        }
    }
});

// Load Scan History from SQLite Backend
async function loadScanHistory() {
    const historyOutput = document.getElementById('historyOutput');
    if (!historyOutput) return;

    historyOutput.innerHTML = '<p style="color: #8b949e;">Loading scan history...</p>';

    try {
        const response = await fetch('/api/reports');
        const reports = await response.json();

        if (!response.ok || reports.length === 0) {
            historyOutput.innerHTML = '<p style="color: #8b949e;">No recent scan history found. Run your first audit to see it logged here!</p>';
            return;
        }

        let html = `
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
                <thead>
                    <tr style="border-bottom: 1px solid #30363d; color: #8b949e;">
                        <th style="padding: 10px;">Target URL</th>
                        <th style="padding: 10px;">Score</th>
                        <th style="padding: 10px;">Date</th>
                    </tr>
                </thead>
                <tbody>
        `;

        reports.forEach(r => {
            html += `
                <tr style="border-bottom: 1px solid #21262d;">
                    <td style="padding: 10px;"><a href="${r.url}" target="_blank" style="color: #58a6ff; text-decoration: none;">${r.url}</a></td>
                    <td style="padding: 10px; font-weight: bold; color: ${r.score >= 80 ? '#3fb950' : '#eab308'};">${r.score}/100</td>
                    <td style="padding: 10px; color: #8b949e;">${new Date(r.created_at).toLocaleString()}</td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        historyOutput.innerHTML = html;
    } catch (err) {
        historyOutput.innerHTML = '<p style="color: #f85149;">Failed to load scan history from database.</p>';
    }
}

// Load reports into Comparison Dropdowns
async function loadComparisonDropdowns() {
    const selectA = document.getElementById('compareScanA');
    const selectB = document.getElementById('compareScanB');
    if (!selectA || !selectB) return;

    try {
        const response = await fetch('/api/reports');
        const reports = await response.json();

        if (!response.ok || reports.length === 0) {
            selectA.innerHTML = '<option value="">No history available</option>';
            selectB.innerHTML = '<option value="">No history available</option>';
            return;
        }

        let optionsHtml = '';
        reports.forEach((r) => {
            optionsHtml += `<option value='${JSON.stringify(r)}'>${r.url} (${r.score}/100 - ${new Date(r.created_at).toLocaleDateString()})</option>`;
        });

        selectA.innerHTML = optionsHtml;
        selectB.innerHTML = optionsHtml;
        if (reports.length > 1) selectB.selectedIndex = 1;
    } catch (err) {
        selectA.innerHTML = '<option value="">Failed to load data</option>';
        selectB.innerHTML = '<option value="">Failed to load data</option>';
    }
}

// Comparison Execution Logic
document.getElementById('runComparisonBtn')?.addEventListener('click', () => {
    const rawA = document.getElementById('compareScanA').value;
    const rawB = document.getElementById('compareScanB').value;
    const output = document.getElementById('comparisonOutput');

    if (!rawA || !rawB) {
        alert('Please select two valid scans to compare.');
        return;
    }

    const scanA = JSON.parse(rawA);
    const scanB = JSON.parse(rawB);

    const scoreDiff = scanB.score - scanA.score;
    const diffColor = scoreDiff >= 0 ? '#3fb950' : '#f85149';

    output.innerHTML = `
        <div style="background: #161b22; padding: 20px; border-radius: 8px; border: 1px solid #30363d; color: #c9d1d9;">
            <h3 style="margin-bottom: 15px; color: #fff;">Comparison Summary</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div style="background: #0d1117; padding: 15px; border-radius: 6px;">
                    <span style="color: #8b949e; font-size: 12px;">Baseline (A)</span>
                    <h4 style="color: #58a6ff; margin: 5px 0;">${scanA.url}</h4>
                    <p>Score: <strong>${scanA.score}/100</strong></p>
                </div>
                <div style="background: #0d1117; padding: 15px; border-radius: 6px;">
                    <span style="color: #8b949e; font-size: 12px;">Recent (B)</span>
                    <h4 style="color: #58a6ff; margin: 5px 0;">${scanB.url}</h4>
                    <p>Score: <strong>${scanB.score}/100</strong></p>
                </div>
            </div>
            <div style="background: #0d1117; padding: 15px; border-radius: 6px; text-align: center;">
                <p style="margin: 0; font-size: 16px;">Net Score Change: <strong style="color: ${diffColor};">${scoreDiff > 0 ? '+' : ''}${scoreDiff} Points</strong></p>
            </div>
        </div>
    `;
});

// Scan Logic
document.getElementById('scanBtn').addEventListener('click', async () => {
    const url = document.getElementById('urlInput').value.trim();
    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    const outputDiv = document.getElementById('output');

    if (!url) {
        alert('Please enter a valid website URL.');
        return;
    }

    loadingDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    outputDiv.innerHTML = '';

    try {
        const response = await fetch('/api/scan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        const data = await response.json();

        loadingDiv.classList.add('hidden');
        resultsDiv.classList.remove('hidden');

        if (response.ok) {
            // Check category statuses based on detected issues
            const hasLinkIssues = data.issues.some(i => i.type === 'Link');
            const hasSecurityIssues = data.issues.some(i => i.type === 'Security');
            const hasSeoIssues = data.issues.some(i => i.type === 'SEO');
            const hasA11yIssues = data.issues.some(i => i.type === 'Accessibility');

            let issuesHtml = data.issues.length > 0 
                ? data.issues.map(issue => `
                    <div class="issue-card" style="margin-bottom: 10px; padding: 12px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                        <strong>[${issue.severity}] ${issue.type}</strong>: ${issue.message}
                        <br><small><strong>Fix:</strong> ${issue.fix}</small>
                    </div>`).join('')
                : '<p style="color: green; font-weight: bold;">No major issues found! Great job.</p>';

            outputDiv.innerHTML = `
                <div class="result-card">
                    <h3>Scan Report for: ${data.url}</h3>
                    <p><strong>Overall QA Score:</strong> <span style="font-size: 20px; color: #27ae60; font-weight: bold;">${data.score}/100</span></p>
                    
                    <div class="category-badges" style="margin: 15px 0; display: flex; gap: 8px; flex-wrap: wrap;">
                        <span style="padding: 5px 10px; border-radius: 4px; background: ${hasLinkIssues ? '#fff3cd' : '#d4edda'}; color: ${hasLinkIssues ? '#856404' : '#155724'}; font-size: 13px; font-weight: 500;">
                            🔗 Links: ${hasLinkIssues ? 'Issues Found' : 'Passed'}
                        </span>
                        <span style="padding: 5px 10px; border-radius: 4px; background: ${hasSecurityIssues ? '#fff3cd' : '#d4edda'}; color: ${hasSecurityIssues ? '#856404' : '#155724'}; font-size: 13px; font-weight: 500;">
                            🛡️ Security: ${hasSecurityIssues ? 'Issues Found' : 'Passed'}
                        </span>
                        <span style="padding: 5px 10px; border-radius: 4px; background: ${hasSeoIssues ? '#fff3cd' : '#d4edda'}; color: ${hasSeoIssues ? '#856404' : '#155724'}; font-size: 13px; font-weight: 500;">
                            📈 SEO: ${hasSeoIssues ? 'Issues Found' : 'Passed'}
                        </span>
                        <span style="padding: 5px 10px; border-radius: 4px; background: ${hasA11yIssues ? '#fff3cd' : '#d4edda'}; color: ${hasA11yIssues ? '#856404' : '#155724'}; font-size: 13px; font-weight: 500;">
                            ♿ Accessibility: ${hasA11yIssues ? 'Issues Found' : 'Passed'}
                        </span>
                    </div>

                    <!-- Export Actions -->
                    <div class="export-actions" style="margin: 15px 0; display: flex; gap: 10px;">
                        <button id="downloadJsonBtn" style="padding: 8px 14px; background: #2ea043; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">📥 Export JSON</button>
                        <button id="downloadCsvBtn" style="padding: 8px 14px; background: #30363d; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;">📊 Export CSV</button>
                    </div>

                    <h4 style="margin-top: 15px;">Detected Issues (${data.issues.length}):</h4>
                    ${issuesHtml}
                </div>
            `;

            // Attach download handlers dynamically after rendering
            document.getElementById('downloadJsonBtn').addEventListener('click', () => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `qa-report-${encodeURIComponent(data.url)}.json`;
                link.click();
            });

            document.getElementById('downloadCsvBtn').addEventListener('click', () => {
                let csvContent = "data:text/csv;charset=utf-8,Type,Severity,Message,Fix\n";
                data.issues.forEach(i => {
                    csvContent += `"${i.type}","${i.severity}","${i.message.replace(/"/g, '""')}","${i.fix.replace(/"/g, '""')}"\n`;
                });
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement('a');
                link.href = encodedUri;
                link.download = `qa-report-${encodeURIComponent(data.url)}.csv`;
                link.click();
            });

        } else {
            outputDiv.innerHTML = `<p style="color: red;">Error: ${data.error}</p>`;
        }
    } catch (err) {
        loadingDiv.classList.add('hidden');
        resultsDiv.classList.add('hidden');
        outputDiv.innerHTML = `<p style="color: red;">Failed to connect to the server.</p>`;
    }
});