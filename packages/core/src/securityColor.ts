export type SecurityColors = Record<string, string> | Map<number, string>

// EVE's per-tier security colors (1.0 down to 0.0). Anything at or below 0.0
// resolves to the 0.0 color via the lookup's negative-clamp, so all low/null-sec
// legs share one color. Consumers can override with their own palette or a
// per-node color function on routeLayer.
export const defaultSecurityColors: Record<string, string> = {
  '1.0': '#2c74e0',
  '0.9': '#3999e9',
  '0.8': '#4dccf6',
  '0.7': '#60d9a3',
  '0.6': '#71e554',
  '0.5': '#f3fd82',
  '0.4': '#da6c07',
  '0.3': '#cc440f',
  '0.2': '#ba1117',
  '0.1': '#722020',
  '0.0': '#8c3263',
}

// Round a raw security status to its nearest 0.1 display tier (EVE UI convention).
export function round1(sec: number): number {
  return Math.round(sec * 10) / 10
}

function toEntries(colors: SecurityColors): Array<[number, string]> {
  const src = colors instanceof Map ? [...colors.entries()] : Object.entries(colors)
  return src.map(([k, v]) => [typeof k === 'number' ? k : parseFloat(k), v])
}

// Build a lookup: raw security -> tier color. Rounds to tier, clamps out-of-range
// values to the nearest provided tier, and returns `fallback` when security is
// null/undefined or the (in-range) tier has no color.
export function createSecurityColorLookup(
  colors: SecurityColors,
  fallback: string,
): (security: number | null | undefined) => string {
  const entries = toEntries(colors)
  const byTier = new Map(entries.map(([k, v]) => [k, v]))
  const tiers = entries.map(([k]) => k)
  const minTier = Math.min(...tiers)
  const maxTier = Math.max(...tiers)

  return function colorFor(security: number | null | undefined): string {
    if (security == null) return fallback
    const tier = round1(security)
    if (tier < minTier) return byTier.get(minTier) ?? fallback
    if (tier > maxTier) return byTier.get(maxTier) ?? fallback
    return byTier.get(tier) ?? fallback
  }
}
