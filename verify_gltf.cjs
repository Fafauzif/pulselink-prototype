/* Optional Node.js check of the actual bundled loader against every shipped GLB.
 * This parses real geometry without creating a browser or WebGL renderer.
 * Usage: node path/to/viewer/verify_gltf.cjs
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = __dirname;
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
global.window = {};
global.self = global;
const library = fs.readFileSync(path.join(root, 'assets/vendor/three-bundle.js'));
vm.runInThisContext(library.toString('utf8'), { filename: 'three-bundle.js' });
vm.runInThisContext(fs.readFileSync(path.join(root, 'assets/catalog.js'), 'utf8'), { filename: 'catalog.js' });

(async () => {
  const T = window.PL3D;
  const results = [];
  const bundle = window.PL_CATALOG.bundle;
  let sharedParsed = null, sharedBytes = null;
  if (bundle) {
    sharedBytes = fs.readFileSync(path.join(root, bundle.file));
    const buffer = sharedBytes.buffer.slice(sharedBytes.byteOffset, sharedBytes.byteOffset + sharedBytes.byteLength);
    sharedParsed = await new T.GLTFLoader().parseAsync(buffer, '');
  }
  for (const asset of window.PL_CATALOG.assets) for (const state of asset.states) {
    const bytes = sharedBytes || fs.readFileSync(path.join(root, state.file));
    let model;
    if (sharedParsed) {
      if (!Number.isInteger(state.scene_index) || !sharedParsed.scenes[state.scene_index]) throw new Error(`Shared scene is missing: ${state.key}`);
      model = sharedParsed.scenes[state.scene_index];
    } else {
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      model = (await new T.GLTFLoader().parseAsync(buffer, '')).scene;
    }
    model.updateMatrixWorld(true);
    let meshes = 0, groupedMeshes = 0;
    const groups = new Set();
    model.traverse((node) => {
      if (!node.matrix.elements.every(Number.isFinite) || !node.matrixWorld.elements.every(Number.isFinite)) throw new Error(`Non-finite transform: ${state.key}/${node.name}`);
      if (node.isMesh) {
        meshes += 1;
        if (node.userData.group) { groupedMeshes += 1; groups.add(node.userData.group); }
      }
    });
    const bounds = new T.Box3().setFromObject(model).getSize(new T.Vector3());
    if (!meshes || groupedMeshes !== meshes || !Number.isFinite(bounds.length()) || bounds.length() <= 0) {
      throw new Error(`Model or group data is invalid: ${state.key}`);
    }
    // Tessellated curved bounds may sit slightly inside exact CAD bounds.
    const toleranceM = Math.max(0.003, Math.max(...state.dimensions_mm) / 1000 * 0.001);
    if (bounds.toArray().some((value, index) => Math.abs(value - state.dimensions_mm[[0, 2, 1][index]] / 1000) > toleranceM)) {
      throw new Error(`Catalog dimensions differ from parsed geometry: ${state.key}`);
    }
    results.push({ key: state.key, scene_index: bundle ? state.scene_index : null, sha256: hash(bytes), meshCount: meshes, groupedMeshCount: groupedMeshes, groups: [...groups], bounds_m: bounds.toArray(), catalog_bound_tolerance_mm: toleranceM * 1000 });
  }
  if (sharedParsed && sharedParsed.scenes.length !== results.length) throw new Error('Shared scene count does not match catalog');
  const report = {
    passed: true,
    check: 'Actual bundled GLTFLoader parsing, group extras, and catalog-bound agreement; no browser/WebGL execution',
    library_sha256: hash(library),
    format: bundle ? 'shared multi-scene GLB' : 'per-state GLB',
    shared_scene_count: sharedParsed ? sharedParsed.scenes.length : null,
    model_count: results.length,
    models: results
  };
  const reportDir = path.join(root, 'verification');
  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'gltf-loader-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, model_count: results.length, report: 'verification/gltf-loader-check.json' }, null, 2));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
