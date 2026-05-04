(function () {
  const { mods } = window.DG_DATA || { mods: [] };

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function round(n, d = 0) {
    const p = 10 ** d;
    return Math.round(n * p) / p;
  }

  function modsById(ids) {
    const set = new Set(ids || []);
    return mods.filter((m) => set.has(m.id));
  }

  function sumGains(selectedMods) {
    return selectedMods.reduce(
      (acc, m) => {
        acc.hp += m.estimatedGainHp || 0;
        acc.tq += m.estimatedGainTqNm || 0;
        return acc;
      },
      { hp: 0, tq: 0 },
    );
  }

  function estimateGripFactor({ vehicle, tyre = "street", surface = "dry" }) {
    const base = vehicle.type === "bike" ? 1.04 : 1.0;
    const tyreMult = tyre === "track" ? 1.08 : tyre === "touring" ? 0.97 : 1.0;
    const surfaceMult = surface === "wet" ? 0.86 : surface === "cold" ? 0.92 : 1.0;
    // AWD tends to launch harder; bikes are traction-limited early but benefit from weight.
    const driveMult = vehicle.drivetrain === "AWD" ? 1.08 : vehicle.drivetrain === "RWD" ? 1.0 : 0.98;
    return base * tyreMult * surfaceMult * driveMult;
  }

  // Fast, explainable model: good for UI iteration. Not a substitute for track testing.
  function estimatePerformance({
    vehicle,
    hp,
    tqNm,
    weightKg,
    tyre = "street",
    surface = "dry",
    launch = "normal",
  }) {
    const w = Math.max(80, weightKg || vehicle.weightKg || 1200);
    const p = Math.max(20, hp || vehicle.stockHp || 120);
    const pw = p / (w / 1000); // hp per ton
    const grip = estimateGripFactor({ vehicle, tyre, surface });
    const launchMult = launch === "aggressive" ? 0.96 : launch === "safe" ? 1.05 : 1.0;

    // Baseline 0-100 estimate: calibrated to feel realistic across common builds.
    // Lower is better.
    let zeroTo100 = (7.4 - 0.012 * pw) / grip;
    zeroTo100 = clamp(zeroTo100, vehicle.type === "bike" ? 2.3 : 3.2, 16.5) * launchMult;

    // Quarter mile estimate (ET & trap). Very rough.
    let quarter = (14.7 - 0.0108 * pw) / Math.sqrt(grip);
    quarter = clamp(quarter, vehicle.type === "bike" ? 9.2 : 10.5, 20.0) * (launchMult * 0.985);

    const trap = clamp(145 + (pw - 200) * 0.22, 120, 290); // km/h

    // Traction vs power limitation heuristic.
    const tractionLimited = clamp((p / w) * (vehicle.type === "bike" ? 1.4 : 1.0) * 85, 0, 100);
    const powerLimited = clamp(100 - tractionLimited, 0, 100);

    return {
      zeroTo100Sec: round(zeroTo100, 1),
      quarterMileSec: round(quarter, 1),
      trapSpeedKph: round(trap, 0),
      tractionLimitedPct: round(tractionLimited, 0),
      powerLimitedPct: round(powerLimited, 0),
      notes: [
        "Estimates depend on tyres, surface, gearing, aero, and driver technique.",
        "Use dyno plots and datalogs for validation; confirm brake and cooling capacity before power gains.",
      ],
    };
  }

  function applyModsToVehicle(vehicle, modIds) {
    const selected = modsById(modIds);
    const gains = sumGains(selected);
    const hp = Math.max(0, (vehicle.stockHp || 0) + gains.hp);
    const tqNm = Math.max(0, (vehicle.stockTqNm || 0) + gains.tq);
    return { hp, tqNm, gains, selectedMods: selected };
  }

  window.DG_PERF = {
    modsById,
    applyModsToVehicle,
    estimatePerformance,
  };
})();

