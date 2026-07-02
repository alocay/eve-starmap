import { describe, it, expect } from 'vitest'
import { createColorScale } from './colorScale.js'

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
})
