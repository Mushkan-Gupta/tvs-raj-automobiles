import { validateOrderInput } from "./order_input.ts";

const P1 = "aaaaaaaa-0000-0000-0000-000000000001";
const P2 = "aaaaaaaa-0000-0000-0000-000000000002";
const base = () => ({
  request_id: "c0000000-0000-0000-0000-000000000001",
  delivery_method: "delivery",
  payment_method: "cod",
  name: "  Asha   Rai ",
  phone: "98123-45678",
  address: { city: "Lahan", area: "Ward 3", landmark: "near temple" },
  items: [{ part_id: P1, qty: 2 }, { part_id: P2, qty: 1 }],
});

function assert(c: unknown, m: string) { if (!c) throw new Error("FAIL: " + m); }

Deno.test("valid delivery order is cleaned", () => {
  const r = validateOrderInput(base());
  assert(r.ok, "should be ok");
  if (r.ok) {
    assert(r.value.name === "Asha Rai", "name trimmed");
    assert(r.value.phone === "9812345678", "phone cleaned");
    assert(r.value.items.length === 2, "items kept");
  }
});

Deno.test("pickup needs no address and drops it", () => {
  const b = base(); b.delivery_method = "pickup"; b.address = { city: "", area: "", landmark: "" };
  const r = validateOrderInput(b);
  assert(r.ok && r.value.city === null && r.value.area === null, "address null for pickup");
});

Deno.test("delivery without city/area rejected", () => {
  const b = base(); b.address = { city: "", area: "", landmark: "x" };
  assert(!validateOrderInput(b).ok, "must reject");
});

Deno.test("prices and fees from the browser are ignored", () => {
  const b = { ...base(), total: 1, delivery_fee: 0, items: [{ part_id: P1, qty: 1, price: 1, unit_price: 1 }] };
  const r = validateOrderInput(b);
  assert(r.ok, "ok");
  if (r.ok) assert(JSON.stringify(r.value).indexOf("price") === -1 && !("total" in r.value), "no price fields pass through");
});

Deno.test("bad inputs rejected", () => {
  const bad: Record<string, unknown>[] = [
    { ...base(), request_id: "nope" },
    { ...base(), delivery_method: "courier" },
    { ...base(), payment_method: "khalti" },
    { ...base(), payment_method: "card" },
    { ...base(), name: "A" },
    { ...base(), phone: "12" },
    { ...base(), items: [] },
    { ...base(), items: "x" },
    { ...base(), items: [{ part_id: P1, qty: 0 }] },
    { ...base(), items: [{ part_id: P1, qty: 100 }] },
    { ...base(), items: [{ part_id: P1, qty: 1.5 }] },
    { ...base(), items: [{ part_id: "bad", qty: 1 }] },
    { ...base(), items: [{ part_id: P1, qty: 1 }, { part_id: P1.toUpperCase(), qty: 1 }] },
    { ...base(), items: Array.from({ length: 51 }, (_, i) => ({ part_id: `aaaaaaaa-0000-0000-0000-${String(i).padStart(12, "0")}`, qty: 1 })) },
  ];
  for (const b of bad) assert(!validateOrderInput(b).ok, "should reject " + JSON.stringify(b).slice(0, 80));
});
