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
 });
});

window.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash || '#audit';
    const matchingTab = Array.from(navTabs).find(t => t.getAttribute('href') === hash);
    if (matchingTab) {
        switchView(matchingTab.getAttribute('data-target'));
    }
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
        resultsDiv.classList.remove('hidden');
        outputDiv.innerHTML = `<p style="color: red;">Failed to connect to the server.</p>`;
    }
});