import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { EveStarmap } from './EveStarmap.js'

const mockDraw = vi.fn()
const mockDestroy = vi.fn()
const mockSetLayers = vi.fn()

vi.mock('eve-starmap', () => ({
  StarmapRenderer: vi.fn().mockImplementation(() => ({
    draw: mockDraw,
    destroy: mockDestroy,
    setLayers: mockSetLayers,
  })),
}))

import { StarmapRenderer } from 'eve-starmap'

const sampleData = { systems: [], stargates: [] }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('EveStarmap', () => {
  it('constructs a StarmapRenderer on mount with the canvas and data', () => {
    render(<EveStarmap data={sampleData as any} />)

    expect(StarmapRenderer).toHaveBeenCalledTimes(1)
    expect((StarmapRenderer as any).mock.calls[0][1]).toBe(sampleData)
  })

  it('calls draw() after constructing the renderer', () => {
    render(<EveStarmap data={sampleData as any} />)
    expect(mockDraw).toHaveBeenCalledTimes(1)
  })

  it('calls destroy() on the renderer when unmounted', () => {
    const { unmount } = render(<EveStarmap data={sampleData as any} />)
    unmount()
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })

  it('calls setLayers when the layers prop changes after mount', () => {
    const { rerender } = render(<EveStarmap data={sampleData as any} layers={[]} />)
    const newLayers = [{ id: 'x', draw: vi.fn() }]

    rerender(<EveStarmap data={sampleData as any} layers={newLayers} />)

    expect(mockSetLayers).toHaveBeenCalledWith(newLayers)
  })
})
