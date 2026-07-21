import {
  StarmapRenderer,
  heatmapLayer,
  regionLabelLayer,
  fetchRoute,
  routeLayer,
  defaultUniverseData,
} from '../packages/core/dist/index.js'

const canvas = document.getElementById('map')
const hoveredEl = document.getElementById('hovered')
const clickedEl = document.getElementById('clicked')
const toggleBtn = document.getElementById('toggle-heatmap')
const toggleRegionsBtn = document.getElementById('toggle-regions')
const searchInput = document.getElementById('search-input')
const suggestionsEl = document.getElementById('suggestions')
const tooltipEl = document.getElementById('tooltip')
const routeOriginInput = document.getElementById('route-origin')
const routeDestinationInput = document.getElementById('route-destination')
const routeShowBtn = document.getElementById('route-show')
const routeStatusEl = document.getElementById('route-status')

function computeBounds(systems) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of systems) {
    minX = Math.min(minX, s.x)
    maxX = Math.max(maxX, s.x)
    minY = Math.min(minY, s.y)
    maxY = Math.max(maxY, s.y)
  }
  return { minX, minY, maxX, maxY }
}

// Real EVE SDE coordinates span roughly 1e18 units galaxy-wide, so the
// initial view must be centered on the data and scaled to fit it -- a
// hardcoded small offset/scale (fine for toy test fixtures) leaves the
// whole galaxy off-canvas.
const bounds = computeBounds(defaultUniverseData.systems)
const dataWidth = bounds.maxX - bounds.minX
const dataHeight = bounds.maxY - bounds.minY
const fitScale = Math.min(canvas.width / dataWidth, canvas.height / dataHeight) * 0.9

// Demo heatmap: assign a random ISK-like value to a sample of systems, so
// the layer toggle has something visible to show.
function buildDemoHeatmap(systems, count) {
  const shuffled = [...systems].sort(() => Math.random() - 0.5)
  const values = new Map()
  for (const system of shuffled.slice(0, count)) {
    values.set(system.id, Math.random() * 5_000_000_000)
  }
  return values
}

const demoHeatmapLayer = heatmapLayer(buildDemoHeatmap(defaultUniverseData.systems, 200), { radius: 5 })
const demoRegionLabelLayer = regionLabelLayer(defaultUniverseData.regions ?? [], defaultUniverseData.systems)
let heatmapOn = false
let regionsOn = false
let highlightedSystemId = null

// Draws a ring around the searched system, using the same public Layer
// contract as heatmapLayer -- no core changes needed for this.
const highlightLayer = {
  id: 'highlight',
  draw(ctx, viewport, systems) {
    if (highlightedSystemId == null) return
    const system = systems.find(s => s.id === highlightedSystemId)
    if (!system) return
    // Mirrors worldToScreen's transform (screen y is inverted relative to
    // world y so the map matches the in-game orientation).
    const x = (system.x - viewport.offsetX) * viewport.scale + viewport.width / 2
    const y = viewport.height / 2 - (system.y - viewport.offsetY) * viewport.scale
    ctx.beginPath()
    ctx.arc(x, y, 10, 0, Math.PI * 2)
    ctx.strokeStyle = '#ff5c33'
    ctx.lineWidth = 2
    ctx.stroke()
  },
}

function updateLayers() {
  const layers = [highlightLayer]
  if (regionsOn) layers.push(demoRegionLabelLayer)
  if (heatmapOn) layers.push(demoHeatmapLayer)
  renderer.setLayers(layers)
}

// Screen position (viewport-relative, not page-relative) of a system's
// node, using the same world->screen transform the renderer's own draw
// loop and layers use.
function screenPosFor(system) {
  const v = renderer.getViewport()
  const rect = canvas.getBoundingClientRect()
  return {
    x: rect.left + (system.x - v.offsetX) * v.scale + v.width / 2,
    y: rect.top + v.height / 2 - (system.y - v.offsetY) * v.scale,
  }
}

function hideTooltip() {
  tooltipEl.hidden = true
}

const renderer = new StarmapRenderer(canvas, defaultUniverseData, {
  layers: [highlightLayer],
  // Dimmer than the '#c8d0da' default -- at full brightness, dense clusters
  // read as a glowing blob with no depth and compete with anything drawn on
  // top of them (region labels included).
  systemDotColor: '#8a99aa',
  initialViewport: {
    scale: fitScale,
    offsetX: (bounds.minX + bounds.maxX) / 2,
    offsetY: (bounds.minY + bounds.maxY) / 2,
  },
  onSystemHover(system) {
    hoveredEl.textContent = system ? system.name : '—'
    if (!system) {
      hideTooltip()
      return
    }
    const pos = screenPosFor(system)
    tooltipEl.textContent = system.name
    tooltipEl.style.left = `${pos.x}px`
    tooltipEl.style.top = `${pos.y}px`
    tooltipEl.hidden = false
  },
  onSystemClick(system) {
    clickedEl.textContent = system ? `${system.name} (id ${system.id})` : '—'
  },
})

// The tooltip's screen position is only recomputed on hover; pan/zoom would
// leave it stuck at a stale spot until the next hover event, so drop it as
// soon as the view starts changing.
canvas.addEventListener('pointerdown', hideTooltip)
canvas.addEventListener('wheel', hideTooltip)

renderer.draw()

toggleBtn.addEventListener('click', () => {
  heatmapOn = !heatmapOn
  updateLayers()
  toggleBtn.textContent = heatmapOn ? 'Hide heatmap layer' : 'Toggle heatmap layer'
})

toggleRegionsBtn.addEventListener('click', () => {
  regionsOn = !regionsOn
  updateLayers()
  toggleRegionsBtn.textContent = regionsOn ? 'Hide region labels' : 'Toggle region labels'
})

// Route lookup: fetches a live route from ESI, then swaps the renderer over to
// just the route layer (bundled defaultSecurityColors) and fits the view to it --
// a manual way to exercise fetchRoute + routeLayer end-to-end against real data.
routeShowBtn.addEventListener('click', async () => {
  const origin = Number(routeOriginInput.value)
  const destination = Number(routeDestinationInput.value)
  if (!Number.isFinite(origin) || !Number.isFinite(destination)) {
    routeStatusEl.textContent = 'Enter both system ids.'
    return
  }

  routeStatusEl.textContent = 'Loading route...'
  routeShowBtn.disabled = true
  try {
    const ids = await fetchRoute(origin, destination)
    const route = routeLayer(ids, defaultUniverseData)
    renderer.setLayers([route])
    renderer.focusOn(route.focusSystemIds)
    renderer.draw()
    routeStatusEl.textContent = `${ids.length} jump${ids.length === 1 ? '' : 's'}`
  } catch (err) {
    routeStatusEl.textContent = `Route failed: ${err.message}`
  } finally {
    routeShowBtn.disabled = false
  }
})

// StarmapRenderer has no direct "pan/zoom to" API -- it only changes its
// viewport in response to real pointer/wheel events. Drive it the same way
// the perf benchmark does: dispatch real synthetic events on the canvas so
// the renderer's own (already-tested) handlers move the viewport.
function jumpToSystem(system) {
  const rect = canvas.getBoundingClientRect()
  const cx = rect.left + canvas.width / 2
  const cy = rect.top + canvas.height / 2
  const before = renderer.getViewport()

  canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true }))
  const targetClientX = cx + (before.offsetX - system.x) * before.scale
  // offsetY's drag delta has the opposite sign from offsetX's (see
  // StarmapRenderer's handlePointerMove -- screen y is inverted relative to
  // world y), so this target must be derived with the opposite sign too.
  const targetClientY = cy + (system.y - before.offsetY) * before.scale
  canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: targetClientX, clientY: targetClientY, bubbles: true }))
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))

  // Zoom in from the full-galaxy fit scale enough to distinguish the
  // highlighted system from its immediate neighbors.
  const targetScale = fitScale * 400
  let guard = 0
  while (renderer.getViewport().scale < targetScale && guard < 300) {
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -1, bubbles: true, cancelable: true }))
    guard++
  }

  highlightedSystemId = system.id
  updateLayers()
}

let activeSuggestions = []
let activeIndex = -1

function renderSuggestions(query) {
  suggestionsEl.innerHTML = ''
  activeSuggestions = []
  activeIndex = -1

  const q = query.trim().toLowerCase()
  if (!q) {
    suggestionsEl.hidden = true
    return
  }

  activeSuggestions = defaultUniverseData.systems
    .filter(s => s.name.toLowerCase().includes(q))
    .slice(0, 10)

  if (activeSuggestions.length === 0) {
    suggestionsEl.hidden = true
    return
  }

  suggestionsEl.hidden = false
  for (const system of activeSuggestions) {
    const li = document.createElement('li')
    li.textContent = system.name
    // mousedown (not click) fires before the input's blur, so the
    // suggestion is still in the DOM when the handler runs.
    li.addEventListener('mousedown', e => {
      e.preventDefault()
      selectSystem(system)
    })
    suggestionsEl.appendChild(li)
  }
}

function setActiveIndex(index) {
  activeIndex = index
  ;[...suggestionsEl.children].forEach((li, i) => li.classList.toggle('active', i === activeIndex))
}

function selectSystem(system) {
  searchInput.value = system.name
  suggestionsEl.hidden = true
  jumpToSystem(system)
  clickedEl.textContent = `${system.name} (id ${system.id})`
}

searchInput.addEventListener('input', () => renderSuggestions(searchInput.value))

searchInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (activeSuggestions.length > 0) setActiveIndex(Math.min(activeIndex + 1, activeSuggestions.length - 1))
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (activeSuggestions.length > 0) setActiveIndex(Math.max(activeIndex - 1, 0))
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const chosen = activeIndex >= 0 ? activeSuggestions[activeIndex] : activeSuggestions[0]
    if (chosen) selectSystem(chosen)
  } else if (e.key === 'Escape') {
    suggestionsEl.hidden = true
  }
})

document.addEventListener('click', e => {
  if (!e.target.closest('#search-box')) suggestionsEl.hidden = true
})
