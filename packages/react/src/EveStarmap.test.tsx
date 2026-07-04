import { createRef } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { EveStarmap, type EveStarmapHandle } from './EveStarmap.js'

const mockDraw = vi.fn()
const mockDestroy = vi.fn()
const mockSetLayers = vi.fn()
const mockOnHover = vi.fn()
const mockFocusOn = vi.fn()
const mockSetSystemDotStyle = vi.fn()

vi.mock('eve-starmap', () => ({
  StarmapRenderer: vi.fn().mockImplementation(() => ({
    draw: mockDraw,
    destroy: mockDestroy,
    setLayers: mockSetLayers,
    onHover: mockOnHover,
    focusOn: mockFocusOn,
    setSystemDotStyle: mockSetSystemDotStyle,
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

  it('passes initialViewport through to the StarmapRenderer options', () => {
    const initialViewport = { scale: 1e-15, offsetX: 100, offsetY: -200 }

    render(<EveStarmap data={sampleData as any} initialViewport={initialViewport} />)

    expect((StarmapRenderer as any).mock.calls[0][2]).toEqual(
      expect.objectContaining({ initialViewport })
    )
  })

  it('passes systemDotRadius/Color/Opacity through to the StarmapRenderer constructor', () => {
    render(<EveStarmap data={sampleData as any} systemDotRadius={6} systemDotColor="#ff00ff" systemDotOpacity={0.5} />)

    expect((StarmapRenderer as any).mock.calls[0][2]).toEqual(
      expect.objectContaining({ systemDotRadius: 6, systemDotColor: '#ff00ff', systemDotOpacity: 0.5 })
    )
  })

  it('calls setSystemDotStyle when systemDotColor changes after mount', () => {
    const { rerender } = render(<EveStarmap data={sampleData as any} systemDotColor="#111111" />)
    mockSetSystemDotStyle.mockClear()

    rerender(<EveStarmap data={sampleData as any} systemDotColor="#222222" />)

    expect(mockSetSystemDotStyle).toHaveBeenCalledWith(
      expect.objectContaining({ systemDotColor: '#222222' })
    )
  })

  it('exposes onHover() via ref, delegating to the underlying renderer', () => {
    const ref = createRef<EveStarmapHandle>()
    render(<EveStarmap ref={ref} data={sampleData as any} />)
    const handler = vi.fn()

    ref.current!.onHover(handler)

    expect(mockOnHover).toHaveBeenCalledWith(handler)
  })

  it('calls focusOn() with focusSystemIds on mount when autoCenter is enabled (default)', () => {
    render(<EveStarmap data={sampleData as any} focusSystemIds={[1, 2, 3]} />)

    expect(mockFocusOn).toHaveBeenCalledWith([1, 2, 3])
  })

  it('does not call focusOn() on mount when autoCenter is false', () => {
    render(<EveStarmap data={sampleData as any} focusSystemIds={[1, 2, 3]} autoCenter={false} />)

    expect(mockFocusOn).not.toHaveBeenCalled()
  })

  it('does not call focusOn() when focusSystemIds is not provided', () => {
    render(<EveStarmap data={sampleData as any} />)

    expect(mockFocusOn).not.toHaveBeenCalled()
  })

  it('re-fits when focusSystemIds changes after mount', () => {
    const { rerender } = render(<EveStarmap data={sampleData as any} focusSystemIds={[1, 2]} />)
    mockFocusOn.mockClear()

    rerender(<EveStarmap data={sampleData as any} focusSystemIds={[4, 5]} />)

    expect(mockFocusOn).toHaveBeenCalledWith([4, 5])
  })

  it('derives focus ids from layers\' focusSystemIds when focusSystemIds prop is not given', () => {
    const layers = [{ id: 'heatmap', draw: vi.fn(), focusSystemIds: [10, 20] }]

    render(<EveStarmap data={sampleData as any} layers={layers} />)

    expect(mockFocusOn).toHaveBeenCalledWith([10, 20])
  })

  it('merges focusSystemIds declared across multiple layers', () => {
    const layers = [
      { id: 'a', draw: vi.fn(), focusSystemIds: [1] },
      { id: 'b', draw: vi.fn() }, // no focusSystemIds -- should be skipped, not throw
      { id: 'c', draw: vi.fn(), focusSystemIds: [2, 3] },
    ]

    render(<EveStarmap data={sampleData as any} layers={layers} />)

    expect(mockFocusOn).toHaveBeenCalledWith([1, 2, 3])
  })

  it('prefers an explicit focusSystemIds prop over ids derived from layers', () => {
    const layers = [{ id: 'heatmap', draw: vi.fn(), focusSystemIds: [10, 20] }]

    render(<EveStarmap data={sampleData as any} layers={layers} focusSystemIds={[99]} />)

    expect(mockFocusOn).toHaveBeenCalledWith([99])
  })

  it('does not call focusOn() when no layer declares focusSystemIds', () => {
    const layers = [{ id: 'plain', draw: vi.fn() }]

    render(<EveStarmap data={sampleData as any} layers={layers} />)

    expect(mockFocusOn).not.toHaveBeenCalled()
  })

  it('does not derive focus from layers when autoCenter is false', () => {
    const layers = [{ id: 'heatmap', draw: vi.fn(), focusSystemIds: [10, 20] }]

    render(<EveStarmap data={sampleData as any} layers={layers} autoCenter={false} />)

    expect(mockFocusOn).not.toHaveBeenCalled()
  })

  it('re-fits when layer-derived focus ids change after mount', () => {
    const layersA = [{ id: 'heatmap', draw: vi.fn(), focusSystemIds: [1, 2] }]
    const layersB = [{ id: 'heatmap', draw: vi.fn(), focusSystemIds: [3, 4] }]
    const { rerender } = render(<EveStarmap data={sampleData as any} layers={layersA} />)
    mockFocusOn.mockClear()

    rerender(<EveStarmap data={sampleData as any} layers={layersB} />)

    expect(mockFocusOn).toHaveBeenCalledWith([3, 4])
  })
})
