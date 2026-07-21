# Heatmap Area Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `heatmapAreaLayer`, a new `Layer` factory that renders heat sources as rounded, organically-merging blobs (screen-space clustering, zoom-dependent) instead of `heatmapLayer`'s flat per-system circles, with two selectable rendering styles (`'gooey'` and `'contour'`).

**Architecture:** Two new files in `packages/core/src/layers/`: a pure-math helper module (`heatmapAreaMath.ts`, no canvas/DOM dependency, fully unit-testable) and the layer itself (`heatmapAreaLayer.ts`, canvas orchestration for both styles). Offscreen canvas creation is injected via an optional `createOffscreenCanvas` option (defaulting to `OffscreenCanvas`/`document.createElement('canvas')`), the same pattern `routeLayer`'s spec used for `fetch` — this is what makes both styles unit-testable without a real browser canvas backend (this repo's jsdom test environment has no native `canvas` package installed, so `document.createElement('canvas').getContext('2d')` returns `null` here).

**Tech Stack:** TypeScript, Canvas 2D (`ctx.filter`, `createRadialGradient`, `ImageData`), Vitest (jsdom environment, already configured at the repo root).

## Global Constraints

- Reuse `createColorScale`/`ColorScaleOptions` from `../colorScale.js` — do not duplicate hex/color-interpolation logic (per the approved spec's "reuses `colorScale.ts`" principle).
- `radius` is screen-space pixels, not world units (per spec — this is what makes merging zoom-dependent for free via `viewport.scale`).
- This layer must never draw the system dot itself — only the background area wash (per spec).
- `heatmapLayer` (existing file) is not modified.
- New layer's `id` is `'heatmap-area'`.
- `bands` option is `'contour'`-only, clamped to the range 1-4 (per spec and user's explicit direction).
- `style: 'gooey'` ignores `bands` entirely — it uses a continuous per-source radial gradient, not discrete bands (per approved design revision).

---

### Task 1: Pure math helpers (`heatmapAreaMath.ts`)

**Files:**
- Create: `packages/core/src/layers/heatmapAreaMath.ts`
- Test: `packages/core/src/layers/heatmapAreaMath.test.ts`

**Interfaces:**
- Produces: `smoothstep(edge0: number, edge1: number, x: number): number`, `fieldContribution(dx: number, dy: number, value: number, radius: number): number`, `bandThresholds(bands: number): number[]`, `toTransparent(cssColor: string): string`, `parseRgb(cssColor: string): [number, number, number]` — all imported by `heatmapAreaLayer.ts` in Task 2.

- [ ] **Step 1: Write the failing tests for `smoothstep`**

```ts
import { describe, it, expect } from 'vitest'
import { smoothstep } from './heatmapAreaMath.js'

describe('smoothstep', () => {
  it('clamps to 0 below the lower edge', () => {
    expect(smoothstep(0, 1, -1)).toBe(0)
  })

  it('clamps to 1 above the upper edge', () => {
    expect(smoothstep(0, 1, 2)).toBe(1)
  })

  it('returns 0 exactly at the lower edge and 1 exactly at the upper edge', () => {
    expect(smoothstep(0, 1, 0)).toBe(0)
    expect(smoothstep(0, 1, 1)).toBe(1)
  })

  it('returns 0.5 at the midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBe(0.5)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/core/src/layers/heatmapAreaMath.test.ts`
Expected: FAIL — `heatmapAreaMath.js` has no exported member `smoothstep` (module doesn't exist yet).

- [ ] **Step 3: Implement `smoothstep`**

```ts
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/core/src/layers/heatmapAreaMath.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing tests for `fieldContribution`**

```ts
import { fieldContribution } from './heatmapAreaMath.js'

describe('fieldContribution', () => {
  it('is strongest at the source itself', () => {
    // r2 = 100, denom = 0 + 0 + 100*0.25 = 25 -> 1 * 100 / 25 = 4
    expect(fieldContribution(0, 0, 1, 10)).toBe(4)
  })

  it('falls off with distance', () => {
    // denom = 100 + 0 + 25 = 125 -> 100 / 125 = 0.8
    expect(fieldContribution(10, 0, 1, 10)).toBeCloseTo(0.8)
  })

  it('scales linearly with value', () => {
    expect(fieldContribution(0, 0, 2, 10)).toBe(8)
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run packages/core/src/layers/heatmapAreaMath.test.ts`
Expected: FAIL — no exported member `fieldContribution`.

- [ ] **Step 7: Implement `fieldContribution`**

```ts
export function fieldContribution(dx: number, dy: number, value: number, radius: number): number {
  const r2 = radius * radius
  return (value * r2) / (dx * dx + dy * dy + r2 * 0.25)
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run packages/core/src/layers/heatmapAreaMath.test.ts`
Expected: PASS (7 tests total)

- [ ] **Step 9: Write the failing tests for `bandThresholds`**

```ts
import { bandThresholds } from './heatmapAreaMath.js'

describe('bandThresholds', () => {
  it('returns one threshold per requested band, ascending from 1', () => {
    expect(bandThresholds(1)).toEqual([1])
    expect(bandThresholds(2)).toEqual([1, 2])
    expect(bandThresholds(4)).toEqual([1, 2, 3, 4])
  })

  it('clamps below 1 up to 1', () => {
    expect(bandThresholds(0)).toEqual([1])
    expect(bandThresholds(-5)).toEqual([1])
  })

  it('clamps above 4 down to 4', () => {
    expect(bandThresholds(10)).toEqual([1, 2, 3, 4])
  })

  it('rounds fractional band counts', () => {
    expect(bandThresholds(2.6)).toEqual([1, 2, 3])
  })
})
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `npx vitest run packages/core/src/layers/heatmapAreaMath.test.ts`
Expected: FAIL — no exported member `bandThresholds`.

- [ ] **Step 11: Implement `bandThresholds`**

```ts
export function bandThresholds(bands: number): number[] {
  const clamped = Math.max(1, Math.min(4, Math.round(bands)))
  return Array.from({ length: clamped }, (_, i) => i + 1)
}
```

- [ ] **Step 12: Run the test to verify it passes**

Run: `npx vitest run packages/core/src/layers/heatmapAreaMath.test.ts`
Expected: PASS (11 tests total)

- [ ] **Step 13: Write the failing tests for `toTransparent` and `parseRgb`**

```ts
import { toTransparent, parseRgb } from './heatmapAreaMath.js'

describe('toTransparent', () => {
  it('rewrites an opaque rgb() string to alpha 0', () => {
    expect(toTransparent('rgb(26, 31, 39)')).toBe('rgba(26, 31, 39, 0)')
  })

  it('drops any existing alpha from an rgba() string', () => {
    expect(toTransparent('rgba(255, 92, 51, 0.5)')).toBe('rgba(255, 92, 51, 0)')
  })
})

describe('parseRgb', () => {
  it('extracts the r, g, b components from an rgb() string', () => {
    expect(parseRgb('rgb(255, 92, 51)')).toEqual([255, 92, 51])
  })

  it('extracts the r, g, b components from an rgba() string, ignoring alpha', () => {
    expect(parseRgb('rgba(26, 31, 39, 0.5)')).toEqual([26, 31, 39])
  })
})
```

- [ ] **Step 14: Run the test to verify it fails**

Run: `npx vitest run packages/core/src/layers/heatmapAreaMath.test.ts`
Expected: FAIL — no exported members `toTransparent`, `parseRgb`.

- [ ] **Step 15: Implement `toTransparent` and `parseRgb`**

```ts
export function toTransparent(cssColor: string): string {
  const nums = cssColor.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']
  const [r, g, b] = nums
  return `rgba(${r}, ${g}, ${b}, 0)`
}

export function parseRgb(cssColor: string): [number, number, number] {
  const nums = cssColor.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']
  return [Number(nums[0]), Number(nums[1]), Number(nums[2])]
}
```

- [ ] **Step 16: Run the full test file to verify everything passes**

Run: `npx vitest run packages/core/src/layers/heatmapAreaMath.test.ts`
Expected: PASS (15 tests total)

- [ ] **Step 17: Commit**

```bash
git add packages/core/src/layers/heatmapAreaMath.ts packages/core/src/layers/heatmapAreaMath.test.ts
git commit -m "feat: add pure math helpers for heatmapAreaLayer"
```

---

### Task 2: `heatmapAreaLayer` (both styles)

**Files:**
- Create: `packages/core/src/layers/heatmapAreaLayer.ts`
- Test: `packages/core/src/layers/heatmapAreaLayer.test.ts`

**Interfaces:**
- Consumes: `createColorScale`, `ColorScaleOptions` from `../colorScale.js`; `worldToScreen` from `../viewport.js`; `Layer`, `SystemNode`, `Viewport` from `../types.js`; `smoothstep`, `fieldContribution`, `bandThresholds`, `toTransparent`, `parseRgb` from `./heatmapAreaMath.js` (Task 1).
- Produces: `heatmapAreaLayer(values: Map<number, number>, options?: HeatmapAreaLayerOptions): Layer`, and types `HeatmapAreaLayerOptions`, `OffscreenCanvasLike`, `OffscreenCtx2DLike` — consumed by Task 3's `index.ts` export and by the playground.

- [ ] **Step 1: Write the failing skeleton tests**

```ts
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
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run packages/core/src/layers/heatmapAreaLayer.test.ts`
Expected: FAIL — module `./heatmapAreaLayer.js` does not exist.

- [ ] **Step 3: Implement the skeleton (types, options parsing, point-gathering, empty short-circuit)**

```ts
import type { Layer, SystemNode, Viewport } from '../types.js'
import { createColorScale, type ColorScaleOptions } from '../colorScale.js'
import { worldToScreen } from '../viewport.js'
import { bandThresholds, fieldContribution, parseRgb, smoothstep, toTransparent } from './heatmapAreaMath.js'

export interface OffscreenCtx2DLike {
  fillStyle: string | CanvasGradient
  filter: string
  globalCompositeOperation: string
  beginPath(): void
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void
  fill(): void
  fillRect(x: number, y: number, w: number, h: number): void
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient
  createImageData(w: number, h: number): ImageData
  putImageData(imageData: ImageData, dx: number, dy: number): void
  drawImage(image: OffscreenCanvasLike, dx: number, dy: number): void
}

export interface OffscreenCanvasLike {
  width: number
  height: number
  getContext(contextId: '2d'): OffscreenCtx2DLike | null
}

export interface HeatmapAreaLayerOptions extends ColorScaleOptions {
  // 'contour' (default): field-based nested intensity bands. 'gooey': blurred
  // merging blobs with a continuous per-source gradient, no bands.
  style?: 'gooey' | 'contour'
  // Screen-space px, per-source influence radius. Default 40.
  radius?: number
  // 'contour'-only, clamped 1-4. Default 2. Ignored for 'gooey'.
  bands?: number
  // 'gooey'-only. Default radius * 0.3.
  blurPx?: number
  // Injectable for tests / non-browser environments. Defaults to
  // OffscreenCanvas when available, else document.createElement('canvas').
  createOffscreenCanvas?: (width: number, height: number) => OffscreenCanvasLike
}

const GRID_STEP = 4
const GOOEY_GRADIENT_REACH = 1.6
const GOOEY_CONTRAST = 28

function defaultCreateOffscreenCanvas(width: number, height: number): OffscreenCanvasLike {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height) as unknown as OffscreenCanvasLike
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas as unknown as OffscreenCanvasLike
}

interface Point {
  x: number
  y: number
  value: number
}

export function heatmapAreaLayer(values: Map<number, number>, options: HeatmapAreaLayerOptions = {}): Layer {
  const rawValues = [...values.values()]
  const colorFor = createColorScale(rawValues, options)
  const bandCount = Math.max(1, Math.min(4, Math.round(options.bands ?? 2)))
  const bandColorFor = createColorScale([], { palette: options.palette, min: 0, max: 1 })
  const style = options.style ?? 'contour'
  const radius = options.radius ?? 40
  const blurPx = options.blurPx ?? radius * 0.3
  const baseValue = options.min ?? (rawValues.length > 0 ? Math.min(...rawValues) : 0)
  const baseColor = colorFor(baseValue)
  const createOffscreenCanvas = options.createOffscreenCanvas ?? defaultCreateOffscreenCanvas

  return {
    id: 'heatmap-area',
    focusSystemIds: [...values.keys()],
    draw(ctx: CanvasRenderingContext2D, viewport: Viewport, systems: SystemNode[]): void {
      const points: Point[] = []
      for (const system of systems) {
        const value = values.get(system.id)
        if (value === undefined) continue
        const { x, y } = worldToScreen(viewport, system.x, system.y)
        points.push({ x, y, value })
      }
      if (points.length === 0) return

      if (style === 'gooey') {
        drawGooey(ctx, viewport, points, radius, blurPx, colorFor, baseColor, createOffscreenCanvas)
      } else {
        drawContour(ctx, viewport, points, radius, bandCount, bandColorFor, createOffscreenCanvas)
      }
    },
  }
}

function drawGooey(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  points: Point[],
  radius: number,
  blurPx: number,
  colorFor: (value: number) => string,
  baseColor: string,
  createOffscreenCanvas: (width: number, height: number) => OffscreenCanvasLike,
): void {
  // implemented in Step 7
}

function drawContour(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  points: Point[],
  radius: number,
  bandCount: number,
  bandColorFor: (t: number) => string,
  createOffscreenCanvas: (width: number, height: number) => OffscreenCanvasLike,
): void {
  // implemented in Step 11
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run packages/core/src/layers/heatmapAreaLayer.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing tests for `style: 'gooey'`**

Add to the test file, inside the top-level `describe('heatmapAreaLayer', ...)`:

```ts
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

    it('composites gradients with "lighter" then clips to the mask with "destination-in"', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 100]]), {
        style: 'gooey', createOffscreenCanvas: factory, radius: 10,
      })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      expect(canvases[1].ctx.compositeLog).toEqual(['lighter', 'destination-in'])
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
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run packages/core/src/layers/heatmapAreaLayer.test.ts`
Expected: FAIL — `drawGooey` is a no-op stub, so `canvases` stays empty and every assertion on `canvases[0]`/`canvases[1]` throws.

- [ ] **Step 7: Implement `drawGooey`**

Replace the `drawGooey` stub body from Step 3 with:

```ts
function drawGooey(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  points: Point[],
  radius: number,
  blurPx: number,
  colorFor: (value: number) => string,
  baseColor: string,
  createOffscreenCanvas: (width: number, height: number) => OffscreenCanvasLike,
): void {
  const w = viewport.width
  const h = viewport.height

  const mask = createOffscreenCanvas(w, h)
  const maskCtx = mask.getContext('2d')
  if (!maskCtx) return
  maskCtx.filter = `blur(${blurPx}px) contrast(${GOOEY_CONTRAST})`
  maskCtx.fillStyle = 'rgb(255, 255, 255)'
  for (const p of points) {
    maskCtx.beginPath()
    maskCtx.arc(p.x, p.y, radius, 0, Math.PI * 2)
    maskCtx.fill()
  }

  const color = createOffscreenCanvas(w, h)
  const colorCtx = color.getContext('2d')
  if (!colorCtx) return
  colorCtx.globalCompositeOperation = 'lighter'
  const transparentBase = toTransparent(baseColor)
  for (const p of points) {
    const reach = radius * GOOEY_GRADIENT_REACH
    const grad = colorCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, reach)
    grad.addColorStop(0, colorFor(p.value))
    grad.addColorStop(1, transparentBase)
    colorCtx.fillStyle = grad
    colorCtx.fillRect(p.x - reach, p.y - reach, reach * 2, reach * 2)
  }
  colorCtx.globalCompositeOperation = 'destination-in'
  colorCtx.drawImage(mask, 0, 0)

  ctx.drawImage(color as unknown as CanvasImageSource, 0, 0)
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run packages/core/src/layers/heatmapAreaLayer.test.ts`
Expected: PASS (8 tests total)

- [ ] **Step 9: Write the failing tests for `style: 'contour'`**

Add to the test file:

```ts
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

    it('upscales the field grid onto the main ctx at full viewport size', () => {
      const { factory, canvases } = makeFakeCanvasFactory()
      const layer = heatmapAreaLayer(new Map([[1, 100]]), { style: 'contour', createOffscreenCanvas: factory })
      const ctx = makeMockCtx()

      layer.draw(ctx as any, viewport, [sys(1, 0, 0)])

      expect(ctx.drawImage).toHaveBeenCalledWith(canvases[0], 0, 0, 25, 25, 0, 0, 100, 100)
    })
  })
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `npx vitest run packages/core/src/layers/heatmapAreaLayer.test.ts`
Expected: FAIL — `drawContour` is a no-op stub, so `canvases` stays empty and every assertion on `canvases[0]` throws.

- [ ] **Step 11: Implement `drawContour`**

Replace the `drawContour` stub body from Step 3 with:

```ts
function drawContour(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  points: Point[],
  radius: number,
  bandCount: number,
  bandColorFor: (t: number) => string,
  createOffscreenCanvas: (width: number, height: number) => OffscreenCanvasLike,
): void {
  const gw = Math.ceil(viewport.width / GRID_STEP)
  const gh = Math.ceil(viewport.height / GRID_STEP)
  const grid = createOffscreenCanvas(gw, gh)
  const gridCtx = grid.getContext('2d')
  if (!gridCtx) return

  const thresholds = bandThresholds(bandCount)
  const bandRgb = thresholds.map((_, i) => parseRgb(bandColorFor((i + 1) / bandCount)))
  const img = gridCtx.createImageData(gw, gh)
  const data = img.data

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const x = gx * GRID_STEP
      const y = gy * GRID_STEP
      let field = 0
      for (const p of points) {
        field += fieldContribution(x - p.x, y - p.y, p.value, radius)
      }
      let r = 0, g = 0, b = 0, a = 0
      for (let i = 0; i < thresholds.length; i++) {
        const t = thresholds[i]
        const bandAlpha = smoothstep(t - 0.15, t + 0.15, field) * (0.3 + 0.15 * i)
        if (bandAlpha > a) {
          a = bandAlpha
          ;[r, g, b] = bandRgb[i]
        }
      }
      const idx = (gy * gw + gx) * 4
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = Math.round(Math.min(1, a) * 255)
    }
  }
  gridCtx.putImageData(img, 0, 0)
  ctx.drawImage(grid as unknown as CanvasImageSource, 0, 0, gw, gh, 0, 0, viewport.width, viewport.height)
}
```

- [ ] **Step 12: Run the test to verify it passes**

Run: `npx vitest run packages/core/src/layers/heatmapAreaLayer.test.ts`
Expected: PASS (13 tests total)

- [ ] **Step 13: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit -p packages/core`
Expected: all tests pass (repo-wide); no type errors.

- [ ] **Step 14: Commit**

```bash
git add packages/core/src/layers/heatmapAreaLayer.ts packages/core/src/layers/heatmapAreaLayer.test.ts
git commit -m "feat: add heatmapAreaLayer with gooey and contour styles"
```

---

### Task 3: Exports, docs, and playground toggle

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/README.md`
- Modify: `README.md`
- Modify: `playground/index.html`
- Modify: `playground/main.js`

**Interfaces:**
- Consumes: `heatmapAreaLayer`, `HeatmapAreaLayerOptions` from `./layers/heatmapAreaLayer.js` (Task 2).

- [ ] **Step 1: Export the new layer from `packages/core/src/index.ts`**

Add these two lines after the existing `heatmapLayer` exports (`packages/core/src/index.ts:3-4`):

```ts
export { heatmapAreaLayer } from './layers/heatmapAreaLayer.js'
export type { HeatmapAreaLayerOptions, OffscreenCanvasLike, OffscreenCtx2DLike } from './layers/heatmapAreaLayer.js'
```

- [ ] **Step 2: Verify the export builds and typechecks**

Run: `npm run build --workspace packages/core`
Expected: builds with no errors; `packages/core/dist/index.js` and `.d.ts` include `heatmapAreaLayer`.

- [ ] **Step 3: Document `heatmapAreaLayer` in `packages/core/README.md`**

Add this section immediately after the existing `heatmapLayer` options block (after the code block ending at `packages/core/README.md:106`, before the `**Region labels**` paragraph):

```markdown
**Heatmap area** (bundled): an alternative to `heatmapLayer` -- instead of one flat circle per system, draws rounded, organically-merging area shapes around clustered heat sources. Because the merge radius is in screen pixels, blobs fuse together when zoomed out and separate into individual systems as you zoom in, with no extra logic needed:

\`\`\`js
import { StarmapRenderer, heatmapAreaLayer, defaultUniverseData } from 'eve-starmap'

const renderer = new StarmapRenderer(canvas, defaultUniverseData, {
  layers: [heatmapAreaLayer(new Map([[30000142, 1_500_000_000]]), { style: 'contour' })],
})
renderer.draw()
\`\`\`

`heatmapAreaLayer` options (also accepts `heatmapLayer`'s `palette`/`min`/`max`/`opacityMin`/`opacityMax`):

- `style: 'gooey' | 'contour'` -- default `'contour'`. `'contour'` draws nested intensity bands (an outer wash plus a hotter inner core); `'gooey'` draws a smoothly blurred blob with a continuous per-source color gradient instead of bands.
- `radius` -- screen-space px, per-source influence. Default `40`. This is what drives merging: two sources within roughly `2 * radius` screen pixels of each other fuse into one blob.
- `bands` -- `'contour'`-only, clamped to 1-4. Default `2`. Ignored for `'gooey'`.
- `blurPx` -- `'gooey'`-only. Default `radius * 0.3`.
```

(Use literal backticks, not the escaped `\`\`\`` shown above -- that escaping is only to keep this plan's own Markdown from breaking.)

- [ ] **Step 4: Update the bundled-layers sentence in the root `README.md`**

In `README.md:42`, change:

```markdown
Two layers are bundled today: `heatmapLayer` (per-system value visualization) and `regionLabelLayer` (draws each region's name at the centroid of its member systems). Writing your own is just implementing the interface above -- see `packages/core/README.md#examples` for a full custom-layer example (a hover highlight ring) and the bundled layers' own examples.
```

to:

```markdown
Three layers are bundled today: `heatmapLayer` (per-system value visualization), `heatmapAreaLayer` (rounded, zoom-dependent merging area shapes for the same kind of data), and `regionLabelLayer` (draws each region's name at the centroid of its member systems). Writing your own is just implementing the interface above -- see `packages/core/README.md#examples` for a full custom-layer example (a hover highlight ring) and the bundled layers' own examples.
```

- [ ] **Step 5: Add a playground toggle button**

In `playground/index.html`, after the existing heatmap toggle button (`playground/index.html:111`):

```html
      <button id="toggle-heatmap-area">Toggle heatmap-area layer (off)</button>
```

- [ ] **Step 6: Wire the toggle in `playground/main.js`**

In `playground/main.js:1`, add `heatmapAreaLayer` to the import:

```js
import { StarmapRenderer, heatmapLayer, heatmapAreaLayer, regionLabelLayer, defaultUniverseData } from '../packages/core/dist/index.js'
```

After `const toggleRegionsBtn = ...` (`playground/main.js:7`), add:

```js
const toggleHeatmapAreaBtn = document.getElementById('toggle-heatmap-area')
```

After `const demoHeatmapLayer = ...` (`playground/main.js:43`), add:

```js
const demoHeatmapAreaValues = buildDemoHeatmap(defaultUniverseData.systems, 200)
```

Replace `let heatmapOn = false` (`playground/main.js:45`) with:

```js
let heatmapOn = false
// 'off' | 'gooey' | 'contour' -- cycles on each click of the heatmap-area toggle.
let heatmapAreaMode = 'off'
```

Replace the body of `updateLayers` (`playground/main.js:69-74`) with:

```js
function updateLayers() {
  const layers = [highlightLayer]
  if (regionsOn) layers.push(demoRegionLabelLayer)
  if (heatmapOn) layers.push(demoHeatmapLayer)
  if (heatmapAreaMode !== 'off') layers.push(heatmapAreaLayer(demoHeatmapAreaValues, { style: heatmapAreaMode }))
  renderer.setLayers(layers)
}
```

After the existing `toggleRegionsBtn.addEventListener(...)` block (`playground/main.js:134-138`), add:

```js
toggleHeatmapAreaBtn.addEventListener('click', () => {
  heatmapAreaMode = heatmapAreaMode === 'off' ? 'gooey' : heatmapAreaMode === 'gooey' ? 'contour' : 'off'
  updateLayers()
  toggleHeatmapAreaBtn.textContent = `Toggle heatmap-area layer (${heatmapAreaMode})`
})
```

- [ ] **Step 7: Manually verify in the browser**

Run: `npm run build --workspace packages/core && npx serve .` (from repo root), then open `/playground/index.html`.
Expected: clicking "Toggle heatmap-area layer" cycles off -> gooey -> contour -> off; `gooey` shows smoothly blurred, per-source gradient blobs; `contour` shows nested intensity bands; both merge into single blobs over dense clusters and separate into individual blobs when zoomed into sparser areas.

- [ ] **Step 8: Run the full test suite one last time**

Run: `npm test`
Expected: all tests pass, including the new `heatmapAreaMath.test.ts` and `heatmapAreaLayer.test.ts`.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/index.ts packages/core/README.md README.md playground/index.html playground/main.js
git commit -m "feat: export heatmapAreaLayer, document it, and wire up a playground toggle"
```
