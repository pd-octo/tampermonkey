// ==UserScript==
// @name         Kraken - Account Note Presets
// @namespace    https://github.com/pd-octo/tampermonkey
// @version      1.0.0
// @description  Adds a buttons to create pinned account notes from preset options.
// @match        https://kraken.octopus.energy/*/notes/add/*
// @match        https://kraken.octopus.energy/*/notes/add/
// @grant        GM_addStyle
// @downloadURL  https://raw.githubusercontent.com/pd-octo/tampermonkey/main/kraken-account-note-presets.user.js
// @updateURL    https://raw.githubusercontent.com/pd-octo/tampermonkey/main/kraken-account-note-presets.user.js
// ==/UserScript==

(function () {
  'use strict';

  const PRESETS = [
    {
      label: 'New Connection',
      text: '[Connections Team] - If the customer gets in touch about a new connection, please raise in #help-connections. DO NOT DM ME DIRECTLY. Do not raise a related NSMR on this account. Check request status here: https://bit.ly/oe-connections'
    },
    {
      label: 'Meter Move',
      text: '[Connections Team] - If the customer gets in touch about a meter move, please raise in #help-connections. DO NOT DM ME DIRECTLY. Do not raise a related NSMR on this account. Check request status here: https://bit.ly/oe-connections'
    },
    {
      label: 'Supply Upgrade',
      text: '[Connections Team] - If the customer gets in touch about a supply upgrade, please raise in #help-connections. DO NOT DM ME DIRECTLY. Do not raise a related NSMR on this account. Check request status here: https://bit.ly/oe-connections'
    },
    {
      label: 'Supply Downgrade',
      text: '[Connections Team] - If the customer gets in touch about a supply downgrade, please raise in #help-connections. DO NOT DM ME DIRECTLY. Do not raise a related NSMR on this account. Check request status here: https://bit.ly/oe-connections'
    },
    {
      label: 'Bulk New Conn',
      text: '[Connections Team] - This account is part of a bulk new connection request in the Connections journey. If the customer gets in touch about a new connection please raise in #help-connections. DO NOT DM ME DIRECTLY. Do not raise a related NSMR on this account.'
    },
    {
      label: 'Withdrawn (no Contact)',
      text: '[Connections Team] - Account withdrawn from Connections journey due to no contact. If they inflow about a connection request, raise on #help-connections. DO NOT DM ME DIRECTLY.'
    },
    {
      label: 'Withdrawn (Ops/OES)',
      text: '[Connections Team] - Account withdrawn from Connections journey as booked by Ops/OES. Please raise in #help-connections if customer contacts. DO NOT DM ME DIRECTLY.'
    },
    {
      label: 'Withdrawn (DNO/GDN)',
      text: '[Connections Team] - Account withdrawn from Connections journey as DNO/GDN work required before metering works. Please raise in #help-connections if customer contacts. DO NOT DM ME DIRECTLY.'
    },
    {
      label: 'Withdrawn (Other Supplier)',
      text: '[Connections Team] - Account withdrawn from Connections journey as MPxN supplied by different supplier. Do not enrol MPxN with no MSN attached. Please raise in #help-connections if customer contacts. DO NOT DM ME DIRECTLY.'
    },
    {
      label: 'Withdrawn (Business New Conn)',
      text: '[Connections Team] - Account withdrawn from Connections journey as MPxN is for a non-domestic site. Do not enrol MPxN for this property. Please raise in #help-connections if customer contacts. DO NOT DM ME DIRECTLY.'
    },
      {
      label: 'Withdrawn (Business Move/Upgrade)',
      text: '[Connections Team] - Account withdrawn from Connections journey as MPxN is for a non-domestic site. Please raise to Business help channel(s) as Connections only handle domestic properties. DO NOT DM ME DIRECTLY.'
    },
      {
      label: 'Tariff Gas',
      text: 'Customer has traditional prepayment meter(s) and was incorrectly signed up on credit agreement for gas. New key top up card sent, they should use the previous supplier’s card until ours arrives. If customer wishes to switch to credit, please book a SMEX.'
    },
      {
      label: 'Tariff Elec',
      text: 'Customer has traditional prepayment meter(s) and was incorrectly signed up on credit agreement for elec. New key sent, they should use the previous supplier’s key until ours arrives. If customer wishes to switch to credit, please book a SMEX.'
    },
      {
      label: 'Tariff DF',
      text: 'Customer has traditional prepayment meter(s) and was incorrectly signed up on credit agreement for gas & elec. New key and card sent, they should use the previous supplier’s key and card until ours arrives. If customer wishes to switch to credit, please book a SMEX.'
    },
      {
      label: 'Shipperless',
      text: '[Connections Team] - Account withdrawn from Connections journey as property identified with a shipperless supply. Account has been set up, please request an MTD update if the customer contacts.'
    }
  ];

  GM_addStyle(`
    .oe-note-toolbar { display:flex; flex-wrap:wrap; gap:.5rem; margin:0 0 .75rem 0; }
    .oe-note-toolbar .btn-oe {
      border:1px solid #b88cff; background:#f6f0ff; color:#4b2bbf;
      padding:.35rem .6rem; border-radius:8px; font-size:12px; cursor:pointer; line-height:1.2;
    }
    .oe-note-toolbar .btn-oe:hover { background:#efe6ff; }
  `);

  function getNoteTextarea() {
    return (
      document.querySelector('textarea#id_text') ||
      document.querySelector('textarea[name="text"]') ||
      document.querySelector('form textarea') ||
      document.querySelector('textarea')
    );
  }

  function getPinCheckbox() {
    let el =
      document.querySelector('input[type="checkbox"]#id_pinned') ||
      document.querySelector('input[type="checkbox"][name*="pin"]') ||
      document.querySelector('input[type="checkbox"][id*="pin"]');
    if (el) return el;

    const labels = Array.from(document.querySelectorAll('label'));
    const label = labels.find(l => /pin\s+this\s+note\??/i.test(l.textContent || ''));
    if (label) {
      const forId = label.getAttribute('for');
      if (forId) {
        const targeted = document.getElementById(forId);
        if (targeted?.type === 'checkbox') return targeted;
      }
      const chk = label.parentElement?.querySelector('input[type="checkbox"]');
      if (chk) return chk;
    }
    return document.querySelector('form input[type="checkbox"]');
  }

  function getSubmitButton() {
    // Prefer the visible button that says "Add note"
    const byText = Array.from(document.querySelectorAll('button, input[type="submit"]'))
      .find(el => /add\s*note/i.test((el.textContent || el.value || '').trim()));
    if (byText) return byText;

    // Otherwise the form's submit control
    return (
      document.querySelector('form button[type="submit"]') ||
      document.querySelector('form input[type="submit"]')
    );
  }

  function insertToolbar() {
    if (document.querySelector('.oe-note-toolbar')) return;
    const ta = getNoteTextarea();
    if (!ta) return;

    const form = ta.closest('form') || document.querySelector('form');
    const toolbar = document.createElement('div');
    toolbar.className = 'oe-note-toolbar';

    PRESETS.forEach(preset => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-oe';
      btn.textContent = preset.label;
      btn.addEventListener('click', () => {
        const textarea = getNoteTextarea();
        const pin = getPinCheckbox();
        const submit = getSubmitButton();

        if (textarea) {
          textarea.value = preset.text; // change to += if you prefer append
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (pin && !pin.checked) {
          pin.checked = true;
          pin.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // Small delay so listeners catch input/change before submit
        if (submit) setTimeout(() => submit.click(), 80);
      });
      toolbar.appendChild(btn);
    });

    if (ta.parentElement) {
      ta.parentElement.insertBefore(toolbar, ta);
    } else if (form) {
      form.insertBefore(toolbar, form.firstChild);
    } else {
      document.body.insertBefore(toolbar, document.body.firstChild);
    }
  }

  const ready = () => insertToolbar();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready);
  } else {
    ready();
  }

  const mo = new MutationObserver(() => insertToolbar());
  mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
})();
