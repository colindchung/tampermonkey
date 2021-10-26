// ==UserScript==
// @name         Test Userscript
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Test alert on tampermokey repo
// @author       You
// @match        https://github.com/colindchung/tampermonkey
// @icon         https://www.google.com/s2/favicons?domain=github.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    alert('Testing Tampermonkey alerts');
})();