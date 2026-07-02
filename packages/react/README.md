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
