// ==UserScript==
// @name         Kraken - New Shell Account Button
// @namespace    https://github.com/pd-octo/tampermoney
// @version      2.0.0
// @description  Adds a Create New Shell Account button beneath Enrol New Customer in Kraken.
// @match        https://kraken.octopus.energy/app/accounts/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/pd-octo/tampermoney/main/new-shell-account-button.user.js
// @updateURL    https://raw.githubusercontent.com/pd-octo/tampermoney/main/new-shell-account-button.user.js
// ==/UserScript==

(function () {
    'use strict';

    const BUTTON_ID = 'tm-new-shell-account-button';

    const DESTINATION =
        'https://kraken.octopus.energy/app/accounts/new-shell-account/';

    let currentIframe = null;
    let iframeObserver = null;

    function addButton(iframeDocument) {
        if (!iframeDocument?.body) {
            return;
        }

        // Don't add it twice
        if (iframeDocument.getElementById(BUTTON_ID)) {
            return;
        }

        const enrolButton = [...iframeDocument.querySelectorAll('a, button')]
            .find(element =>
                element.textContent
                    ?.trim()
                    .toLowerCase()
                    .includes('enrol new customer')
            );

        if (!enrolButton) {
            return;
        }

        const shellButton = enrolButton.cloneNode(false);

        shellButton.id = BUTTON_ID;
        shellButton.textContent = 'Create New Shell Account';

        // Remove behaviour inherited from the original button
        shellButton.removeAttribute('href');
        shellButton.removeAttribute('onclick');
        shellButton.removeAttribute('data-toggle');
        shellButton.removeAttribute('data-target');

        if (shellButton.tagName.toLowerCase() === 'a') {
            shellButton.href = DESTINATION;
            shellButton.target = '_top';
        } else {
            shellButton.type = 'button';

            shellButton.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();

                window.top.location.href = DESTINATION;
            });
        }

        shellButton.style.display = 'block';
        shellButton.style.width = '100%';
        shellButton.style.marginTop = '12px';

        enrolButton.insertAdjacentElement('afterend', shellButton);

        console.log('[Shell Account Button] Added');
    }

    function watchIframe(iframe) {
        if (!iframe) {
            return;
        }

        // Avoid repeatedly attaching observers to the same iframe
        if (iframe === currentIframe) {
            try {
                addButton(
                    iframe.contentDocument ||
                    iframe.contentWindow.document
                );
            } catch (error) {
                // Ignore until iframe is ready
            }

            return;
        }

        currentIframe = iframe;

        if (iframeObserver) {
            iframeObserver.disconnect();
            iframeObserver = null;
        }

        function initialiseIframe() {
            let iframeDocument;

            try {
                iframeDocument =
                    iframe.contentDocument ||
                    iframe.contentWindow.document;
            } catch (error) {
                console.error(
                    '[Shell Account Button] Could not access iframe:',
                    error
                );
                return;
            }

            if (!iframeDocument?.body) {
                return;
            }

            addButton(iframeDocument);

            // Watch for Kraken dynamically rendering/re-rendering content
            iframeObserver = new MutationObserver(() => {
                addButton(iframeDocument);
            });

            iframeObserver.observe(iframeDocument.body, {
                childList: true,
                subtree: true
            });
        }

        // Handles actual iframe reloads
        iframe.addEventListener('load', initialiseIframe);

        // Handles iframe already being loaded
        initialiseIframe();
    }

    function findIframe() {
        const iframe = document.querySelector('#embedded-kraken');

        if (iframe) {
            watchIframe(iframe);
        }
    }

    // Try immediately
    findIframe();

    // Watch the outer Kraken app because it can replace the iframe
    const pageObserver = new MutationObserver(() => {
        findIframe();
    });

    pageObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Backup check for SPA/navigation weirdness
    setInterval(findIframe, 2000);
})();
