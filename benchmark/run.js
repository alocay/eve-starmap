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
