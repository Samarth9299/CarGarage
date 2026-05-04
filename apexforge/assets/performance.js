(function () {
  const { qs, qsa, toast, readBuilds, writeBuilds } = window.DG;
  const { mountVehiclePicker, vehicleLabel, findVehicleById } = window.DG_UI;
  const { mods, dyno } = window.DG_DATA;
  const { applyModsToVehicle, estimatePerformance } = window.DG_PERF;

  const modListEl = qs("[data-mod-list]");
  const selectedCountEl = qs("[data-selected-count]");
  const btnClear = qs("[data-clear-mods]");
  const btnReset = qs("[data-reset]");
  const btnSave = qs("[data-save-to-garage]");

  const pickerRoot = qs("[data-vehicle-form]");
  const picker = mountVehiclePicker(pickerRoot, { persistLast: true });

  const chart = (() => {
    const canvas = qs("#dynoChart");
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");

    function resizeToDisplaySize() {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      return { dpr, w, h };
    }

    function draw({ stock, tuned, mode = "hp", label }) {
      const { w, h } = resizeToDisplaySize();
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = "rgba(0,0,0,.18)";
      ctx.fillRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = "rgba(255,255,255,.07)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= 10; x++) {
        const xx = (x / 10) * w;
        ctx.beginPath();
        ctx.moveTo(xx, 0);
        ctx.lineTo(xx, h);
        ctx.stroke();
      }
      for (let y = 0; y <= 6; y++) {
        const yy = (y / 6) * h;
        ctx.beginPath();
        ctx.moveTo(0, yy);
        ctx.lineTo(w, yy);
        ctx.stroke();
      }

      const series = [];
      if (mode === "hp" || mode === "both") {
        series.push({ key: "hp", stockColor: "rgba(0,229,255,.70)", tunedColor: "rgba(0,229,255,.98)" });
      }
      if (mode === "tq" || mode === "both") {
        series.push({ key: "tq", stockColor: "rgba(255,191,60,.70)", tunedColor: "rgba(255,42,42,.98)" });
      }

      // Determine y max across visible series
      let yMax = 1;
      series.forEach((s) => {
        const maxStock = Math.max(...stock.map((p) => p[s.key] || 0));
        const maxTuned = Math.max(...tuned.map((p) => p[s.key] || 0));
        yMax = Math.max(yMax, maxStock, maxTuned);
      });
      yMax *= 1.12;

      function xFor(rpm, rpmMin, rpmMax) {
        return ((rpm - rpmMin) / (rpmMax - rpmMin)) * (w - 44) + 34;
      }

      function yFor(val) {
        return h - 28 - (val / yMax) * (h - 52);
      }

      const rpmMin = stock[0]?.rpm ?? 2000;
      const rpmMax = stock[stock.length - 1]?.rpm ?? 7000;

      // Axis labels
      ctx.fillStyle = "rgba(231,238,252,.75)";
      ctx.font = `${Math.round(w / 60)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
      ctx.fillText("RPM", 12, h - 10);
      ctx.fillText(label || "", 12, 18);

      function drawLine(points, key, strokeStyle, lineWidth) {
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        points.forEach((p, idx) => {
          const x = xFor(p.rpm, rpmMin, rpmMax);
          const y = yFor(p[key]);
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
      }

      // Draw stock vs tuned per series
      series.forEach((s) => {
        drawLine(stock, s.key, s.stockColor, 2);
        drawLine(tuned, s.key, s.tunedColor, 3);
      });

      // Legend (mode-aware)
      const lx = w - 250;
      const ly = 14;
      const legendItems = [];
      if (mode === "both") {
        const hpS = series.find((s) => s.key === "hp");
        const tqS = series.find((s) => s.key === "tq");
        if (hpS) {
          legendItems.push({ label: "HP stock", color: hpS.stockColor });
          legendItems.push({ label: "HP modified", color: hpS.tunedColor });
        }
        if (tqS) {
          legendItems.push({ label: "TQ stock", color: tqS.stockColor });
          legendItems.push({ label: "TQ modified", color: tqS.tunedColor });
        }
      } else {
        const s = series[0];
        const tag = mode === "tq" ? "TQ" : "HP";
        legendItems.push({ label: `${tag} stock`, color: s.stockColor });
        legendItems.push({ label: `${tag} modified`, color: s.tunedColor });
      }

      const lh = 18;
      const boxH = 12 + legendItems.length * lh;
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(lx, ly, 236, boxH);
      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.strokeRect(lx, ly, 236, boxH);

      ctx.fillStyle = "rgba(231,238,252,.80)";
      legendItems.forEach((it, idx) => {
        const y = ly + 22 + idx * lh;
        ctx.strokeStyle = it.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(lx + 12, y - 4);
        ctx.lineTo(lx + 30, y - 4);
        ctx.stroke();
        ctx.fillText(it.label, lx + 38, y);
      });
    }

    return { draw };
  })();

  let selectedModIds = [];
  let chartMode = "hp";

  function isPerformanceMod(mod) {
    return String(mod.id).startsWith("perf-");
  }

  function vehicleTypeMods(vehicle) {
    if (!vehicle) return [];
    return mods.filter((m) => isPerformanceMod(m) && (m.type || []).includes(vehicle.type));
  }

  function safeParseNumber(str) {
    const n = Number(String(str || "").replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function buildCurveFromVehicle(vehicle, hp, tqNm) {
    // Curve generator for vehicles without sample dyno data.
    const points = [];
    const rpmMin = 2000;
    const rpmMax = vehicle.redlineRpm || 7000;
    const steps = 22;
    for (let i = 0; i <= steps; i++) {
      const rpm = Math.round(rpmMin + (i * (rpmMax - rpmMin)) / steps);
      const t = (rpm - rpmMin) / (rpmMax - rpmMin);
      const shape = Math.sin(Math.PI * t) * 0.92 + 0.08;
      const hpPt = hp * (0.78 + 0.22 * shape);
      const tqPt = tqNm * (0.82 + 0.18 * (1 - t * 0.7));
      points.push({ rpm, hp: Math.round(hpPt), tq: Math.round(tqPt) });
    }
    return points;
  }

  function getCurves(vehicle, hp, tqNm) {
    const entry = dyno[vehicle.id];
    if (entry?.stock && entry?.stage1 && selectedModIds.length > 0) {
      return { stock: entry.stock, tuned: entry.stage1 };
    }
    if (entry?.stock) {
      return { stock: entry.stock, tuned: buildCurveFromVehicle(vehicle, hp, tqNm) };
    }
    const stock = buildCurveFromVehicle(vehicle, vehicle.stockHp, vehicle.stockTqNm);
    const tuned = buildCurveFromVehicle(vehicle, hp, tqNm);
    return { stock, tuned };
  }

  function renderMods(vehicle) {
    if (!modListEl) return;
    const list = vehicleTypeMods(vehicle);
    modListEl.innerHTML = "";
    list.forEach((m) => {
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
          <div class="card__meta">
            <span class="pill"></span>
            <span class="pill"></span>
            <span class="pill"></span>
          </div>
        </div>
        <div class="row__right">
          <label class="pill" style="cursor:pointer">
            <input type="checkbox" style="accent-color: var(--accent2)" />
            Include
          </label>
          <button class="btn btn--ghost" type="button">Add to Garage</button>
        </div>
      `;
      qs(".row__title", row).textContent = m.name;
      qs(".row__sub", row).textContent = `${m.category} · Gains: +${m.estimatedGainHp} hp / +${m.estimatedGainTqNm} Nm · ${m.complexity}`;
      const pills = qsa(".pill", qs(".card__meta", row));
      pills[0].textContent = m.category;
      pills[1].textContent = `Legality: ${m.legality}`;
      pills[2].textContent = `Safety: ${m.safety}`;
      const chk = qs('input[type="checkbox"]', row);
      chk.checked = selectedModIds.includes(m.id);
      chk.addEventListener("change", () => {
        if (chk.checked) selectedModIds = Array.from(new Set([...selectedModIds, m.id]));
        else selectedModIds = selectedModIds.filter((id) => id !== m.id);
        sync();
      });
      const addBtn = qsa("button", row)[0];
      addBtn.addEventListener("click", () => {
        addModsToGarage(vehicle, [m.id]);
      });
      modListEl.appendChild(row);
    });
  }

  function addModsToGarage(vehicle, modIds) {
    const builds = readBuilds();
    const now = new Date().toISOString();
    let build = builds.find((b) => b.vehicleId === vehicle.id);
    if (!build) {
      build = {
        id: `bld_${Math.random().toString(16).slice(2)}_${Date.now()}`,
        name: `Build — ${vehicleLabel(vehicle)}`,
        vehicleId: vehicle.id,
        usage: "street",
        selectedModIds: [],
        notes: "",
        createdAt: now,
        updatedAt: now,
      };
      builds.unshift(build);
    }
    build.selectedModIds = Array.from(new Set([...(build.selectedModIds || []), ...(modIds || [])]));
    build.updatedAt = now;
    writeBuilds(builds);
    toast("Garage updated", `Added ${modIds.length} mod(s) to ${build.name}.`);
  }

  function updateSelectedCount() {
    if (selectedCountEl) selectedCountEl.textContent = String(selectedModIds.length);
  }

  function getSimInputs(vehicle) {
    const tyre = qs('[data-sim="tyre"]')?.value || "street";
    const surface = qs('[data-sim="surface"]')?.value || "dry";
    const launch = qs('[data-sim="launch"]')?.value || "normal";
    const weightOverride = safeParseNumber(qs('[data-sim="weight"]')?.value);
    const weightKg = weightOverride || vehicle.weightKg;
    return { tyre, surface, launch, weightKg };
  }

  function updateSimOutputs(vehicle, hp, tqNm) {
    const inputs = getSimInputs(vehicle);
    const est = estimatePerformance({ vehicle, hp, tqNm, weightKg: inputs.weightKg, tyre: inputs.tyre, surface: inputs.surface, launch: inputs.launch });
    qs('[data-out="0100"]')?.replaceChildren(document.createTextNode(String(est.zeroTo100Sec)));
    qs('[data-out="qm"]')?.replaceChildren(document.createTextNode(String(est.quarterMileSec)));
    qs('[data-out="trap"]')?.replaceChildren(document.createTextNode(String(est.trapSpeedKph)));
    qs('[data-out="breakdown"]')?.replaceChildren(
      document.createTextNode(`${est.tractionLimitedPct}% traction-limited / ${est.powerLimitedPct}% power-limited`),
    );
  }

  function sync() {
    const vehicle = picker.getValue() || findVehicleById(window.DG?.getLastVehicle?.() || "");
    if (!vehicle) return;
    updateSelectedCount();
    renderMods(vehicle);

    const { hp, tqNm } = applyModsToVehicle(vehicle, selectedModIds);
    const curves = getCurves(vehicle, hp, tqNm);
    chart?.draw({ stock: curves.stock, tuned: curves.tuned, mode: chartMode, label: vehicleLabel(vehicle) });
    updateSimOutputs(vehicle, hp, tqNm);
  }

  // Chart mode toggles
  qsa("[data-chart-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      qsa("[data-chart-mode]").forEach((b) => b.setAttribute("aria-selected", "false"));
      btn.setAttribute("aria-selected", "true");
      chartMode = btn.getAttribute("data-chart-mode") || "hp";
      sync();
    });
  });

  // Inputs that affect simulation
  qsa("[data-sim]").forEach((el) => {
    el.addEventListener("input", () => sync());
    el.addEventListener("change", () => sync());
  });

  btnClear?.addEventListener("click", () => {
    selectedModIds = [];
    sync();
    toast("Selection cleared", "Back to baseline. Pick upgrades to see deltas.");
  });

  btnReset?.addEventListener("click", () => {
    selectedModIds = [];
    window.DG?.saveLastVehicle?.("");
    window.location.reload();
  });

  btnSave?.addEventListener("click", () => {
    const vehicle = picker.getValue();
    if (!vehicle) {
      toast("Select a vehicle", "Choose make/model/year before saving.");
      return;
    }
    if (selectedModIds.length === 0) {
      toast("No mods selected", "Select at least one upgrade before saving.");
      return;
    }
    addModsToGarage(vehicle, selectedModIds);
  });

  // Sync on picker changes
  qsa("[data-vehicle]").forEach((el) => {
    el.addEventListener("change", () => {
      selectedModIds = [];
      sync();
    });
  });

  window.addEventListener("resize", () => sync(), { passive: true });
  sync();
})();
