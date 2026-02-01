(function () {
  'use strict';

  const STORAGE_KEY = 'proteinDrinkTracker';
  const THEME_KEY = 'proteinTheme';
  const RESET_HOUR = 2; // 2am local
  const HISTORY_MAX_DAYS = 365;

  const WORLD_CITIES = [
    { name: 'New York', timeZone: 'America/New_York' },
    { name: 'London', timeZone: 'Europe/London' },
    { name: 'Tokyo', timeZone: 'Asia/Tokyo' },
    { name: 'Sydney', timeZone: 'Australia/Sydney' }
  ];

  /* --- Location Variables --- */
  let userLocation = { city: 'Local Time', timeZone: undefined };

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

  function parseDateKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDisplayDate(dateKey) {
    const d = parseDateKey(dateKey);
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { dateKey: null, drank: false, history: [] };
      const data = JSON.parse(raw);
      const history = Array.isArray(data.history) ? data.history : [];
      return {
        dateKey: data.dateKey || null,
        drank: Boolean(data.drank),
        history: history
      };
    } catch (_) {
      return { dateKey: null, drank: false, history: [] };
    }
  }

  function saveState(dateKey, drank, history) {
    try {
      const trimmed = (history || []).slice(-HISTORY_MAX_DAYS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dateKey, drank, history: trimmed }));
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

  function getHistory() {
    const dateKey = getDateKey();
    const stored = loadState();
    let history = stored.history || [];
    if (stored.dateKey === dateKey && stored.drank && !history.includes(dateKey)) {
      history = history.concat([dateKey]);
      saveState(dateKey, true, history);
    } else if (stored.dateKey === dateKey && !stored.drank) {
      history = history.filter(function (k) { return k !== dateKey; });
    }
    return history;
  }

  function setDrank(drank) {
    const dateKey = getDateKey();
    const stored = loadState();
    let history = stored.history || [];
    if (drank) {
      if (!history.includes(dateKey)) history = history.concat([dateKey]);
    } else {
      history = history.filter(function (k) { return k !== dateKey; });
    }
    saveState(dateKey, drank, history);
  }

  function getStreak() {
    const todayKey = getDateKey();
    const history = getHistory();
    const drankSet = new Set(history);
    if (!drankSet.has(todayKey)) return 0;
    let streak = 0;
    const today = parseDateKey(todayKey);
    let d = new Date(today);
    while (true) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const key = y + '-' + m + '-' + day;
      if (!drankSet.has(key)) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  function toggleDrank() {
    const next = !getCurrentDrank();
    setDrank(next);
    return next;
  }

  /* --- Location Functions --- */
  async function fetchCityName(lat, lon) {
    try {
      // Using BigDataCloud's free reverse geocoding API (client-side capable)
      const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
      if (!res.ok) throw new Error('HTTP Error ' + res.status);

      const data = await res.json();
      if (!data || typeof data !== 'object') throw new Error('Invalid response data');

      return data.city || data.locality || 'Location Found';
    } catch (e) {
      console.error('City fetch failed', e);
      return 'Local Time';
    }
  }

  function initLocation() {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        userLocation.city = await fetchCityName(latitude, longitude);
        // We can trust the browser's Intl timezone, but having the city name confirm's "My Location"
        const el = document.getElementById('main-clock-label');
        if (el) el.textContent = 'Time in ' + userLocation.city;
      }, (err) => {
        console.warn('Geolocation denied or failed', err);
        const el = document.getElementById('main-clock-label');
        if (el) el.textContent = 'Local Time';
      });
    } else {
      const el = document.getElementById('main-clock-label');
      if (el) el.textContent = 'Local Time';
    }
  }

  /* --- Clock Functions --- */
  function initWorldClocks() {
    const container = document.getElementById('world-clocks');
    if (container) {
      let html = '';
      WORLD_CITIES.forEach((city, index) => {
        html += `
          <div class="world-clock-item">
            <span class="city-name">${city.name}</span>
            <span class="city-time" id="world-clock-time-${index}">--:--</span>
          </div>
        `;
      });
      container.innerHTML = html;
    }
  }


  function updateClock() {
    const now = new Date();

    // Main Clock (Local)
    const timeEl = document.getElementById('clock-time');
    const secEl = document.getElementById('clock-seconds');

    if (timeEl && secEl) {
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');

      timeEl.textContent = `${h}:${m}`;
      secEl.textContent = s;
    }

    // World Clocks
    WORLD_CITIES.forEach((city, index) => {
      const el = document.getElementById(`world-clock-time-${index}`);
      if (el) {
        const timeStr = now.toLocaleTimeString('en-US', {
          timeZone: city.timeZone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        el.textContent = timeStr;
      }
    });
  }

  /* --- Theme Functions --- */
  function loadTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = theme === 'light' ? '☀️' : '🌙';
      btn.setAttribute('aria-label', theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode');
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  /* --- UI Functions --- */
  function updateUI(drank) {
    const dateKey = getDateKey();
    const flexed = document.getElementById('arm-flexed');
    const weak = document.getElementById('arm-weak');
    const btn = document.getElementById('toggle-btn');
    const status = document.getElementById('status-text');
    const dateEl = document.getElementById('date-text');
    const streakEl = document.getElementById('streak-text');

    if (flexed) flexed.classList.toggle('hidden', !drank);
    if (weak) weak.classList.toggle('hidden', drank);
    if (btn) {
      btn.setAttribute('aria-pressed', drank ? 'true' : 'false');
      btn.textContent = drank ? 'Undo' : 'I drank my protein';
    }
    if (status) {
      status.textContent = drank ? 'Protein done for today.' : 'Not yet today.';
    }
    if (dateEl) {
      dateEl.textContent = formatDisplayDate(dateKey);
    }
    if (streakEl) {
      const streak = getStreak();
      streakEl.textContent = streak > 0
        ? (streak === 1 ? '1 day streak!' : streak + ' day streak!')
        : '';
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
    // PROTEIN TRACKER INIT
    const drank = getCurrentDrank();
    updateUI(drank);

    const btn = document.getElementById('toggle-btn');
    if (btn) {
      btn.addEventListener('click', handleToggle);
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      });
    }

    // THEME INIT
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', toggleTheme);
    }
    setTheme(loadTheme());

    // CLOCK INIT
    initLocation();
    initWorldClocks();
    updateClock();
    setInterval(updateClock, 1000);

    // Periodic Date Check
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
