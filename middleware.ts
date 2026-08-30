import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // Run on every route EXCEPT static files, images, and the PWA icon/manifest routes
  // (browsers fetch these even on the public login page, unauthenticated).
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-192|icon-512|apple-icon|icon|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
