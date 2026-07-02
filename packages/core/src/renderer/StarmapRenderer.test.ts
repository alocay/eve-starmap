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
    fillStyle: '',
    strokeStyle: '',
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
    { id: 2, name: 'Beta', constellationId: 1, regionId: 1, x: 100, y: 0 },
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
    expect(ctx.arc).toHaveBeenCalledTimes(2)
    expect(ctx.stroke).toHaveBeenCalledTimes(1)
  })

  it('draws layer output on top of the base map', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)
    const layerDraw = vi.fn()

    renderer.setLayers([{ id: 'test', draw: layerDraw }])

    expect(layerDraw).toHaveBeenCalled()
  })

  it('calls onSystemClick with the nearest system within the hit-test radius', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const onSystemClick = vi.fn()
    new StarmapRenderer(canvas as any, sampleData, { onSystemClick })

    canvas._listeners.click({ clientX: 50, clientY: 50 })

    expect(onSystemClick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })

  it('calls onSystemClick with null when no system is within the hit-test radius', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const onSystemClick = vi.fn()
    new StarmapRenderer(canvas as any, sampleData, { onSystemClick })

    canvas._listeners.click({ clientX: 5000, clientY: 5000 })

    expect(onSystemClick).toHaveBeenCalledWith(null)
  })

  it('pans the viewport on pointer drag', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    canvas._listeners.pointerdown({ clientX: 0, clientY: 0 })
    canvas._listeners.pointermove({ clientX: 10, clientY: 0 })

    expect(renderer.getViewport().offsetX).toBeLessThan(0)
  })

  it('zooms the viewport on wheel', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    canvas._listeners.wheel({ deltaY: -100, preventDefault: vi.fn() })

    expect(renderer.getViewport().scale).toBeGreaterThan(1)
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
