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
