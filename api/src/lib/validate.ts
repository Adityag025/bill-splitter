import type { Context } from 'hono'
import { badRequest, unprocessable } from './errors'

/** Reads the JSON body. A body that is not valid JSON or not an object is a 400. */
export async function readJsonObject(c: Context): Promise<Record<string, unknown>> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw badRequest('body must be valid JSON')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw badRequest('body must be a JSON object')
  }
  return body as Record<string, unknown>
}

/** A non-empty string, trimmed, at most 200 characters. */
export function requireName(value: unknown, field: string): string {
  if (typeof value !== 'string') throw unprocessable(`${field} must be a string`)
  const trimmed = value.trim()
  if (trimmed.length === 0) throw unprocessable(`${field} must not be empty`)
  if (trimmed.length > 200) throw unprocessable(`${field} is too long`)
  return trimmed
}

/** A positive whole number of cents. Rejects 0, negatives, decimals, strings and null. */
export function requirePositiveCents(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw unprocessable(`${field} must be a positive whole number of cents`)
  }
  return value
}
