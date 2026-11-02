import { useCallback, useEffect, useState } from 'react'
import { ApiError } from './api'

export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T }

/**
 * Runs `load` when the component mounts and every time `reload` is called.
 * Gives the page one of three states to render: loading, error, or ready.
 */
export function useLoad<T>(load: () => Promise<T>): [LoadState<T>, () => void] {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' })

  const run = useCallback(() => {
    let cancelled = false
    setState({ status: 'loading' })
    load().then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data })
      },
      (err: unknown) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(err) })
      },
    )
    // Returning this lets an unmount (or a new load) ignore a stale answer.
    return () => {
      cancelled = true
    }
  }, [load])

  useEffect(run, [run])

  const reload = useCallback(() => {
    run()
  }, [run])

  return [state, reload]
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Something went wrong'
}
