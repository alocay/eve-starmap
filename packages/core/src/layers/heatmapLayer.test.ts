import { describe, it, expect, vi } from 'vitest'
import { heatmapLayer } from './heatmapLayer.js'
import { SYSTEM_DOT_RADIUS } from '../constants.js'

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

  it('exposes focusSystemIds as the value map\'s keys', () => {
    const layer = heatmapLayer(new Map([[1, 100], [2, 200]]))
    expect(layer.focusSystemIds).toEqual([1, 2])
  })

  it('exposes an empty focusSystemIds for an empty value map', () => {
    const layer = heatmapLayer(new Map())
    expect(layer.focusSystemIds).toEqual([])
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

  it('uses a fixed radius for every system when radiusMin/radiusMax are not given', () => {
    const systems = [sys(1, 0, 0), sys(2, 10, 10)]
    const layer = heatmapLayer(new Map([[1, 0], [2, 100]]), { radius: 7 })
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, systems)

    // world (0,0) / (10,10) -> screen (50,50) / (60,40) per worldToScreen's centering
    // (screen y is inverted relative to world y so the map matches in-game orientation).
    expect(ctx.arc).toHaveBeenNthCalledWith(1, 50, 50, 7, 0, Math.PI * 2)
    expect(ctx.arc).toHaveBeenNthCalledWith(2, 60, 40, 7, 0, Math.PI * 2)
  })

  it('interpolates radius alongside the value range when radiusMin/radiusMax are given', () => {
    const systems = [sys(1, 0, 0), sys(2, 10, 10)]
    const layer = heatmapLayer(new Map([[1, 0], [2, 100]]), { radiusMin: 2, radiusMax: 10 })
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, systems)

    expect(ctx.arc).toHaveBeenNthCalledWith(1, 50, 50, 2, 0, Math.PI * 2)
    expect(ctx.arc).toHaveBeenNthCalledWith(2, 60, 40, 10, 0, Math.PI * 2)
  })

  it('does not add the system dot radius by default (systemDotOnTop unset)', () => {
    const systems = [sys(1, 0, 0)]
    const layer = heatmapLayer(new Map([[1, 100]]), { radius: 7 })
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, systems)

    expect(ctx.arc).toHaveBeenCalledWith(50, 50, 7, 0, Math.PI * 2)
  })

  it('adds the system dot radius when systemDotOnTop is true, to stay visible around the dot', () => {
    const systems = [sys(1, 0, 0)]
    const layer = heatmapLayer(new Map([[1, 100]]), { radius: 7, systemDotOnTop: true })
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, systems)

    expect(ctx.arc).toHaveBeenCalledWith(50, 50, 7 + SYSTEM_DOT_RADIUS, 0, Math.PI * 2)
  })

  it('uses a custom systemDotRadius (matching a customized renderer dot size) instead of the default', () => {
    const systems = [sys(1, 0, 0)]
    const layer = heatmapLayer(new Map([[1, 100]]), { radius: 7, systemDotOnTop: true, systemDotRadius: 10 })
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, systems)

    expect(ctx.arc).toHaveBeenCalledWith(50, 50, 17, 0, Math.PI * 2)
  })
})
