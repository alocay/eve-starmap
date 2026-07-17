# Route Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `routeLayer` that draws the jump route between two EVE systems, coloring each leg by a per-tier security gradient, plus a `fetchRoute` ESI helper and a bundled `security` field.

**Architecture:** Layers stay pure-draw (like `heatmapLayer`); network lives only in the opt-in async `fetchRoute`. Security status is bundled into `SystemNode` so leg coloring works offline. A small `securityColor` helper turns a raw sec value into a tier color; `routeLayer` strokes each leg with a canvas linear gradient between its two endpoints' tier colors.

**Tech Stack:** TypeScript, Canvas 2D, vitest, tsup. Package: `packages/core` (`eve-starmap`).

## Global Constraints

- Framework-agnostic core; no runtime fetch in the render/`draw` path; no API key.
- Follow existing file/test conventions: co-located `*.test.ts`, `.js` import extensions in TS source, `vi.fn()` mock ctx.
- New public API must be exported from `packages/core/src/index.ts`.
- `security` on `SystemNode` is OPTIONAL (back-compat with pre-existing fixtures, like `regions`).
- Commit after each task.

---

### Task 1: Bundle `security` on `SystemNode`

**Files:**
- Modify: `packages/core/src/types.ts` (SystemNode interface)
- Modify: `scripts/build-universe-data.js:145-152` (system map)
- Modify: `packages/core/src/data/defaultUniverseData.ts` (regenerated output)
- Test: `packages/core/src/dataValidation.test.ts` (new case) OR new `packages/core/src/data/defaultUniverseData.test.ts`

**Interfaces:**
- Produces: `SystemNode.security?: number` (raw, unrounded sec status).

- [ ] **Step 1: Add the field to the type**

In `packages/core/src/types.ts`, add to `SystemNode`:

```ts
export interface SystemNode {
  id: number
  name: string
  constellationId: number
  regionId: number
  x: number
  y: number
  // Raw (unrounded) security status, e.g. 0.4531. Optional so fixtures/callers
  // built before this field don't need updating (same rationale as regions).
  security?: number
}
```

- [ ] **Step 2: Emit `security` from the build script**

In `scripts/build-universe-data.js`, extend the systems `.map` (around line 145):

```js
  const systems = rawSystems
    .filter(s => s.position2D != null)
    .map(s => ({
      id: s._key,
      name: s.name.en,
      constellationId: s.constellationID,
      regionId: s.regionID,
      x: s.position2D.x,
      y: s.position2D.y,
      security: s.security,
    }))
```

Also update the schema comment block (lines 18-22) to list `security` as a used field.

Note: confirm the SDE field is named `security` by logging one record
(`console.log(rawSystems[0])`) on first run; the CCP SDE `mapSolarSystems`
table exposes the raw security status under `security`.

- [ ] **Step 3: Write the failing data test**

Create `packages/core/src/data/defaultUniverseData.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { defaultUniverseData } from './defaultUniverseData.js'

describe('defaultUniverseData security', () => {
  it('every system carries a numeric security status', () => {
    for (const s of defaultUniverseData.systems) {
      expect(typeof s.security).toBe('number')
    }
  })

  it('security values fall within EVE range [-1, 1]', () => {
    for (const s of defaultUniverseData.systems) {
      expect(s.security).toBeGreaterThanOrEqual(-1)
      expect(s.security).toBeLessThanOrEqual(1)
    }
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run packages/core/src/data/defaultUniverseData.test.ts`
Expected: FAIL — existing bundled systems have no `security`.

- [ ] **Step 5: Regenerate the bundled data**

Run: `node scripts/build-universe-data.js`
Expected: `packages/core/src/data/defaultUniverseData.ts` rewritten with a
`"security"` key on each system. (Requires network to reach the SDE mirror.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run packages/core/src/data/defaultUniverseData.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/types.ts scripts/build-universe-data.js \
  packages/core/src/data/defaultUniverseData.ts \
  packages/core/src/data/defaultUniverseData.test.ts
git commit -m "feat: bundle security status on SystemNode"
```

---

### Task 2: `securityColor` helper (sec → tier → color)

**Files:**
- Create: `packages/core/src/securityColor.ts`
- Test: `packages/core/src/securityColor.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `round1(sec: number): number`
  - `type SecurityColors = Record<string, string> | Map<number, string>`
  - `createSecurityColorLookup(colors: SecurityColors, fallback: string): (security: number | null | undefined) => string`
  - `const defaultSecurityColors: Record<string, string>` (EVE's tier palette; anything ≤ 0.0 shares the 0.0 color via negative-clamp)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/securityColor.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { round1, createSecurityColorLookup, defaultSecurityColors } from './securityColor.js'

const colors = {
  '1.0': '#f00', '0.9': '#e10', '0.8': '#d20', '0.7': '#c30',
  '0.6': '#b40', '0.5': '#a50', '0.4': '#960', '0.3': '#870',
  '0.2': '#780', '0.1': '#690', '0.0': '#5a0',
}

describe('round1', () => {
  it('rounds to nearest 0.1 tier', () => {
    expect(round1(0.47)).toBe(0.5)
    expect(round1(0.44)).toBe(0.4)
    expect(round1(0.05)).toBe(0.1)
  })
})

describe('createSecurityColorLookup', () => {
  it('maps a raw sec to its rounded tier color', () => {
    const lookup = createSecurityColorLookup(colors, '#000')
    expect(lookup(0.47)).toBe('#a50') // -> 0.5
    expect(lookup(0.44)).toBe('#960') // -> 0.4
  })

  it('accepts a Map with numeric keys', () => {
    const lookup = createSecurityColorLookup(new Map([[0.5, '#abc']]), '#000')
    expect(lookup(0.5)).toBe('#abc')
  })

  it('clamps negatives to the lowest provided tier', () => {
    const lookup = createSecurityColorLookup(colors, '#000')
    expect(lookup(-0.3)).toBe('#5a0') // lowest key is 0.0
  })

  it('clamps above the highest provided tier to that tier', () => {
    const lookup = createSecurityColorLookup({ '0.5': '#abc' }, '#000')
    expect(lookup(0.9)).toBe('#abc')
  })

  it('returns fallback for null/undefined security', () => {
    const lookup = createSecurityColorLookup(colors, '#000')
    expect(lookup(null)).toBe('#000')
    expect(lookup(undefined)).toBe('#000')
  })

  it('returns fallback for an in-range tier with no key', () => {
    const lookup = createSecurityColorLookup({ '1.0': '#fff', '0.0': '#000' }, '#999')
    expect(lookup(0.5)).toBe('#999') // 0.5 tier absent, within [0,1]
  })
})

describe('defaultSecurityColors', () => {
  it('covers tiers 1.0..0.0 and maps sub-zero sec to the 0.0 color', () => {
    const lookup = createSecurityColorLookup(defaultSecurityColors, '#000')
    expect(defaultSecurityColors['1.0']).toBe('#2c74e0')
    expect(lookup(0.5)).toBe('#f3fd82')
    expect(lookup(-0.5)).toBe(defaultSecurityColors['0.0']) // #8c3263, all lowsec/null share it
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/securityColor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/securityColor.ts`:

```ts
export type SecurityColors = Record<string, string> | Map<number, string>

// EVE's per-tier security colors (1.0 down to 0.0). Anything at or below 0.0
// resolves to the 0.0 color via the lookup's negative-clamp, so all low/null-sec
// legs share one color. Consumers can override with their own palette or a
// per-node color function on routeLayer.
export const defaultSecurityColors: Record<string, string> = {
  '1.0': '#2c74e0',
  '0.9': '#3999e9',
  '0.8': '#4dccf6',
  '0.7': '#60d9a3',
  '0.6': '#71e554',
  '0.5': '#f3fd82',
  '0.4': '#da6c07',
  '0.3': '#cc440f',
  '0.2': '#ba1117',
  '0.1': '#722020',
  '0.0': '#8c3263',
}

// Round a raw security status to its nearest 0.1 display tier (EVE UI convention).
export function round1(sec: number): number {
  return Math.round(sec * 10) / 10
}

function toEntries(colors: SecurityColors): Array<[number, string]> {
  const src = colors instanceof Map ? [...colors.entries()] : Object.entries(colors)
  return src.map(([k, v]) => [typeof k === 'number' ? k : parseFloat(k), v])
}

// Build a lookup: raw security -> tier color. Rounds to tier, clamps out-of-range
// values to the nearest provided tier, and returns `fallback` when security is
// null/undefined or the (in-range) tier has no color.
export function createSecurityColorLookup(
  colors: SecurityColors,
  fallback: string,
): (security: number | null | undefined) => string {
  const entries = toEntries(colors)
  const byTier = new Map(entries.map(([k, v]) => [k, v]))
  const tiers = entries.map(([k]) => k)
  const minTier = Math.min(...tiers)
  const maxTier = Math.max(...tiers)

  return function colorFor(security: number | null | undefined): string {
    if (security == null) return fallback
    const tier = round1(security)
    if (tier < minTier) return byTier.get(minTier) ?? fallback
    if (tier > maxTier) return byTier.get(maxTier) ?? fallback
    return byTier.get(tier) ?? fallback
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/securityColor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/securityColor.ts packages/core/src/securityColor.test.ts
git commit -m "feat: add security-to-tier-color lookup helper"
```

---

### Task 3: `fetchRoute` ESI helper

**Files:**
- Create: `packages/core/src/fetchRoute.ts`
- Test: `packages/core/src/fetchRoute.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type RouteFlag = 'shortest' | 'secure' | 'insecure'`
  - `interface FetchRouteOptions { flag?: RouteFlag; avoid?: number[]; connections?: [number, number][]; baseUrl?: string; fetch?: typeof fetch }`
  - `fetchRoute(origin: number, destination: number, options?: FetchRouteOptions): Promise<number[]>`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/fetchRoute.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { fetchRoute } from './fetchRoute.js'

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}

describe('fetchRoute', () => {
  it('calls the ESI route endpoint and returns the id array', async () => {
    const fetchMock = vi.fn(async () => okResponse([30000142, 30000144]))
    const ids = await fetchRoute(30000142, 30000144, { fetch: fetchMock as any })
    expect(ids).toEqual([30000142, 30000144])
    const url = (fetchMock.mock.calls[0][0] as string)
    expect(url).toContain('/route/30000142/30000144/')
    expect(url).toContain('https://esi.evetech.net/latest')
  })

  it('omits the flag param by default', async () => {
    const fetchMock = vi.fn(async () => okResponse([]))
    await fetchRoute(1, 2, { fetch: fetchMock as any })
    expect(fetchMock.mock.calls[0][0]).not.toContain('flag=')
  })

  it('includes flag, avoid and connections in the query', async () => {
    const fetchMock = vi.fn(async () => okResponse([]))
    await fetchRoute(1, 2, {
      flag: 'secure',
      avoid: [30000142, 30000157],
      connections: [[31000001, 31000002]],
      fetch: fetchMock as any,
    })
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('flag=secure')
    expect(url).toContain('avoid=30000142')
    expect(url).toContain('avoid=30000157')
    expect(url).toContain('connections=31000001%7C31000002') // 31000001|31000002 encoded
  })

  it('honors a custom baseUrl', async () => {
    const fetchMock = vi.fn(async () => okResponse([]))
    await fetchRoute(1, 2, { baseUrl: 'https://example.test/v1', fetch: fetchMock as any })
    expect(fetchMock.mock.calls[0][0]).toContain('https://example.test/v1/route/1/2/')
  })

  it('throws on a non-2xx response', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false, status: 404, text: async () => 'no route',
    } as Response))
    await expect(fetchRoute(1, 2, { fetch: fetchMock as any })).rejects.toThrow(/404/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/fetchRoute.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/fetchRoute.ts`:

```ts
export type RouteFlag = 'shortest' | 'secure' | 'insecure'

export interface FetchRouteOptions {
  flag?: RouteFlag
  avoid?: number[]
  connections?: [number, number][]
  baseUrl?: string
  fetch?: typeof fetch
}

const DEFAULT_BASE_URL = 'https://esi.evetech.net/latest'

// Fetch the ordered jump route (system ids, origin first) between two systems via
// EVE's public ESI /route endpoint. No auth required. Pure network -- feed the
// result to routeLayer.
export async function fetchRoute(
  origin: number,
  destination: number,
  options: FetchRouteOptions = {},
): Promise<number[]> {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  const doFetch = options.fetch ?? fetch

  const params = new URLSearchParams()
  if (options.flag) params.append('flag', options.flag)
  for (const id of options.avoid ?? []) params.append('avoid', String(id))
  for (const [a, b] of options.connections ?? []) params.append('connections', `${a}|${b}`)

  const query = params.toString()
  const url = `${baseUrl}/route/${origin}/${destination}/${query ? `?${query}` : ''}`

  const res = await doFetch(url)
  if (!res.ok) {
    let detail = ''
    try {
      detail = await res.text()
    } catch {
      /* ignore body read errors */
    }
    throw new Error(`fetchRoute failed: ${res.status}${detail ? ` ${detail}` : ''}`)
  }
  return (await res.json()) as number[]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/fetchRoute.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/fetchRoute.ts packages/core/src/fetchRoute.test.ts
git commit -m "feat: add fetchRoute ESI helper"
```

---

### Task 4: `routeLayer`

**Files:**
- Create: `packages/core/src/layers/routeLayer.ts`
- Test: `packages/core/src/layers/routeLayer.test.ts`

**Interfaces:**
- Consumes:
  - `createSecurityColorLookup`, `SecurityColors`, `defaultSecurityColors` from `../securityColor.js`
  - `worldToScreen` from `../viewport.js`
  - `Layer`, `SystemNode`, `UniverseData`, `Viewport` from `../types.js`
- Produces:
  - `type RouteColorFn = (system: SystemNode, security: number | undefined) => string`
  - `interface RouteLayerOptions { securityColors?: SecurityColors; colorForNode?: RouteColorFn; gradient?: boolean; lineWidth?: number; endpointMarkers?: boolean; missingColor?: string }`
  - `routeLayer(systemIds: number[], universeData: UniverseData, options?: RouteLayerOptions): Layer`

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/layers/routeLayer.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { routeLayer } from './routeLayer.js'
import type { UniverseData } from '../types.js'

function sys(id: number, x: number, y: number, security: number) {
  return { id, name: `S${id}`, constellationId: 1, regionId: 1, x, y, security }
}

function makeMockCtx() {
  const gradient = { addColorStop: vi.fn() }
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    strokeStyle: '' as any,
    fillStyle: '' as any,
    lineWidth: 0,
    _gradient: gradient,
  }
}

const viewport = { offsetX: 0, offsetY: 0, scale: 1, width: 100, height: 100 }
const colors = { '0.5': '#a50', '0.4': '#960', '0.0': '#5a0' }

const universe: UniverseData = {
  systems: [sys(1, 0, 0, 0.5), sys(2, 10, 0, 0.4), sys(3, 20, 0, 0.44)],
  stargates: [],
}

describe('routeLayer', () => {
  it('has id "route"', () => {
    expect(routeLayer([1, 2], universe, { securityColors: colors }).id).toBe('route')
  })

  it('exposes focusSystemIds equal to the route ids', () => {
    expect(routeLayer([1, 2, 3], universe, { securityColors: colors }).focusSystemIds).toEqual([1, 2, 3])
  })

  it('draws one gradient-stroked segment per leg', () => {
    const layer = routeLayer([1, 2, 3], universe, { securityColors: colors })
    const ctx = makeMockCtx()
    layer.draw(ctx as any, viewport, [])
    expect(ctx.createLinearGradient).toHaveBeenCalledTimes(2) // 3 ids -> 2 legs
    expect(ctx.stroke).toHaveBeenCalledTimes(2)
  })

  it('builds each leg gradient from the two endpoints tier colors', () => {
    const layer = routeLayer([1, 2], universe, { securityColors: colors })
    const ctx = makeMockCtx()
    layer.draw(ctx as any, viewport, [])
    expect(ctx._gradient.addColorStop).toHaveBeenCalledWith(0, '#a50') // sys1 0.5
    expect(ctx._gradient.addColorStop).toHaveBeenCalledWith(1, '#960') // sys2 0.4
  })

  it('breaks the polyline across a system missing from the data', () => {
    // id 99 not in universe -> legs 1-99 and 99-2 both skipped, only... none drawn
    const layer = routeLayer([1, 99, 2], universe, { securityColors: colors })
    const ctx = makeMockCtx()
    layer.draw(ctx as any, viewport, [])
    expect(ctx.stroke).not.toHaveBeenCalled()
  })

  it('draws endpoint markers by default and skips them when disabled', () => {
    const on = makeMockCtx()
    routeLayer([1, 2], universe, { securityColors: colors }).draw(on as any, viewport, [])
    expect(on.arc).toHaveBeenCalledTimes(2) // origin + destination

    const off = makeMockCtx()
    routeLayer([1, 2], universe, { securityColors: colors, endpointMarkers: false }).draw(off as any, viewport, [])
    expect(off.arc).not.toHaveBeenCalled()
  })

  it('draws only a marker for a single-system route', () => {
    const ctx = makeMockCtx()
    routeLayer([1], universe, { securityColors: colors }).draw(ctx as any, viewport, [])
    expect(ctx.stroke).not.toHaveBeenCalled()
    expect(ctx.arc).toHaveBeenCalledTimes(1)
  })

  it('draws nothing for an empty route', () => {
    const ctx = makeMockCtx()
    routeLayer([], universe, { securityColors: colors }).draw(ctx as any, viewport, [])
    expect(ctx.stroke).not.toHaveBeenCalled()
    expect(ctx.arc).not.toHaveBeenCalled()
  })

  it('defaults to the bundled palette when no options given', () => {
    const ctx = makeMockCtx()
    routeLayer([1, 2], universe).draw(ctx as any, viewport, [])
    // sys1 is 0.5 -> default 0.5 color #f3fd82
    expect(ctx._gradient.addColorStop).toHaveBeenCalledWith(0, '#f3fd82')
  })

  it('uses colorForNode override instead of the palette', () => {
    const colorForNode = vi.fn(() => '#123456')
    const ctx = makeMockCtx()
    routeLayer([1, 2], universe, { colorForNode }).draw(ctx as any, viewport, [])
    expect(colorForNode).toHaveBeenCalled()
    expect(ctx._gradient.addColorStop).toHaveBeenCalledWith(0, '#123456')
    expect(ctx._gradient.addColorStop).toHaveBeenCalledWith(1, '#123456')
  })

  it('with gradient:false strokes each leg solid in the start node color', () => {
    const ctx = makeMockCtx()
    const strokeColors: string[] = []
    // capture strokeStyle at each stroke() call
    ctx.stroke = vi.fn(() => { strokeColors.push(ctx.strokeStyle as string) })
    routeLayer([1, 2], universe, { securityColors: colors, gradient: false }).draw(ctx as any, viewport, [])
    expect(ctx.createLinearGradient).not.toHaveBeenCalled()
    expect(strokeColors).toEqual(['#a50']) // leg 1->2 solid = sys1 (0.5) color
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/layers/routeLayer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/layers/routeLayer.ts`:

```ts
import type { Layer, SystemNode, UniverseData, Viewport } from '../types.js'
import { worldToScreen } from '../viewport.js'
import {
  createSecurityColorLookup,
  defaultSecurityColors,
  type SecurityColors,
} from '../securityColor.js'

// Custom per-node color override. Receives the resolved system and its raw
// security (undefined when unknown); returns the color for that node. The layer
// still builds each leg's gradient from its two endpoints' returned colors.
export type RouteColorFn = (system: SystemNode, security: number | undefined) => string

export interface RouteLayerOptions {
  // Tier colors: keys are display tiers ("1.0".."0.0"; ≤0.0 shares the 0.0 color).
  // Defaults to the bundled defaultSecurityColors. Ignored when colorForNode is set.
  securityColors?: SecurityColors
  colorForNode?: RouteColorFn // overrides securityColors when provided
  gradient?: boolean          // blend each leg start->end color; default true.
                              // false = solid leg in the start node's color.
  lineWidth?: number          // default 2
  endpointMarkers?: boolean   // draw a dot at origin + destination, default true
  missingColor?: string       // used when a system's security is unknown, default '#888'
}

const DEFAULT_LINE_WIDTH = 2
const DEFAULT_MISSING_COLOR = '#888'
const ENDPOINT_RADIUS = 3

// Draws the jump route (ordered system ids) as a polyline, each leg a canvas linear
// gradient between its two endpoints' security-tier colors. Needs the full universe
// data (not the culled visibleSystems) because routes span beyond the viewport.
export function routeLayer(
  systemIds: number[],
  universeData: UniverseData,
  options: RouteLayerOptions = {},
): Layer {
  const byId = new Map<number, SystemNode>(universeData.systems.map(s => [s.id, s]))
  const lineWidth = options.lineWidth ?? DEFAULT_LINE_WIDTH
  const missingColor = options.missingColor ?? DEFAULT_MISSING_COLOR
  const showMarkers = options.endpointMarkers ?? true
  const useGradient = options.gradient ?? true
  const lookup = createSecurityColorLookup(options.securityColors ?? defaultSecurityColors, missingColor)
  const colorFor: RouteColorFn = options.colorForNode ?? ((s, sec) => lookup(sec))

  return {
    id: 'route',
    focusSystemIds: systemIds,
    draw(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
      const nodes = systemIds.map(id => byId.get(id))

      // Legs
      ctx.lineWidth = lineWidth
      for (let i = 0; i < nodes.length - 1; i++) {
        const a = nodes[i]
        const b = nodes[i + 1]
        if (!a || !b) continue // missing system -> break the polyline here

        const pa = worldToScreen(viewport, a.x, a.y)
        const pb = worldToScreen(viewport, b.x, b.y)
        if (useGradient) {
          const gradient = ctx.createLinearGradient(pa.x, pa.y, pb.x, pb.y)
          gradient.addColorStop(0, colorFor(a, a.security))
          gradient.addColorStop(1, colorFor(b, b.security))
          ctx.strokeStyle = gradient
        } else {
          // Solid leg: the start node's color runs the whole way to the next node.
          ctx.strokeStyle = colorFor(a, a.security)
        }
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(pb.x, pb.y)
        ctx.stroke()
      }

      // Endpoint markers (origin + destination)
      if (showMarkers && nodes.length > 0) {
        const endpoints = nodes.length === 1 ? [nodes[0]] : [nodes[0], nodes[nodes.length - 1]]
        for (const node of endpoints) {
          if (!node) continue
          const p = worldToScreen(viewport, node.x, node.y)
          ctx.fillStyle = colorFor(node, node.security)
          ctx.beginPath()
          ctx.arc(p.x, p.y, ENDPOINT_RADIUS, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/layers/routeLayer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/layers/routeLayer.ts packages/core/src/layers/routeLayer.test.ts
git commit -m "feat: add routeLayer with per-leg security gradients"
```

---

### Task 5: Exports, docs, and playground wiring

**Files:**
- Modify: `packages/core/src/index.ts`
- Modify: `README.md`, `packages/core/README.md`
- Modify: `playground/index.html` (+ its script)

**Interfaces:**
- Consumes: `fetchRoute`, `routeLayer`, and their types/`RouteFlag` from earlier tasks.
- Produces: public exports.

- [ ] **Step 1: Add exports**

In `packages/core/src/index.ts`, add:

```ts
export { fetchRoute } from './fetchRoute.js'
export type { RouteFlag, FetchRouteOptions } from './fetchRoute.js'
export { routeLayer } from './layers/routeLayer.js'
export type { RouteLayerOptions, RouteColorFn } from './layers/routeLayer.js'
export { createSecurityColorLookup, round1, defaultSecurityColors } from './securityColor.js'
export type { SecurityColors } from './securityColor.js'
```

- [ ] **Step 2: Verify the build type-checks**

Run: `npm run build`
Expected: PASS (tsup builds all packages, no type errors).

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS (all packages).

- [ ] **Step 4: Document in READMEs**

In root `README.md`, under "Layer system"/examples, and in `packages/core/README.md`
examples, add a route example (use exact API):

```js
import { StarmapRenderer, fetchRoute, routeLayer, defaultUniverseData } from 'eve-starmap'

const ids = await fetchRoute(30000142, 30002187, { flag: 'secure' })
const route = routeLayer(ids, defaultUniverseData) // uses bundled defaultSecurityColors
const renderer = new StarmapRenderer(canvas, defaultUniverseData, { layers: [route] })
renderer.focusOn(route.focusSystemIds)
renderer.draw()
```

Document that `securityColors` defaults to the bundled `defaultSecurityColors`,
that consumers can pass their own palette, and that `colorForNode: (system, sec)
=> string` overrides coloring per node. Note the new optional `SystemNode.security`
field where the data shape is documented.

- [ ] **Step 5: Wire the playground**

In `playground/index.html`, add origin + destination number inputs and a
"Show route" button. On click: `await fetchRoute(origin, dest)`, then set the
renderer's layers to `[routeLayer(ids, defaultUniverseData)]` (bundled
`defaultSecurityColors`), `focusOn(route.focusSystemIds)`, and redraw. Follow the
existing heatmap/region-label toggle wiring already in the file.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/index.ts README.md packages/core/README.md playground/index.html
git commit -m "feat: export route API, document and wire playground"
```

---

## Self-Review notes

- **Spec coverage:** data field (Task 1), fetchRoute (Task 3), routeLayer incl.
  gradient/off-screen/missing/single/empty (Task 4), sec→tier→color incl. rounding
  & negative clamp (Task 2), exports+docs+playground (Task 5). All spec sections mapped.
- **Type consistency:** `SecurityColors`, `createSecurityColorLookup`, `round1`,
  `RouteLayerOptions`, `FetchRouteOptions`, `RouteFlag`, `routeLayer`, `fetchRoute`
  names identical across producing/consuming tasks.
- **Open input:** consumer supplies real `securityColors`; README/playground use a
  demo palette until the user provides the final one.
- **Risk note:** ESI `avoid`/`connections` query format assumed (repeated params,
  `a|b` connection pairs). Tests lock this format; adjust in Task 3 if ESI rejects it.
