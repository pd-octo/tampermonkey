// ==UserScript==
// @name         Kraken Field - Copy Job / Date / Slot
// @namespace    https://github.com/pd-octo/tampermonkey
// @version      1.4.0
// @description  Adds buttons to copy appointment details.
// @match        https://field.oes-prod.energy/jobs-projects/jobs/J-*
// @match        https://pd-octo.github.io/tampermonkey/*
// @grant        GM_setClipboard
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/pd-octo/tampermonkey/main/kraken-field-copy-slot.user.js
// @updateURL    https://raw.githubusercontent.com/pd-octo/tampermonkey/main/kraken-field-copy-slot.user.js
// ==/UserScript==

(function () {
  'use strict';

  if (location.hostname === 'pd-octo.github.io' && location.pathname.indexOf('/tampermonkey') === 0) {
    try { localStorage.setItem('tm-installed:kraken-field-copy-slot.user.js', '1'); } catch (e) {}
    return;
  }

  const CONNECTIONS_SLOT_BUTTON_ID = 'tm-copy-job-date-slot-btn';
  const PROACTIVE_SLOT_BUTTON_ID = 'tm-copy-proactive-slot-btn';
  const NSMR_BUTTON_ID = 'tm-copy-nsmr-slot-btn';

  let observer;

  function normaliseText(text) {
    return (text || '').replace(/\s+/g, ' ').trim();
  }

  function getJobRef() {
    const match = window.location.pathname.match(/\/jobs-projects\/jobs\/(J-[A-Z0-9]+)/i);
    if (match) return match[1];

    const found = normaliseText(document.body.textContent).match(/J-[A-Z0-9]+/i);
    return found ? found[0] : '';
  }

  function getJobType() {
    const rows = [...document.querySelectorAll('div, p, span, td, th')];

    for (const el of rows) {
      if (normaliseText(el.textContent) === 'Type') {
        const parent = el.parentElement;
        if (!parent) continue;

        const candidates = [...parent.querySelectorAll('div, p, span, td')]
          .map(x => normaliseText(x.textContent))
          .filter(x => x && x !== 'Type');

        if (candidates.length) return candidates[0];
      }
    }

    const bodyText = normaliseText(document.body.textContent);
    const match = bodyText.match(/Type\s+(.+?)\s+Project ID/i);

    return match ? normaliseText(match[1]) : '';
  }

  function formatDateDDMMYYYY(dateText) {
    const clean = normaliseText(dateText);
    const match = clean.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);

    if (!match) return clean;

    const [, dd, mm, yyyy] = match;
    return `${dd}/${mm}/${yyyy}`;
  }

  function parseDateAndSlot(rawText) {
    const raw = normaliseText(rawText);
    const match = raw.match(/^(\d{2}[-/]\d{2}[-/]\d{4})\s+(AM|AD|PM)$/i);

    if (match) {
      return {
        date: formatDateDDMMYYYY(match[1]),
        slot: match[2].toUpperCase()
      };
    }

    const parts = raw.split(' ');

    return {
      date: formatDateDDMMYYYY(parts[0] || ''),
      slot: (parts[1] || '').toUpperCase()
    };
  }

  function getAppointmentDateAndSlot() {
    const appointmentRows = [];

    const tables = [...document.querySelectorAll('table')];

    for (const table of tables) {
      const headers = [...table.querySelectorAll('th')]
        .map(th => normaliseText(th.textContent).toLowerCase());

      const dateIndex = headers.indexOf('date');
      const statusIndex = headers.indexOf('status');

      if (dateIndex === -1) continue;

      const rows = [...table.querySelectorAll('tbody tr')];

      for (const row of rows) {
        const cells = [...row.querySelectorAll('td')];
        if (!cells[dateIndex]) continue;

        const status = statusIndex >= 0 && cells[statusIndex]
          ? normaliseText(cells[statusIndex].textContent)
          : '';

        const { date, slot } = parseDateAndSlot(cells[dateIndex].textContent);

        if (date && slot) {
          appointmentRows.push({ date, slot, status });
        }
      }
    }

    const booked = appointmentRows.find(row =>
      row.status.toLowerCase().includes('booked')
    );

    if (booked) return booked;

    const notCancelled = appointmentRows.find(row =>
      !row.status.toLowerCase().includes('cancelled')
    );

    if (notCancelled) return notCancelled;

    return appointmentRows[0] || { date: '', slot: '', status: '' };
  }

  function copyText(text) {
    if (typeof GM_setClipboard !== 'undefined') {
      GM_setClipboard(text, 'text');
      return Promise.resolve();
    }

    return navigator.clipboard.writeText(text);
  }

  function showButtonFeedback(button, message) {
    const original = button.textContent;
    button.textContent = message;

    setTimeout(() => {
      button.textContent = original;
    }, 1500);
  }

  async function handleCopyConnectionsSlot(button) {
    const jobRef = getJobRef();
    const { date, slot } = getAppointmentDateAndSlot();

    if (!jobRef || !date || !slot) {
      showButtonFeedback(button, 'Missing data');
      return;
    }

    await copyText(`${date}\t${slot}\t${jobRef}`);
    showButtonFeedback(button, 'Copied');
  }

  async function handleCopyProactiveSlot(button) {
    const jobRef = getJobRef();
    const { date, slot } = getAppointmentDateAndSlot();

    if (!jobRef || !date || !slot) {
      showButtonFeedback(button, 'Missing data');
      return;
    }

    await copyText(`${jobRef}\t${date}\t${slot}`);
    showButtonFeedback(button, 'Copied');
  }

  async function handleCopyNSMRText(button) {
    const type = getJobType();
    const { date, slot } = getAppointmentDateAndSlot();

    if (!type || !date || !slot) {
      showButtonFeedback(button, 'Missing data');
      return;
    }

    const output = `${type} booked for ${date} ${slot}. If this date doesn't work, please re-schedule within Kraken. You can do this via the “Details” button next to the booking on the On-Site Jobs section. We can only see the dates you see here, so please work with the customer to find a suitable date.`;

    await copyText(output);
    showButtonFeedback(button, 'Copied');
  }

  function styleButton(btn) {
    btn.type = 'button';
    btn.style.marginRight = '8px';
    btn.style.padding = '0 14px';
    btn.style.height = '30px';
    btn.style.border = '1px solid rgb(91, 33, 182)';
    btn.style.borderRadius = '4px';
    btn.style.background = '#fff';
    btn.style.color = 'rgb(91, 33, 182)';
    btn.style.cursor = 'pointer';
    btn.style.fontSize = '14px';
    btn.style.fontWeight = '500';
  }

  function makeButton(id, label, handler) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = label;
    styleButton(btn);
    btn.addEventListener('click', () => handler(btn));
    return btn;
  }

  function insertButtons() {
    const completeButton = [...document.querySelectorAll('button')]
      .find(btn => normaliseText(btn.textContent) === 'Complete');

    if (!completeButton || !completeButton.parentElement) return;

    if (!document.getElementById(CONNECTIONS_SLOT_BUTTON_ID)) {
      completeButton.parentElement.insertBefore(
        makeButton(CONNECTIONS_SLOT_BUTTON_ID, 'Copy slot (Connections)', handleCopyConnectionsSlot),
        completeButton
      );
    }

    if (!document.getElementById(PROACTIVE_SLOT_BUTTON_ID)) {
      completeButton.parentElement.insertBefore(
        makeButton(PROACTIVE_SLOT_BUTTON_ID, 'Copy slot (Proactive)', handleCopyProactiveSlot),
        completeButton
      );
    }

    if (!document.getElementById(NSMR_BUTTON_ID)) {
      completeButton.parentElement.insertBefore(
        makeButton(NSMR_BUTTON_ID, 'Copy slot (NSMR)', handleCopyNSMRText),
        completeButton
      );
    }
  }

  function init() {
    insertButtons();

    if (observer) observer.disconnect();

    observer = new MutationObserver(() => {
      insertButtons();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function watchUrlChanges() {
    let lastUrl = location.href;

    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(init, 500);
      }
    }, 500);
  }

  init();
  watchUrlChanges();

  window.addEventListener('pageshow', () => {
    setTimeout(init, 500);
  });
})();
