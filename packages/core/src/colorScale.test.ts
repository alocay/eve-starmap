import { describe, it, expect } from 'vitest'
import { createColorScale, createValueScale } from './colorScale.js'

describe('createColorScale', () => {
  it('maps the minimum value to the start of the palette', () => {
    const colorFor = createColorScale([0, 100], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(0)).toBe('rgb(0, 0, 0)')
  })

  it('maps the maximum value to the end of the palette', () => {
    const colorFor = createColorScale([0, 100], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(100)).toBe('rgb(255, 255, 255)')
  })

  it('interpolates a midpoint value', () => {
    const colorFor = createColorScale([0, 100], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(50)).toBe('rgb(128, 128, 128)')
  })

  it('auto-detects min/max from the supplied values when not given explicitly', () => {
    const colorFor = createColorScale([10, 20, 30], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(10)).toBe('rgb(0, 0, 0)')
    expect(colorFor(30)).toBe('rgb(255, 255, 255)')
  })

  it('honors explicit min/max overrides', () => {
    const colorFor = createColorScale([10, 20, 30], { min: 0, max: 100, palette: ['#000000', '#ffffff'] })
    expect(colorFor(50)).toBe('rgb(128, 128, 128)')
  })

  it('clamps values outside the [min, max] range', () => {
    const colorFor = createColorScale([0, 100], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(-50)).toBe('rgb(0, 0, 0)')
    expect(colorFor(500)).toBe('rgb(255, 255, 255)')
  })

  it('returns the start color for every value when min equals max', () => {
    const colorFor = createColorScale([5], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(5)).toBe('rgb(0, 0, 0)')
  })

  it('returns the start color for an empty values array with no explicit min/max', () => {
    const colorFor = createColorScale([], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(0)).toBe('rgb(0, 0, 0)')
    expect(colorFor(999)).toBe('rgb(0, 0, 0)')
  })

  it('omits alpha and returns plain rgb() when opacityMin/opacityMax are not given', () => {
    const colorFor = createColorScale([0, 100], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(50)).toBe('rgb(128, 128, 128)')
  })

  it('interpolates alpha alongside the color gradient when opacityMin/opacityMax are given', () => {
    const colorFor = createColorScale([0, 100], { palette: ['#000000', '#ffffff'], opacityMin: 0.2, opacityMax: 1 })
    expect(colorFor(0)).toBe('rgba(0, 0, 0, 0.2)')
    expect(colorFor(100)).toBe('rgba(255, 255, 255, 1)')
    expect(colorFor(50)).toBe('rgba(128, 128, 128, 0.6)')
  })
})

describe('createValueScale', () => {
  it('normalizes a value to its [0, 1] position within the range', () => {
    const scale = createValueScale([0, 100])
    expect(scale(0)).toBe(0)
    expect(scale(100)).toBe(1)
    expect(scale(50)).toBe(0.5)
  })

  it('clamps values outside the range', () => {
    const scale = createValueScale([0, 100])
    expect(scale(-50)).toBe(0)
    expect(scale(500)).toBe(1)
  })

  it('returns 0 for every value when min equals max', () => {
    const scale = createValueScale([5])
    expect(scale(5)).toBe(0)
  })
})
