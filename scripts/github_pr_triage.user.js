// ==UserScript==
// @name         GitHub PR Triage
// @namespace    https://github.com/colindchung/tampermonkey
// @version      1.2.1
// @description  Highlight Dependabot PRs and summarize visible PR metadata.
// @match        https://github.com/*
// @grant        none
// ==/UserScript==

(() => {
    'use strict';
    const panel = document.createElement('details');
    panel.id = 'tm-pr-triage';
    panel.open = true;
    panel.style.cssText = 'margin:16px 0;padding:12px;border:1px solid #8b949e;border-radius:6px;background:var(--bgColor-default,#fff);color:var(--fgColor-default,#1f2328)';
    const summary = document.createElement('summary');
    summary.textContent = 'PR triage — visible results';
    panel.append(summary);
    const body = document.createElement('div');
    panel.append(body);

    function parseUpdate(text) {
        const bump = text.match(/^Bump (.+?) from (\S+) to (\S+)(?: in (.+))?$/i);
        const requirement = text.match(/^Update (.+?) requirement from (.+?) to (.+?)(?: in (.+))?$/i);
        const match = bump || requirement;
        return match ? { dependency: match[1], from: match[2], to: match[3], service: match[4] || 'Repository root' } : null;
    }

    function refresh() {
        if (!/^\/[^/]+\/[^/]+\/pulls(?:\/|$)/.test(location.pathname)) {
            panel.remove(); return;
        }
        // GitHub's React list no longer consistently uses issue_<number> IDs.
        const entries = new Map();
        for (const link of document.querySelectorAll('main a[href]')) {
            if (panel.contains(link)) continue;
            const url = new URL(link.href, location.origin);
            if (url.origin !== location.origin || !/^\/[^/]+\/[^/]+\/pull\/\d+$/.test(url.pathname)
                || !link.textContent.trim() || /^#?\d+$/.test(link.textContent.trim())) continue;
            let row = link.closest('[id^="issue_"], .js-issue-row, [data-testid="issue-row"], [role="listitem"], li');
            // Find the smallest wrapper containing both the title and author/time.
            if (!row) {
                for (let ancestor = link.parentElement; ancestor && ancestor.tagName !== 'MAIN'; ancestor = ancestor.parentElement) {
                    if (ancestor.querySelector('relative-time, time, a[href*="/apps/dependabot"], a[data-hovercard-type="user"]')) {
                        row = ancestor; break;
                    }
                }
            }
            if (row && !entries.has(url.pathname)) entries.set(url.pathname, { row, title: link });
        }
        const rows = [...entries.values()];
        if (!rows.length) { panel.remove(); return; }
        const host = rows[0].row.parentElement;
        if (!panel.isConnected || panel.parentElement !== host.parentElement) host.before(panel);
        const groups = new Map();
        for (const entry of rows) {
            const { row, title } = entry;
            const author = row.querySelector('a[href*="/apps/dependabot"]') || row.querySelector('a[aria-label^="Filter by author"]') || row.querySelector('.opened-by a') || row.querySelector('a[data-hovercard-type="user"]');
            const bot = /dependabot/i.test(author?.textContent || row.textContent);
            row.style.boxShadow = bot ? 'inset 4px 0 #bf8700' : '';
            const update = bot ? parseUpdate(title.textContent.trim()) : null;
            const key = update?.dependency || 'Other PRs / unparsed updates';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ ...entry, author, bot, update });
        }
        summary.textContent = `PR triage — ${rows.length} visible PRs, grouped by dependency`;
        const sections = [];
        const note = document.createElement('p');
        note.textContent = 'Current page only. Different targets may be intentional (for example, separate major-version tracks). Grouped or unrecognized update titles appear under Other PRs.';
        sections.push(note);
        for (const [dependency, entries] of [...groups].sort(([a], [b]) => {
            if (a === 'Other PRs / unparsed updates') return 1;
            if (b === 'Other PRs / unparsed updates') return -1;
            return a.localeCompare(b);
        })) {
            const section = document.createElement('section');
            const heading = document.createElement('h3');
            const targets = [...new Set(entries.map(entry => entry.update?.to).filter(Boolean))];
            heading.textContent = `${dependency} (${entries.length})${targets.length > 1 ? ` — Different targets: ${targets.join(', ')}` : ''}`;
            if (targets.length > 1) heading.style.color = 'var(--fgColor-attention,#bf8700)';
            section.append(heading);
            const table = document.createElement('table');
            table.style.cssText = 'width:100%;margin:12px 0;text-align:left';
            const head = table.createTHead().insertRow();
            for (const label of ['Service', 'Version change', 'PR', 'Checks / conflicts', 'Opened']) {
                const th = document.createElement('th');
                th.textContent = label;
                head.append(th);
            }
            const tbody = table.createTBody();
            for (const { row, title, update, bot } of entries) {
            const tr = tbody.insertRow();
            tr.insertCell().textContent = update?.service || 'See PR title';
            tr.insertCell().textContent = update ? `${update.from} → ${update.to}` : 'Not parsed';
            const link = document.createElement('a');
            link.href = title.href;
            link.textContent = `${bot ? '🤖 ' : ''}${title.textContent.trim()}`;
            tr.insertCell().append(link);
            const metadata = [...row.querySelectorAll('[aria-label], [title]')]
                .flatMap(el => [el.getAttribute('aria-label'), el.getAttribute('title')])
                .filter(value => value && /check|status|conflict|mergeable|failing|passed|pending/i.test(value));
            tr.insertCell().textContent = [...new Set(metadata)].join('; ') || 'Not shown — open PR';
            const time = row.querySelector('relative-time, time');
            const cell = tr.insertCell();
            cell.textContent = time?.textContent.trim() || 'Unknown';
            cell.title = time?.getAttribute('datetime') || '';
            }
            section.append(table);
            sections.push(section);
        }
        body.replaceChildren(...sections);
    }
    let pending = false;
    new MutationObserver(records => {
        if (records.every(record => panel.contains(record.target)) || pending) return;
        pending = true;
        setTimeout(() => { pending = false; refresh(); }, 200);
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('turbo:load', refresh);
    document.addEventListener('turbo:render', refresh);
    refresh();
})();
