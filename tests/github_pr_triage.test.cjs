const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup(pathname, modern, titles = ['Bump library']) {
    const elements = [];
    const listeners = {};
    class Element {
        constructor(tag = 'DIV') { this.tagName = tag; this.style = {}; this.children = []; this.isConnected = false; this.textContent = ''; elements.push(this); }
        append(...items) { this.children.push(...items); }
        before(item) { item.isConnected = true; item.mountedBefore = this.tagName; }
        remove() { this.isConnected = false; }
        contains(item) { return this === item || this.children.some(child => child.contains?.(item)); }
        replaceChildren(...items) { this.children = items; }
        createTHead() { const child = new Element(); this.append(child); return child; }
        createTBody() { return this.createTHead(); }
        insertRow() { return this.createTHead(); }
        insertCell() { return this.createTHead(); }
        querySelectorAll() { return []; }
    }
    const row = new Element();
    row.textContent = 'Bump library dependabot[bot]';
    const author = { textContent: 'dependabot[bot]' };
    const time = { textContent: 'last month', getAttribute: () => '2026-09-01' };
    row.querySelector = selector => selector.includes('dependabot') ? author : selector.includes('time') ? time : null;
    const link = new Element('A');
    link.href = 'https://github.com/owner/repo/pull/123';
    link.textContent = 'Bump library';
    link.closest = () => modern ? null : row;
    link.parentElement = row;
    row.parentElement = new Element('UL');
    const links = titles.map((text, index) => {
        const item = new Element('A');
        item.href = `https://github.com/owner/repo/pull/${123 + index}`;
        item.textContent = text;
        item.closest = link.closest;
        item.parentElement = row;
        return item;
    });
    const heading = new Element('H1');
    const document = {
        body: new Element(), createElement: tag => new Element(tag.toUpperCase()),
        querySelectorAll: () => links, querySelector: () => heading,
        addEventListener: (name, fn) => { listeners[name] = fn; }
    };
    const location = { origin: 'https://github.com', pathname };
    vm.runInNewContext(fs.readFileSync('scripts/github_pr_triage.user.js', 'utf8'), {
        document, location, URL, MutationObserver: class { observe() {} }, setTimeout
    });
    return { panel: elements.find(el => el.id === 'tm-pr-triage'), row, location, listeners };
}

for (const modern of [false, true]) {
    test(`renders and highlights ${modern ? 'ID-free' : 'legacy'} PR rows`, () => {
        const { panel, row } = setup('/owner/repo/pulls', modern);
        assert.equal(panel.isConnected, true);
        assert.equal(panel.open, true);
        assert.equal(panel.mountedBefore, 'UL');
        assert.equal(row.style.boxShadow, 'inset 4px 0 #bf8700');
        assert.match(JSON.stringify(panel.children), /Bump library/);
    });
}
test('mounts after GitHub navigation and removes outside PR list', () => {
    const { panel, location, listeners } = setup('/owner/repo', true);
    assert.equal(panel.isConnected, false);
    location.pathname = '/owner/repo/pulls';
    listeners['turbo:load']();
    assert.equal(panel.isConnected, true);
    location.pathname = '/owner/repo/issues';
    listeners['turbo:render']();
    assert.equal(panel.isConnected, false);
});

test('groups services and flags distinct targets without losing unparsed PRs', () => {
    const { panel } = setup('/owner/repo/pulls', false, [
        'Bump hono from 4.12.27 to 4.13.7 in /apps/gql',
        'Bump hono from 4.12.26 to 4.13.8 in /packages/database',
        'Bump @scope/library from 1.0.0 to 1.0.1 in /apps/ai',
        'Bump hono and prisma in /packages/database'
    ]);
    const text = JSON.stringify(panel.children);
    assert.match(text, /hono \(2\) — Different targets: 4.13.7, 4.13.8/);
    assert.match(text, /4.12.27 → 4.13.7/);
    assert.match(text, /\/packages\/database/);
    assert.match(text, /@scope\/library \(1\)/);
    assert.match(text, /Other PRs \/ unparsed updates/);
});
test('matching targets do not flag differing starting versions', () => {
    const { panel } = setup('/owner/repo/pulls', false, [
        'Bump browserslist from 4.28.1 to 4.28.9 in /apps/ai',
        'Bump browserslist from 4.25.1 to 4.28.9 in /apps/gql',
        'Update restrictedpython requirement from >=6.0 to >=8.5 in /apps/code_runner'
    ]);
    const text = JSON.stringify(panel.children);
    assert.match(text, /browserslist \(2\)/);
    assert.doesNotMatch(text, /Different targets:/);
    assert.match(text, />=6.0 → >=8.5/);
});
