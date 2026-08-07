// ==UserScript==
// @name         Kraken → Field Appointment
// @namespace    https://github.com/pd-octo/tampermoney
// @version      1.0.0
// @description  Open Field and pre-populate appointment details
// @match        https://kraken.octopus.energy/*
// @match        https://field.oes-prod.energy/*
// @grant        GM_setValue
// @grant        GM_getValue
// @downloadURL  https://raw.githubusercontent.com/pd-octo/tampermoney/main/kraken-field-button.user.js
// @updateURL    https://raw.githubusercontent.com/pd-octo/tampermoney/main/kraken-field-button.user.js
// ==/UserScript==

(async function () {
    'use strict';

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
                    resolve(el);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            setTimeout(() => {
                observer.disconnect();
                reject(`Timed out waiting for ${selector}`);
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

    async function runKraken() {

        function addButton() {

            if (document.getElementById("field-launch-button")) return;

            const houseMove = [...document.querySelectorAll("button")]
                .find(btn => btn.textContent.includes("House move"));

            if (!houseMove) return;

            const onclick = houseMove.getAttribute("onclick");
            if (!onclick) return;

            const match = onclick.match(/accounts\/([^/]+)\/properties\/(\d+)/);

            if (!match) return;

            const account = match[1];
            const property = match[2];

            const btn = document.createElement("button");
            btn.id = "field-launch-button";
            btn.type = "button";
            btn.className = houseMove.className;
            btn.style.marginLeft = "8px";
            btn.textContent = "Kraken Field";

            btn.onclick = async () => {

                await GM_setValue("fieldAccount", account);
                await GM_setValue("fieldProperty", property);

                window.open(
                    "https://field.oes-prod.energy/scheduling",
                    "_blank"
                );

            };

            houseMove.insertAdjacentElement("afterend", btn);

            console.log("Field button added.");
        }

        new MutationObserver(addButton).observe(document.body, {
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

        if (!account || !property)
            return;

        console.log("Found data:", account, property);

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

            console.log("Appointment populated.");

            accountInput.blur();
            propertyInput.blur();

        } catch (err) {
            console.error(err);
        }

    }

    ////////////////////////////////////////////////////////////

    if (location.hostname === "kraken.octopus.energy") {
        runKraken();
    }

    if (location.hostname === "field.oes-prod.energy") {
        runField();
    }

})();
