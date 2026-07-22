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

  it('does not throw when using the default (uninjected) canvas factory', () => {
    // This exercises defaultCreateOffscreenCanvas for real -- no createOffscreenCanvas
    // override -- so it also covers the null-context guards (this repo's jsdom test
    // environment has no native `canvas` package, so getContext('2d') logs jsdom's
    // "not implemented" warning and returns undefined here; a real browser would
    // actually render instead of hitting that guard). Silencing console.error for
    // just this call since that jsdom warning is expected, not a real problem.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const layer = heatmapAreaLayer(new Map([[1, 100]]), { style: 'gooey' })
      const ctx = makeMockCtx()

      expect(() => layer.draw(ctx as any, viewport, [sys(1, 0, 0)])).not.toThrow()
    } finally {
      consoleError.mockRestore()
    }
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

    it('uses default radius (40) and blurPx (radius * 0.3) when not specified', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 100]]), { style: 'gooey', createOffscreenCanvas: factory })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      expect(canvases[0].ctx.arc).toHaveBeenCalledWith(50, 50, 40, 0, Math.PI * 2)
      expect(canvases[0].ctx.filter).toBe('blur(12px) contrast(28)')
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

    it('fades a low-value source\'s own gradient center toward transparent, not a solid opaque blob', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 0], [2, 100]]), {
        style: 'gooey', createOffscreenCanvas: factory, radius: 10,
      })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0), sys(2, 10, 10)])

      const colorCtx = canvases[1].ctx
      const centerStopCalls = colorCtx.gradient.addColorStop.mock.calls.filter((call: any[]) => call[0] === 0)
      const coldCenter = centerStopCalls[0][1] as string
      const hotCenter = centerStopCalls[1][1] as string
      const alphaOf = (rgba: string) => Number(rgba.match(/[\d.]+(?=\)$)/)![0])

      expect(alphaOf(coldCenter)).toBeLessThan(alphaOf(hotCenter))
      expect(alphaOf(coldCenter)).toBeCloseTo(0)
      expect(alphaOf(hotCenter)).toBeCloseTo(1)
    })

    it('respects a caller-provided opacityMin instead of the default-0 fade', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 0], [2, 100]]), {
        style: 'gooey', createOffscreenCanvas: factory, radius: 10, opacityMin: 0.5,
      })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0), sys(2, 10, 10)])

      const colorCtx = canvases[1].ctx
      const centerStopCalls = colorCtx.gradient.addColorStop.mock.calls.filter((call: any[]) => call[0] === 0)
      const coldCenter = centerStopCalls[0][1] as string
      const alphaOf = (rgba: string) => Number(rgba.match(/[\d.]+(?=\)$)/)![0])

      expect(alphaOf(coldCenter)).toBeCloseTo(0.5)
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

    it('renders a heavily skewed low value, not just the ones near the dataset max (regression test for sov-losses missing-systems bug)', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      // A viewport wide enough to place two sources 300 screen-px apart, far
      // enough that neither's own field contribution meaningfully bleeds into
      // the other's cell -- isolates each source's own visibility.
      const wideViewport = { offsetX: 150, offsetY: 0, scale: 1, width: 400, height: 100 }
      // 1 vs 100,000 -- a 100,000x skew, similar in spirit to a capital ship
      // loss dwarfing an everyday frigate loss in the same ISK dataset.
      const layer = heatmapAreaLayer(new Map([[1, 1], [2, 100_000]]), {
        style: 'contour', createOffscreenCanvas: factory, radius: 40,
      })
      const ctx = makeMockCtx()

      // world (0,0) -> screen (50, 50); world (300,0) -> screen (350, 50)
      layer.draw(ctx as any, wideViewport, [sys(1, 0, 0), sys(2, 300, 0)])

      const img = canvases[0].ctx.putImageData.mock.calls[0][0]
      const gw = canvases[0].width
      const lowValueIdx = (Math.round(50 / 4) * gw + Math.round(50 / 4)) * 4
      const highValueIdx = (Math.round(50 / 4) * gw + Math.round(350 / 4)) * 4

      expect(img.data[lowValueIdx + 3]).toBeGreaterThan(0)
      expect(img.data[highValueIdx + 3]).toBeGreaterThan(0)
    })

    it('upscales the field grid onto the main ctx at full viewport size', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 100]]), { style: 'contour', createOffscreenCanvas: factory })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      expect(ctx.drawImage).toHaveBeenCalledWith(canvases[0], 0, 0, 25, 25, 0, 0, 100, 100)
    })

    function alphaNearSource(options: Record<string, unknown>) {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 5_000_000_000]]), {
        style: 'contour', createOffscreenCanvas: factory, radius: 40, ...options,
      })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      const img = canvases[0].ctx.putImageData.mock.calls[0][0]
      const gw = canvases[0].width
      const gx = Math.round(50 / 4)
      const gy = Math.round(50 / 4)
      return img.data[(gy * gw + gx) * 4 + 3]
    }

    it('scales band alpha ceilings by opacityMin/opacityMax', () => {
      const defaultAlpha = alphaNearSource({})
      const dimmedAlpha = alphaNearSource({ opacityMax: 0.1 })

      expect(dimmedAlpha).toBeLessThan(defaultAlpha)
    })

    it('clamps bands below 1 up to 1 and above 4 down to 4', () => {
      expect(alphaNearSource({ bands: 0 })).toBe(alphaNearSource({ bands: 1 }))
      expect(alphaNearSource({ bands: 10 })).toBe(alphaNearSource({ bands: 4 }))
    })
  })
})
