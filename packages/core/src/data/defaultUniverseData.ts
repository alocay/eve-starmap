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
