import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import '../styles.css'

export const Route = createRootRoute({
  component: () => <Outlet />,
  // A wrong URL or an unhandled error inside a route never shows a blank page.
  notFoundComponent: () => (
    <main>
      <h1>Page not found</h1>
      <Link to="/">Back to start</Link>
    </main>
  ),
  errorComponent: ({ error }) => (
    <main>
      <h1>Something went wrong</h1>
      <div className="alert error">{error instanceof Error ? error.message : 'Unknown error'}</div>
      <Link to="/">Back to start</Link>
    </main>
  ),
})
