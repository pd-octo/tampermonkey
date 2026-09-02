// ==UserScript==
// @name         Kraken: Shell personal details
// @namespace    https://github.com/pd-octo/tampermoney
// @version      1.1.2
// @description  Paste single-line personal details from clipboard and auto-fill User details fields on Kraken
// @author       Paul Davidson
// @match        https://*.octopus.energy/*
// @match        https://kraken.octopus.energy/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/pd-octo/tampermoney/main/connections-paste-user-details.user.js
// @updateURL    https://raw.githubusercontent.com/pd-octo/tampermoney/main/connections-paste-user-details.user.js
// ==/UserScript==

(function () {
  "use strict";

  const toTitleish = s =>
    s.trim().replace(/\s+/g, " ").replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase());

  const clean = s => toTitleish(s.trim());

  const norm = s =>
    (s || "").toLowerCase().replace(/[*:]/g, "").replace(/\s+/g, " ").trim();

  function findInput(preferredLabels = [], keywords = []) {
    const want = preferredLabels.map(norm);
    const labelEls = Array.from(document.querySelectorAll("label, [aria-label]"));
    const labelMatch = labelEls.find(l => {
      const t = norm(l.textContent || l.getAttribute("aria-label"));
      return want.some(w => t === w || t.startsWith(w));
    });

    if (labelMatch) {
      const forId = labelMatch.getAttribute("for");

      if (forId) {
        const byId = document.getElementById(forId);
        if (byId) return byId;
      }

      const nested = labelMatch.querySelector("input, select");
      if (nested) return nested;

      let sib = labelMatch.nextElementSibling;

      while (sib && sib.querySelector) {
        const inp = sib.querySelector("input, select");
        if (inp) return inp;
        sib = sib.nextElementSibling;
      }
    }

    const allInputs = Array.from(document.querySelectorAll("input, select"));
    const kw = keywords.map(k => k.toLowerCase());

    return allInputs.find(inp => {
      const attr = (
        (inp.name || "") + " " +
        (inp.id || "") + " " +
        (inp.placeholder || "")
      ).toLowerCase();

      return kw.some(k => attr.includes(k));
    }) || null;
  }

  function setVal(el, val) {
    if (!el) return;

    const v = val || "";

    if (el.tagName === "SELECT") {
      const match = Array.from(el.options).find(o =>
        o.value === v ||
        o.textContent.trim() === v ||
        o.textContent.includes(v)
      );

      el.value = match ? match.value : v;
    } else {
      el.value = v;
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function setOpsTeam(statusEl) {
    const sel = document.getElementById("id_operations_team");

    if (!sel) {
      if (statusEl) statusEl.textContent = "OPS: select not found";
      return;
    }

    const win = document.defaultView || window;
    const jq = win.$ || win.jQuery;

    // P value is 165 — hardcoded since Select2 lazy-loads options
    const option = new Option(
      "P (Octopus Energy, Bulb : Domestic)",
      "165",
      true,
      true
    );

    if (jq) {
      jq("#id_operations_team").append(option).trigger("change");
      if (statusEl) statusEl.textContent = "OPS: set to P";
    } else {
      sel.appendChild(option);
      sel.value = "165";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      if (statusEl) statusEl.textContent = "OPS: set to P";
    }
  }

  function parsePersonalDetails(raw) {
    if (!raw) return null;

    const parts = raw
      .split(/\t+|\s{2,}/)
      .map(p => p.trim())
      .filter(Boolean);

    if (parts.length < 4) return null;

    const fullName = parts[0];
    const email = parts[1];
    const mobile = parts[2];
    const dob = parts[3];

    if (!email.includes("@")) return null;
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) return null;

    const nameWords = fullName.split(/\s+/);
    if (nameWords.length < 2) return null;

    return {
      givenName: clean(nameWords[0]),
      familyName: clean(nameWords.slice(1).join(" ")),
      email,
      mobile,
      dob
    };
  }

  function addButton() {
    const header = Array.from(document.querySelectorAll("h2, h3, legend"))
      .find(h => norm(h.textContent) === "user details");

    if (!header || header.dataset.detailsBtnDone) return;
    header.dataset.detailsBtnDone = "1";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Paste details";

    Object.assign(btn.style, {
      marginLeft: "8px",
      padding: "6px 10px",
      borderRadius: "6px",
      border: "1px solid #bbb",
      cursor: "pointer",
      background: "white"
    });

    const status = document.createElement("span");

    Object.assign(status.style, {
      marginLeft: "10px",
      fontSize: "11px",
      color: "#666"
    });

    btn.addEventListener("click", async () => {
      try {
        const raw = await navigator.clipboard.readText();

        if (!raw) {
          alert("Clipboard is empty.");
          return;
        }

        const parsed = parsePersonalDetails(raw);

        if (!parsed) {
          alert("Couldn't parse. Expected: Name[TAB]email@x.com[TAB]447...[TAB]DD/MM/YYYY");
          return;
        }

        setVal(
          findInput(
            ["given name", "first name"],
            ["given", "firstname", "first_name", "fname"]
          ),
          parsed.givenName
        );

        setVal(
          findInput(
            ["family name", "last name", "surname"],
            ["family", "lastname", "last_name", "surname", "lname"]
          ),
          parsed.familyName
        );

        setVal(
          findInput(["email address", "email"], ["email", "mail"]),
          parsed.email
        );

        setVal(
          findInput(["mobile", "phone", "telephone"], ["mobile", "phone", "tel"]),
          parsed.mobile
        );

        setVal(
          findInput(["date of birth", "dob", "birth date"], ["dob", "birth", "dateofbirth"]),
          parsed.dob
        );

        setOpsTeam(status);

        btn.textContent = "Pasted ✓";
        setTimeout(() => {
          btn.textContent = "Paste details";
        }, 2000);
      } catch (e) {
        console.error(e);
        alert("Clipboard access failed.");
      }
    });

    header.appendChild(btn);
    header.appendChild(status);
  }

  const ro = new MutationObserver(() => addButton());
  ro.observe(document.documentElement, { childList: true, subtree: true });

  addButton();
})();
