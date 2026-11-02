# PRD — TVS Raj Automobiles Web System

## 1. Overview
A website and staff management system for **TVS Raj Automobiles**, a TVS motorcycle dealership in Lahan, Siraha, Nepal. It has three parts:

| Part | Users | Purpose |
|---|---|---|
| Public website | Customers | Browse real bikes and prices, offers, finance info, send inquiries, WhatsApp contact |
| Employee portal | Showroom staff | Log stock arrivals and sales, track buyer documents, record installment payments |
| Admin portal | Owner | Business overview, inventory, employee management |

## 2. Goals
1. Customers can find a bike, see its real price, and contact the showroom easily on any phone.
2. Staff can log a sale and track documents/payments without touching the Google Sheet.
3. Owner can see revenue, stock and pending handovers at a glance.
4. Customer and sales data is only accessible to authorised staff.

## 3. Users and devices
- Customers: mostly mobile.
- Staff and admin: both mobile and desktop.
- Must work well on **iOS (Safari) and Android (Chrome)** plus desktop browsers.

## 4. Existing features (already built)
- Public: Home (3D bike hero), bike listing with filters, bike detail, offers, finance, about, contact/inquiry form, floating WhatsApp button, staff login link.
- Staff login with roles (`admin`, `employee`) stored in `user_roles`.
- Employee dashboard: stock arrival and bike sold entry (Sold Price, Buyer Type, Payment Status, Amount Paid, customer name/phone), inquiry status updates.
- Pending Documents: per-sale checklist (Individual: Citizenship/NID/Passport, Driving License, Passport Photos, PAN Card. Corporate: Company Registration, Company PAN/VAT, Board Authorization Letter, Authorized Signatory ID). Handover Ready is computed when all are ticked. Used for Namsari at Yatayat.
- Pending Payments: record installments against a sale's Balance Due.
- Admin: Business Overview (revenue, units, payment status, buyer split, sales by model, pending handovers, 6-month trend, stock value, low-stock alerts), inventory dashboard, manage employees (create, list, activate/deactivate).
- Monthly dashboard email via Google Apps Script.

## 5. Scope by phase (updated Nov 2026)
Owner/admin + employee features come first. Customer-facing work and the UI redesign (Stitch, 3D bike, Nepali) come after.

| Track | Step | Scope |
|---|---|---|
| Security | 0 | Edge-function auth (done), RLS fix (`phase0/rls-fix.sql`), employee password rule |
| 1 Owner + Employee | A1 | Bike price (admin-editable), parts catalogue with photo, price, cost price, stock, pinned parts |
| 1 | A2 | Employee sale form v2: auto price, discount / paperwork / modification, extra products, approval for discount > 10%, new Sheet columns |
| 1 | A3 | Discounts: admin only, %, start/end date, per product + apply-all-bikes + apply-all-parts |
| 1 | A4 | Admin overview: final price, profit from parts, approval queue |
| 2 Customer | B1 | Public catalogue from DB, colours + per-colour image, parts under each bike, discount display, reviews |
| 2 | B2 | Customer accounts, cart, checkout, COD + online payment, orders, employee order queue, notifications |
| 3 | B3 | UI redesign (Stitch, 3D viewer, Ducati-style bike page), then Nepali for public site |

## 6. Requirements
### Functional
- FR1: Bike catalogue shows real models, specs, images and prices supplied by the showroom.
- FR2: Customer inquiry form saves to Supabase and the Inquiries sheet tab.
- FR3: Every sale has a unique Sale ID linking Sold and Documents tabs.
- FR4: Handover Ready is true only when all required documents for the buyer type are ticked.
- FR5: Payment Status reflects Amount Paid vs Sold Price (Fully Paid / Pending).
- FR6: Only admins can create employees or view the Business Overview.

### Non-functional
- NFR1: Public pages load fast on mobile data (3D model compressed and lazy-loaded).
- NFR2: Layouts responsive from small phones to desktop; touch-friendly staff forms.
- NFR3: Public text is i18n-ready so Nepali can be added later.
- NFR4: No unauthenticated access to customer, payment or revenue data.

## 7. Non-goals (for now)
- Nepali in admin/employee portals.
- Replacing Google Sheets as the back office.

## 8. Open questions
- Any extra features beyond section 9 (EMI calculator, test-ride request)? Not decided.
- Brand colours and visual direction: to be decided after the first Stitch designs.
- Real bike list, prices and images: to be collected from the showroom.
- Final Nepali translations and who provides them.

## 9. Commerce features (decided)
### 9.1 Bike page (Ducati-style layout)
- Bike on the left, colour swatches under it (changing colour swaps the bike image), parts list on the right (by category, price, add button).
- **Bikes cannot be bought online: "Enquire" only (no login needed).**
- **Parts can be bought directly** without buying a bike. Account required to order parts.
- Parts list order: pinned parts first (TVS-logo helmets), then the rest. Admin controls pinning.

### 9.2 Pricing and discounts
- Placeholder prices for now; **admin can edit any price at any time** (owner sometimes raises price before discounting).
- Discount: **admin only**, percent only, start and end date, per product, plus two separate buttons: apply to all bikes / apply to all parts.
- Public display: original price struck through, discounted price, "% off".

### 9.3 Employee sale form
- Select bike -> price fills automatically (the discounted price if a discount is active). No manual price typing.
- Optional adjustment boxes, any combination: **Discount** (subtracts; % or Rs via dropdown), **Paperwork charge** (adds), **Modification charge** (adds, with a short note). Each has an amount field.
- Employee discount up to **10%** is free; **above 10% needs admin approval** (sale saved as "Pending Approval", admin approves in the admin portal).
- Employee can add **extra products** (helmet etc.) with quantity; price comes from the catalogue; stock reduces on sale.
- Everything is saved to the database and the Google Sheet.

### 9.4 Customer shop (parts)
- Login options: Google, email OTP, email/phone + password (see architecture.md for the phone-login constraint).
- Checkout: payment like normal shopping apps (no screenshots, no manual owner contact). COD supported. Online payment is confirmed automatically by the server.
- Delivery fee: **Rs 500 anywhere in Nepal; Rs 250 if paid online (prepaid).**
- After payment: customer gets an "order confirmed" notification; the order appears in the **employee** order queue; employee packs and ships; **owner only sees overview and the Google Sheet**.
- Parts stock is tracked; out-of-stock is shown.

### 9.5 Admin
- Add a new bike or part (photos, colours, price, cost price, stock, compatible bikes); it appears on the website immediately.
- Edit price, photo and details later.
- Overview adds: **profit from parts** (selling price minus cost price, both showroom sales and online orders), orders summary.
- Reviews & feedback: customers submit; owner picks which to publish (only with the customer's consent).

### 9.6 Images and reviews
- One neutral placeholder image (original illustration, no third-party copyright) until real photos are uploaded by the owner. Owner can replace images per bike and per colour.
- Reviews: only real customer reviews with permission. Do not copy reviews from other sites.