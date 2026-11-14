// =============================================================================
// _shared/order_input.ts
// Pure input checks for create-order (no network). Returns clean values or an
// error message. Prices are NOT accepted from the browser at all.
// =============================================================================

export interface OrderInput {
  request_id: string;
  delivery_method: "delivery" | "pickup";
  payment_method: "cod";
  name: string;
  phone: string;
  city: string | null;
  area: string | null;
  landmark: string | null;
  note: string | null;
  items: { part_id: string; qty: number }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function validateOrderInput(
  body: Record<string, unknown>,
): { ok: true; value: OrderInput } | { ok: false; error: string } {
  const request_id = text(body.request_id, 40);
  if (!UUID.test(request_id)) return { ok: false, error: "request_id must be a valid UUID." };

  const delivery_method = text(body.delivery_method, 20);
  if (delivery_method !== "delivery" && delivery_method !== "pickup") {
    return { ok: false, error: "delivery_method must be delivery or pickup." };
  }

  const payment_method = text(body.payment_method, 20);
  if (payment_method === "khalti" || payment_method === "fonepay") {
    return { ok: false, error: "This payment method is not available yet." };
  }
  if (payment_method !== "cod") {
    return { ok: false, error: "payment_method must be cod." };
  }

  const name = text(body.name, 100);
  if (name.length < 2) return { ok: false, error: "Please enter your full name." };

  const phone = String(body.phone ?? "").replace(/[\s-]/g, "");
  if (!/^\+?[0-9]{8,15}$/.test(phone)) {
    return { ok: false, error: "Please enter a valid phone number." };
  }

  const addr = (body.address ?? {}) as Record<string, unknown>;
  const city = text(addr.city, 100);
  const area = text(addr.area, 150);
  const landmark = text(addr.landmark, 150);
  const note = text(body.note, 300);
  if (delivery_method === "delivery" && (city.length < 2 || area.length < 2)) {
    return { ok: false, error: "Please enter your city and tole/village for delivery." };
  }

  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 50) {
    return { ok: false, error: "Cart must have between 1 and 50 items." };
  }
  const seen = new Set<string>();
  const items: { part_id: string; qty: number }[] = [];
  for (const raw of body.items) {
    const it = (raw ?? {}) as Record<string, unknown>;
    const part_id = text(it.part_id, 40).toLowerCase();
    const qty = Number(it.qty);
    if (!UUID.test(part_id)) return { ok: false, error: "Invalid item in cart." };
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      return { ok: false, error: "Item quantity must be between 1 and 99." };
    }
    if (seen.has(part_id)) return { ok: false, error: "Duplicate item in cart." };
    seen.add(part_id);
    items.push({ part_id, qty });
  }

  return {
    ok: true,
    value: {
      request_id: request_id.toLowerCase(),
      delivery_method,
      payment_method: "cod",
      name,
      phone,
      city: delivery_method === "delivery" ? city : null,
      area: delivery_method === "delivery" ? area : null,
      landmark: delivery_method === "delivery" && landmark ? landmark : null,
      note: note || null,
      items,
    },
  };
}
