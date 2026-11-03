// =============================================================================
// pricing.test.ts — Deno unit tests for computeSale / getEffectiveBikePrice
// Run: deno test supabase/functions/_shared/pricing.test.ts
// =============================================================================

import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { computeSale, getEffectiveBikePrice } from "./pricing.ts";

// ── getEffectiveBikePrice ─────────────────────────────────────────────────────

Deno.test("getEffectiveBikePrice returns bike.price", () => {
  assertEquals(getEffectiveBikePrice({ price: 264900 }), 264900);
});

Deno.test("getEffectiveBikePrice returns null when price is null", () => {
  assertEquals(getEffectiveBikePrice({ price: null }), null);
});

Deno.test("getEffectiveBikePrice ignores offer_price", () => {
  // offer_price is intentionally ignored until A3
  assertEquals(getEffectiveBikePrice({ price: 264900, offer_price: 200000 }), 264900);
});

// ── computeSale: 5% discount ──────────────────────────────────────────────────

Deno.test("5% discount on 264900 → discount_amount=13245, sold_price=251655", () => {
  const r = computeSale({
    bikePrice: 264900,
    quantity: 1,
    discount: { type: "percent", value: 5 },
    paperwork: 0,
    modification: 0,
    extras: [],
  });
  assertEquals(r.base, 264900);
  assertEquals(r.discount_amount, 13245);
  assertEquals(r.sold_price, 251655);
  assertEquals(r.needs_approval, false);
  assertEquals(r.final_price, 251655);
});

// ── exactly 10% must NOT need approval ───────────────────────────────────────

Deno.test("exactly 10% (Rs 26490) → needs_approval=false", () => {
  const r = computeSale({
    bikePrice: 264900,
    quantity: 1,
    discount: { type: "amount", value: 26490 },
    paperwork: 0,
    modification: 0,
    extras: [],
  });
  assertEquals(r.discount_amount, 26490);
  assertEquals(r.needs_approval, false);
});

// ── Rs 26491 → needs approval ─────────────────────────────────────────────────

Deno.test("Rs 26491 discount → needs_approval=true", () => {
  const r = computeSale({
    bikePrice: 264900,
    quantity: 1,
    discount: { type: "amount", value: 26491 },
    paperwork: 0,
    modification: 0,
    extras: [],
  });
  assertEquals(r.discount_amount, 26491);
  assertEquals(r.needs_approval, true);
});

// ── paperwork + modification + extras added correctly ─────────────────────────

Deno.test("paperwork + modification + 2 extras added to final_price", () => {
  const r = computeSale({
    bikePrice: 264900,
    quantity: 1,
    discount: null,
    paperwork: 2000,
    modification: 1500,
    extras: [
      { unitPrice: 800, qty: 2 },
    ],
  });
  // base = 264900, sold_price = 264900, extras_total = 1600
  // final = 264900 + 2000 + 1500 + 1600 = 270000
  assertEquals(r.base, 264900);
  assertEquals(r.sold_price, 264900);
  assertEquals(r.extras_total, 1600);
  assertEquals(r.final_price, 270000);
  assertEquals(r.needs_approval, false);
});

// ── discount larger than base is rejected ─────────────────────────────────────

Deno.test("discount larger than base throws", () => {
  assertThrows(
    () =>
      computeSale({
        bikePrice: 264900,
        quantity: 1,
        discount: { type: "amount", value: 300000 },
        paperwork: 0,
        modification: 0,
        extras: [],
      }),
    Error,
    "cannot exceed base price"
  );
});

// ── negative discount value rejected ─────────────────────────────────────────

Deno.test("negative discount value throws", () => {
  assertThrows(
    () =>
      computeSale({
        bikePrice: 264900,
        quantity: 1,
        discount: { type: "amount", value: -1 },
        paperwork: 0,
        modification: 0,
        extras: [],
      }),
    Error,
    "non-negative"
  );
});

// ── 10% percent discount exactly, multi-unit ─────────────────────────────────

Deno.test("10% percent discount exact boundary, qty=2", () => {
  // base = 264900*2 = 529800, 10% = 52980 → exactly at boundary
  const r = computeSale({
    bikePrice: 264900,
    quantity: 2,
    discount: { type: "percent", value: 10 },
    paperwork: 0,
    modification: 0,
    extras: [],
  });
  assertEquals(r.base, 529800);
  assertEquals(r.discount_amount, 52980);
  assertEquals(r.needs_approval, false);
});

// ── needs_approval is based on bike price only, not extras ───────────────────

Deno.test("approval threshold is on bike base only, not extras", () => {
  // 10% of 264900 = 26490 → exactly boundary → no approval
  // Even with large extras, needs_approval stays false
  const r = computeSale({
    bikePrice: 264900,
    quantity: 1,
    discount: { type: "amount", value: 26490 },
    paperwork: 5000,
    modification: 3000,
    extras: [{ unitPrice: 10000, qty: 5 }],
  });
  assertEquals(r.needs_approval, false);
  // final_price = 264900 - 26490 + 5000 + 3000 + 50000 = 296410
  assertEquals(r.final_price, 296410);
});

