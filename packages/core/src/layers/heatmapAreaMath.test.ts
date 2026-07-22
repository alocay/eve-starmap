import { describe, it, expect } from 'vitest'
import { smoothstep, fieldContribution, bandThresholds, toTransparent, parseRgb, createFieldScale } from './heatmapAreaMath.js'

describe('smoothstep', () => {
  it('clamps to 0 below the lower edge', () => {
    expect(smoothstep(0, 1, -1)).toBe(0)
  })

  it('clamps to 1 above the upper edge', () => {
    expect(smoothstep(0, 1, 2)).toBe(1)
  })

  it('returns 0 exactly at the lower edge and 1 exactly at the upper edge', () => {
    expect(smoothstep(0, 1, 0)).toBe(0)
    expect(smoothstep(0, 1, 1)).toBe(1)
  })

  it('returns 0.5 at the midpoint', () => {
    expect(smoothstep(0, 1, 0.5)).toBe(0.5)
  })
})

describe('fieldContribution', () => {
  it('is strongest at the source itself', () => {
    // r2 = 100, denom = 0 + 0 + 100*0.25 = 25 -> 1 * 100 / 25 = 4
    expect(fieldContribution(0, 0, 1, 10)).toBe(4)
  })

  it('falls off with distance', () => {
    // denom = 100 + 0 + 25 = 125 -> 100 / 125 = 0.8
    expect(fieldContribution(10, 0, 1, 10)).toBeCloseTo(0.8)
  })

  it('scales linearly with value', () => {
    expect(fieldContribution(0, 0, 2, 10)).toBe(8)
  })
})

describe('bandThresholds', () => {
  it('returns one threshold per requested band, ascending from 1', () => {
    expect(bandThresholds(1)).toEqual([1])
    expect(bandThresholds(2)).toEqual([1, 2])
    expect(bandThresholds(4)).toEqual([1, 2, 3, 4])
  })

  it('clamps below 1 up to 1', () => {
    expect(bandThresholds(0)).toEqual([1])
    expect(bandThresholds(-5)).toEqual([1])
  })

  it('clamps above 4 down to 4', () => {
    expect(bandThresholds(10)).toEqual([1, 2, 3, 4])
  })

  it('rounds fractional band counts', () => {
    expect(bandThresholds(2.6)).toEqual([1, 2, 3])
  })
})

describe('toTransparent', () => {
  it('rewrites an opaque rgb() string to alpha 0', () => {
    expect(toTransparent('rgb(26, 31, 39)')).toBe('rgba(26, 31, 39, 0)')
  })

  it('drops any existing alpha from an rgba() string', () => {
    expect(toTransparent('rgba(255, 92, 51, 0.5)')).toBe('rgba(255, 92, 51, 0)')
  })
})

describe('parseRgb', () => {
  it('extracts the r, g, b components from an rgb() string', () => {
    expect(parseRgb('rgb(255, 92, 51)')).toEqual([255, 92, 51])
  })

  it('extracts the r, g, b components from an rgba() string, ignoring alpha', () => {
    expect(parseRgb('rgba(26, 31, 39, 0.5)')).toEqual([26, 31, 39])
  })
})

describe('createFieldScale', () => {
  it('maps a single distinct value to 1 (fully hot), not 0', () => {
    const scale = createFieldScale([100])
    expect(scale(100)).toBe(1)
  })

  it('maps all-equal values to 1 even with more than one entry', () => {
    const scale = createFieldScale([50, 50, 50])
    expect(scale(50)).toBe(1)
  })

  it('maps the observed max to 1 and the observed min to the floor (0.25)', () => {
    const scale = createFieldScale([10, 1000])
    expect(scale(1000)).toBe(1)
    expect(scale(10)).toBeCloseTo(0.25)
  })

  it('guarantees a heavily skewed low value still clears band 1 (skewed regression case)', () => {
    // A value 100,000x smaller than the max would normalize to ~0 (invisible)
    // under a naive value/max scale -- this is exactly the sov-losses bug.
    const scale = createFieldScale([1, 100_000])
    const normalized = scale(1)
    // Band 1's threshold is 1.0 at a source's own center (fieldContribution
    // returns value*4 at dist=0); normalized*4 must clear the smoothstep's
    // lower edge (0.85) for the source to render at all.
    expect(normalized * 4).toBeGreaterThan(0.85)
  })

  it('respects explicit min/max overrides instead of auto-detecting', () => {
    const scale = createFieldScale([10, 1000], { min: 0, max: 2000 })
    expect(scale(2000)).toBe(1)
    expect(scale(0)).toBeCloseTo(0.25)
    expect(scale(1000)).toBeCloseTo(0.25 + 0.75 * 0.5)
  })

  it('falls back to 0/0 range (treated as a single value) for an empty values array with no overrides', () => {
    const scale = createFieldScale([])
    expect(scale(0)).toBe(1)
  })
})
