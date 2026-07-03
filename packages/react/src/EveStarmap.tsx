import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { StarmapRenderer } from 'eve-starmap'
import type { UniverseData, Layer, StarmapRendererOptions, HoverHandler } from 'eve-starmap'

export interface EveStarmapProps {
  data: UniverseData
  layers?: Layer[]
  onSystemClick?: StarmapRendererOptions['onSystemClick']
  onSystemHover?: StarmapRendererOptions['onSystemHover']
  width?: number
  height?: number
  initialViewport?: StarmapRendererOptions['initialViewport']
  systemDotOnTop?: StarmapRendererOptions['systemDotOnTop']
  // System ids to pan/zoom to fit -- e.g. only the systems a heatmap layer has
  // values for, so the view zooms to the relevant area instead of always
  // showing the full map. Re-fits whenever this list changes (new array
  // reference), same as the `layers` prop.
  //
  // If omitted, ids are derived automatically from `layers` (any layer whose
  // `focusSystemIds` property is set, e.g. heatmapLayer's value-map keys) --
  // so passing a heatmap layer alone is enough to get a fitted view, no
  // separate array to compute and keep in sync yourself.
  focusSystemIds?: number[]
  // Whether focus (explicit `focusSystemIds`, or auto-derived from `layers`)
  // re-fits the viewport. Default true. Set false to disable auto-refit
  // entirely -- e.g. once the user has manually panned/zoomed somewhere else
  // and new data shouldn't snap them back.
  autoCenter?: boolean
}

// Exposed via ref for behaviors that don't fit a single onSystemHover prop --
// e.g. a feature component registering its own hover handler (highlight ring,
// side panel, etc.) alongside others without them overwriting each other.
export interface EveStarmapHandle {
  onHover(handler: HoverHandler): () => void
}

export const EveStarmap = forwardRef<EveStarmapHandle, EveStarmapProps>(function EveStarmap({
  data,
  layers,
  onSystemClick,
  onSystemHover,
  width = 800,
  height = 600,
  initialViewport,
  systemDotOnTop,
  focusSystemIds,
  autoCenter = true,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<StarmapRenderer | null>(null)

  const effectiveFocusSystemIds = useMemo(() => {
    if (focusSystemIds) return focusSystemIds
    if (!layers) return undefined
    const derived = layers.flatMap(l => l.focusSystemIds ?? [])
    return derived.length > 0 ? derived : undefined
  }, [focusSystemIds, layers])

  useEffect(() => {
    if (!canvasRef.current) return

    const renderer = new StarmapRenderer(canvasRef.current, data, { layers, onSystemClick, onSystemHover, initialViewport, systemDotOnTop })
    rendererRef.current = renderer
    // Fit to the initial focus (if any) before the first paint, so it doesn't
    // flash the default/full-map view before snapping to the focused area.
    if (autoCenter && effectiveFocusSystemIds && effectiveFocusSystemIds.length > 0) {
      renderer.focusOn(effectiveFocusSystemIds)
    }
    renderer.draw()

    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  useEffect(() => {
    if (rendererRef.current && layers) {
      rendererRef.current.setLayers(layers)
    }
  }, [layers])

  useEffect(() => {
    if (rendererRef.current && autoCenter && effectiveFocusSystemIds && effectiveFocusSystemIds.length > 0) {
      rendererRef.current.focusOn(effectiveFocusSystemIds)
    }
  }, [effectiveFocusSystemIds, autoCenter])

  useImperativeHandle(ref, () => ({
    onHover: (handler: HoverHandler) => {
      const renderer = rendererRef.current
      if (!renderer) return () => {}
      return renderer.onHover(handler)
    },
  }), [])

  return <canvas ref={canvasRef} width={width} height={height} />
})
