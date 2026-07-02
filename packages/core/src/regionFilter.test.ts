import { describe, it, expect } from 'vitest'
import { excludeRegions, POCHVEN_REGION_ID } from './regionFilter.js'

function sys(id: number, regionId: number) {
  return { id, name: `S${id}`, constellationId: 1, regionId, x: id, y: 0 }
}

describe('excludeRegions', () => {
  it('removes systems in the given region ids', () => {
    const data = {
      systems: [sys(1, 10), sys(2, 20), sys(3, 10)],
      stargates: [],
    }
    const result = excludeRegions(data, [10])
    expect(result.systems.map(s => s.id)).toEqual([2])
  })

  it('drops stargates that reference an excluded system on either end', () => {
    const data = {
      systems: [sys(1, 10), sys(2, 20), sys(3, 20)],
      stargates: [
        { fromSystemId: 1, toSystemId: 2 },
        { fromSystemId: 2, toSystemId: 3 },
      ],
    }
    const result = excludeRegions(data, [10])
    expect(result.stargates).toEqual([{ fromSystemId: 2, toSystemId: 3 }])
  })

  it('returns the data unchanged when no region ids are excluded', () => {
    const data = {
      systems: [sys(1, 10), sys(2, 20)],
      stargates: [{ fromSystemId: 1, toSystemId: 2 }],
    }
    expect(excludeRegions(data, [])).toEqual(data)
  })

  it('returns a result that still passes validateUniverseData (no dangling stargate refs)', async () => {
    const { validateUniverseData } = await import('./dataValidation.js')
    const data = {
      systems: [sys(1, 10), sys(2, 20), sys(3, 20)],
      stargates: [
        { fromSystemId: 1, toSystemId: 2 },
        { fromSystemId: 2, toSystemId: 3 },
      ],
    }
    const result = excludeRegions(data, [10])
    expect(() => validateUniverseData(result)).not.toThrow()
  })

  it('exposes POCHVEN_REGION_ID for convenience', () => {
    expect(POCHVEN_REGION_ID).toBe(10000070)
  })
})
