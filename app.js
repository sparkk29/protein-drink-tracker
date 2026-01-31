(function () {
  'use strict';

  const STORAGE_KEY = 'proteinDrinkTracker';
  const LANG_KEY = 'proteinTrackerLang';
  const RESET_HOUR = 2; // 2am local

  // 1. translation dictionary
  const translations = {
    en: {
      title: "Protein Drink Tracker",
      btnDrank: "I drank my protein",
      statusDone: "Protein done for today.",
      statusNotDone: "Not yet today."
      // TODO: add alt texts transaltions for images
      /* altFlexed: "Protein drank today",
      altWeak: "Protein not yet drank today" */
    },
    fr: {
      title: "Suivi de Protéines",
      btnDrank: "J'ai bu ma protéine",
      statusDone: "Protéine prise aujourd'hui.",
      statusNotDone: "Pas encore aujourd'hui."
      // TODO: add alt texts transaltions for images
      /* altFlexed: "Protéine bue aujourd'hui",
      altWeak: "Pas encore de protéine" */
    }
  };

  // Récupérer la langue préférée (défaut: en)
  let currentLang = localStorage.getItem(LANG_KEY) || 'en';

  /**
   * App "day" = from 2:00 AM to 1:59 AM next calendar day (local).
   * Returns YYYY-MM-DD for the current app day.
   */
  function getDateKey() {
    const now = new Date();
    const hour = now.getHours();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (hour < RESET_HOUR) {
      date.setDate(date.getDate() - 1);
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { dateKey: null, drank: false };
      const data = JSON.parse(raw);
      return {
        dateKey: data.dateKey || null,
        drank: Boolean(data.drank)
      };
    } catch (_) {
      return { dateKey: null, drank: false };
    }
  }

  function saveState(dateKey, drank) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dateKey, drank }));
    } catch (_) { }
  }

  function getCurrentDrank() {
    const dateKey = getDateKey();
    const stored = loadState();
    if (stored.dateKey !== dateKey) {
      return false;
    }
    return stored.drank;
  }

  function setDrank(drank) {
    const dateKey = getDateKey();
    saveState(dateKey, drank);
  }

  function toggleDrank() {
    const next = !getCurrentDrank();
    setDrank(next);
    return next;
  }

  function updateUI(drank) {
    const flexed = document.getElementById('arm-flexed');
    const weak = document.getElementById('arm-weak');
    const btn = document.getElementById('toggle-btn');
    const status = document.getElementById('status-text');
    const title = document.getElementById('app-title');

    const texts = translations[currentLang];

    if (title) title.textContent = texts.title;
    if (flexed) flexed.classList.toggle('hidden', !drank);
    if (weak) weak.classList.toggle('hidden', drank);
    if (btn) {
      btn.setAttribute('aria-pressed', drank ? 'true' : 'false');
      btn.textContent = texts.btnDrank;
    }
    if (status) {
      status.textContent = drank ? texts.statusDone : texts.statusNotDone;
    }
  }

  function handleToggle() {
    const drank = toggleDrank();
    updateUI(drank);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(50);
    }
  }

  function init() {
    const drank = getCurrentDrank();

    const langSelect = document.getElementById('lang-select');
    langSelect.value = currentLang;
    langSelect.addEventListener('change', (e) => {
      currentLang = e.target.value;
      localStorage.setItem(LANG_KEY, currentLang);
      updateUI(getCurrentDrank());
    });

    updateUI(drank);

    const btn = document.getElementById('toggle-btn');
    if (btn) {
      btn.addEventListener('click', handleToggle);
    }

    // Optional: re-check dateKey periodically while app is open (e.g. across midnight)
    setInterval(function () {
      const current = getCurrentDrank();
      updateUI(current);
    }, 60000);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () { });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
