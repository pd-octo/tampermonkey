// ==UserScript==
// @name         Kraken Enrol Helper - Set SSD & Reg Type (Top Button)
// @namespace    https://github.com/pd-octo/tampermoney
// @version      1.1.0
// @description  Sets Supply start date to Earliest SSD, selects New Connection reg type, clicks Enrol.
// @match        https://kraken.octopus.energy/electricity/journeys/meter-point/*/enrol/
// @match        https://kraken.octopus.energy/electricity/journeys/meter-point/*/enrol
// @run-at       document-idle
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/pd-octo/tampermoney/main/connections-enrol-helper.user.js
// @updateURL    https://raw.githubusercontent.com/pd-octo/tampermoney/main/connections-enrol-helper.user.js
// ==/UserScript==

(function () {
    'use strict';

    function getFieldByLabel(labelText) {
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
            if (label.textContent.trim().startsWith(labelText)) {
                const forId = label.getAttribute('for');
                if (forId) {
                    const el = document.getElementById(forId);
                    if (el) return el;
                }
                let sib = label.nextElementSibling;
                while (sib) {
                    if (['INPUT', 'SELECT', 'DIV'].includes(sib.tagName)) {
                        if (sib.tagName === 'DIV') {
                            const inner = sib.querySelector('input, select');
                            if (inner) return inner;
                        } else return sib;
                    }
                    sib = sib.nextElementSibling;
                }
            }
        }
        return null;
    }

    function getEarliestSSDDate() {
        const all = Array.from(document.querySelectorAll('body *'));
        for (const el of all) {
            const text = el.textContent.trim();
            if (text.includes('Earliest SSD:')) {
                const rest = text.split('Earliest SSD:')[1].trim();
                const date = new Date(rest);
                if (!isNaN(date.getTime())) {
                    const yyyy = date.getFullYear();
                    const mm = String(date.getMonth() + 1).padStart(2, '0');
                    const dd = String(date.getDate()).padStart(2, '0');
                    return `${yyyy}-${mm}-${dd}`;
                }
            }
        }
        return null;
    }

    function setRegistrationType(valueToSelect) {
        const select = getFieldByLabel('Registration type');
        if (!select || select.tagName !== 'SELECT') return false;
        const options = Array.from(select.options);
        const match = options.find(o => o.textContent.trim() === valueToSelect);
        if (match) {
            select.value = match.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        const loose = options.find(o =>
            o.textContent.toLowerCase().includes('new connection') &&
            o.textContent.toLowerCase().includes('domestic') &&
            o.textContent.toLowerCase().includes('import')
        );
        if (loose) {
            select.value = loose.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        return false;
    }

    function clickEnrolButton() {
        const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
        const enrol = buttons.find(b => (b.textContent || b.value || '').trim().toLowerCase() === 'enrol');
        if (enrol) {
            enrol.click();
            return true;
        }
        return false;
    }

    function performAction() {
        const ssd = getEarliestSSDDate();
        if (!ssd) {
            alert('Could not find "Earliest SSD" on the page.');
            return;
        }
        const supplyInput = getFieldByLabel('Supply start date');
        if (!supplyInput) {
            alert('Could not find "Supply start date" field.');
            return;
        }
        supplyInput.value = ssd;
        supplyInput.dispatchEvent(new Event('input', { bubbles: true }));
        supplyInput.dispatchEvent(new Event('change', { bubbles: true }));

        const regSet = setRegistrationType('New Connection: Domestic - Import');
        if (!regSet) {
            alert('Could not set Registration type to "New Connection: Domestic - Import".');
            return;
        }

        const clicked = clickEnrolButton();
        if (!clicked) {
            alert('Filled fields, but could not find the Enrol button to click.');
        }
    }

    function addHelperButton() {
        if (document.getElementById('enrol-helper-button')) return;
        const btn = document.createElement('button');
        btn.id = 'enrol-helper-button';
        btn.textContent = 'Auto-fill SSD & Enrol';
        Object.assign(btn.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '99999',
            padding: '10px 14px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            background: '#9325ff',
            color: '#ffffff',
            fontWeight: '600',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
        });
        btn.onclick = performAction;
        document.body.appendChild(btn);
    }

    function init() {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            addHelperButton();
        } else {
            window.addEventListener('DOMContentLoaded', addHelperButton);
        }
    }

    init();
})();
