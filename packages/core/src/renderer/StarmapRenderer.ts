import type { Layer, SystemNode, UniverseData, Viewport } from '../types.js'
import { validateUniverseData } from '../dataValidation.js'
import { worldToScreen, screenToWorld, clampScale, getVisibleWorldBounds } from '../viewport.js'
import { Quadtree, buildQuadtree } from '../quadtree.js'
import { SYSTEM_DOT_RADIUS } from '../constants.js'

const LOD_LABEL_SCALE_THRESHOLD = 2
const HIT_TEST_RADIUS_PX = 10
const FOCUS_PADDING = 0.9

export type HoverHandler = (system: SystemNode | null, screenPos: { x: number; y: number } | null) => void

export interface StarmapRendererOptions {
  layers?: Layer[]
  // screenPos is canvas-relative (0,0 at the canvas's top-left corner), not
  // page-relative -- so consumers building a tooltip can position it with
  // plain `position: absolute` inside a `position: relative` wrapper around
  // the canvas, no getBoundingClientRect() math needed on their end.
  onSystemClick?: (system: SystemNode | null, screenPos: { x: number; y: number } | null) => void
  onSystemHover?: HoverHandler
  initialViewport?: Partial<Pick<Viewport, 'offsetX' | 'offsetY' | 'scale'>>
  // When true, the system dot (and label) draws after layers, staying visible on
  // top of layer output (e.g. a heatmap circle) instead of being covered by it.
  // Default false: dot draws before layers, since a dot always on top can make
  // layer values (color/size) hard to read at a zoomed-out scale.
  systemDotOnTop?: boolean
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
  private hoverHandlers = new Set<HoverHandler>()

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
    if (options.onSystemHover) this.hoverHandlers.add(options.onSystemHover)

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

  // Registers an additional hover handler, called on every pointermove alongside
  // any others (including the constructor's onSystemHover). Returns a function
  // that unregisters it, so multiple independent features (tooltip, highlight
  // layer, side panel) can each own their own hover behavior without stomping
  // on one another or having to merge into a single callback.
  onHover(handler: HoverHandler): () => void {
    this.hoverHandlers.add(handler)
    return () => this.hoverHandlers.delete(handler)
  }

  getViewport(): Viewport {
    return { ...this.viewport }
  }

  // Pans/zooms without touching whatever isn't specified -- e.g. setViewport({ scale: 2 })
  // only changes zoom, leaving the current pan position alone.
  setViewport(viewport: Partial<Pick<Viewport, 'offsetX' | 'offsetY' | 'scale'>>): void {
    if (viewport.offsetX !== undefined) this.viewport.offsetX = viewport.offsetX
    if (viewport.offsetY !== undefined) this.viewport.offsetY = viewport.offsetY
    if (viewport.scale !== undefined) this.viewport.scale = clampScale(viewport.scale)
    this.draw()
  }

  // Pans/zooms to fit the given systems (by id) in view, e.g. only the systems a
  // heatmap layer has values for. IDs not present in this renderer's data, or an
  // empty/all-unmatched list, are a no-op -- the viewport is left untouched rather
  // than snapping to some arbitrary default.
  focusOn(systemIds: number[]): void {
    const systems = systemIds
      .map(id => this.systemsById.get(id))
      .filter((s): s is SystemNode => s != null)
    if (systems.length === 0) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const s of systems) {
      minX = Math.min(minX, s.x)
      minY = Math.min(minY, s.y)
      maxX = Math.max(maxX, s.x)
      maxY = Math.max(maxY, s.y)
    }
    // A single system (or several at the exact same point) has zero span --
    // fall back to 1 so the scale calculation below doesn't divide by zero.
    const spanX = maxX - minX || 1
    const spanY = maxY - minY || 1
    const scale = Math.min(this.viewport.width / spanX, this.viewport.height / spanY) * FOCUS_PADDING

    this.setViewport({ offsetX: (minX + maxX) / 2, offsetY: (minY + maxY) / 2, scale })
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

    if (!this.options.systemDotOnTop) this.drawSystemDots(visibleSystems)

    for (const layer of this.layers) {
      layer.draw(ctx, viewport, visibleSystems)
    }

    if (this.options.systemDotOnTop) this.drawSystemDots(visibleSystems)
  }

  private drawSystemDots(visibleSystems: SystemNode[]): void {
    const { ctx, viewport } = this
    const showLabels = viewport.scale >= LOD_LABEL_SCALE_THRESHOLD
    ctx.fillStyle = '#c8d0da'
    for (const system of visibleSystems) {
      const { x, y } = worldToScreen(viewport, system.x, system.y)
      ctx.beginPath()
      ctx.arc(x, y, SYSTEM_DOT_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      if (showLabels) ctx.fillText(system.name, x + 4, y - 4)
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

  private hitTestWithScreenPos(
    clientX: number,
    clientY: number
  ): [SystemNode | null, { x: number; y: number } | null] {
    const system = this.hitTest(clientX, clientY)
    if (!system) return [null, null]
    return [system, worldToScreen(this.viewport, system.x, system.y)]
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
    if (this.hoverHandlers.size > 0) {
      const result = this.hitTestWithScreenPos(e.clientX, e.clientY)
      for (const handler of this.hoverHandlers) handler(...result)
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
    this.options.onSystemClick(...this.hitTestWithScreenPos(e.clientX, e.clientY))
  }
}
