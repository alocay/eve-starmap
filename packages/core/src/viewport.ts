import type { Viewport } from './types.js'

const MIN_SCALE = 0.01
const MAX_SCALE = 50

export function worldToScreen(viewport: Viewport, x: number, y: number): { x: number; y: number } {
  return {
    x: (x - viewport.offsetX) * viewport.scale + viewport.width / 2,
    y: (y - viewport.offsetY) * viewport.scale + viewport.height / 2,
  }
}

export function screenToWorld(viewport: Viewport, screenX: number, screenY: number): { x: number; y: number } {
  return {
    x: (screenX - viewport.width / 2) / viewport.scale + viewport.offsetX,
    y: (screenY - viewport.height / 2) / viewport.scale + viewport.offsetY,
  }
}

export function getVisibleWorldBounds(viewport: Viewport): { minX: number; minY: number; maxX: number; maxY: number } {
  const halfWidth = viewport.width / 2 / viewport.scale
  const halfHeight = viewport.height / 2 / viewport.scale
  return {
    minX: viewport.offsetX - halfWidth,
    minY: viewport.offsetY - halfHeight,
    maxX: viewport.offsetX + halfWidth,
    maxY: viewport.offsetY + halfHeight,
  }
}

export function isPointInView(viewport: Viewport, x: number, y: number): boolean {
  const bounds = getVisibleWorldBounds(viewport)
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}
