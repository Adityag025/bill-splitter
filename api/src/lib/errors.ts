import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/** Thrown by route handlers. The global error handler turns it into `{ error }` JSON. */
export class HttpError extends Error {
  readonly status: ContentfulStatusCode

  constructor(status: ContentfulStatusCode, message: string) {
    super(message)
    this.status = status
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`)
export const badRequest = (message: string) => new HttpError(400, message)
export const unprocessable = (message: string) => new HttpError(422, message)
export const conflict = (message: string) => new HttpError(409, message)

export function errorResponse(c: Context, status: ContentfulStatusCode, message: string) {
  return c.json({ error: message }, status)
}
