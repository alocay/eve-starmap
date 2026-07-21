# eve-starmap

Framework-agnostic Canvas 2D renderer for EVE Online's 2D starmap — from a single constellation up to the full galaxy — with a pluggable layer system.

## Install
```
npm install eve-starmap
```

## Usage

```js
import { StarmapRenderer, heatmapLayer, defaultUniverseData } from 'eve-starmap'

const canvas = document.querySelector('canvas')
const renderer = new StarmapRenderer(canvas, defaultUniverseData, {
  layers: [heatmapLayer(new Map([[30000142, 1_500_000_000]]))],
  onSystemClick: (system) => console.log(system),
})
renderer.draw()
```

## Custom data

Pass your own `UniverseData` (`{ systems: SystemNode[], stargates: StargateEdge[] }`) instead of `defaultUniverseData` to use a different or fresher dataset. Invalid data throws at construction time.

`SystemNode` also carries an optional `security?: number` (raw, unrounded security status, e.g. `0.4531`) -- bundled on `defaultUniverseData` and used by `routeLayer` to color each route leg. It's optional so datasets/fixtures built before this field don't need updating.

## Hover behavior

`onSystemHover` (constructor option) covers the simple case. For multiple independent hover behaviors (a DOM tooltip, a canvas highlight layer, a side panel) that shouldn't have to know about each other, register each separately with `renderer.onHover()`:

```js
const unsubscribe = renderer.onHover((system, screenPos) => {
  tooltipEl.style.display = system ? 'block' : 'none'
  if (system) {
    tooltipEl.textContent = system.name
    tooltipEl.style.left = `${screenPos.x}px`
    tooltipEl.style.top = `${screenPos.y}px`
  }
})

// later, e.g. on unmount:
unsubscribe()
```

`screenPos` is canvas-relative, so it drops straight into `position: absolute` inside a `position: relative` wrapper around the canvas.

Every registered handler (plus `onSystemHover`, if set) runs on each pointermove — none of them overwrite each other. They also all fire with `(null, null)` when the pointer leaves the canvas entirely, so a tooltip/highlight doesn't stay stuck on the last-hovered system after the mouse moves off the map.

## Examples

**Tooltip on hover** — see [Hover behavior](#hover-behavior) above.

**Highlight + label on hover** (drawn on canvas via the layer system, since layers redraw every frame and survive pan/zoom, unlike a one-off `ctx` call):

```js
let hovered = null

const hoverLayer = {
  id: 'hover-highlight',
  draw(ctx, viewport, systems) {
    if (!hovered) return
    const x = (hovered.x - viewport.offsetX) * viewport.scale + viewport.width / 2
    const y = (hovered.y - viewport.offsetY) * viewport.scale + viewport.height / 2
    ctx.strokeStyle = '#ffd23f'
    ctx.beginPath()
    ctx.arc(x, y, 6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = '#ffd23f'
    ctx.fillText(hovered.name, x + 8, y - 8)
  },
}

renderer.setLayers([...otherLayers, hoverLayer])
renderer.onHover((system) => {
  hovered = system
  renderer.draw()
})
```

**Heatmap layer** (bundled, click to inspect):

```js
import { StarmapRenderer, heatmapLayer, defaultUniverseData } from 'eve-starmap'

const renderer = new StarmapRenderer(canvas, defaultUniverseData, {
  layers: [heatmapLayer(new Map([[30000142, 1_500_000_000]]))],
  onSystemClick: (system) => console.log(system),
})
renderer.draw()
```

`heatmapLayer` options, all interpolated against the same normalized value (so color/opacity/radius stay in sync with each other):

- `palette: [fromHex, toHex]` — color gradient (default `['#1a1f27', '#ff5c33']`).
- `opacityMin` / `opacityMax` — fade low/high values in or out (default `1`/`1`, fully opaque, no change from before).
- `radiusMin` / `radiusMax` — dot size scales with value instead of staying fixed (default both equal `radius`, i.e. unchanged fixed size).
- `radius` — fixed dot size when `radiusMin`/`radiusMax` aren't set (default `4`).
- `min` / `max` — override auto-detected value range.

```js
heatmapLayer(values, {
  palette: ['#ffe066', '#ff2b2b'],
  opacityMin: 0.25, opacityMax: 1,
  radiusMin: 2, radiusMax: 12,
})
```

**Region labels** (bundled): draws each region's name at the centroid of its member systems -- regions have no 2D-projected position of their own in the SDE, only systems do, so this is computed from `defaultUniverseData.systems` rather than stored directly:

```js
import { StarmapRenderer, regionLabelLayer, defaultUniverseData } from 'eve-starmap'

const renderer = new StarmapRenderer(canvas, defaultUniverseData, {
  layers: [regionLabelLayer(defaultUniverseData.regions ?? [], defaultUniverseData.systems)],
})
renderer.draw()
```

`regionLabelLayer` options:

- `color` -- label color (default `'#e8a33d'`, an amber distinct from the near-white system dots and grey stargate lines -- a color too close to those blends in at a glance).
- `opacity` -- default `1` (fully opaque).
- `fontSize` / `font` -- default `14` / `'sans-serif'`.
- `visible` -- default `true`. Toggle labels on/off without touching the renderer's `layers` array (omitting the layer from that array works too -- this is just a more convenient knob when the layer instance is already memoized/stable elsewhere).

```js
regionLabelLayer(defaultUniverseData.regions ?? [], defaultUniverseData.systems, {
  color: '#8ecbe8',
  opacity: 0.6,
  visible: showRegionLabels,
})
```

**Route layer** (bundled): draws the ordered jump route between two systems as a polyline, each leg a canvas gradient between its two endpoints' security-tier colors. `fetchRoute` fetches the route (ordered system ids, origin first) from EVE's public ESI `/route` endpoint -- no auth, no API key:

```js
import { StarmapRenderer, fetchRoute, routeLayer, defaultUniverseData } from 'eve-starmap'

const ids = await fetchRoute(30000142, 30002187, { flag: 'secure' })
const route = routeLayer(ids, defaultUniverseData) // uses bundled defaultSecurityColors
const renderer = new StarmapRenderer(canvas, defaultUniverseData, { layers: [route] })
renderer.focusOn(route.focusSystemIds)
renderer.draw()
```

`fetchRoute(origin, destination, options?)` options:

- `flag` -- `'shortest'` (default), `'secure'`, or `'insecure'`, matching ESI's route-preference options.
- `avoid` -- system ids to route around.
- `connections` -- extra `[fromId, toId]` jump connections to allow beyond stargates (e.g. a jump bridge).
- `baseUrl` -- override the ESI base URL (default `https://esi.evetech.net/latest`).
- `fetch` -- override the `fetch` implementation (e.g. for testing, or a non-browser runtime).

`routeLayer(systemIds, universeData, options?)` options:

- `securityColors` -- tier palette (keys `"1.0"`..`"0.0"`, values as hex colors; `Record<string, string>` or `Map<number, string>`), default the bundled `defaultSecurityColors`. Ignored when `colorForNode` is set.
- `colorForNode` -- `(system: SystemNode, security: number | undefined) => string`, overrides `securityColors` and lets you color each node yourself.
- `gradient` -- default `true`: each leg blends from its start node's color to its end node's. `false` draws a solid leg in the start node's color.
- `lineWidth` -- default `2`.
- `endpointMarkers` -- draw a dot at the origin and destination, default `true`.
- `missingColor` -- color used when a system's `security` is unknown, default `'#888'`.

Like `heatmapLayer`, `routeLayer` sets `focusSystemIds` for you (the route's system ids in order), so `renderer.focusOn(route.focusSystemIds)` pans/zooms to fit the whole route.

## System dot stacking order

By default, the base system dot (and its label) draws *before* layers, so a layer like `heatmapLayer` fully covers it — this keeps values readable when zoomed out, since a dot always on top of a shrunk heatmap circle would obscure it. Set `systemDotOnTop: true` (on both the renderer and, if using `heatmapLayer`, the layer itself) to flip that — the dot stays visible above layer output instead:

```js
const renderer = new StarmapRenderer(canvas, defaultUniverseData, {
  layers: [heatmapLayer(values, { radiusMin: 2, radiusMax: 10, systemDotOnTop: true })],
  systemDotOnTop: true,
})
```

When `systemDotOnTop` is true, `heatmapLayer` also extends its circle by the system dot's own radius so it isn't fully hidden underneath the dot.

## Zooming/panning to a set of systems

`getViewport()` only reads the current pan/zoom. To change it:

- `renderer.setViewport({ offsetX?, offsetY?, scale? })` — set pan/zoom directly. Only the fields you pass change; e.g. `setViewport({ scale: 2 })` zooms without moving the pan position.
- `renderer.focusOn(systemIds)` — pans/zooms to fit the given system ids in view (e.g. only the systems a heatmap layer has values for), instead of always showing the whole map. IDs that don't exist in this renderer's data are ignored; if none of the given ids match, it's a no-op and the viewport is left as-is.

```js
// e.g. zoom to fit whatever systems a heatmap has data for
const values = new Map([[30000142, 1_500_000_000], [30000144, 800_000_000]])
const layer = heatmapLayer(values)
renderer.setLayers([layer])
renderer.focusOn(layer.focusSystemIds) // == [...values.keys()], heatmapLayer sets this for you
```

`Layer` has an optional `focusSystemIds?: number[]` property for exactly this — `heatmapLayer` fills it in automatically from its value map's keys, and any custom layer can set its own. The core renderer doesn't read it automatically (that auto-derivation lives in `eve-starmap-react`'s `EveStarmap`, see its README) — in vanilla usage, pass it to `focusOn()` yourself as above.

See `playground/` in the repo root for a full working demo (pan/zoom/click/hover/search/heatmap+region-label toggles/route lookup).

## License

MIT
