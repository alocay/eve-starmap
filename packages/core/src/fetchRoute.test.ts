import { describe, it, expect, vi } from 'vitest'
import { fetchRoute } from './fetchRoute.js'

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}

describe('fetchRoute', () => {
  it('calls the ESI route endpoint and returns the id array', async () => {
    const fetchMock = vi.fn(async () => okResponse([30000142, 30000144]))
    const ids = await fetchRoute(30000142, 30000144, { fetch: fetchMock as any })
    expect(ids).toEqual([30000142, 30000144])
    const url = (fetchMock.mock.calls[0][0] as string)
    expect(url).toContain('/route/30000142/30000144/')
    expect(url).toContain('https://esi.evetech.net/latest')
  })

  it('omits the flag param by default', async () => {
    const fetchMock = vi.fn(async () => okResponse([]))
    await fetchRoute(1, 2, { fetch: fetchMock as any })
    expect(fetchMock.mock.calls[0][0]).not.toContain('flag=')
  })

  it('includes flag, avoid and connections in the query', async () => {
    const fetchMock = vi.fn(async () => okResponse([]))
    await fetchRoute(1, 2, {
      flag: 'secure',
      avoid: [30000142, 30000157],
      connections: [[31000001, 31000002]],
      fetch: fetchMock as any,
    })
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('flag=secure')
    expect(url).toContain('avoid=30000142')
    expect(url).toContain('avoid=30000157')
    expect(url).toContain('connections=31000001%7C31000002') // 31000001|31000002 encoded
  })

  it('honors a custom baseUrl', async () => {
    const fetchMock = vi.fn(async () => okResponse([]))
    await fetchRoute(1, 2, { baseUrl: 'https://example.test/v1', fetch: fetchMock as any })
    expect(fetchMock.mock.calls[0][0]).toContain('https://example.test/v1/route/1/2/')
  })

  it('throws on a non-2xx response', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false, status: 404, text: async () => 'no route',
    } as Response))
    await expect(fetchRoute(1, 2, { fetch: fetchMock as any })).rejects.toThrow(/404/)
  })
})
