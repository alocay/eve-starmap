import { StarmapRenderer, defaultUniverseData } from '../packages/core/dist/index.js'

const canvas = document.getElementById('map')
const fpsEl = document.getElementById('fps')

const renderer = new StarmapRenderer(canvas, defaultUniverseData, {
  initialViewport: { scale: 0.1 },
})

let frameCount = 0
let lastFpsUpdate = performance.now()
let angle = 0
let lastPanX = canvas.width / 2
let lastPanY = canvas.height / 2

function dispatchZoom(deltaY) {
  canvas.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }))
}

function dispatchPanStep(clientX, clientY) {
  canvas.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, bubbles: true }))
}

// Start a synthetic drag once, so subsequent pointermove events are treated as panning
canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: lastPanX, clientY: lastPanY, bubbles: true }))

function tick(now) {
  angle += 0.01

  // Pan: move the synthetic pointer in a circular path. StarmapRenderer's
  // pointermove handler computes delta from the previous pointer position,
  // so each call pans incrementally.
  const nextPanX = canvas.width / 2 + Math.cos(angle) * 200
  const nextPanY = canvas.height / 2 + Math.sin(angle) * 200
  dispatchPanStep(nextPanX, nextPanY)

  // Zoom: alternate wheel direction to oscillate scale up/down.
  dispatchZoom(Math.sin(angle * 0.3) > 0 ? -10 : 10)

  frameCount++
  if (now - lastFpsUpdate >= 1000) {
    fpsEl.textContent = `FPS: ${frameCount}`
    frameCount = 0
    lastFpsUpdate = now
  }

  requestAnimationFrame(tick)
}

requestAnimationFrame(tick)
