import type { Layer, SystemNode, Viewport } from '../types.js'
import { createColorScale, createValueScale, lerp, type ColorScaleOptions } from '../colorScale.js'
import { worldToScreen } from '../viewport.js'
import { SYSTEM_DOT_RADIUS } from '../constants.js'

export interface HeatmapLayerOptions extends ColorScaleOptions {
  radius?: number
  radiusMin?: number
  radiusMax?: number
  // Match this to the renderer's own `systemDotOnTop` option. When true, the system
  // dot draws on top of this layer, so the circle must extend past the dot's
  // own radius or it gets fully hidden underneath it. Default false.
  systemDotOnTop?: boolean
}

export function heatmapLayer(values: Map<number, number>, options: HeatmapLayerOptions = {}): Layer {
  const rawValues = [...values.values()]
  const colorFor = createColorScale(rawValues, options)

  const defaultRadius = options.radius ?? 4
  const radiusMin = options.radiusMin ?? defaultRadius
  const radiusMax = options.radiusMax ?? defaultRadius
  const hasRadiusRange = radiusMin !== radiusMax
  const radiusScale = hasRadiusRange ? createValueScale(rawValues, options) : null
  const dotOffset = options.systemDotOnTop ? SYSTEM_DOT_RADIUS : 0

  return {
    id: 'heatmap',
    draw(ctx: CanvasRenderingContext2D, viewport: Viewport, systems: SystemNode[]): void {
      for (const system of systems) {
        const value = values.get(system.id)
        if (value === undefined) continue

        const { x, y } = worldToScreen(viewport, system.x, system.y)
        const baseRadius = radiusScale ? lerp(radiusMin, radiusMax, radiusScale(value)) : radiusMin
        const radius = baseRadius + dotOffset
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fillStyle = colorFor(value)
        ctx.fill()
      }
    },
  }
}
