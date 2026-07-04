import type { Layer, RegionNode, SystemNode, Viewport } from '../types.js'
import { worldToScreen } from '../viewport.js'

export interface RegionLabelLayerOptions {
  fontSize?: number
  color?: string
  // Fully opaque for now while other ways of visually distinguishing
  // regions (that don't rely on semi-transparency reading clearly against
  // system dots/connector lines) are still being explored.
  opacity?: number
  font?: string
  // Lets a consumer toggle labels on/off by flipping a boolean captured in
  // this layer's own options, without needing to restructure the renderer's
  // `layers` array (the other way to hide a layer -- simply omitting it from
  // that array -- still works too; this is just a more convenient knob when
  // the layer instance itself is already memoized/stable). Default true.
  visible?: boolean
}

// Regions have no official 2D-projected position of their own in the SDE --
// only a 3D universe position, which isn't in the map's 2D coordinate space --
// so each label is placed at the centroid of its member systems' (already 2D)
// positions instead.
function computeCentroids(regions: RegionNode[], allSystems: SystemNode[]): Map<number, { x: number; y: number; name: string }> {
  const sums = new Map<number, { sumX: number; sumY: number; count: number; name: string }>()
  for (const region of regions) {
    sums.set(region.id, { sumX: 0, sumY: 0, count: 0, name: region.name })
  }
  for (const system of allSystems) {
    const entry = sums.get(system.regionId)
    if (!entry) continue
    entry.sumX += system.x
    entry.sumY += system.y
    entry.count += 1
  }

  const centroids = new Map<number, { x: number; y: number; name: string }>()
  for (const [id, entry] of sums) {
    if (entry.count === 0) continue
    centroids.set(id, { x: entry.sumX / entry.count, y: entry.sumY / entry.count, name: entry.name })
  }
  return centroids
}

export function regionLabelLayer(
  regions: RegionNode[],
  allSystems: SystemNode[],
  options: RegionLabelLayerOptions = {}
): Layer {
  const fontSize = options.fontSize ?? 14
  // Amber (rather than a blue tint) so labels read as a clearly distinct hue
  // from the near-white system dots and grey connector lines -- a blue that's
  // otherwise close in lightness to the dots blends into the same "bright
  // stuff on dark background" band and is easy to miss at a glance.
  const color = options.color ?? '#e8a33d'
  const opacity = options.opacity ?? 1
  const font = options.font ?? 'sans-serif'
  const visible = options.visible ?? true
  const centroids = computeCentroids(regions, allSystems)

  return {
    id: 'region-labels',
    draw(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
      if (!visible) return
      ctx.save()
      ctx.globalAlpha = opacity
      ctx.fillStyle = color
      ctx.font = `${fontSize}px ${font}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const { x, y, name } of centroids.values()) {
        const screen = worldToScreen(viewport, x, y)
        ctx.fillText(name, screen.x, screen.y)
      }
      ctx.restore()
    },
  }
}
