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
