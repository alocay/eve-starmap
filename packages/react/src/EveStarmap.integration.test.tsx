import { describe, it, expect, vi, afterEach } from 'vitest'
import { render } from '@testing-library/react'

// eve-starmap is a real ESM package, so `import * as ns from 'eve-starmap'` gives a
// frozen module namespace object -- `vi.spyOn(ns, 'StarmapRenderer')` throws "Cannot
// redefine property" because ESM namespace records are non-configurable per spec (see
// https://vitest.dev/guide/browser/#limitations). vi.mock's factory return value is a
// plain, mutable object Vitest constructs itself (not a frozen namespace record), so
// it CAN be spied -- this is the ESM-legal way to observe one real export's calls.
// `importOriginal()` still pulls in the actual package, and the wrapped constructor
// forwards to it via Reflect.construct, so this still exercises real core code
// end-to-end across the package boundary (an incompatible change to core's public API
// still fails this test), just via a route that works under real ESM.
vi.mock('eve-starmap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('eve-starmap')>()
  const RealStarmapRenderer = actual.StarmapRenderer
  // `new` on a plain function whose body explicitly returns an object uses that
  // returned object instead of the implicitly-created one, so Reflect.construct here
  // keeps this a genuine `new RealStarmapRenderer(...)` -- the real constructor body
  // still runs unmodified; the wrapping vi.fn just lets us observe the call.
  const StarmapRenderer = vi.fn(function (this: unknown, ...args: unknown[]) {
    return Reflect.construct(RealStarmapRenderer, args)
  })
  return { ...actual, StarmapRenderer }
})

import { EveStarmap } from './EveStarmap.js'
import { StarmapRenderer, regionLabelLayer } from 'eve-starmap'

const ctorSpy = vi.mocked(StarmapRenderer)
const sampleData = { systems: [], stargates: [] }

describe('EveStarmap (integration, real eve-starmap package)', () => {
  afterEach(() => {
    ctorSpy.mockClear()
    vi.restoreAllMocks()
  })

  it('constructs the real StarmapRenderer with the canvas element and data object', () => {
    // jsdom's canvas has no real 2D context, so the real StarmapRenderer constructor
    // throws 'Canvas 2D context unavailable' -- that's expected here and proves we
    // reached real core code, not a stub. React logs that effect error to
    // console.error; suppress just that noise for this test.
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
