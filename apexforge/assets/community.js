(function () {
  const { qs, toast, readBuilds } = window.DG;
  const { findVehicleById, vehicleLabel } = window.DG_UI;
  const { applyModsToVehicle, estimatePerformance } = window.DG_PERF;

  const host = qs("[data-your-builds]");
  if (!host) return;

  const builds = readBuilds();
  if (!builds.length) {
    const n = document.createElement("div");
    n.className = "notice";
    n.style.gridColumn = "1 / -1";
    n.innerHTML = `<strong>No local builds yet.</strong> Create one in <a href="garage.html">Garage</a>.`;
    host.appendChild(n);
    return;
  }

  builds.slice(0, 6).forEach((b) => {
    const v = findVehicleById(b.vehicleId);
    const card = document.createElement("a");
    card.className = "card";
    card.href = `garage.html?build=${encodeURIComponent(b.id)}`;
    card.innerHTML = `<div class="card__pad">
      <div class="card__title"></div>
      <div class="card__desc"></div>
      <div class="card__meta">
        <span class="pill"></span>
        <span class="pill"></span>
        <span class="pill"></span>
      </div>
      <div class="card__link">Open build →</div>
    </div>`;
    qs(".card__title", card).textContent = b.name || "Untitled build";
    const desc = v ? `${vehicleLabel(v)} · ${b.selectedModIds?.length || 0} mods` : "Unknown vehicle";
    qs(".card__desc", card).textContent = desc;
    if (v) {
      const applied = applyModsToVehicle(v, b.selectedModIds || []);
      const est = estimatePerformance({ vehicle: v, hp: applied.hp, tqNm: applied.tqNm, weightKg: v.weightKg, tyre: "street", surface: "dry", launch: "normal" });
      const pills = card.querySelectorAll(".pill");
      pills[0].textContent = `${applied.hp} hp`;
      pills[1].textContent = `${est.zeroTo100Sec}s 0–100`;
      pills[2].textContent = v.type.toUpperCase();
    }
    host.appendChild(card);
  });

  toast("Community", "Showing local builds as private previews. Public profiles are a roadmap feature.");
})();

