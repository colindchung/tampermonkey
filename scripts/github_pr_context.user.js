// ==UserScript==
// @name         GitHub PR Context Copier
// @namespace    https://github.com/colindchung/tampermonkey
// @version      1.0.0
// @description  Copy PR title, URL, description, and visible checks as Markdown.
// @match        https://github.com/*/*/pull/*
// @grant        none
// ==/UserScript==

(() => {
    'use strict';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Copy PR context';
    button.className = 'btn btn-sm';
    button.style.marginLeft = '8px';
    const status = document.createElement('span');
    status.setAttribute('role', 'status');
    status.style.marginLeft = '8px';

    function mount() {
        const title = document.querySelector('.gh-header-title');
        if (!/^\/[^/]+\/[^/]+\/pull\/\d+(?:\/|$)/.test(location.pathname) || !title) {
            button.remove(); status.remove(); return;
        }
        if (!button.isConnected) title.after(button, status);
    }

    button.addEventListener('click', async () => {
        const title = document.querySelector('.gh-header-title .js-issue-title, .gh-header-title bdi');
        const number = location.pathname.match(/\/pull\/(\d+)/)?.[1];
        const url = `${location.origin}${location.pathname.match(/^\/[^/]+\/[^/]+\/pull\/\d+/)?.[0] || location.pathname}`;
        // Only the first timeline comment is the PR description; never include replies.
        const description = document.querySelector('.js-discussion .timeline-comment .comment-body, .js-discussion .js-comment-body');
        const checksRoot = document.querySelector('.merge-status-list, .merge-pr, [data-testid="mergebox"]');
        const checks = checksRoot?.innerText.trim();
        const text = [
            `# ${title?.textContent.trim() || document.title} (#${number || '?'})`,
            '', url, '', '## Description', '',
            description?.innerText.trim() || 'Description is not loaded on this tab. Open the Conversation tab and try again.',
            '', '## Checks and merge status (visible on page)', '',
            checks || 'Check summary is not loaded on this page. Open the Conversation tab and expand checks if needed.'
        ].join('\n');
        try {
            await navigator.clipboard.writeText(text);
            status.textContent = 'Copied';
        } catch {
            status.textContent = 'Clipboard access failed. Select and copy the text below.';
            let fallback = document.getElementById('tm-pr-context-fallback');
            if (!fallback) {
                fallback = document.createElement('textarea');
                fallback.id = 'tm-pr-context-fallback';
                fallback.setAttribute('aria-label', 'PR context to copy');
                fallback.style.cssText = 'display:block;width:100%;min-height:240px;margin-top:12px';
                status.after(fallback);
            }
            fallback.value = text;
            fallback.focus();
            fallback.select();
        }
    });
    new MutationObserver(mount).observe(document.body, { childList: true, subtree: true });
    mount();
})();
