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
| get-admin-overview | Aggregate revenue/stock/payment stats | **No auth** |
| get-pending-documents | Read Documents + Sold | **No auth** |
| update-documents | Write checklist, compute Handover Ready | **No auth** |
| get-pending-payments | Read sales with balance due | **No auth** |
| update-payment | Add installment to a sale | **No auth** |
| sync-to-sheets | Write stock/sale/inquiry rows to Sheet + Supabase | **No auth** (also used by public contact form) |
| notify-out-of-stock | Out-of-stock notification | **No auth** |
| seed-stock-sheet | Seed Stock tab | **No auth** |

`config.toml` sets `verify_jwt = false` for 9 of them. CORS is `*` everywhere.

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
