# Rules (for developers and AI coding tools)

Read `prd.md`, `architecture.md`, `design.md`, `tasks.md` and `memory.md` before starting work.

## General
1. One task at a time, taken from `tasks.md`. Do not refactor unrelated code.
2. After finishing a task, update `tasks.md`. Record new decisions or gotchas in `memory.md`.
3. Run `npm run lint` and `npm run build` before saying a task is done.
4. Never commit secrets. Keys live in `.env` (frontend) and `supabase secrets` (functions).

## Security
1. Every edge function must validate the caller's JWT and check the role in `user_roles`, except the single public inquiry function.
2. Never trust the frontend: `ProtectedRoute` is only a UI guard.
3. Never expose the service-role key or Google private key to the frontend.
4. Validate and sanitise all inputs in functions (types, lengths, positive amounts, allowed values).
5. CORS limited to the production domain, not `*`.
6. Any new table needs RLS policies, committed as a migration in `supabase/migrations`.
7. Customer phone, ID and payment data is sensitive: do not log it.

## Google Sheet rules
1. Find columns by header name, never by fixed position.
2. Match rows by Sale ID.
3. Keep tab names exact: Stock, Arrivals, Sold, Documents, Inquiries.
4. Non-applicable document columns are written as "Not Required".
5. Re-read the row right before writing a payment to reduce overwrite collisions.

## Frontend
1. Mobile-first Tailwind; test at 360 px width first, then tablet and desktop.
2. Must work on iOS Safari and Android Chrome. Respect safe areas, avoid hover-only UI, minimum 44 px touch targets.
3. Public pages: no hard-coded user-facing text in components that blocks later Nepali translation. Keep strings easy to extract. Admin/employee pages stay English.
4. Keep components small. Split large pages into components and hooks. Do not add new 500+ line files.
5. Shared logic goes in `src/lib` or `src/components`; shared function code in `supabase/functions/_shared`.
6. Heavy assets (3D model, images) must be compressed and lazy-loaded.
7. Follow `design.md`. Do not invent new colours or components outside it.

## Data
1. Bike data must be real (from the showroom). No fake prices or placeholder images in production.
2. Prices are in NPR and formatted consistently.

## Git and deployment
1. Branch `pr-preview` for work, `main` for production (Vercel deploys `main`).
2. After changing an edge function: `supabase functions deploy <name>`.
3. Merge `pr-preview` into `main` and push, or the live site will not update.
4. Small, clearly named commits.

## AI tool behaviour
1. Ask when requirements are unclear instead of guessing.
2. Do not delete or rewrite files outside the task scope.
3. State which files were changed and how to test.
