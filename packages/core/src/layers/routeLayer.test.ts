import { describe, it, expect, vi } from 'vitest'
import { routeLayer } from './routeLayer.js'
import type { UniverseData } from '../types.js'

function sys(id: number, x: number, y: number, security: number) {
  return { id, name: `S${id}`, constellationId: 1, regionId: 1, x, y, security }
}

function makeMockCtx() {
  const gradient = { addColorStop: vi.fn() }
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    strokeStyle: '' as any,
    fillStyle: '' as any,
    lineWidth: 0,
    _gradient: gradient,
  }
}

const viewport = { offsetX: 0, offsetY: 0, scale: 1, width: 100, height: 100 }
const colors = { '0.5': '#a50', '0.4': '#960', '0.0': '#5a0' }

const universe: UniverseData = {
  systems: [sys(1, 0, 0, 0.5), sys(2, 10, 0, 0.4), sys(3, 20, 0, 0.44)],
  stargates: [],
}

describe('routeLayer', () => {
  it('has id "route"', () => {
    expect(routeLayer([1, 2], universe, { securityColors: colors }).id).toBe('route')
  })

  it('exposes focusSystemIds equal to the route ids', () => {
    expect(routeLayer([1, 2, 3], universe, { securityColors: colors }).focusSystemIds).toEqual([1, 2, 3])
  })

  it('draws one gradient-stroked segment per leg', () => {
    const layer = routeLayer([1, 2, 3], universe, { securityColors: colors })
    const ctx = makeMockCtx()
    layer.draw(ctx as any, viewport, [])
    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(2) // 3 ids -> 2 legs
    expect(ctx.stroke).toHaveBeenCalledTimes(2)
  })

  it('builds each leg gradient from the two endpoints tier colors', () => {
    const layer = routeLayer([1, 2], universe, { securityColors: colors })
    const ctx = makeMockCtx()
    layer.draw(ctx as any, viewport, [])
    expect(ctx._gradient.addColorStop).toHaveBeenCalledWith(0, '#a50') // sys1 0.5
    expect(ctx._gradient.addColorStop).toHaveBeenCalledWith(1, '#960') // sys2 0.4
  })

  it('breaks the polyline across a system missing from the data', () => {
    // id 99 not in universe -> legs 1-99 and 99-2 both skipped, only... none drawn
    const layer = routeLayer([1, 99, 2], universe, { securityColors: colors })
    const ctx = makeMockCtx()
    layer.draw(ctx as any, viewport, [])
    expect(ctx.stroke).not.toHaveBeenCalled()
  })

  it('draws endpoint markers by default and skips them when disabled', () => {
    const on = makeMockCtx()
    routeLayer([1, 2], universe, { securityColors: colors }).draw(on as any, viewport, [])
    expect(on.arc).toHaveBeenCalledTimes(2) // origin + destination

    const off = makeMockCtx()
    routeLayer([1, 2], universe, { securityColors: colors, endpointMarkers: false }).draw(off as any, viewport, [])
    expect(off.arc).not.toHaveBeenCalled()
  })

  it('draws only a marker for a single-system route', () => {
    const ctx = makeMockCtx()
    routeLayer([1], universe, { securityColors: colors }).draw(ctx as any, viewport, [])
    expect(ctx.stroke).not.toHaveBeenCalled()
    expect(ctx.arc).toHaveBeenCalledTimes(1)
  })

  it('draws nothing for an empty route', () => {
    const ctx = makeMockCtx()
    routeLayer([], universe, { securityColors: colors }).draw(ctx as any, viewport, [])
    expect(ctx.stroke).not.toHaveBeenCalled()
    expect(ctx.arc).not.toHaveBeenCalled()
  })

  it('defaults to the bundled palette when no options given', () => {
    const ctx = makeMockCtx()
    routeLayer([1, 2], universe).draw(ctx as any, viewport, [])
    // sys1 is 0.5 -> default 0.5 color #f3fd82
    expect(ctx._gradient.addColorStop).toHaveBeenCalledWith(0, '#f3fd82')
  })

  it('uses colorForNode override instead of the palette', () => {
    const colorForNode = vi.fn(() => '#123456')
    const ctx = makeMockCtx()
    routeLayer([1, 2], universe, { colorForNode }).draw(ctx as any, viewport, [])
    expect(colorForNode).toHaveBeenCalled()
    expect(ctx._gradient.addColorStop).toHaveBeenCalledWith(0, '#123456')
    expect(ctx._gradient.addColorStop).toHaveBeenCalledWith(1, '#123456')
  })

  it('with gradient:false strokes each leg solid in the start node color', () => {
    const ctx = makeMockCtx()
    const strokeColors: string[] = []
    // capture strokeStyle at each stroke() call
    ctx.stroke = vi.fn(() => { strokeColors.push(ctx.strokeStyle as string) })
    routeLayer([1, 2], universe, { securityColors: colors, gradient: false }).draw(ctx as any, viewport, [])
    expect(ctx.createLinearGradient).not.toHaveBeenCalled()
    expect(strokeColors).toEqual(['#a50']) // leg 1->2 solid = sys1 (0.5) color
  })
})
