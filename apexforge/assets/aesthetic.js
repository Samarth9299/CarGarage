(function () {
  const { qs, qsa, toast, readBuilds, writeBuilds } = window.DG;
  const { mountVehiclePicker } = window.DG_UI;
  const { mods } = window.DG_DATA;

  const pickerRoot = qs("[data-vehicle-form]");
  const picker = mountVehiclePicker(pickerRoot, { persistLast: true });
  let presetSnapshot = null;

  // --- Before/After slider ---
  (function initBeforeAfter() {
    const root = qs("[data-before-after]");
    if (!root) return;
    const after = qs("[data-before-after-after]", root);
    const handle = qs("[data-before-after-handle]", root);
    const knob = qs("[data-before-after-knob]", root);
    if (!after || !handle || !knob) return;

    let pct = 0.5;
    let dragging = false;

    function setPct(p) {
      pct = Math.max(0, Math.min(1, p));
      after.style.width = `${pct * 100}%`;
      handle.style.left = `${pct * 100}%`;
      knob.style.left = `${pct * 100}%`;
    }

    function onMove(clientX) {
      const rect = root.getBoundingClientRect();
      const p = (clientX - rect.left) / rect.width;
      setPct(p);
    }

    root.addEventListener("pointerdown", (e) => {
      dragging = true;
      root.setPointerCapture(e.pointerId);
      onMove(e.clientX);
    });
    root.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      onMove(e.clientX);
    });
    root.addEventListener("pointerup", () => (dragging = false));
    root.addEventListener("pointercancel", () => (dragging = false));

    setPct(0.55);
  })();

  // --- WebGL Configurator (lightweight) ---
  (function initConfigurator() {
    const canvas = qs("#configCanvas");
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: true, premultipliedAlpha: false });
    if (!gl) {
      toast("WebGL unavailable", "Your browser does not support WebGL. Configurator disabled.");
      return;
    }

    const state = {
      platform: "car",
      color: "#ff2a2a",
      finish: "gloss",
      aero: true,
      lighting: true,
      wheels: "1",
      yaw: 0.6,
      pitch: -0.22,
      dist: 5.2,
      dragging: false,
      lastX: 0,
      lastY: 0,
    };

    function snapshot() {
      presetSnapshot = {
        platform: state.platform,
        color: state.color,
        finish: state.finish,
        aero: state.aero,
        lighting: state.lighting,
        wheels: state.wheels,
      };
    }

    function hexToRgb01(hex) {
      const h = String(hex).replace("#", "").trim();
      const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
      const n = parseInt(full, 16);
      const r = (n >> 16) & 255;
      const g = (n >> 8) & 255;
      const b = n & 255;
      return [r / 255, g / 255, b / 255];
    }

    function makeShader(type, source) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const err = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error(err || "Shader compile failed");
      }
      return s;
    }

    const vs = `
      attribute vec3 aPos;
      attribute vec3 aNor;
      uniform mat4 uMvp;
      uniform mat4 uModel;
      varying vec3 vNor;
      varying vec3 vPos;
      void main(){
        vec4 world = uModel * vec4(aPos, 1.0);
        vPos = world.xyz;
        vNor = mat3(uModel) * aNor;
        gl_Position = uMvp * vec4(aPos, 1.0);
      }
    `;

    const fs = `
      precision mediump float;
      uniform vec3 uBase;
      uniform vec3 uAccent;
      uniform float uRough;
      uniform float uMetal;
      uniform float uLighting;
      uniform float uCarbon;
      varying vec3 vNor;
      varying vec3 vPos;
      float hash(vec2 p){
        return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123);
      }
      void main(){
        vec3 N = normalize(vNor);
        vec3 L = normalize(vec3(0.6, 0.8, 0.35));
        vec3 V = normalize(vec3(0.0, 0.0, 1.0));
        float ndl = max(dot(N, L), 0.0);

        vec3 base = uBase;
        // Carbon procedural: lightweight weave hint
        vec2 p = vPos.xz * 7.5;
        float w1 = step(0.55, hash(p * 1.3));
        float w2 = step(0.45, hash(vec2(p.y, p.x) * 1.1));
        float weave = (w1 * 0.55 + w2 * 0.45);
        vec3 carbonA = vec3(0.05, 0.06, 0.07);
        vec3 carbonB = vec3(0.11, 0.12, 0.13);
        vec3 carbonBase = mix(carbonA, carbonB, weave);
        base = mix(base, carbonBase, clamp(uCarbon, 0.0, 1.0));

        vec3 diffuse = base * (0.22 + 0.78 * ndl);

        vec3 H = normalize(L + V);
        float ndh = max(dot(N, H), 0.0);
        float specPow = mix(120.0, 14.0, uRough);
        float spec = pow(ndh, specPow) * (0.28 + 0.72 * (1.0 - uRough));
        vec3 specCol = mix(vec3(0.92), base, uMetal) * spec;

        // Signature lighting accent: edge glow near z+ and low y
        float edge = smoothstep(0.35, 0.98, abs(N.z)) * smoothstep(-0.22, 0.06, vPos.y);
        vec3 glow = uAccent * edge * (0.22 + 0.78 * uLighting);

        vec3 col = diffuse + specCol + glow;
        col = pow(col, vec3(0.90)); // gentle tone curve
        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const prog = gl.createProgram();
    gl.attachShader(prog, makeShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, makeShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) || "Program link failed");
    }
    gl.useProgram(prog);

    const loc = {
      aPos: gl.getAttribLocation(prog, "aPos"),
      aNor: gl.getAttribLocation(prog, "aNor"),
      uMvp: gl.getUniformLocation(prog, "uMvp"),
      uModel: gl.getUniformLocation(prog, "uModel"),
      uBase: gl.getUniformLocation(prog, "uBase"),
      uAccent: gl.getUniformLocation(prog, "uAccent"),
      uRough: gl.getUniformLocation(prog, "uRough"),
      uMetal: gl.getUniformLocation(prog, "uMetal"),
      uLighting: gl.getUniformLocation(prog, "uLighting"),
      uCarbon: gl.getUniformLocation(prog, "uCarbon"),
    };

    function mat4Identity() {
      return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    }
    // Column-major multiply: out = a * b
    function mat4Mul(a, b) {
      const o = new Array(16);
      for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
          o[c * 4 + r] =
            a[0 * 4 + r] * b[c * 4 + 0] +
            a[1 * 4 + r] * b[c * 4 + 1] +
            a[2 * 4 + r] * b[c * 4 + 2] +
            a[3 * 4 + r] * b[c * 4 + 3];
        }
      }
      return o;
    }
    function mat4Translate(x, y, z) {
      return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
    }
    function mat4Scale(x, y, z) {
      return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
    }
    function mat4RotX(a) {
      const c = Math.cos(a), s = Math.sin(a);
      return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
    }
    function mat4RotY(a) {
      const c = Math.cos(a), s = Math.sin(a);
      return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
    }
    function mat4Perspective(fov, aspect, near, far) {
      const f = 1.0 / Math.tan(fov / 2);
      const nf = 1 / (near - far);
      return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
    }
    function mat4LookAt(eye, target, up) {
      const [ex, ey, ez] = eye;
      const [tx, ty, tz] = target;
      let zx = ex - tx, zy = ey - ty, zz = ez - tz;
      const zLen = Math.hypot(zx, zy, zz) || 1;
      zx /= zLen; zy /= zLen; zz /= zLen;
      let xx = up[1] * zz - up[2] * zy;
      let xy = up[2] * zx - up[0] * zz;
      let xz = up[0] * zy - up[1] * zx;
      const xLen = Math.hypot(xx, xy, xz) || 1;
      xx /= xLen; xy /= xLen; xz /= xLen;
      const yx = zy * xz - zz * xy;
      const yy = zz * xx - zx * xz;
      const yz = zx * xy - zy * xx;
      return [
        xx, yx, zx, 0,
        xy, yy, zy, 0,
        xz, yz, zz, 0,
        -(xx * ex + xy * ey + xz * ez),
        -(yx * ex + yy * ey + yz * ez),
        -(zx * ex + zy * ey + zz * ez),
        1,
      ];
    }

    function createBox(w, h, d) {
      const x = w / 2, y = h / 2, z = d / 2;
      const p = [
        // Front
        -x, -y, z, x, -y, z, x, y, z, -x, y, z,
        // Back
        x, -y, -z, -x, -y, -z, -x, y, -z, x, y, -z,
        // Left
        -x, -y, -z, -x, -y, z, -x, y, z, -x, y, -z,
        // Right
        x, -y, z, x, -y, -z, x, y, -z, x, y, z,
        // Top
        -x, y, z, x, y, z, x, y, -z, -x, y, -z,
        // Bottom
        -x, -y, -z, x, -y, -z, x, -y, z, -x, -y, z,
      ];
      const n = [
        // Front
        0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
        // Back
        0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
        // Left
        -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
        // Right
        1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
        // Top
        0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
        // Bottom
        0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
      ];
      const idx = [];
      for (let i = 0; i < 6; i++) {
        const o = i * 4;
        idx.push(o + 0, o + 1, o + 2, o + 0, o + 2, o + 3);
      }
      return { positions: p, normals: n, indices: idx };
    }

    function createCylinder(r, h, seg) {
      const positions = [];
      const normals = [];
      const indices = [];
      const half = h / 2;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const c = Math.cos(a), s = Math.sin(a);
        const x = c * r;
        const z = s * r;
        positions.push(x, -half, z, x, half, z);
        normals.push(c, 0, s, c, 0, s);
      }
      for (let i = 0; i < seg; i++) {
        const o = i * 2;
        indices.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
      return { positions, normals, indices };
    }

    function bindMesh(mesh) {
      const vao = gl.createVertexArray ? gl.createVertexArray() : null;
      if (vao && gl.bindVertexArray) gl.bindVertexArray(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      const interleaved = new Float32Array(mesh.positions.length + mesh.normals.length);
      for (let i = 0, j = 0; i < mesh.positions.length / 3; i++) {
        interleaved[j++] = mesh.positions[i * 3 + 0];
        interleaved[j++] = mesh.positions[i * 3 + 1];
        interleaved[j++] = mesh.positions[i * 3 + 2];
        interleaved[j++] = mesh.normals[i * 3 + 0];
        interleaved[j++] = mesh.normals[i * 3 + 1];
        interleaved[j++] = mesh.normals[i * 3 + 2];
      }
      gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
      const stride = 6 * 4;
      gl.enableVertexAttribArray(loc.aPos);
      gl.vertexAttribPointer(loc.aPos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(loc.aNor);
      gl.vertexAttribPointer(loc.aNor, 3, gl.FLOAT, false, stride, 3 * 4);

      const ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
      return { vao, count: mesh.indices.length };
    }

    const boxBody = bindMesh(createBox(2.4, 0.55, 1.1));
    const boxCabin = bindMesh(createBox(1.15, 0.42, 1.0));
    const boxSpoiler = bindMesh(createBox(0.72, 0.08, 0.22));
    const cylWheel = bindMesh(createCylinder(0.28, 0.22, 22));
    const boxBikeFrame = bindMesh(createBox(1.6, 0.22, 0.38));
    const boxBikeTank = bindMesh(createBox(0.52, 0.28, 0.38));
    const cylBikeWheel = bindMesh(createCylinder(0.34, 0.18, 22));
    const boxBikeTail = bindMesh(createBox(0.56, 0.14, 0.22));

    function setViewport() {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      return { w: canvas.width, h: canvas.height };
    }

    function drawMesh(mesh, modelMat, mvpMat) {
      gl.uniformMatrix4fv(loc.uModel, false, new Float32Array(modelMat));
      gl.uniformMatrix4fv(loc.uMvp, false, new Float32Array(mvpMat));
      if (mesh.vao && gl.bindVertexArray) gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    }

    function finishToParams(finish) {
      if (finish === "matte") return { rough: 0.92, metal: 0.04 };
      if (finish === "satin") return { rough: 0.66, metal: 0.06 };
      if (finish === "carbon") return { rough: 0.44, metal: 0.24 };
      return { rough: 0.28, metal: 0.14 }; // gloss
    }

    function render() {
      const { w, h } = setViewport();
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      const aspect = w / h;
      const proj = mat4Perspective((50 * Math.PI) / 180, aspect, 0.1, 40);
      const eye = [
        Math.sin(state.yaw) * state.dist,
        1.1 + state.pitch * 2.2,
        Math.cos(state.yaw) * state.dist,
      ];
      const view = mat4LookAt(eye, [0, 0.15, 0], [0, 1, 0]);
      const pv = mat4Mul(proj, view);

      const base = state.finish === "carbon" ? [0.10, 0.11, 0.12] : hexToRgb01(state.color);
      const accent = hexToRgb01("#00e5ff");
      const f = finishToParams(state.finish);
      gl.uniform3fv(loc.uBase, new Float32Array(base));
      gl.uniform3fv(loc.uAccent, new Float32Array(accent));
      gl.uniform1f(loc.uRough, f.rough);
      gl.uniform1f(loc.uMetal, f.metal);
      gl.uniform1f(loc.uLighting, state.lighting ? 1.0 : 0.0);
      gl.uniform1f(loc.uCarbon, state.finish === "carbon" ? 1.0 : 0.0);

      const rootRot = mat4Identity();
      if (state.platform === "car") (function drawCar() {
        const mBody = mat4Mul(mat4Translate(0, 0.05, 0), rootRot);
        drawMesh(boxBody, mBody, mat4Mul(pv, mBody));

        const mCabin = mat4Mul(mat4Translate(-0.08, 0.44, -0.02), rootRot);
        drawMesh(boxCabin, mCabin, mat4Mul(pv, mCabin));

        if (state.aero) {
          const mSpoiler = mat4Mul(mat4Translate(0.78, 0.48, 0), rootRot);
          drawMesh(boxSpoiler, mSpoiler, mat4Mul(pv, mSpoiler));
        }

        // Wheels (simple)
        const wheelPositions = [
          [-0.82, -0.12, 0.52],
          [0.82, -0.12, 0.52],
          [-0.82, -0.12, -0.52],
          [0.82, -0.12, -0.52],
        ];
        const wheelScale = state.wheels === "2" ? 1.12 : state.wheels === "3" ? 1.18 : 1.0;
        wheelPositions.forEach(([x, y, z]) => {
          const m = mat4Mul(mat4Translate(x, y, z), mat4Mul(mat4RotX(Math.PI / 2), mat4Scale(wheelScale, wheelScale, wheelScale)));
          drawMesh(cylWheel, m, mat4Mul(pv, m));
        });
      })();

      if (state.platform === "bike") (function drawBike() {
        const mFrame = mat4Translate(0, 0.08, 0);
        drawMesh(boxBikeFrame, mFrame, mat4Mul(pv, mFrame));

        const mTank = mat4Translate(-0.25, 0.28, 0);
        drawMesh(boxBikeTank, mTank, mat4Mul(pv, mTank));

        if (state.aero) {
          const mTail = mat4Translate(0.62, 0.22, 0);
          drawMesh(boxBikeTail, mTail, mat4Mul(pv, mTail));
        }

        const wheelScale = state.wheels === "2" ? 1.06 : state.wheels === "3" ? 1.1 : 1.0;
        const back = mat4Mul(mat4Translate(0.62, -0.06, 0), mat4Mul(mat4RotX(Math.PI / 2), mat4Scale(wheelScale, wheelScale, wheelScale)));
        const front = mat4Mul(mat4Translate(-0.62, -0.06, 0), mat4Mul(mat4RotX(Math.PI / 2), mat4Scale(wheelScale, wheelScale, wheelScale)));
        drawMesh(cylBikeWheel, back, mat4Mul(pv, back));
        drawMesh(cylBikeWheel, front, mat4Mul(pv, front));
      })();

      requestAnimationFrame(render);
    }

    function syncPlatform() {
      const typeSel = qs('[data-vehicle="type"]', pickerRoot);
      const t = typeSel?.value;
      state.platform = t === "bike" ? "bike" : "car";
      snapshot();
    }

    // Orbit controls
    canvas.addEventListener("pointerdown", (e) => {
      state.dragging = true;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!state.dragging) return;
      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.yaw += dx * 0.008;
      state.pitch = Math.max(-0.6, Math.min(0.35, state.pitch + dy * 0.006));
    });
    canvas.addEventListener("pointerup", () => (state.dragging = false));
    canvas.addEventListener("pointercancel", () => (state.dragging = false));
    canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        state.dist = Math.max(3.4, Math.min(9.5, state.dist + Math.sign(e.deltaY) * 0.35));
      },
      { passive: false },
    );

    // UI bindings
    qsa("[data-color]").forEach((btn) => {
      btn.addEventListener("click", () => {
        qsa("[data-color]").forEach((b) => b.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");
        state.color = btn.getAttribute("data-color") || "#ff2a2a";
        snapshot();
      });
    });

    qsa("[data-finish]").forEach((btn) => {
      btn.addEventListener("click", () => {
        qsa("[data-finish]").forEach((b) => b.setAttribute("aria-pressed", "false"));
        btn.setAttribute("aria-pressed", "true");
        state.finish = btn.getAttribute("data-finish") || "gloss";
        snapshot();
      });
    });

    qs('[data-opt="aero"]')?.addEventListener("change", (e) => {
      state.aero = !!e.target.checked;
      snapshot();
    });
    qs('[data-opt="lighting"]')?.addEventListener("change", (e) => {
      state.lighting = !!e.target.checked;
      snapshot();
    });
    qs('[data-opt="wheels"]')?.addEventListener("change", (e) => {
      state.wheels = String(e.target.value || "1");
      snapshot();
    });

    qsa("[data-vehicle]").forEach((el) => el.addEventListener("change", () => syncPlatform()));
    window.addEventListener("resize", () => setViewport(), { passive: true });

    // Export
    qs("[data-export]")?.addEventListener("click", () => {
      try {
        const a = document.createElement("a");
        a.download = `apexforge_config_${Date.now()}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
        toast("Exported", "PNG downloaded (prototype export).");
      } catch {
        toast("Export failed", "Unable to export canvas in this context.");
      }
    });

    toast("Configurator", "Drag to rotate, scroll to zoom. Toggle aero and lighting for quick variations.");
    syncPlatform();
    snapshot();
    render();
  })();

  // --- Aesthetic catalog + Garage save ---
  (function initAestheticCatalog() {
    const listEl = qs("[data-aest-mod-list]");
    const countEl = qs("[data-aest-selected]");
    const btnClear = qs("[data-aest-clear]");
    const btnSave = qs("[data-aest-save]");
    if (!listEl || !countEl || !btnSave) return;

    let selected = [];

    function isAestheticMod(m) {
      return String(m.id).startsWith("aest-");
    }

    function platform() {
      const typeSel = qs('[data-vehicle="type"]', pickerRoot);
      return typeSel?.value === "bike" ? "bike" : "car";
    }

    function platformMods() {
      const p = platform();
      return mods.filter((m) => isAestheticMod(m) && (m.type || []).includes(p));
    }

    function render() {
      listEl.innerHTML = "";
      const items = platformMods();
      items.forEach((m) => {
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
            <label class="pill" style="cursor:pointer">
              <input type="checkbox" style="accent-color: var(--accent2)" />
              Include
            </label>
          </div>
        `;
        qs(".row__title", row).textContent = m.name;
        qs(".row__sub", row).textContent = `${m.category} · ${m.complexity} · Legality: ${m.legality}`;
        const chk = qs('input[type="checkbox"]', row);
        chk.checked = selected.includes(m.id);
        chk.addEventListener("change", () => {
          if (chk.checked) selected = Array.from(new Set([...selected, m.id]));
          else selected = selected.filter((id) => id !== m.id);
          countEl.textContent = String(selected.length);
        });
        listEl.appendChild(row);
      });
      countEl.textContent = String(selected.length);
    }

    function addToGarage(vehicle, modIds) {
      const builds = readBuilds();
      const now = new Date().toISOString();
      let build = builds.find((b) => b.vehicleId === vehicle.id);
      if (!build) {
        build = {
          id: `bld_${Math.random().toString(16).slice(2)}_${Date.now()}`,
          name: `Build — ${vehicle.year} ${vehicle.make} ${vehicle.model}`,
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
      if (presetSnapshot) build.visualPreset = presetSnapshot;
      build.updatedAt = now;
      writeBuilds(builds);
      toast("Garage updated", `Saved ${modIds.length} aesthetic mod(s) to ${build.name}.`);
    }

    btnClear?.addEventListener("click", () => {
      selected = [];
      render();
      toast("Selection cleared", "Pick aesthetic upgrades to save into your build.");
    });

    btnSave.addEventListener("click", () => {
      const v = picker.getValue();
      if (!v) {
        toast("Select a vehicle", "Choose make/model/year first so the build has a baseline.");
        return;
      }
      if (selected.length === 0) {
        toast("No mods selected", "Select at least one aesthetic upgrade to save.");
        return;
      }
      addToGarage(v, selected);
    });

    qsa("[data-vehicle]").forEach((el) =>
      el.addEventListener("change", () => {
        selected = [];
        render();
      }),
    );

    render();
  })();
})();
