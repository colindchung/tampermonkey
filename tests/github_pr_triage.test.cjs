const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function setup(pathname, modern) {
    const elements = [];
    const listeners = {};
    class Element {
        constructor(tag = 'DIV') { this.tagName = tag; this.style = {}; this.children = []; this.isConnected = false; this.textContent = ''; elements.push(this); }
        append(...items) { this.children.push(...items); }
        before(item) { item.isConnected = true; }
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
    row.parentElement = new Element('MAIN');
    const heading = new Element('H1');
    const document = {
        body: new Element(), createElement: tag => new Element(tag.toUpperCase()),
        querySelectorAll: () => [link], querySelector: () => heading,
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
