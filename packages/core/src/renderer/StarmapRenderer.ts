import type { Layer, SystemNode, UniverseData, Viewport } from '../types.js'
import { validateUniverseData } from '../dataValidation.js'
import { worldToScreen, screenToWorld, clampScale, getVisibleWorldBounds } from '../viewport.js'
import { Quadtree, buildQuadtree } from '../quadtree.js'

const LOD_LABEL_SCALE_THRESHOLD = 2
const HIT_TEST_RADIUS_PX = 10

export interface StarmapRendererOptions {
  layers?: Layer[]
  onSystemClick?: (system: SystemNode | null) => void
  onSystemHover?: (system: SystemNode | null) => void
  initialViewport?: Partial<Pick<Viewport, 'offsetX' | 'offsetY' | 'scale'>>
}

function computeBounds(systems: SystemNode[]) {
  if (systems.length === 0) return { minX: -1, minY: -1, maxX: 1, maxY: 1 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of systems) {
    minX = Math.min(minX, s.x)
    minY = Math.min(minY, s.y)
    maxX = Math.max(maxX, s.x)
    maxY = Math.max(maxY, s.y)
  }
  return { minX, minY, maxX, maxY }
}

export class StarmapRenderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private data: UniverseData
  private systemsById: Map<number, SystemNode>
  private quadtree: Quadtree
  private layers: Layer[]
  private viewport: Viewport
  private options: StarmapRendererOptions
  private isPanning = false
  private lastPointer = { x: 0, y: 0 }

  constructor(canvas: HTMLCanvasElement, data: UniverseData, options: StarmapRendererOptions = {}) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')

    this.ctx = ctx
    this.canvas = canvas
    this.data = validateUniverseData(data)
    this.systemsById = new Map(this.data.systems.map(s => [s.id, s]))
    this.layers = options.layers ?? []
    this.options = options
    this.viewport = {
      offsetX: options.initialViewport?.offsetX ?? 0,
      offsetY: options.initialViewport?.offsetY ?? 0,
      scale: clampScale(options.initialViewport?.scale ?? 1),
      width: canvas.width,
      height: canvas.height,
    }
    this.quadtree = buildQuadtree(this.data.systems, computeBounds(this.data.systems))

    this.handlePointerDown = this.handlePointerDown.bind(this)
    this.handlePointerMove = this.handlePointerMove.bind(this)
    this.handlePointerUp = this.handlePointerUp.bind(this)
    this.handleWheel = this.handleWheel.bind(this)
    this.handleClick = this.handleClick.bind(this)

    canvas.addEventListener('pointerdown', this.handlePointerDown)
    canvas.addEventListener('pointermove', this.handlePointerMove)
    canvas.addEventListener('pointerup', this.handlePointerUp)
    canvas.addEventListener('wheel', this.handleWheel)
    canvas.addEventListener('click', this.handleClick)
  }

  setLayers(layers: Layer[]): void {
    this.layers = layers
    this.draw()
  }

  getViewport(): Viewport {
    return { ...this.viewport }
  }

  draw(): void {
    const { ctx, viewport } = this
    ctx.clearRect(0, 0, viewport.width, viewport.height)

    const bounds = getVisibleWorldBounds(viewport)
    const visibleSystems = this.quadtree.queryRange(bounds)
    const visibleIds = new Set(visibleSystems.map(s => s.id))

    ctx.strokeStyle = '#2a3340'
    for (const gate of this.data.stargates) {
      if (!visibleIds.has(gate.fromSystemId) && !visibleIds.has(gate.toSystemId)) continue
      const from = this.systemsById.get(gate.fromSystemId)
      const to = this.systemsById.get(gate.toSystemId)
      if (!from || !to) continue
      const a = worldToScreen(viewport, from.x, from.y)
      const b = worldToScreen(viewport, to.x, to.y)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }

    const showLabels = viewport.scale >= LOD_LABEL_SCALE_THRESHOLD
    ctx.fillStyle = '#c8d0da'
    for (const system of visibleSystems) {
      const { x, y } = worldToScreen(viewport, system.x, system.y)
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
      if (showLabels) ctx.fillText(system.name, x + 4, y - 4)
    }

    for (const layer of this.layers) {
      layer.draw(ctx, viewport, visibleSystems)
    }
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown)
    this.canvas.removeEventListener('pointermove', this.handlePointerMove)
    this.canvas.removeEventListener('pointerup', this.handlePointerUp)
    this.canvas.removeEventListener('wheel', this.handleWheel)
    this.canvas.removeEventListener('click', this.handleClick)
  }

  private hitTest(clientX: number, clientY: number): SystemNode | null {
    const rect = this.canvas.getBoundingClientRect()
    const world = screenToWorld(this.viewport, clientX - rect.left, clientY - rect.top)
    return this.quadtree.findNearest(world.x, world.y, HIT_TEST_RADIUS_PX / this.viewport.scale)
  }

  private handlePointerDown(e: PointerEvent): void {
    this.isPanning = true
    this.lastPointer = { x: e.clientX, y: e.clientY }
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.isPanning) {
      const dx = (e.clientX - this.lastPointer.x) / this.viewport.scale
      const dy = (e.clientY - this.lastPointer.y) / this.viewport.scale
      this.viewport.offsetX -= dx
      this.viewport.offsetY -= dy
      this.lastPointer = { x: e.clientX, y: e.clientY }
      this.draw()
      return
    }
    if (this.options.onSystemHover) {
      this.options.onSystemHover(this.hitTest(e.clientX, e.clientY))
    }
  }

  private handlePointerUp(): void {
    this.isPanning = false
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault()
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
    this.viewport.scale = clampScale(this.viewport.scale * zoomFactor)
    this.draw()
  }

  private handleClick(e: MouseEvent): void {
    if (!this.options.onSystemClick) return
    this.options.onSystemClick(this.hitTest(e.clientX, e.clientY))
  }
}
