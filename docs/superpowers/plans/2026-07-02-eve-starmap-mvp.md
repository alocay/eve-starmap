# eve-starmap v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `eve-starmap`, a public npm monorepo with a framework-agnostic Canvas 2D renderer for EVE Online's 2D starmap (single constellation up to full galaxy) plus a thin React wrapper, shipping one plugin: a heatmap layer.

**Architecture:** npm workspaces monorepo. `packages/core` (framework-agnostic TypeScript): Canvas 2D renderer with viewport pan/zoom, quadtree-based hit-testing, viewport culling, LOD, a layer/plugin system, and bundled static universe data with a validated override path. `packages/react`: thin `<EveStarmap/>` wrapper delegating to `core`. See `docs/superpowers/specs/2026-07-02-eve-starmap-design.md` for full rationale.

**Tech Stack:** TypeScript 5, Vitest 3 (jsdom environment), tsup (build), npm workspaces, React 18 (peer dep of the react package only).

## Global Constraints

- Package manager: npm workspaces (`workspaces: ["packages/*"]` at repo root). Reference sibling workspace packages by `"*"` version range, not `workspace:` protocol (npm doesn't support the latter).
- Build tool: tsup per package, output ESM + CJS + `.d.ts`.
- Testing: Vitest, matching `sov-losses`' convention. Pure logic (math, validation, quadtree) is unit-tested directly. Canvas draw calls are tested via an injected mock `CanvasRenderingContext2D` object (assert calls made, not pixel output) — never install a native canvas package.
- Rendering: single Canvas 2D renderer for v1. No SVG, no WebGL.
- Perf target: 30fps sustained during full-galaxy pan/zoom. Verified by a standalone browser benchmark harness (Task 11), run manually — never part of `npm test` / CI.
- Data: `packages/core` ships a default bundled dataset (`UniverseData` shape: `{ systems: SystemNode[], stargates: StargateEdge[] }`). Consumers may override it with their own dataset of the same shape; `validateUniverseData` throws on a malformed override at construction time (fail fast).
- Layer system: v1 ships exactly one layer plugin, `heatmapLayer`. The layer interface itself is built generic (`{ id, draw(ctx, viewport, systems) }`) but no other layer types are implemented now.
- License: MIT.

---

### Task 1: Monorepo Scaffold

**Files:**
- Create: `package.json` (root)
- Create: `vitest.config.ts` (root)
- Create: `tsconfig.json` (root, editor-only reference, not built)
- Create: `.gitignore`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/react/package.json`
- Create: `packages/react/tsconfig.json`
- Create: `packages/react/tsup.config.ts`
- Create: `packages/react/src/index.ts`

**Interfaces:**
- Produces: an installable npm workspaces monorepo with two empty-but-buildable packages, `eve-starmap` (core) and `eve-starmap-react`. Later tasks fill in `packages/core/src/index.ts` and `packages/react/src/index.ts`.

- [ ] **Step 1: Create root `package.json`**

```json
{
  "name": "eve-starmap-monorepo",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.7.2",
    "vitest": "^3.1.0",
    "jsdom": "^26.1.0"
  }
}
```

- [ ] **Step 2: Create root `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['packages/*/src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
```

- [ ] **Step 3: Create root `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

- [ ] **Step 4: Create `.gitignore`**

```
node_modules
dist
*.log
```

- [ ] **Step 5: Create `packages/core/package.json`**

```json
{
  "name": "eve-starmap",
  "version": "0.0.1",
  "description": "Framework-agnostic Canvas 2D renderer for EVE Online's 2D starmap, with a pluggable layer system.",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup"
  },
  "devDependencies": {
    "tsup": "^8.3.5",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 6: Create `packages/core/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 7: Create `packages/core/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
})
```

- [ ] **Step 8: Create `packages/core/src/index.ts` (placeholder)**

```ts
export {}
```

- [ ] **Step 9: Create `packages/react/package.json`**

```json
{
  "name": "eve-starmap-react",
  "version": "0.0.1",
  "description": "React wrapper for eve-starmap.",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  },
  "dependencies": {
    "eve-starmap": "*"
  },
  "devDependencies": {
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.12",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 10: Create `packages/react/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 11: Create `packages/react/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom', 'eve-starmap'],
})
```

- [ ] **Step 12: Create `packages/react/src/index.ts` (placeholder)**

```ts
export {}
```

- [ ] **Step 13: Install dependencies**

Run: `npm install`
Expected: installs without error, creates root `package-lock.json`, `node_modules/eve-starmap` and `node_modules/eve-starmap-react` symlinked to the workspace packages.

- [ ] **Step 14: Commit**

```bash
git add package.json vitest.config.ts tsconfig.json .gitignore packages/core/package.json packages/core/tsconfig.json packages/core/tsup.config.ts packages/core/src/index.ts packages/react/package.json packages/react/tsconfig.json packages/react/tsup.config.ts packages/react/src/index.ts
git commit -m "chore: scaffold eve-starmap npm workspaces monorepo"
```

---

### Task 2: Core Types + Universe Data Validation

**Files:**
- Create: `packages/core/src/types.ts`
- Create: `packages/core/src/dataValidation.ts`
- Test: `packages/core/src/dataValidation.test.ts`

**Interfaces:**
- Produces: `SystemNode`, `StargateEdge`, `UniverseData`, `Viewport`, `Layer` types — consumed by every later core task. `validateUniverseData(data: unknown): UniverseData` — consumed by `StarmapRenderer` (Task 7).

- [ ] **Step 1: Create `packages/core/src/types.ts`**

```ts
export interface SystemNode {
  id: number
  name: string
  constellationId: number
  regionId: number
  x: number
  y: number
}

export interface StargateEdge {
  fromSystemId: number
  toSystemId: number
}

export interface UniverseData {
  systems: SystemNode[]
  stargates: StargateEdge[]
}

export interface Viewport {
  offsetX: number
  offsetY: number
  scale: number
  width: number
  height: number
}

export interface Layer {
  id: string
  draw(ctx: CanvasRenderingContext2D, viewport: Viewport, visibleSystems: SystemNode[]): void
}
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { validateUniverseData } from './dataValidation.js'

const validSystem = { id: 1, name: 'Alpha', constellationId: 10, regionId: 100, x: 0, y: 0 }
const validSystem2 = { id: 2, name: 'Beta', constellationId: 10, regionId: 100, x: 5, y: 5 }

describe('validateUniverseData', () => {
  it('returns the data unchanged when valid', () => {
    const data = { systems: [validSystem, validSystem2], stargates: [{ fromSystemId: 1, toSystemId: 2 }] }
    expect(validateUniverseData(data)).toEqual(data)
  })

  it('accepts an empty systems and stargates array', () => {
    const data = { systems: [], stargates: [] }
    expect(validateUniverseData(data)).toEqual(data)
  })

  it('throws when data is not an object', () => {
    expect(() => validateUniverseData(null)).toThrow('Invalid universe data: expected an object')
    expect(() => validateUniverseData('nope')).toThrow('Invalid universe data: expected an object')
  })

  it('throws when systems is not an array', () => {
    expect(() => validateUniverseData({ systems: 'nope', stargates: [] })).toThrow(
      'Invalid universe data: "systems" must be an array'
    )
  })

  it('throws when stargates is not an array', () => {
    expect(() => validateUniverseData({ systems: [], stargates: 'nope' })).toThrow(
      'Invalid universe data: "stargates" must be an array'
    )
  })

  it('throws when a system is missing required fields', () => {
    const data = { systems: [{ id: 1, name: 'Alpha' }], stargates: [] }
    expect(() => validateUniverseData(data)).toThrow(/missing required fields/)
  })

  it('throws when a stargate references an unknown system id', () => {
    const data = { systems: [validSystem], stargates: [{ fromSystemId: 1, toSystemId: 999 }] }
    expect(() => validateUniverseData(data)).toThrow('Invalid universe data: stargate references unknown system id')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run packages/core/src/dataValidation.test.ts`
Expected: FAIL — module `./dataValidation.js` doesn't exist yet.

- [ ] **Step 4: Write minimal implementation**

```ts
import type { UniverseData } from './types.js'

export function validateUniverseData(data: unknown): UniverseData {
  if (data == null || typeof data !== 'object') {
    throw new Error('Invalid universe data: expected an object')
  }
  const d = data as Record<string, unknown>

  if (!Array.isArray(d.systems)) {
    throw new Error('Invalid universe data: "systems" must be an array')
  }
  if (!Array.isArray(d.stargates)) {
    throw new Error('Invalid universe data: "stargates" must be an array')
  }

  for (const sys of d.systems) {
    if (typeof sys !== 'object' || sys === null) {
      throw new Error('Invalid universe data: each system must be an object')
    }
    const s = sys as Record<string, unknown>
    const valid =
      typeof s.id === 'number' &&
      typeof s.name === 'string' &&
      typeof s.constellationId === 'number' &&
      typeof s.regionId === 'number' &&
      typeof s.x === 'number' &&
      typeof s.y === 'number'
    if (!valid) {
      throw new Error(`Invalid universe data: system is missing required fields: ${JSON.stringify(sys)}`)
    }
  }

  const systemIds = new Set(d.systems.map((s: any) => s.id))
  for (const gate of d.stargates) {
    if (typeof gate !== 'object' || gate === null) {
      throw new Error('Invalid universe data: each stargate must be an object')
    }
    const g = gate as Record<string, unknown>
    if (typeof g.fromSystemId !== 'number' || typeof g.toSystemId !== 'number') {
      throw new Error(`Invalid universe data: stargate is missing required fields: ${JSON.stringify(gate)}`)
    }
    if (!systemIds.has(g.fromSystemId) || !systemIds.has(g.toSystemId)) {
      throw new Error('Invalid universe data: stargate references unknown system id')
    }
  }

  return data as UniverseData
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/core/src/dataValidation.test.ts`
Expected: PASS, 7 tests passing.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/dataValidation.js packages/core/src/dataValidation.ts packages/core/src/dataValidation.test.ts
git commit -m "feat(core): add universe data types and validation"
```

---

### Task 3: Viewport Math

**Files:**
- Create: `packages/core/src/viewport.ts`
- Test: `packages/core/src/viewport.test.ts`

**Interfaces:**
- Consumes: `Viewport` from `./types.js` (Task 2).
- Produces: `worldToScreen`, `screenToWorld`, `getVisibleWorldBounds`, `isPointInView`, `clampScale` — consumed by `heatmapLayer` (Task 6) and `StarmapRenderer` (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { worldToScreen, screenToWorld, getVisibleWorldBounds, isPointInView, clampScale } from './viewport.js'

const viewport = { offsetX: 0, offsetY: 0, scale: 2, width: 100, height: 100 }

describe('worldToScreen / screenToWorld', () => {
  it('maps world origin to the screen center', () => {
    expect(worldToScreen(viewport, 0, 0)).toEqual({ x: 50, y: 50 })
  })

  it('round-trips screenToWorld(worldToScreen(p)) back to p', () => {
    const screen = worldToScreen(viewport, 30, -15)
    expect(screenToWorld(viewport, screen.x, screen.y)).toEqual({ x: 30, y: -15 })
  })
})

describe('getVisibleWorldBounds', () => {
  it('computes bounds centered on the offset, sized by scale', () => {
    expect(getVisibleWorldBounds(viewport)).toEqual({ minX: -25, minY: -25, maxX: 25, maxY: 25 })
  })
})

describe('isPointInView', () => {
  it('returns true for a point within the visible bounds', () => {
    expect(isPointInView(viewport, 0, 0)).toBe(true)
  })

  it('returns false for a point outside the visible bounds', () => {
    expect(isPointInView(viewport, 1000, 1000)).toBe(false)
  })
})

describe('clampScale', () => {
  it('clamps below the minimum', () => {
    expect(clampScale(0)).toBe(0.01)
  })

  it('clamps above the maximum', () => {
    expect(clampScale(1000)).toBe(50)
  })

  it('passes through an in-range value', () => {
    expect(clampScale(2)).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/viewport.test.ts`
Expected: FAIL — module `./viewport.js` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/viewport.test.ts`
Expected: PASS, 8 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/viewport.ts packages/core/src/viewport.test.ts
git commit -m "feat(core): add viewport math (world/screen transforms, culling bounds)"
```

---

### Task 4: Quadtree Spatial Index

**Files:**
- Create: `packages/core/src/quadtree.ts`
- Test: `packages/core/src/quadtree.test.ts`

**Interfaces:**
- Consumes: `SystemNode` from `./types.js` (Task 2).
- Produces: `Quadtree` class with `insert(point)`, `queryRange(bounds)`, `findNearest(x, y, maxDistance)`; `buildQuadtree(systems, bounds)` helper — consumed by `StarmapRenderer` (Task 7).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { Quadtree, buildQuadtree } from './quadtree.js'

function sys(id: number, x: number, y: number) {
  return { id, name: `S${id}`, constellationId: 1, regionId: 1, x, y }
}

const worldBounds = { minX: -100, minY: -100, maxX: 100, maxY: 100 }

describe('Quadtree', () => {
  it('returns points within a queried range', () => {
    const qt = new Quadtree(worldBounds)
    qt.insert(sys(1, 0, 0))
    qt.insert(sys(2, 50, 50))
    qt.insert(sys(3, -50, -50))

    const found = qt.queryRange({ minX: -10, minY: -10, maxX: 10, maxY: 10 })

    expect(found.map(p => p.id)).toEqual([1])
  })

  it('finds the nearest point within maxDistance', () => {
    const qt = new Quadtree(worldBounds)
    qt.insert(sys(1, 0, 0))
    qt.insert(sys(2, 5, 0))

    const nearest = qt.findNearest(1, 0, 10)

    expect(nearest?.id).toBe(1)
  })

  it('returns null from findNearest when nothing is within maxDistance', () => {
    const qt = new Quadtree(worldBounds)
    qt.insert(sys(1, 90, 90))

    expect(qt.findNearest(0, 0, 5)).toBeNull()
  })

  it('subdivides correctly and still finds all points once a node exceeds capacity', () => {
    const qt = new Quadtree(worldBounds)
    const points = Array.from({ length: 50 }, (_, i) => sys(i, (i % 10) * 10 - 50, Math.floor(i / 10) * 10 - 50))
    for (const p of points) qt.insert(p)

    const found = qt.queryRange(worldBounds)

    expect(found.length).toBe(50)
  })

  it('ignores points inserted outside the tree bounds', () => {
    const qt = new Quadtree(worldBounds)
    qt.insert(sys(1, 9999, 9999))

    expect(qt.queryRange(worldBounds)).toEqual([])
  })
})

describe('buildQuadtree', () => {
  it('builds a queryable tree from a list of systems', () => {
    const systems = [sys(1, 0, 0), sys(2, 5, 5)]
    const qt = buildQuadtree(systems, worldBounds)

    expect(qt.queryRange(worldBounds).map(p => p.id).sort()).toEqual([1, 2])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/quadtree.test.ts`
Expected: FAIL — module `./quadtree.js` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { SystemNode } from './types.js'

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const MAX_POINTS_PER_NODE = 8
const MAX_DEPTH = 8

export class Quadtree {
  private bounds: Bounds
  private points: SystemNode[] = []
  private divided = false
  private depth: number
  private northeast?: Quadtree
  private northwest?: Quadtree
  private southeast?: Quadtree
  private southwest?: Quadtree

  constructor(bounds: Bounds, depth = 0) {
    this.bounds = bounds
    this.depth = depth
  }

  insert(point: SystemNode): void {
    if (!this.contains(this.bounds, point.x, point.y)) return

    if (this.points.length < MAX_POINTS_PER_NODE || this.depth >= MAX_DEPTH) {
      this.points.push(point)
      return
    }

    if (!this.divided) this.subdivide()
    this.northeast!.insert(point)
    this.northwest!.insert(point)
    this.southeast!.insert(point)
    this.southwest!.insert(point)
  }

  queryRange(range: Bounds): SystemNode[] {
    const found: SystemNode[] = []
    if (!this.intersects(this.bounds, range)) return found

    for (const p of this.points) {
      if (p.x >= range.minX && p.x <= range.maxX && p.y >= range.minY && p.y <= range.maxY) {
        found.push(p)
      }
    }

    if (this.divided) {
      found.push(...this.northeast!.queryRange(range))
      found.push(...this.northwest!.queryRange(range))
      found.push(...this.southeast!.queryRange(range))
      found.push(...this.southwest!.queryRange(range))
    }

    return found
  }

  findNearest(x: number, y: number, maxDistance: number): SystemNode | null {
    const candidates = this.queryRange({
      minX: x - maxDistance,
      minY: y - maxDistance,
      maxX: x + maxDistance,
      maxY: y + maxDistance,
    })

    let nearest: SystemNode | null = null
    let nearestDist = maxDistance
    for (const c of candidates) {
      const dist = Math.hypot(c.x - x, c.y - y)
      if (dist <= nearestDist) {
        nearest = c
        nearestDist = dist
      }
    }
    return nearest
  }

  private subdivide(): void {
    const { minX, minY, maxX, maxY } = this.bounds
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2

    this.northwest = new Quadtree({ minX, minY, maxX: midX, maxY: midY }, this.depth + 1)
    this.northeast = new Quadtree({ minX: midX, minY, maxX, maxY: midY }, this.depth + 1)
    this.southwest = new Quadtree({ minX, minY: midY, maxX: midX, maxY }, this.depth + 1)
    this.southeast = new Quadtree({ minX: midX, minY: midY, maxX, maxY }, this.depth + 1)
    this.divided = true

    const existing = this.points
    this.points = []
    for (const p of existing) {
      this.northeast.insert(p)
      this.northwest.insert(p)
      this.southeast.insert(p)
      this.southwest.insert(p)
    }
  }

  private contains(bounds: Bounds, x: number, y: number): boolean {
    return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY
  }

  private intersects(a: Bounds, b: Bounds): boolean {
    return !(b.minX > a.maxX || b.maxX < a.minX || b.minY > a.maxY || b.maxY < a.minY)
  }
}

export function buildQuadtree(systems: SystemNode[], bounds: Bounds): Quadtree {
  const qt = new Quadtree(bounds)
  for (const s of systems) qt.insert(s)
  return qt
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/quadtree.test.ts`
Expected: PASS, 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/quadtree.ts packages/core/src/quadtree.test.ts
git commit -m "feat(core): add quadtree spatial index for hit-testing and culling"
```

---

### Task 5: Color Scale

**Files:**
- Create: `packages/core/src/colorScale.ts`
- Test: `packages/core/src/colorScale.test.ts`

**Interfaces:**
- Produces: `ColorScaleOptions` type, `createColorScale(values: number[], options?: ColorScaleOptions): (value: number) => string` — consumed by `heatmapLayer` (Task 6).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { createColorScale } from './colorScale.js'

describe('createColorScale', () => {
  it('maps the minimum value to the start of the palette', () => {
    const colorFor = createColorScale([0, 100], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(0)).toBe('rgb(0, 0, 0)')
  })

  it('maps the maximum value to the end of the palette', () => {
    const colorFor = createColorScale([0, 100], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(100)).toBe('rgb(255, 255, 255)')
  })

  it('interpolates a midpoint value', () => {
    const colorFor = createColorScale([0, 100], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(50)).toBe('rgb(128, 128, 128)')
  })

  it('auto-detects min/max from the supplied values when not given explicitly', () => {
    const colorFor = createColorScale([10, 20, 30], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(10)).toBe('rgb(0, 0, 0)')
    expect(colorFor(30)).toBe('rgb(255, 255, 255)')
  })

  it('honors explicit min/max overrides', () => {
    const colorFor = createColorScale([10, 20, 30], { min: 0, max: 100, palette: ['#000000', '#ffffff'] })
    expect(colorFor(50)).toBe('rgb(128, 128, 128)')
  })

  it('clamps values outside the [min, max] range', () => {
    const colorFor = createColorScale([0, 100], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(-50)).toBe('rgb(0, 0, 0)')
    expect(colorFor(500)).toBe('rgb(255, 255, 255)')
  })

  it('returns the start color for every value when min equals max', () => {
    const colorFor = createColorScale([5], { palette: ['#000000', '#ffffff'] })
    expect(colorFor(5)).toBe('rgb(0, 0, 0)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/colorScale.test.ts`
Expected: FAIL — module `./colorScale.js` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface ColorScaleOptions {
  min?: number
  max?: number
  palette?: [string, string]
}

const DEFAULT_PALETTE: [string, string] = ['#1a1f27', '#ff5c33']

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function createColorScale(values: number[], options: ColorScaleOptions = {}): (value: number) => string {
  const min = options.min ?? Math.min(...values)
  const max = options.max ?? Math.max(...values)
  const [fromHex, toHex] = options.palette ?? DEFAULT_PALETTE
  const from = hexToRgb(fromHex)
  const to = hexToRgb(toHex)

  return function colorFor(value: number): string {
    const range = max - min
    const t = range === 0 ? 0 : Math.min(1, Math.max(0, (value - min) / range))
    const r = Math.round(lerp(from[0], to[0], t))
    const g = Math.round(lerp(from[1], to[1], t))
    const b = Math.round(lerp(from[2], to[2], t))
    return `rgb(${r}, ${g}, ${b})`
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/colorScale.test.ts`
Expected: PASS, 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/colorScale.ts packages/core/src/colorScale.test.ts
git commit -m "feat(core): add color scale for heatmap value-to-color mapping"
```

---

### Task 6: Heatmap Layer

**Files:**
- Create: `packages/core/src/layers/heatmapLayer.ts`
- Test: `packages/core/src/layers/heatmapLayer.test.ts`

**Interfaces:**
- Consumes: `Layer`, `SystemNode`, `Viewport` from `../types.js` (Task 2); `createColorScale`, `ColorScaleOptions` from `../colorScale.js` (Task 5); `worldToScreen` from `../viewport.js` (Task 3).
- Produces: `heatmapLayer(values: Map<number, number>, options?: HeatmapLayerOptions): Layer` — consumed by `packages/core/src/index.ts` (Task 8) and by any consumer's `layers` array.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { heatmapLayer } from './heatmapLayer.js'

function sys(id: number, x: number, y: number) {
  return { id, name: `S${id}`, constellationId: 1, regionId: 1, x, y }
}

function makeMockCtx() {
  return {
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillStyle: '',
  }
}

const viewport = { offsetX: 0, offsetY: 0, scale: 1, width: 100, height: 100 }

describe('heatmapLayer', () => {
  it('has id "heatmap"', () => {
    expect(heatmapLayer(new Map()).id).toBe('heatmap')
  })

  it('draws a filled circle for each system present in the value map', () => {
    const systems = [sys(1, 0, 0), sys(2, 10, 10)]
    const layer = heatmapLayer(new Map([[1, 100]]))
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, systems)

    expect(ctx.arc).toHaveBeenCalledTimes(1)
    expect(ctx.fill).toHaveBeenCalledTimes(1)
  })

  it('skips systems absent from the value map', () => {
    const systems = [sys(1, 0, 0)]
    const layer = heatmapLayer(new Map())
    const ctx = makeMockCtx()

    layer.draw(ctx as any, viewport, systems)

    expect(ctx.arc).not.toHaveBeenCalled()
  })

  it('assigns different fill colors for systems with different values', () => {
    const systems = [sys(1, 0, 0), sys(2, 10, 10)]
    const layer = heatmapLayer(new Map([[1, 0], [2, 100]]))
    const fillStyles: string[] = []
    const ctx = makeMockCtx()
    Object.defineProperty(ctx, 'fillStyle', {
      set(v) { fillStyles.push(v) },
      get() { return fillStyles[fillStyles.length - 1] },
    })

    layer.draw(ctx as any, viewport, systems)

    expect(fillStyles[0]).not.toBe(fillStyles[1])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/layers/heatmapLayer.test.ts`
Expected: FAIL — module `./heatmapLayer.js` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Layer, SystemNode, Viewport } from '../types.js'
import { createColorScale, type ColorScaleOptions } from '../colorScale.js'
import { worldToScreen } from '../viewport.js'

export interface HeatmapLayerOptions extends ColorScaleOptions {
  radius?: number
}

export function heatmapLayer(values: Map<number, number>, options: HeatmapLayerOptions = {}): Layer {
  const colorFor = createColorScale([...values.values()], options)
  const radius = options.radius ?? 4

  return {
    id: 'heatmap',
    draw(ctx: CanvasRenderingContext2D, viewport: Viewport, systems: SystemNode[]): void {
      for (const system of systems) {
        const value = values.get(system.id)
        if (value === undefined) continue

        const { x, y } = worldToScreen(viewport, system.x, system.y)
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fillStyle = colorFor(value)
        ctx.fill()
      }
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/layers/heatmapLayer.test.ts`
Expected: PASS, 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/layers/heatmapLayer.ts packages/core/src/layers/heatmapLayer.test.ts
git commit -m "feat(core): add heatmap layer plugin"
```

---

### Task 7: `StarmapRenderer` Core Class

**Files:**
- Create: `packages/core/src/renderer/StarmapRenderer.ts`
- Test: `packages/core/src/renderer/StarmapRenderer.test.ts`

**Interfaces:**
- Consumes: `UniverseData`, `Layer`, `SystemNode`, `Viewport` from `../types.js` (Task 2); `validateUniverseData` from `../dataValidation.js` (Task 2); `worldToScreen`, `screenToWorld`, `getVisibleWorldBounds`, `clampScale` from `../viewport.js` (Task 3); `Quadtree`, `buildQuadtree` from `../quadtree.js` (Task 4).
- Produces: `StarmapRenderer` class and `StarmapRendererOptions` type — consumed by `packages/core/src/index.ts` (Task 8) and `packages/react/src/EveStarmap.tsx` (Task 10).
- Public API: `new StarmapRenderer(canvas, data, options?)`, `.draw()`, `.setLayers(layers)`, `.getViewport()`, `.destroy()`.

**Design note:** pan is a pointer drag (pointerdown + pointermove + pointerup), zoom is the wheel event, hit-testing (click/hover) uses the quadtree with a fixed screen-space hit radius converted to world space via the current scale. LOD is a single scale threshold that toggles system name labels — not a discrete "mode," so the same draw loop serves both a single-constellation view and a full-galaxy view.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from 'vitest'
import { StarmapRenderer } from './StarmapRenderer.js'

function makeMockCtx() {
  return {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
  }
}

function makeMockCanvas(ctx: any) {
  const listeners: Record<string, (e: any) => void> = {}
  return {
    width: 100,
    height: 100,
    getContext: vi.fn(() => ctx),
    addEventListener: vi.fn((type: string, fn: any) => { listeners[type] = fn }),
    removeEventListener: vi.fn((type: string) => { delete listeners[type] }),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0 })),
    _listeners: listeners,
  }
}

const sampleData = {
  systems: [
    { id: 1, name: 'Alpha', constellationId: 1, regionId: 1, x: 0, y: 0 },
    { id: 2, name: 'Beta', constellationId: 1, regionId: 1, x: 100, y: 0 },
  ],
  stargates: [{ fromSystemId: 1, toSystemId: 2 }],
}

describe('StarmapRenderer', () => {
  it('throws if the canvas has no 2D context', () => {
    const canvas = makeMockCanvas(null)
    expect(() => new StarmapRenderer(canvas as any, sampleData)).toThrow('Canvas 2D context unavailable')
  })

  it('throws when constructed with malformed universe data', () => {
    const canvas = makeMockCanvas(makeMockCtx())
    expect(() => new StarmapRenderer(canvas as any, { systems: 'nope' } as any)).toThrow()
  })

  it('draw() clears the canvas and renders systems and stargates', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    renderer.draw()

    expect(ctx.clearRect).toHaveBeenCalled()
    expect(ctx.arc).toHaveBeenCalledTimes(2)
    expect(ctx.stroke).toHaveBeenCalledTimes(1)
  })

  it('draws layer output on top of the base map', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)
    const layerDraw = vi.fn()

    renderer.setLayers([{ id: 'test', draw: layerDraw }])

    expect(layerDraw).toHaveBeenCalled()
  })

  it('calls onSystemClick with the nearest system within the hit-test radius', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const onSystemClick = vi.fn()
    new StarmapRenderer(canvas as any, sampleData, { onSystemClick })

    canvas._listeners.click({ clientX: 50, clientY: 50 })

    expect(onSystemClick).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))
  })

  it('calls onSystemClick with null when no system is within the hit-test radius', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const onSystemClick = vi.fn()
    new StarmapRenderer(canvas as any, sampleData, { onSystemClick })

    canvas._listeners.click({ clientX: 5000, clientY: 5000 })

    expect(onSystemClick).toHaveBeenCalledWith(null)
  })

  it('pans the viewport on pointer drag', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    canvas._listeners.pointerdown({ clientX: 0, clientY: 0 })
    canvas._listeners.pointermove({ clientX: 10, clientY: 0 })

    expect(renderer.getViewport().offsetX).toBeLessThan(0)
  })

  it('zooms the viewport on wheel', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    canvas._listeners.wheel({ deltaY: -100, preventDefault: vi.fn() })

    expect(renderer.getViewport().scale).toBeGreaterThan(1)
  })

  it('removes all event listeners on destroy', () => {
    const ctx = makeMockCtx()
    const canvas = makeMockCanvas(ctx)
    const renderer = new StarmapRenderer(canvas as any, sampleData)

    renderer.destroy()

    expect(canvas.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    expect(canvas.removeEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function))
    expect(canvas.removeEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function))
    expect(canvas.removeEventListener).toHaveBeenCalledWith('wheel', expect.any(Function))
    expect(canvas.removeEventListener).toHaveBeenCalledWith('click', expect.any(Function))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/renderer/StarmapRenderer.test.ts`
Expected: FAIL — module `./StarmapRenderer.js` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { Layer, SystemNode, UniverseData, Viewport } from '../types.js'
import { validateUniverseData } from '../dataValidation.js'
import { worldToScreen, screenToWorld, getVisibleWorldBounds, clampScale } from '../viewport.js'
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/renderer/StarmapRenderer.test.ts`
Expected: PASS, 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/renderer/StarmapRenderer.ts packages/core/src/renderer/StarmapRenderer.test.ts
git commit -m "feat(core): add StarmapRenderer (pan/zoom, hit-testing, LOD, layers)"
```

---

### Task 8: Core Public API + Placeholder Default Data

**Files:**
- Create: `packages/core/src/data/defaultUniverseData.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `defaultUniverseData: UniverseData` (placeholder, see below) and the full public export surface of the `eve-starmap` package — consumed by `packages/react` (Task 10) and any external consumer.

**Important:** the data here is a **placeholder**, not real EVE Online universe data. Real data requires pulling from a live SDE mirror, which Task 9 automates via a script but must be run manually (network access, and the mirror's exact schema needs live verification — see Task 9's Step 1). Shipping synthetic placeholder coordinates now (clearly labeled) avoids baking in guessed-at real-world game data that could be wrong.

- [ ] **Step 1: Create `packages/core/src/data/defaultUniverseData.ts`**

```ts
// PLACEHOLDER data — not real EVE Online universe data.
// Replace by running `node scripts/build-universe-data.js` (see Task 9),
// which pulls real positions/topology from a live SDE mirror.
import type { UniverseData } from '../types.js'

export const defaultUniverseData: UniverseData = {
  systems: [
    { id: 1, name: 'Placeholder System A', constellationId: 1, regionId: 1, x: 0, y: 0 },
    { id: 2, name: 'Placeholder System B', constellationId: 1, regionId: 1, x: 50, y: 0 },
    { id: 3, name: 'Placeholder System C', constellationId: 1, regionId: 1, x: 25, y: 50 },
  ],
  stargates: [
    { fromSystemId: 1, toSystemId: 2 },
    { fromSystemId: 2, toSystemId: 3 },
    { fromSystemId: 3, toSystemId: 1 },
  ],
}
```

- [ ] **Step 2: Replace `packages/core/src/index.ts`**

```ts
export { StarmapRenderer } from './renderer/StarmapRenderer.js'
export type { StarmapRendererOptions } from './renderer/StarmapRenderer.js'
export { heatmapLayer } from './layers/heatmapLayer.js'
export type { HeatmapLayerOptions } from './layers/heatmapLayer.js'
export { validateUniverseData } from './dataValidation.js'
export { createColorScale } from './colorScale.js'
export type { ColorScaleOptions } from './colorScale.js'
export { defaultUniverseData } from './data/defaultUniverseData.js'
export type { UniverseData, SystemNode, StargateEdge, Layer, Viewport } from './types.js'
```

- [ ] **Step 3: Run the full core test suite**

Run: `npx vitest run packages/core`
Expected: PASS, all prior tests (Tasks 2-7) still passing.

- [ ] **Step 4: Build the core package**

Run: `npm run build -w eve-starmap`
Expected: succeeds, creates `packages/core/dist/index.js`, `packages/core/dist/index.cjs`, `packages/core/dist/index.d.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/data/defaultUniverseData.ts packages/core/src/index.ts
git commit -m "feat(core): wire up public API exports with placeholder default data"
```

---

### Task 9: Real Universe Data Build Script (manual, network-dependent)

**Files:**
- Create: `scripts/build-universe-data.js`

**Interfaces:**
- Produces: a Node script that overwrites `packages/core/src/data/defaultUniverseData.ts` with real EVE Online universe data. Not run automatically by any test or build — this is a manual maintenance step (see design spec's Data Layer section).

**Manual setup note (not automatable here):** this task's live data endpoint must be sanity-checked before finalizing the parser — SDE mirror formats/URLs can change and were not confirmed live during planning.

- [ ] **Step 1: Sanity-check the live SDE mirror before writing the parser**

Run from a terminal:
```bash
curl -s "https://sde.riftforeve.online/schema/mapSolarSystems/" | head -c 2000
```
Confirm the response is either the raw data (JSONL/JSON with per-system records) or a docs page linking to the actual data file. If it's a docs page, follow its link to the real data endpoint. Confirm the field names available for: system id, system name, constellation id, region id, and a 2D position (look specifically for a field distinct from the 3D `position` — EVE's SDE exposes both a 3D position and a 2D "projected"/schematic position used by the in-game 2D map). Repeat for `mapConstellations`, `mapRegions`, and `mapStargates`/`mapJumps` (stargate-to-stargate or system-to-system connections).

If the riftforeve.online mirror's shape differs from what's assumed in Step 2 below, or is unreachable, use the Fuzzwork SDE mirror instead (`https://www.fuzzwork.co.uk/dump/latest/` — CSV exports of the same `mapSolarSystems`/`mapConstellations`/`mapRegions`/`mapJumps` tables) and adjust the parsing logic in Step 2 to match CSV instead of JSONL.

- [ ] **Step 2: Write `scripts/build-universe-data.js`**

```js
// Regenerates packages/core/src/data/defaultUniverseData.ts from a live SDE mirror.
// Run manually: node scripts/build-universe-data.js
// Field names/endpoint confirmed per Task 9 Step 1 — adjust SOURCE_* constants
// and the parse functions below if the mirror's shape has changed since.

import { writeFileSync } from 'node:fs'

const SOURCE_SYSTEMS_URL = 'https://sde.riftforeve.online/schema/mapSolarSystems/'
const SOURCE_STARGATES_URL = 'https://sde.riftforeve.online/schema/mapStargates/'
const OUTPUT_PATH = new URL('../packages/core/src/data/defaultUniverseData.ts', import.meta.url)

async function fetchJsonl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const text = await res.text()
  return text
    .split('\n')
    .filter(line => line.trim().length > 0)
    .map(line => JSON.parse(line))
}

async function main() {
  const rawSystems = await fetchJsonl(SOURCE_SYSTEMS_URL)
  const rawStargates = await fetchJsonl(SOURCE_STARGATES_URL)

  const systems = rawSystems.map(s => ({
    id: s.solarSystemID,
    name: s.solarSystemName,
    constellationId: s.constellationID,
    regionId: s.regionID,
    x: s.projX ?? s.x,
    y: s.projY ?? s.y,
  }))

  const stargates = rawStargates.map(g => ({
    fromSystemId: g.solarSystemID,
    toSystemId: g.destinationID,
  }))

  const output = `// AUTO-GENERATED by scripts/build-universe-data.js. Do not edit by hand.
import type { UniverseData } from '../types.js'

export const defaultUniverseData: UniverseData = ${JSON.stringify({ systems, stargates }, null, 2)}
`

  writeFileSync(OUTPUT_PATH, output)
  console.log(`Wrote ${systems.length} systems and ${stargates.length} stargates to ${OUTPUT_PATH.pathname}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Run the script and verify output (manual, requires network)**

Run: `node scripts/build-universe-data.js`
Expected: prints a system/stargate count, overwrites `packages/core/src/data/defaultUniverseData.ts` with real data replacing the Task 8 placeholder. If the field names from Step 1 don't match what's hardcoded in Step 2's parse functions (`s.solarSystemID`, `s.projX`, etc.), fix the field mapping in Step 2 and re-run.

- [ ] **Step 4: Re-run the core test suite to confirm nothing broke**

Run: `npx vitest run packages/core`
Expected: PASS — no test depends on the specific contents of `defaultUniverseData.ts`, only its shape, which is unchanged.

- [ ] **Step 5: Commit**

```bash
git add scripts/build-universe-data.js packages/core/src/data/defaultUniverseData.ts
git commit -m "feat(core): add real universe data build script and regenerate default data"
```

---

### Task 10: React Wrapper

**Files:**
- Create: `packages/react/src/EveStarmap.tsx`
- Modify: `packages/react/src/index.ts`
- Test: `packages/react/src/EveStarmap.test.tsx`

**Interfaces:**
- Consumes: `StarmapRenderer`, `UniverseData`, `Layer`, `SystemNode` from `eve-starmap` (Tasks 7-8).
- Produces: `EveStarmap` React component, `EveStarmapProps` type — public API of `eve-starmap-react`.

- [ ] **Step 1: Write the failing test**

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/react/src/EveStarmap.test.tsx`
Expected: FAIL — module `./EveStarmap.js` doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useEffect, useRef } from 'react'
import { StarmapRenderer } from 'eve-starmap'
import type { UniverseData, Layer, SystemNode } from 'eve-starmap'

export interface EveStarmapProps {
  data: UniverseData
  layers?: Layer[]
  onSystemClick?: (system: SystemNode | null) => void
  onSystemHover?: (system: SystemNode | null) => void
  width?: number
  height?: number
}

export function EveStarmap({
  data,
  layers,
  onSystemClick,
  onSystemHover,
  width = 800,
  height = 600,
}: EveStarmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<StarmapRenderer | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const renderer = new StarmapRenderer(canvasRef.current, data, { layers, onSystemClick, onSystemHover })
    rendererRef.current = renderer
    renderer.draw()

    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  useEffect(() => {
    if (rendererRef.current && layers) {
      rendererRef.current.setLayers(layers)
    }
  }, [layers])

  return <canvas ref={canvasRef} width={width} height={height} />
}
```

- [ ] **Step 4: Replace `packages/react/src/index.ts`**

```ts
export { EveStarmap } from './EveStarmap.js'
export type { EveStarmapProps } from './EveStarmap.js'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/react/src/EveStarmap.test.tsx`
Expected: PASS, 4 tests passing.

- [ ] **Step 6: Build the react package**

Run: `npm run build -w eve-starmap-react`
Expected: succeeds, creates `packages/react/dist/index.js`, `packages/react/dist/index.cjs`, `packages/react/dist/index.d.ts`.

- [ ] **Step 7: Commit**

```bash
git add packages/react/src/EveStarmap.tsx packages/react/src/index.ts packages/react/src/EveStarmap.test.tsx
git commit -m "feat(react): add EveStarmap component wrapping StarmapRenderer"
```

---

### Task 11: Perf Benchmark Harness (manual, browser-based)

**Files:**
- Create: `benchmark/index.html`
- Create: `benchmark/run.js`

**Interfaces:**
- Produces: a static HTML+JS page (not part of any test suite) that renders the full-galaxy dataset with simulated continuous pan/zoom and displays a live average-FPS readout, for manually validating the 30fps target from the design spec.

- [ ] **Step 1: Create `benchmark/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>eve-starmap perf benchmark</title>
    <style>
      body { margin: 0; background: #0a0e14; color: #c8d0da; font-family: monospace; }
      #fps { position: fixed; top: 8px; left: 8px; font-size: 20px; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <div id="fps">FPS: --</div>
    <canvas id="map" width="1600" height="1000"></canvas>
    <script type="module" src="./run.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `benchmark/run.js`**

```js
import { StarmapRenderer, defaultUniverseData } from '../packages/core/dist/index.js'

const canvas = document.getElementById('map')
const fpsEl = document.getElementById('fps')

const renderer = new StarmapRenderer(canvas, defaultUniverseData, {
  initialViewport: { scale: 0.1 },
})

let frameCount = 0
let lastFpsUpdate = performance.now()
let angle = 0

function tick(now) {
  angle += 0.01
  const viewport = renderer.getViewport()
  viewport.offsetX = Math.cos(angle) * 200
  viewport.offsetY = Math.sin(angle) * 200
  viewport.scale = 0.1 + Math.abs(Math.sin(angle * 0.3)) * 0.4

  renderer.draw()

  frameCount++
  if (now - lastFpsUpdate >= 1000) {
    fpsEl.textContent = `FPS: ${frameCount}`
    frameCount = 0
    lastFpsUpdate = now
  }

  requestAnimationFrame(tick)
}

requestAnimationFrame(tick)
```

- [ ] **Step 3: Run the benchmark manually**

Prerequisite: `packages/core/dist/index.js` must exist (`npm run build -w eve-starmap`) and `packages/core/src/data/defaultUniverseData.ts` should hold real data (Task 9), not the Task 8 placeholder, for a representative full-galaxy measurement.

Run: `npx serve benchmark` (or any static file server) and open the printed URL in a browser.
Expected: the FPS readout updates every second. Confirm it holds at or above 30fps target from the design spec during the simulated pan/zoom. If it does not, note this as the trigger for the design's documented WebGL fallback path — do not attempt a WebGL implementation as part of this plan.

- [ ] **Step 4: Commit**

```bash
git add benchmark/index.html benchmark/run.js
git commit -m "chore: add manual perf benchmark harness for full-galaxy pan/zoom"
```

---

### Task 12: Root README + Final Verification

**Files:**
- Create: `README.md`
- Create: `packages/core/README.md`
- Create: `packages/react/README.md`

**Interfaces:**
- Produces: top-level documentation for the monorepo and per-package usage docs. No code interfaces — final task before the package is usable/publishable.

- [ ] **Step 1: Create `packages/core/README.md`**

```markdown
# eve-starmap

Framework-agnostic Canvas 2D renderer for EVE Online's 2D starmap — from a single constellation up to the full galaxy — with a pluggable layer system.

## Install

npm install eve-starmap

## Usage

import { StarmapRenderer, heatmapLayer, defaultUniverseData } from 'eve-starmap'

const canvas = document.querySelector('canvas')
const renderer = new StarmapRenderer(canvas, defaultUniverseData, {
  layers: [heatmapLayer(new Map([[30000142, 1_500_000_000]]))],
  onSystemClick: (system) => console.log(system),
})
renderer.draw()

## Custom data

Pass your own `UniverseData` (`{ systems: SystemNode[], stargates: StargateEdge[] }`) instead of `defaultUniverseData` to use a different or fresher dataset. Invalid data throws at construction time.

## License

MIT
```

- [ ] **Step 2: Create `packages/react/README.md`**

```markdown
# eve-starmap-react

React wrapper for [eve-starmap](https://www.npmjs.com/package/eve-starmap).

## Install

npm install eve-starmap-react eve-starmap react

## Usage

import { EveStarmap } from 'eve-starmap-react'
import { heatmapLayer, defaultUniverseData } from 'eve-starmap'

function App() {
  return (
    <EveStarmap
      data={defaultUniverseData}
      layers={[heatmapLayer(new Map([[30000142, 1_500_000_000]]))]}
      onSystemClick={(system) => console.log(system)}
    />
  )
}

## License

MIT
```

- [ ] **Step 3: Create root `README.md`**

```markdown
# eve-starmap

Monorepo for `eve-starmap` (framework-agnostic Canvas 2D EVE Online starmap renderer) and `eve-starmap-react` (React wrapper).

- `packages/core` — see [packages/core/README.md](packages/core/README.md)
- `packages/react` — see [packages/react/README.md](packages/react/README.md)

## Development

npm install
npm test
npm run build

## Regenerating universe data

The bundled default dataset ships as a placeholder until `node scripts/build-universe-data.js` is run against a live SDE mirror — see `docs/superpowers/specs/2026-07-02-eve-starmap-design.md` and Task 9 of `docs/superpowers/plans/2026-07-02-eve-starmap-mvp.md` for details.

## License

MIT
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — every test from Tasks 2-7 and Task 10 passes (32 tests total: 7 + 8 + 6 + 7 + 4 + 9 + 4).

- [ ] **Step 5: Run the full build**

Run: `npm run build`
Expected: both `packages/core/dist` and `packages/react/dist` build successfully with no errors.

- [ ] **Step 6: Commit**

```bash
git add README.md packages/core/README.md packages/react/README.md
git commit -m "docs: add root and per-package READMEs"
```
