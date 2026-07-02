# eve-starmap — Design

## Purpose

A reusable, framework-agnostic TypeScript library for rendering EVE Online's 2D starmap — from a single constellation up to the full galaxy — with a pluggable layer system. First consumer: a heatmap layer showing ISK destroyed per system (for the `sov-losses` project), but the package is public and general-purpose, not tied to that use case.

## Scope

**In scope (v1):**
- Render EVE Online's in-game 2D map layout (systems + stargate connections), any zoom range from one constellation to the full galaxy (~8000 systems).
- Pan/zoom interaction, hover/click hit-testing per system.
- Bundled static universe data (positions, topology, names) — works offline, no auth, no runtime fetch by default.
- Override: consumer can supply their own dataset matching the same schema (e.g. EVE Frontier data, a custom wormhole chain, fresher data).
- A layer/plugin system for extending what's drawn on top of the base map.
- One shipped layer: **heatmap** — colors systems by a supplied value map.
- React wrapper package (`packages/react`) on top of the framework-agnostic core.
- Perf benchmark harness (manual/scripted, not CI-gated) validating full-galaxy pan/zoom holds a 30fps target on Canvas 2D.

**Out of scope (v1, explicitly future work):**
- Additional layer types beyond heatmap (route/path lines, custom markers, jump-range overlays) — layer system built to support them, but none else ship now.
- WebGL renderer — only pursued if the Canvas 2D perf benchmark fails to hold 30fps at full-galaxy scale.
- Automated publish/CI pipeline — v1 published manually.
- `sov-losses` actually integrating this package — separate follow-up once `eve-starmap` ships.
- Vue/Svelte/other framework wrappers — only React wrapper ships in v1; core being framework-agnostic leaves the door open.

## Architecture

npm workspaces monorepo, two independently-versioned, independently-published packages:

- **`packages/core`** (published as `eve-starmap`) — framework-agnostic TypeScript. Canvas 2D renderer, layer/plugin system, bundled universe data, pan/zoom/hit-testing logic. Zero framework dependency.
- **`packages/react`** (published as `eve-starmap-react`) — thin wrapper exposing `<EveStarmap />` component + hooks, delegating all logic to `core`. No logic duplicated between packages.

### Why Canvas 2D over SVG or WebGL

The map must scale from a single constellation (tens of systems) up to the full galaxy (~8000 systems + stargate edges). SVG's per-node DOM cost becomes janky well before galaxy scale — every additional `<circle>`/`<line>` is a DOM node, and pan/zoom/re-theme operations touch all of them. Canvas 2D avoids per-node DOM entirely and, combined with the techniques below, handles both ends of the scale range with one code path (no dual-renderer maintenance burden). WebGL was considered for guaranteed high framerates at full-galaxy zoom but is unnecessary complexity unless Canvas 2D's benchmark proves inadequate — it remains a documented v2 fallback, not built now.

### Rendering techniques (all in `packages/core`)

- **Viewport culling** — only systems/edges within the current visible bounds are drawn or hit-tested. A zoomed-in constellation view and a full-galaxy view run the same draw loop; culling naturally reduces the working set for the former.
- **Quadtree spatial index** — built once per dataset (or per override-dataset load), used for hover/click hit-testing without per-node DOM elements or naive O(n) scans.
- **Level of detail (LOD)** — labels and small system markers drop out below a zoom threshold at full-galaxy scale; full detail (names, larger markers) renders when zoomed into a constellation-level view. Single renderer, zoom-driven detail, no branching per "mode."
- **Single tooltip overlay** — one absolutely-positioned DOM element reused for hover/click info, mapped from canvas coordinates to screen coordinates. Avoids per-system DOM even for tooltip content.

### Perf validation

A scripted benchmark harness renders the full galaxy dataset under simulated pan/zoom and measures frame time, run on demand (not part of the CI test suite, since it's an environment-sensitive perf check rather than a correctness test). Target: **30fps** sustained during full-galaxy pan/zoom. If Canvas 2D cannot hold this target, a WebGL renderer swap is the documented fallback path for a future version — not attempted in v1 unless the benchmark forces it.

## Data Layer

### Bundled dataset (default)

`packages/core` ships a trimmed static dataset containing, per system: `position2D` (x, y — matching EVE's in-game 2D map projection, not the 3D `position` used for jump-range calculations), stargate connections (topology), and system/constellation/region names and IDs.

This dataset is **generated, not hand-maintained**: a repo build script (`scripts/build-universe-data.js`) pulls from a public SDE mirror (Fuzzwork or riftforeve.online), extracts only the fields above, and writes the trimmed JSON bundled into the package. Refreshing the data for a new package version is re-running this script, not manual editing.

Consumers get this by default — zero runtime fetch, zero auth, works fully offline.

### Override

A consumer may supply their own dataset (matching the same schema: `position2D` + topology + names) in place of the bundled one — e.g. to use fresher ESI-derived data, a custom wormhole chain, or an entirely different game's map (EVE Frontier). The renderer, quadtree, and layer system are agnostic to where the data originated; they only depend on the schema shape.

**Validation:** a malformed override dataset (missing required fields, invalid shape) throws a validation error at init time — fail fast rather than silently rendering a broken map.

## Layer/Plugin System

The renderer exposes a layer interface roughly of the shape `{ id, draw(ctx, viewport, data) }`. The base render (systems, stargates, pan/zoom) is itself effectively the bottom layer; plugins stack on top and are drawn in registration order.

This system is built for future extensibility (route lines, custom markers, jump-range overlays are anticipated future layers) but **v1 ships exactly one layer: heatmap.**

### Heatmap layer (v1's only plugin)

API: consumer passes a `Map<systemId, number>` (or equivalent array of `{ systemId, value }`) plus optional color-scale configuration (min/max, palette). The layer normalizes values against the scale and fills each system's marker accordingly.

**Missing data handling:** a system present on the map but absent from the supplied value map is not an error — it simply renders with an unfilled/default color. Sparse heatmap data is the expected normal case (e.g. `sov-losses` only has values for systems with losses in the selected range), not something to warn about.

## React Wrapper

`packages/react` exposes `<EveStarmap data={...} layers={[heatmapLayer(...)]} onSystemClick={...} />` plus supporting hooks as needed. It is intentionally thin — a rendering/lifecycle bridge into `packages/core`'s imperative API, with no business logic of its own. Any consumer using a different framework (or vanilla JS) can use `packages/core` directly.

## Testing

Matches `sov-losses`' existing Vitest convention.

- **Pure logic** — data loading/trimming validation, quadtree construction and queries, viewport culling math, color-scale normalization, layer draw-order logic — unit-tested directly, no canvas involved.
- **Canvas draw calls** — tested by injecting a mock `CanvasRenderingContext2D` and asserting the expected draw calls were made (fillRect, arc, etc. with expected args), not by asserting pixel output. This avoids the friction and native-dependency risk of a real canvas implementation (e.g. `node-canvas`) in the test environment.
- **Perf benchmark** — a separate scripted harness (see Perf validation above), run on demand, not part of the automated test suite gating CI.

## Build & Publish

- **Build tool:** `tsup` per package (`packages/core`, `packages/react`) — outputs ESM + CJS + `.d.ts` with minimal config, standard choice for this class of library.
- **Publish:** manual `npm publish` per package for v1; automated publish-on-tag CI is future work, not built now.
- **License:** MIT.

## Error Handling

- Malformed/invalid override dataset → thrown validation error at init (fail fast).
- System present on map but missing from a layer's supplied data (e.g. heatmap value map) → default/unfilled rendering, not an error — sparse layer data is normal.
- Canvas context unavailable (e.g. unsupported environment) → thrown error at renderer init, since there is no fallback rendering path in v1.

## Future Extensions (explicitly not this spec)

- Additional layer types: route/path lines, custom markers, jump-range overlays.
- WebGL renderer, if the Canvas 2D perf benchmark fails to hold 30fps at full-galaxy scale.
- Automated publish/CI pipeline (npm publish on tag).
- `sov-losses` integrating `eve-starmap` to replace/augment its own map needs.
- Additional framework wrappers (Vue, Svelte) beyond the v1 React wrapper.
