import { validateStatusInput } from "./order_status_input.ts";

function assert(c: unknown, m: string) { if (!c) throw new Error("FAIL: " + m); }
const ID = "aaaaaaaa-0000-0000-0000-000000000001";

Deno.test("valid shipped with courier", () => {
  const r = validateStatusInput({ order_id: ID, status: "shipped", courier: " Gaurav  Cargo ", tracking_no: "GC1" });
  assert(r.ok && r.value.courier === "Gaurav Cargo" && r.value.tracking_no === "GC1", "cleaned");
});

Deno.test("cancel needs a reason", () => {
  assert(!validateStatusInput({ order_id: ID, status: "cancelled" }).ok, "no reason rejected");
  assert(!validateStatusInput({ order_id: ID, status: "cancelled", reason: "x" }).ok, "short reason rejected");
  assert(validateStatusInput({ order_id: ID, status: "cancelled", reason: "customer asked" }).ok, "reason accepted");
});

Deno.test("bad inputs rejected", () => {
  assert(!validateStatusInput({ order_id: "x", status: "packed" }).ok, "bad id");
  assert(!validateStatusInput({ order_id: ID, status: "new" }).ok, "cannot set back to new");
  assert(!validateStatusInput({ order_id: ID, status: "refunded" }).ok, "unknown status");
});
