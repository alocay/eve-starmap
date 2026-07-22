import {
  StarmapRenderer,
  heatmapLayer,
  heatmapAreaLayer,
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
const toggleHeatmapAreaGooeyBtn = document.getElementById('toggle-heatmap-area-gooey')
const toggleHeatmapAreaContourBtn = document.getElementById('toggle-heatmap-area-contour')
const searchInput = document.getElementById('search-input')
const suggestionsEl = document.getElementById('suggestions')
const tooltipEl = document.getElementById('tooltip')
const routeOriginInput = document.getElementById('route-origin')
const routeDestinationInput = document.getElementById('route-destination')
const routeShowBtn = document.getElementById('route-show')
const routeStatusEl = document.getElementById('route-status')
const routeGradientCheckbox = document.getElementById('route-gradient')

// Left-side accordion -- only Route uses it now (the layer toggles are plain
// buttons above it), but this stays generic over .tab-header/.tab-content in
// case another expandable section is added later.
document.querySelectorAll('.tab-header').forEach(header => {
  header.addEventListener('click', () => {
    const wasOpen = header.classList.contains('open')
    document.querySelectorAll('.tab-header').forEach(h => h.classList.remove('open'))
    document.querySelectorAll('.tab-content').forEach(c => { c.hidden = true })
    if (!wasOpen) {
      header.classList.add('open')
      document.querySelector(`[data-tab-content="${header.dataset.tab}"]`).hidden = false
    }
  })
})

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

// Demo heatmap data, shared by all three heatmap toggles (dots, gooey,
// contour) so switching between them shows the same values rendered three
// different ways instead of three unrelated datasets: a random scatter
// across the galaxy at widely varying magnitudes, for more span/variety
// than a handful of hand-picked hub clusters would show.
function buildDemoHeatmapValues(systems, count) {
  const shuffled = [...systems].sort(() => Math.random() - 0.5)
  const values = new Map()
  for (const system of shuffled.slice(0, count)) {
    values.set(system.id, Math.random() * 5_000_000_000)
  }
  return values
}

const systemIdByLowerName = new Map(defaultUniverseData.systems.map(s => [s.name.toLowerCase(), s.id]))

// Accepts either a numeric system id or a system name (case-insensitive,
// exact match) -- whichever the user typed into a route input. Returns
// undefined if it's neither a valid number nor a known system name.
function resolveSystemId(input) {
  const trimmed = input.trim()
  if (trimmed === '') return undefined
  const asNumber = Number(trimmed)
  if (Number.isFinite(asNumber)) return asNumber
  return systemIdByLowerName.get(trimmed.toLowerCase())
}

const demoHeatmapValues = buildDemoHeatmapValues(defaultUniverseData.systems, 200)
const demoHeatmapLayer = heatmapLayer(demoHeatmapValues, { radius: 5 })
const demoRegionLabelLayer = regionLabelLayer(defaultUniverseData.regions ?? [], defaultUniverseData.systems)
// null | 'contour' | 'gooey' | 'heatmap' -- the three heatmap toggles are
// mutually exclusive: turning one on turns off whichever of the others was
// on, but turning one off never turns another on.
let activeHeatmap = 'contour'
// Independent of activeHeatmap and route -- all three can be on at once, to
// show how layers stack.
let regionsOn = false
let currentRouteLayer = null
let currentRouteIds = null // cached so the gradient toggle can rebuild without re-fetching
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
  if (activeHeatmap === 'heatmap') layers.push(demoHeatmapLayer)
  if (activeHeatmap === 'contour' || activeHeatmap === 'gooey') layers.push(heatmapAreaLayer(demoHeatmapValues, { style: activeHeatmap, bands: 4, radius: 20 }))
  if (currentRouteLayer) layers.push(currentRouteLayer)
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

const heatmapToggleButtons = {
  contour: toggleHeatmapAreaContourBtn,
  gooey: toggleHeatmapAreaGooeyBtn,
  heatmap: toggleBtn,
}

function updateLayerToggleButtons() {
  for (const [key, btn] of Object.entries(heatmapToggleButtons)) {
    btn.classList.toggle('active', activeHeatmap === key)
  }
  toggleRegionsBtn.classList.toggle('active', regionsOn)
}

function setActiveHeatmap(key) {
  activeHeatmap = activeHeatmap === key ? null : key
  updateLayers()
  updateLayerToggleButtons()
}

for (const [key, btn] of Object.entries(heatmapToggleButtons)) {
  btn.addEventListener('click', () => setActiveHeatmap(key))
}

toggleRegionsBtn.addEventListener('click', () => {
  regionsOn = !regionsOn
  updateLayers()
  updateLayerToggleButtons()
})

updateLayers()
updateLayerToggleButtons()

// Route lookup: fetches a live route from ESI, then adds the route layer into
// the same updateLayers() combiner every other toggle uses (so it composes
// with whatever else is currently shown, instead of replacing all layers) and
// fits the view to it -- a manual way to exercise fetchRoute + routeLayer
// end-to-end against real data.
routeShowBtn.addEventListener('click', async () => {
  const origin = resolveSystemId(routeOriginInput.value)
  const destination = resolveSystemId(routeDestinationInput.value)
  if (origin === undefined || destination === undefined) {
    const which = origin === undefined && destination === undefined ? 'origin and destination'
      : origin === undefined ? 'origin' : 'destination'
    routeStatusEl.textContent = `Unknown system (${which}) -- enter a valid id or exact system name.`
    return
  }

  routeStatusEl.textContent = 'Loading route...'
  routeShowBtn.disabled = true
  try {
    const ids = await fetchRoute(origin, destination)
    currentRouteIds = ids
    const route = routeLayer(ids, defaultUniverseData, { gradient: routeGradientCheckbox.checked })
    currentRouteLayer = route
    updateLayers()
    renderer.focusOn(route.focusSystemIds)
    renderer.draw()
    routeStatusEl.textContent = `${ids.length} jump${ids.length === 1 ? '' : 's'}`
  } catch (err) {
    routeStatusEl.textContent = `Route failed: ${err.message}`
  } finally {
    routeShowBtn.disabled = false
  }
})

// Rebuilds the already-fetched route with the new gradient setting, no
// re-fetch needed -- lets you compare gradient vs. solid-leg rendering
// on the same route.
routeGradientCheckbox.addEventListener('change', () => {
  if (!currentRouteIds) return
  currentRouteLayer = routeLayer(currentRouteIds, defaultUniverseData, { gradient: routeGradientCheckbox.checked })
  updateLayers()
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
