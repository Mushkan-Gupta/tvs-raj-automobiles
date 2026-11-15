import { buildOrderRow, itemsText, ORDERS_HEADERS } from "./orders_sheet.ts";

function assert(c: unknown, m: string) { if (!c) throw new Error("FAIL: " + m); }

const order = {
  order_no: "TVS-001001",
  created_at: "2026-11-15T09:30:00Z",
  customer_name: "Asha Rai",
  customer_phone: "+9779812345678",
  delivery_method: "delivery",
  ship_city: "Lahan",
  ship_area: "Ward 3",
  ship_landmark: null,
  ship_note: "Call first",
  subtotal: 14800,
  delivery_fee: 500,
  total: 15300,
  payment_method: "cod",
  payment_status: "unpaid",
  status: "new",
};
const items = [{ part_name: "Helmet", qty: 2 }, { part_name: "Gloves", qty: 1 }];

Deno.test("items text", () => {
  assert(itemsText(items) === "Helmet x2; Gloves x1", "items joined");
});

Deno.test("row follows the sheet's own header order and uses friendly labels", () => {
  const row = buildOrderRow(ORDERS_HEADERS, order, items);
  assert(row.length === ORDERS_HEADERS.length, "same length as headers");
  assert(row[0] === "TVS-001001", "order no first");
  assert(row[ORDERS_HEADERS.indexOf("Total")] === 15300, "total is a number");
  assert(row[ORDERS_HEADERS.indexOf("Payment Method")] === "Cash on delivery", "label");
  assert(row[ORDERS_HEADERS.indexOf("Status")] === "New", "status label");
  assert(row[ORDERS_HEADERS.indexOf("Phone")] === "+9779812345678", "phone kept as text");
});

Deno.test("a sheet with headers in another order still gets the right values", () => {
  const custom = ["Total", "Order No", "Extra Column", "Status"];
  const row = buildOrderRow(custom, order, items);
  assert(row[0] === 15300 && row[1] === "TVS-001001" && row[2] === "" && row[3] === "New", "mapped by name");
});

Deno.test("no cost fields in the order row", () => {
  assert(!ORDERS_HEADERS.some((h) => /cost|profit/i.test(h)), "no cost columns");
});
