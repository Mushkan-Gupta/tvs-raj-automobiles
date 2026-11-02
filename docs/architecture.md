# Architecture

## Stack
- Frontend: React 19, Vite, Tailwind CSS 4, React Router 7, Framer Motion, Recharts, Three.js / React Three Fiber + drei, Lucide icons.
- Backend: Supabase (Auth, Postgres, Edge Functions on Deno).
- Back office: Google Sheet via a Google service account (Sheets API v4).
- Hosting: Vercel, production domain tied to the `main` branch. SPA rewrite in `vercel.json`.

## High-level flow
```
Browser (React SPA)
   |-- supabase-js (anon key) --> Supabase Auth + Postgres (bikes, stock_logs, inquiries, user_roles)
   |-- supabase.functions.invoke --> Edge Functions --> Google Sheets API (service account)
                                                    \-> Supabase (service role)
```

## Repo layout
```
src/
  App.jsx                 routes, AuthProvider, WhatsApp button
  components/             Navbar, Footer, PromoBanner, Hero3DBike, CustomerReviews, AdminNav, ProtectedRoute
  lib/                    supabaseClient.js, AuthContext.jsx (user + role from user_roles)
  data/bikes.js           static sample bikes (placeholder data)
  pages/                  Home, BikeListing, BikeDetail, Offers, Finance, About, Contact,
                          AdminLogin, AdminDashboard, AdminOverview, ManageEmployees,
                          EmployeeDashboard, PendingDocuments, PendingPayments
supabase/
  config.toml
  functions/<name>/index.ts + deno.json
public/models/bike.glb    17.6 MB 3D model
```

## Routes
- Public: `/`, `/bikes`, `/bikes/:id`, `/offers`, `/finance`, `/about`, `/contact`, `/admin-login`
- Admin only: `/admin/dashboard`, `/admin/overview`, `/admin/employees`
- Admin + employee: `/employee/dashboard`, `/employee/pending-documents`, `/employee/pending-payments`

`ProtectedRoute` is a UI guard only. Real protection must be in the backend.

## Data
### Supabase (known tables; schema and RLS are NOT yet in the repo)
`bikes`, `stock_logs`, `inquiries`, `user_roles (id, role)`.

### Google Sheet tabs
| Tab | Columns (summary) |
|---|---|
| Stock | Bike Name, Category, Current Quantity, Last Updated (one row per bike, updated in place) |
| Arrivals | Date, Bike Name, Quantity, Logged By, New Stock Level |
| Sold | Date, Sale ID, Bike Name, Quantity, Logged By, Customer Name, Customer Phone, Sold Price, Buyer Type, Payment Status, Amount Paid, Balance Due, New Stock Level |
| Documents | Sale ID, Buyer Type, document checkboxes (non-applicable = "Not Required"), Handover Ready |
| Inquiries | Customer inquiries from the contact form |

Functions locate columns by **header name** (not position). Rows are matched by **Sale ID**.

## Edge functions
| Function | Purpose | Auth status (as reviewed) |
|---|---|---|
| create-employee | Create auth user + `employee` role | Admin check OK |
| list-employees | List staff | Admin check OK |
| update-employee-status | Activate/deactivate staff | Admin check OK |
| get-admin-overview | Aggregate revenue/stock/payment stats | Admin only (fixed) |
| get-pending-documents | Read Documents + Sold | Staff only (fixed) |
| update-documents | Write checklist, compute Handover Ready | Staff only (fixed) |
| get-pending-payments | Read sales with balance due | Staff only (fixed) |
| update-payment | Add installment to a sale | Staff only (fixed) |
| sync-to-sheets | Write stock/sale/inquiry rows to Sheet + Supabase | Staff only; public path = validated `inquiry` only (fixed) |
| notify-out-of-stock | Out-of-stock notification | Staff only (fixed) |
| seed-stock-sheet | Seed Stock tab | Admin only (fixed) |

`config.toml` keeps `verify_jwt = false`; the real check is inside each function (`_shared/auth.ts`). CORS is limited by the `ALLOWED_ORIGIN` secret.

## Target security design
- Shared helper `_shared/auth.ts`: validate JWT with anon-key client, look up role in `user_roles` with service-role client, return caller.
- Roles: admin-only (`get-admin-overview`, `seed-stock-sheet`, employee management); admin+employee (documents, payments, stock/sales sync, notify).
- Split `sync-to-sheets`: public `submit-inquiry` (rate-limited, validated, Inquiries only) and staff-only sales/stock sync.
- `verify_jwt = true`, CORS limited to the production domain.
- Commit `supabase/migrations` with schema and RLS policies.

## Environment variables
- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Edge functions: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`

## Deployment
1. Work on `pr-preview`, merge into `main`, push (Vercel deploys `main`).
2. Deploy each changed function: `supabase functions deploy <name>`.
3. Planned: GitHub Action to automate function deploys.

## Known gaps
Unauthenticated functions, no schema/RLS in repo, no tests, very large page files (EmployeeDashboard ~960 lines), duplicated Google-auth code across functions, 17.6 MB 3D model, placeholder bike data/images, Sheets has no transactions (concurrent payment writes can collide).

## Security findings from RLS review (Nov 2026)
Policies found: any logged-in user could read `stock_logs` (holds customer name + phone), read all `inquiries`, insert fake `stock_logs`, and update any column of any bike. This is harmless while only staff log in but **unsafe once customers can sign up**. Fix: `phase0/rls-fix.sql` (staff-only policies, employees limited to quantity/availability by trigger). `offers` has RLS on with no policies (unused by frontend). `user_roles` is correctly read-own-only.

## Data model v2 (proposal; confirm before building)
Source of truth is Supabase. The Google Sheet is a synced copy for the owner.

| Table | Purpose | Notes |
|---|---|---|
| bikes (existing) | Catalogue + stock | add `price`; public read |
| bike_colors | Colour options per bike | bike_id, name, hex, image_url, sort |
| parts | Accessories | name, category, price, stock_qty, images, `is_pinned`, `fits_all`, active |
| part_costs | **Cost price**, admin-only | separate table so the public-readable `parts` never exposes it |
| bike_parts | Which parts fit which bike | many-to-many; `fits_all` parts show on every bike |
| discounts | % discounts | target_type (bike/part), target_id (null = all of that type), percent, starts_at, ends_at, active. A product-specific discount overrides an "all" discount (to confirm) |
| profiles | Customer details | user_id, name, phone, address |
| orders / order_items | Online orders | items store price, discount and cost **snapshots** so history never changes |
| payments | Gateway records | order_id, provider, provider_ref, status |
| sales fields (stock_logs) | Sale adjustments | original_price, discount_type/value, paperwork_charge, modification_charge, modification_note, final_price, approval_status, approved_by |
| sale_items | Extra products sold with a bike | sale_id, part_id, qty, unit price, cost snapshot |
| reviews | Customer feedback | name, rating, text, photo, consent, published |

Roles: `admin`, `employee`; a customer is a signed-in user with **no** `user_roles` row. Staff-only functions already reject them.

## Order and payment flow
1. Customer cart -> checkout. **Server recalculates all prices** from the database (never trust the browser).
2. COD: order is created as Confirmed, payment_status = Pending (collected on delivery).
3. Online: edge function initiates the gateway payment; on return, the server **verifies with the gateway** before marking Paid. Gateway secrets live only in Supabase secrets.
4. Order Confirmed -> email to customer, row in employee order queue, row in Sheet "Orders" tab.
5. Employee: New -> Packed -> Shipped (courier + tracking no.) -> Delivered. Owner: overview + Sheet.
6. Delivery fee: Rs 500, or Rs 250 when paid online.

Payment gateways (decided order): COD first -> Khalti (web checkout: initiate, redirect, callback, lookup; free sandbox; needs a merchant account for live) -> Fonepay dynamic QR for "scan from any app" (needs merchant credentials from the bank/Fonepay; fees unverified).

## Customer login
Supabase Auth: Google, email OTP, email + password. Phone number is collected as a profile field. Logging in *by phone number* needs an SMS provider (cost) and is not planned. Email sending needs a custom email (SMTP) provider for real traffic.

## Storage
Supabase Storage bucket `product-images` (public read, admin write) for bike, colour, part and review images.