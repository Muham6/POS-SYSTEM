import * as Sentry from '@sentry/nextjs'

// If NEXT_PUBLIC_SENTRY_DSN is unset, Sentry's own SDK treats that as
// "disabled" and silently no-ops — no error, no cost, nothing sent.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
