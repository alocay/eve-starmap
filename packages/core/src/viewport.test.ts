import { describe, it, expect } from 'vitest'
import { worldToScreen, screenToWorld, getVisibleWorldBounds, isPointInView, clampScale } from './viewport.js'

const viewport = { offsetX: 0, offsetY: 0, scale: 2, width: 100, height: 100 }

describe('worldToScreen / screenToWorld', () => {
  it('maps world origin to the screen center', () => {
    expect(worldToScreen(viewport, 0, 0)).toEqual({ x: 50, y: 50 })
  })

  it('round-trips screenToWorld(worldToScreen(p)) back to p', () => {
    const screen = worldToScreen(viewport, 30, -15)
    expect(screenToWorld(viewport, screen.x, screen.y)).toEqual({ x: 30, y: -15 })
  })
})

describe('getVisibleWorldBounds', () => {
  it('computes bounds centered on the offset, sized by scale', () => {
    expect(getVisibleWorldBounds(viewport)).toEqual({ minX: -25, minY: -25, maxX: 25, maxY: 25 })
  })
})

describe('isPointInView', () => {
  it('returns true for a point within the visible bounds', () => {
    expect(isPointInView(viewport, 0, 0)).toBe(true)
  })

  it('returns false for a point outside the visible bounds', () => {
    expect(isPointInView(viewport, 1000, 1000)).toBe(false)
  })
})

describe('clampScale', () => {
  it('clamps below the minimum', () => {
    expect(clampScale(0)).toBe(0.01)
  })

  it('clamps above the maximum', () => {
    expect(clampScale(1000)).toBe(50)
  })

  it('passes through an in-range value', () => {
    expect(clampScale(2)).toBe(2)
  })
})
