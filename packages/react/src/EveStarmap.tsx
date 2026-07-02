import { useEffect, useRef } from 'react'
import { StarmapRenderer } from 'eve-starmap'
import type { UniverseData, Layer, SystemNode } from 'eve-starmap'

export interface EveStarmapProps {
  data: UniverseData
  layers?: Layer[]
  onSystemClick?: (system: SystemNode | null) => void
  onSystemHover?: (system: SystemNode | null) => void
  width?: number
  height?: number
}

export function EveStarmap({
  data,
  layers,
  onSystemClick,
  onSystemHover,
  width = 800,
  height = 600,
}: EveStarmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<StarmapRenderer | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const renderer = new StarmapRenderer(canvasRef.current, data, { layers, onSystemClick, onSystemHover })
    rendererRef.current = renderer
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

  return <canvas ref={canvasRef} width={width} height={height} />
}
