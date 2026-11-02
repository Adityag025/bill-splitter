import { Hono } from 'hono'
import { errorResponse, HttpError } from './lib/errors'
import { bills } from './routes/bills'
import { homes } from './routes/homes'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

app.route('/', homes)
app.route('/', bills)

// Every error, including unknown routes, is JSON: { "error": "message" }.
app.notFound((c) => errorResponse(c, 404, 'route not found'))

app.onError((err, c) => {
  if (err instanceof HttpError) return errorResponse(c, err.status, err.message)
  console.error(err)
  return errorResponse(c, 500, 'internal error')
})

export default app
