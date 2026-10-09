
// ==UserScript==
// @name         Kraken → Field Appointment
// @namespace    https://github.com/pd-octo/tampermonkey
// @version      2.1.2
// @description  Open Field and pre-populate appointment details
// @match        https://kraken.octopus.energy/*
// @match        https://support.oegb-kraken.energy/*
// @match        https://field.oes-prod.energy/*
// @match        https://pd-octo.github.io/tampermonkey/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/pd-octo/tampermonkey/main/kraken-field-button.user.js
// @updateURL    https://raw.githubusercontent.com/pd-octo/tampermonkey/main/kraken-field-button.user.js
// ==/UserScript==

(async function () {
    'use strict';

    if (
        location.hostname === "pd-octo.github.io" &&
        location.pathname.startsWith("/tampermonkey")
    ) {
        try {
            localStorage.setItem(
                "tm-installed:kraken-field-button.user.js",
                "1"
            );
        } catch (e) {}
        return;
    }

    ////////////////////////////////////////////////////////////
    // Utility
    ////////////////////////////////////////////////////////////

    function waitFor(selector, timeout = 30000) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(selector);
            if (existing) return resolve(existing);

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);

                if (el) {
                    observer.disconnect();
                    clearTimeout(timer);
                    resolve(el);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            const timer = setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Timed out waiting for ${selector}`));
            }, timeout);
        });
    }

    function setReactInput(input, value) {
        const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "value"
        ).set;

        setter.call(input, value);

        input.dispatchEvent(new Event("input", {
            bubbles: true
        }));

        input.dispatchEvent(new Event("change", {
            bubbles: true
        }));
    }

    ////////////////////////////////////////////////////////////
    // Kraken
    ////////////////////////////////////////////////////////////

    function runKraken() {
        console.log(
            "[Kraken Field] Running on:",
            location.hostname
        );

        function addButton() {
            const existingButton = document.getElementById(
                "field-launch-button"
            );

            if (existingButton) return;

            const houseMove = [...document.querySelectorAll("button")]
                .find(btn =>
                    btn.textContent?.includes("House move")
                );

            if (!houseMove) return;

            let account = null;
            let property = null;

            // Original Kraken method
            const onclick = houseMove.getAttribute("onclick");

            if (onclick) {
                const match = onclick.match(
                    /accounts\/([^/]+)\/properties\/(\d+)/
                );

                if (match) {
                    account = match[1];
                    property = match[2];
                }
            }

            // Fallback: check button links
            if (!account || !property) {
                const href =
                    houseMove.getAttribute("href") ||
                    houseMove.closest("a")?.getAttribute("href");

                if (href) {
                    const match = href.match(
                        /accounts\/([^/]+)\/properties\/(\d+)/
                    );

                    if (match) {
                        account = match[1];
                        property = match[2];
                    }
                }
            }

            if (!account || !property) {
                console.warn(
                    "[Kraken Field] House move found, but IDs could not be extracted."
                );
                return;
            }

            const btn = document.createElement("button");

            btn.id = "field-launch-button";
            btn.type = "button";
            btn.className = houseMove.className;
            btn.style.marginLeft = "8px";
            btn.textContent = "Kraken Field";

            btn.onclick = async () => {
                // Open synchronously to avoid popup blockers
                const fieldWindow = window.open(
                    "about:blank",
                    "_blank"
                );

                try {
                    await GM_setValue("fieldAccount", account);
                    await GM_setValue("fieldProperty", property);

                    if (fieldWindow) {
                        fieldWindow.location.href =
                            "https://field.oes-prod.energy/scheduling";
                    } else {
                        console.warn(
                            "[Kraken Field] Popup blocked."
                        );
                    }
                } catch (err) {
                    console.error(
                        "[Kraken Field] Failed to save details:",
                        err
                    );
                    if (fieldWindow) fieldWindow.close();
                }
            };

            houseMove.insertAdjacentElement("afterend", btn);

            console.log(
                "[Kraken Field] Button added:",
                account,
                property
            );
        }

        const observer = new MutationObserver(addButton);

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        addButton();
    }

    ////////////////////////////////////////////////////////////
    // Field
    ////////////////////////////////////////////////////////////

    async function runField() {
        const account = await GM_getValue("fieldAccount");
        const property = await GM_getValue("fieldProperty");

        if (!account || !property) return;

        console.log(
            "[Kraken Field] Found data:",
            account,
            property
        );

        try {
            const createButton = await waitFor(
                '[data-testid="create-appointment-button"]'
            );

            createButton.click();

            await waitFor(
                '[data-testid="create_appointment_modal"]'
            );

            const accountInput = await waitFor(
                'input[data-testid="account-id"]'
            );

            const propertyInput = await waitFor(
                'input[data-testid="property-id"]'
            );

            setReactInput(accountInput, account);
            setReactInput(propertyInput, property);

            accountInput.blur();
            propertyInput.blur();

            console.log(
                "[Kraken Field] Appointment populated."
            );

        } catch (err) {
            console.error("[Kraken Field]", err);
        }
    }

    ////////////////////////////////////////////////////////////
    // Domain routing
    ////////////////////////////////////////////////////////////

    const krakenDomains = [
        "kraken.octopus.energy",
        "support.oegb-kraken.energy"
    ];

    if (krakenDomains.includes(location.hostname)) {
        runKraken();
    }

    if (location.hostname === "field.oes-prod.energy") {
        runField();
    }

})();
