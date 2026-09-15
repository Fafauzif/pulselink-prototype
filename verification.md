# Viewer verification

- JavaScript syntax: `node --check assets/app.js` and `node --check assets/vendor/three-bundle.js` passed during implementation.
- Runtime code is static; no network package or hosted application connection is required.
- The Three.js library is reused from the supplied reference; its license is preserved.
- Premium frontend static audit: strict mode passed with zero findings.
- `python verify_viewer.py`: passed, 5,265 checks. The compact-format validator checks local runtime references, eight fallback images, eight assets/17 scenes, ordered shared-chunk/GLB byte parity, finite node transforms, positive dimensions, and color token parity.
- `node verify_gltf.cjs`: passed for all 17 scenes of the compact shared GLB using the shipped GLTFLoader. Every mesh has a component group; parsed dimensions agree with the native CAD catalog after the documented Y/Z mapping, within tessellation tolerance. The shared model hash and per-scene details are in `verification/gltf-loader-check.json`.
- Browser interaction testing was not executed: the available browser security policy rejected local file access. No alternate access route was attempted.
- Static previews are source-derived CAD geometry renders, not browser screenshots.

This report distinguishes static checks from browser behavior. It does not claim native Windows execution, GPU compatibility, or a live Vercel deployment.

- `designmd lint` could not run because the optional npm package was absent from the offline cache. DESIGN.md structure and CSS token parity are checked by the included Python validator; this is recorded separately from the unavailable official CLI lint.

- Final source review fixed group-label ownership, CAD/glTF dimension mapping, obsolete request protection, parsing timeout, PNG metadata during selection changes, keyboard alternatives, and responsive preset refitting. Interactive browser actions and PNG download are prepared but have not been exercised in a browser.

- Compact format: one multi-scene GLB is parsed once, with shared geometry and materials preserved across selections. Both the compact catalog and legacy per-state catalog are supported. The shared loader uses bounded script/parse timeouts, retry, and the same fallback/error UI.

- Shared-scene merge parity: all 17 scenes match the original native GLBs for mesh position/normal/index bytes, world transforms, group metadata, and presentation material values. Results are in `verification/scene-parity-check.json`.
- Final compact runtime and verifier JavaScript syntax checks passed. Each shipped script chunk is at or below 12 MiB.
