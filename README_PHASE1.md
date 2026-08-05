# BlackBox POS — Phase 1 (Auth + Roles)

Drop these files into a fresh Next.js app. Full steps are in the chat.

Files land at these paths (relative to your project root):

  lib/supabase/client.ts       - browser Supabase client
  lib/supabase/server.ts       - server Supabase client
  lib/supabase/middleware.ts   - session refresh + route guard helper
  lib/auth.ts                  - getProfile() + requireAdmin() helpers
  middleware.ts                - runs the guard on every request
  app/page.tsx                 - "/" redirects to /dashboard or /login
  app/login/page.tsx           - the login screen
  app/dashboard/layout.tsx     - protected shell + role-aware sidebar
  app/dashboard/page.tsx       - overview page
  components/sign-out-button.tsx
  .env.local.example           - copy to .env.local and fill in

Requires: npm install @supabase/ssr @supabase/supabase-js
