// ==UserScript==
// @name         Test Userscript
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Test alert on tampermokey repo
// @author       You
// @match        https://github.com/colindchung/tampermonkey
// @icon         https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Tampermonkey_logo.svg/1200px-Tampermonkey_logo.svg.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    alert("Testing Tampermonkey alerts");
})();