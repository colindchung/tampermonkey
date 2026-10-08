// ==UserScript==
// @name         GitHub PR Triage
// @namespace    https://github.com/colindchung/tampermonkey
// @version      1.0.0
// @description  Highlight Dependabot PRs and summarize visible PR metadata.
// @match        https://github.com/*/*/pulls*
// @grant        none
// ==/UserScript==

(() => {
    'use strict';
    const panel = document.createElement('details');
    panel.id = 'tm-pr-triage';
    panel.style.cssText = 'margin:16px 0;padding:12px;border:1px solid #8b949e;border-radius:6px;background:var(--bgColor-default,#fff);color:var(--fgColor-default,#1f2328)';
    const summary = document.createElement('summary');
    summary.textContent = 'PR triage — visible results';
    panel.append(summary);
    const body = document.createElement('div');
    panel.append(body);

    function refresh() {
        const rows = [...document.querySelectorAll('[id^="issue_"]')].filter(row =>
            row.querySelector('a[href*="/pull/"]'));
        if (!rows.length) { panel.remove(); return; }
        const host = document.querySelector('[aria-label="Issues"]') || rows[0].parentElement;
        if (!panel.isConnected) host.before(panel);
        const table = document.createElement('table');
        table.style.cssText = 'width:100%;margin-top:12px;text-align:left';
        const head = table.createTHead().insertRow();
        for (const label of ['PR', 'Author', 'Checks / conflicts', 'Opened']) {
            const th = document.createElement('th');
            th.textContent = label;
            head.append(th);
        }
        const tbody = table.createTBody();
        for (const row of rows) {
            const title = row.querySelector('a[id^="issue_"][href*="/pull/"]') || row.querySelector('a[href*="/pull/"]');
            const author = row.querySelector('.opened-by a') || row.querySelector('a[data-hovercard-type="user"]');
            const bot = /dependabot/i.test(author?.textContent || row.textContent);
            row.style.boxShadow = bot ? 'inset 4px 0 #bf8700' : '';
            const tr = tbody.insertRow();
            const link = document.createElement('a');
            link.href = title.href;
            link.textContent = `${bot ? '🤖 ' : ''}${title.textContent.trim()}`;
            tr.insertCell().append(link);
            tr.insertCell().textContent = author?.textContent.trim() || 'Unknown';
            const metadata = [...row.querySelectorAll('[aria-label], [title]')]
                .flatMap(el => [el.getAttribute('aria-label'), el.getAttribute('title')])
                .filter(value => value && /check|status|conflict|mergeable|failing|passed|pending/i.test(value));
            tr.insertCell().textContent = [...new Set(metadata)].join('; ') || 'Not shown — open PR';
            const time = row.querySelector('relative-time');
            const cell = tr.insertCell();
            cell.textContent = time?.textContent.trim() || 'Unknown';
            cell.title = time?.getAttribute('datetime') || '';
        }
        body.replaceChildren(table);
    }
    let pending = false;
    new MutationObserver(records => {
        if (records.every(record => panel.contains(record.target)) || pending) return;
        pending = true;
        setTimeout(() => { pending = false; refresh(); }, 200);
    }).observe(document.body, { childList: true, subtree: true });
    refresh();
})();
