/**
 * ApexForge v1.2 — NFS-style Three.js Garage Engine
 * Requires Three.js r128 loaded via CDN before this script
 */
(function () {
  if (typeof THREE === 'undefined') return;

  const canvas = document.getElementById('garageCanvas');
  if (!canvas) return;

  // ─── Renderer ────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // ─── Scene ───────────────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080b10);
  scene.fog = new THREE.FogExp2(0x080b10, 0.038);

  // ─── Camera ──────────────────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(4.5, 2.2, 5.8);
  camera.lookAt(0, 0.6, 0);

  // ─── OrbitControls (inline implementation — no external dependency) ───────
  const controls = {
    target: new THREE.Vector3(0, 0.5, 0),
    spherical: new THREE.Spherical(7.5, Math.PI / 3, Math.PI / 6),
    minPolar: 0.18, maxPolar: Math.PI / 2.1,
    minRadius: 3.5, maxRadius: 14,
    isDragging: false, isRightDrag: false,
    lastX: 0, lastY: 0,

    apply() {
      this.spherical.phi = Math.max(this.minPolar, Math.min(this.maxPolar, this.spherical.phi));
      this.spherical.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.spherical.radius));
      camera.position.setFromSpherical(this.spherical).add(this.target);
      camera.lookAt(this.target);
    }
  };

  canvas.addEventListener('mousedown', e => {
    controls.isDragging = true;
    controls.isRightDrag = e.button === 2;
    controls.lastX = e.clientX; controls.lastY = e.clientY;
  });
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      controls.isDragging = true;
      controls.lastX = e.touches[0].clientX; controls.lastY = e.touches[0].clientY;
    }
  }, { passive: true });
  window.addEventListener('mousemove', e => {
    if (!controls.isDragging) return;
    const dx = e.clientX - controls.lastX, dy = e.clientY - controls.lastY;
    controls.lastX = e.clientX; controls.lastY = e.clientY;
    controls.spherical.theta -= dx * 0.006;
    controls.spherical.phi += dy * 0.005;
    controls.apply();
  });
  window.addEventListener('touchmove', e => {
    if (!controls.isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - controls.lastX, dy = e.touches[0].clientY - controls.lastY;
    controls.lastX = e.touches[0].clientX; controls.lastY = e.touches[0].clientY;
    controls.spherical.theta -= dx * 0.007;
    controls.spherical.phi += dy * 0.006;
    controls.apply();
  }, { passive: true });
  window.addEventListener('mouseup', () => controls.isDragging = false);
  window.addEventListener('touchend', () => controls.isDragging = false);
  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    controls.spherical.radius += e.deltaY * 0.008;
    controls.apply();
  }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  controls.apply();

  // ─── Camera Presets ───────────────────────────────────────────────────────
  const camPresets = {
    garage:   { r: 7.5,  phi: Math.PI/3,     theta: Math.PI/6 },
    front:    { r: 5.5,  phi: Math.PI/2.4,   theta: 0 },
    side:     { r: 6.0,  phi: Math.PI/2.3,   theta: Math.PI/2 },
    wheel:    { r: 3.5,  phi: Math.PI/2.05,  theta: Math.PI/4 },
    top:      { r: 7.0,  phi: 0.28,          theta: Math.PI/6 },
    rear:     { r: 5.5,  phi: Math.PI/2.4,   theta: Math.PI },
  };

  let camTarget = null;
  function setCameraPreset(name) {
    const p = camPresets[name];
    if (!p) return;
    camTarget = { r: p.r, phi: p.phi, theta: p.theta };
  }
  window.GARAGE3D_setCam = setCameraPreset;

  // ─── Lighting System ──────────────────────────────────────────────────────

  // Ambient (fill)
  scene.add(new THREE.AmbientLight(0x1a2030, 2.0));

  // Main spotlight (key light on car)
  const keyLight = new THREE.SpotLight(0xfff5e0, 4.5, 22, Math.PI / 7, 0.35, 1.5);
  keyLight.position.set(0, 9, 2);
  keyLight.target.position.set(0, 0, 0);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 30;
  scene.add(keyLight);
  scene.add(keyLight.target);

  // Fill light (right side)
  const fillLight = new THREE.DirectionalLight(0x334466, 1.2);
  fillLight.position.set(6, 4, -3);
  scene.add(fillLight);

  // Neon cyan strip — left wall
  const neonL = new THREE.PointLight(0x00C8FF, 3.5, 12, 2);
  neonL.position.set(-5.5, 2.8, 0);
  scene.add(neonL);

  // Neon orange strip — right wall
  const neonR = new THREE.PointLight(0xFF5C00, 3.5, 12, 2);
  neonR.position.set(5.5, 2.8, 0);
  scene.add(neonR);

  // Ground bounce
  const bounce = new THREE.HemisphereLight(0x334466, 0x111820, 0.8);
  scene.add(bounce);

  // Industrial ceiling lamps (3 spots)
  [[-3, 7.5, -1], [0, 7.5, -1], [3, 7.5, -1]].forEach(([x, y, z]) => {
    const lamp = new THREE.SpotLight(0xffe8c0, 1.8, 14, Math.PI / 8, 0.5, 1.8);
    lamp.position.set(x, y, z);
    lamp.target.position.set(x, 0, z);
    scene.add(lamp);
    scene.add(lamp.target);
  });

  // ─── Materials ───────────────────────────────────────────────────────────
  const matFloor = new THREE.MeshStandardMaterial({
    color: 0x1a1c20, roughness: 0.35, metalness: 0.18,
    envMapIntensity: 0.6,
  });
  const matWall = new THREE.MeshStandardMaterial({ color: 0x181b22, roughness: 0.9, metalness: 0.0 });
  const matCeiling = new THREE.MeshStandardMaterial({ color: 0x131519, roughness: 1.0 });
  const matProp = new THREE.MeshStandardMaterial({ color: 0x2a2d35, roughness: 0.8, metalness: 0.3 });
  const matMetal = new THREE.MeshStandardMaterial({ color: 0x3a3d46, roughness: 0.4, metalness: 0.85 });
  const matNeonCyan = new THREE.MeshStandardMaterial({ color: 0x00C8FF, emissive: new THREE.Color(0x00C8FF), emissiveIntensity: 2.5, roughness: 1.0 });
  const matNeonOrange = new THREE.MeshStandardMaterial({ color: 0xFF5C00, emissive: new THREE.Color(0xFF5C00), emissiveIntensity: 2.5, roughness: 1.0 });
  const matNeonRed = new THREE.MeshStandardMaterial({ color: 0xff1a1a, emissive: new THREE.Color(0xff1a1a), emissiveIntensity: 2.0, roughness: 1.0 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0x80aabb, transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.9 });
  const matRubber = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95, metalness: 0.0 });
  const matChrome = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.05, metalness: 1.0 });

  // Car body material — mutable
  const carBodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xff2a2a),
    roughness: 0.12, metalness: 0.65, envMapIntensity: 1.2,
  });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.15, metalness: 0.95 });
  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xfff0cc, emissive: new THREE.Color(0xfff0cc), emissiveIntensity: 0.0, roughness: 0.05 });
  const taillightMat = new THREE.MeshStandardMaterial({ color: 0xff1111, emissive: new THREE.Color(0xff1111), emissiveIntensity: 0.0, roughness: 0.05 });

  // ─── Garage Environment ───────────────────────────────────────────────────

  function box(w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cyl(rt, rb, h, seg, mat, x, y, z, rx = 0) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Floor grid lines overlay (emissive)
  const gridMat = new THREE.MeshBasicMaterial({ color: 0x00C8FF, transparent: true, opacity: 0.06 });
  for (let i = -8; i <= 8; i += 2) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(20, 0.015), gridMat);
    h.rotation.x = -Math.PI / 2; h.position.set(0, 0.002, i); scene.add(h);
    const v = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 20), gridMat);
    v.rotation.x = -Math.PI / 2; v.position.set(i, 0.002, 0); scene.add(v);
  }

  // Walls
  scene.add(box(20, 9, 0.3, matWall, 0, 4.5, -7.5));       // back
  scene.add(box(0.3, 9, 16, matWall, -7.5, 4.5, 0));        // left
  scene.add(box(0.3, 9, 16, matWall, 7.5, 4.5, 0));         // right
  scene.add(box(20, 0.3, 16, matCeiling, 0, 9, 0));         // ceiling

  // Neon cyan strip (left wall high)
  scene.add(box(6, 0.08, 0.12, matNeonCyan, -5.5, 3.5, -5));
  scene.add(box(0.08, 2.5, 0.12, matNeonCyan, -5.5, 2.0, -3.5)); // vertical

  // Neon orange strip (right wall)
  scene.add(box(6, 0.08, 0.12, matNeonOrange, 5.5, 3.5, -5));
  scene.add(box(0.08, 2.5, 0.12, matNeonOrange, 5.5, 2.0, -3.5));

  // Red accent strip on back wall
  scene.add(box(14, 0.06, 0.1, matNeonRed, 0, 1.8, -7.4));

  // Industrial ceiling lamps (physical housings)
  const lampHouseMat = new THREE.MeshStandardMaterial({ color: 0x222429, roughness: 0.7, metalness: 0.6 });
  [[-3, 8.5, -1], [0, 8.5, -1], [3, 8.5, -1]].forEach(([x, y, z]) => {
    scene.add(box(1.0, 0.12, 0.35, lampHouseMat, x, y, z));
    scene.add(box(0.9, 0.04, 0.28, new THREE.MeshStandardMaterial({ color: 0xfffde0, emissive: new THREE.Color(0xfffde0), emissiveIntensity: 1.5 }), x, y - 0.09, z));
    // Hanging cable
    scene.add(box(0.025, 0.8, 0.025, lampHouseMat, x, y + 0.46, z));
  });

  // Workbench (left side)
  scene.add(box(3.5, 0.1, 1.0, matMetal, -5.0, 1.0, 2.5));  // surface
  scene.add(box(0.1, 1.0, 1.0, matMetal, -3.35, 0.5, 2.5)); // legs
  scene.add(box(0.1, 1.0, 1.0, matMetal, -6.65, 0.5, 2.5));
  // Items on bench
  scene.add(box(0.3, 0.3, 0.3, matProp, -5.6, 1.2, 2.3));
  scene.add(box(0.6, 0.15, 0.25, matMetal, -4.5, 1.12, 2.6));
  scene.add(cyl(0.12, 0.12, 0.4, 12, matMetal, -4.9, 1.25, 2.2));

  // Tool rack on back-left wall
  scene.add(box(2.0, 2.0, 0.1, matProp, -5.5, 2.8, -7.3));
  // Tool pegs
  for (let i = 0; i < 4; i++) {
    scene.add(box(0.04, 0.04, 0.22, matMetal, -6.0 + i * 0.5, 2.6, -7.2));
    scene.add(box(0.04, 0.04, 0.22, matMetal, -6.0 + i * 0.5, 3.1, -7.2));
  }

  // Tire stack (right side)
  [0, 0.32, 0.64].forEach(dy => {
    scene.add(cyl(0.42, 0.42, 0.3, 24, matRubber, 5.2, 0.17 + dy, 3.0));
  });

  // Hydraulic lift platform
  const liftMat = new THREE.MeshStandardMaterial({ color: 0x1c2535, roughness: 0.6, metalness: 0.7 });
  const liftStripe = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: new THREE.Color(0xffcc00), emissiveIntensity: 0.4 });
  scene.add(box(4.0, 0.08, 2.2, liftMat, 0, 0.04, 0.2));
  // Yellow safety stripes
  [-1.6, -0.8, 0, 0.8, 1.6].forEach(x => {
    scene.add(box(0.12, 0.005, 2.2, liftStripe, x, 0.09, 0.2));
  });
  // Lift arms
  scene.add(box(0.12, 0.55, 0.12, matMetal, -1.6, 0.31, 0.2));
  scene.add(box(0.12, 0.55, 0.12, matMetal, 1.6, 0.31, 0.2));

  // Poster on back wall
  const posterMat = new THREE.MeshStandardMaterial({ color: 0x0a0e18, roughness: 1.0 });
  const posterFrameMat = new THREE.MeshStandardMaterial({ color: 0x222529, roughness: 0.5, metalness: 0.5 });
  scene.add(box(1.8, 0.04, 2.8, posterFrameMat, 3.5, 3.4, -7.3));
  scene.add(box(1.72, 0.06, 2.72, posterMat, 3.5, 3.4, -7.28));

  // Extinguisher (red cylinder)
  const extMat = new THREE.MeshStandardMaterial({ color: 0xcc1111, roughness: 0.4, metalness: 0.3 });
  scene.add(cyl(0.12, 0.12, 0.6, 16, extMat, 6.8, 0.3, -6.5));

  // ─── Car Assembly ─────────────────────────────────────────────────────────
  const carGroup = new THREE.Group();
  scene.add(carGroup);

  // Body (main chassis lower section)
  const carBody = box(3.8, 0.5, 1.72, carBodyMat, 0, 0.62, 0.18);
  carGroup.add(carBody);

  // Cabin (roof section)
  const cabin = box(2.1, 0.65, 1.55, carBodyMat, -0.1, 1.22, 0.18);
  carGroup.add(cabin);

  // Windshield
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.58, 0.05), matGlass);
  windshield.position.set(0.78, 1.21, 0.2);
  windshield.rotation.z = -0.42;
  carGroup.add(windshield);

  // Rear glass
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.52, 0.05), matGlass);
  rearGlass.position.set(-0.95, 1.21, 0.2);
  rearGlass.rotation.z = 0.38;
  carGroup.add(rearGlass);

  // Side windows
  [-0.05].forEach(x => {
    ['left', 'right'].forEach((side, si) => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.44, 0.04), matGlass);
      win.position.set(x, 1.22, si === 0 ? 0.87 : -0.51);
      carGroup.add(win);
    });
  });

  // Hood (slightly angled upward toward front)
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.7), carBodyMat);
  hood.position.set(1.25, 0.92, 0.18);
  hood.rotation.z = 0.08;
  carGroup.add(hood);

  // Trunk
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.7), carBodyMat);
  trunk.position.set(-1.4, 0.94, 0.18);
  trunk.rotation.z = -0.04;
  carGroup.add(trunk);

  // Front bumper
  const frontBumper = box(0.22, 0.38, 1.72, carBodyMat, 1.96, 0.58, 0.18);
  carGroup.add(frontBumper);

  // Rear bumper
  const rearBumper = box(0.22, 0.38, 1.72, carBodyMat, -1.96, 0.58, 0.18);
  carGroup.add(rearBumper);

  // Front splitter
  const splitter = box(0.24, 0.06, 1.78, carBodyMat, 2.06, 0.37, 0.18);
  carGroup.add(splitter);

  // Headlights (emissive)
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.42), headlightMat);
  headL.position.set(2.0, 0.7, 0.65); carGroup.add(headL);
  const headR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.42), headlightMat.clone());
  headR.position.set(2.0, 0.7, -0.29); carGroup.add(headR);

  // Taillights
  const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.55), taillightMat);
  tailL.position.set(-1.97, 0.74, 0.65); carGroup.add(tailL);
  const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.15, 0.55), taillightMat.clone());
  tailR.position.set(-1.97, 0.74, -0.29); carGroup.add(tailR);

  // Exhaust tips
  [0.55, 0.72].forEach(z => {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.15, 16), matChrome);
    tip.rotation.z = Math.PI / 2;
    tip.position.set(-2.0, 0.35, -z);
    carGroup.add(tip);
  });

  // Wheels (4x)
  const wheelPositions = [
    [1.28, 0.38, 1.01],   // FL
    [1.28, 0.38, -0.65],  // FR
    [-1.28, 0.38, 1.01],  // RL
    [-1.28, 0.38, -0.65], // RR
  ];

  const wheelMeshes = [];
  wheelPositions.forEach(([x, y, z]) => {
    const wg = new THREE.Group();
    // Tire
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.22, 32), matRubber);
    tire.rotation.x = Math.PI / 2;
    wg.add(tire);
    // Rim inner
    const rimInner = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 24), rimMat);
    rimInner.rotation.x = Math.PI / 2;
    wg.add(rimInner);
    // Spokes (5-spoke)
    for (let s = 0; s < 5; s++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.042, 0.042), rimMat);
      spoke.rotation.y = (s / 5) * Math.PI * 2;
      wg.add(spoke);
    }
    // Center cap
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.24, 16), matChrome);
    cap.rotation.x = Math.PI / 2;
    wg.add(cap);

    wg.position.set(x, y, z);
    wg.castShadow = true;
    wg.receiveShadow = true;
    carGroup.add(wg);
    wheelMeshes.push(wg);
  });

  // Spoiler group (toggleable)
  const spoilerGroup = new THREE.Group();
  const spoilerBlade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 1.72), carBodyMat);
  spoilerBlade.position.set(0, 0.13, 0);
  const spoilerStandL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.32, 0.07), carBodyMat);
  spoilerStandL.position.set(0.02, 0, 0.65);
  const spoilerStandR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.32, 0.07), carBodyMat);
  spoilerStandR.position.set(0.02, 0, -0.47);
  spoilerGroup.add(spoilerBlade, spoilerStandL, spoilerStandR);
  spoilerGroup.position.set(-1.78, 1.22, 0.19);
  spoilerGroup.castShadow = true;
  carGroup.add(spoilerGroup);

  // Car position on lift platform
  carGroup.position.set(0, 0.12, 0.2);

  // ─── Car Shadow Plane ────────────────────────────────────────────────────
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4.5, 2.5),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0, 0.13, 0.2);
  scene.add(shadowPlane);

  // ─── State & Public API ────────────────────────────────────────────────────
  const state = {
    bodyColor: '#ff2a2a',
    rimColor: '#888888',
    finish: 'gloss',  // gloss | matte | metallic | chrome | carbon
    spoiler: true,
    lights: true,
    wheelAnim: false,
    doorAnim: 0,
    headlightsOn: false,
    tailightsOn: false,
  };

  function applyBodyColor(hex) {
    state.bodyColor = hex;
    const c = new THREE.Color(hex);
    carBodyMat.color.set(c);
    applyFinish(state.finish);
  }

  function applyRimColor(hex) {
    state.rimColor = hex;
    rimMat.color.set(new THREE.Color(hex));
  }

  function applyFinish(finish) {
    state.finish = finish;
    const m = carBodyMat;
    switch (finish) {
      case 'gloss':    m.roughness = 0.12; m.metalness = 0.65; m.color.set(state.bodyColor); break;
      case 'matte':    m.roughness = 0.92; m.metalness = 0.05; m.color.set(state.bodyColor); break;
      case 'metallic': m.roughness = 0.22; m.metalness = 0.85; break;
      case 'chrome':   m.roughness = 0.02; m.metalness = 1.0;  m.color.set(0xdddddd); break;
      case 'carbon':   m.roughness = 0.55; m.metalness = 0.25; m.color.set(0x141414); break;
    }
    m.needsUpdate = true;
  }

  function toggleSpoiler(on) {
    state.spoiler = on;
    spoilerGroup.visible = on;
  }

  function toggleHeadlights(on) {
    state.headlightsOn = on;
    const v = on ? 3.0 : 0.0;
    headlightMat.emissiveIntensity = v;
    headL.material.emissiveIntensity = v;
    headR.material.emissiveIntensity = v;
  }

  function toggleTaillights(on) {
    state.tailightsOn = on;
    const v = on ? 2.5 : 0.0;
    taillightMat.emissiveIntensity = v;
    tailL.material.emissiveIntensity = v;
    tailR.material.emissiveIntensity = v;
  }

  // Expose API globally
  window.GARAGE3D = {
    setBodyColor: applyBodyColor,
    setRimColor: applyRimColor,
    setFinish: applyFinish,
    setSpoiler: toggleSpoiler,
    setHeadlights: toggleHeadlights,
    setTaillights: toggleTaillights,
    setCam: setCameraPreset,
  };

  // Wire up UI controls if present
  function hookUI() {
    const el = (id) => document.getElementById(id);
    const on = (id, ev, fn) => { const e = el(id); if (e) e.addEventListener(ev, fn); };

    // Color swatches (data-color attr)
    document.querySelectorAll('[data-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        applyBodyColor(btn.dataset.color);
        document.querySelectorAll('[data-color]').forEach(b => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
      });
    });
    // Custom color input
    on('customColor', 'input', e => applyBodyColor(e.target.value));
    // Rim color
    on('rimColor', 'input', e => applyRimColor(e.target.value));
    // Finish buttons
    document.querySelectorAll('[data-finish]').forEach(btn => {
      btn.addEventListener('click', () => {
        applyFinish(btn.dataset.finish);
        document.querySelectorAll('[data-finish]').forEach(b => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
      });
    });
    // Spoiler toggle
    on('toggleSpoiler', 'change', e => toggleSpoiler(e.target.checked));
    // Headlights
    on('toggleHeadlights', 'change', e => toggleHeadlights(e.target.checked));
    // Taillights
    on('toggleTaillights', 'change', e => toggleTaillights(e.target.checked));
    // Camera preset buttons
    document.querySelectorAll('[data-cam]').forEach(btn => {
      btn.addEventListener('click', () => {
        setCameraPreset(btn.dataset.cam);
        document.querySelectorAll('[data-cam]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
  }

  // ─── Neon flicker animation ───────────────────────────────────────────────
  let flickerT = 0;

  // ─── Render Loop ─────────────────────────────────────────────────────────
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function tick() {
    requestAnimationFrame(tick);
    resize();

    const t = performance.now() * 0.001;
    flickerT += 0.016;

    // Animate wheel spin (subtle idle)
    wheelMeshes.forEach(wg => { wg.rotation.z += 0.006; });

    // Neon light flicker
    neonL.intensity = 3.5 + Math.sin(t * 7.3) * 0.15 + Math.sin(t * 31) * 0.05;
    neonR.intensity = 3.5 + Math.sin(t * 5.7 + 1.2) * 0.15 + Math.sin(t * 29) * 0.05;

    // Subtle car float
    carGroup.position.y = 0.12 + Math.sin(t * 0.5) * 0.012;

    // Smooth camera transitions
    if (camTarget) {
      const s = controls.spherical;
      const spd = 0.07;
      s.radius = lerp(s.radius, camTarget.r, spd);
      s.phi    = lerp(s.phi,    camTarget.phi, spd);
      s.theta  = lerp(s.theta,  camTarget.theta, spd);
      if (
        Math.abs(s.radius - camTarget.r) < 0.01 &&
        Math.abs(s.phi - camTarget.phi) < 0.002 &&
        Math.abs(s.theta - camTarget.theta) < 0.002
      ) camTarget = null;
      controls.apply();
    }

    renderer.render(scene, camera);
  }

  tick();

  // Hook UI after DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hookUI);
  } else {
    hookUI();
  }

  console.log('%c ApexForge Garage3D v1.2 ready', 'color:#00C8FF;font-weight:bold;font-size:14px');
})();
