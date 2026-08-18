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

## Trojan-horse silhouette rebuild

- Final source reference: `C:/Users/39007/AppData/Local/Temp/codex-clipboard-ee2a1006-125b-4beb-ad0d-5910342b302a.png`.
- Verification surface: `http://localhost:4173/zh/sketch-mechanism` in the Codex in-app browser at a 1440 × 1000 viewport.
- The previous left-facing outline read as a long-eared canine. The target was fully redrawn in the reference's right-facing orientation around its distinctive proportions: a high arched neck, vertical jagged wooden mane, tall poll, long downward-hanging face, heavy barrel body, four broad column legs, and a short plank-like tail.
- The target remains one closed curve because this phase synthesizes a continuous drawing path; photographic plank texture, ropes, and internal construction are intentionally outside the fitted contour.
- High-fidelity methods use 192 samples. The dual-groove cam reproduces the final contour at 0.00% normalized error; the geared X–Y and 28-term Fourier candidates are approximately 2.94% and 2.93%. Classical four-bar and geared five-bar candidates remain explicitly labelled approximations and were refitted to the new contour.
- Candidate loading, default dual-cam selection, animation controls, and the final target/trace overlay were verified. The browser console reports no errors.
- A same-pass visual comparison of the final target and supplied cinematic wooden-horse reference found no remaining P0/P1/P2 silhouette issue for the requested simplified continuous-curve representation; the result now reads as a horse rather than a dog.

### Proportion follow-up

- The rear contour was changed from a rounded quarter-circle and star-like tail into a straighter, blockier wooden rump with one restrained plank tail, removing the pig-like reading.
- The entire neck crest and poll were raised and extended, while the target-card view box was expanded upward so the longer neck remains uncropped.
- The muzzle's inward hook was removed. The final face now descends in one long tapered plane and returns through a shallow jaw into the throat, matching the reference's hanging wooden head more closely.
- All precomputed linkage candidates were refitted to the revised contour. Candidate loading, the 0.00% dual-cam trace, animation, production build, and browser console were verified again.

final result: passed

## Odyssey frame integration and occlusion pass

### Evidence

- Previous frame state: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/mounting-frame-qa1.png`.
- Revised layered state: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/layered-frame-qa2.png`.
- Same-view comparison: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/frame-layering-comparison.png`.
- Both source and implementation captures are 768 × 937 px from the same 779 × 950 CSS viewport, centered on the playing mechanism. No density normalization was needed.
- A focused crop was unnecessary because the complete horse belly, chassis rail, fixed pivots, and all four linkage layers are readable in the full comparison.

### Comparison history

1. P2 — The first chassis rail sat below the belly as an independent horizontal plank, so it did not feel structurally continuous with the raster horse shell.
2. P2 — All four animated legs were painted above the chassis, flattening the assembly and contradicting the intended near-side/far-side construction.
3. Fix — The rail moves upward into the horse's lower timber sill and trims its ends to the belly span. Far-side legs render first, the chassis renders second as a true occluder, and near-side legs render last.
4. Post-fix evidence — The revised comparison shows the far-side upper bars disappearing behind the timber rail while near-side bars and brass pivots remain visible in front. The rail now reads as part of the horse body rather than a separate base.

### Required fidelity surfaces

- Fonts and typography: unchanged.
- Spacing and layout rhythm: the integrated rail remains inside the image plate and clear of the motion control and border.
- Colors and visual tokens: the rail keeps the same matte walnut, dark edge, and subdued wood-grain palette as the legs and horse shell.
- Image quality and asset fidelity: the source horse raster remains unchanged; code-native mechanism layers provide physically coherent animation and occlusion.
- Copy and content: unchanged.

No actionable P0, P1, or P2 issue remains for the requested frame association and front/back leg depth.

final result: passed

## Odyssey wooden-linkage feedback pass

### Evidence

- Previous desktop state: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/hero-final.png` (1265 × 712 captured px).
- Final desktop state: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/hero-natural-wood-qa.png` (1252 × 703 captured px; 1264 × 710 CSS viewport at 1.3 device scale).
- Same-input review composite: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/natural-wood-feedback-comparison-final.png`.
- Narrow-layout mechanism evidence: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/natural-wood-narrow-mechanism.png`.

### Findings and fixes

1. P2 — The first wooden pass vertically scaled the linkage by 1.55, making the legs read as overextended. The final transform uses a restrained 1.15 vertical scale so the Jansen geometry keeps its characteristic proportions while still reaching the horse body.
2. P2 — The reddish, evenly highlighted bars read as lacquered metal or plastic. They now use a matte dark-walnut stack: a deep bark edge, brown timber core, irregular low-contrast grain, and aged-brass pivots.
3. P2 — Rear and swing legs previously changed opacity to imply depth. All four animated leg groups now compute to `opacity: 1` with opacity transitions disabled; geometry continues to animate without fading.
4. P2 — The narrower browser layout could crop the horse plate before the mobile composition activated. The responsive composition now starts at 860 px and keeps the full horse and linkage visible.
5. P2 — The generated wooden platform and wheels conflicted with the requested free-standing mechanism. The final image asset removes the cart, wheels, and residual ground-contact shadow, rebuilding the area as uninterrupted parchment grid.

### Final verification

- The horse shell remains a raster asset; the moving walnut legs remain live SVG geometry driven by the existing mechanism model.
- Motion sampling confirms geometry changes while all four leg-group opacities remain exactly 1.
- The final desktop and narrow layouts show no clipped linkage, platform, wheel, or ground shadow.
- Clean browser loads report no console errors or warnings.

final result: passed

## Odyssey variable-leg special version

### Comparison setup

- Visual direction: `C:/Users/39007/Documents/Codex/open-linkage/xiaohongshu-assets/00-odyssey-ai-cover.png`.
- Clean shell edit: `C:/Users/39007/Documents/Codex/open-linkage/public/odyssey-horse-shell.png`.
- Final desktop implementation: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/hero-final.png`.
- Same-input comparison: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/reference-vs-implementation.png`.
- Workbench state: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/workbench.png`.
- Mobile state: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/mobile-hero-final.png` at 390 × 844 CSS px.

### Fidelity and intentional adaptation

- The final page preserves the reference's parchment engineering grid, Greek-key edge treatment, dark wooden horse shell, wheeled base, black mechanism rods, and fluorescent lime pivots.
- The original raster rods and legs were removed from a non-destructive edited asset. The replacement rods are live SVG output from the same Jansen reference project and gait model used by the OpenLinkage variable-leg workbench.
- The source cover's upper-left negative space becomes the web page's editorial title and explanation. The portrait horse remains a full, uncropped object on desktop and mobile.
- The four-leg linkage is aligned between the wooden belly and wheeled platform. Rear-side legs are deliberately muted to preserve depth while stance legs retain the strongest black/lime contrast.
- The workbench inherits the special version's parchment, charcoal, wood-brown, and lime palette without changing the original `/en/variable-leg` route.

### Interaction verification

- The hero mechanism changes geometry over time and stops changing after `Pause motion`; `Play motion` resumes it.
- `Enter the live mechanism` scrolls to `#workbench`.
- The special workbench opens in the verified smooth Jansen reference, four-leg wave-gait state and ignores unrelated saved state from the regular lab.
- The workbench play control advances the crank phase and pauses correctly.
- Desktop and 390 × 844 mobile states report no browser console errors or warnings after a clean load.
- Production build passes, targeted lint passes, and all 132 tests pass.

### Design review outcome

The same-input comparison found no remaining actionable P0, P1, or P2 issue. The largest visible departure—the simplified live linkage replacing the denser fictional raster mechanism—is the requested functional change and uses the product's real mechanism grammar.

final result: passed

## Odyssey mounting-frame connection pass

### Evidence and normalization

- Source visual truth: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/final-narrow-wood-linkage.png`.
- Revised implementation: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/mounting-frame-qa1.png`.
- Full-view comparison: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/mounting-frame-comparison.png`.
- Both captures are 768 × 937 px from the same 779 × 950 CSS viewport and the same centered, playing mechanism state. No density normalization was needed.
- A separate focused crop was unnecessary because the frame, fixed pivots, horse belly, and complete legs are clearly readable together at this viewport.

### Findings and fix

- P2 — The upper fixed pivots touched the raster horse shell but had no continuous structural member, making the animated legs appear visually suspended. The final implementation enables the native chassis geometry in the hero and gives it the same matte dark-walnut edge/core treatment as the legs. The rail now spans both leg stations beneath the horse belly, while the fixed brass pivots visibly terminate into the rail/horse assembly.
- Fonts and typography: unchanged; the frame introduces no copy or hierarchy drift.
- Spacing and layout rhythm: the rail remains inside the horse plate and does not change the responsive composition or overlap the motion control.
- Colors and visual tokens: deep walnut, dark bark edge, subtle grain, and aged-brass pivots remain consistent with the revised leg material.
- Image quality and asset fidelity: the horse stays a sharp raster asset; the new frame is native mechanism geometry so it remains aligned with the animated linkage at every phase.
- Copy and content: unchanged.

### Verification

- The rail is static relative to the horse while all four legs continue to animate from their mounted pivots.
- The previous unsupported-pivot P2 is resolved in the same-view comparison; no actionable P0, P1, or P2 issue remains.

final result: passed

## Odyssey direct-on-horse linkage pass

### Evidence

- Previous framed state: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/layered-frame-qa2.png`.
- Final direct-mounted state: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/direct-on-horse-qa1.png`.
- Same-view comparison: `C:/Users/39007/.codex/visualizations/2026/08/18/01a01502-1d57-7621-bf10-36fbdca82ad2/odyssey-variable-leg-sp/direct-on-horse-comparison.png`.
- Both captures are 768 × 937 px from the same 779 × 950 CSS viewport, with the mechanism centered and playing. No density normalization was needed.
- A focused crop was unnecessary because the fixed pivots, horse belly, removed rail, and front/back leg layering are readable in the full-view comparison.

### Findings and final treatment

- P2 — Even after integration, the visible chassis rail remained an additional object that competed with the wooden horse silhouette.
- Fix — The rail is removed. Far-side legs render below a second, perfectly aligned crop of the real horse raster; that body crop occludes their upper linkage. Near-side legs render above the horse crop. The result uses the actual horse imagery as the enclosure instead of approximating it with a new frame.
- Fonts and typography: unchanged.
- Spacing and layout rhythm: the horse plate and controls remain unchanged; removing the rail reduces visual density.
- Colors and visual tokens: the walnut linkage and aged-brass pivots continue to match the horse shell without introducing another material surface.
- Image quality and asset fidelity: the occluder reuses the exact source raster at the exact same crop and scale, so no seam, substitute illustration, or fabricated silhouette is introduced.
- Copy and content: unchanged.

### Verification

- Four live hero legs remain present: two far-side and two near-side, all at opacity 1.
- The far-side linkage is occluded by the actual horse-body image layer while the near-side linkage remains visible in front.
- The mechanism continues to change geometry during playback and the chassis rail is absent.
- No actionable P0, P1, or P2 issue remains for the requested direct-on-image construction.

final result: passed
