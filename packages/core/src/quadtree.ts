import type { SystemNode } from './types.js'

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const MAX_POINTS_PER_NODE = 8
const MAX_DEPTH = 8

export class Quadtree {
  private bounds: Bounds
  private points: SystemNode[] = []
  private divided = false
  private depth: number
  private northeast?: Quadtree
  private northwest?: Quadtree
  private southeast?: Quadtree
  private southwest?: Quadtree

  constructor(bounds: Bounds, depth = 0) {
    this.bounds = bounds
    this.depth = depth
  }

  insert(point: SystemNode): void {
    if (!this.contains(this.bounds, point.x, point.y)) return

    if (this.points.length < MAX_POINTS_PER_NODE || this.depth >= MAX_DEPTH) {
      this.points.push(point)
      return
    }

    if (!this.divided) this.subdivide()
    this.routeToChild(point).insert(point)
  }

  queryRange(range: Bounds): SystemNode[] {
    const found: SystemNode[] = []
    if (!this.intersects(this.bounds, range)) return found

    for (const p of this.points) {
      if (p.x >= range.minX && p.x <= range.maxX && p.y >= range.minY && p.y <= range.maxY) {
        found.push(p)
      }
    }

    if (this.divided) {
      found.push(...this.northeast!.queryRange(range))
      found.push(...this.northwest!.queryRange(range))
      found.push(...this.southeast!.queryRange(range))
      found.push(...this.southwest!.queryRange(range))
    }

    return found
  }

  findNearest(x: number, y: number, maxDistance: number): SystemNode | null {
    const candidates = this.queryRange({
      minX: x - maxDistance,
      minY: y - maxDistance,
      maxX: x + maxDistance,
      maxY: y + maxDistance,
    })

    let nearest: SystemNode | null = null
    let nearestDist = maxDistance
    for (const c of candidates) {
      const dist = Math.hypot(c.x - x, c.y - y)
      if (dist <= nearestDist) {
        nearest = c
        nearestDist = dist
      }
    }
    return nearest
  }

  private subdivide(): void {
    const { minX, minY, maxX, maxY } = this.bounds
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2

    this.northwest = new Quadtree({ minX, minY, maxX: midX, maxY: midY }, this.depth + 1)
    this.northeast = new Quadtree({ minX: midX, minY, maxX, maxY: midY }, this.depth + 1)
    this.southwest = new Quadtree({ minX, minY: midY, maxX: midX, maxY }, this.depth + 1)
    this.southeast = new Quadtree({ minX: midX, minY: midY, maxX, maxY }, this.depth + 1)
    this.divided = true

    const existing = this.points
    this.points = []
    for (const p of existing) {
      this.routeToChild(p).insert(p)
    }
  }

  /**
   * Determines exactly one child quadrant for a point during subdivision,
   * using the split midpoint directly. This guarantees every point is routed
   * to exactly one child (no duplication, no loss), regardless of whether the
   * point sits precisely on the internal split line.
   */
  private routeToChild(point: SystemNode): Quadtree {
    const { minX, minY, maxX, maxY } = this.bounds
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2
    const isWest = point.x <= midX
    const isNorth = point.y <= midY

    if (isWest && isNorth) return this.northwest!
    if (!isWest && isNorth) return this.northeast!
    if (isWest && !isNorth) return this.southwest!
    return this.southeast!
  }

  private contains(bounds: Bounds, x: number, y: number): boolean {
    return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY
  }

  private intersects(a: Bounds, b: Bounds): boolean {
    return !(b.minX > a.maxX || b.maxX < a.minX || b.minY > a.maxY || b.maxY < a.minY)
  }
}

export function buildQuadtree(systems: SystemNode[], bounds: Bounds): Quadtree {
  const qt = new Quadtree(bounds)
  for (const s of systems) qt.insert(s)
  return qt
}
