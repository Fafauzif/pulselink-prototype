# PulseLink explorer interaction contract

## Product evidence

The user approved a complete editable CadQuery/Blender kit with a standalone RIMBA-style viewer, offline viewing, Windows use, and a separate GitHub/Vercel-ready viewer ZIP inside the complete ZIP. The supplied MRT PulseLink master context and solution document establish a service concept for MRT first/last-mile mobility; they do not establish built equipment or partner contracts.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Scrollbar | Global `assets/style.css` rules | DESIGN.md | Native document, bounded component list | Static token check + browser |
| Toast | `announce()` in `assets/app.js`, persistent `#status` | This contract | Neutral selection/capture/recovery status | Live region and browser |
| Selection | `buildAssets()`, `buildStates()` | Catalog and this contract | Native button groups with aria-pressed | Keyboard and browser |
| Visibility | `buildParts()`, `applyVisibility()` | glTF extras and catalog | Native labeled checkboxes | Browser + all-hidden state |
| Disclosure | Native `details.help` | This contract | Non-modal help | Native keyboard |

Select/Listbox, Table Selection, Date, Form, CRUD, Auth, monetary actions, irreversible actions, PII, and remote mutations do not apply. Asset choices are button groups, not select inputs. No equivalent screen-local primitives exist.

## Shared behavior

- Asset choice selects its first available state and resets hidden groups. State choice within an asset preserves visibility choices for groups present in that state.
- `aria-pressed` identifies the currently selected asset, state, and camera preset. URL hash records asset/state for a shareable view. Camera movement is transient.
- The compact catalog uses one shared multi-scene GLB. The first selection loads its ordered base64 script chunks once; later selections reuse the parsed scenes. Shared geometries/materials remain alive when changing state. A catalog without a bundle retains the per-state loader.
- Requests are versioned; a model that finishes after a newer selection cannot replace that selection. Script loading has a timeout and an explicit retry action.
- The stage is a stable region for success, loading, missing model, unavailable graphics, and all-hidden states. It has `aria-busy` during loading. A single polite live region reports actions. Retry is explicit rather than an endless automatic loop.
- On a load failure, the current asset's static assembled preview is shown, with accurate fallback alt text. A failed fallback image is hidden and recovery text remains usable.
- A missing catalog explains that the full viewer folder is required. An asset without separate group data uses available mesh names; an empty parts inventory is explained.
- View/capture controls are disabled while the selected model is loading or graphics are unavailable. Asset/state choices remain available. PNG capture is also disabled when every mesh is hidden.
- “Tampilkan semua” restores visibility. “Atur ulang” restores the perspective camera only. Neither action modifies source geometry.
- PNG captures the current visible geometry and includes the object/state and “Prototipe konsep”. Downloads are local, with no upload.
- The viewer performs no API calls, analytics, user tracking, account operations, or business transactions.

## Accessibility, layout, and locale

Native buttons, checkboxes, and details disclosure own keyboard behavior. All icon-only actions have Indonesian accessible labels and titles. Dragging has turn/zoom button alternatives. A skip link reaches the model workspace. Mouse, keyboard, reduced motion, and a narrow viewport are part of browser QA. Color is not the sole selection/state signal.

Indonesian (`id-ID`) owns UI text and number formatting. Asset/component names and descriptions come from the shipped Indonesian catalog. No authentication, locale switching, or date entry is present. Static code evidence does not claim full screen-reader certification.
