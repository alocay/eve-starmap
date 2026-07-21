import type { Layer, SystemNode, Viewport } from '../types.js'
import { createColorScale, createValueScale, type ColorScaleOptions } from '../colorScale.js'
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
  // Default opacityMin to 0 (unless the caller set their own) so a gooey
  // source's own gradient center fades toward invisible for low relative
  // heat, instead of always being a fully-opaque, dark-palette-colored blob
  // that reads as "solid grey/black" against a dark map background.
  const colorFor = createColorScale(rawValues, { ...options, opacityMin: options.opacityMin ?? 0 })
  const bandColorFor = createColorScale([], { palette: options.palette, min: 0, max: 1, opacityMin: options.opacityMin, opacityMax: options.opacityMax })
  const fieldScale = createValueScale(rawValues, { min: options.min ?? 0, max: options.max })
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
        drawContour(ctx, viewport, points, radius, options.bands ?? 2, bandColorFor, fieldScale, createOffscreenCanvas)
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
  // 'source-over' (bounded alpha blending), not 'lighter' (additive): with many
  // sources close together on screen (e.g. zoomed far out), additive blending
  // sums every overlapping gradient's RGB and saturates to white well before
  // any single source reaches full color.
  colorCtx.globalCompositeOperation = 'source-over'
  const transparentBase = toTransparent(baseColor)
  const reach = radius * GOOEY_GRADIENT_REACH
  for (const p of points) {
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

function drawContour(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  points: Point[],
  radius: number,
  bandsRequested: number,
  bandColorFor: (t: number) => string,
  fieldScale: (value: number) => number,
  createOffscreenCanvas: (width: number, height: number) => OffscreenCanvasLike,
): void {
  const gw = Math.ceil(viewport.width / GRID_STEP)
  const gh = Math.ceil(viewport.height / GRID_STEP)
  const grid = createOffscreenCanvas(gw, gh)
  const gridCtx = grid.getContext('2d')
  if (!gridCtx) return

  const thresholds = bandThresholds(bandsRequested)
  const bandRgb = thresholds.map((_, i) => parseRgb(bandColorFor((i + 1) / thresholds.length)))
  const img = gridCtx.createImageData(gw, gh)
  const data = img.data

  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const x = gx * GRID_STEP
      const y = gy * GRID_STEP
      let field = 0
      for (const p of points) {
        field += fieldContribution(x - p.x, y - p.y, fieldScale(p.value), radius)
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
