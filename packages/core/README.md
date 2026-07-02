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
