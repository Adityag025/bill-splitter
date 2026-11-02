import { Hono } from 'hono'
import { listMembers, newId, now, requireHome } from '../lib/db'
import { readJsonObject, requireName } from '../lib/validate'

type MemberInsertedRow = { id: string; home_id: string; name: string }
type BalanceRow = { member_id: string; name: string; outstanding_cents: number }

export const homes = new Hono<{ Bindings: Env }>()

// POST /api/homes -> 201 { id, name }
homes.post('/api/homes', async (c) => {
  const body = await readJsonObject(c)
  const name = requireName(body.name, 'name')
  const id = newId()

  await c.env.DB.prepare('INSERT INTO homes (id, name, created_at) VALUES (?, ?, ?)')
    .bind(id, name, now())
    .run()

  return c.json({ id, name }, 201)
})

// POST /api/homes/:homeId/members -> 201 { id, homeId, name }
homes.post('/api/homes/:homeId/members', async (c) => {
  const homeId = c.req.param('homeId')
  const body = await readJsonObject(c)
  const name = requireName(body.name, 'name')
  await requireHome(c.env.DB, homeId)

  // The position is computed inside the INSERT itself. One statement is atomic in SQLite,
  // so two members added at the same time cannot be given the same position.
  const inserted = await c.env.DB.prepare(
    `INSERT INTO members (id, home_id, name, position, created_at)
     SELECT ?, ?, ?, COALESCE(MAX(position), 0) + 1, ?
     FROM members WHERE home_id = ?
     RETURNING id, home_id, name`,
  )
    .bind(newId(), homeId, name, now(), homeId)
    .first<MemberInsertedRow>()
  if (!inserted) throw new Error('member insert returned no row')

  return c.json({ id: inserted.id, homeId: inserted.home_id, name: inserted.name }, 201)
})

// GET /api/homes/:homeId -> 200 { id, name, members: [{ id, homeId, name }] }
// Used by the web page to show the home and its members.
homes.get('/api/homes/:homeId', async (c) => {
  const home = await requireHome(c.env.DB, c.req.param('homeId'))
  const members = await listMembers(c.env.DB, home.id)
  return c.json({
    id: home.id,
    name: home.name,
    members: members.map((m) => ({ id: m.id, homeId: m.home_id, name: m.name })),
  })
})

// GET /api/homes/:homeId/balances -> 200 { balances: [{ memberId, name, outstandingCents }] }
homes.get('/api/homes/:homeId/balances', async (c) => {
  const home = await requireHome(c.env.DB, c.req.param('homeId'))

  // LEFT JOIN keeps members that have no shares yet (they owe 0).
  const { results } = await c.env.DB.prepare(
    `SELECT m.id AS member_id,
            m.name,
            COALESCE(SUM(CASE WHEN s.paid_at IS NULL THEN s.amount_cents ELSE 0 END), 0)
              AS outstanding_cents
     FROM members m
     LEFT JOIN shares s ON s.member_id = m.id
     WHERE m.home_id = ?
     GROUP BY m.id, m.name, m.position
     ORDER BY m.position`,
  )
    .bind(home.id)
    .all<BalanceRow>()

  return c.json({
    balances: results.map((r) => ({
      memberId: r.member_id,
      name: r.name,
      outstandingCents: r.outstanding_cents,
    })),
  })
})
