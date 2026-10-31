# Design Brief (for Google Stitch)

Status: direction not final. Generate designs in Stitch first, review, then adjust this file.

## Brand
- Business: TVS Raj Automobiles, authorised TVS motorcycle dealer, Lahan, Siraha, Nepal.
- Tone: trustworthy, local, premium-but-approachable. Not a generic template.
- Current theme (existing site): dark background `#0b0f19`, accent blue `#0066CC`, glass-style panels. Keep, change or replace after Stitch exploration.

## Platform rules
- Mobile-first. Must work on iOS Safari and Android Chrome, then tablet and desktop.
- Touch targets at least 44x44 px. No hover-only interactions.
- Respect iOS safe areas (notch, home indicator). Avoid 100vh bugs on mobile browsers.
- Readable on low-end Android phones and slow networks.
- Text and layout must tolerate longer Nepali text later (public site only): no fixed-width labels, avoid text baked into images.
- Accessible contrast (WCAG AA), visible focus states, labelled form fields.

## Phase 1: Public site screens (design first)
1. **Home**: hero (bike showcase; 3D optional and lazy-loaded), featured bikes, offers strip, why-choose-us, reviews, showroom location, contact CTA.
2. **Bike listing**: search, filters (category, price range, engine cc, fuel type), sort, bike cards with price and stock tag.
3. **Bike detail**: image gallery, price, key specs, description, in-stock status, "Enquire" and WhatsApp CTAs.
4. **Offers**.
5. **Finance** (EMI/finance info).
6. **About**.
7. **Contact**: inquiry form, phone, WhatsApp, map/address, opening hours.
8. Shared: navbar (with small "Staff login" link), footer, floating WhatsApp button, promo banner.

## Phase 2: Staff screens (later)
- Staff login.
- Employee dashboard: stock arrival and sale entry (one-handed phone use), inquiries list.
- Pending Documents: checklist per sale, Handover Ready badge.
- Pending Payments: sale balance, add installment.
- Admin: Business Overview (KPI cards, charts, stock alerts), inventory, manage employees.
- Cross-portal navigation (AdminNav).
- English only.

## Components to define
Buttons, inputs, selects, range slider (price), cards (bike, offer, KPI), badges (stock, payment status, handover), tables that collapse to cards on mobile, modals/sheets, toasts, empty and loading states.

## Content needs (from showroom)
Real bike list, real prices (NPR), real specs, real photos, offers, address, phone, WhatsApp number, hours.

## Stitch workflow
1. Give Stitch `prd.md` + this file and ask for the Phase 1 screens, mobile first.
2. Review and choose a direction; record it in `memory.md`.
3. Update this file with final colours, fonts, spacing and component rules.
4. Export or hand the designs to the coding tool, one screen at a time.
