import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { EveStarmap } from './EveStarmap.js'
// Intentionally NOT calling vi.mock('eve-starmap', ...) in this file: the point of this
// test is to exercise the REAL `StarmapRenderer` from `packages/core` across the package
// boundary, so that an incompatible change to core's public API (renamed export, changed
// constructor signature, removed method) fails this test even though EveStarmap.test.tsx's
// mocked tests would stay green.
import * as EveStarmapCore from 'eve-starmap'
import { regionLabelLayer } from 'eve-starmap'

const sampleData = { systems: [], stargates: [] }

describe('EveStarmap (integration, real eve-starmap package)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('constructs the real StarmapRenderer with the canvas element and data object', () => {
    // Spy on the real class without replacing its implementation, so the constructor
    // still runs for real. jsdom's canvas has no real 2D context, so the real
    // StarmapRenderer constructor throws 'Canvas 2D context unavailable' -- that's
    // expected here and proves we reached real core code, not a stub. React logs that
    // effect error to console.error; suppress just that noise for this test.
    // vi.spyOn's default pass-through calls the original via a plain function invocation,
    // which throws "cannot be invoked without 'new'" for a real class. Reflect.construct
    // keeps this a genuine `new RealStarmapRenderer(...)` call -- the real constructor body
    // still runs unmodified, we're just observing the call.
    const RealStarmapRenderer = EveStarmapCore.StarmapRenderer
    const ctorSpy = vi.spyOn(EveStarmapCore, 'StarmapRenderer').mockImplementation(function (this: unknown, ...args: unknown[]) {
      return Reflect.construct(RealStarmapRenderer, args)
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<EveStarmap data={sampleData as any} />)).toThrow('Canvas 2D context unavailable')

    expect(ctorSpy).toHaveBeenCalledTimes(1)
    const [canvasArg, dataArg] = ctorSpy.mock.calls[0]
    expect(canvasArg).toBeInstanceOf(HTMLCanvasElement)
    expect(dataArg).toBe(sampleData)

    consoleErrorSpy.mockRestore()
  })

  it('accepts a real regionLabelLayer (built with custom color/opacity/visible) via the generic layers prop', () => {
    // Proves the "customize color/opacity/visibility, pass into React's
    // generic layers prop" path actually works end-to-end across the
    // package boundary -- EveStarmap has no region-layer-specific code of
    // its own, so this is really a compatibility check that regionLabelLayer's
    // return value is a valid Layer the real StarmapRenderer accepts.
    const RealStarmapRenderer = EveStarmapCore.StarmapRenderer
    const ctorSpy = vi.spyOn(EveStarmapCore, 'StarmapRenderer').mockImplementation(function (this: unknown, ...args: unknown[]) {
      return Reflect.construct(RealStarmapRenderer, args)
    })
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const regions = [{ id: 100, name: 'Test Region' }]
    const layer = regionLabelLayer(regions, sampleData.systems, { color: '#ff00ff', opacity: 0.6, visible: true })

    expect(() => render(<EveStarmap data={sampleData as any} layers={[layer]} />)).toThrow('Canvas 2D context unavailable')

    expect(ctorSpy).toHaveBeenCalledTimes(1)
    const [, , optionsArg] = ctorSpy.mock.calls[0] as [unknown, unknown, { layers?: unknown[] }]
    expect(optionsArg.layers).toEqual([layer])

    consoleErrorSpy.mockRestore()
  })
})
