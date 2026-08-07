// ==UserScript==
// @name         Kraken: Shell account address
// @namespace    https://github.com/pd-octo/tampermoney
// @version      1.1.0
// @description  Paste a single-line UK address from clipboard and auto-fill Billing address fields on Kraken
// @author       Paul Davidson
// @match        https://*.octopus.energy/*
// @match        https://kraken.octopus.energy/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/pd-octo/tampermoney/main/connections-shell-account-address.user.js
// @updateURL    https://raw.githubusercontent.com/pd-octo/tampermoney/main/connections-shell-account-address.user.js
// ==/UserScript==

(function () {
  "use strict";

  /*** Helpers ***/
  const UK_POSTCODE_RE = /([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})$/i;

  const toTitleish = s =>
    s
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase());

  const clean = s => toTitleish(s.replace(/\s*,\s*/g, " ").trim());

  // Normalise label text: lowercase, remove punctuation, asterisks, extra spaces
  const norm = s =>
    (s || "")
      .toLowerCase()
      .replace(/[*:]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  // Find an <input> by label text OR by common id/name/placeholder keywords
  function findInput(preferredLabels = [], keywords = []) {
    const want = preferredLabels.map(norm);

    // 1) Look for a matching <label> / [aria-label]
    const labelEls = Array.from(document.querySelectorAll("label, [aria-label]"));
    const labelMatch = labelEls.find(l => {
      const t = norm(l.textContent || l.getAttribute("aria-label"));
      return want.some(w => t === w || t.startsWith(w));
    });

    if (labelMatch) {
      // for="id" path
      const forId = labelMatch.getAttribute("for");
      if (forId) {
        const byId = document.getElementById(forId);
        if (byId) return byId;
      }
      // nested input path
      const nested = labelMatch.querySelector("input");
      if (nested) return nested;
      // sibling input path
      let sib = labelMatch.nextElementSibling;
      while (sib && sib.querySelector) {
        const inp = sib.querySelector("input");
        if (inp) return inp;
        sib = sib.nextElementSibling;
      }
    }

    // 2) Fall back to name/id/placeholder contains keywords
    const allInputs = Array.from(document.querySelectorAll("input"));
    const kw = keywords.map(k => k.toLowerCase());
    const byAttr = allInputs.find(inp => {
      const attr = (
        (inp.name || "") +
        " " +
        (inp.id || "") +
        " " +
        (inp.placeholder || "")
      ).toLowerCase();
      return kw.some(k => attr.includes(k));
    });
    if (byAttr) return byAttr;

    return null;
  }

  function setVal(el, val) {
    if (!el) return;
    const v = val || "";
    if (el.value === v) return;
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    // Some design systems also listen to blur
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function parseUkAddress(raw) {
    if (!raw) return null;
    let s = raw.replace(/\n/g, ", ").replace(/\s+/g, " ").trim();

    // Extract postcode
    let postcode = "";
    const m = s.match(UK_POSTCODE_RE);
    if (m) {
      postcode = m[1].toUpperCase();
      s = s.replace(UK_POSTCODE_RE, "").replace(/[,\s]+$/, "");
    }

    const parts = s.split(",").map(p => clean(p)).filter(Boolean);
    const lines = [
      parts[0] || "",
      parts[1] || "",
      parts[2] || "",
      parts[3] || "",
      parts[4] || "",
    ];
    return { lines, postcode };
  }

  function addButton() {
    // Find the "Billing address" header (h2/h3/legend)
    const header = Array.from(document.querySelectorAll("h2, h3, legend"))
      .find(h => norm(h.textContent) === "billing address");
    if (!header || header.dataset.addrBtnDone) return;

    header.dataset.addrBtnDone = "1";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Paste address";
    btn.title = "Paste single-line address from your clipboard and autofill lines + postcode";
    Object.assign(btn.style, {
      marginLeft: "8px",
      padding: "6px 10px",
      borderRadius: "6px",
      border: "1px solid #bbb",
      cursor: "pointer",
      background: "white",
    });

    btn.addEventListener("click", async () => {
      try {
        const raw = await navigator.clipboard.readText();
        if (!raw) {
          alert("Clipboard is empty. Copy the full address first.");
          return;
        }
        const parsed = parseUkAddress(raw);
        if (!parsed) {
          alert("Couldn’t parse that address.");
          return;
        }
        const [L1, L2, L3, L4, L5] = parsed.lines;

        const a1 = findInput(
          ["address line 1"],
          ["address1", "address_line_1", "line1", "addr1"]
        );
        const a2 = findInput(
          ["address line 2"],
          ["address2", "address_line_2", "line2", "addr2"]
        );
        const a3 = findInput(
          ["address line 3"],
          ["address3", "address_line_3", "line3", "addr3", "town", "city", "locality"]
        );
        const a4 = findInput(
          ["address line 4"],
          ["address4", "address_line_4", "line4", "county", "region"]
        );
        const a5 = findInput(
          ["address line 5"],
          ["address5", "address_line_5", "line5"]
        );
        const pc = findInput(
          ["postcode", "post code"],
          ["postcode", "post_code", "zip"]
        );

        setVal(a1, L1);
        setVal(a2, L2);
        setVal(a3, L3);
        setVal(a4, L4);
        if (a5) setVal(a5, L5);
        if (pc) setVal(pc, parsed.postcode);

        btn.textContent = "Pasted ✓";
        setTimeout(() => (btn.textContent = "Paste address"), 1500);
      } catch (e) {
        console.error(e);
        alert("Clipboard access failed. Grant permission and try again.");
      }
    });

    header.appendChild(btn);
  }

  // Observe SPA updates
  const ro = new MutationObserver(() => addButton());
  ro.observe(document.documentElement, { childList: true, subtree: true });
  addButton();
})();
