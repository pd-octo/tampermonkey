// ==UserScript==
// @name         Kraken: Paste full address in Properties (scoped + styled)
// @namespace    https://github.com/pd-octo/tampermoney
// @version      1.5.0
// @description  Button to paste UK address from clipboard into Add Property form (only on add-without-meter-points route), SPA-safe
// @author       Paul Davidson
// @match        https://kraken.octopus.energy/*properties*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/pd-octo/tampermoney/main/connections-paste-address-in-properties.user.js
// @updateURL    https://raw.githubusercontent.com/pd-octo/tampermoney/main/connections-paste-address-in-properties.user.js
// ==/UserScript==

(function () {
  "use strict";

  const BTN_ID = "km-paste-address-btn";
  const POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;

  /* ---------------- route guard ---------------- */
  function shouldActivate() {
    // Allow: /accounts/{acc}/properties/add-without-meter-points/{date}/{postcode}/...
    // Block: anything with /properties/add/ and all other routes
    const p = location.pathname;
    if (/\/properties\/add\//.test(p)) return false;
    return /^\/accounts\/[^/]+\/properties\/add-without-meter-points\/[^/]+\/[^/]+\/?/.test(p);
  }

  /* ---------------- helpers ---------------- */
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

  function findControlByLabelText(startsWithText) {
    const labels = qsa("label");
    const lbl = labels.find(l => norm(l.textContent).startsWith(norm(startsWithText)));
    if (!lbl) return null;
    if (lbl.htmlFor) return document.getElementById(lbl.htmlFor) || null;

    // Fallback: first input/textarea/select sibling after label
    let el = lbl.nextElementSibling;
    while (el && !/^(INPUT|TEXTAREA|SELECT)$/i.test(el.tagName)) el = el.nextElementSibling;
    return el || null;
  }

  function findForm() {
    const submitBtn = qsa('button, input[type="submit"]').find(b => /submit/i.test(b.textContent || b.value || ""));
    if (submitBtn) {
      const form = submitBtn.closest("form");
      if (form) return form;
    }
    const candidates = qsa("form, main, section, div").filter(n => qsa('input[type="text"]', n).length >= 4);
    return candidates[0] || document.body;
  }

  function parseAddress(raw) {
    const parts = raw.split(/\r?\n|,\s*/g).map(s => s.trim()).filter(Boolean);
    let postcode = "";
    for (let i = parts.length - 1; i >= 0; i--) {
      const m = parts[i].match(POSTCODE_RE);
      if (m) {
        postcode = m[1].toUpperCase().replace(/\s+/, " ");
        const before = parts[i].replace(POSTCODE_RE, "").trim();
        if (before) parts[i] = before; else parts.splice(i, 1);
        break;
      }
    }
    return { lines: parts.slice(0, 5), postcode };
  }

  function getFields() {
    const byLabel = {
      line1: findControlByLabelText("Address Line 1"),
      line2: findControlByLabelText("Address Line 2"),
      line3: findControlByLabelText("Address Line 3"),
      line4: findControlByLabelText("Address Line 4"),
      line5: findControlByLabelText("Address Line 5"),
      postcode: findControlByLabelText("Postcode"),
    };
    const hasAny = Object.values(byLabel).some(Boolean);
    if (hasAny) return byLabel;

    const form = findForm();
    const inputs = qsa('input[type="text"]', form).filter(i => i.offsetParent !== null);
    const fields = {
      line1: inputs[0] || null,
      line2: inputs[1] || null,
      line3: inputs[2] || null,
      line4: inputs[3] || null,
      line5: inputs[4] || null,
      postcode: inputs[5] || null,
    };
    return fields;
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return alert("Clipboard is empty.");

      const { lines, postcode } = parseAddress(text);
      const f = getFields();

      ["line1","line2","line3","line4","line5"].forEach((k,i)=> {
        if (f[k]) f[k].value = lines[i] || "";
      });
      if (f.postcode && postcode) f.postcode.value = postcode;

      [f.line1,f.line2,f.line3,f.line4,f.line5,f.postcode].forEach(el=>{
        if (!el) return;
        el.dispatchEvent(new Event("input", { bubbles:true }));
        el.dispatchEvent(new Event("change", { bubbles:true }));
      });

    } catch (e) {
      console.error(e);
      alert("Could not read clipboard. Click the page first and allow clipboard permissions.");
    }
  }

  /* ---------------- UI injection ---------------- */
  function findTitleNode() {
    const nodes = qsa("h1, h2, h3, div, p, span");
    return nodes.find(n => /add property without meter point/i.test(n.textContent || ""));
  }

  function ensureButtonRemoved() {
    const existing = document.getElementById(BTN_ID);
    if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
  }

  function insertButton() {
    if (document.getElementById(BTN_ID)) return true;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "Paste address";

    // *** Exact style you provided ***
    Object.assign(btn.style, {
      marginLeft: "8px",
      padding: "6px 10px",
      borderRadius: "6px",
      border: "1px solid #bbb",
      cursor: "pointer",
      background: "white",
    });

    btn.addEventListener("click", pasteFromClipboard);

    const title = findTitleNode();
    if (title) {
      title.appendChild(btn);
      return true;
    }

    const form = findForm();
    if (form && form.parentElement) {
      const bar = document.createElement("div");
      bar.style.display = "flex";
      bar.style.justifyContent = "flex-end";
      bar.style.margin = "8px 0 12px";
      bar.appendChild(btn);
      form.parentElement.insertBefore(bar, form);
      return true;
    }

    // Fallback fixed position if we can't find a good anchor
    Object.assign(btn.style, {
      position: "fixed",
      top: "90px",
      right: "20px",
      zIndex: 99999
    });
    document.body.appendChild(btn);
    return true;
  }

  /* ---------------- SPA awareness ---------------- */
  function tryInject() {
    if (!shouldActivate()) {
      ensureButtonRemoved();
      return false;
    }
    const fields = getFields();
    const exists = fields.line1 || fields.postcode;
    if (!exists) return false;
    return insertButton();
  }

  const mo = new MutationObserver(() => { tryInject(); });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  const _ps = history.pushState, _rs = history.replaceState;
  function rerun(){ setTimeout(tryInject, 0); }
  history.pushState = function(){ _ps.apply(this, arguments); rerun(); };
  history.replaceState = function(){ _rs.apply(this, arguments); rerun(); };
  window.addEventListener("popstate", rerun);

  window.addEventListener("load", tryInject);
  setTimeout(tryInject, 300);
  setTimeout(tryInject, 1000);
})();
