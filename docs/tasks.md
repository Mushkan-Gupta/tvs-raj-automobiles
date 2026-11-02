# Tasks

Legend: [ ] todo, [~] in progress, [x] done. Order changed (Nov 2026): **Track 1 = owner/admin + employee features first**, Track 2 = customer-facing (public catalogue, shop, accounts, payments), then UI redesign.

## Done
- [x] Public site pages, staff login, roles
- [x] Employee dashboard: stock arrival and sale entry
- [x] Sold + Documents dual-sheet sync, header-based column mapping
- [x] Pending Documents and Pending Payments
- [x] Admin Business Overview + AdminNav
- [x] Security: auth + role checks on 8 edge functions, deployed, pushed to main
- [x] ALLOWED_ORIGIN secret set
- [x] Employee delete fixed (`user_roles_id_fkey` ON DELETE CASCADE)

## Part 0: finish security (before customer sign-up)
- [ ] Run `phase0/rls-fix.sql` in Supabase SQL Editor, re-run policy query to confirm
- [ ] Test: employee can still log stock/sales and update inquiry status; logged-in non-staff cannot read stock_logs/inquiries
- [ ] Raise minimum employee password length
- [ ] Commit schema + policies into `supabase/migrations`
- [ ] Optional: captcha / rate limit on contact form

## TRACK 1 — Owner (admin) + Employee features  (do now)
### A1: Price + parts management (admin)  -> prompts/step-a1-price-and-parts-admin.md
- [x] bikes.price + "price not confirmed" badge, admin edits price anytime
- [x] parts, part_costs (admin-only), bike_parts tables + RLS
- [x] Storage bucket `product-images`
- [x] Admin /admin/parts: add/edit/deactivate, photo, price, cost price, stock, pinned (TVS-logo helmets first), fits-all, compatible bikes

### A2: Employee sale form v2
- [ ] Bike select -> auto price (from bikes.price; uses discounted price once A3 is done)
- [ ] Adjustment boxes: Discount (% or Rs), Paperwork (+), Modification (+ note)
- [ ] Employee discount >10% -> "Pending Approval"; admin approval queue
- [ ] Extra products with quantity (price from parts, stock reduces)
- [ ] New columns on sale rows + Google Sheet (exact header names agreed before building)

### A3: Discounts (admin)
- [ ] `discounts` table + RLS (admin write, public read active)
- [ ] Admin UI: per-product %, start/end date, "apply to all bikes", "apply to all parts"
- [ ] One shared price function (used by sale form now, website/orders later)
- [ ] Specific product discount beats "all" discount (to confirm)

### A4: Admin overview
- [ ] Use final price (after discount, paperwork, modification)
- [ ] Profit from parts (selling price minus cost price)
- [ ] Pending Approval count/queue

## TRACK 2 — Customer-facing (later)
### B1: Public catalogue v2
- [ ] Public pages read bikes/parts from DB (remove static bikes.js)
- [ ] `bike_colors` + per-colour image; `BikePlaceholder` until photos exist
- [ ] Bike page: bike + colours left, parts list right (Ducati-style); bikes = Enquire only
- [ ] Discount display: struck-through price, discounted price, % off
- [ ] Reviews & feedback: customer submit + owner publish toggle (consent)

### B2: Customer shop
- [ ] Sign-up/login (Google, email OTP, email/phone + password); custom email provider
- [ ] Profile + address, cart, checkout, delivery fee (Rs 500 / Rs 250 prepaid)
- [ ] orders, order_items, payments tables + RLS (customer sees own only)
- [ ] COD, then Khalti (sandbox -> live), then Fonepay dynamic QR
- [ ] Customer email notifications
- [ ] Employee order queue: New -> Packed -> Shipped (courier, tracking) -> Delivered
- [ ] Sheet tab: Orders; admin overview: orders

### B3: UI redesign and Nepali
- [ ] Stitch designs (English only, 3D viewer), implement, test iPhone Safari + Android Chrome
- [ ] Compress/lazy-load 3D model
- [ ] Nepali for public site only

## Engineering hygiene
- [ ] Real README
- [ ] GitHub Action to deploy edge functions
- [ ] Shared Google auth helper in `_shared`
- [ ] Split very large page files
- [ ] Tests for pricing, discount and payment logic

## Open questions
- [ ] (Track 2) Merchant accounts: does the showroom have / can it get Khalti, Fonepay merchant credentials?
- [ ] Courier arrangement and who books pickups
- [ ] Final real bike list, photos and prices from the owner