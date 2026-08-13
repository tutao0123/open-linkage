# Sketch Mechanism Canvas Design QA

## Comparison setup

- Source visual truth: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-style-match/source-straight-line-1440.png`
- Final implementation: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-style-match/implementation-cam-fit-loaded-1440.png`
- Focused source canvas: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-style-match/straight-line-canvas-style.png`
- Focused geared X–Y canvas: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-style-match/implementation-xy-final-1440.png`
- Viewport: 1440 × 900 CSS px; screenshots are 1440 × 900 px at 1× density.
- State: precomputed candidates loaded; dual-cam selected for the final full-view comparison; geared X–Y inspected separately.

## Full-view comparison evidence

The implementation now follows the straight-line workbench's canvas grammar: the same warm gray grid, black and muted-blue mechanism strokes, white joint centers, lime active joints and trace, compact monospace joint labels, square controls, and thin technical borders. The Sketch workbench retains its intentionally different three-column information architecture and cat target content.

## Focused region comparison evidence

The focused mechanism views show the same J/F/P joint-marker construction and fixed-support hatching as the classic linkage canvas. Cam profiles and gear wheels are the only family-specific outlines; their pushrods and cross-slide are rendered with the existing linkage stroke hierarchy rather than with a separate CAD or photorealistic style.

## Required fidelity surfaces

- Fonts and typography: existing Geist and Cascadia Mono stacks are unchanged; on-canvas labels use the same compact technical hierarchy as the reference.
- Spacing and layout rhythm: the current workbench grid is preserved. Non-linkage mechanisms now open at 80% so the complete cat trace and drive assembly remain discoverable.
- Colors and visual tokens: background, grid, black, muted blue, lime, border, and panel colors reuse the existing OpenLink tokens.
- Image quality and asset fidelity: all mechanism geometry remains native, sharp, animated vector output; no raster placeholder or mismatched illustration style was introduced.
- Copy and content: long operational explanations remain in the side panel. The canvas contains only concise mechanism identifiers so labels no longer obscure motion.

## Comparison history

1. Initial comparison found P2 visual drift: orange/blue schematic styling, long explanatory labels over the mechanism, a broad ground-base line, and a 100% default scale made the cam and X–Y views feel unlike the classic linkage canvas.
2. Fixes: replaced orange with the reference black/blue hierarchy, introduced classic joint and support markers, removed broad ground scaffolding and long canvas labels, simplified part labels to J/F/P and X/Y, and set an 80% default fit for cam and X–Y families.
3. Post-fix evidence: `implementation-cam-fit-loaded-1440.png` and `implementation-xy-final-1440.png` show the corrected linkage-style treatment. No actionable P0, P1, or P2 differences remain for the requested visual-language match.

## Interaction verification

- Candidate loading and selection work.
- Playback advances the input angle and can be paused.
- Zoom changes from the family-specific fit value.
- A clean browser session reports no console errors.
- The existing middle-button pan mapping remains covered by its unit tests.

## Flat gear-bank refinement

- Requested target: replace the abstract harmonic circles with directly visible, horizontally arranged gear pairs.
- Before: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-style-match/implementation-xy-final-1440.png`
- After: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-flat-gears/flat-gears-labeled-1440.png`
- The final X and Y rows expose four meshing input/output gear pairs, their `1×–4×` ratios, eccentric pins, summing links, output blocks, and the shared J1 input. The previous P2 ambiguity—circles that could be read as abstract harmonic nodes rather than gears—is resolved.
- Playback was verified from 0° to approximately 30° with no browser console errors; the flat gears, eccentric pins, linkage summation, cross-slide, and drawing point remain synchronized.

## Full gear-bank option and cam-arrow refinement

- Requested target: keep a compact representation but add a direct, full gear-bank view; remove flowchart-like arrows from the dual-cam mechanism.
- Full gear-bank evidence: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-full-gear-option/full-gear-bank.png`
- Dual-cam evidence: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-full-gear-option/dual-cam-no-arrows.png`
- The canvas now exposes a keyboard-focusable `简化合成 / 完整齿轮组` segmented control. Full mode displays all ten X gears and ten Y gears, individual eccentric pins and individual links into visible summing rails; compact mode retains the four-stage overview.
- Both dual-cam pushrod arrowheads were removed. The pushrod geometry and black/blue axis distinction remain, so the motion relationship is readable without a process-diagram treatment.
- No actionable P0/P1/P2 visual issue remains. The complete twenty-gear view is intentionally denser, while the compact option remains available for overview use.

## Direct gear-contribution view

- Requested target: lay out all twenty harmonic gears from the original axes and connect each eccentric output directly to the drawing point.
- Previous full-bank view: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-full-gear-option/full-gear-bank.png`
- Direct-view evidence: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-direct-gears/direct-to-pen.png`
- The direct view places X1-X10 across the top and Y1-Y10 down the left, with each animated eccentric pin connected to P by a restrained dashed contribution line. This makes the twenty inputs and their shared output immediately visible.
- The canvas explicitly labels this as `运动分量示意 · 非刚性装配`, because twenty physical rigid links meeting at one point would be overconstrained. The compact and full gear-bank views remain available as the mechanism-oriented representations.
- The three-way view switch is keyboard focusable and announces its selected state. No actionable P0/P1/P2 visual issue remains.

## Serial summing-chain refinement

- Requested target: replace the twenty simultaneous contribution lines with a connection path that can be followed one stage at a time.
- Before: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-direct-gears/direct-to-pen.png`
- After: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-serial-gears/serial-summing-chain.png`
- X1-X10 now feed numbered summing blocks in a left-to-right serial chain; Y1-Y10 feed a top-to-bottom serial chain. Only each chain's final output connects to the X/Y cross-slide and drawing point P.
- The cumulative nodes move with their harmonic contributions, playback advances through the full chain, and the control is now labelled `逐级串联` / `Serial chain`. The canvas states that this is a staged X/Y motion-path representation.
- The new chain removes the previous P1 conceptual ambiguity of twenty lines appearing to act as twenty rigid links attached to one joint. No actionable P0/P1/P2 visual issue remains.

## Follow-up polish

- P3: if the canvas later gains a teaching mode, transient motion arrows can be shown only during playback to reduce static density further.

## Hidden development entry

- Requested target: merge the experiment into the product code without exposing it from the public homepage or regular workbench navigation.
- Development-page evidence: `C:/Users/39007/.codex/visualizations/2026/07/23/019f8d9b-1c31-7a52-9efa-6f82fea26e23/sketch-mechanism-dev-entry/hidden-dev-page.png`
- The dedicated localized route `/zh/dev` / `/en/dev` follows the existing OpenLink technical typography, warm canvas, lime experiment badge, square borders, and sparse workbench layout.
- Browser verification found zero `/dev` or `/sketch-mechanism` links on the homepage. The development page links correctly to the localized experiment and emits `noindex, nofollow` metadata.
- The regular four-bar navigation no longer exposes the experiment. No actionable P0/P1/P2 visual or discoverability issue remains.

final result: passed
