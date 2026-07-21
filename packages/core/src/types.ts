export interface SystemNode {
  id: number
  name: string
  constellationId: number
  regionId: number
  x: number
  y: number
  // Raw (unrounded) security status, e.g. 0.4531. Optional so fixtures/callers
  // built before this field don't need updating (same rationale as regions).
  security?: number
}

export interface StargateEdge {
  fromSystemId: number
  toSystemId: number
}

export interface RegionNode {
  id: number
  name: string
}

export interface UniverseData {
  systems: SystemNode[]
  stargates: StargateEdge[]
  // Optional so existing callers/fixtures built before regions were tracked
  // don't need updating -- consumers that don't care about region labels/
  // filtering can simply omit it.
  regions?: RegionNode[]
}

export interface Viewport {
  offsetX: number
  offsetY: number
  scale: number
  width: number
  height: number
}

export interface Layer {
  id: string
  draw(ctx: CanvasRenderingContext2D, viewport: Viewport, visibleSystems: SystemNode[]): void
  // System ids this layer has data for, e.g. a heatmap's value map keys. Optional --
  // consumers (like EveStarmap's focusSystemIds auto-derivation) can use this to
  // default the viewport to fit whatever a layer cares about, without every layer
  // needing to support it.
  focusSystemIds?: number[]
}
