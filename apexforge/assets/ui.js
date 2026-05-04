(function () {
  const { qs, qsa, toast, saveLastVehicle, getLastVehicle } = window.DG || {};
  const { vehicles } = window.DG_DATA || { vehicles: [] };

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  function sortNumericAsc(a, b) {
    return Number(a) - Number(b);
  }

  function option(label, value) {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    return opt;
  }

  function vehicleLabel(v) {
    return `${v.year} ${v.make} ${v.model}`;
  }

  function findVehicleById(id) {
    return vehicles.find((v) => v.id === id) || null;
  }

  function mountVehiclePicker(root, { persistLast = true, includeAllYears = false } = {}) {
    if (!root) return { getValue: () => null, setValue: () => {} };
    const selType = qs('[data-vehicle="type"]', root);
    const selMake = qs('[data-vehicle="make"]', root);
    const selModel = qs('[data-vehicle="model"]', root);
    const selYear = qs('[data-vehicle="year"]', root);

    if (!selType || !selMake || !selModel || !selYear) return { getValue: () => null, setValue: () => {} };

    function clear(select, keepFirst = true) {
      const keep = keepFirst ? select.querySelector("option") : null;
      select.innerHTML = "";
      if (keep) select.appendChild(keep);
    }

    function setDisabled(disabled) {
      [selMake, selModel, selYear].forEach((el) => (el.disabled = disabled));
    }

    function getValue() {
      const id = String(selYear.value || "");
      return id ? findVehicleById(id) : null;
    }

    function fillMake() {
      clear(selMake);
      const type = selType.value;
      const makes = uniq(vehicles.filter((v) => v.type === type).map((v) => v.make)).sort();
      makes.forEach((m) => selMake.appendChild(option(m, m)));
      selMake.disabled = false;
    }

    function fillModel() {
      clear(selModel);
      const type = selType.value;
      const make = selMake.value;
      const models = uniq(
        vehicles.filter((v) => v.type === type && v.make === make).map((v) => v.model),
      ).sort();
      models.forEach((m) => selModel.appendChild(option(m, m)));
      selModel.disabled = false;
    }

    function fillYear() {
      clear(selYear);
      const type = selType.value;
      const make = selMake.value;
      const model = selModel.value;
      const years = vehicles
        .filter((v) => v.type === type && v.make === make && v.model === model)
        .map((v) => v.year)
        .sort(sortNumericAsc);
      years.forEach((y) => {
        const v = vehicles.find((it) => it.type === type && it.make === make && it.model === model && it.year === y);
        if (!v) return;
        selYear.appendChild(option(includeAllYears ? String(y) : vehicleLabel(v), v.id));
      });
      selYear.disabled = false;
    }

    function cascade(from) {
      if (from === "type") {
        fillMake();
        clear(selModel);
        clear(selYear);
        selModel.disabled = true;
        selYear.disabled = true;
      }
      if (from === "make") {
        fillModel();
        clear(selYear);
        selYear.disabled = true;
      }
      if (from === "model") {
        fillYear();
      }
      if (from === "year") {
        const v = getValue();
        if (v && persistLast) saveLastVehicle(v.id);
      }
    }

    selType.addEventListener("change", () => cascade("type"));
    selMake.addEventListener("change", () => cascade("make"));
    selModel.addEventListener("change", () => cascade("model"));
    selYear.addEventListener("change", () => cascade("year"));

    // Init
    setDisabled(true);
    const last = getLastVehicle();
    if (last) {
      const v = findVehicleById(last);
      if (v) {
        selType.value = v.type;
        fillMake();
        selMake.value = v.make;
        fillModel();
        selModel.value = v.model;
        fillYear();
        selYear.value = v.id;
        setDisabled(false);
        return {
          getValue,
          setValue: (id) => {
            const vv = findVehicleById(id);
            if (!vv) return;
            selType.value = vv.type;
            fillMake();
            selMake.value = vv.make;
            fillModel();
            selModel.value = vv.model;
            fillYear();
            selYear.value = vv.id;
            saveLastVehicle(vv.id);
          },
        };
      }
    }

    // Default to cars for first visit.
    selType.value = "car";
    fillMake();
    selMake.selectedIndex = 0;
    selModel.disabled = true;
    selYear.disabled = true;
    toast?.("Tip", "Pick your platform (car/bike), then lock a make/model/year.");

    return { getValue, setValue: () => {} };
  }

  window.DG_UI = {
    mountVehiclePicker,
    findVehicleById,
    vehicleLabel,
  };
})();

