import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
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
  focusSystemIds?: number[]
  // Whether changing `focusSystemIds` re-fits the viewport. Default true.
  // Set false to take focusSystemIds out of the auto-refit loop entirely
  // (e.g. while the user is manually panned/zoomed somewhere else).
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

  useEffect(() => {
    if (!canvasRef.current) return

    const renderer = new StarmapRenderer(canvasRef.current, data, { layers, onSystemClick, onSystemHover, initialViewport, systemDotOnTop })
    rendererRef.current = renderer
    // Fit to the initial focus (if any) before the first paint, so it doesn't
    // flash the default/full-map view before snapping to the focused area.
    if (autoCenter && focusSystemIds && focusSystemIds.length > 0) {
      renderer.focusOn(focusSystemIds)
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
    if (rendererRef.current && autoCenter && focusSystemIds && focusSystemIds.length > 0) {
      rendererRef.current.focusOn(focusSystemIds)
    }
  }, [focusSystemIds, autoCenter])

  useImperativeHandle(ref, () => ({
    onHover: (handler: HoverHandler) => {
      const renderer = rendererRef.current
      if (!renderer) return () => {}
      return renderer.onHover(handler)
    },
  }), [])

  return <canvas ref={canvasRef} width={width} height={height} />
})
