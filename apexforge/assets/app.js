(function () {
  const STORAGE = {
    theme: "dg_theme",
    lastVehicle: "dg_last_vehicle",
    builds: "dg_builds_v1",
  };

  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE.theme, theme);
    } catch {}
  }

  function initTheme() {
    const saved = (() => {
      try {
        return localStorage.getItem(STORAGE.theme);
      } catch {
        return null;
      }
    })();
    const theme = saved || "dark";
    setTheme(theme);
    const btn = qs("[data-theme-toggle]");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "motorsport" : "dark";
      setTheme(next);
      toast("Theme", next === "motorsport" ? "Motorsport accent engaged." : "Dark mode engaged.");
    });
  }

  function initMotorsportThemeTokens() {
    // Slightly different accent profile without a separate stylesheet.
    const style = document.createElement("style");
    style.textContent = `
      :root[data-theme="motorsport"]{
        --accent:#ff2a2a;
        --accent2:#00e5ff;
        --surface:rgba(255,255,255,.07);
        --surface2:rgba(255,255,255,.10);
        --grid:rgba(0,229,255,.06);
      }
    `;
    document.head.appendChild(style);
  }

  function initDrawer() {
    const openBtn = qs("[data-drawer-open]");
    const drawer = qs("[data-drawer]");
    const closeBtn = qs("[data-drawer-close]");
    if (!openBtn || !drawer || !closeBtn) return;

    function setOpen(isOpen) {
      drawer.setAttribute("aria-hidden", isOpen ? "false" : "true");
      if (isOpen) {
        closeBtn.focus();
      } else {
        openBtn.focus();
      }
    }

    openBtn.addEventListener("click", () => setOpen(true));
    closeBtn.addEventListener("click", () => setOpen(false));
    drawer.addEventListener("click", (e) => {
      if (e.target === drawer) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  function toast(title, msg, timeoutMs = 3400) {
    let host = qs(".toastHost");
    if (!host) {
      host = document.createElement("div");
      host.className = "toastHost";
      document.body.appendChild(host);
    }

    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<div class="toast__title"></div><div class="toast__msg"></div>`;
    qs(".toast__title", el).textContent = title;
    qs(".toast__msg", el).textContent = msg;
    host.appendChild(el);

    const t = setTimeout(() => el.remove(), timeoutMs);
    el.addEventListener("click", () => {
      clearTimeout(t);
      el.remove();
    });
  }

  function initCommandPalette() {
    const openBtn = qs("[data-cmdk-open]");
    const modal = qs("[data-cmdk]");
    const input = qs("[data-cmdk-input]");
    const list = qs("[data-cmdk-list]");
    const closeBtn = qs("[data-cmdk-close]");
    if (!modal || !input || !list) return;

    const items = [
      { label: "Home", hint: "Digital Garage", href: "index.html" },
      { label: "Performance Lab", hint: "Tuning + dyno + simulations", href: "performance.html" },
      { label: "Aesthetic Studio", hint: "Configurator + design tools", href: "aesthetic.html" },
      { label: "Digital Garage", hint: "Saved builds", href: "garage.html" },
      { label: "Recommendations", hint: "Goal-based build paths", href: "recommendations.html" },
      { label: "Community", hint: "Showcase + creators", href: "community.html" },
      { label: "Knowledge Base", hint: "Guides + compliance", href: "knowledge.html" },
      { label: "Legal & Compliance", hint: "Safety notes", href: "legal.html" },
    ];

    function setOpen(isOpen) {
      modal.setAttribute("aria-hidden", isOpen ? "false" : "true");
      if (isOpen) {
        input.value = "";
        render("");
        setTimeout(() => input.focus(), 0);
      } else {
        openBtn?.focus();
      }
    }

    function render(query) {
      const q = query.trim().toLowerCase();
      const filtered = items.filter((it) => (it.label + " " + it.hint).toLowerCase().includes(q));
      list.innerHTML = "";
      filtered.slice(0, 10).forEach((it, idx) => {
        const a = document.createElement("a");
        a.href = it.href;
        a.className = "row";
        a.style.padding = "10px 12px";
        a.style.borderRadius = "16px";
        a.style.border = "1px solid rgba(255,255,255,.08)";
        a.style.background = "rgba(255,255,255,.04)";
        a.innerHTML = `<div class="row__left"><div class="row__title"></div><div class="row__sub"></div></div><div class="kbd">↵</div>`;
        qs(".row__title", a).textContent = it.label;
        qs(".row__sub", a).textContent = it.hint;
        a.addEventListener("click", () => setOpen(false));
        if (idx === 0) a.dataset.first = "true";
        list.appendChild(a);
      });
      if (filtered.length === 0) {
        const empty = document.createElement("div");
        empty.className = "notice";
        empty.textContent = "No results. Try “dyno”, “garage”, “wrap”.";
        list.appendChild(empty);
      }
    }

    openBtn?.addEventListener("click", () => setOpen(true));
    closeBtn?.addEventListener("click", () => setOpen(false));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) setOpen(false);
    });
    input.addEventListener("input", () => render(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = qs('[data-first="true"]', list);
        if (first && first.getAttribute("href")) {
          window.location.href = first.getAttribute("href");
        }
      }
    });
    document.addEventListener("keydown", (e) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const combo = isMac ? e.metaKey && e.key.toLowerCase() === "k" : e.ctrlKey && e.key.toLowerCase() === "k";
      if (combo) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    });
  }

  function readBuilds() {
    try {
      const raw = localStorage.getItem(STORAGE.builds);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeBuilds(builds) {
    try {
      localStorage.setItem(STORAGE.builds, JSON.stringify(builds));
    } catch {}
  }

  function saveLastVehicle(vehicleId) {
    try {
      localStorage.setItem(STORAGE.lastVehicle, vehicleId);
    } catch {}
  }

  function getLastVehicle() {
    try {
      return localStorage.getItem(STORAGE.lastVehicle);
    } catch {
      return null;
    }
  }

  window.DG = {
    STORAGE,
    qs,
    qsa,
    toast,
    readBuilds,
    writeBuilds,
    saveLastVehicle,
    getLastVehicle,
  };

  initMotorsportThemeTokens();
  initTheme();
  initDrawer();
  initCommandPalette();
})();

