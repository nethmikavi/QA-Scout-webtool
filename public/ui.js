/* Visual enhancements only. Everything is wrapped in try/catch so a failure here can never break the app. */
(function () {
    'use strict';

    /* ---- 1. Highlight the active nav tab (follows whichever view panel is visible) ---- */
    function syncActiveTab() {
        try {
            const panels = document.querySelectorAll('.view-panel');
            let activeId = 'audit-view';
            panels.forEach(p => { if (!p.classList.contains('hidden')) activeId = p.id; });
            document.querySelectorAll('.nav-links .nav-tab').forEach(t => {
                t.classList.toggle('is-active', t.getAttribute('data-target') === activeId);
            });
        } catch (e) { /* ignore */ }
    }

    /* ---- 2. Animated score ring + verdict in scan results ---- */
    function verdictFor(score) {
        if (score >= 90) return ['Excellent 🎉', 'Your site is in great shape. Only minor polish left.'];
        if (score >= 80) return ['Good 👍', 'Solid result. A few quick fixes will push it higher.'];
        if (score >= 50) return ['Needs work ⚠️', 'Several issues found. Start with the highest severity ones below.'];
        return ['Critical 🚨', 'Many serious problems detected. Fix these before going live.'];
    }

    function colorFor(score) {
        return typeof scoreColor === 'function' ? scoreColor(score) : (score >= 80 ? '#3fb950' : score >= 50 ? '#eab308' : '#f85149');
    }

    function enhanceResult() {
        try {
            const card = document.querySelector('#output .result-card');
            if (!card || card.querySelector('.score-hero')) return;
            const match = card.textContent.match(/Overall QA Score:\s*(\d{1,3})\s*\/\s*100/);
            if (!match) return;
            const score = Math.max(0, Math.min(100, parseInt(match[1], 10)));
            const color = colorFor(score);
            const r = 56, c = 2 * Math.PI * r;
            const [title, text] = verdictFor(score);

            const hero = document.createElement('div');
            hero.className = 'score-hero';
            hero.innerHTML = `
                <div class="score-ring" role="img" aria-label="Overall score ${score} out of 100">
                    <svg viewBox="0 0 132 132">
                        <circle class="track" cx="66" cy="66" r="${r}" fill="none" stroke-width="11"></circle>
                        <circle class="meter" cx="66" cy="66" r="${r}" fill="none" stroke-width="11"
                            stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c}"></circle>
                    </svg>
                    <div class="num"><b>${score}</b><span>/ 100</span></div>
                </div>
                <div class="verdict"><h4>${title}</h4><p>${text}</p></div>`;

            const heading = card.querySelector('h3');
            if (heading && heading.nextSibling) heading.parentNode.insertBefore(hero, heading.nextSibling);
            else card.insertBefore(hero, card.firstChild);

            // animate after paint
            requestAnimationFrame(() => requestAnimationFrame(() => {
                const meter = hero.querySelector('.meter');
                if (meter) meter.style.strokeDashoffset = String(c * (1 - score / 100));
            }));
        } catch (e) { /* ignore */ }
    }

    function init() {
        try {
            syncActiveTab();
            document.querySelectorAll('.view-panel').forEach(p => {
                new MutationObserver(syncActiveTab).observe(p, { attributes: true, attributeFilter: ['class'] });
            });
            const out = document.getElementById('output');
            if (out) new MutationObserver(enhanceResult).observe(out, { childList: true });
        } catch (e) { /* ignore */ }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
