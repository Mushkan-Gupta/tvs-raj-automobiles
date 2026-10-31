# Project Memory

Decisions and gotchas so a new session (human or AI) does not lose context. Add new entries at the bottom with the date.

## Business
- TVS Raj Automobiles: TVS motorcycle dealership, Lahan, Siraha, Nepal.
- Back office is a Google Sheet (Stock, Arrivals, Sold, Documents, Inquiries). Monthly dashboard email is sent by a Google Apps Script on the last day of each month.
- Handover/registration (Namsari) happens at Yatayat, so each sale tracks required customer documents first.

## Decisions
- Documents tracked in a separate **Documents** tab linked by Sale ID, not extra columns on Sold.
- Sales store a real **Sold Price** (distinct from showroom price) so profit uses actual price.
- Payment Status field on Sold (Fully Paid / Pending).
- Document columns use real names; non-applicable buyer-type columns are "Not Required".
- Redesign: designs made in Google Stitch first, adjust afterwards.
- Redesign order: public site first, staff portals after.
- Security fixes on edge functions come before the redesign.
- Language: public site English now, Nepali later (public only). Admin and employee stay English.
- Bike data is currently fake; real bikes and prices come from the Raj showroom.
- Devices: staff use mobile and desktop; must work on iOS and Android.

## Gotchas
- Deployment needs three things: merge `pr-preview` into `main` and push (Vercel production = `main`), and `supabase functions deploy <name>` for every changed function.
- Earlier bug: Sold data landed in wrong columns because `sync-to-sheets` wrote in a fixed order. Fixed by reading headers and mapping by name. Keep doing this.
- `ProtectedRoute` only hides pages in the browser. Backend functions must enforce auth.
- As of the review, 8 of 11 edge functions had no auth and `verify_jwt = false`.
- Schema and RLS policies are not in the repo yet.
- `public/models/bike.glb` is 17.6 MB.
- Code is generated with Antigravity (Gemini IDE); always run lint + build and test manually.

## Tooling
- Repo: github.com/Mushkan-Gupta/tvs-raj-automobiles
- Local path: f:/tvs-raj-automobiles
- UI design tool: Google Stitch
- Coding tool: Antigravity

## Change log
- 2026-10-31: docs/ folder created (prd, architecture, design, rules, tasks, memory). Security review completed; redesign plan agreed.
