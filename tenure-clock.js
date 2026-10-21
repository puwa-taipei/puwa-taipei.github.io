/* Calendar time since the Taipei inauguration-date boundary; independent of the data snapshot. */
(function (global) {
  'use strict';
  const VERSION = 'v29';
  if (global?.RecordsTenureClock?.version === VERSION) {
    global.RecordsTenureClock.autoMount();
    return;
  }
  const START_ISO = '2024-02-01T00:00:00+08:00';
  const START_MS = Date.parse(START_ISO), DAY_MS = 86400000, FRACTION_SCALE = 100000;
  const TICK_MS = DAY_MS / FRACTION_SCALE, QUIET_MS = 60000;
  const mounted = new WeakMap();

  function snapshot(nowMs, startMs = START_MS) {
    if (!Number.isFinite(nowMs) || !Number.isFinite(startMs)) return null;
    const elapsedMs = Math.max(0, Math.trunc(nowMs - startMs));
    // Truncate instead of rounding: 23:59:59.999 must not become the next whole day.
    const ticks = Math.floor(elapsedMs / TICK_MS);
    const whole = Math.floor(ticks / FRACTION_SCALE), fractionValue = ticks % FRACTION_SCALE;
    return {whole, fraction: String(fractionValue).padStart(5, '0'), fractionValue, ticks, elapsedMs};
  }

  function nextDelay(nowMs, quiet, startMs) {
    if (!Number.isFinite(nowMs) || !Number.isFinite(startMs)) return QUIET_MS;
    const step = quiet ? QUIET_MS : TICK_MS;
    const elapsed = Math.max(0, Math.trunc(nowMs - startMs));
    return step - (elapsed % step) + 4;
  }

  function createTicker(options = {}) {
    const now = options.now || Date.now, schedule = options.schedule || setTimeout;
    const cancel = options.cancel || clearTimeout, onTick = options.onTick || (() => {});
    const startMs = options.startMs ?? START_MS;
    let pending = null, running = false, active = true, quiet = false, destroyed = false, previous = null;
    function clear() { if (pending !== null) cancel(pending); pending = null; }
    function arm() {
      clear();
      if (!running || !active || destroyed) return;
      pending = schedule(() => { pending = null; render('tick'); }, nextDelay(now(), quiet, startMs));
    }
    function render(reason) {
      if (destroyed || !running) return;
      const current = snapshot(now(), startMs);
      const animate = !quiet && reason === 'tick' && Boolean(current && previous && current.ticks === previous.ticks + 1);
      previous = current;
      onTick(current, {animate, reason, quiet});
      arm();
    }
    return {
      start() { if (running || destroyed) return false; running = true; previous = null; render('start'); return true; },
      setActive(value) {
        const next = Boolean(value); if (next === active || destroyed) return;
        active = next; clear(); previous = null;
        if (running && active) render('resume');
      },
      setQuiet(value) {
        const next = Boolean(value); if (next === quiet || destroyed) return;
        quiet = next; previous = null; clear();
        if (running && active) render('preference');
      },
      refresh() { if (running && active && !destroyed) { previous = null; render('refresh'); } },
      state: () => ({running, active, quiet, destroyed, pending: pending !== null, value: previous}),
      destroy() { if (destroyed) return; destroyed = true; running = false; previous = null; clear(); }
    };
  }

  function mount(root, options = {}) {
    if (!root?.ownerDocument) return null;
    if (mounted.has(root)) return mounted.get(root);
    const doc = root.ownerDocument, view = doc.defaultView || global;
    const startMs = Date.parse(root.dataset.start || START_ISO);
    const now = options.now || Date.now;
    const make = (tag, cls, text) => { const el = doc.createElement(tag); el.className = cls; if (text !== undefined) el.textContent = text; return el; };
    const visual = make('span', 'tenure-value'), integer = make('span', 'tenure-integer');
    const fraction = make('span', 'tenure-fraction'), dot = make('span', 'tenure-dot', '.');
    const fractionDigits = make('span', 'tenure-fraction-digits'), unit = make('small', 'tenure-unit', '天');
    visual.setAttribute('aria-hidden', 'true'); fraction.append(dot, fractionDigits); visual.append(integer, fraction, unit);
    root.replaceChildren(visual); root.setAttribute('role', 'timer'); root.setAttribute('aria-live', 'off');
    let accessibleMinute = null, accessibleWhole = null, inView = true, pageActive = true, observer = null;
    const listeners = [];
    const reduced = view?.matchMedia?.('(prefers-reduced-motion: reduce)');
    const connection = view?.navigator?.connection;
    function listen(target, type, handler) {
      if (!target?.addEventListener) return;
      target.addEventListener(type, handler); listeners.push(() => target.removeEventListener(type, handler));
    }
    function digit(box, value, animate) {
      if (box.dataset.digit === value) {
        // Resume/preferences must also discard already-finished animated faces.
        if (!animate && (box.children.length > 1 || box.children[0]?.className.includes('tenure-enter'))) {
          box.replaceChildren(make('span', 'tenure-face tenure-current', value));
        }
        return;
      }
      const before = box.dataset.digit;
      box.dataset.digit = value;
      box.className = 'tenure-digit' + (value === ' ' ? ' tenure-blank' : '');
      const current = make('span', 'tenure-face tenure-current', value);
      if (animate && before !== undefined && before !== ' ' && value !== ' ') {
        current.className += ' tenure-enter';
        box.replaceChildren(make('span', 'tenure-face tenure-leave', before), current);
      } else box.replaceChildren(current);
    }
    function digits(box, value, animate) {
      const resized = box.children.length !== value.length;
      if (resized) box.replaceChildren(...Array.from(value, () => make('span', 'tenure-digit')));
      Array.from(box.children).forEach((el, index) => digit(el, value[index], animate && !resized));
    }
    const ticker = createTicker({
      now, startMs, schedule: options.schedule, cancel: options.cancel,
      onTick(value, meta) {
        root.dataset.tenureQuiet = String(meta.quiet);
        if (!value) {
          digits(integer, '   —', false); digits(fractionDigits, '—————', false);
          root.setAttribute('aria-label', '裝置時間暫時無法確認，上任經過天數尚未取得。');
          return;
        }
        digits(integer, String(value.whole).padStart(4, ' '), meta.animate);
        digits(fractionDigits, value.fraction, meta.animate);
        root.dataset.tenureWhole = String(value.whole); root.dataset.tenureFraction = value.fraction;
        const minute = Math.floor(now() / QUIET_MS);
        if (minute !== accessibleMinute || value.whole !== accessibleWhole) {
          accessibleMinute = minute; accessibleWhole = value.whole;
          const progress = (Math.floor(value.fractionValue / 100) / 10).toFixed(1);
          root.setAttribute('aria-label', `自2024年2月1日零時（台北時間）起，已滿${value.whole}天，當日進度約${progress}%；這是日曆經過時間，不是開會天數。`);
        }
      }
    });
    function active() {
      const visible = !doc.hidden && pageActive && inView;
      root.dataset.tenureActive = String(visible); ticker.setActive(visible);
    }
    function preferences() { ticker.setQuiet(Boolean(reduced?.matches || connection?.saveData)); }
    listen(doc, 'visibilitychange', active);
    listen(view, 'pagehide', () => { pageActive = false; active(); });
    listen(view, 'pageshow', () => { pageActive = true; preferences(); active(); ticker.refresh(); });
    listen(reduced, 'change', preferences); listen(connection, 'change', preferences);
    if (view?.IntersectionObserver) {
      observer = new view.IntersectionObserver(entries => {
        for (const entry of entries) if (entry.target === root) { inView = entry.isIntersecting; active(); }
      }, {threshold: 0});
      observer.observe(root);
    }
    let cleaned = false;
    const controller = {
      refresh: () => ticker.refresh(), state: () => ticker.state(),
      destroy() {
        if (cleaned) return; cleaned = true;
        ticker.destroy(); observer?.disconnect(); for (const remove of listeners) remove();
        root.dataset.tenureActive = 'false'; mounted.delete(root);
      }
    };
    mounted.set(root, controller); preferences(); active(); ticker.start();
    return controller;
  }
  function autoMount() {
    if (typeof document !== 'undefined') mount(document.getElementById('elapsed-days'));
  }
  const api = Object.freeze({version: VERSION, START_ISO, START_MS, DAY_MS, TICK_MS, QUIET_MS, snapshot, createTicker, mount, autoMount});
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (global) global.RecordsTenureClock = api;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount, {once: true});
    else autoMount();
  }
})(typeof window === 'undefined' ? null : window);
