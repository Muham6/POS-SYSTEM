import * as Sentry from '@sentry/nextjs'

// Unset SENTRY_DSN => the SDK no-ops. No third-party account is required to
// run this app; error monitoring is an opt-in add-on.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
})
