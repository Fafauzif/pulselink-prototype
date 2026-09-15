---
version: alpha
colors:
  primary: "#103d3b"
  primary-hover: "#215b55"
  canvas: "#f3f5f1"
  surface: "#ffffff"
  stage: "#eaf0eb"
  ink: "#203733"
  muted: "#596e66"
  line: "#d8e1da"
  accent: "#d83847"
  selected: "#dce9e1"
  focus: "#a42b3a"
  error: "#9b283a"
  on-primary: "#ffffff"
typography:
  display:
    fontFamily: "Jakarta, Segoe UI, sans-serif"
    fontSize: "34px"
    lineHeight: "1.18"
  body:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "15px"
    lineHeight: "1.5"
  utility:
    fontFamily: "Consolas, Courier New, monospace"
    fontSize: "14px"
    lineHeight: "1.3"
rounded:
  control: "8px"
  panel: "14px"
spacing:
  unit: "4px"
  md: "16px"
  lg: "24px"
components:
  primary-button:
    backgroundColor: "#103d3b"
    color: "#ffffff"
  selected-asset:
    backgroundColor: "#103d3b"
    color: "#ffffff"
  state-button:
    backgroundColor: "#dce9e1"
    color: "#103d3b"
---

# PulseLink explorer design

## Overview

A product explorer for the MRT PulseLink shared mobility concept. Its audience is competition reviewers, team members, and prospective service stakeholders. Its single job is to make the component relationships understandable through a working model.

The approved reference is the user's RIMBA viewer: restrained colors, rounded mechanical forms, separate assembled/service states, and clear inspection controls. This implementation adds PulseLink's supplied red symbol, a teal transport equipment palette, and a persistent object rail that acts as an index of the service. The large, quiet model stage is the signature; ornamental decoration must not compete with it.

The surface is a product tool, not a marketing landing page. Indonesian is the single UI locale, with English retained only in established product names such as PulseLink and e-bike. No Japan-market flows apply. The models illustrate a proposed service; the UI does not establish engineering certification, field validation, procurement, or operating agreements.

## Colors

The runtime token owner is the `:root` block in `assets/style.css`. This document mirrors its accepted semantic values. All shared controls consume those variables. The extraction check in `verify_viewer.py` verifies color drift.

Teal is for the selected object and the primary capture action. Red is reserved for the provided PulseLink mark and keyboard focus. Pale green distinguishes the model surface and service-state note. Off-white surrounds the stage; text stays dark enough to read at small utility sizes. An error remains written in plain language and does not rely on red alone.

## Typography

Plus Jakarta Sans SemiBold is bundled locally as `Jakarta` and used for the brand, asset names, and headings. Segoe UI provides familiar Windows body and control text. Consolas separates dimensions from prose. Avoid excessive display text; the asset itself owns the stage.

No font CDN or late external stylesheet is used. Main regions reserve space during font loading. The layout uses wrapping rather than ellipses for object names and component labels.

## Layout

Desktop: object rail, model workspace, details/parts panel. Below 1190px the details panel moves beneath the stage; below 760px the object rail becomes a horizontally scrollable native button row, followed by the stage and details. Page scrolling remains natural. The stage owns a bounded canvas region; the component list owns its own scroll only after 360px.

The canvas remains stable through loading, failure, and all-hidden states. View controls stay in one position. The global scrollbar rules apply to all owned scrolling surfaces, with visible thumb, track, hover, active, and forced-colors treatment.

## Elevation & Depth

The model's light and floor shadow provide most depth. Only floating camera controls and the active asset receive a small shadow. Static panels rely on spacing and lines. No ambient animation or auto-rotation distracts from inspection.

## Shapes

8px control radii and 14px stage/panel radii echo the rounded equipment. The prototype label is small and rectangular. Avoid decorative pill counters, oversized ornamental badges, or arbitrary sequence numbering.

## Components

| Contract token | Runtime target | Consumers |
|---|---|---|
| `colors.*` | `--color-*` | Buttons, stage, text, borders, status |
| `typography.display` | `--font-display` | Brand, headings, asset names |
| `typography.body` | `--font-body` | Prose, labels, controls |
| `typography.utility` | `--font-utility` | Dimensions, stage caption |
| `rounded.control` | `--radius-control` | Buttons, notes |
| `rounded.panel` | `--radius-panel` | Stage and error panel |
| `spacing.*` | `--space-*` | Shared documented rhythm |

The complete canonical behavior map lives in `UX-CONTRACT.md`. `assets/app.js` owns asset/state selection, stale-load protection, status messages, component visibility, camera actions, retry, and PNG capture. Native buttons and checkboxes are shared across every asset. The help disclosure is native `<details>`; it is not a modal.

## Do's and Don'ts

- Keep the object recognizable and the selected state explicit.
- Use identical labels and controls for identical actions across assets.
- Keep all rotating/zooming actions available through buttons.
- Present model dimensions as illustrative and editable.
- Respect reduced motion and keyboard focus.
- Do not imply that a concept component has been constructed, tested, or procured.
- Do not add app connections, authentication, analytics, remote scripts, or a build process to view these files.
