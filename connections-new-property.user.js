// ==UserScript==
// @name         Connections: New property (Existing vs New account)
// @namespace    https://github.com/pd-octo/tampermoney
// @version      1.0.0
// @description  Paste UK postcode from clipboard, set today's date, and choose either Existing account or New account in same portfolio (SPA-safe)
// @match        https://kraken.octopus.energy/accounts/*/properties/add/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/pd-octo/tampermoney/main/connections-new-property.user.js
// @updateURL    https://raw.githubusercontent.com/pd-octo/tampermoney/main/connections-new-property.user.js
// ==/UserScript==

function ensureStyles() {
  if (document.getElementById("km-injected-css")) return;
  const style = document.createElement("style");
  style.id = "km-injected-css";
  style.textContent = `
    .km-btn{
      font-weight:600;
      font-size:14px;
      line-height:1.5;
      padding:6px 12px;
      border-radius:8px;
      cursor:pointer;
      transition: border-color .15s, box-shadow .15s, transform .02s;
      background:#fff;
      color:#111827;
      border:1px solid rgba(17,24,39,.18);
    }
    .km-btn:hover{
      border-color:#5b4bdb;
      box-shadow:0 0 0 3px rgba(91,75,219,.12);
    }
    .km-btn:focus{
      outline: none;
      box-shadow:0 0 0 3px rgba(91,75,219,.25);
    }
    .km-btn:active{ transform: translateY(1px); }
  `;
  document.head.appendChild(style);
}

(function () {
  "use strict";

  const BAR_ID = "km-conn-buttons-bar";
  const POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2})\b/i;

  const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function routeOK() {
    try {
      return /^\/accounts\/[^/]+\/properties\/add(\/|$)/.test(location.pathname);
    } catch { return false; }
  }

  function findControlByLabelText(startsWithText) {
    const labels = qsa("label");
    const lbl = labels.find(l => norm(l.textContent).startsWith(norm(startsWithText)));
    if (!lbl) return null;
    if (lbl.htmlFor) return document.getElementById(lbl.htmlFor) || null;

    let el = lbl.nextElementSibling;
    while (el && !/^(INPUT|TEXTAREA|SELECT)$/i.test(el.tagName)) el = el.nextElementSibling;
    return el || null;
  }

  // Robust label search by contains text (regex, case-insensitive)
  function findRadioByLabelText(pattern) {
    const re = typeof pattern === "string" ? new RegExp(pattern, "i") : pattern;
    const lbl = qsa("label").find(l => re.test(l.textContent || ""));
    return lbl ? lbl.querySelector('input[type="radio"]') : null;
  }

  function selectDefaultsExisting() {
    // New property without meter points
    const noMP = findRadioByLabelText(/new property without meter points/i);
    if (noMP && !noMP.checked) noMP.click();

    // Existing account
    const existing = findRadioByLabelText(/existing\s+account/i);
    if (existing && !existing.checked) existing.click();
  }

  function selectDefaultsNewAccount() {
    // New property without meter points
    const noMP = findRadioByLabelText(/new property without meter points/i);
    if (noMP && !noMP.checked) noMP.click();

    // New account in the same portfolio
    const newInSamePortfolio = findRadioByLabelText(/new account in the same portfolio/i);
    if (newInSamePortfolio && !newInSamePortfolio.checked) newInSamePortfolio.click();
  }

  function getTodayStr() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function findForm() {
    const submitBtn = qsa('button, input[type="submit"]').find(b => /add property/i.test(b.textContent || b.value || ""));
    if (submitBtn) {
      const form = submitBtn.closest("form");
      if (form) return form;
    }
    const candidates = qsa("form, main, section, div").filter(n => qsa('input[type="text"]', n).length >= 1);
    return candidates[0] || document.body;
  }

  function getFields() {
    return {
      postcode: findControlByLabelText("Postcode of new property"),
      moveDate: findControlByLabelText("Date of moving into new property"),
    };
  }

  async function pastePostcodeAndToday(mode) {
    try {
      const text = await navigator.clipboard.readText();
      const m = (text || "").match(POSTCODE_RE);
      const postcode = m ? m[1].toUpperCase().replace(/\s+/, " ") : "";

      const fields = getFields();
      if (fields.postcode && postcode) fields.postcode.value = postcode;
      if (fields.moveDate) fields.moveDate.value = getTodayStr();

      // Apply radio defaults based on mode
      if (mode === "existing") {
        selectDefaultsExisting();
      } else if (mode === "new") {
        selectDefaultsNewAccount();
      }

      // Fire React updates for text inputs
      [fields.postcode, fields.moveDate].forEach(el => {
        if (!el) return;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });

      if (!postcode) alert("Couldn't find a UK postcode in your clipboard.");
    } catch (e) {
      console.error(e);
      alert("Could not read clipboard. Click the page and allow clipboard permissions.");
    }
  }

  function findTitleNode() {
    const nodes = qsa("h1, h2, h3, div, p, span");
    return nodes.find(n => /add property to account/i.test(n.textContent || ""));
  }

  function insertButtons() {
    if (!routeOK()) return false;
    if (document.getElementById(BAR_ID)) return true;

    ensureStyles();

    const btnExisting = document.createElement("button");
    btnExisting.type = "button";
    btnExisting.textContent = "Existing account";
    btnExisting.className = "km-btn";
    btnExisting.addEventListener("click", () => pastePostcodeAndToday("existing"));

    const btnNew = document.createElement("button");
    btnNew.type = "button";
    btnNew.textContent = "New account";
    btnNew.className = "km-btn";
    btnNew.addEventListener("click", () => pastePostcodeAndToday("new"));

    const bar = document.createElement("div");
    bar.id = BAR_ID;
    bar.style.display = "flex";
    bar.style.alignItems = "center";
    bar.style.gap = "8px";
    bar.style.marginBottom = "12px";

    const title = findTitleNode();
    if (title) {
      title.parentNode.insertBefore(bar, title);
      bar.appendChild(title);
      bar.appendChild(btnExisting);
      bar.appendChild(btnNew);
      return true;
    }

    const form = findForm();
    if (form && form.parentElement) {
      bar.style.justifyContent = "flex-end";
      bar.style.margin = "8px 0 12px";
      bar.appendChild(btnExisting);
      bar.appendChild(btnNew);
      form.parentElement.insertBefore(bar, form);
      return true;
    }

    // Fallback fixed position
    bar.style.position = "fixed";
    bar.style.top = "80px";
    bar.style.right = "20px";
    bar.style.zIndex = 9999;
    bar.appendChild(btnExisting);
    bar.appendChild(btnNew);
    document.body.appendChild(bar);
    return true;
  }

  function tryInject() {
    if (!routeOK()) {
      const existingBar = document.getElementById(BAR_ID);
      if (existingBar) existingBar.remove();
      return;
    }

    const fields = getFields();
    if (fields.postcode || fields.moveDate) insertButtons();
  }

  // SPA awareness
  const mo = new MutationObserver(tryInject);
  mo.observe(document.documentElement, { childList: true, subtree: true });

  const _ps = history.pushState, _rs = history.replaceState;
  function rerun(){ setTimeout(tryInject, 0); }
  history.pushState = function(){ _ps.apply(this, arguments); rerun(); };
  history.replaceState = function(){ _rs.apply(this, arguments); rerun(); };
  window.addEventListener("popstate", rerun);

  window.addEventListener("load", tryInject);
  setTimeout(tryInject, 300);
  setTimeout(tryInject, 1000);

  // Keyboard shortcuts:
  // Alt+V -> Existing account
  // Alt+Shift+V -> New account
  document.addEventListener("keydown", (e) => {
    if (!routeOK()) return;
    if (e.altKey && !e.shiftKey && (e.key === "v" || e.key === "V")) {
      e.preventDefault();
      pastePostcodeAndToday("existing");
    } else if (e.altKey && e.shiftKey && (e.key === "v" || e.key === "V")) {
      e.preventDefault();
      pastePostcodeAndToday("new");
    }
  });
})();
