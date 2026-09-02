import { withSentryConfig } from '@sentry/nextjs/config'

const nextConfig = {
  turbopack: { root: __dirname },
  allowedDevOrigins: ['172.20.10.3', '192.168.0.109'],
  images: {
    remotePatterns: [{ hostname: 'fcjauutzsycussazshho.supabase.co' }],
  },
}

// Safe with no Sentry account set up at all — without SENTRY_DSN, the SDK
// initialized in instrumentation.ts/instrumentation-client.ts just no-ops.
// This wrapper only adds instrumentation; source map upload (which needs
// SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN) is simply skipped without them.
export default withSentryConfig(nextConfig, {
  silent: true,
})