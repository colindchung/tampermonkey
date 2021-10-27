// ==UserScript==
// @name         Triple Click
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Copy meeting passcodes with a triple click
// @author       You
// @match        *://*/*
// @icon         https://icons-for-free.com/iconfiles/png/512/mouse+icon+computer+mouse+line+icon+mouse+mouse+icon+mouse-1320073118605145636.png
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    window.addEventListener('click', function (e) {
        if (e.detail === 3) {

            let text = e.target.innerText;
            if(text){

                // Get last word from element
                // e.g. "Meeting Passcode: a1b2c3!@#" -> we want to extract a1b2c3!@#
                text = text.trim().split(" ").slice(-1);
                navigator.clipboard.writeText(text);

                alert("Copied \"" + text + "\" to the clipboard");
            }
        }
    });

})();