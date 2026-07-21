import { describe, it, expect, vi } from 'vitest'
import { heatmapAreaLayer } from './heatmapAreaLayer.js'

function sys(id: number, x: number, y: number) {
  return { id, name: `S${id}`, constellationId: 1, regionId: 1, x, y }
}

const viewport = { offsetX: 0, offsetY: 0, scale: 1, width: 100, height: 100 }

function makeMockCtx() {
  return { drawImage: vi.fn() }
}

function makeFakeOffscreenCtx() {
  const gradient = { addColorStop: vi.fn() }
  const ctx: any = {
    filter: '',
    fillStyle: '',
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    createImageData: vi.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h })),
    putImageData: vi.fn(),
    drawImage: vi.fn(),
    gradient,
  }
  const compositeLog: string[] = []
  Object.defineProperty(ctx, 'globalCompositeOperation', {
    set(v: string) { compositeLog.push(v) },
    get() { return compositeLog[compositeLog.length - 1] },
  })
  ctx.compositeLog = compositeLog
  return ctx
}

function makeFakeCanvasFactory() {
  const canvases: any[] = []
  const factory = vi.fn((width: number, height: number) => {
    const ctx = makeFakeOffscreenCtx()
    const canvas = { width, height, getContext: () => ctx, ctx }
    canvases.push(canvas)
    return canvas
  })
  return { factory, canvases }
}

describe('heatmapAreaLayer', () => {
  it('has id "heatmap-area"', () => {
    expect(heatmapAreaLayer(new Map()).id).toBe('heatmap-area')
  })

  it("exposes focusSystemIds as the value map's keys", () => {
    const layer = heatmapAreaLayer(new Map([[1, 10], [2, 20]]))
    expect(layer.focusSystemIds).toEqual([1, 2])
  })

  it('draws nothing and never creates an offscreen canvas when the value map is empty', () => {
    const { factory } = makeFakeCanvasFactory()
    const layer = heatmapAreaLayer(new Map(), { createOffscreenCanvas: factory })
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

    expect(factory).not.toHaveBeenCalled()
    expect(ctx.drawImage).not.toHaveBeenCalled()
  })

  it('draws nothing for systems absent from the value map', () => {
    const { factory } = makeFakeCanvasFactory()
    const layer = heatmapAreaLayer(new Map([[2, 5]]), { createOffscreenCanvas: factory })
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

    expect(factory).not.toHaveBeenCalled()
  })

  describe('style: gooey', () => {
    it('blurs and contrasts the shape mask canvas, drawing one circle per source', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 100]]), {
        style: 'gooey', createOffscreenCanvas: factory, radius: 10, blurPx: 5,
      })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      expect(canvases[0].ctx.filter).toBe('blur(5px) contrast(28)')
      expect(canvases[0].ctx.arc).toHaveBeenCalledWith(50, 50, 10, 0, Math.PI * 2)
    })

    it('draws one radial gradient per source, from its heat color to transparent', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 0], [2, 100]]), {
        style: 'gooey', createOffscreenCanvas: factory, radius: 10,
      })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0), sys(2, 10, 10)])

      const colorCtx = canvases[1].ctx
      expect(colorCtx.createRadialGradient).toHaveBeenCalledTimes(2)
      expect(colorCtx.createRadialGradient).toHaveBeenNthCalledWith(1, 50, 50, 0, 50, 50, 16)
      expect(colorCtx.gradient.addColorStop).toHaveBeenCalledWith(1, expect.stringMatching(/^rgba\(.+, 0\)$/))
    })

    it('composites gradients with "source-over" (not additive) then clips to the mask with "destination-in"', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 100]]), {
        style: 'gooey', createOffscreenCanvas: factory, radius: 10,
      })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      expect(canvases[1].ctx.compositeLog).toEqual(['source-over', 'destination-in'])
      expect(canvases[1].ctx.drawImage).toHaveBeenCalledWith(canvases[0], 0, 0)
    })

    it('draws the composited color canvas onto the main ctx at the origin', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 100]]), {
        style: 'gooey', createOffscreenCanvas: factory, radius: 10,
      })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      expect(ctx.drawImage).toHaveBeenCalledWith(canvases[1], 0, 0)
    })
  })

  describe('style: contour (default)', () => {
    it('defaults to contour when style is omitted', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 100]]), { createOffscreenCanvas: factory })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      expect(canvases[0].ctx.createImageData).toHaveBeenCalled()
    })

    it('sizes the field grid at viewport dimensions downsampled by the grid step (4px)', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 100]]), { style: 'contour', createOffscreenCanvas: factory })
      const ctx = makeMockCtx()
      const bigViewport = { offsetX: 0, offsetY: 0, scale: 1, width: 400, height: 200 }

      layer.draw(ctx as any, bigViewport, [sys(1, 0, 0)])

      expect(canvases[0].width).toBe(100)
      expect(canvases[0].height).toBe(50)
    })

    it('writes a non-zero alpha pixel near a heat source', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 100]]), { style: 'contour', createOffscreenCanvas: factory, radius: 40 })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      const img = canvases[0].ctx.putImageData.mock.calls[0][0]
      const gw = canvases[0].width
      // system (0,0) -> screen (50, 50) -> nearest grid cell
      const gx = Math.round(50 / 4)
      const gy = Math.round(50 / 4)
      const idx = (gy * gw + gx) * 4
      expect(img.data[idx + 3]).toBeGreaterThan(0)
    })

    it('writes zero alpha where no source reaches', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 100]]), { style: 'contour', createOffscreenCanvas: factory, radius: 5 })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      const img = canvases[0].ctx.putImageData.mock.calls[0][0]
      // Grid cell (0, 0) -> world (0, 0) screen-space, far from the source at (50, 50)
      expect(img.data[3]).toBe(0)
    })

    it('normalizes large real-world value magnitudes so falloff still occurs (regression test for un-normalized field saturation)', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 5_000_000_000]]), { style: 'contour', createOffscreenCanvas: factory, radius: 40 })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      const img = canvases[0].ctx.putImageData.mock.calls[0][0]
      const gw = canvases[0].width
      const nearGx = Math.round(50 / 4)
      const nearGy = Math.round(50 / 4)
      const nearIdx = (nearGy * gw + nearGx) * 4
      const farIdx = (0 * gw + 0) * 4 // grid cell (0,0) -> world (0,0), the far corner from the source at screen (50,50)

      expect(img.data[nearIdx + 3]).toBeGreaterThan(0)
      expect(img.data[farIdx + 3]).toBe(0)
    })

    it('upscales the field grid onto the main ctx at full viewport size', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 100]]), { style: 'contour', createOffscreenCanvas: factory })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      expect(ctx.drawImage).toHaveBeenCalledWith(canvases[0], 0, 0, 25, 25, 0, 0, 100, 100)
    })
  })
})
