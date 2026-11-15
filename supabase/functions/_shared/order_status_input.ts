// Pure input checks for update-order-status (no network).

export interface StatusInput {
  order_id: string;
  status: "packed" | "shipped" | "delivered" | "cancelled";
  courier: string | null;
  tracking_no: string | null;
  reason: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(v: unknown, max: number): string {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function validateStatusInput(
  body: Record<string, unknown>,
): { ok: true; value: StatusInput } | { ok: false; error: string } {
  const order_id = text(body.order_id, 40).toLowerCase();
  if (!UUID.test(order_id)) return { ok: false, error: "order_id must be a valid UUID." };

  const status = text(body.status, 20);
  if (status !== "packed" && status !== "shipped" && status !== "delivered" && status !== "cancelled") {
    return { ok: false, error: "status must be packed, shipped, delivered or cancelled." };
  }

  const courier = text(body.courier, 80);
  const tracking_no = text(body.tracking_no, 80);
  const reason = text(body.reason, 300);

  if (status === "cancelled" && reason.length < 3) {
    return { ok: false, error: "Please give a reason for cancelling." };
  }

  return {
    ok: true,
    value: {
      order_id,
      status,
      courier: courier || null,
      tracking_no: tracking_no || null,
      reason: reason || null,
    },
  };
}
