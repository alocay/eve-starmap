import type { Layer, SystemNode, Viewport } from '../types.js'
import { createColorScale, type ColorScaleOptions } from '../colorScale.js'
import { worldToScreen } from '../viewport.js'

export interface HeatmapLayerOptions extends ColorScaleOptions {
  radius?: number
}

export function heatmapLayer(values: Map<number, number>, options: HeatmapLayerOptions = {}): Layer {
  const colorFor = createColorScale([...values.values()], options)
  const radius = options.radius ?? 4

  return {
    id: 'heatmap',
    draw(ctx: CanvasRenderingContext2D, viewport: Viewport, systems: SystemNode[]): void {
      for (const system of systems) {
        const value = values.get(system.id)
        if (value === undefined) continue

        const { x, y } = worldToScreen(viewport, system.x, system.y)
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fillStyle = colorFor(value)
        ctx.fill()
      }
    },
  }
}
