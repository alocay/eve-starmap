# eve-starmap-react

React wrapper for [eve-starmap](https://www.npmjs.com/package/eve-starmap).

## Demo

**[Try the playground](https://alocay.github.io/eve-starmap/playground/index.html)** — real pan/zoom/click/hover, system search, heatmap/heatmap-area/region-label toggles, and a route lookup.

## Install
```
npm install eve-starmap-react eve-starmap react
```
## Usage
```js
import { EveStarmap } from 'eve-starmap-react'
import { heatmapLayer, defaultUniverseData } from 'eve-starmap'

function App() {
  return (
    <EveStarmap
      data={defaultUniverseData}
      layers={[heatmapLayer(new Map([[30000142, 1_500_000_000]]))]}
      onSystemClick={(system) => console.log(system)}
    />
  )
}
```

## Layers

Layers are plain objects from `eve-starmap` (the core package) -- they work identically regardless of which framework renders them, so you pass them straight into the `layers` prop with no React-specific wiring. Four are bundled:

- **[Heatmap](#heatmap)** (`heatmapLayer`) -- per-system value visualization: flat circles whose color/opacity/radius scale with value.
- **[Heatmap Area](#heatmap-area)** (`heatmapAreaLayer`) -- rounded, zoom-dependent merging area shapes for the same kind of data (blurred "gooey" blobs, or nested contour bands).
- **[Region Labels](#region-labels)** (`regionLabelLayer`) -- draws each region's name at the centroid of its member systems.
- **[Route](#route)** (`routeLayer` + `fetchRoute`) -- draws a jump route as a polyline, each leg colored by security status.

Full option lists for all four (and how to write your own) are in [`packages/core/README.md#layers`](../core/README.md#layers) -- this section just shows the `<EveStarmap/>`-specific wiring (`useMemo` so a new layer array isn't created every render) for each.

### Heatmap

```jsx
import { useMemo } from 'react'
import { EveStarmap } from 'eve-starmap-react'
import { heatmapLayer, defaultUniverseData } from 'eve-starmap'

function App({ valuesBySystem }) { // Map<systemId, value>
  const layers = useMemo(() => [heatmapLayer(valuesBySystem)], [valuesBySystem])
  return <EveStarmap data={defaultUniverseData} layers={layers} />
}
```

See [`packages/core/README.md#heatmap`](../core/README.md#heatmap) for the full option list (`palette`, `opacityMin`/`opacityMax`, `radiusMin`/`radiusMax`, `radius`, `min`/`max`).

### Heatmap Area

```jsx
import { useMemo } from 'react'
import { EveStarmap } from 'eve-starmap-react'
import { heatmapAreaLayer, defaultUniverseData } from 'eve-starmap'

function App({ valuesBySystem }) { // Map<systemId, value>
  const layers = useMemo(
    () => [heatmapAreaLayer(valuesBySystem, { style: 'contour' })],
    [valuesBySystem]
  )
  return <EveStarmap data={defaultUniverseData} layers={layers} />
}
```

See [`packages/core/README.md#heatmap-area`](../core/README.md#heatmap-area) for the full option list (`style`, `radius`, `bands`, `blurPx`).

### Region Labels

`regionLabelLayer` (bundled in `eve-starmap`) works the same way through `EveStarmap`'s generic `layers` prop -- there's no React-specific wiring needed, since a `Layer` object is a `Layer` object regardless of where it's constructed:

```jsx
import { useMemo } from 'react'
import { EveStarmap } from 'eve-starmap-react'
import { regionLabelLayer, defaultUniverseData } from 'eve-starmap'

function App() {
  const layers = useMemo(
    () => [regionLabelLayer(defaultUniverseData.regions ?? [], defaultUniverseData.systems)],
    []
  )

  return <EveStarmap data={defaultUniverseData} layers={layers} />
}
```

To toggle labels reactively (e.g. a checkbox), pass state into the `visible` option and re-memoize on it -- either this or omitting the layer from `layers` entirely both work equally well:

```jsx
function App() {
  const [showRegions, setShowRegions] = useState(true)

  const layers = useMemo(
    () => [regionLabelLayer(defaultUniverseData.regions ?? [], defaultUniverseData.systems, { visible: showRegions })],
    [showRegions]
  )

  return (
    <>
      <button onClick={() => setShowRegions(v => !v)}>Toggle regions</button>
      <EveStarmap data={defaultUniverseData} layers={layers} />
    </>
  )
}
```

See [`packages/core/README.md#region-labels`](../core/README.md#region-labels) for the full option list (`color`, `opacity`, `fontSize`, `font`, `visible`).

### Route

`fetchRoute` is plain async (no React-specific version needed) -- call it, then memoize the resulting `routeLayer` the same way as any other layer:

```jsx
import { useEffect, useMemo, useState } from 'react'
import { EveStarmap } from 'eve-starmap-react'
import { fetchRoute, routeLayer, defaultUniverseData } from 'eve-starmap'

function App({ origin, destination }) {
  const [routeIds, setRouteIds] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchRoute(origin, destination).then(ids => {
      if (!cancelled) setRouteIds(ids)
    })
    return () => { cancelled = true }
  }, [origin, destination])

  const layers = useMemo(
    () => (routeIds ? [routeLayer(routeIds, defaultUniverseData)] : []),
    [routeIds]
  )

  // No focusSystemIds needed -- routeLayer sets it for you, and EveStarmap
  // fits the view to it automatically (see "Zooming to fit a set of systems").
  return <EveStarmap data={defaultUniverseData} layers={layers} />
}
```

See [`packages/core/README.md#route`](../core/README.md#route) for the full option lists for both `fetchRoute` (`flag`, `avoid`, `connections`, `baseUrl`, `fetch`) and `routeLayer` (`securityColors`, `colorForNode`, `gradient`, `lineWidth`, `endpointMarkers`, `missingColor`).

## Hover (simple case)

For a single hover behavior, pass `onSystemHover` directly -- no ref needed:

```jsx
import { useState } from 'react'
import { EveStarmap } from 'eve-starmap-react'
import { defaultUniverseData } from 'eve-starmap'

function App() {
  const [hovered, setHovered] = useState(null)

  return (
    <>
      <EveStarmap
        data={defaultUniverseData}
        onSystemHover={(system) => setHovered(system)}
      />
      {hovered && <div className="tooltip">{hovered.name}</div>}
    </>
  )
}
```

## Multiple hover behaviors

`onSystemHover` covers the simple case (one handler). For independent features that each want their own hover behavior (e.g. a tooltip component AND a highlight-ring component, without them overwriting each other), pass a `ref` and call `onHover()` on it -- it maps straight to the core renderer's [`onHover()`](../core/README.md#hover-behavior):

```jsx
import { useEffect, useRef, useState } from 'react'
import { EveStarmap } from 'eve-starmap-react'
import { defaultUniverseData } from 'eve-starmap'

function Tooltip() {
  const mapRef = useRef(null)
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    return mapRef.current?.onHover((system) => setHovered(system))
  }, [])

  return (
    <>
      <EveStarmap ref={mapRef} data={defaultUniverseData} />
      {hovered && <div className="tooltip">{hovered.name}</div>}
    </>
  )
}
```

Each component that wants its own hover reaction calls `mapRef.current.onHover(fn)` in its own `useEffect`, returning the unsubscribe function for cleanup on unmount -- same pattern as subscribing to any other event source in React. Every registered handler (this one and `onSystemHover`) also fires with `(null, null)` when the pointer leaves the canvas, so hover state doesn't stay stuck after the mouse moves off the map.

## Drawing on the canvas on hover (highlight ring, label, color)

`onHover` (via ref) only gives you `system` + `screenPos` -- it doesn't touch the canvas itself. Canvas effects (a highlight ring, a label, a color change) have to go through the `layers` prop instead, since the canvas fully clears and redraws every frame and a one-off draw call would get wiped on the next pan/zoom. Combine both: `onHover` sets state, a `useMemo`'d layer reads that state and draws:

```jsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { EveStarmap } from 'eve-starmap-react'
import { defaultUniverseData } from 'eve-starmap'

function App() {
  const mapRef = useRef(null)
  const [hovered, setHovered] = useState(null)

  useEffect(() => {
    return mapRef.current?.onHover((system) => setHovered(system))
  }, [])

  const layers = useMemo(() => [
    {
      id: 'hover-highlight',
      draw(ctx, viewport) {
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
    },
  ], [hovered])

  return (
    <>
      <EveStarmap ref={mapRef} data={defaultUniverseData} layers={layers} />
      {hovered && <div className="tooltip">{hovered.name}</div>}
    </>
  )
}
```

`hovered` changing produces a new `layers` array (via the `useMemo` dependency), which `EveStarmap` picks up in its own effect and calls `setLayers()` + redraws -- no extra ref methods needed for this. The DOM tooltip in the same example needs no `Layer` at all; it's positioned with plain CSS from the same `onHover` callback.

## Zooming to fit a set of systems

By default, you don't need to compute anything: if a layer declares `focusSystemIds` (heatmapLayer does, automatically, from its value map's keys), `EveStarmap` zooms to fit those systems on its own:

```jsx
import { useMemo } from 'react'
import { EveStarmap } from 'eve-starmap-react'
import { heatmapLayer, defaultUniverseData } from 'eve-starmap'

function App({ lossesBySystem }) { // Map<systemId, iskLost>
  const layers = useMemo(() => [heatmapLayer(lossesBySystem)], [lossesBySystem])

  // No focusSystemIds needed -- it's derived from heatmapLayer's own data,
  // and re-fits automatically whenever lossesBySystem (and so layers) changes.
  return <EveStarmap data={defaultUniverseData} layers={layers} />
}
```

Pass `focusSystemIds` (an array of system ids) explicitly if you want to override that derived default -- it always wins over whatever `layers` would otherwise suggest, and re-fits any time the array changes (new reference, same as `layers`):

```jsx
<EveStarmap data={defaultUniverseData} layers={layers} focusSystemIds={[30000142, 30000144]} />
```

`autoCenter` (default `true`) is the one flag controlling whether *either* source -- explicit `focusSystemIds` or layer-derived -- is allowed to move the viewport at all. Set `autoCenter={false}` once the user has manually panned/zoomed somewhere else and you don't want new data snapping them back.

If none of the resolved ids match a real system (explicit or derived), it's a no-op -- the viewport stays as it was (or at `initialViewport`, if nothing's focused yet).

### Adding focus support to a custom layer

Any layer can opt into this by setting a `focusSystemIds` property (`number[]`) alongside its `id`/`draw` -- it doesn't have to be a heatmap:

```js
const myLayer = {
  id: 'alliance-systems',
  focusSystemIds: [...allianceSystemIds],
  draw(ctx, viewport, systems) { /* ... */ },
}
```

## License

MIT
