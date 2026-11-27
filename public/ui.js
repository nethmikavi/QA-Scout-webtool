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
        if (score >= 90) return ['Excellent', 'check-circle',  'Your site is in great shape. Only minor polish left.'];
        if (score >= 80) return ['Good', 'thumbs-up',  'Solid result. A few quick fixes will push it higher.'];
        if (score >= 50) return ['Needs work', 'alert-triangle',  'Several issues found. Start with the highest severity ones below.'];
        return ['Critical', 'octagon-alert',  'Many serious problems detected. Fix these before going live.'];
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
            const [title, vIcon, text] = verdictFor(score);

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
                <div class="verdict"><h4 style="color:${color}">${qaIcon(vIcon)} ${title}</h4><p>${text}</p></div>`;

            const heading = card.querySelector('h3');
            if (heading && heading.nextSibling) heading.parentNode.insertBefore(hero, heading.nextSibling);
            else card.insertBefore(hero, card.firstChild);

            // count the number up in step with the ring
            const numEl = hero.querySelector('.num b');
            if (numEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                const t0 = performance.now(), dur = 1200;
                numEl.textContent = '0';
                const tick = now => {
                    const k = Math.min(1, (now - t0) / dur);
                    numEl.textContent = String(Math.round(score * (1 - Math.pow(1 - k, 3))));
                    if (k < 1) requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            }
            // stagger issue cards
            card.querySelectorAll('.issue-card').forEach((el, i) => { el.style.animationDelay = Math.min(i, 12) * 60 + 'ms'; });

            // animate after paint
            requestAnimationFrame(() => requestAnimationFrame(() => {
                const meter = hero.querySelector('.meter');
                if (meter) meter.style.strokeDashoffset = String(c * (1 - score / 100));
            }));
        } catch (e) { /* ignore */ }
    }

    /* ---- 3. Scroll-reveal (adds .in when an element enters the viewport) ---- */
    function initReveal() {
        try {
            const items = document.querySelectorAll('.reveal, .steps');
            // stagger siblings so grids and lists cascade in
            document.querySelectorAll('.check-grid, .tip-grid, .steps, .faq-list').forEach(group => {
                Array.from(group.children).forEach((el, i) => el.style.setProperty('--d', (i * 0.08) + 's'));
            });
            if (!('IntersectionObserver' in window)) { items.forEach(el => el.classList.add('in')); return; }
            const io = new IntersectionObserver((entries) => {
                entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
            }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
            items.forEach(el => io.observe(el));
        } catch (e) { document.querySelectorAll('.reveal, .steps').forEach(el => el.classList.add('in')); }
    }

    /* ---- 4. FAQ accordion (one open at a time, keyboard + screen-reader friendly) ---- */
    function initFaq() {
        try {
            const items = document.querySelectorAll('.faq-item');
            items.forEach((item, i) => {
                const btn = item.querySelector('.faq-q');
                const panel = item.querySelector('.faq-a');
                if (!btn || !panel) return;
                btn.id = 'faq-q' + i; panel.id = 'faq-a' + i;
                btn.setAttribute('aria-controls', panel.id);
                panel.setAttribute('role', 'region'); panel.setAttribute('aria-labelledby', btn.id);
                btn.addEventListener('click', () => {
                    const willOpen = !item.classList.contains('open');
                    items.forEach(o => { o.classList.remove('open'); o.querySelector('.faq-q').setAttribute('aria-expanded', 'false'); });
                    if (willOpen) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
                });
            });
            const first = items[0];
            if (first) { first.classList.add('open'); first.querySelector('.faq-q').setAttribute('aria-expanded', 'true'); }
        } catch (e) { /* ignore */ }
    }

    /* ---- 5. Mobile menu toggle ---- */
    function initMenu() {
        try {
            const bar = document.querySelector('.navbar');
            const btn = document.getElementById('navToggle');
            if (!bar || !btn) return;
            const set = open => { bar.classList.toggle('menu-open', open); btn.setAttribute('aria-expanded', String(open)); };
            btn.addEventListener('click', () => set(!bar.classList.contains('menu-open')));
            bar.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => set(false)));
            document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
            document.addEventListener('click', e => { if (!bar.contains(e.target)) set(false); });
            window.addEventListener('resize', () => { if (window.innerWidth > 1000) set(false); });
        } catch (e) { /* ignore */ }
    }

    /* ---- 6. Scan waiting experience (estimated progress, steps, tips, cancel) ---- */
    function initScanLoader() {
        try {
            const box = document.getElementById('loading');
            if (!box) return;
            const fill = document.getElementById('scanFill'), pct = document.getElementById('scanPct');
            const status = document.getElementById('scanStatus'), time = document.getElementById('scanTime');
            const tipEl = document.getElementById('scanTip'), hostEl = document.getElementById('scanHost');
            const mockUrl = document.getElementById('mockUrl');
            const steps = Array.from(document.querySelectorAll('#scanSteps li'));
            const scanBtn = document.getElementById('scanBtn');
            const cancel = document.getElementById('cancelScanBtn');
            const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            // step end-points (% of estimated progress) and what we tell the user
            const ends = [8, 26, 42, 58, 72, 84, 94];
            const msgs = ['Downloading the page...', 'Testing the links on the page...', 'Checking security headers...',
                'Reading titles, meta tags and headings...', 'Looking for missing alt text and labels...',
                'Measuring load time and page weight...', 'Calculating your score and writing fixes...'];
            const tips = [
                'Tip: fix Critical issues first. They cost the most points.',
                'Tip: each scan checks one page and its first 15 links.',
                'Tip: every scan is saved in Scan History in your browser.',
                'Tip: export the report as PDF to share it with your team.',
                'Tip: use AI fix on any issue for a suggested solution.',
                'Tip: scan again after your changes and compare the scores.'
            ];

            let timer = null, tipTimer = null, t0 = 0, tipIdx = 0, btnHtml = null, active = false;

            const paint = (p, sec) => {
                const v = Math.max(0, Math.min(100, p));
                fill.style.width = v.toFixed(1) + '%';
                pct.textContent = Math.round(v) + '%';
                time.textContent = Math.floor(sec) + 's';
                let cur = ends.findIndex(e => v < e); if (cur === -1) cur = ends.length - 1;
                steps.forEach((li, i) => { li.className = i < cur ? 'done' : (i === cur ? 'active' : ''); });
                let msg = msgs[cur];
                if (sec > 28) msg = 'Still working. Slow or very large pages can take up to 30 seconds...';
                else if (sec > 14) msg = 'This page is taking a little longer. Hang tight...';
                if (status.textContent !== msg) status.textContent = msg;
            };

            const showTip = () => {
                tipEl.classList.add('swap');
                setTimeout(() => { tipEl.textContent = tips[tipIdx++ % tips.length]; tipEl.classList.remove('swap'); }, reduce ? 0 : 250);
            };

            const start = () => {
                if (active) return; active = true;
                let h = (document.getElementById('urlInput').value || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
                hostEl.textContent = h || 'your site'; mockUrl.textContent = h || 'your-site.com';
                t0 = performance.now(); tipIdx = Math.floor(Math.random() * tips.length);
                tipEl.textContent = tips[tipIdx++ % tips.length];
                paint(0, 0);
                timer = setInterval(() => {
                    const sec = (performance.now() - t0) / 1000;
                    paint(94 * (1 - Math.exp(-sec / 10)), sec);   // eases toward 94% and waits for the real result
                }, 200);
                tipTimer = setInterval(showTip, 4500);
                if (scanBtn) { btnHtml = scanBtn.innerHTML; scanBtn.innerHTML = qaIcon('loader', 'spin') + ' Scanning...'; }
                if (window.innerWidth < 900) setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
            };

            const stop = () => {
                if (!active) return; active = false;
                clearInterval(timer); clearInterval(tipTimer);
                if (scanBtn && btnHtml !== null) { scanBtn.innerHTML = btnHtml; btnHtml = null; }
            };

            new MutationObserver(() => { box.classList.contains('hidden') ? stop() : start(); })
                .observe(box, { attributes: true, attributeFilter: ['class'] });
            if (!box.classList.contains('hidden')) start();

            cancel.addEventListener('click', () => {
                cancel.disabled = true; status.textContent = 'Cancelling...';
                if (window.__scanAbort) window.__scanAbort.abort();
                setTimeout(() => { cancel.disabled = false; }, 800);
            });
        } catch (e) { /* the scan still works without the animation */ }
    }

    function init() {
        try {
            initScanLoader();
            initMenu();
            initReveal();
            initFaq();
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
