import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { api } from '../lib/api'
import { errorMessage } from '../lib/useLoad'

export const Route = createFileRoute('/')({
  component: StartPage,
})

function StartPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [existingId, setExistingId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function createHome(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const home = await api.createHome(name)
      await navigate({ to: '/homes/$homeId', params: { homeId: home.id } })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function openHome(event: FormEvent) {
    event.preventDefault()
    void navigate({ to: '/homes/$homeId', params: { homeId: existingId.trim() } })
  }

  return (
    <main>
      <h1>Bill Splitter</h1>
      <p className="muted">Create a home, add members, split bills, and pay your share.</p>

      <section className="card">
        <h3>Create a home</h3>
        <form className="row" onSubmit={createHome}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Home name (e.g. Flat 4B)"
            required
          />
          <button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create'}
          </button>
        </form>
        {error && <div className="alert error">{error}</div>}
      </section>

      <section className="card">
        <h3>Open an existing home</h3>
        <form className="row" onSubmit={openHome}>
          <input
            value={existingId}
            onChange={(e) => setExistingId(e.target.value)}
            placeholder="Home id"
            required
          />
          <button type="submit" className="secondary">
            Open
          </button>
        </form>
      </section>
    </main>
  )
}
