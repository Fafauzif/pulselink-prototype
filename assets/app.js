/* PulseLink static explorer. No build step and no external runtime requests. */
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const catalog = window.PL_CATALOG;
  const T = window.PL3D;
  const stage = $('#stage');
  const assets = catalog && Array.isArray(catalog.assets) ? catalog.assets : [];
  const numberFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
  const assetMeta = {
    ebike: ['Kendaraan', 'E-bike komuter', '<circle cx="6" cy="18" r="4"/><circle cx="24" cy="18" r="4"/><path d="M6 18l6-10 5 10H6l5-7h8l5 7-5-14h-4M9 6h5"/>'],
    dock: ['Tambat & akses', 'PulseDock', '<path d="M5 26h22M8 26V8l4-4h8l4 4v18M12 9h8v7h-8zM12 22h8M6 26v-7h4"/>'],
    helmet: ['Perlengkapan', 'Helm bersama', '<path d="M3 19c0-10 5-15 13-15s13 6 13 15H3zM6 19l7 9h7l7-9M11 6l-2 9M17 4v11M23 7l2 8"/>'],
    helmet_locker: ['Penyimpanan', 'Loker helm', '<rect x="4" y="3" width="24" height="26" rx="2"/><path d="M4 16h24M16 3v26M12 9v3M12 20v3M24 9v3M24 20v3"/>'],
    battery_service: ['Perawatan', 'Layanan baterai', '<rect x="5" y="4" width="22" height="25" rx="2"/><path d="M12 4V1h8v3M18 9l-6 8h6l-3 7M5 27h22"/>'],
    hub_mrt: ['Titik keberangkatan', 'Hub MRT', '<path d="M2 9l14-6 14 6H2zM5 9v19M27 9v19M2 28h28M9 14h14v9H9zM12 23v5M20 23v5"/>'],
    hub_destination: ['Titik tujuan', 'Hub tujuan', '<path d="M3 11h26L24 5H8zM6 11v17M26 11v17M2 28h28M11 28V17h9v11M14 20h3"/>'],
    system: ['Layanan terhubung', 'Sistem PulseLink', '<rect x="2" y="2" width="10" height="9" rx="1"/><rect x="20" y="21" width="10" height="9" rx="1"/><path d="M7 11v12h13M12 6h13v15M3 26l4-3 4 3M21 17l4 4 4-4"/>']
  };
  const stateLabels = {
    assembled: 'Terpasang', complete: 'Lengkap', closed: 'Tertutup', empty: 'Kosong',
    exploded: 'Terurai', cutaway: 'Potongan', service: 'Akses servis', battery_service: 'Akses baterai',
    open: 'Terbuka', docked: 'Sepeda tertambat', bike_docked: 'Sepeda tertambat',
    roof_off: 'Atap dilepas', roof_removed: 'Atap dilepas'
  };
  const viewLabels = { hero: 'Perspektif', front: 'Depan', side: 'Samping', top: 'Atas', custom: 'Bebas' };
  let renderer, scene, camera, controls, floor, keyLight, loader;
  let currentModel = null, currentAsset = null, currentState = null;
  let requestVersion = 0, busy = false, contextLost = false, currentView = 'hero';
  let radius = 1, halfHeight = 1, distance = 3;
  let center;
  let resizeObserver;
  const hiddenGroups = new Set();
  const sceneCache = new Map();
  const scriptRequests = new Map();
  let sharedBundlePromise = null;
  const stateKey = (asset, state) => state.key || `${asset.id}_${state.id}`;
  const stateLabel = (state) => stateLabels[state.id.toLowerCase()] || state.label || state.id;
  const announce = (text) => { $('#status').textContent = text; };

  function setControlsEnabled(enabled) {
    $$('.view-controls button, .movement-controls button, #capture').forEach((button) => { button.disabled = !enabled; });
  }
  function updateDimensions(state) {
    const dimensions = state.dimensions_mm || [];
    ['x', 'y', 'z'].forEach((axis, index) => {
      // Catalog retains native CAD [length, width, height]; glTF/UI use Y-up.
      const value = Number(dimensions[[0, 2, 1][index]]);
      $(`#dimension-${axis}`).textContent = Number.isFinite(value) ? `${numberFormat.format(value)} mm` : '—';
    });
  }
  function render() {
    if (renderer && scene && camera && !contextLost) renderer.render(scene, camera);
  }
  function resize() {
    if (!renderer || !camera) return;
    const width = Math.max(stage.clientWidth, 1), height = Math.max(stage.clientHeight, 1);
    const aspect = width / height;
    if (camera.isPerspectiveCamera) camera.aspect = aspect;
    else {
      camera.left = -halfHeight * aspect; camera.right = halfHeight * aspect;
      camera.top = halfHeight; camera.bottom = -halfHeight;
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    render();
  }
  function markCustomView() {
    currentView = 'custom';
    $$('[data-view]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
    $('#view-name').textContent = viewLabels.custom;
  }
  function changeCamera(view) {
    const aspect = stage.clientWidth / Math.max(stage.clientHeight, 1);
    if (controls) controls.dispose();
    camera = view === 'hero'
      ? new T.PerspectiveCamera(35, aspect, radius / 100, radius * 40)
      : new T.OrthographicCamera(-1, 1, 1, -1, radius / 100, radius * 40);
    controls = new T.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enablePan = true;
    controls.minDistance = radius * 0.45;
    controls.maxDistance = radius * 14;
    controls.minZoom = 0.25;
    controls.maxZoom = 6;
    controls.addEventListener('change', render);
    controls.addEventListener('start', markCustomView);
    controls.target.copy(center);
    return aspect;
  }
  function fit(view = 'hero') {
    if (!currentModel || !renderer) return;
    const box = new T.Box3().setFromObject(currentModel);
    box.getCenter(center);
    const size = box.getSize(new T.Vector3());
    radius = Math.max(size.length() / 2, 0.1);
    const aspect = changeCamera(view);
    halfHeight = Math.max(size.y * 0.64, Math.hypot(size.x, size.z) * 0.60 / aspect, 0.1);
    if (view === 'front') halfHeight = Math.max(size.y * 0.64, size.z * 0.64 / aspect, 0.1);
    if (view === 'side') halfHeight = Math.max(size.y * 0.64, size.x * 0.64 / aspect, 0.1);
    if (view === 'top') halfHeight = Math.max(size.x * 0.64, size.z * 0.64 / aspect, 0.1);
    const verticalFov = 35 * Math.PI / 180;
    const limitingFov = Math.min(verticalFov, 2 * Math.atan(Math.tan(verticalFov / 2) * aspect));
    distance = radius / Math.sin(limitingFov / 2) * 1.08;
    const directions = { hero: [1.15, 0.70, 1.45], front: [1, 0, 0], side: [0, 0, 1], top: [0, 1, 0.00001] };
    const direction = new T.Vector3(...directions[view]).normalize();
    if (view === 'hero') {
      const right = new T.Vector3(0, 1, 0).cross(direction).normalize();
      const up = direction.clone().cross(right).normalize();
      const tanVertical = Math.tan(verticalFov / 2), tanHorizontal = tanVertical * aspect;
      let fittedDistance = radius * 0.5;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const corner = new T.Vector3(x, y, z).sub(center);
        fittedDistance = Math.max(fittedDistance, corner.dot(direction) + Math.max(Math.abs(corner.dot(right)) / tanHorizontal, Math.abs(corner.dot(up)) / tanVertical));
      }
      distance = fittedDistance * 1.22;
    }
    camera.position.copy(center).add(direction.multiplyScalar(distance));
    camera.up.set(0, 1, 0);
    if (view === 'top') camera.up.set(1, 0, 0);
    camera.lookAt(center);
    controls.update();
    floor.scale.set(radius * 8, radius * 8, 1);
    floor.position.set(center.x, box.min.y - radius * 0.002, center.z);
    keyLight.position.copy(center).add(new T.Vector3(radius * 2, radius * 3, radius * 2));
    keyLight.target.position.copy(center);
    keyLight.shadow.camera.left = -radius * 2;
    keyLight.shadow.camera.right = radius * 2;
    keyLight.shadow.camera.top = radius * 2;
    keyLight.shadow.camera.bottom = -radius * 2;
    keyLight.shadow.camera.near = radius * 0.1;
    keyLight.shadow.camera.far = radius * 10;
    keyLight.shadow.normalBias = radius * 0.001;
    keyLight.shadow.camera.updateProjectionMatrix();
    currentView = view;
    $$('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    $('#view-name').textContent = viewLabels[view];
    resize();
  }
  function groupFor(mesh) {
    let node = mesh;
    while (node && node !== currentModel?.parent) {
      if (node.userData && node.userData.group) return String(node.userData.group);
      node = node.parent;
    }
    return mesh.name || 'other';
  }
  function applyVisibility() {
    if (!currentModel) return;
    let visible = 0;
    currentModel.traverse((node) => {
      if (!node.isMesh) return;
      node.visible = !hiddenGroups.has(groupFor(node));
      if (node.visible) visible += 1;
    });
    $('#empty').hidden = visible > 0;
    $('#capture').disabled = visible === 0 || busy || contextLost;
    render();
  }
  function showAll() {
    hiddenGroups.clear();
    $$('#parts input').forEach((input) => { input.checked = true; });
    applyVisibility();
    announce('Semua komponen ditampilkan.');
  }
  function buildParts() {
    const container = $('#parts');
    container.replaceChildren();
    const groups = new Map();
    const declared = new Map((currentState.parts || []).map((part) => [part.group || part.name, part.label || part.name]));
    currentModel.traverse((node) => {
      if (!node.isMesh) return;
      const group = groupFor(node);
      let owner = node;
      while (owner.parent && !owner.userData?.group && owner !== currentModel) owner = owner.parent;
      const label = catalog.groupLabels?.[group] || declared.get(group) || owner.userData?.label || node.userData?.label || group.replaceAll('_', ' ');
      if (!groups.has(group)) groups.set(group, label);
    });
    for (const [group, label] of groups) {
      const row = document.createElement('label'); row.className = 'part';
      const input = document.createElement('input'); input.type = 'checkbox'; input.checked = !hiddenGroups.has(group); input.dataset.group = group;
      const name = document.createElement('span'); name.textContent = label;
      input.addEventListener('change', () => {
        input.checked ? hiddenGroups.delete(group) : hiddenGroups.add(group);
        applyVisibility(); announce(`${label} ${input.checked ? 'ditampilkan' : 'disembunyikan'}.`);
      });
      row.append(input, name); container.append(row);
    }
    $('#parts-empty').hidden = groups.size > 0;
    $('#show-all').disabled = groups.size === 0;
  }
  function disposeModel(model) {
    const geometries = new Set(), materials = new Set();
    model.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => materials.add(material));
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => {
      Object.values(material).forEach((value) => { if (value && value.isTexture) value.dispose(); });
      material.dispose();
    });
  }
  function trimCache() {
    // Shared scenes reuse BufferGeometry and Material instances; never dispose on selection.
    if (catalog.bundle) return;
    for (const [key, model] of sceneCache) {
      if (sceneCache.size <= 3) break;
      if (model === currentModel) continue;
      sceneCache.delete(key); disposeModel(model);
    }
  }
  function loadModelScript(asset, state) {
    const key = stateKey(asset, state);
    if (window.PL_MODELS && window.PL_MODELS[key]) return Promise.resolve(window.PL_MODELS[key]);
    if (scriptRequests.has(key)) return scriptRequests.get(key);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const file = state.script || (state.file ? state.file.replace(/\.glb$/i, '.js') : `models/${key}.js`);
      script.src = file; script.async = true;
      let timer;
      const finish = (error) => {
        clearTimeout(timer); script.remove(); scriptRequests.delete(key);
        if (error) reject(error);
        else if (window.PL_MODELS && window.PL_MODELS[key]) resolve(window.PL_MODELS[key]);
        else reject(new Error(`Model data missing: ${key}`));
      };
      script.onload = () => finish();
      script.onerror = () => finish(new Error(`Model file unavailable: ${file}`));
      timer = setTimeout(() => finish(new Error(`Model loading timed out: ${key}`)), 45000);
      document.body.append(script);
    });
    scriptRequests.set(key, promise);
    return promise;
  }
  async function parseBase64GLB(data, label) {
    const binary = atob(data), bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    let parseTimer;
    return Promise.race([
      loader.parseAsync(bytes.buffer, ''),
      new Promise((_, reject) => { parseTimer = setTimeout(() => reject(new Error(`Model parsing timed out: ${label}`)), 45000); })
    ]).finally(() => clearTimeout(parseTimer));
  }
  function loadSharedChunk(file, index) {
    if (typeof window.PL_SHARED_PARTS?.[index] === 'string') return Promise.resolve(window.PL_SHARED_PARTS[index]);
    const key = `bundle:${file}`;
    if (scriptRequests.has(key)) return scriptRequests.get(key);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = file; script.async = true;
      let timer;
      const finish = (error) => {
        clearTimeout(timer); script.remove(); scriptRequests.delete(key);
        if (error) reject(error);
        else if (typeof window.PL_SHARED_PARTS?.[index] === 'string') resolve(window.PL_SHARED_PARTS[index]);
        else reject(new Error(`Shared model chunk missing: ${index}`));
      };
      script.onload = () => finish();
      script.onerror = () => finish(new Error(`Shared model file unavailable: ${file}`));
      timer = setTimeout(() => finish(new Error(`Shared model loading timed out: ${file}`)), 45000);
      document.body.append(script);
    });
    scriptRequests.set(key, promise);
    return promise;
  }
  function loadSharedBundle() {
    if (sharedBundlePromise) return sharedBundlePromise;
    sharedBundlePromise = (async () => {
      const files = catalog.bundle?.scripts;
      if (!Array.isArray(files) || !files.length) throw new Error('Shared model chunk list is missing');
      const chunks = await Promise.all(files.map((file, index) => loadSharedChunk(file, index)));
      const parsed = await parseBase64GLB(chunks.join(''), 'PulseLink');
      if (!Array.isArray(parsed.scenes) || !parsed.scenes.length) throw new Error('Shared model contains no scenes');
      for (const model of parsed.scenes) model.traverse((node) => {
        if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
      });
      // Parsed scenes now own their shared buffers. Release the encoded script payloads.
      window.PL_SHARED_PARTS = [];
      return parsed;
    })().catch((error) => { sharedBundlePromise = null; throw error; });
    return sharedBundlePromise;
  }
  function showFailure(error, webglFailure = false) {
    console.error('PulseLink viewer:', error);
    busy = false;
    $('#model-frame').setAttribute('aria-busy', 'false');
    $('#loading').hidden = true; $('#empty').hidden = true; $('#fallback').hidden = false;
    $('#error-text').textContent = webglFailure
      ? 'Aktifkan akselerasi grafis pada browser, lalu coba lagi. Pratinjau statis tetap tersedia.'
      : 'Model belum berhasil dimuat. Pastikan seluruh folder tersedia, lalu coba lagi.';
    const fallback = $('#fallback-image');
    fallback.hidden = false;
    fallback.src = `assets/previews/${currentAsset?.id || 'ebike'}.png`;
    fallback.alt = `Pratinjau statis ${currentAsset?.name || 'PulseLink'}, konfigurasi terpasang`;
    fallback.onerror = () => { fallback.hidden = true; };
    setControlsEnabled(false);
    announce('Tampilan 3D belum tersedia. Gunakan pratinjau statis atau pilih Coba lagi.');
  }
  function updateMetadata(asset, state) {
    const meta = assetMeta[asset.id] || ['Rancangan layanan', asset.name, ''];
    $('#asset-title').textContent = asset.name;
    $('#asset-category').textContent = meta[0];
    $('#stage-asset').textContent = asset.name;
    $('#stage-state').textContent = stateLabel(state);
    $('#detail-heading').textContent = asset.name;
    $('#description').textContent = asset.description || 'Perangkat dan fasilitas dalam rancangan layanan PulseLink.';
    $('#state-note').textContent = Array.isArray(state.notes) ? state.notes.join(' ') : (state.notes || state.description || 'Lihat hubungan antarbagian melalui konfigurasi model.');
    updateDimensions(state);
    $$('.asset-button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.asset === asset.id)));
    $$('.state-button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.state === state.id)));
    document.title = `${asset.name} — PulseLink`;
  }
  async function select(assetId, stateId) {
    const asset = assets.find((entry) => entry.id === assetId);
    if (!asset || !Array.isArray(asset.states) || !asset.states.length) return;
    const state = asset.states.find((entry) => entry.id === stateId) || asset.states[0];
    const ticket = ++requestVersion;
    if (currentAsset?.id !== asset.id) { hiddenGroups.clear(); buildStates(asset); }
    currentAsset = asset; currentState = state; busy = true;
    window.PL_READY = null;
    updateMetadata(asset, state);
    try { history.replaceState(null, '', `#${asset.id}/${state.id}`); } catch (_) { /* Some file viewers do not allow history changes. */ }
    $('#loading-text').textContent = `Memuat ${asset.name.toLowerCase()}…`;
    $('#model-frame').setAttribute('aria-busy', 'true');
    $('#loading').hidden = false; $('#fallback').hidden = true; $('#empty').hidden = true;
    $('#parts').replaceChildren(); $('#parts-empty').hidden = true; $('#show-all').disabled = true;
    setControlsEnabled(false); announce(`Memuat ${asset.name.toLowerCase()}, ${stateLabel(state).toLowerCase()}…`);
    if (!renderer || contextLost) { showFailure(new Error('WebGL is unavailable'), true); return; }
    try {
      const key = stateKey(asset, state);
      let model;
      if (catalog.bundle) {
        const parsed = await loadSharedBundle();
        if (!Number.isInteger(state.scene_index) || !parsed.scenes[state.scene_index]) throw new Error(`Shared scene is missing: ${key}`);
        model = parsed.scenes[state.scene_index];
      } else {
        model = sceneCache.get(key);
        if (!model) {
          const parsed = await parseBase64GLB(await loadModelScript(asset, state), key);
          model = parsed.scene;
          model.traverse((node) => {
            if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
          });
          sceneCache.set(key, model);
        }
      }
      if (ticket !== requestVersion) { trimCache(); return; }
      if (currentModel) scene.remove(currentModel);
      currentModel = model; scene.add(model);
      fit('hero'); buildParts();
      busy = false;
      $('#model-frame').setAttribute('aria-busy', 'false'); $('#loading').hidden = true;
      setControlsEnabled(true); applyVisibility(); trimCache();
      announce(`${asset.name}, ${stateLabel(state).toLowerCase()}, siap dijelajahi.`);
      window.PL_READY = key;
    } catch (error) { if (ticket === requestVersion) showFailure(error); }
  }
  function buildStates(asset) {
    const list = $('#state-list'); list.replaceChildren();
    for (const state of asset.states) {
      const button = document.createElement('button'); button.className = 'state-button'; button.dataset.state = state.id;
      button.textContent = stateLabel(state); button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => select(asset.id, state.id)); list.append(button);
    }
  }
  function buildAssets() {
    const list = $('#asset-list'); list.replaceChildren();
    for (const asset of assets) {
      const meta = assetMeta[asset.id] || ['Rancangan layanan', asset.name, '<circle cx="16" cy="16" r="10"/>'];
      const button = document.createElement('button'); button.className = 'asset-button'; button.dataset.asset = asset.id;
      button.setAttribute('aria-pressed', 'false');
      const icon = document.createElement('span'); icon.className = 'asset-icon'; icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = `<svg viewBox="0 0 32 32">${meta[2]}</svg>`;
      const name = document.createElement('span'); name.className = 'asset-name'; name.textContent = asset.name;
      const subtitle = document.createElement('span'); subtitle.className = 'asset-subtitle'; subtitle.textContent = meta[0];
      name.append(subtitle); button.append(icon, name);
      button.addEventListener('click', () => select(asset.id)); list.append(button);
    }
  }
  function turn(direction) {
    if (!camera || busy) return;
    markCustomView();
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new T.Spherical().setFromVector3(offset);
    if (direction === 'left') spherical.theta -= 0.24;
    if (direction === 'right') spherical.theta += 0.24;
    if (direction === 'up') spherical.phi = Math.max(0.08, spherical.phi - 0.18);
    if (direction === 'down') spherical.phi = Math.min(Math.PI - 0.08, spherical.phi + 0.18);
    camera.up.set(0, 1, 0);
    camera.position.copy(controls.target).add(new T.Vector3().setFromSpherical(spherical));
    controls.update(); render();
  }
  function zoom(factor) {
    if (!camera || busy) return;
    if (camera.isPerspectiveCamera) {
      const offset = camera.position.clone().sub(controls.target);
      const nextDistance = T.MathUtils.clamp(offset.length() / factor, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(nextDistance)); controls.update();
    } else { camera.zoom = T.MathUtils.clamp(camera.zoom * factor, 0.25, 6); camera.updateProjectionMatrix(); }
    render();
  }
  async function capture() {
    if (!renderer || busy || !currentModel) return;
    const button = $('#capture'); button.disabled = true;
    const previousRatio = renderer.getPixelRatio();
    const captureAsset = currentAsset, captureState = currentState, captureView = currentView;
    try {
      const width = 2400, height = Math.round(width * stage.clientHeight / stage.clientWidth);
      renderer.setPixelRatio(1); renderer.setSize(width, height, false); render();
      const output = document.createElement('canvas'); output.width = width; output.height = height + 140;
      const ctx = output.getContext('2d');
      ctx.fillStyle = '#eaf0eb'; ctx.fillRect(0, 0, output.width, output.height);
      ctx.drawImage(renderer.domElement, 0, 0);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, height, width, 140);
      ctx.fillStyle = '#103d3b'; ctx.font = '600 37px Segoe UI, Arial, sans-serif';
      ctx.fillText(`PulseLink / ${captureAsset.name}`, 58, height + 61);
      ctx.fillStyle = '#596e66'; ctx.font = '27px Segoe UI, Arial, sans-serif';
      ctx.fillText(`${stateLabel(captureState)} · ${viewLabels[captureView]} · Prototipe konsep`, 58, height + 106);
      const blob = await new Promise((resolve, reject) => output.toBlob((value) => value ? resolve(value) : reject(new Error('PNG capture is unavailable')), 'image/png'));
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `PulseLink_${stateKey(captureAsset, captureState)}_${captureView}.png`;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      announce('Gambar PNG disiapkan. Jika belum terlihat, periksa folder unduhan browser.');
    } catch (error) {
      console.error('PulseLink image capture:', error);
      announce('Gambar belum dapat disimpan. Coba lagi atau gunakan tangkapan layar browser.');
    } finally {
      renderer.setPixelRatio(previousRatio); resize();
      button.disabled = busy || contextLost || !$('#empty').hidden;
    }
  }
  function initializeRenderer() {
    contextLost = false;
    if (!T) throw new Error('Three.js bundle is unavailable');
    if (controls) controls.dispose();
    if (renderer) renderer.dispose();
    if (resizeObserver) resizeObserver.disconnect();
    if (floor) { floor.geometry.dispose(); floor.material.dispose(); }
    stage.replaceChildren();
    renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xeaf0eb, 1);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.domElement.setAttribute('aria-label', 'Model 3D PulseLink. Gunakan tombol sudut pandang, putar, dan perbesar sebagai alternatif gerakan seret.');
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault(); contextLost = true; requestVersion += 1;
      showFailure(new Error('WebGL context lost'), true);
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => { contextLost = false; select(currentAsset.id, currentState.id); });
    stage.append(renderer.domElement); scene = new T.Scene(); center = new T.Vector3();
    scene.add(new T.HemisphereLight(0xffffff, 0x829687, 1.8));
    keyLight = new T.DirectionalLight(0xffffff, 2.8); keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048); keyLight.shadow.bias = -0.0003;
    scene.add(keyLight, keyLight.target);
    const fill = new T.DirectionalLight(0xe1eee7, 1.2); fill.position.set(-5, 3, -5); scene.add(fill);
    floor = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShadowMaterial({ opacity: 0.12 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    loader = new T.GLTFLoader();
    resizeObserver = new ResizeObserver(() => {
      if (currentModel && !busy && currentView !== 'custom') fit(currentView);
      else resize();
    });
    resizeObserver.observe(stage);
  }
  function retry() {
    try {
      if (!renderer || contextLost) initializeRenderer();
      select(currentAsset?.id || assets[0]?.id, currentState?.id);
    } catch (error) { showFailure(error, true); }
  }
  function start() {
    buildAssets();
    $('#show-all').addEventListener('click', showAll); $('#empty-show-all').addEventListener('click', showAll);
    $('#retry').addEventListener('click', retry); $('#capture').addEventListener('click', capture);
    $('#reset-view').addEventListener('click', () => { fit('hero'); announce('Sudut pandang diatur ulang.'); });
    $$('[data-view]').forEach((button) => button.addEventListener('click', () => { fit(button.dataset.view); announce(`Sudut pandang ${button.textContent.toLowerCase()} dipilih.`); }));
    $$('[data-turn]').forEach((button) => button.addEventListener('click', () => turn(button.dataset.turn)));
    $$('[data-zoom]').forEach((button) => button.addEventListener('click', () => zoom(Number(button.dataset.zoom))));
    if (!assets.length) { showFailure(new Error('Model catalog is missing')); $('#error-text').textContent = 'Katalog belum tersedia. Buka kembali folder viewer yang lengkap.'; return; }
    try { initializeRenderer(); } catch (error) { console.error('PulseLink renderer:', error); }
    const [hashAsset, hashState] = location.hash.slice(1).split('/');
    const query = new URLSearchParams(location.search);
    const assetId = hashAsset || query.get('asset');
    const stateId = hashState || query.get('state');
    select(assets.some((asset) => asset.id === assetId) ? assetId : assets[0].id, stateId);
  }
  window.PL_API = {
    select, fit, showAll, turn, zoom, capture, retry, render, resize,
    get active() { return currentState && currentAsset ? stateKey(currentAsset, currentState) : null; },
    get asset() { return currentAsset; }, get state() { return currentState; }, get model() { return currentModel; },
    get camera() { return camera; }, get controls() { return controls; }, get renderer() { return renderer; }, get scene() { return scene; },
    get busy() { return busy; }, get hiddenGroups() { return [...hiddenGroups]; },
    setCapture(position, target, cameraZoom = 1) {
      if (!camera) return;
      markCustomView();
      camera.position.set(...position); controls.target.set(...target); camera.up.set(0, 1, 0);
      camera.zoom = cameraZoom; camera.updateProjectionMatrix(); controls.update(); render();
    }
  };
  start();
})();
