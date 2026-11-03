// =============================================================================
// src/lib/pricing.js — Browser copy of supabase/functions/_shared/pricing.ts
//
// IMPORTANT: Keep this file identical to supabase/functions/_shared/pricing.ts
// Any change in either file must be reflected in the other.
//
// offer_price usage in the codebase (ignored in getEffectiveBikePrice; A3 adds discounts):
//   - get-admin-overview/index.ts line 138: SupabaseBike interface declares offer_price?
//   - get-admin-overview/index.ts line 146: fetched via REST select
//   - get-admin-overview/index.ts line 374: used as price fallback for stock valuation
//   - get-admin-overview/index.ts line 397: used as price fallback (supabase bikes fallback)
// A3 will replace offer_price with a proper discounts table lookup here.
// =============================================================================

/**
 * Returns the effective (display) bike price.
 * For now returns bike.price as-is.
 * A3 will add active discount lookup (percent off, start/end date).
 * offer_price is intentionally ignored here (see file header).
 *
 * @param {object} bike
 * @returns {number|null}
 */
export function getEffectiveBikePrice(bike) {
  if (bike.price === undefined || bike.price === null) return null;
  const p = Number(bike.price);
  return isNaN(p) ? null : p;
}

/**
 * Pure sale computation. All money rounded to 2 decimal places.
 * Throws an Error if any input is invalid.
 *
 * @param {{
 *   bikePrice: number,
 *   quantity: number,
 *   discount: {type:'percent'|'amount', value:number}|null,
 *   paperwork: number,
 *   modification: number,
 *   extras: Array<{unitPrice:number, qty:number}>
 * }} input
 * @returns {{
 *   base: number,
 *   discount_amount: number,
 *   discount_percent_effective: number,
 *   sold_price: number,
 *   extras_total: number,
 *   final_price: number,
 *   needs_approval: boolean
 * }}
 */
export function computeSale({ bikePrice, quantity, discount, paperwork, modification, extras }) {
  // ── Input guards ──────────────────────────────────────────────────────────
  if (!Number.isFinite(bikePrice) || bikePrice < 0)
    throw new Error("bikePrice must be a non-negative finite number");
  if (!Number.isInteger(quantity) || quantity < 1)
    throw new Error("quantity must be a positive integer");
  if (!Number.isFinite(paperwork) || paperwork < 0)
    throw new Error("paperwork must be a non-negative number");
  if (!Number.isFinite(modification) || modification < 0)
    throw new Error("modification must be a non-negative number");
  for (const ex of extras) {
    if (!Number.isFinite(ex.unitPrice) || ex.unitPrice < 0)
      throw new Error("extra unitPrice must be non-negative");
    if (!Number.isInteger(ex.qty) || ex.qty < 1)
      throw new Error("extra qty must be a positive integer");
  }

  // ── Core calculations ─────────────────────────────────────────────────────
  const base = round2(bikePrice * quantity);

  let discount_amount = 0;
  if (discount !== null) {
    if (!Number.isFinite(discount.value) || discount.value < 0)
      throw new Error("discount.value must be a non-negative number");

    discount_amount =
      discount.type === "percent"
        ? round2(base * discount.value / 100)
        : round2(discount.value);

    if (discount_amount > base)
      throw new Error(
        `discount_amount (${discount_amount}) cannot exceed base price (${base})`
      );
  }

  const sold_price = round2(base - discount_amount);
  const extras_total = round2(
    extras.reduce((sum, ex) => sum + ex.unitPrice * ex.qty, 0)
  );
  const final_price = round2(sold_price + paperwork + modification + extras_total);
  const discount_percent_effective =
    base > 0 ? round2((discount_amount / base) * 100) : 0;

  // Threshold: discount_amount > base * 10% + epsilon (0.005 handles float rounding)
  // Exactly 10% does NOT trigger approval.
  const needs_approval = discount_amount > base * 0.10 + 0.005;

  return {
    base,
    discount_amount,
    discount_percent_effective,
    sold_price,
    extras_total,
    final_price,
    needs_approval,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

