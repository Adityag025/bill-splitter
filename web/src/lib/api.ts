// Small typed client for the API. Every call either returns typed data or throws ApiError.

export type Member = { id: string; homeId: string; name: string }
export type Home = { id: string; name: string; members: Member[] }
export type Share = {
  id: string
  memberId: string
  memberName: string
  amountCents: number
  paidAt: string | null
}
export type Bill = {
  id: string
  homeId: string
  title: string
  totalCents: number
  shares: Share[]
}
export type PaidShare = { id: string; memberId: string; amountCents: number; paidAt: string }

export class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const TIMEOUT_MS = 8000

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  // Abort slow requests so the page never hangs on a stuck API.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(path, { ...init, signal: controller.signal })
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === 'AbortError'
    throw new ApiError(0, timedOut ? 'The server took too long to answer' : 'Network error')
  } finally {
    clearTimeout(timer)
  }

  const text = await response.text()
  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      readErrorMessage(data) ?? `Request failed (${response.status})`,
    )
  }
  return data as T
}

function readErrorMessage(data: unknown): string | null {
  if (typeof data === 'object' && data !== null && 'error' in data) {
    const message = (data as { error: unknown }).error
    if (typeof message === 'string') return message
  }
  return null
}

function postJson<T>(path: string, body: unknown, headers: Record<string, string> = {}) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

export const api = {
  createHome: (name: string) => postJson<{ id: string; name: string }>('/api/homes', { name }),
  getHome: (homeId: string) => request<Home>(`/api/homes/${homeId}`),
  addMember: (homeId: string, name: string) =>
    postJson<Member>(`/api/homes/${homeId}/members`, { name }),
  listBills: (homeId: string) => request<{ bills: Bill[] }>(`/api/homes/${homeId}/bills`),
  createBill: (homeId: string, title: string, totalCents: number) =>
    postJson<Bill>(`/api/homes/${homeId}/bills`, { title, totalCents }),
  payShare: (billId: string, shareId: string, idempotencyKey: string) =>
    postJson<PaidShare>(`/api/bills/${billId}/shares/${shareId}/pay`, undefined, {
      'Idempotency-Key': idempotencyKey,
    }),
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' })
}
