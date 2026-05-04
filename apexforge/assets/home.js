(function () {
  const { qs, toast, readBuilds, writeBuilds } = window.DG;
  const { mountVehiclePicker, vehicleLabel } = window.DG_UI;

  const form = qs("[data-vehicle-form]");
  const pickerRoot = form;
  const picker = mountVehiclePicker(pickerRoot, { persistLast: true });

  function createOrOpenBuild(vehicle) {
    const builds = readBuilds();
    const existing = builds.find((b) => b.vehicleId === vehicle.id);
    if (existing) {
      toast("Garage", `Opened existing build for ${vehicleLabel(vehicle)}.`);
      window.location.href = `garage.html?build=${encodeURIComponent(existing.id)}`;
      return;
    }
    const now = new Date().toISOString();
    const build = {
      id: `bld_${Math.random().toString(16).slice(2)}_${Date.now()}`,
      name: `My Build — ${vehicleLabel(vehicle)}`,
      vehicleId: vehicle.id,
      usage: "street",
      selectedModIds: [],
      notes: "",
      createdAt: now,
      updatedAt: now,
    };
    builds.unshift(build);
    writeBuilds(builds);
    toast("Garage", `Build created for ${vehicleLabel(vehicle)}.`);
    window.location.href = `garage.html?build=${encodeURIComponent(build.id)}`;
  }

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = picker.getValue();
    if (!v) {
      toast("Select a vehicle", "Choose make, model, and year to create a build.");
      return;
    }
    createOrOpenBuild(v);
  });

  qs("[data-start-demo]")?.addEventListener("click", () => {
    window.location.href = "performance.html";
  });
})();

