import type { UniverseData } from './types.js'

export function validateUniverseData(data: unknown): UniverseData {
  if (data == null || typeof data !== 'object') {
    throw new Error('Invalid universe data: expected an object')
  }
  const d = data as Record<string, unknown>

  if (!Array.isArray(d.systems)) {
    throw new Error('Invalid universe data: "systems" must be an array')
  }
  if (!Array.isArray(d.stargates)) {
    throw new Error('Invalid universe data: "stargates" must be an array')
  }

  for (const sys of d.systems) {
    if (typeof sys !== 'object' || sys === null) {
      throw new Error('Invalid universe data: each system must be an object')
    }
    const s = sys as Record<string, unknown>
    const valid =
      typeof s.id === 'number' &&
      typeof s.name === 'string' &&
      typeof s.constellationId === 'number' &&
      typeof s.regionId === 'number' &&
      Number.isFinite(s.x) &&
      Number.isFinite(s.y)
    if (!valid) {
      throw new Error(`Invalid universe data: system is missing required fields: ${JSON.stringify(sys)}`)
    }
  }

  const systemIds = new Set(d.systems.map((s: any) => s.id))
  for (const gate of d.stargates) {
    if (typeof gate !== 'object' || gate === null) {
      throw new Error('Invalid universe data: each stargate must be an object')
    }
    const g = gate as Record<string, unknown>
    if (typeof g.fromSystemId !== 'number' || typeof g.toSystemId !== 'number') {
      throw new Error(`Invalid universe data: stargate is missing required fields: ${JSON.stringify(gate)}`)
    }
    if (!systemIds.has(g.fromSystemId) || !systemIds.has(g.toSystemId)) {
      throw new Error('Invalid universe data: stargate references unknown system id')
    }
  }

  return data as UniverseData
}
