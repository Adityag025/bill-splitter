import { createFileRoute, Link } from '@tanstack/react-router'
import { type FormEvent, useCallback, useState } from 'react'
import { api, type Bill, formatCents, type Home, type Share } from '../lib/api'
import { errorMessage, useLoad } from '../lib/useLoad'

export const Route = createFileRoute('/homes/$homeId')({
  component: HomePage,
})

function HomePage() {
  const { homeId } = Route.useParams()

  const loadAll = useCallback(async () => {
    const [home, bills] = await Promise.all([api.getHome(homeId), api.listBills(homeId)])
    return { home, bills: bills.bills }
  }, [homeId])
  const [state, reload] = useLoad(loadAll)

  if (state.status === 'loading') {
    return (
      <main>
        <p className="muted">Loading home…</p>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main>
        <h1>Bill Splitter</h1>
        <div className="alert error">Could not load this home: {state.message}</div>
        <div className="row">
          <button type="button" onClick={reload}>
            Try again
          </button>
          <Link to="/">Back to start</Link>
        </div>
      </main>
    )
  }

  const { home, bills } = state.data

  return (
    <main>
      <p className="muted">
        <Link to="/">← All homes</Link>
      </p>
      <h1>{home.name}</h1>
      <p className="muted">Home id: {home.id}</p>

      <MembersCard home={home} onChanged={reload} />
      <NewBillCard home={home} onChanged={reload} />

      <h2>Bills</h2>
      {bills.length === 0 ? (
        <p className="muted">No bills yet. Add one above.</p>
      ) : (
        bills.map((bill) => <BillCard key={bill.id} bill={bill} onChanged={reload} />)
      )}
    </main>
  )
}

function MembersCard({ home, onChanged }: { home: Home; onChanged: () => void }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.addMember(home.id, name)
      setName('')
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h3>Members</h3>
      {home.members.length === 0 ? (
        <p className="muted">No members yet. A bill needs at least one member.</p>
      ) : (
        <p>{home.members.map((m) => m.name).join(', ')}</p>
      )}
      <form className="row" onSubmit={submit}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Member name"
          required
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add member'}
        </button>
      </form>
      {error && <div className="alert error">{error}</div>}
    </section>
  )
}

function NewBillCard({ home, onChanged }: { home: Home; onChanged: () => void }) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // The form takes dollars; the API only speaks whole cents.
      const totalCents = Math.round(Number(amount) * 100)
      await api.createBill(home.id, title, totalCents)
      setTitle('')
      setAmount('')
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h3>New bill</h3>
      <form className="row" onSubmit={submit}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Electricity)"
          required
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount in dollars"
          inputMode="decimal"
          required
        />
        <button type="submit" disabled={busy || home.members.length === 0}>
          {busy ? 'Splitting…' : 'Split bill'}
        </button>
      </form>
      {home.members.length === 0 && <p className="muted">Add a member before creating a bill.</p>}
      {error && <div className="alert error">{error}</div>}
    </section>
  )
}

function BillCard({ bill, onChanged }: { bill: Bill; onChanged: () => void }) {
  const unpaid = bill.shares.filter((s) => s.paidAt === null).length
  return (
    <section className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>{bill.title}</h3>
        <strong>{formatCents(bill.totalCents)}</strong>
      </div>
      <p className="muted">
        {unpaid === 0 ? 'Fully paid' : `${unpaid} of ${bill.shares.length} shares unpaid`}
      </p>
      {bill.shares.map((share) => (
        <ShareRow key={share.id} billId={bill.id} share={share} onChanged={onChanged} />
      ))}
    </section>
  )
}

function ShareRow({
  billId,
  share,
  onChanged,
}: {
  billId: string
  share: Share
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // One key per share for the life of this component. If the request fails on the way
  // back, a retry sends the same key and the server answers with the same result.
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  async function pay() {
    setBusy(true)
    setError(null)
    try {
      await api.payShare(billId, share.id, idempotencyKey)
      onChanged()
    } catch (err) {
      // The share stays unpaid on screen; we never mark it paid before the server confirms.
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="share">
        <span>
          {share.memberName} <span className="muted">owes</span> {formatCents(share.amountCents)}
        </span>
        {share.paidAt ? (
          <span className="badge">Paid {new Date(share.paidAt).toLocaleString()}</span>
        ) : (
          <button type="button" onClick={pay} disabled={busy}>
            {busy ? 'Paying…' : 'Pay'}
          </button>
        )}
      </div>
      {error && <div className="alert error">Payment failed: {error}</div>}
    </div>
  )
}
