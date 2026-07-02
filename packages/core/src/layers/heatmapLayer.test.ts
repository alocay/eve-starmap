import { describe, it, expect, vi } from 'vitest'
import { heatmapLayer } from './heatmapLayer.js'

function sys(id: number, x: number, y: number) {
  return { id, name: `S${id}`, constellationId: 1, regionId: 1, x, y }
}

function makeMockCtx() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
  }
}

const viewport = { offsetX: 0, offsetY: 0, scale: 1, width: 100, height: 100 }

describe('heatmapLayer', () => {
  it('has id "heatmap"', () => {
    expect(heatmapLayer(new Map()).id).toBe('heatmap')
  })

  it('draws a filled circle for each system present in the value map', () => {
    const systems = [sys(1, 0, 0), sys(2, 10, 10)]
    const layer = heatmapLayer(new Map([[1, 100]]))
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, systems)

    expect(ctx.arc).toHaveBeenCalledTimes(1)
    expect(ctx.fill).toHaveBeenCalledTimes(1)
  })

  it('skips systems absent from the value map', () => {
    const systems = [sys(1, 0, 0)]
    const layer = heatmapLayer(new Map())
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, systems)

    expect(ctx.arc).not.toHaveBeenCalled()
  })

  it('assigns different fill colors for systems with different values', () => {
    const systems = [sys(1, 0, 0), sys(2, 10, 10)]
    const layer = heatmapLayer(new Map([[1, 0], [2, 100]]))
    const fillStyles: string[] = []
    const ctx = makeMockCtx()
    Object.defineProperty(ctx, 'fillStyle', {
      set(v) { fillStyles.push(v) },
      get() { return fillStyles[fillStyles.length - 1] },
    })

    layer.draw(ctx as any, viewport, systems)

    expect(fillStyles[0]).not.toBe(fillStyles[1])
  })
})
