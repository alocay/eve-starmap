export interface ColorScaleOptions {
  min?: number
  max?: number
  palette?: [string, string]
  opacityMin?: number
  opacityMax?: number
}

const DEFAULT_PALETTE: [string, string] = ['#1a1f27', '#ff5c33']

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Maps a value to its normalized [0, 1] position within [min, max], auto-detecting
// min/max from `values` when not given. Shared so color, opacity, and radius can
// all interpolate against the exact same range instead of computing it separately.
export function createValueScale(values: number[], options: { min?: number; max?: number } = {}): (value: number) => number {
  const min = options.min ?? (values.length > 0 ? Math.min(...values) : 0)
  const max = options.max ?? (values.length > 0 ? Math.max(...values) : 0)

  return function normalize(value: number): number {
    const range = max - min
    return range === 0 ? 0 : Math.min(1, Math.max(0, (value - min) / range))
  }
}

export function createColorScale(values: number[], options: ColorScaleOptions = {}): (value: number) => string {
  const normalize = createValueScale(values, options)
  const [fromHex, toHex] = options.palette ?? DEFAULT_PALETTE
  const from = hexToRgb(fromHex)
  const to = hexToRgb(toHex)
  const opacityMin = options.opacityMin ?? 1
  const opacityMax = options.opacityMax ?? 1
  const hasOpacityRange = opacityMin !== 1 || opacityMax !== 1

  return function colorFor(value: number): string {
    const t = normalize(value)
    const r = Math.round(lerp(from[0], to[0], t))
    const g = Math.round(lerp(from[1], to[1], t))
    const b = Math.round(lerp(from[2], to[2], t))
    if (!hasOpacityRange) return `rgb(${r}, ${g}, ${b})`
    const a = Math.round(lerp(opacityMin, opacityMax, t) * 1000) / 1000
    return `rgba(${r}, ${g}, ${b}, ${a})`
  }
}
