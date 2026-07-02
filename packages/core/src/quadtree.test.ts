import { describe, it, expect } from 'vitest'
import { Quadtree, buildQuadtree } from './quadtree.js'

function sys(id: number, x: number, y: number) {
  return { id, name: `S${id}`, constellationId: 1, regionId: 1, x, y }
}

const worldBounds = { minX: -100, minY: -100, maxX: 100, maxY: 100 }

describe('Quadtree', () => {
  it('returns points within a queried range', () => {
    const qt = new Quadtree(worldBounds)
    qt.insert(sys(1, 0, 0))
    qt.insert(sys(2, 50, 50))
    qt.insert(sys(3, -50, -50))

    const found = qt.queryRange({ minX: -10, minY: -10, maxX: 10, maxY: 10 })

    expect(found.map(p => p.id)).toEqual([1])
  })

  it('finds the nearest point within maxDistance', () => {
    const qt = new Quadtree(worldBounds)
    qt.insert(sys(1, 0, 0))
    qt.insert(sys(2, 5, 0))

    const nearest = qt.findNearest(1, 0, 10)

    expect(nearest?.id).toBe(1)
  })

  it('returns null from findNearest when nothing is within maxDistance', () => {
    const qt = new Quadtree(worldBounds)
    qt.insert(sys(1, 90, 90))

    expect(qt.findNearest(0, 0, 5)).toBeNull()
  })

  it('subdivides correctly and still finds all points once a node exceeds capacity', () => {
    const qt = new Quadtree(worldBounds)
    const points = Array.from({ length: 50 }, (_, i) => sys(i, (i % 10) * 10 - 50, Math.floor(i / 10) * 10 - 50))
    for (const p of points) qt.insert(p)

    const found = qt.queryRange(worldBounds)

    expect(found.length).toBe(50)
  })

  it('ignores points inserted outside the tree bounds', () => {
    const qt = new Quadtree(worldBounds)
    qt.insert(sys(1, 9999, 9999))

    expect(qt.queryRange(worldBounds)).toEqual([])
  })

  it('retains a point sitting exactly on the outer maxX bound', () => {
    const qt = new Quadtree(worldBounds)
    qt.insert(sys(1, 100, 0))

    const found = qt.queryRange(worldBounds)

    expect(found.map(p => p.id)).toEqual([1])
  })

  it('retains a point sitting exactly on the outer maxY bound', () => {
    const qt = new Quadtree(worldBounds)
    qt.insert(sys(1, 0, 100))

    const found = qt.queryRange(worldBounds)

    expect(found.map(p => p.id)).toEqual([1])
  })
})

describe('buildQuadtree', () => {
  it('builds a queryable tree from a list of systems', () => {
    const systems = [sys(1, 0, 0), sys(2, 5, 5)]
    const qt = buildQuadtree(systems, worldBounds)

    expect(qt.queryRange(worldBounds).map(p => p.id).sort()).toEqual([1, 2])
  })
})
