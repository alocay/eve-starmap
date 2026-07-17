# Route Layer — Design

**Date:** 2026-07-17
**Status:** Approved (pending spec review)

## Summary

Add a new bundled layer to `eve-starmap` that draws the jump route between two
solar systems, coloring each leg of the route by the security status of the
systems it connects. A leg between a 0.5 system and a 0.4 system renders as a
gradient from the 0.5 tier color to the 0.4 tier color, giving a continuous
color flow across the whole route.

The feature ships as two pieces plus one data change:

1. `fetchRoute(...)` — an async helper that calls EVE's public ESI `/route`
   endpoint and returns the ordered list of system IDs.
2. `routeLayer(...)` — a pure-draw `Layer` (same interface as `heatmapLayer`)
   that draws the route polyline with per-leg security gradients.
3. A new `security` field on every bundled `SystemNode`, regenerated from the
   SDE, so leg coloring works fully offline with no extra network calls.

## Motivation

The README already lists "route lines" as a possible future layer. Consumers
frequently want to show a path between two systems. EVE's ESI provides route
computation as a public, no-auth endpoint, so we lean on it rather than
reimplementing pathfinding (including ESI's `secure`/`insecure` weighting and
wormhole `connections`, which the bundled stargate graph cannot express).

Security status is near-static and the library already bundles full universe
data offline, so we bundle sec status too rather than fetching it per system.

## Design principles / alignment with existing code

- **Layers are pure-draw.** `routeLayer` matches `heatmapLayer`: it receives
  pre-built data and draws every frame. It never fetches. Network lives only in
  `fetchRoute`, which the consumer awaits before feeding the layer. This mirrors
  how `heatmapLayer` takes a pre-built value `Map`.
- **No runtime fetch in the render path, no API key.** Only the explicit,
  opt-in `fetchRoute` call touches the network, and ESI `/route` needs no key.
- **Back-compat.** `security` is optional on `SystemNode` (like `regions`), so
  existing fixtures/callers built before this change keep type-checking.

## Component 1 — Bundled data: `security` field

`SystemNode` gains:

```ts
export interface SystemNode {
  id: number
  name: string
  constellationId: number
  regionId: number
  x: number
  y: number
  security?: number   // raw security status, e.g. 0.4531. Optional for back-compat.
}
```

- Value is the **raw** sec status (not rounded). Rounding to display tiers
  happens at color-lookup time inside `routeLayer`.
- `scripts/build-universe-data.js` is updated to read `security` from the SDE
  `mapSolarSystems` table and emit it per system. The bundled
  `defaultUniverseData.ts` is regenerated.

## Component 2 — `fetchRoute` helper

```ts
export type RouteFlag = 'shortest' | 'secure' | 'insecure'

export interface FetchRouteOptions {
  flag?: RouteFlag                  // default 'shortest'
  avoid?: number[]                  // system ids to avoid
  connections?: [number, number][]  // forced extra jump connections (e.g. wormholes)
  baseUrl?: string                  // default 'https://esi.evetech.net/latest'
  fetch?: typeof fetch              // injectable for tests / custom transport
}

export function fetchRoute(
  origin: number,
  destination: number,
  options?: FetchRouteOptions,
): Promise<number[]>
```

Behavior:

- Builds `GET {baseUrl}/route/{origin}/{destination}/` with query params:
  - `flag` when provided (else omitted, ESI defaults to shortest).
  - `avoid` repeated per id.
  - `connections` as `a|b` pairs, repeated.
- Uses the injected `fetch` (default: global `fetch`).
- On non-2xx response, throws an `Error` including status and, when available,
  the ESI error body.
- Returns the parsed ordered array of system IDs (origin first, destination
  last).

The consumer is free to skip `fetchRoute` and supply their own ID list (e.g.
from a cached ESI result or a custom source) directly to `routeLayer`.

## Component 3 — `routeLayer`

```ts
export type RouteColorFn = (system: SystemNode, security: number | undefined) => string

export interface RouteLayerOptions {
  // Tier colors. Keys are display tiers ("1.0".."0.0"; anything <= 0.0 clamps to
  // the 0.0 color). Accepts a Record or Map<number,string>. Defaults to the
  // bundled defaultSecurityColors. Ignored when colorForNode is provided.
  securityColors?: Record<string, string> | Map<number, string>
  colorForNode?: RouteColorFn // per-node color override; wins over securityColors
  gradient?: boolean          // blend each leg start->end; default true. false =
                              // solid leg in the start node's color.
  lineWidth?: number          // default 2
  endpointMarkers?: boolean   // draw a dot at origin + destination, default true
  missingColor?: string       // color when a system's sec is unknown but coords exist
}

export function routeLayer(
  systemIds: number[],
  universeData: UniverseData,
  options?: RouteLayerOptions,
): Layer
```

Construction:

- Build an `id -> SystemNode` map once from `universeData.systems`. The layer
  needs the **full** system set (not the culled `visibleSystems` passed to
  `draw`), because a route routinely spans beyond the viewport.
- Normalize `securityColors` (defaulting to `defaultSecurityColors`) into a
  single lookup `tierColor(security): string`. When `colorForNode` is provided,
  it replaces this lookup for every node.
- Set `focusSystemIds = systemIds` so the renderer / `<EveStarmap>` can
  auto-fit the view to the route.

`draw(ctx, viewport, visibleSystems)`:

- Resolve each id in `systemIds` to its `SystemNode` (from the prebuilt map).
- For each consecutive pair (X, Y):
  - If either system is missing from the map (no coords — e.g. wormhole /
    abyssal id not in bundled data), **break the polyline**: draw no segment
    across the gap.
  - Otherwise compute both screen positions via `worldToScreen(viewport, ...)`.
  - Determine each endpoint's color via `colorForNode(system, security)` if set,
    else `system.security == null ? missingColor : tierColor(round1(security))`.
  - If `gradient` (default): build `ctx.createLinearGradient(x1, y1, x2, y2)`
    with stop 0 = X color, stop 1 = Y color. If `gradient: false`: stroke solid
    with X's color (start node color runs the whole leg). Stroke with `lineWidth`.
- After drawing legs, if `endpointMarkers`, draw a dot at the origin and
  destination screen positions.

### Security → tier → color

- `round1(sec) = Math.round(sec * 10) / 10`.
- The bundled `defaultSecurityColors` palette (EVE's tiers): 1.0 `#2c74e0`,
  0.9 `#3999e9`, 0.8 `#4dccf6`, 0.7 `#60d9a3`, 0.6 `#71e554`, 0.5 `#f3fd82`,
  0.4 `#da6c07`, 0.3 `#cc440f`, 0.2 `#ba1117`, 0.1 `#722020`, 0.0 `#8c3263`.
- Negative sec values clamp to the lowest key present (0.0 in the default
  palette), so all low/null-sec systems share the 0.0 color.
- Lookup is tolerant of numeric (`0.5`) and string (`"0.5"`) keys.
- If a rounded tier has no matching key, fall back to `missingColor`.

### Edge cases

- **Off-screen route:** all in-bounds segments are drawn regardless of viewport
  culling; the canvas clips off-screen pixels. A segment is skipped only when an
  endpoint has no coords.
- **Single-system / origin == destination:** no legs; draw the endpoint marker
  only.
- **Empty `systemIds` (`[]`):** draws nothing. This is the normal
  pre-`fetchRoute`-resolution state.
- **Missing coords vs missing sec:** missing coords breaks the line; missing sec
  (coords present) uses `missingColor` for that endpoint.

## Exports

Add to `packages/core/src/index.ts`:

- `fetchRoute`
- `routeLayer`
- `defaultSecurityColors`, `createSecurityColorLookup`, `round1`
- types: `RouteFlag`, `FetchRouteOptions`, `RouteLayerOptions`, `RouteColorFn`, `SecurityColors`
- `SystemNode` already exported — now carries optional `security`.

## Testing (vitest, matching existing suite)

**`fetchRoute`:**
- Mock injected `fetch`; assert URL + query construction for `flag`, `avoid`
  (repeated), `connections` (`a|b`, repeated), and default (no flag).
- Returns parsed ordered array.
- Throws on non-2xx, message includes status.

**`routeLayer`:**
- Mock `CanvasRenderingContext2D`; assert:
  - segment count == `systemIds.length - 1` for a fully-resolvable route.
  - a linear gradient is created per leg with the correct two tier colors.
  - polyline breaks (segment skipped) when a middle system is absent from data.
  - `focusSystemIds` equals `systemIds`.
  - endpoint markers drawn only when `endpointMarkers` is true (default on).
  - `origin == destination` draws marker only, no segment.

**Sec → tier → color:**
- Unit tests for `round1` boundaries: 0.45, 0.05, exact tiers, and negatives
  clamping to the lowest key. Numeric vs string key lookup.

**Data:**
- Assert regenerated `defaultUniverseData` systems carry a numeric `security`.

## Manual tools / docs

- **Playground:** add origin + destination inputs and a route toggle that calls
  `fetchRoute` then swaps in a `routeLayer`. Provide a default `securityColors`
  palette for demonstration.
- **README (root + `packages/core`):** document `fetchRoute` and `routeLayer`
  with a usage example, and note the new optional `SystemNode.security` field.

## Out of scope (YAGNI)

- Local pathfinding over the bundled stargate graph (ESI covers it).
- Fetching live security status (bundled is sufficient; sec is near-static).
- Route caching / rate-limit handling in `fetchRoute` (consumer's concern).
- Animated / directional route effects.
