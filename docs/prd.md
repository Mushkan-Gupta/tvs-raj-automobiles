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

## 5. Scope by phase
| Phase | Scope |
|---|---|
| 0 | Security fixes: authentication/role checks on all edge functions, schema + RLS in repo |
| 1 | Public site redesign (designed in Google Stitch first), real bike data with real prices, mobile-first, iOS + Android tested |
| 2 | Redesign of employee and admin portals, mobile and desktop |
| 3 | Nepali language for the **public site only** (admin/employee stay English) |

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
- Any new features beyond redesign (online booking, EMI calculator, test-ride request)? Not decided.
- Brand colours and visual direction: to be decided after the first Stitch designs.
- Real bike list, prices and images: to be collected from the showroom.
- Final Nepali translations and who provides them.
