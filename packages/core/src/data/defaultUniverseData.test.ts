import { describe, it, expect } from 'vitest'
import { defaultUniverseData } from './defaultUniverseData.js'

describe('defaultUniverseData security', () => {
  it('every system carries a numeric security status', () => {
    for (const s of defaultUniverseData.systems) {
      expect(typeof s.security).toBe('number')
    }
  })

  it('security values fall within EVE range [-1, 1]', () => {
    for (const s of defaultUniverseData.systems) {
      expect(s.security).toBeGreaterThanOrEqual(-1)
      expect(s.security).toBeLessThanOrEqual(1)
    }
  })
})
