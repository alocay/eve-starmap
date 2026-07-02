import type { UniverseData } from './types.js'

// Pochven: 27 systems severed from the stargate network and moved into
// Triglavian-controlled space during the 2020 Invasion storyline. Consumers
// commonly want to exclude it (e.g. it's disconnected from the rest of New
// Eden and renders as an isolated cluster).
export const POCHVEN_REGION_ID = 10000070

export function excludeRegions(data: UniverseData, regionIds: number[]): UniverseData {
  if (regionIds.length === 0) return data

  const excluded = new Set(regionIds)
  const systems = data.systems.filter(s => !excluded.has(s.regionId))
  const remainingIds = new Set(systems.map(s => s.id))
  const stargates = data.stargates.filter(
    g => remainingIds.has(g.fromSystemId) && remainingIds.has(g.toSystemId)
  )

  return { systems, stargates }
}
