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
- Bike data is currently fake. For now: placeholder prices that the admin can edit; real list/photos come later from the owner.
- Devices: staff use mobile and desktop; must work on iOS and Android.

- Bikes: inquiry only. Parts: direct online order (account required). Parts list shows pinned items (TVS-logo helmets) first.
- Discounts: admin only, % only, start/end date, per product, plus apply-all-bikes and apply-all-parts buttons.
- Employee sale form: price auto-filled (discounted price); Discount (% or Rs), Paperwork (+), Modification (+ note); employee discount max 10%, above that needs admin approval ("Pending Approval" queue); extra products reduce stock.
- Delivery fee Rs 500 all Nepal, Rs 250 if prepaid. Payment must confirm automatically (no screenshots): COD, then Khalti, then Fonepay QR.
- Customer login: Google, email OTP, email/phone + password (phone is a profile field; phone-number login needs paid SMS).
- Cost price entered by owner in the admin product form (mirrored to Sheet); admin overview shows parts profit.
- Photos: one original placeholder illustration now; no scraped copyrighted photos; reviews only real, with consent, owner picks which to show.
- Source of truth: Supabase; Google Sheet is a synced copy.

## Gotchas
- Deployment needs three things: merge `pr-preview` into `main` and push (Vercel production = `main`), and `supabase functions deploy <name>` for every changed function.
- Earlier bug: Sold data landed in wrong columns because `sync-to-sheets` wrote in a fixed order. Fixed by reading headers and mapping by name. Keep doing this.
- `ProtectedRoute` only hides pages in the browser. Backend functions must enforce auth.
- As of the review, 8 of 11 edge functions had no auth and `verify_jwt = false`.
- Schema and RLS policies are not in the repo yet.
- `public/models/bike.glb` is 17.6 MB.
- Code is generated with Antigravity (Gemini IDE); always run lint + build and test manually.
- Client cannot insert `stock_logs` with type='sale' directly; sales must go through edge function + `commit_sale()` RPC.

## Tooling
- Repo: github.com/Mushkan-Gupta/tvs-raj-automobiles
- Local path: f:/tvs-raj-automobiles
- UI design tool: Google Stitch
- Coding tool: Antigravity

## Change log
- 2026-11-03: Step A2 completed (migration 20261103152338_a2_sale_v2.sql, pure pricing module & tests, record-sale & review-sale edge functions, Google Sheets A2 columns + get-pending-payments/update-payment/get-admin-overview Final Price fallback, employee sale form v2 with modular components, and /admin/approvals queue with AdminNav badge).
- 2026-11-03: Step A1 completed (migration 20261103021000_a1_price_parts.sql, bikes price confirmation in AdminDashboard, /admin/parts portal with confidential cost price & photo uploads).
- 2026-11-02: Phase 0 functions deployed, employee delete fixed (user_roles FK cascade), RLS issues found (phase0/rls-fix.sql), commerce features specified, UI parked.
- 2026-10-31: docs/ folder created (prd, architecture, design, rules, tasks, memory). Security review completed; redesign plan agreed.
