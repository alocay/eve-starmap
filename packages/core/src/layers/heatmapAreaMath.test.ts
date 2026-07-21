import { describe, it, expect } from 'vitest'
import { smoothstep, fieldContribution, bandThresholds, toTransparent, parseRgb } from './heatmapAreaMath.js'

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
