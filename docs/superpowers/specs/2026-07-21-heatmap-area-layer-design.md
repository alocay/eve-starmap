# Heatmap Area Layer — Design

**Date:** 2026-07-21
**Status:** Approved (pending spec review)

## Summary

Add a new layer, `heatmapAreaLayer`, as an alternative to the existing
`heatmapLayer`. Instead of one flat circle per system, it draws rounded,
organically-merging area shapes around clustered heat sources: systems close
enough together (in screen space) render as one blob; systems far enough apart
render as separate blobs. It ships with two interchangeable rendering styles
selected via one option, `style: 'gooey' | 'contour'`.

The existing `heatmapLayer` is untouched — it stays the simple, cheap default.
`heatmapAreaLayer` is a separate, more expensive, more visually rich option a
consumer opts into.

## Motivation

The current heatmap is a good basic default but gives no sense of "region of
heat" at a glance — at low zoom, a spread of individually-colored dots doesn't
read as an area the way a real heatmap does. The goal: zoomed out, you see
blobby regions where heat concentrates; zoomed in, those blobs resolve into
individual systems as they separate on screen.

## Design principles / alignment with existing code

- **Layers are pure-draw**, matching `heatmapLayer` and `routeLayer`: takes a
  prebuilt `Map<systemId, value>`, draws every frame from `visibleSystems`.
- **Screen-space radius, not world-space.** The per-node influence `radius` is
  in screen pixels. Two systems a fixed world-distance apart shrink toward each
  other in screen space when zoomed out (blobs merge) and grow apart zoomed in
  (blobs split) — this falls directly out of `viewport.scale`, no explicit
  clustering/union-find code needed for either style.
- **Reuses `colorScale.ts`.** Same `ColorScaleOptions` (`min`, `max`, `palette`,
  `opacityMin`/`opacityMax`) as `heatmapLayer`, so palette customization is
  consistent across both heatmap layers.
- **Doesn't draw system dots.** Per-node dots are drawn elsewhere (the
  renderer's own `drawSystemDots`, or another layer) — this layer only draws
  the background area wash. Fill is semi-transparent by design (~0.35-0.4
  alpha, or per-node gradient alpha for `gooey`), so dots underneath stay
  visible without needing `systemDotOnTop` — default draw order (dots first,
  layer on top) already works because the wash never fully occludes them.

## API

```ts
export interface HeatmapAreaLayerOptions extends ColorScaleOptions {
  style?: 'gooey' | 'contour'  // default 'contour'
  radius?: number              // screen-space px, per-node influence. default 40
  bands?: number                // contour-only. 1-4, default 2. ignored for 'gooey'
  blurPx?: number                // gooey-only. default radius * 0.3
}

export function heatmapAreaLayer(
  values: Map<number, number>,
  options?: HeatmapAreaLayerOptions,
): Layer
```

`values` is the exact same shape `heatmapLayer` takes, so a consumer can swap
one for the other without touching how the value map is built. `focusSystemIds`
is set to `[...values.keys()]`, same convention as `heatmapLayer`.

## Style: `gooey`

Two-pass technique so shape and color don't interfere with each other:

1. **Shape mask** (alpha only): draw an opaque, single-color circle of radius
   `radius` per system with heat data, onto an offscreen canvas with
   `ctx.filter = 'blur(blurPx) contrast(28)'`. Blur bleeds nearby circles into
   each other; contrast snaps the blurred edge back toward hard alpha. This is
   the standard "goo" filter trick — nearby circles fuse into one rounded
   silhouette, distant ones stay separate blobs.
2. **Color fill** (crisp, no blur): on a second offscreen canvas, draw each
   system's own `ctx.createRadialGradient(x, y, 0, x, y, radius * 1.6)` —
   center stop = that system's heat color (via the shared color scale, using
   its value), outer stop = transparent base color. The color scale defaults
   `opacityMin` to `0` (unless the caller sets their own), so the center
   stop's own alpha fades toward transparent for low-value sources instead of
   always being fully opaque — otherwise a "cold" source still renders as a
   solid, dark-palette-colored blob (`#1a1f27` by default, easily mistaken for
   solid grey/black against a dark map background) rather than reading as
   faint/absent heat. Composited with the
   default `globalCompositeOperation = 'source-over'` (bounded alpha
   blending). *Amendment (post-manual-testing): the original design called
   for `'lighter'` (additive) so overlapping gradients from nearby sources
   would add together, but with many sources close together on screen (e.g.
   zoomed far out over a dense dataset) additive blending sums every
   overlapping gradient's RGB and saturates to solid white well before any
   individual source reaches its own hot color. `'source-over'` is bounded —
   it can't exceed opaque regardless of how many gradients overlap — so
   nearby glows still layer visually without ever washing out.*
3. **Combine:** composite the color canvas onto the mask canvas with
   `globalCompositeOperation = 'destination-in'` — this clips the gradient
   color down to exactly the merged goo silhouette from step 1. Draw the
   result onto the main canvas.

Why two passes instead of gradient-filling the blurred circles directly:
`contrast()` distorts RGB the same way it distorts alpha, so overlapping
different-colored blurred circles produce muddy, unpredictable colors right at
merge seams. Keeping the shape mask single-color sidesteps that; the gradient
color pass is never blurred/contrasted, so it stays clean. This also means
`gooey` needs no discrete bands — every heat source gets its own continuous
gradient, and `bands` is ignored for this style.

## Style: `contour`

Per-pixel scalar density field, evaluated on a downsampled grid (default step
~4px, upscaled) covering the viewport:

```
field(x, y) = sum over systems s of: value(s) * radius² / (dist(x,y,s)² + radius² * k)
```

`bands` (1-4, default 2) evenly-spaced field thresholds, each rendered with a
smoothstep-softened edge (anti-aliased, not jagged) via `ImageData`. Each
band's fill color comes from the shared color scale, sampled at that band's
position along the palette — outer bands sit toward the palette's cool end,
inner/hotter bands toward its hot end — so intensity reads through both
nesting *and* color, matching the approved mockup (an inner "hot core" ring
inside an outer wash).

Only the systems present in `visibleSystems` (already culled by the renderer)
are summed per pixel, bounding cost to what's on screen; the grid downsample
keeps the per-frame pixel count reasonable. No frame-to-frame caching in v1 —
recomputed on every `draw()` call. Revisit only if profiling on a real map
shows this is too slow; not addressed speculatively here.

Each band has a fixed alpha ceiling (0.3 for the outermost, +0.15 per band
inward) so inner bands read as more intense. `opacityMin`/`opacityMax` scale
these ceilings (`lerp(opacityMin, opacityMax, ...)` across the band index),
defaulting to `1`/`1` (no change, matching `ColorScaleOptions`' convention
elsewhere) — so contour's ceilings are unaffected by default, but a caller
can dim or brighten the whole style by setting them, same as `gooey`.
*Amendment: an earlier pass threaded `opacityMin`/`opacityMax` into the
band-color scale used only for RGB extraction (`parseRgb` discards alpha
entirely), so those options silently did nothing for `contour` despite being
documented as shared across styles. Fixed by applying them directly to the
per-band alpha ceiling instead.*

*Amendment (found via a real consumer integration, sov-losses): `value(s)` in
the field formula above was normalized against a fixed `[0, max]` range
(floored at 0, not auto-detected), matching how a single isolated source
should read as fully hot. But for a multi-source, heavily skewed dataset
(real-world example: ISK loss values, where one capital/structure loss can
dwarf everyday losses by 100-1000x), this let legitimately-present, non-zero
values normalize so low relative to the dataset's max that they never cleared
band 1's threshold at all -- they rendered nothing, not even a faint mark,
silently dropping real data points from the visualization. Fixed by
normalizing against the *observed* `[min, max]` range (like `heatmapLayer`'s
color scale already does) mapped onto `[0.25, 1]` instead of `[0, 1]` -- 0.25
is comfortably above the ~0.2125 a value needs to clear band 1's threshold
standing alone, so every value in the map is now guaranteed some visible
mark, with hotter values still showing proportionally more. A single distinct
value (or several equal ones) still maps to 1, unchanged. New pure function:
`createFieldScale` in `heatmapAreaMath.ts`, replacing the ad-hoc
`createValueScale(rawValues, { min: options.min ?? 0, ... })` call.*

## Testing (vitest, matching existing suite)

Pure math pulled into small exported helper functions (same pattern as
`colorScale.ts`) so it's unit-testable without mocking canvas pixel ops:

- Field-contribution formula (`gooey`'s implicit merge distance falls out of
  `radius`/`blurPx`; `contour`'s field formula tested directly for known
  inputs).
- Band-threshold generation for `bands` = 1..4.
- Radial-gradient stop colors match the shared color scale at a system's value.

`draw()` itself tested with a mocked `CanvasRenderingContext2D` (same style as
`heatmapLayer.test.ts`):

- `id` is `'heatmap-area'`.
- `focusSystemIds` equals the value map's keys (including empty-map case).
- `style: 'gooey'`: `ctx.filter` gets set to a string containing `blur(` and
  `contrast(`; `createRadialGradient` called once per system with a value;
  `globalCompositeOperation` set to `'source-over'` then `'destination-in'`
  in order.
- `style: 'contour'` (default when omitted): `createImageData`/`putImageData`
  called; grid size scales with viewport `width`/`height`; `bands` option
  changes number of threshold levels used (assert via a spy on the internal
  band-threshold helper, not by inspecting pixels).
- Systems absent from the value map contribute nothing to either style.
- Empty value map: draws nothing (no `arc`/`createRadialGradient`/
  `putImageData` calls).

## Exports

Add to `packages/core/src/index.ts`:

- `heatmapAreaLayer`
- type: `HeatmapAreaLayerOptions`

## Out of scope (YAGNI)

- Explicit clustering data structures (union-find, convex hulls) — not needed;
  screen-space radius + blur/field math gives merging for free.
- Frame-to-frame field caching/memoization — only if profiling shows it's
  needed.
- Configurable field falloff shape/grid step as public options — internal
  constants for v1; promote to options later if a real use case needs tuning.
- Changing/removing the existing `heatmapLayer` — it stays as the simple
  default, unchanged.
