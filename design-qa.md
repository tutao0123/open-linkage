# Homepage mechanism preview — design QA

## Target and implementation

- Source reference: `C:\Users\39007\.codex\generated_images\019fbcc9-2e33-7051-b711-b64b3728334b\exec-262c3146-14d7-490f-8e0f-e01f90a53001.png`
- Implementation screenshot: `C:\Users\39007\.codex\visualizations\2026\08\01\019fbcc9-2e33-7051-b711-b64b3728334b\home-option-2-preview.png`
- Combined comparison: `C:\Users\39007\.codex\visualizations\2026\08\01\019fbcc9-2e33-7051-b711-b64b3728334b\home-option-2-comparison.png`
- Implemented in:
  - `src/components/home-mechanism-preview.tsx`
  - `src/components/home-mechanism-preview.module.css`
  - `src/components/home-page.module.css`

## Comparison state

- Desktop: 1440 × 900 viewport, DPR 1, `/en`, top of page, mechanism playing.
- Mobile: 390 × 844 viewport, DPR 1, `/en`, top of page, mechanism playing.
- The reference and implementation use different crank phases; comparison therefore focuses on the stable composition, real four-leg topology, datum system, framing, typography, and status surfaces.

## Fidelity surfaces

1. Global composition — The preview is right-aligned in the desktop hero and returns to centered alignment at 1050px and below. At 1440px the mechanism group is centered slightly to the right with a safe right margin and no clipping.
2. Container and framing — The existing dark engineering viewport, grid, header, ground line, status footer, and acid-green system are preserved.
3. Typography and labels — The large center `OPENLINKAGE / 4-LEG WALK` chassis label is removed. The compact top instrument label and all real status labels remain.
4. Mechanism and data overlay — All four animated legs and foot paths still use the generated mechanism scene. Two station datum lines, a fixed-joint horizontal datum, acid registration ticks, and the foot-path dimension are derived from scene coordinates and metrics.
5. Responsive and interactive behavior — Mobile has no horizontal overflow, the extra in-canvas dimension label is hidden below 700px, and the 44px play/pause control toggles correctly by keyboard-accessible button state.

## Comparison history

- Iteration 1 — Removed the center chassis, added real-data datums, and shifted the mechanism by 58 SVG units. Desktop measurement placed the mechanism center at approximately 43% of the preview width, leaving it visibly too far left. Severity: P2.
- Fix — Increased the internal composition offset to 105 SVG units while retaining the desktop frame's right alignment and the tablet/mobile centering override.
- Iteration 2 — Side-by-side comparison shows the center block removed, the mechanism occupying the intended right-biased engineering viewport, fixed-joint registration marks present, and adequate right-side clearance. No remaining P0, P1, or P2 fidelity issues.

## Functional and responsive checks

- Desktop preview: 749px wide inside the 1440px viewport; no center brand block; no document overflow.
- Full-cycle sampling: five evenly spaced animation samples retained at least 71px left clearance and 90px right clearance inside the SVG viewport.
- Mobile preview: 333px wide inside the 390px viewport; document width equals the usable viewport width; no center brand block.
- Play/pause: button changed from `Pause mechanism motion` to `Play mechanism motion` and back.
- Browser console: no warnings or errors.
- Automated checks: `npx tsc --noEmit`, `npm run lint`, 110 tests, and `npm run build` passed.

final result: passed
