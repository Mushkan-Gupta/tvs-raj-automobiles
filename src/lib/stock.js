/**
 * Computes a part's available quantity for customers:
 * Math.max(0, stock_qty - reserved_qty)
 *
 * Real stock_qty only decreases when staff ships an order.
 * reserved_qty is held while orders are new or packed.
 * Customers never see reserved_qty as a raw number.
 */
export const availableQty = (p) =>
  Math.max(
    0,
    Math.floor(Number(p?.stock_qty) || 0) - Math.floor(Number(p?.reserved_qty) || 0)
  );
