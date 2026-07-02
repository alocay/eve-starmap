export interface ColorScaleOptions {
  min?: number
  max?: number
  palette?: [string, string]
}

const DEFAULT_PALETTE: [string, string] = ['#1a1f27', '#ff5c33']

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function createColorScale(values: number[], options: ColorScaleOptions = {}): (value: number) => string {
  const min = options.min ?? Math.min(...values)
  const max = options.max ?? Math.max(...values)
  const [fromHex, toHex] = options.palette ?? DEFAULT_PALETTE
  const from = hexToRgb(fromHex)
  const to = hexToRgb(toHex)

  return function colorFor(value: number): string {
    const range = max - min
    const t = range === 0 ? 0 : Math.min(1, Math.max(0, (value - min) / range))
    const r = Math.round(lerp(from[0], to[0], t))
    const g = Math.round(lerp(from[1], to[1], t))
    const b = Math.round(lerp(from[2], to[2], t))
    return `rgb(${r}, ${g}, ${b})`
  }
}
