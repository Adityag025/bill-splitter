import { describe, expect, it } from 'vitest'
import { call, createBill, createHome, type Share } from './helpers'

describe('extra: concurrency and bad input', () => {
  it('only one of two simultaneous payments succeeds', async () => {
    const { homeId } = await createHome(['Asha', 'Ben'])
    const bill = await createBill(homeId, 1000)
    const share = bill.body.shares[0]
    if (!share) throw new Error('no share')

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        call<Share>('POST', `/api/bills/${bill.body.id}/shares/${share.id}/pay`, {
          headers: { 'Idempotency-Key': crypto.randomUUID() },
        }),
      ),
    )
    const statuses = results.map((r) => r.status).sort()
    expect(statuses).toEqual([200, 409, 409, 409, 409])
  })

  it('members added at the same time get distinct positions', async () => {
    const home = await call<{ id: string }>('POST', '/api/homes', { body: { name: 'H' } })
    const added = await Promise.all(
      ['A', 'B', 'C', 'D'].map((name) =>
        call('POST', `/api/homes/${home.body.id}/members`, { body: { name } }),
      ),
    )
    expect(added.every((r) => r.status === 201)).toBe(true)
    const bill = await createBill(home.body.id, 10)
    expect(bill.body.shares).toHaveLength(4)
  })

  it('rejects invalid JSON with 400 and unknown routes with JSON 404', async () => {
    const bad = await fetch_raw('/api/homes', '{not json')
    expect(bad.status).toBe(400)
    const missing = await call<{ error: string }>('GET', '/api/nope')
    expect(missing.status).toBe(404)
    expect(missing.body.error).toEqual(expect.any(String))
  })

  it('rejects an empty or non-string name', async () => {
    const empty = await call('POST', '/api/homes', { body: { name: '   ' } })
    const num = await call('POST', '/api/homes', { body: { name: 5 } })
    expect(empty.status).toBe(422)
    expect(num.status).toBe(422)
  })
})

async function fetch_raw(path: string, body: string) {
  const { exports } = await import('cloudflare:workers')
  return exports.default.fetch(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }),
  )
}
