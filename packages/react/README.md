# eve-starmap-react

React wrapper for [eve-starmap](https://www.npmjs.com/package/eve-starmap).

## Install

npm install eve-starmap-react eve-starmap react

## Usage

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

Each component that wants its own hover reaction calls `mapRef.current.onHover(fn)` in its own `useEffect`, returning the unsubscribe function for cleanup on unmount -- same pattern as subscribing to any other event source in React.

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

Pass `focusSystemIds` (an array of system ids) to pan/zoom the map to fit just those systems, instead of always showing the whole map -- e.g. zoom to whatever systems a heatmap has data for. It re-fits any time the array changes (new reference, same as `layers`):

```jsx
import { useMemo } from 'react'
import { EveStarmap } from 'eve-starmap-react'
import { heatmapLayer, defaultUniverseData } from 'eve-starmap'

function App({ lossesBySystem }) { // Map<systemId, iskLost>
  const layers = useMemo(() => [heatmapLayer(lossesBySystem)], [lossesBySystem])
  const focusSystemIds = useMemo(() => [...lossesBySystem.keys()], [lossesBySystem])

  return (
    <EveStarmap
      data={defaultUniverseData}
      layers={layers}
      focusSystemIds={focusSystemIds}
    />
  )
}
```

Set `autoCenter={false}` to stop `focusSystemIds` changes from moving the viewport (e.g. once the user has manually panned/zoomed somewhere else and you don't want new data snapping them back). Default is `true`.

If none of the ids in `focusSystemIds` match a real system, it's a no-op -- the viewport stays as it was (or at `initialViewport`, if nothing's focused yet).

## License

MIT
