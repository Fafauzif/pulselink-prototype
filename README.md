# PulseLink 3D viewer

A standalone static viewer for the PulseLink concept models. No account, API key, npm installation, or build step is needed to open it.

## Open on Windows

1. Extract this entire folder. Do not open `index.html` from inside a compressed ZIP.
2. Double-click `index.html`. Current Chrome or Edge with hardware acceleration enabled is recommended.
3. Keep `assets/` and `models/` beside `index.html`.

The HTML, local font, Three.js library, shared model data, and static previews are bundled. The first object loads the shared model once; subsequent object/state selections reuse its geometry. Interactive loading uses ordinary local script files so the viewer can also run from `file://` without a development server. If graphics acceleration is unavailable, the viewer offers a static assembled preview.

## GitHub → Vercel

The larger kit contains a separate viewer ZIP. **Extract that ZIP first, then upload its contents to a GitHub repository. Uploading the ZIP itself does not deploy a website.**

1. Create a GitHub repository and put `index.html`, `vercel.json`, `assets/`, and `models/` at its root. The remaining docs can be kept there too. Preserve every subfolder.
2. In Vercel, add a new project and import that repository.
3. Use **Framework Preset: Other**. Root Directory is the directory containing `index.html`. If you uploaded a containing `viewer/` folder, select that folder as Root Directory.
4. Leave **Build Command** and **Install Command** empty. Output Directory is `.`. The included `vercel.json` supplies these settings.
5. Deploy, then check all eight asset choices and the PNG action on the resulting URL.

No environment variables or server functions are required. Nothing has been published by preparing this package. Later model changes are deployed by committing the replaced generated files and allowing Vercel to redeploy.

Vercel's documented static-HTML workflow uses the Other preset and an empty build command; projects without a public folder can serve the project root. Source checked 2026-09-15: [Vercel — Configuring a Build](https://vercel.com/docs/builds/configure-a-build#skip-build-step), [Output Directory](https://vercel.com/docs/builds/configure-a-build#output-directory).

If GitHub's browser upload rejects an unusually large model file, use GitHub Desktop or Git to commit the extracted files. Do not omit model JS files or upload only the GLBs.

## Controls

- Choose an object, then a configuration.
- Toggle component checkboxes to inspect inside the model.
- Use Perspective/Front/Side/Top or the rotate/zoom buttons. Dragging and the mouse wheel are also supported.
- “Tampilkan semua” restores components. “Atur ulang” restores the camera.
- “Simpan gambar” downloads a PNG of the current view and visible components.
- Object/state selection is stored in the URL hash, so a deployed link can open a particular configuration.

## Edit and regenerate

`assets/app.js`, `assets/style.css`, and `index.html` are readable viewer source. `assets/catalog.js` and the files under `models/` are generated from the CAD build in the larger kit. To change dimensions, edit the shared CAD configuration and rebuild using the larger kit's launcher; copy the generated viewer model/catalog outputs together. Blender mesh edits do not update these files automatically.

The compact release uses one `models/pulselink.glb` containing all 17 scenes, with shared geometry and materials. `catalog.bundle` identifies that GLB and its ordered `pulselink.0.js`, `pulselink.1.js`, … script chunks. Those scripts assign pieces of one base64 string to `window.PL_SHARED_PARTS[index]`; the viewer joins them, parses the GLB once, and selects `parsed.scenes[state.scene_index]`. Preserve the catalog and every chunk together. Selection never disposes shared geometry/materials. For compatibility, a catalog without `bundle` can still use per-state `models/<key>.glb` plus matching `.js` assignments to `window.PL_MODELS['<key>']`. glTF is Y-up in metres. Dimensions in the catalog retain native CAD millimetres ordered length (X), width (Y), height (Z). The viewer maps these to its length/height/width labels using indexes 0, 2, 1. The GLB coordinate system is length X, height Y, width Z. Group visibility reads glTF node extras `group` and `label`.

`assets/vendor/three-bundle.js` is the bundled Three.js + OrbitControls + GLTFLoader code extracted from the user-provided RIMBA viewer, with a small `window.PL3D` export adapter. The original robot models/application are not included. See `assets/vendor/THREE-LICENSE.txt`. The locally bundled Plus Jakarta Sans font is covered by `assets/FONT-OFL.txt`.

## Validation

Run `python verify_viewer.py` for local static/catalog checks. This requires Python only for verification; viewing does not require Python. The optional command `node verify_gltf.cjs` parses the shared GLB and all its scenes through the actual bundled loader and checks component groups and catalog bounds. It writes `verification/gltf-loader-check.json`. Node.js is not needed to view the site. QA evidence and limitations are in `verification.md`. Static checks cannot prove that every Windows GPU/browser combination supports WebGL.
