import { notFound } from './errors'

// Row shapes exactly as they come back from D1 (snake_case columns).
export type HomeRow = { id: string; name: string }
export type MemberRow = { id: string; home_id: string; name: string; position: number }
export type BillRow = { id: string; home_id: string; title: string; total_cents: number }
export type ShareRow = {
  id: string
  bill_id: string
  member_id: string
  amount_cents: number
  paid_at: string | null
  idempotency_key: string | null
}

// Shape the API sends to clients (camelCase).
export type Share = { id: string; memberId: string; amountCents: number; paidAt: string | null }

export const now = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()

export function toShare(row: ShareRow): Share {
  return {
    id: row.id,
    memberId: row.member_id,
    amountCents: row.amount_cents,
    paidAt: row.paid_at,
  }
}

/** Loads a home or throws a 404. */
export async function requireHome(db: D1Database, homeId: string): Promise<HomeRow> {
  const home = await db
    .prepare('SELECT id, name FROM homes WHERE id = ?')
    .bind(homeId)
    .first<HomeRow>()
  if (!home) throw notFound('home')
  return home
}

/** Members of a home in the order they were added. */
export async function listMembers(db: D1Database, homeId: string): Promise<MemberRow[]> {
  const { results } = await db
    .prepare('SELECT id, home_id, name, position FROM members WHERE home_id = ? ORDER BY position')
    .bind(homeId)
    .all<MemberRow>()
  return results
}
