# eve-starmap

A reusable, framework-agnostic library for rendering EVE Online's 2D starmap — from a single constellation up to the full galaxy — with a pluggable layer system (heatmaps, and more to come). Canvas 2D renderer, viewport culling + quadtree hit-testing, pan/zoom, real bundled EVE data (no API key, no runtime fetch).

- `packages/core` (`eve-starmap`) — the renderer, layer system, bundled data. Framework-agnostic.
- `packages/react` (`eve-starmap-react`) — thin `<EveStarmap/>` wrapper.

## Usage

```js
import { StarmapRenderer, heatmapLayer, defaultUniverseData } from 'eve-starmap'

const renderer = new StarmapRenderer(canvas, defaultUniverseData, {
  layers: [heatmapLayer(new Map([[30000142, 1_500_000_000]]))],
  onSystemClick: (system) => console.log(system),
})
renderer.draw()
```

React: see [packages/react/README.md](packages/react/README.md). Full core API: see [packages/core/README.md](packages/core/README.md).

## Development

```bash
npm install
npm test          # vitest, all packages
npm run build      # tsup, all packages
```

## Manual tools

- **Playground** (`playground/`) — interactive hands-on testing: real pan/zoom/click/hover, system search, heatmap toggle. Serve from repo root (e.g. `npx serve .`) and open `/playground/index.html`.
- **Perf benchmark** (`benchmark/`) — simulated full-galaxy pan/zoom with a live FPS readout, for checking the 30fps target. Same serving approach, open `/benchmark/index.html`.
- **Regenerating bundled data** — `node scripts/build-universe-data.js` refreshes `packages/core/src/data/defaultUniverseData.ts` from a live SDE mirror. Real data is already bundled; only needed to pick up a newer SDE release.

## Possible future additions

- More layer types (route lines, custom markers, jump-range overlays)
- WebGL renderer, if Canvas 2D doesn't hold the perf target at full-galaxy scale
- Wrappers for other frameworks (Vue, Svelte)

## License

MIT
