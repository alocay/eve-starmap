export interface SystemNode {
  id: number
  name: string
  constellationId: number
  regionId: number
  x: number
  y: number
}

export interface StargateEdge {
  fromSystemId: number
  toSystemId: number
}

export interface UniverseData {
  systems: SystemNode[]
  stargates: StargateEdge[]
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
