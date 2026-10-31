# Tasks

Legend: [ ] todo, [~] in progress, [x] done

## Done (before this document)
- [x] Public site pages, staff login, roles
- [x] Employee dashboard: stock and sale entry, Sold Price / Buyer Type / Payment Status / Amount Paid
- [x] Sold + Documents dual-sheet sync, header-based column mapping fix
- [x] Pending Documents and Pending Payments screens + functions
- [x] Admin Business Overview + AdminNav

## Phase 0: Security (do first)
- [x] Create `supabase/functions/_shared/auth.ts` (JWT check + role check)
- [x] Add admin check: get-admin-overview, seed-stock-sheet
- [x] Add admin/employee check: get-pending-documents, update-documents, get-pending-payments, update-payment, notify-out-of-stock
- [x] sync-to-sheets: public path limited to validated `inquiry` (must match a real `inquiries` row); all other types staff-only (separate `submit-inquiry` function and rate limiting still optional)
- [~] Restrict CORS via `ALLOWED_ORIGIN` secret (code done, secret not set yet). `verify_jwt` left false; checks are inside functions
- [ ] Export schema + RLS policies into `supabase/migrations`; verify `user_roles`, `stock_logs`, `inquiries`, `bikes` policies
- [ ] Raise minimum employee password length
- [~] Redeploy the 8 functions and test each role (see phase0/DEPLOY.md)

## Phase 1: Public site redesign
- [ ] Collect real data from showroom: bike list, prices (NPR), specs, photos, offers, address, phone, hours
- [ ] Generate Phase 1 screens in Google Stitch (mobile first); choose direction
- [ ] Update `design.md` with final colours, fonts, components
- [ ] Decide bike data source (Supabase `bikes` table vs `bikes.js`); remove fake data
- [ ] Implement Home, Bike listing, Bike detail, Offers, Finance, About, Contact
- [ ] Compress 3D model (Draco/meshopt) and lazy-load, or replace with images
- [ ] Test on iPhone Safari, Android Chrome, desktop
- [ ] Deploy (merge `pr-preview` into `main`)

## Phase 2: Staff portals redesign
- [ ] Stitch designs for login, employee dashboard, pending documents, pending payments
- [ ] Stitch designs for admin overview, inventory, manage employees
- [ ] Implement; split EmployeeDashboard, ManageEmployees, AdminOverview into smaller components
- [ ] Test one-handed use on phones and desktop use

## Phase 3: Nepali (public site only)
- [ ] Add i18n setup, extract public strings
- [ ] Get Nepali translations reviewed
- [ ] Language switcher, check layout with longer text

## Engineering hygiene
- [ ] Real README (setup, env vars, Sheet structure, deploy steps)
- [ ] GitHub Action to deploy edge functions
- [ ] Shared Google auth helper in `_shared`
- [ ] Basic tests for payment and handover logic
- [ ] Payment write collision handling

## Open questions
- [ ] Any new features (booking, EMI calculator, test-ride request)?
