export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export function fieldContribution(dx: number, dy: number, value: number, radius: number): number {
  const r2 = radius * radius
  return (value * r2) / (dx * dx + dy * dy + r2 * 0.25)
}

export function bandThresholds(bands: number): number[] {
  const clamped = Math.max(1, Math.min(4, Math.round(bands)))
  return Array.from({ length: clamped }, (_, i) => i + 1)
}

export function toTransparent(cssColor: string): string {
  const nums = cssColor.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']
  const [r, g, b] = nums
  return `rgba(${r}, ${g}, ${b}, 0)`
}

export function parseRgb(cssColor: string): [number, number, number] {
  const nums = cssColor.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']
  return [Number(nums[0]), Number(nums[1]), Number(nums[2])]
}

// Contour's per-band thresholds are fixed integers (1, 2, 3, 4 -- see
// bandThresholds), and fieldContribution's own formula puts a source's field at
// its exact center at `value * 4` (r^2 / (r^2 * 0.25) = 4). Band 1's threshold,
// with smoothstep's soft edge, needs field >= 0.85 to register any alpha at all
// -- so a normalized value needs to be >= ~0.2125 just to show up, even
// standing alone with no other sources nearby. FIELD_FLOOR (0.25, comfortably
// above that) is the normalized value guaranteed for the *smallest* value in a
// dataset, so every present value clears the visibility threshold regardless
// of how it compares to the dataset's max -- not just the single largest one.
const FIELD_FLOOR = 0.25

// Normalizes a raw value against the observed [min, max] range (auto-detected
// from `values` unless overridden), mapped onto [FIELD_FLOOR, 1] instead of
// [0, 1]. This is the fix for a real bug: naively normalizing against [0, max]
// (as heatmapLayer's color scale does) makes a value's visibility depend on
// how it compares to the single largest value in the dataset -- fine for
// roughly-uniform data, but real-world skewed data (e.g. ISK loss values,
// where one capital loss can dwarf everyday losses 100-1000x) can push
// legitimately-present, non-trivial values below the rendering threshold
// entirely, so they silently vanish from a contour render even though they're
// real data points. Mapping onto [FIELD_FLOOR, 1] instead guarantees every
// value in `values` produces at least some visible mark, with hotter values
// still showing proportionally more.
export function createFieldScale(values: number[], options: { min?: number; max?: number } = {}): (value: number) => number {
  const min = options.min ?? (values.length > 0 ? Math.min(...values) : 0)
  const max = options.max ?? (values.length > 0 ? Math.max(...values) : 0)
  const range = max - min

  return function normalize(value: number): number {
    if (range === 0) return 1
    const t = Math.min(1, Math.max(0, (value - min) / range))
    return FIELD_FLOOR + (1 - FIELD_FLOOR) * t
  }
}
