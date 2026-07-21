import type { Layer, SystemNode, UniverseData, Viewport } from '../types.js'
import { worldToScreen } from '../viewport.js'
import {
  createSecurityColorLookup,
  defaultSecurityColors,
  type SecurityColors,
} from '../securityColor.js'

// Custom per-node color override. Receives the resolved system and its raw
// security (undefined when unknown); returns the color for that node. The layer
// still builds each leg's gradient from its two endpoints' returned colors.
export type RouteColorFn = (system: SystemNode, security: number | undefined) => string

export interface RouteLayerOptions {
  // Tier colors: keys are display tiers ("1.0".."0.0"; ≤0.0 shares the 0.0 color).
  // Defaults to the bundled defaultSecurityColors. Ignored when colorForNode is set.
  securityColors?: SecurityColors
  colorForNode?: RouteColorFn // overrides securityColors when provided
  gradient?: boolean          // blend each leg start->end color; default true.
                              // false = solid leg in the start node's color.
  lineWidth?: number          // default 2
  endpointMarkers?: boolean   // draw a dot at origin + destination, default true
  missingColor?: string       // used when a system's security is unknown, default '#888'
}

const DEFAULT_LINE_WIDTH = 2
const DEFAULT_MISSING_COLOR = '#888'
const ENDPOINT_RADIUS = 3

// Draws the jump route (ordered system ids) as a polyline, each leg a canvas linear
// gradient between its two endpoints' security-tier colors. Needs the full universe
// data (not the culled visibleSystems) because routes span beyond the viewport.
export function routeLayer(
  systemIds: number[],
  universeData: UniverseData,
  options: RouteLayerOptions = {},
): Layer {
  const byId = new Map<number, SystemNode>(universeData.systems.map(s => [s.id, s]))
  const lineWidth = options.lineWidth ?? DEFAULT_LINE_WIDTH
  const missingColor = options.missingColor ?? DEFAULT_MISSING_COLOR
  const showMarkers = options.endpointMarkers ?? true
  const useGradient = options.gradient ?? true
  const lookup = createSecurityColorLookup(options.securityColors ?? defaultSecurityColors, missingColor)
  const colorFor: RouteColorFn = options.colorForNode ?? ((s, sec) => lookup(sec))

  return {
    id: 'route',
    focusSystemIds: systemIds,
    draw(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
      const nodes = systemIds.map(id => byId.get(id))

      // Legs
      ctx.lineWidth = lineWidth
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i]
        const b = nodes[i + 1]
        if (!a || !b) continue // missing system -> break the polyline here

        const pa = worldToScreen(viewport, a.x, a.y)
        const pb = worldToScreen(viewport, b.x, b.y)
        if (useGradient) {
          const gradient = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y)
          gradient.addColorStop(0, colorFor(a, a.security))
          gradient.addColorStop(1, colorFor(b, b.security))
          ctx.strokeStyle = gradient
        } else {
          // Solid leg: the start node's color runs the whole way to the next node.
          ctx.strokeStyle = colorFor(a, a.security)
        }
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.stroke()
      }

      // Endpoint markers (origin + destination)
      if (showMarkers && nodes.length > 0) {
        const endpoints = nodes.length === 1 ? [nodes[0]] : [nodes[0], nodes[nodes.length - 1]]
        for (const node of endpoints) {
          if (!node) continue
          const p = worldToScreen(viewport, node.x, node.y)
          ctx.fillStyle = colorFor(node, node.security)
          ctx.beginPath()
          ctx.arc(p.x, p.y, ENDPOINT_RADIUS, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    },
  }
}
