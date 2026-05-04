(function () {
  const { qs, qsa, toast, readBuilds, writeBuilds } = window.DG;
  const { vehicles, mods } = window.DG_DATA;
  const { mountVehiclePicker, vehicleLabel, findVehicleById } = window.DG_UI;
  const { applyModsToVehicle, estimatePerformance, modsById } = window.DG_PERF;

  const listEl = qs("[data-build-list]");
  const editorWrap = qs("[data-build-editor]");
  const emptyEl = qs("[data-build-empty]");
  const buildSub = qs("[data-build-sub]");

  const nameEl = qs("[data-build-name]");
  const usageEl = qs("[data-build-usage]");
  const notesEl = qs("[data-build-notes]");
  const vehicleEl = qs("[data-build-vehicle]");
  const modsEl = qs("[data-build-mods]");

  const outHp = qs('[data-metric="hp"]');
  const outTq = qs('[data-metric="tq"]');
  const out0100 = qs('[data-metric="0100"]');

  const btnSave = qs("[data-build-save]");
  const btnClear = qs("[data-build-clear]");
  const btnDelete = qs("[data-build-delete]");
  const btnNew = qs("[data-new-build]");

  const newBuildRoot = qs("[data-new-build-form]");
  const newBuildForm = newBuildRoot;
  const newPicker = mountVehiclePicker(newBuildRoot, { persistLast: true });

  let selectedBuildId = null;

  function parseQuery() {
    try {
      const u = new URL(window.location.href);
      return Object.fromEntries(u.searchParams.entries());
    } catch {
      return {};
    }
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return "";
    }
  }

  function getBuilds() {
    const b = readBuilds();
    return Array.isArray(b) ? b : [];
  }

  function saveBuilds(builds) {
    writeBuilds(builds);
    renderBuildList();
  }

  function buildVehicle(build) {
    return findVehicleById(build.vehicleId);
  }

  function renderBuildList() {
    const builds = getBuilds();
    listEl.innerHTML = "";
    if (builds.length === 0) {
      const n = document.createElement("div");
      n.className = "notice";
      n.innerHTML = "<strong>No builds yet.</strong> Create a build below or start from Performance Lab.";
      listEl.appendChild(n);
      return;
    }

    builds.forEach((b) => {
      const v = buildVehicle(b);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "btn";
      card.style.width = "100%";
      card.style.justifyContent = "space-between";
      card.style.padding = "12px";
      card.style.borderRadius = "18px";
      card.style.background = "rgba(255,255,255,.03)";
      card.style.borderColor = selectedBuildId === b.id ? "rgba(0,229,255,.38)" : "rgba(255,255,255,.10)";
      card.innerHTML = `
        <div style="text-align:left">
          <div style="font-weight:850"></div>
          <div class="small"></div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <span class="pill"></span>
          <span class="pill"></span>
        </div>
      `;
      qs("div div", card).textContent = b.name || "Untitled build";
      const sub = qsa(".small", card)[0];
      sub.textContent = v ? vehicleLabel(v) : "Unknown vehicle";
      const pills = qsa(".pill", card);
      pills[0].textContent = `${(b.selectedModIds || []).length} mods`;
      pills[1].textContent = `Updated: ${formatDate(b.updatedAt || b.createdAt)}`;
      card.addEventListener("click", () => openBuild(b.id));
      listEl.appendChild(card);
    });
  }

  function renderBuildEditor(build) {
    const v = buildVehicle(build);
    if (!v) {
      buildSub.textContent = "Build has an unknown vehicle (data mismatch).";
      vehicleEl.textContent = "—";
      modsEl.innerHTML = "";
      return;
    }

    buildSub.textContent = `Editing: ${build.name || "Untitled build"}`;
    nameEl.value = build.name || "";
    usageEl.value = build.usage || "street";
    notesEl.value = build.notes || "";
    const preset = build.visualPreset;
    const presetLine = preset
      ? `<br/><span class="small">Visual preset: ${preset.finish} · ${preset.color} · wheels ${preset.wheels}${preset.aero ? " · aero" : ""}${preset.lighting ? " · lighting" : ""}</span>`
      : "";
    vehicleEl.innerHTML = `<strong>${vehicleLabel(v)}</strong> · ${v.drivetrain} · ${v.weightKg} kg · ${v.stockHp} hp / ${v.stockTqNm} Nm${presetLine}`;

    const modObjs = modsById(build.selectedModIds || []);
    modsEl.innerHTML = "";
    if (modObjs.length === 0) {
      const n = document.createElement("div");
      n.className = "notice";
      n.innerHTML = "<strong>No mods yet.</strong> Add from Performance Lab or Aesthetic Studio.";
      modsEl.appendChild(n);
    } else {
      modObjs.forEach((m) => {
        const row = document.createElement("div");
        row.className = "row";
        row.style.padding = "12px";
        row.style.borderRadius = "18px";
        row.style.border = "1px solid rgba(255,255,255,.08)";
        row.style.background = "rgba(255,255,255,.03)";
        row.innerHTML = `
          <div class="row__left">
            <div class="row__title"></div>
            <div class="row__sub"></div>
          </div>
          <div class="row__right">
            <button class="btn btn--ghost" type="button">Remove</button>
          </div>
        `;
        qs(".row__title", row).textContent = m.name;
        qs(".row__sub", row).textContent = `${m.category} · ${m.type.join("/")} · Legality: ${m.legality}`;
        qs("button", row).addEventListener("click", () => {
          build.selectedModIds = (build.selectedModIds || []).filter((id) => id !== m.id);
          build.updatedAt = new Date().toISOString();
          persist(build);
          renderBuildEditor(build);
        });
        modsEl.appendChild(row);
      });
    }

    // Metrics
    const modApplied = applyModsToVehicle(v, build.selectedModIds || []);
    outHp.textContent = String(modApplied.hp);
    outTq.textContent = String(modApplied.tqNm);

    const usage = build.usage || "street";
    const tyre = usage === "track" ? "track" : usage === "touring" ? "touring" : "street";
    const est = estimatePerformance({
      vehicle: v,
      hp: modApplied.hp,
      tqNm: modApplied.tqNm,
      weightKg: v.weightKg,
      tyre,
      surface: "dry",
      launch: usage === "track" ? "aggressive" : "normal",
    });
    out0100.textContent = String(est.zeroTo100Sec);
  }

  function openBuild(id) {
    selectedBuildId = id;
    const builds = getBuilds();
    const build = builds.find((b) => b.id === id);
    if (!build) return;
    emptyEl.style.display = "none";
    editorWrap.style.display = "block";
    renderBuildList();
    renderBuildEditor(build);
  }

  function persist(build) {
    const builds = getBuilds();
    const idx = builds.findIndex((b) => b.id === build.id);
    if (idx >= 0) builds[idx] = build;
    else builds.unshift(build);
    saveBuilds(builds);
    toast("Saved", "Build updated in your local garage.");
  }

  btnSave?.addEventListener("click", () => {
    if (!selectedBuildId) return;
    const builds = getBuilds();
    const build = builds.find((b) => b.id === selectedBuildId);
    if (!build) return;
    build.name = String(nameEl.value || "").trim() || build.name || "Untitled build";
    build.usage = usageEl.value || "street";
    build.notes = String(notesEl.value || "");
    build.updatedAt = new Date().toISOString();
    persist(build);
  });

  btnClear?.addEventListener("click", () => {
    if (!selectedBuildId) return;
    const builds = getBuilds();
    const build = builds.find((b) => b.id === selectedBuildId);
    if (!build) return;
    build.selectedModIds = [];
    build.updatedAt = new Date().toISOString();
    persist(build);
    renderBuildEditor(build);
  });

  btnDelete?.addEventListener("click", () => {
    if (!selectedBuildId) return;
    const builds = getBuilds();
    const build = builds.find((b) => b.id === selectedBuildId);
    if (!build) return;
    const ok = window.confirm(`Delete "${build.name}"? This cannot be undone in this prototype.`);
    if (!ok) return;
    const next = builds.filter((b) => b.id !== selectedBuildId);
    selectedBuildId = null;
    saveBuilds(next);
    editorWrap.style.display = "none";
    emptyEl.style.display = "block";
    buildSub.textContent = "Choose a build from the left.";
    toast("Deleted", "Build removed from local storage.");
  });

  btnNew?.addEventListener("click", () => {
    newBuildForm?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast("New build", "Pick a vehicle baseline and create a build.");
  });

  newBuildForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = newPicker.getValue();
    if (!v) {
      toast("Select a vehicle", "Choose make/model/year to create a build.");
      return;
    }
    const now = new Date().toISOString();
    const build = {
      id: `bld_${Math.random().toString(16).slice(2)}_${Date.now()}`,
      name: `Build — ${vehicleLabel(v)}`,
      vehicleId: v.id,
      usage: "street",
      selectedModIds: [],
      notes: "",
      createdAt: now,
      updatedAt: now,
    };
    const builds = getBuilds();
    builds.unshift(build);
    saveBuilds(builds);
    openBuild(build.id);
    toast("Build created", "Now add mods from Performance Lab or Aesthetic Studio.");
  });

  // Open from query param if present.
  const q = parseQuery();
  renderBuildList();
  if (q.build) {
    openBuild(q.build);
  } else {
    const builds = getBuilds();
    if (builds[0]) openBuild(builds[0].id);
  }
})();
