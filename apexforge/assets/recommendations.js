(function () {
  const { qs, qsa, toast, readBuilds, writeBuilds } = window.DG;
  const { mods } = window.DG_DATA;
  const { mountVehiclePicker, vehicleLabel } = window.DG_UI;
  const { applyModsToVehicle, estimatePerformance } = window.DG_PERF;

  const form = qs("[data-rec-form]");
  const pickerRoot = qs("[data-vehicle-form]");
  const picker = mountVehiclePicker(pickerRoot, { persistLast: true });

  const empty = qs("[data-rec-empty]");
  const results = qs("[data-rec-results]");
  const list = qs("[data-rec-list]");
  const btnSave = qs("[data-save-rec]");

  const outHp = qs('[data-rec-metric="hp"]');
  const outTq = qs('[data-rec-metric="tq"]');
  const out0100 = qs('[data-rec-metric="0100"]');

  let lastPlan = null;

  function scoreMod(mod, { vehicle, usage, priority, budget, compliance }) {
    // Base relevance by priority
    const cat = String(mod.category || "").toLowerCase();
    const isPerf = String(mod.id).startsWith("perf-");
    const isAest = String(mod.id).startsWith("aest-");

    let score = 0;
    if (priority === "power") score += /engine|intake|exhaust|powertrain/.test(cat) ? 32 : 6;
    if (priority === "handling") score += /suspension|handling|tyres|wheels/.test(cat) ? 30 : 6;
    if (priority === "looks") score += isAest ? 30 : 8;
    if (priority === "balanced") score += isPerf ? 18 : 14;

    // Usage weighting
    if (usage === "track") {
      score += /brakes|suspension|tyres/.test(cat) ? 18 : 0;
      score += /engine|intake|exhaust/.test(cat) ? 8 : 0;
    }
    if (usage === "touring") {
      score += /ppf|wrap|lighting/.test(cat) ? 12 : 0;
      score += /brakes|tyres/.test(cat) ? 8 : 0;
    }

    // Complexity vs budget
    const cx = String(mod.complexity || "Medium").toLowerCase();
    if (budget === "low") score += cx === "low" ? 12 : cx === "medium" ? 4 : -10;
    if (budget === "mid") score += cx === "high" ? -2 : 6;
    if (budget === "high") score += cx === "high" ? 10 : 6;

    // Compliance filter
    const leg = String(mod.legality || "").toLowerCase();
    if (compliance === "strict") score += /restricted/.test(leg) ? -18 : 8;
    if (compliance === "mixed") score += /restricted/.test(leg) ? -6 : 6;
    if (compliance === "track") score += /restricted/.test(leg) ? 10 : 4;

    // Platform fit
    if (!(mod.type || []).includes(vehicle.type)) return -999;

    // Reward supporting mods in track usage
    if (usage === "track" && /brakes/.test(cat)) score += 10;
    if (usage === "track" && /tyres/.test(cat)) score += 10;

    // Mild penalty for "power only" without support
    if (priority === "power" && /engine|intake|exhaust/.test(cat) && usage !== "track") score += 4;

    return score;
  }

  function buildPlan({ vehicle, usage, priority, budget, compliance }) {
    const eligible = mods.filter((m) => (m.type || []).includes(vehicle.type));
    const scored = eligible
      .map((m) => ({ m, s: scoreMod(m, { vehicle, usage, priority, budget, compliance }) }))
      .filter((x) => x.s > -100)
      .sort((a, b) => b.s - a.s);

    const top = scored.slice(0, budget === "low" ? 4 : budget === "high" ? 7 : 6).map((x) => x.m);
    const stage1 = top.slice(0, Math.min(3, top.length));
    const stage2 = top.slice(stage1.length, Math.min(stage1.length + 2, top.length));
    const stage3 = top.slice(stage1.length + stage2.length);

    return {
      selectedModIds: top.map((m) => m.id),
      stages: [
        {
          name: "Stage 0 — Baseline",
          desc: "Fluids, tyres, brake pads, alignment, datalog readiness. (Checklist content is a future module.)",
          items: [],
        },
        {
          name: "Stage 1 — Foundation",
          desc: "Safe, high-signal changes with the best ‘feel per dollar’.",
          items: stage1,
        },
        {
          name: "Stage 2 — Focus",
          desc: "Priority-driven upgrades with increased complexity and dependency risk.",
          items: stage2,
        },
        {
          name: "Stage 3 — Signature",
          desc: "Aesthetic or high-complexity options to finish the build identity.",
          items: stage3,
        },
      ],
    };
  }

  function renderPlan({ vehicle, plan, usage }) {
    empty.style.display = "none";
    results.style.display = "block";
    list.innerHTML = "";

    const applied = applyModsToVehicle(vehicle, plan.selectedModIds);
    outHp.textContent = String(applied.hp);
    outTq.textContent = String(applied.tqNm);
    const tyre = usage === "track" ? "track" : usage === "touring" ? "touring" : "street";
    const est = estimatePerformance({
      vehicle,
      hp: applied.hp,
      tqNm: applied.tqNm,
      weightKg: vehicle.weightKg,
      tyre,
      surface: "dry",
      launch: usage === "track" ? "aggressive" : "normal",
    });
    out0100.textContent = String(est.zeroTo100Sec);

    plan.stages.forEach((stage) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card__pad">
          <div class="card__title"></div>
          <div class="card__desc"></div>
          <div style="height:12px"></div>
          <div class="list"></div>
        </div>
      `;
      qs(".card__title", card).textContent = stage.name;
      qs(".card__desc", card).textContent = stage.desc;

      const l = qs(".list", card);
      if (!stage.items || stage.items.length === 0) {
        const n = document.createElement("div");
        n.className = "notice";
        n.textContent = "No specific parts in this prototype stage (baseline checklist only).";
        l.appendChild(n);
      } else {
        stage.items.forEach((m) => {
          const row = document.createElement("div");
          row.className = "row";
          row.style.padding = "10px 12px";
          row.style.borderRadius = "18px";
          row.style.border = "1px solid rgba(255,255,255,.08)";
          row.style.background = "rgba(255,255,255,.03)";
          row.innerHTML = `
            <div class="row__left">
              <div class="row__title"></div>
              <div class="row__sub"></div>
            </div>
            <div class="row__right">
              <span class="pill"></span>
            </div>
          `;
          qs(".row__title", row).textContent = m.name;
          qs(".row__sub", row).textContent = `${m.category} · ${m.complexity} · Legality: ${m.legality}`;
          qs(".pill", row).textContent = m.id.startsWith("perf-") ? `+${m.estimatedGainHp} hp` : "Aesthetic";
          l.appendChild(row);
        });
      }
      list.appendChild(card);
    });
  }

  function savePlanToGarage(vehicle, usage, plan) {
    const now = new Date().toISOString();
    const build = {
      id: `bld_${Math.random().toString(16).slice(2)}_${Date.now()}`,
      name: `Plan — ${vehicleLabel(vehicle)} (${usage})`,
      vehicleId: vehicle.id,
      usage,
      selectedModIds: plan.selectedModIds,
      notes: "Generated from Recommendations (prototype). Validate legality/safety and confirm fitment.",
      createdAt: now,
      updatedAt: now,
    };
    const builds = readBuilds();
    builds.unshift(build);
    writeBuilds(builds);
    toast("Saved to Garage", "Recommendation plan saved as a new build.");
    window.location.href = `garage.html?build=${encodeURIComponent(build.id)}`;
  }

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const vehicle = picker.getValue();
    if (!vehicle) {
      toast("Select a vehicle", "Choose make/model/year before generating recommendations.");
      return;
    }
    const usage = form.usage.value || "street";
    const priority = form.priority.value || "balanced";
    const budget = form.budget.value || "mid";
    const compliance = form.compliance.value || "strict";
    const plan = buildPlan({ vehicle, usage, priority, budget, compliance });
    lastPlan = { vehicle, usage, plan };
    renderPlan({ vehicle, plan, usage });
    btnSave.disabled = false;
    toast("Plan generated", "Review stages, then save to Garage when ready.");
  });

  btnSave?.addEventListener("click", () => {
    if (!lastPlan) return;
    savePlanToGarage(lastPlan.vehicle, lastPlan.usage, lastPlan.plan);
  });
})();

