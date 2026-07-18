/* ==========================================================================
   AURORA — shared runtime for the Ledger product family.
   • Injects an inline SVG icon sprite (works over file:// AND http).
   • Theme toggle (persisted), tabs, copy-code, dialogs, toasts,
     the signature gauge sweep, chart draw-in, and number count-ups.
   Load once per page, ideally with `defer` in <head>.
   ========================================================================== */
(function () {
  "use strict";

  /* ---- 1. ICON SPRITE -------------------------------------------------- */
  var ICONS = {
    scale: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 15a4 4 0 0 1 8 0"/><path d="M12 15l3-4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "chevron-up": '<path d="m6 15 6-6 6 6"/>',
    "chevron-right": '<path d="m9 6 6 6-6 6"/>',
    "chevron-left": '<path d="m15 6-6 6 6 6"/>',
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "arrow-left": '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    "arrow-up": '<path d="M12 19V5M6 11l6-6 6 6"/>',
    "arrow-down": '<path d="M12 5v14M6 13l6 6 6-6"/>',
    "trending-down": '<path d="M3 7l6 6 4-4 8 8"/><path d="M17 17h4v-4"/>',
    "trending-up": '<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    "alert-triangle": '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    "alert-circle": '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    "eye-off": '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
    "more-horizontal": '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    activity: '<path d="M3 3v18h18"/><path d="m7 14 3-3 3 3 5-6"/>',
    sparkles: '<path d="M12 3l1.6 4.8L18 9l-4.4 1.2L12 15l-1.6-4.8L6 9l4.4-1.2z"/><path d="M19 14l.7 2 .3.7-2-.7"/><path d="M5 15l.6 1.8L7 17"/>',
    droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    ruler: '<path d="M16 2 22 8 8 22 2 16z"/><path d="m7.5 10.5 2 2M11 7l2 2M14.5 3.5l2 2M4 13.5l2 2"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    refresh: '<path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    filter: '<path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.48 12.89 17 22l-5-3-5 3 1.52-9.11"/>',
    "external-link": '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14 21 3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    undo: '<path d="M3 7v6h6"/><path d="M3.51 13a9 9 0 1 0 2.13-9.36L3 7"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    type: '<path d="M4 7V5h16v2M9 19h6M12 5v14"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="1" fill="currentColor" stroke="none"/><path d="M12 21a3 3 0 0 1 0-6 2 2 0 0 0 2-2 2 2 0 0 1 2-2 3 3 0 0 0 0-6"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    "corner-down-right": '<path d="M15 10l5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>',
    dumbbell: '<path d="M6.5 6.5 17.5 17.5M21 21l-1-1M3 3l1 1M18 22l4-4M2 6l4-4"/><path d="m6.5 6.5-2 2 3 3-1 1 4 4 1-1 3 3 2-2"/>'
  };

  function buildSprite() {
    var parts = ['<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">'];
    for (var name in ICONS) {
      if (Object.prototype.hasOwnProperty.call(ICONS, name)) {
        parts.push('<symbol id="i-' + name + '" viewBox="0 0 24 24">' + ICONS[name] + "</symbol>");
      }
    }
    parts.push("</svg>");
    return parts.join("");
  }

  function injectSprite() {
    if (document.getElementById("aurora-sprite")) return;
    var host = document.createElement("div");
    host.id = "aurora-sprite";
    host.hidden = true;
    host.innerHTML = buildSprite();
    document.body.insertBefore(host, document.body.firstChild);
  }

  /* ---- 2. THEME -------------------------------------------------------- */
  var STORE_KEY = "aurora-theme";
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") || "dark";
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem(STORE_KEY, theme); } catch (e) {}
    document.querySelectorAll("[data-theme-toggle]").forEach(function (btn) {
      var useEl = btn.querySelector("use");
      if (useEl) useEl.setAttribute("href", theme === "dark" ? "#i-sun" : "#i-moon");
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    });
  }
  function initTheme() {
    var saved;
    try { saved = localStorage.getItem(STORE_KEY); } catch (e) {}
    var initial = saved || document.documentElement.getAttribute("data-theme") ||
      document.documentElement.getAttribute("data-default-theme") || "dark";
    applyTheme(initial);
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-theme-toggle]");
      if (!t) return;
      applyTheme(currentTheme() === "dark" ? "light" : "dark");
    });
  }

  /* ---- 3. TABS --------------------------------------------------------- */
  // Supports two layouts, and nesting of both:
  //   • wrapper:   [data-tabs] contains BOTH the tabs and the panels.
  //   • tabbar:    [data-tabs] is the tab strip; panels are its SIBLINGS
  //                (e.g. .doc-tabbar with <section data-tabpanel> after it).
  // A group only ever controls the tabs/panels in its own scope, so a live
  // tab demo nested inside a panel keeps working independently.
  function initTabs() {
    document.querySelectorAll("[data-tabs]").forEach(function (group) {
      var tabs = Array.prototype.filter.call(
        group.querySelectorAll("[data-tab]"),
        function (t) { return t.closest("[data-tabs]") === group; }
      );
      // Panels live inside the group (wrapper) or beside it (tabbar).
      var hasInner = !!group.querySelector("[data-tabpanel]");
      var container = hasInner ? group : (group.parentElement || group);
      var scope = hasInner ? group : (group.parentElement ? group.parentElement.closest("[data-tabs]") : null);
      var panels = Array.prototype.filter.call(
        container.querySelectorAll("[data-tabpanel]"),
        function (p) { return p.closest("[data-tabs]") === scope; }
      );
      tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          var name = tab.getAttribute("data-tab");
          tabs.forEach(function (t) { t.classList.toggle("is-active", t === tab); });
          panels.forEach(function (p) { p.hidden = p.getAttribute("data-tabpanel") !== name; });
        });
      });
    });
  }

  /* ---- 4. COPY-CODE ---------------------------------------------------- */
  function initCopy() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-copy]");
      if (!btn) return;
      var sel = btn.getAttribute("data-copy");
      var src = sel ? document.querySelector(sel) : btn.closest(".doc-code");
      var text = src ? (src.innerText || src.textContent) : "";
      var done = function () {
        var label = btn.querySelector("[data-copy-label]") || btn;
        var prev = label.textContent;
        label.textContent = "Copied";
        setTimeout(function () { label.textContent = prev; }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var ta = document.createElement("textarea");
        ta.value = text; document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (err) {}
        document.body.removeChild(ta); done();
      }
    });
  }

  /* ---- 5. DIALOGS / SHEETS -------------------------------------------- */
  function openOverlay(id) {
    var el = document.getElementById(id);
    if (el) { el.hidden = false; el.classList.add("is-open"); }
  }
  function closeOverlay(el) {
    if (el) { el.hidden = true; el.classList.remove("is-open"); }
  }
  function initDialogs() {
    document.addEventListener("click", function (e) {
      var opener = e.target.closest("[data-dialog-open]");
      if (opener) { openOverlay(opener.getAttribute("data-dialog-open")); return; }
      var closer = e.target.closest("[data-dialog-close]");
      if (closer) { closeOverlay(closer.closest(".au-scrim, .au-sheet-scrim")); return; }
      var scrim = e.target;
      if (scrim.classList && (scrim.classList.contains("au-scrim") || scrim.classList.contains("au-sheet-scrim"))) {
        closeOverlay(scrim);
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        document.querySelectorAll(".au-scrim.is-open, .au-sheet-scrim.is-open").forEach(closeOverlay);
      }
    });
  }

  /* ---- 6. TOASTS ------------------------------------------------------- */
  function ensureToastRegion() {
    var region = document.querySelector(".au-toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "au-toast-region";
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      document.body.appendChild(region);
    }
    return region;
  }
  function toast(message, opts) {
    opts = opts || {};
    var type = opts.type || "success";
    var icons = { success: "check-circle", error: "alert-circle", info: "info" };
    var region = ensureToastRegion();
    var el = document.createElement("div");
    el.className = "au-toast au-toast--" + type;
    el.innerHTML =
      '<svg class="au-icon au-toast-icon"><use href="#i-' + (icons[type] || "info") + '"></use></svg>' +
      '<span class="au-toast-msg"></span>';
    el.querySelector(".au-toast-msg").textContent = message;
    if (opts.action) {
      var b = document.createElement("button");
      b.className = "au-toast-action";
      b.textContent = opts.action;
      b.addEventListener("click", function () { if (opts.onAction) opts.onAction(); el.remove(); });
      el.appendChild(b);
    }
    region.appendChild(el);
    var life = opts.duration || 3600;
    setTimeout(function () {
      el.style.transition = "opacity .3s, transform .3s";
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      setTimeout(function () { el.remove(); }, 300);
    }, life);
  }
  function initToastTriggers() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-toast]");
      if (!t) return;
      toast(t.getAttribute("data-toast"), {
        type: t.getAttribute("data-toast-type") || "success",
        action: t.getAttribute("data-toast-action") || null
      });
    });
  }

  /* ---- 7. GAUGE SWEEP + COUNT-UP -------------------------------------- */
  var reduceMotion = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
    /(^|[?&])static\b/.test(location.search) || location.hash === "#static";

  function animateGauges() {
    document.querySelectorAll(".au-gauge[data-value]").forEach(function (g) {
      var arc = g.querySelector(".au-gauge-arc");
      if (!arc) return;
      var pct = Math.max(0, Math.min(100, parseFloat(g.getAttribute("data-value")) || 0));
      var r = parseFloat(arc.getAttribute("r"));
      var sweep = parseFloat(g.getAttribute("data-sweep") || "360"); // arc span in degrees
      var circ = 2 * Math.PI * r;
      var trackLen = circ * (sweep / 360);
      // Draw exactly `trackLen` of the path from its start, then a full gap.
      var dash = trackLen + " " + (circ + 1);
      var track = g.querySelector(".au-gauge-track");
      if (track) { track.style.strokeDasharray = dash; track.style.strokeDashoffset = 0; }
      arc.style.strokeDasharray = dash;
      var empty = trackLen;                       // offset that hides the arc
      var target = trackLen * (1 - pct / 100);     // offset that reveals `pct`
      arc.style.strokeDashoffset = empty;
      if (reduceMotion) { arc.style.transition = "none"; arc.style.strokeDashoffset = target; }
      else { requestAnimationFrame(function () { requestAnimationFrame(function () { arc.style.strokeDashoffset = target; }); }); }
    });
  }

  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-countup"));
    if (isNaN(target)) return;
    var decimals = parseInt(el.getAttribute("data-decimals") || "1", 10);
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduceMotion) { el.textContent = target.toFixed(decimals) + suffix; return; }
    var dur = 1000, start = null, from = 0;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (from + (target - from) * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function initCountUps() {
    document.querySelectorAll("[data-countup]").forEach(countUp);
  }

  /* ---- 8. CHART DRAW-IN ------------------------------------------------ */
  function initChartDraw() {
    document.querySelectorAll(".au-chart-draw").forEach(function (path) {
      try {
        var len = path.getTotalLength();
        path.style.setProperty("--_len", len);
      } catch (e) {}
    });
  }

  /* ---- BOOT ------------------------------------------------------------ */
  function boot() {
    injectSprite();
    initTheme();
    initTabs();
    initCopy();
    initDialogs();
    initToastTriggers();
    initChartDraw();
    initCountUps();
    animateGauges();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.Aurora = {
    toast: toast,
    setTheme: applyTheme,
    openDialog: openOverlay,
    closeDialog: function (id) { closeOverlay(document.getElementById(id)); },
    refreshGauges: animateGauges
  };
})();
