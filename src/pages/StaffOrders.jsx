import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  RefreshCw,
  Search,
  X,
  Truck,
  Store,
  Package,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Phone,
  MapPin,
  StickyNote,
  Loader2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatNPR } from '../lib/formatters';
import { OrderStatusBadge } from './Orders';
import { useStaffBadges } from '../lib/StaffBadgeContext';

// ─── helpers ───────────────────────────────────────────────────────────────

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function itemSummary(items) {
  if (!items || items.length === 0) return 'No items';
  if (items.length === 1) return `${items[0].part_name} ×${items[0].qty}`;
  return items
    .slice(0, 2)
    .map((i) => `${i.part_name} ×${i.qty}`)
    .join(', ') + (items.length > 2 ? ` +${items.length - 2} more` : '');
}

// ─── focus trap ────────────────────────────────────────────────────────────

function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const focusable = el.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    el.addEventListener('keydown', trap);
    // Move focus into the panel
    const prevFocus = document.activeElement;
    first?.focus();
    return () => {
      el.removeEventListener('keydown', trap);
      prevFocus?.focus();
    };
  }, [ref, active]);
}

// ─── tabs config ───────────────────────────────────────────────────────────

const TABS = [
  { key: 'new', label: 'New' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

const EMPTY_MESSAGES = {
  new: 'No new orders',
  packed: 'No packed orders',
  shipped: 'No shipped orders',
  delivered: 'No delivered orders',
  cancelled: 'No cancelled orders',
  all: 'No orders found',
};

// ─── dialogs ───────────────────────────────────────────────────────────────

function Dialog({ open, onClose, title, children }) {
  const ref = useRef(null);
  useFocusTrap(ref, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4"
      aria-modal="true"
      role="dialog"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        className="relative w-full sm:max-w-md bg-[#101626] border border-[#1f293d] rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[#1f293d]">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-[#1f293d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function ShipDialog({ open, onClose, onConfirm, loading, error }) {
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');

  // Reset on open
  useEffect(() => {
    if (open) { setCourier(''); setTracking(''); }
  }, [open]);

  const valid = courier.trim().length >= 2;

  return (
    <Dialog open={open} onClose={onClose} title="Ship order">
      <p className="text-sm text-gray-400 mb-4">
        Enter courier details. Stock leaves the shelf when you confirm.
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1" htmlFor="ship-courier">
            Courier name <span className="text-red-400">*</span>
          </label>
          <input
            id="ship-courier"
            type="text"
            value={courier}
            onChange={(e) => setCourier(e.target.value)}
            placeholder="e.g. Sajilo Courier"
            className="w-full bg-[#0b0f19] border border-[#1f293d] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff]"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1" htmlFor="ship-tracking">
            Tracking number <span className="text-gray-600">(optional)</span>
          </label>
          <input
            id="ship-tracking"
            type="text"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="e.g. SAJ-20261115-001"
            className="w-full bg-[#0b0f19] border border-[#1f293d] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff]"
          />
        </div>
        {error && (
          <div className="flex items-start gap-2 bg-red-950/40 border border-red-800/60 rounded-xl px-3 py-2.5 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 min-h-[44px] rounded-xl border border-[#1f293d] text-sm text-gray-300 hover:text-white hover:bg-[#1f293d] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || loading}
            onClick={() => onConfirm({ courier: courier.trim(), tracking_no: tracking.trim() || undefined })}
            className="flex-1 min-h-[44px] rounded-xl bg-sky-600 hover:bg-sky-500 text-sm text-white font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirm ship
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function CancelDialog({ open, onClose, onConfirm, loading, error }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const valid = reason.trim().length >= 3;

  return (
    <Dialog open={open} onClose={onClose} title="Cancel order">
      <div className="mb-4 flex items-start gap-2 bg-amber-950/40 border border-amber-700/60 rounded-xl px-3 py-2.5 text-sm text-amber-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Cancelling will release the reserved stock back to available inventory.</span>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1" htmlFor="cancel-reason">
            Reason <span className="text-red-400">*</span>
          </label>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer requested cancellation"
            rows={3}
            className="w-full bg-[#0b0f19] border border-[#1f293d] rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff] resize-none"
          />
        </div>
        {error && (
          <div className="flex items-start gap-2 bg-red-950/40 border border-red-800/60 rounded-xl px-3 py-2.5 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 min-h-[44px] rounded-xl border border-[#1f293d] text-sm text-gray-300 hover:text-white hover:bg-[#1f293d] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff] disabled:opacity-50"
          >
            Go back
          </button>
          <button
            type="button"
            disabled={!valid || loading}
            onClick={() => onConfirm({ reason: reason.trim() })}
            className="flex-1 min-h-[44px] rounded-xl bg-red-700 hover:bg-red-600 text-sm text-white font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Cancel order
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function DeliveredConfirmDialog({ open, onClose, onConfirm, loading, error }) {
  return (
    <Dialog open={open} onClose={onClose} title="Mark as delivered">
      <p className="text-sm text-gray-300 mb-4">
        Cash collected? This marks the order paid and delivered.
      </p>
      {error && (
        <div className="flex items-start gap-2 bg-red-950/40 border border-red-800/60 rounded-xl px-3 py-2.5 text-sm text-red-300 mb-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="flex-1 min-h-[44px] rounded-xl border border-[#1f293d] text-sm text-gray-300 hover:text-white hover:bg-[#1f293d] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff] disabled:opacity-50"
        >
          No, go back
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onConfirm}
          className="flex-1 min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-600 text-sm text-white font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Yes, mark delivered
        </button>
      </div>
    </Dialog>
  );
}

// ─── order detail panel ─────────────────────────────────────────────────────

function OrderDetailPanel({ order, onClose, onRefresh }) {
  const ref = useRef(null);
  useFocusTrap(ref, !!order);


  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [sheetWarning, setSheetWarning] = useState(false);
  const [toast, setToast] = useState(null);

  const [dialog, setDialog] = useState(null); // null | 'ship' | 'cancel' | 'delivered'
  const [dialogError, setDialogError] = useState(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Reset state on order change
  useEffect(() => {
    setActionError(null);
    setSheetWarning(false);
    setToast(null);
    setDialog(null);
    setDialogError(null);
  }, [order?.id]);

  // Esc to close panel (when no dialog open)
  useEffect(() => {
    if (!order) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !dialog) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [order, dialog, onClose]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const callUpdateStatus = useCallback(async (body) => {
    setActionLoading(true);
    setDialogLoading(true);
    setActionError(null);
    setDialogError(null);
    try {
      const { data, error } = await supabase.functions.invoke('update-order-status', { body });
      if (error) {
        let msg = 'Something went wrong. Please try again.';
        try {
          const json = await error.context.json();
          if (json?.error) msg = json.error;
        } catch { /* network error, no json */ }
        setDialogError(msg);
        setActionError(msg);
        return;
      }
      const result = data;
      setDialog(null);
      setDialogError(null);
      setActionError(null);
      if (result?.sheet?.ok === false) {
        setSheetWarning(true);
      }
      setToast(`Order ${result?.order_no || ''} updated to "${body.status}".`);
      await onRefresh(); // also refreshes the sidebar badge
    } catch {
      const netMsg = 'Network error. Please check your connection.';
      setDialogError(netMsg);
      setActionError(netMsg);
    } finally {
      setActionLoading(false);
      setDialogLoading(false);
    }
  }, [onRefresh]);

  if (!order) return null;

  const isDelivery = order.delivery_method === 'delivery';
  const status = order.status;
  const isReadOnly = status === 'delivered' || status === 'cancelled';

  const actionBtn = (label, onClick, colorClass, Icon) => (
    <button
      type="button"
      onClick={onClick}
      disabled={actionLoading || dialogLoading}
      className={`flex items-center gap-2 px-4 min-h-[44px] rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff] disabled:opacity-50 disabled:cursor-not-allowed ${colorClass}`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );

  return (
    <>
      {/* Panel overlay (mobile) */}
      <div
        className="lg:hidden fixed inset-0 z-50 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Order ${order.order_no}`}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md lg:max-w-[420px] bg-[#0a0e17] border-l border-[#1f293d] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1f293d] shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-[#1f293d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff]"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-white">{order.order_no}</span>
              <OrderStatusBadge status={status} />
            </div>
            <p className="text-xs text-gray-500">{formatDateTime(order.created_at)}</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Toast */}
          {toast && (
            <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-700/60 rounded-xl px-3 py-2.5 text-sm text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toast}</span>
            </div>
          )}

          {/* Sheet warning */}
          {sheetWarning && (
            <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-700/60 rounded-xl px-3 py-2.5 text-sm text-amber-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Order updated, but the Google Sheet could not be updated. The admin can fix it from the Sheet.</span>
            </div>
          )}

          {/* General error */}
          {actionError && (
            <div className="flex items-start gap-2 bg-red-950/40 border border-red-800/60 rounded-xl px-3 py-2.5 text-sm text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{actionError}</span>
            </div>
          )}

          {/* Customer */}
          <section>
            <h3 className="text-xs font-medium text-gray-500 mb-2">Customer</h3>
            <p className="text-sm text-white font-medium">{order.customer_name || '—'}</p>
            {order.customer_phone && (
              <a
                href={`tel:${order.customer_phone}`}
                className="inline-flex items-center gap-1.5 mt-1 text-sm text-[#4da3ff] hover:underline"
              >
                <Phone className="w-3.5 h-3.5" />
                {order.customer_phone}
              </a>
            )}
          </section>

          {/* Delivery */}
          <section>
            <h3 className="text-xs font-medium text-gray-500 mb-2">Delivery</h3>
            {isDelivery ? (
              <div className="flex items-start gap-2 text-sm text-gray-300">
                <MapPin className="w-4 h-4 shrink-0 mt-0.5 text-gray-500" />
                <span>
                  {[order.delivery_city, order.delivery_area, order.delivery_landmark]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <Store className="w-4 h-4 shrink-0 text-gray-500" />
                Customer will pick up at shop
              </div>
            )}
          </section>

          {/* Courier (if shipped) */}
          {order.courier && (
            <section>
              <h3 className="text-xs font-medium text-gray-500 mb-2">Courier</h3>
              <p className="text-sm text-gray-300">{order.courier}</p>
              {order.tracking_no && (
                <p className="text-xs text-gray-500 mt-0.5">Tracking: {order.tracking_no}</p>
              )}
            </section>
          )}

          {/* Note */}
          {order.note && (
            <section>
              <h3 className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5" /> Customer note
              </h3>
              <p className="text-sm text-gray-300 italic">"{order.note}"</p>
            </section>
          )}

          {/* Cancel reason */}
          {status === 'cancelled' && order.cancel_reason && (
            <section>
              <h3 className="text-xs font-medium text-gray-500 mb-2">Cancel reason</h3>
              <p className="text-sm text-gray-300">{order.cancel_reason}</p>
            </section>
          )}

          {/* Items */}
          <section>
            <h3 className="text-xs font-medium text-gray-500 mb-2">Items</h3>
            <div className="space-y-2">
              {(order.order_items || []).map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 py-2 border-b border-[#1f293d] last:border-0"
                >
                  <span className="text-sm text-gray-200 min-w-0">
                    {item.part_name}
                    <span className="text-gray-500 ml-1">×{item.qty}</span>
                  </span>
                  <span className="text-sm text-gray-300 shrink-0">{formatNPR(item.line_total)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Totals */}
          <section className="bg-[#101626] rounded-xl p-3 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Subtotal</span>
              <span>{formatNPR(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Delivery fee</span>
              <span>{order.delivery_fee === 0 ? 'Free' : formatNPR(order.delivery_fee)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-white border-t border-[#1f293d] pt-1.5 mt-1">
              <span>Total</span>
              <span>{formatNPR(order.total)}</span>
            </div>
            <p className="text-xs text-gray-500 pt-0.5">
              {order.payment_method === 'cod' ? 'Cash on delivery' : order.payment_method}
              {' · '}
              {order.paid_at ? 'Paid' : 'Unpaid'}
            </p>
          </section>

          {/* Actions */}
          {!isReadOnly && (
            <section>
              <h3 className="text-xs font-medium text-gray-500 mb-2">Actions</h3>
              <p className="text-xs text-amber-400/80 mb-3">
                Stock leaves the shelf when you press Ship / Hand over.
              </p>
              <div className="flex flex-wrap gap-2">
                {/* Pack */}
                {status === 'new' &&
                  actionBtn('Mark packed', () => callUpdateStatus({ order_id: order.id, status: 'packed' }),
                    'bg-amber-600 hover:bg-amber-500 text-black', Package)}

                {/* Ship (delivery only) */}
                {(status === 'new' || status === 'packed') && isDelivery &&
                  actionBtn('Ship', () => { setDialogError(null); setDialog('ship'); },
                    'bg-sky-600 hover:bg-sky-500 text-white', Truck)}

                {/* Hand over (pickup) */}
                {(status === 'new' || status === 'packed') && !isDelivery &&
                  actionBtn('Hand over', () => { setDialogError(null); setDialog('delivered'); },
                    'bg-emerald-700 hover:bg-emerald-600 text-white', Store)}

                {/* Mark delivered (delivery, after shipped) */}
                {status === 'shipped' && isDelivery &&
                  actionBtn('Mark delivered', () => { setDialogError(null); setDialog('delivered'); },
                    'bg-emerald-700 hover:bg-emerald-600 text-white', CheckCircle2)}

                {/* Cancel */}
                {actionBtn('Cancel order', () => { setDialogError(null); setDialog('cancel'); },
                  'bg-transparent border border-red-800/60 text-red-400 hover:bg-red-900/20', XCircle)}
              </div>
            </section>
          )}
        </div>
      </aside>

      {/* Dialogs */}
      <ShipDialog
        open={dialog === 'ship'}
        onClose={() => { setDialog(null); setDialogError(null); }}
        loading={dialogLoading}
        error={dialogError}
        onConfirm={({ courier, tracking_no }) =>
          callUpdateStatus({ order_id: order.id, status: 'shipped', courier, tracking_no })
        }
      />
      <CancelDialog
        open={dialog === 'cancel'}
        onClose={() => { setDialog(null); setDialogError(null); }}
        loading={dialogLoading}
        error={dialogError}
        onConfirm={({ reason }) =>
          callUpdateStatus({ order_id: order.id, status: 'cancelled', reason })
        }
      />
      <DeliveredConfirmDialog
        open={dialog === 'delivered'}
        onClose={() => { setDialog(null); setDialogError(null); }}
        loading={dialogLoading}
        error={dialogError}
        onConfirm={() => callUpdateStatus({ order_id: order.id, status: 'delivered' })}
      />
    </>
  );
}

// ─── order card ─────────────────────────────────────────────────────────────

function OrderCard({ order, onClick }) {
  const isDelivery = order.delivery_method === 'delivery';
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-[#101626] border border-[#1f293d] rounded-2xl p-4 hover:border-[#0066CC]/40 hover:bg-[#0d1526] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff] group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <span className="text-sm font-bold text-white">{order.order_no}</span>
          <span className="text-xs text-gray-500 ml-2">{timeAgo(order.created_at)}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <OrderStatusBadge status={order.status} />
          <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-sm text-gray-200 font-medium">{order.customer_name || '—'}</span>
        {order.customer_phone && (
          <a
            href={`tel:${order.customer_phone}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-[#4da3ff] hover:underline ml-1 inline-flex items-center gap-0.5"
          >
            <Phone className="w-3 h-3" />
            {order.customer_phone}
          </a>
        )}
      </div>

      <p className="text-xs text-gray-500 mb-2 truncate">{itemSummary(order.order_items)}</p>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isDelivery ? (
            <span className="inline-flex items-center gap-1 text-xs bg-sky-950/50 text-sky-300 border border-sky-800/50 px-2 py-0.5 rounded-full">
              <Truck className="w-3 h-3" /> Home delivery
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs bg-[#101626] text-gray-400 border border-[#1f293d] px-2 py-0.5 rounded-full">
              <Store className="w-3 h-3" /> Shop pickup
            </span>
          )}
        </div>
        <span className="text-sm font-semibold text-white">{formatNPR(order.total)}</span>
      </div>
    </button>
  );
}

// ─── main page ──────────────────────────────────────────────────────────────

export default function StaffOrders() {
  const { setBadges } = useStaffBadges();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [activeTab, setActiveTab] = useState('new');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const panelOpen = !!selectedOrder;

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('orders')
        .select('*, order_items(part_name, qty, unit_price, line_total)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (fetchErr) throw fetchErr;
      setOrders(data || []);
      setLastFetched(new Date());
      // Update badge with new count
      const newCount = (data || []).filter((o) => o.status === 'new').length;
      setBadges({ orders: newCount });
    } catch (err) {
      setError(err.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setBadges]);

  // Initial fetch
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Poll every 60 seconds (pause while detail panel is open)
  useEffect(() => {
    if (panelOpen) return;
    const id = setInterval(() => fetchOrders(true), 60000);
    return () => clearInterval(id);
  }, [panelOpen, fetchOrders]);

  // If a selected order gets updated after refresh, keep it in sync
  useEffect(() => {
    if (!selectedOrder) return;
    const updated = orders.find((o) => o.id === selectedOrder.id);
    if (updated && updated !== selectedOrder) setSelectedOrder(updated);
  }, [orders, selectedOrder]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = activeTab === 'all' ? orders : orders.filter((o) => o.status === activeTab);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (o) =>
          (o.order_no || '').toLowerCase().includes(q) ||
          (o.customer_name || '').toLowerCase().includes(q) ||
          (o.customer_phone || '').includes(q)
      );
    }
    return list;
  }, [orders, activeTab, search]);

  // Tab counts
  const tabCounts = useMemo(() => {
    const counts = {};
    TABS.forEach((t) => {
      counts[t.key] = t.key === 'all' ? orders.length : orders.filter((o) => o.status === t.key).length;
    });
    return counts;
  }, [orders]);

  const handleRefresh = useCallback(() => fetchOrders(true), [fetchOrders]);

  const handleOrderClose = useCallback(() => setSelectedOrder(null), []);

  return (
    <div className="min-h-screen bg-[#0b0f19]">
      {/* Page header */}
      <div className="sticky top-0 z-20 bg-[#0b0f19]/95 backdrop-blur border-b border-[#1f293d]">
        <div className="px-4 lg:px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white">Online orders</h1>
            {lastFetched && (
              <p className="text-xs text-gray-500">
                Updated {timeAgo(lastFetched.toISOString())}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            aria-label="Refresh orders"
            className="flex items-center gap-2 px-3 min-h-[44px] rounded-xl border border-[#1f293d] text-sm text-gray-300 hover:text-white hover:bg-[#151c2c] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff] disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Tab bar */}
        <div className="px-4 lg:px-6 overflow-x-auto">
          <div className="flex gap-1 pb-0 min-w-max">
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              const count = tabCounts[tab.key];
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff] rounded-t-lg ${active
                    ? 'border-[#0066CC] text-[#4da3ff]'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                    }`}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full leading-none ${active
                        ? (tab.key === 'new' ? 'bg-amber-500 text-black' : 'bg-[#0066CC]/30 text-[#4da3ff]')
                        : 'bg-[#1f293d] text-gray-400'
                        }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 lg:px-6 py-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order no, name, phone…"
            className="w-full pl-9 pr-3 py-2 bg-[#101626] border border-[#1f293d] rounded-xl text-sm text-white placeholder-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff]"
          />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 lg:px-6 pb-10">
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading orders…</span>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-start gap-3 max-w-sm bg-red-950/40 border border-red-800/60 rounded-2xl px-4 py-3 text-sm text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium mb-1">Failed to load orders</p>
              <p className="text-xs text-red-400">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-2 text-xs underline hover:no-underline focus-visible:outline-none"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-10 h-10 text-gray-700 mb-3" />
            <p className="text-sm text-gray-500">
              {search ? 'No orders match your search.' : EMPTY_MESSAGES[activeTab]}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3 max-w-2xl">
            {filtered.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onClick={() => setSelectedOrder(order)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      <OrderDetailPanel
        order={selectedOrder}
        onClose={handleOrderClose}
        onRefresh={handleRefresh}
      />
    </div>
  );
}

