import { describe, it, expect } from 'vitest'
import { validateUniverseData } from './dataValidation.js'

const validSystem = { id: 1, name: 'Alpha', constellationId: 10, regionId: 100, x: 0, y: 0 }
const validSystem2 = { id: 2, name: 'Beta', constellationId: 10, regionId: 100, x: 5, y: 5 }

describe('validateUniverseData', () => {
  it('returns the data unchanged when valid', () => {
    const data = { systems: [validSystem, validSystem2], stargates: [{ fromSystemId: 1, toSystemId: 2 }] }
    expect(validateUniverseData(data)).toEqual(data)
  })

  it('accepts an empty systems and stargates array', () => {
    const data = { systems: [], stargates: [] }
    expect(validateUniverseData(data)).toEqual(data)
  })

  it('throws when data is not an object', () => {
    expect(() => validateUniverseData(null)).toThrow('Invalid universe data: expected an object')
    expect(() => validateUniverseData('nope')).toThrow('Invalid universe data: expected an object')
  })

  it('throws when systems is not an array', () => {
    expect(() => validateUniverseData({ systems: 'nope', stargates: [] })).toThrow(
      'Invalid universe data: "systems" must be an array'
    )
  })

  it('throws when stargates is not an array', () => {
    expect(() => validateUniverseData({ systems: [], stargates: 'nope' })).toThrow(
      'Invalid universe data: "stargates" must be an array'
    )
  })

  it('throws when a system is missing required fields', () => {
    const data = { systems: [{ id: 1, name: 'Alpha' }], stargates: [] }
    expect(() => validateUniverseData(data)).toThrow(/missing required fields/)
  })

  it('throws when a system has non-finite coordinates', () => {
    const data = { systems: [{ ...validSystem, x: NaN }], stargates: [] }
    expect(() => validateUniverseData(data)).toThrow(/missing required fields/)

    const data2 = { systems: [{ ...validSystem, y: Infinity }], stargates: [] }
    expect(() => validateUniverseData(data2)).toThrow(/missing required fields/)
  })

  it('throws when a stargate references an unknown system id', () => {
    const data = { systems: [validSystem], stargates: [{ fromSystemId: 1, toSystemId: 999 }] }
    expect(() => validateUniverseData(data)).toThrow('Invalid universe data: stargate references unknown system id')
  })

  it('accepts data with no regions field at all', () => {
    const data = { systems: [validSystem], stargates: [] }
    expect(() => validateUniverseData(data)).not.toThrow()
  })

  it('accepts a valid regions array', () => {
    const data = { systems: [validSystem], stargates: [], regions: [{ id: 100, name: 'Region One' }] }
    expect(validateUniverseData(data)).toEqual(data)
  })

  it('throws when regions is present but not an array', () => {
    const data = { systems: [validSystem], stargates: [], regions: 'nope' }
    expect(() => validateUniverseData(data)).toThrow('Invalid universe data: "regions" must be an array when present')
  })

  it('throws when a region is missing required fields', () => {
    const data = { systems: [validSystem], stargates: [], regions: [{ id: 100 }] }
    expect(() => validateUniverseData(data)).toThrow(/region is missing required fields/)
  })
})
