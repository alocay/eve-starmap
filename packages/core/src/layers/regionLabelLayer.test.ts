import { describe, it, expect, vi } from 'vitest'
import { regionLabelLayer } from './regionLabelLayer.js'

function sys(id: number, regionId: number, x: number, y: number) {
  return { id, name: `S${id}`, constellationId: 1, regionId, x, y }
}

function makeMockCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    font: '',
    globalAlpha: 1,
    textAlign: '',
    textBaseline: '',
  }
}

const viewport = { offsetX: 0, offsetY: 0, scale: 1, width: 100, height: 100 }

describe('regionLabelLayer', () => {
  it('has id "region-labels"', () => {
    expect(regionLabelLayer([], []).id).toBe('region-labels')
  })

  it('draws one label per region at the centroid of its member systems', () => {
    const regions = [{ id: 100, name: 'Region A' }]
    const systems = [sys(1, 100, 0, 0), sys(2, 100, 10, 10)]
    const layer = regionLabelLayer(regions, systems)
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, systems)

    // Centroid of (0,0) and (10,10) is (5,5); world y is inverted for screen
    // (matches worldToScreen), so screen (5,5) -> (55, 45).
    expect(ctx.fillText).toHaveBeenCalledTimes(1)
    expect(ctx.fillText).toHaveBeenCalledWith('Region A', 55, 45)
  })

  it('draws a label for each region independently, only averaging each region\'s own systems', () => {
    const regions = [{ id: 100, name: 'Region A' }, { id: 200, name: 'Region B' }]
    const systems = [sys(1, 100, 0, 0), sys(2, 200, 20, 20)]
    const layer = regionLabelLayer(regions, systems)
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, systems)

    expect(ctx.fillText).toHaveBeenCalledTimes(2)
    expect(ctx.fillText).toHaveBeenCalledWith('Region A', 50, 50)
    expect(ctx.fillText).toHaveBeenCalledWith('Region B', 70, 30)
  })

  it('skips a region with no member systems instead of drawing a label at (NaN, NaN)', () => {
    const regions = [{ id: 100, name: 'Region A' }, { id: 999, name: 'Empty Region' }]
    const systems = [sys(1, 100, 0, 0)]
    const layer = regionLabelLayer(regions, systems)
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, systems)

    expect(ctx.fillText).toHaveBeenCalledTimes(1)
    expect(ctx.fillText).toHaveBeenCalledWith('Region A', 50, 50)
  })

  it('is fully opaque by default via globalAlpha, restored via save/restore', () => {
    const layer = regionLabelLayer([{ id: 100, name: 'Region A' }], [sys(1, 100, 0, 0)])
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, [])

    expect(ctx.save).toHaveBeenCalledTimes(1)
    expect(ctx.restore).toHaveBeenCalledTimes(1)
    expect(ctx.globalAlpha).toBe(1)
  })

  it('honors custom fontSize, color, opacity, and font options', () => {
    const layer = regionLabelLayer(
      [{ id: 100, name: 'Region A' }],
      [sys(1, 100, 0, 0)],
      { fontSize: 20, color: '#ff0000', opacity: 0.8, font: 'serif' }
    )
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, [])

    expect(ctx.fillStyle).toBe('#ff0000')
    expect(ctx.font).toBe('20px serif')
    expect(ctx.globalAlpha).toBe(0.8)
  })

  it('draws nothing when visible is false, without touching the canvas context at all', () => {
    const layer = regionLabelLayer(
      [{ id: 100, name: 'Region A' }],
      [sys(1, 100, 0, 0)],
      { visible: false }
    )
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, [])

    expect(ctx.fillText).not.toHaveBeenCalled()
    expect(ctx.save).not.toHaveBeenCalled()
    expect(ctx.restore).not.toHaveBeenCalled()
  })

  it('draws normally when visible is true (explicit, matching the default)', () => {
    const layer = regionLabelLayer(
      [{ id: 100, name: 'Region A' }],
      [sys(1, 100, 0, 0)],
      { visible: true }
    )
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, [])

    expect(ctx.fillText).toHaveBeenCalledTimes(1)
  })

  it('draws nothing for an empty regions list', () => {
    const layer = regionLabelLayer([], [sys(1, 100, 0, 0)])
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, [])

    expect(ctx.fillText).not.toHaveBeenCalled()
  })
})
