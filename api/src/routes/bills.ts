import { Hono } from 'hono'
import {
  type BillRow,
  listMembers,
  newId,
  now,
  requireHome,
  type Share,
  type ShareRow,
  toShare,
} from '../lib/db'
import { badRequest, conflict, notFound, unprocessable } from '../lib/errors'
import { splitCents } from '../lib/split'
import { readJsonObject, requireName, requirePositiveCents } from '../lib/validate'

type ShareWithMemberRow = ShareRow & { member_name: string }

export const bills = new Hono<{ Bindings: Env }>()

// POST /api/homes/:homeId/bills -> 201 { id, homeId, title, totalCents, shares }
bills.post('/api/homes/:homeId/bills', async (c) => {
  const homeId = c.req.param('homeId')
  const body = await readJsonObject(c)
  const title = requireName(body.title, 'title')
  const totalCents = requirePositiveCents(body.totalCents, 'totalCents')

  await requireHome(c.env.DB, homeId)
  const members = await listMembers(c.env.DB, homeId)
  if (members.length === 0) throw unprocessable('home has no members')

  const billId = newId()
  const amounts = splitCents(totalCents, members.length)
  const shares: Share[] = members.map((member, index) => ({
    id: newId(),
    memberId: member.id,
    amountCents: amounts[index] ?? 0,
    paidAt: null,
  }))

  // D1 runs a batch as one transaction: either the bill and all its shares are
  // written, or nothing is. A bill can never exist with missing shares.
  await c.env.DB.batch([
    c.env.DB.prepare(
      'INSERT INTO bills (id, home_id, title, total_cents, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(billId, homeId, title, totalCents, now()),
    ...shares.map((share) =>
      c.env.DB.prepare(
        'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)',
      ).bind(share.id, billId, share.memberId, share.amountCents),
    ),
  ])

  return c.json({ id: billId, homeId, title, totalCents, shares }, 201)
})

// GET /api/homes/:homeId/bills -> 200 { bills: [{ ..., shares: [{ ..., memberName }] }] }
// Used by the web page.
bills.get('/api/homes/:homeId/bills', async (c) => {
  const home = await requireHome(c.env.DB, c.req.param('homeId'))

  const [billRows, shareRows] = await Promise.all([
    c.env.DB.prepare(
      'SELECT id, home_id, title, total_cents FROM bills WHERE home_id = ? ORDER BY created_at, id',
    )
      .bind(home.id)
      .all<BillRow>(),
    c.env.DB.prepare(
      `SELECT s.id, s.bill_id, s.member_id, s.amount_cents, s.paid_at, s.idempotency_key,
              m.name AS member_name
       FROM shares s
       JOIN bills b ON b.id = s.bill_id
       JOIN members m ON m.id = s.member_id
       WHERE b.home_id = ?
       ORDER BY m.position`,
    )
      .bind(home.id)
      .all<ShareWithMemberRow>(),
  ])

  const sharesByBill = new Map<string, (Share & { memberName: string })[]>()
  for (const row of shareRows.results) {
    const list = sharesByBill.get(row.bill_id) ?? []
    list.push({ ...toShare(row), memberName: row.member_name })
    sharesByBill.set(row.bill_id, list)
  }

  return c.json({
    bills: billRows.results.map((bill) => ({
      id: bill.id,
      homeId: bill.home_id,
      title: bill.title,
      totalCents: bill.total_cents,
      shares: sharesByBill.get(bill.id) ?? [],
    })),
  })
})

// POST /api/bills/:billId/shares/:shareId/pay -> 200 { id, memberId, amountCents, paidAt }
bills.post('/api/bills/:billId/shares/:shareId/pay', async (c) => {
  const { billId, shareId } = c.req.param()
  const key = c.req.header('Idempotency-Key')?.trim()
  if (!key) throw badRequest('Idempotency-Key header is required')

  // One conditional UPDATE does the whole "pay" step. SQLite runs writes one at a time,
  // so when two requests race, exactly one of them finds paid_at IS NULL and wins.
  const paid = await c.env.DB.prepare(
    `UPDATE shares
     SET paid_at = ?, idempotency_key = ?
     WHERE id = ? AND bill_id = ? AND paid_at IS NULL
     RETURNING id, bill_id, member_id, amount_cents, paid_at, idempotency_key`,
  )
    .bind(now(), key, shareId, billId)
    .first<ShareRow>()
  if (paid) return c.json(toShare(paid))

  // Nothing was updated: the share is missing, or it was already paid.
  const existing = await c.env.DB.prepare(
    `SELECT id, bill_id, member_id, amount_cents, paid_at, idempotency_key
     FROM shares WHERE id = ? AND bill_id = ?`,
  )
    .bind(shareId, billId)
    .first<ShareRow>()
  if (!existing) throw notFound('share')

  // Same key again: a retry of a request we already handled. Answer the same way.
  if (existing.idempotency_key === key) return c.json(toShare(existing))

  throw conflict('share is already paid')
})
