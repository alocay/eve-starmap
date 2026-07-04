import type { Viewport } from './types.js'

const MIN_SCALE = 1e-18
const MAX_SCALE = 1e6

export function worldToScreen(viewport: Viewport, x: number, y: number): { x: number; y: number } {
  return {
    x: (x - viewport.offsetX) * viewport.scale + viewport.width / 2,
    // World y follows the SDE's position2D convention (increasing y = further
    // "up" on the in-game map), while screen/canvas y increases downward.
    // Negate here so the rendered map matches the in-game orientation instead
    // of appearing flipped along the x-axis.
    y: viewport.height / 2 - (y - viewport.offsetY) * viewport.scale,
  }
}

export function screenToWorld(viewport: Viewport, screenX: number, screenY: number): { x: number; y: number } {
  return {
    x: (screenX - viewport.width / 2) / viewport.scale + viewport.offsetX,
    y: viewport.offsetY - (screenY - viewport.height / 2) / viewport.scale,
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
