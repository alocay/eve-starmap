# eve-starmap

Framework-agnostic Canvas 2D renderer for EVE Online's 2D starmap — from a single constellation up to the full galaxy — with a pluggable layer system.

## Install

npm install eve-starmap

## Usage

import { StarmapRenderer, heatmapLayer, defaultUniverseData } from 'eve-starmap'

const canvas = document.querySelector('canvas')
const renderer = new StarmapRenderer(canvas, defaultUniverseData, {
  layers: [heatmapLayer(new Map([[30000142, 1_500_000_000]]))],
  onSystemClick: (system) => console.log(system),
})
renderer.draw()

## Custom data

Pass your own `UniverseData` (`{ systems: SystemNode[], stargates: StargateEdge[] }`) instead of `defaultUniverseData` to use a different or fresher dataset. Invalid data throws at construction time.

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

Every registered handler (plus `onSystemHover`, if set) runs on each pointermove — none of them overwrite each other.

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
renderer.setLayers([heatmapLayer(values)])
renderer.focusOn([...values.keys()])
```

See `playground/` in the repo root for a full working demo (pan/zoom/click/hover/search/heatmap toggle).

## License

MIT
