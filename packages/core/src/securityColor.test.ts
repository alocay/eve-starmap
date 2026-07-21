import { describe, it, expect } from 'vitest'
import { round1, createSecurityColorLookup, defaultSecurityColors } from './securityColor.js'

const colors = {
  '1.0': '#f00', '0.9': '#e10', '0.8': '#d20', '0.7': '#c30',
  '0.6': '#b40', '0.5': '#a50', '0.4': '#960', '0.3': '#870',
  '0.2': '#780', '0.1': '#690', '0.0': '#5a0',
}

describe('round1', () => {
  it('rounds to nearest 0.1 tier', () => {
    expect(round1(0.47)).toBe(0.5)
    expect(round1(0.44)).toBe(0.4)
    expect(round1(0.05)).toBe(0.1)
  })
})

describe('createSecurityColorLookup', () => {
  it('maps a raw sec to its rounded tier color', () => {
    const lookup = createSecurityColorLookup(colors, '#000')
    expect(lookup(0.47)).toBe('#a50') // -> 0.5
    expect(lookup(0.44)).toBe('#960') // -> 0.4
  })

  it('accepts a Map with numeric keys', () => {
    const lookup = createSecurityColorLookup(new Map([[0.5, '#abc']]), '#000')
    expect(lookup(0.5)).toBe('#abc')
  })

  it('clamps negatives to the lowest provided tier', () => {
    const lookup = createSecurityColorLookup(colors, '#000')
    expect(lookup(-0.3)).toBe('#5a0') // lowest key is 0.0
  })

  it('clamps above the highest provided tier to that tier', () => {
    const lookup = createSecurityColorLookup({ '0.5': '#abc' }, '#000')
    expect(lookup(0.9)).toBe('#abc')
  })

  it('returns fallback for null/undefined security', () => {
    const lookup = createSecurityColorLookup(colors, '#000')
    expect(lookup(null)).toBe('#000')
    expect(lookup(undefined)).toBe('#000')
  })

  it('returns fallback for an in-range tier with no key', () => {
    const lookup = createSecurityColorLookup({ '1.0': '#fff', '0.0': '#000' }, '#999')
    expect(lookup(0.5)).toBe('#999') // 0.5 tier absent, within [0,1]
  })
})

describe('defaultSecurityColors', () => {
  it('covers tiers 1.0..0.0 and maps sub-zero sec to the 0.0 color', () => {
    const lookup = createSecurityColorLookup(defaultSecurityColors, '#000')
    expect(defaultSecurityColors['1.0']).toBe('#2c74e0')
    expect(lookup(0.5)).toBe('#f3fd82')
    expect(lookup(-0.5)).toBe(defaultSecurityColors['0.0']) // #8c3263, all lowsec/null share it
  })
})
