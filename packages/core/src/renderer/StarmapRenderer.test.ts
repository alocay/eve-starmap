import { describe, it, expect, vi } from 'vitest'
import { StarmapRenderer } from './StarmapRenderer.js'

function makeMockCtx() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
  }
}

function makeMockCanvas(ctx: any) {
  const listeners: Record<string, (e: any) => void> = {}
  return {
    width: 100,
    height: 100,
    getContext: vi.fn(() => ctx),
    addEventListener: vi.fn((type: string, fn: any) => { listeners[type] = fn }),
    removeEventListener: vi.fn((type: string) => { delete listeners[type] }),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 })),
    _listeners: listeners,
  }
}

const sampleData = {
  systems: [
    { id: 1, name: 'Alpha', constellationId: 1, regionId: 1, x: 0, y: 0 },
    { id: 2, name: 'Beta', constellationId: 1, regionId: 1, x: 40, y: 0 },
    { id: 3, name: 'Gamma', constellationId: 1, regionId: 1, x: 500, y: 0 },
  ],
  stargates: [{ fromSystemId: 1, toSystemId: 2 }],
}

describe('StarmapRenderer', () => {
  it('throws if the canvas has no 2D context', () => {
    const canvas = makeMockCanvas(null)
    expect(() => new StarmapRenderer(canvas as any, sampleData)).toThrow('Canvas 2D context unavailable')
  })

  it('throws when constructed with malformed universe data', () => {
    const canvas = makeMockCanvas(makeMockCtx())
    expect(() => new StarmapRenderer(canvas as any, { systems: 'nope' } as any)).toThrow()
  })

  it('draw() clears the canvas and renders systems and stargates', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    renderer.draw()

    expect(ctx.clearRect).toHaveBeenCalled()
    // arc called twice for systems 1 and 2 only; system 3 (Gamma at x:500) is outside
    // the default visible bounds and must be culled by the quadtree to avoid regression
    expect(ctx.arc).toHaveBeenCalledTimes(2)
    expect(ctx.stroke).toHaveBeenCalledTimes(1)
  })

  it('excludes systems outside the visible viewport bounds from rendering', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    renderer.draw()

    // system 3 (x: 500) is far outside the default visible bounds — if culling
    // were removed/bypassed, arc would be called 3 times instead of 2
    expect(ctx.arc).toHaveBeenCalledTimes(2)
  })

  it('draws layer output on top of the base map', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)
    const layerDraw = vi.fn()

    renderer.setLayers([{ id: 'test', draw: layerDraw }])

    expect(layerDraw).toHaveBeenCalled()
  })

  it('draws system dots before layers by default (systemDotOnTop unset)', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)
    const order: string[] = []
    ctx.arc.mockImplementation(() => order.push('dot'))
    const layerDraw = vi.fn(() => order.push('layer'))

    renderer.setLayers([{ id: 'test', draw: layerDraw }])

    expect(order[0]).toBe('dot')
    expect(order[order.length - 1]).toBe('layer')
  })

  it('draws system dots after layers when systemDotOnTop is true', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData, { systemDotOnTop: true })
    const order: string[] = []
    ctx.arc.mockImplementation(() => order.push('dot'))
    const layerDraw = vi.fn(() => order.push('layer'))

    renderer.setLayers([{ id: 'test', draw: layerDraw }])

    expect(order[0]).toBe('layer')
    expect(order[order.length - 1]).toBe('dot')
  })

  it('uses the default system dot radius, color, and full opacity when unset', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    renderer.draw()

    expect(ctx.arc).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 2, 0, Math.PI * 2)
    expect(ctx.fillStyle).toBe('#8a99aa')
    expect(ctx.globalAlpha).toBe(1)
  })

  it('honors custom systemDotRadius, systemDotColor, and systemDotOpacity from construction', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData, {
      systemDotRadius: 6, systemDotColor: '#ff00ff', systemDotOpacity: 0.3,
    })

    renderer.draw()

    expect(ctx.arc).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 6, 0, Math.PI * 2)
    expect(ctx.fillStyle).toBe('#ff00ff')
    expect(ctx.globalAlpha).toBe(0.3)
  })

  it('updates system dot style live via setSystemDotStyle without touching unspecified fields', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData, { systemDotColor: '#111111' })

    renderer.setSystemDotStyle({ systemDotOpacity: 0.5 })
    renderer.draw()

    expect(ctx.fillStyle).toBe('#111111')
    expect(ctx.globalAlpha).toBe(0.5)
  })

  it('restores the canvas context state after drawing system dots (save/restore)', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData, { systemDotOpacity: 0.5 })

    renderer.draw()

    expect(ctx.save).toHaveBeenCalled()
    expect(ctx.restore).toHaveBeenCalled()
  })

  it('calls onSystemClick with the nearest system within the hit-test radius', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const onSystemClick = vi.fn()
    new StarmapRenderer(canvas as any, sampleData, { onSystemClick })

    canvas._listeners.click({ clientX: 50, clientY: 50 })

    expect(onSystemClick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { x: 50, y: 50 })
  })

  it('calls onSystemClick with null when no system is within the hit-test radius', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const onSystemClick = vi.fn()
    new StarmapRenderer(canvas as any, sampleData, { onSystemClick })

    canvas._listeners.click({ clientX: 5000, clientY: 5000 })

    expect(onSystemClick).toHaveBeenCalledWith(null, null)
  })

  it('calls onSystemHover with the system and its canvas-relative screen position', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const onSystemHover = vi.fn()
    new StarmapRenderer(canvas as any, sampleData, { onSystemHover })

    canvas._listeners.pointermove({ clientX: 50, clientY: 50 })

    expect(onSystemHover).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { x: 50, y: 50 })
  })

  it('calls onSystemHover with null, null when hovering empty space', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const onSystemHover = vi.fn()
    new StarmapRenderer(canvas as any, sampleData, { onSystemHover })

    canvas._listeners.pointermove({ clientX: 5000, clientY: 5000 })

    expect(onSystemHover).toHaveBeenCalledWith(null, null)
  })

  it('calls onSystemHover with null, null when the pointer leaves the canvas', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const onSystemHover = vi.fn()
    new StarmapRenderer(canvas as any, sampleData, { onSystemHover })

    canvas._listeners.pointermove({ clientX: 50, clientY: 50 })
    onSystemHover.mockClear()
    canvas._listeners.pointerleave({})

    expect(onSystemHover).toHaveBeenCalledWith(null, null)
  })

  it('onHover() registered handlers also clear when the pointer leaves the canvas', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)
    const handler = vi.fn()
    renderer.onHover(handler)

    canvas._listeners.pointermove({ clientX: 50, clientY: 50 })
    handler.mockClear()
    canvas._listeners.pointerleave({})

    expect(handler).toHaveBeenCalledWith(null, null)
  })

  it('stops an in-progress pan when the pointer leaves the canvas', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    canvas._listeners.pointerdown({ clientX: 0, clientY: 0 })
    canvas._listeners.pointerleave({})
    const viewportAfterLeave = renderer.getViewport()
    canvas._listeners.pointermove({ clientX: 10, clientY: 0 })

    // If panning weren't stopped, this pointermove (with no pointerdown before it)
    // would still shift the viewport instead of triggering a hover lookup.
    expect(renderer.getViewport().offsetX).toBe(viewportAfterLeave.offsetX)
  })

  it('onHover() registers a handler invoked on every hover, independent of onSystemHover', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const onSystemHover = vi.fn()
    const renderer = new StarmapRenderer(canvas as any, sampleData, { onSystemHover })
    const extraHandler = vi.fn()

    renderer.onHover(extraHandler)
    canvas._listeners.pointermove({ clientX: 50, clientY: 50 })

    expect(onSystemHover).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { x: 50, y: 50 })
    expect(extraHandler).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { x: 50, y: 50 })
  })

  it('onHover() supports multiple independently-registered handlers', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)
    const handlerA = vi.fn()
    const handlerB = vi.fn()

    renderer.onHover(handlerA)
    renderer.onHover(handlerB)
    canvas._listeners.pointermove({ clientX: 50, clientY: 50 })

    expect(handlerA).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { x: 50, y: 50 })
    expect(handlerB).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), { x: 50, y: 50 })
  })

  it('onHover() returns an unsubscribe function that stops future calls', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)
    const handler = vi.fn()

    const unsubscribe = renderer.onHover(handler)
    unsubscribe()
    canvas._listeners.pointermove({ clientX: 50, clientY: 50 })

    expect(handler).not.toHaveBeenCalled()
  })

  it('pans the viewport on pointer drag', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    canvas._listeners.pointerdown({ clientX: 0, clientY: 0 })
    canvas._listeners.pointermove({ clientX: 10, clientY: 0 })

    expect(renderer.getViewport().offsetX).toBeLessThan(0)
  })

  it('dragging downward pans the map content downward (content follows the cursor), not the reverse', () => {
    // Regression test: screen y is inverted relative to world y (worldToScreen
    // negates it), so offsetY's drag delta must be applied with the opposite
    // sign from offsetX's, or a downward drag would pan the map upward.
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    canvas._listeners.pointerdown({ clientX: 0, clientY: 0 })
    canvas._listeners.pointermove({ clientX: 0, clientY: 10 })

    // offsetY increasing means a fixed world point's screen y increases
    // (moves down, per worldToScreen's h/2 - (y-offsetY)*scale), i.e. content
    // moved down along with the downward drag.
    expect(renderer.getViewport().offsetY).toBeGreaterThan(0)
  })

  it('zooms the viewport on wheel', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    canvas._listeners.wheel({ deltaY: -100, preventDefault: vi.fn() })

    expect(renderer.getViewport().scale).toBeGreaterThan(1)
  })

  it('setViewport() updates only the given fields, leaving the rest untouched', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData, { initialViewport: { offsetX: 10, offsetY: 20, scale: 1 } })
    ctx.clearRect.mockClear()

    renderer.setViewport({ scale: 3 })

    expect(renderer.getViewport()).toEqual(expect.objectContaining({ offsetX: 10, offsetY: 20, scale: 3 }))
    expect(ctx.clearRect).toHaveBeenCalled()
  })

  it('setViewport() clamps scale to the renderer\'s allowed range', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    renderer.setViewport({ scale: 1e30 })

    expect(renderer.getViewport().scale).toBeLessThan(1e30)
  })

  it('focusOn() pans/zooms the viewport to fit the given system ids', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    renderer.focusOn([1, 3]) // world x: 0 and 500

    const viewport = renderer.getViewport()
    expect(viewport.offsetX).toBe(250)
    expect(viewport.offsetY).toBe(0)
    expect(viewport.scale).toBeCloseTo(0.18)
  })

  it('focusOn() is a no-op when none of the given system ids exist', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)
    const before = renderer.getViewport()

    renderer.focusOn([999])

    expect(renderer.getViewport()).toEqual(before)
  })

  it('focusOn() falls back to a span of 1 for a single system so scale stays finite', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    renderer.focusOn([1])

    const viewport = renderer.getViewport()
    expect(viewport.offsetX).toBe(0)
    expect(viewport.offsetY).toBe(0)
    expect(Number.isFinite(viewport.scale)).toBe(true)
  })

  it('removes all event listeners on destroy', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    renderer.destroy()

    expect(canvas.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    expect(canvas.removeEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function))
    expect(canvas.removeEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function))
    expect(canvas.removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function))
    expect(canvas.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function))
  })
})
