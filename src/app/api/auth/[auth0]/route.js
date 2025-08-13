import { handleAuth } from '@auth0/nextjs-auth0/edge'

// Auth0 App Router handler
// Routes provided:
// /api/auth/login
// /api/auth/callback
// /api/auth/logout
// /api/auth/me
export const GET = handleAuth()
export const POST = handleAuth()

export const dynamic = 'force-dynamic'
