// ==UserScript==
// @name         GitHub PR Triage
// @namespace    https://github.com/colindchung/tampermonkey
// @version      1.3.0
// @description  Highlight Dependabot PRs and summarize visible PR metadata.
// @match        https://github.com/*
// @grant        none
// ==/UserScript==

(() => {
    'use strict';
    const panel = document.createElement('details');
    panel.id = 'tm-pr-triage';
    panel.open = true;
    const style = document.createElement('style');
    style.textContent = `
        #tm-pr-triage { margin:16px 0; border:1px solid var(--borderColor-default,#d1d9e0); border-radius:8px; background:var(--bgColor-default,#fff); color:var(--fgColor-default,#1f2328); font-size:13px; overflow:hidden; }
        #tm-pr-triage > summary { padding:14px 16px; font-size:14px; font-weight:600; background:var(--bgColor-muted,#f6f8fa); }
        #tm-pr-triage summary { cursor:pointer; }
        #tm-pr-triage summary:focus-visible { outline:2px solid var(--focus-outlineColor,#0969da); outline-offset:-2px; }
        #tm-pr-triage p { margin:0; padding:10px 16px; font-size:12px; color:var(--fgColor-muted,#59636e); border-top:1px solid var(--borderColor-muted,#d1d9e0); }
        #tm-pr-triage .tm-group { border-top:1px solid var(--borderColor-muted,#d1d9e0); }
        #tm-pr-triage .tm-group > summary { padding:11px 16px; font-weight:600; font-size:13px; }
        #tm-pr-triage .tm-group > summary:hover { background:var(--bgColor-muted,#f6f8fa); }
        #tm-pr-triage .tm-badge { float:right; border:1px solid var(--borderColor-attention-muted,#d4a72c); border-radius:20px; padding:1px 8px; font-size:11px; font-weight:500; color:var(--fgColor-attention,#9a6700); background:var(--bgColor-attention-muted,#fff8c5); }
        #tm-pr-triage .tm-table-wrap { overflow-x:auto; padding:0 16px 12px; }
        #tm-pr-triage table { width:100%; table-layout:fixed; border-collapse:collapse; font-size:12px; text-align:left; }
        #tm-pr-triage th { color:var(--fgColor-muted,#59636e); font-weight:500; padding:8px; border-bottom:1px solid var(--borderColor-muted,#d1d9e0); }
        #tm-pr-triage td { padding:9px 8px; vertical-align:middle; overflow-wrap:anywhere; }
        #tm-pr-triage tbody tr + tr td { border-top:1px solid var(--borderColor-muted,#d1d9e0); }
        #tm-pr-triage th:nth-child(1) { width:25%; } #tm-pr-triage th:nth-child(2) { width:25%; }
        #tm-pr-triage th:nth-child(3) { width:10%; } #tm-pr-triage th:nth-child(4) { width:25%; }
        #tm-pr-triage td:nth-child(2) { font-family:ui-monospace,SFMono-Regular,monospace; font-variant-numeric:tabular-nums; }
        #tm-pr-triage td:last-child { color:var(--fgColor-muted,#59636e); }
        #tm-pr-triage a { text-decoration:none; } #tm-pr-triage a:hover { text-decoration:underline; }
        @media(max-width:800px) { #tm-pr-triage table { min-width:620px; } }
    `;
    panel.append(style);
    const expanded = new Map();
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
        summary.textContent = `Dependency overview · ${groups.size} groups · ${rows.length} PRs`;
        const sections = [];
        const note = document.createElement('p');
        note.textContent = 'Current page only · Expand a dependency to compare services. Different targets may be intentional.';
        sections.push(note);
        for (const [dependency, entries] of [...groups].sort(([a], [b]) => {
            if (a === 'Other PRs / unparsed updates') return 1;
            if (b === 'Other PRs / unparsed updates') return -1;
            return a.localeCompare(b);
        })) {
            const section = document.createElement('details');
            section.className = 'tm-group';
            const heading = document.createElement('summary');
            const targets = [...new Set(entries.map(entry => entry.update?.to).filter(Boolean))];
            heading.textContent = `${dependency} (${entries.length})${targets.length > 1 ? ` — Different targets: ${targets.join(', ')}` : ''}`;
            heading.textContent = `${dependency} (${entries.length})`;
            if (targets.length > 1) {
                const badge = document.createElement('span');
                badge.className = 'tm-badge';
                badge.textContent = `Different targets: ${targets.join(', ')}`;
                heading.append(badge);
            }
            section.open = expanded.get(dependency) ?? (targets.length > 1);
            section.addEventListener('toggle', () => { if (section.isConnected) expanded.set(dependency, section.open); });
            section.append(heading);
            const table = document.createElement('table');

            const head = table.createTHead().insertRow();
            for (const label of ['Service', 'Version change', 'PR', 'Checks / conflicts', 'Opened']) {
                const th = document.createElement('th');
                th.textContent = label;
                head.append(th);
            }
            const tbody = table.createTBody();
            for (const { row, title, update, bot } of entries) {
            const tr = tbody.insertRow();
            const serviceCell = tr.insertCell();
            serviceCell.textContent = update?.service.replace(/^.*?\/(apps|packages)\//, '') || 'See PR';
            serviceCell.title = update?.service || title.textContent.trim();
            tr.insertCell().textContent = update ? `${update.from} → ${update.to}` : 'Not parsed';
            const link = document.createElement('a');
            link.href = title.href;
            link.textContent = update ? `#${new URL(title.href).pathname.split('/').pop()}` : title.textContent.trim();
            link.title = title.textContent.trim();
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
const wrap = document.createElement('div');
            wrap.className = 'tm-table-wrap';
            wrap.append(table);
            section.append(wrap);
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
