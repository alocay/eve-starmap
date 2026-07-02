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
}
