import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, TrendingUp, ShoppingCart, AlertCircle, Check,
  ChevronDown, Package, Clock, User, Phone, RefreshCw, MessageSquare,
  Banknote, Building2, CreditCard,
} from 'lucide-react';

// ─── Shared style constants ───────────────────────────────────────────────────
const inputCls =
  'w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg py-2.5 px-3 text-sm ' +
  'focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors ' +
  'placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed';

const selectCls =
  'w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg py-2.5 px-3 text-sm ' +
  'focus:outline-none focus:border-[#0066CC] appearance-none cursor-pointer ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

// ─── Field wrapper ─────────────────────────────────────────────────────────
function Field({ label, children, required }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Toast notification ────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === 'error';
  return (
    <div
      className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-xl
        shadow-2xl border text-sm font-semibold animate-in slide-in-from-top-2 duration-300
        ${isErr
          ? 'bg-red-900/90 border-red-500/50 text-red-200'
          : 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200'}`}
    >
      {isErr
        ? <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
        : <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
      <span>{toast.message}</span>
    </div>
  );
}

// ─── Activity type badge ───────────────────────────────────────────────────
function TypeBadge({ type }) {
  return type === 'arrival' ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold
      uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      <TrendingUp className="w-3 h-3" />
      Arrived
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold
      uppercase tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30">
      <ShoppingCart className="w-3 h-3" />
      Sold
    </span>
  );
}

// ─── Nepal timezone (Asia/Kathmandu, UTC+5:45) helpers ──────────────────────
function formatNepalDateTime(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kathmandu',
  });
}

function relativeTime(isoString) {
  if (!isoString) return '';
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) return `${Math.max(0, diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kathmandu',
  });
}

// ─── Status badge for inquiries ────────────────────────────────────────────
function StatusBadge({ status }) {
  let cls = 'bg-gray-500/15 text-gray-400 border-gray-500/30'; // inquired
  let text = 'Inquired';
  if (status === 'contacted') {
    cls = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    text = 'Contacted';
  } else if (status === 'visited') {
    cls = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    text = 'Visited';
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cls}`}>
      {text}
    </span>
  );
}

// ─── Inquiries List ───────────────────────────────────────────────────────
function InquiriesSection({ inquiries, loading, updateStatus }) {
  if (loading) return <div className="py-12 text-center text-gray-500 text-sm">Loading inquiries...</div>;
  if (inquiries.length === 0) return <div className="py-12 text-center text-gray-500 text-sm">No inquiries found.</div>;

  return (
    <div className="space-y-4">
      {inquiries.map(inq => (
        <div key={inq.id} className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <h3 className="text-white font-bold">{inq.name}</h3>
                <StatusBadge status={inq.status || 'inquired'} />
              </div>
              <p className="text-sm text-gray-400 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />{inq.phone}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs text-[#0066CC] font-bold uppercase tracking-wider">{inq.interested_model}</p>
              <p className="text-xs text-gray-500 mt-1.5" title={formatNepalDateTime(inq.created_at)}>
                {relativeTime(inq.created_at)}
              </p>
            </div>
          </div>
          {inq.message && (
            <div className="bg-[#151c2c] p-3.5 rounded-xl border border-[#1f293d]">
              <p className="text-sm text-gray-300 italic">"{inq.message}"</p>
            </div>
          )}
          <div className="flex items-center gap-3 pt-4 border-t border-[#1f293d]">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Update Status</span>
            <select
              value={inq.status || 'inquired'}
              onChange={(e) => updateStatus(inq.id, e.target.value)}
              className="bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0066CC] cursor-pointer"
            >
              <option value="inquired">Inquired</option>
              <option value="contacted">Contacted</option>
              <option value="visited">Visited</option>
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Bikes list ──
  const [bikes, setBikes] = useState([]);
  const [bikesLoading, setBikesLoading] = useState(true);

  // ── Form state ──
  const EMPTY_FORM = {
    bikeId: '',
    action: 'arrival',
    quantity: 1,
    customerName: '',
    customerPhone: '',
    soldPrice: '',
    buyerType: '',
    paymentStatus: '',
    amountPaid: '',
  };
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // ── Recent activity ──
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // ── Inquiries ──
  const [inquiries, setInquiries] = useState([]);
  const [inquiriesLoading, setInquiriesLoading] = useState(true);
  const [showInquiries, setShowInquiries] = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState(null);

  // ─── Helpers ───────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSoldPriceChange = (e) => {
    const val = e.target.value;
    setForm((prev) => ({
      ...prev,
      soldPrice: val,
      amountPaid: prev.paymentStatus === 'Fully Paid' ? val : prev.amountPaid,
    }));
  };

  const handlePaymentStatusChange = (e) => {
    const status = e.target.value;
    setForm((prev) => ({
      ...prev,
      paymentStatus: status,
      amountPaid: status === 'Fully Paid' ? prev.soldPrice : (status === 'Pending' && !prev.amountPaid ? '0' : prev.amountPaid),
    }));
  };

  // Strip every non-digit character as the user types; caps at 10 digits
  const setPhone = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm((prev) => ({ ...prev, customerPhone: digits }));
  };

  const selectedBike = bikes.find((b) => String(b.id) === String(form.bikeId));

  // ─── Fetch bikes ───────────────────────────────────────────────────────
  const fetchBikes = useCallback(async () => {
    setBikesLoading(true);
    const { data, error } = await supabase
      .from('bikes')
      .select('id, name, quantity, availability, low_stock_threshold')
      .order('name');
    if (!error) setBikes(data || []);
    setBikesLoading(false);
  }, []);

  // ─── Fetch recent logs ─────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    const { data, error } = await supabase
      .from('stock_logs')
      .select('id, type, quantity, logged_by, created_at, customer_name, customer_phone, bikes(name)')
      .order('created_at', { ascending: false })
      .limit(10);
    if (!error) setLogs(data || []);
    setLogsLoading(false);
  }, []);

  // ─── Fetch inquiries ───────────────────────────────────────────────────
  const fetchInquiries = useCallback(async () => {
    setInquiriesLoading(true);
    const { data, error } = await supabase
      .from('inquiries')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setInquiries(data || []);
    setInquiriesLoading(false);
  }, []);

  useEffect(() => { fetchBikes(); fetchLogs(); fetchInquiries(); }, [fetchBikes, fetchLogs, fetchInquiries]);

  // ─── Update inquiry status ─────────────────────────────────────────────
  const updateInquiryStatus = async (id, status) => {
    const inq = inquiries.find(i => i.id === id);
    if (!inq) return;

    const { error } = await supabase.from('inquiries').update({ status }).eq('id', id);
    if (error) {
      showToast('Failed to update status', 'error');
    } else {
      showToast('Status updated successfully');
      fetchInquiries();

      // Sync status to Google Sheets non-blockingly
      try {
        const { error: syncError } = await supabase.functions.invoke('sync-to-sheets', {
          body: {
            type: 'inquiry_status_update',
            phone: inq.phone,
            status: status,
            created_at: inq.created_at,
          }
        });
        if (syncError) {
          console.warn('[sync-to-sheets] Status sync failed:', syncError.message);
        }
      } catch (syncErr) {
        console.warn('[sync-to-sheets] Status sync network error:', syncErr);
      }
    }
  };

  // ─── Submit handler ────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    // ── Validation ──
    if (!form.bikeId) { setFormError('Please select a bike.'); return; }
    const qty = parseInt(form.quantity, 10);
    if (!qty || qty < 1) { setFormError('Quantity must be at least 1.'); return; }
    if (form.action === 'sale') {
      if (!form.customerName.trim()) { setFormError('Customer name is required for a sale.'); return; }
      if (!form.customerPhone.trim()) { setFormError('Customer phone is required for a sale.'); return; }
      if (!/^\d{10}$/.test(form.customerPhone)) { setFormError('Phone number must be exactly 10 digits.'); return; }

      const soldPriceNum = Number(form.soldPrice);
      if (!form.soldPrice || isNaN(soldPriceNum) || soldPriceNum <= 0) {
        setFormError('Sold price is required and must be greater than 0.');
        return;
      }
      if (!form.buyerType) {
        setFormError('Buyer type is required for a sale.');
        return;
      }
      if (!form.paymentStatus) {
        setFormError('Payment status is required for a sale.');
        return;
      }

      if (form.paymentStatus === 'Partial') {
        const amtPaidNum = Number(form.amountPaid);
        if (form.amountPaid === '' || isNaN(amtPaidNum) || amtPaidNum <= 0) {
          setFormError('Amount paid is required for partial payment and must be greater than 0.');
          return;
        }
        if (amtPaidNum >= soldPriceNum) {
          setFormError('Amount paid for partial payment must be less than the sold price.');
          return;
        }
      }

      if (form.paymentStatus === 'Pending') {
        const amtPaidNum = form.amountPaid === '' ? 0 : Number(form.amountPaid);
        if (isNaN(amtPaidNum) || amtPaidNum < 0) {
          setFormError('Amount paid cannot be negative.');
          return;
        }
        if (amtPaidNum >= soldPriceNum) {
          setFormError('Amount paid cannot equal or exceed sold price for pending payment.');
          return;
        }
      }
    }

    // ── Stock check for sales ──
    if (form.action === 'sale') {
      const currentQty = selectedBike?.quantity ?? 0;
      if (qty > currentQty) {
        setFormError(`Not enough stock — only ${currentQty} unit${currentQty !== 1 ? 's' : ''} available.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const loggedBy = user?.email ?? 'unknown';
      const newQty = form.action === 'arrival'
        ? (selectedBike?.quantity ?? 0) + qty
        : (selectedBike?.quantity ?? 0) - qty;

      // 1. Insert stock log
      const logPayload = {
        bike_id: form.bikeId,
        type: form.action === 'arrival' ? 'arrival' : 'sale',
        quantity: qty,
        logged_by: loggedBy,
        ...(form.action === 'sale' && {
          customer_name: form.customerName.trim(),
          customer_phone: form.customerPhone.trim(),
        }),
      };

      const { error: logError } = await supabase.from('stock_logs').insert([logPayload]);
      if (logError) throw logError;

      // 2. Update bike quantity + auto-availability
      const availability = newQty <= 0 ? 'out_of_stock' : 'in_stock';
      const { error: updateError } = await supabase
        .from('bikes')
        .update({ quantity: Math.max(0, newQty), availability })
        .eq('id', form.bikeId);
      if (updateError) throw updateError;

      // 3. Sync to Google Sheets — fire-and-forget.
      //    This runs AFTER the bike quantity is already updated in Supabase,
      //    so the Edge Function will read the correct "new stock level".
      //    If this fails for any reason (network, Google API down, etc.) we
      //    do NOT throw — the stock log + quantity update are already committed
      //    and are considered successful regardless.
      let syncFailed = false;
      try {
        const isSale = form.action === 'sale';
        const soldPriceNum = isSale ? Number(form.soldPrice) : undefined;
        const finalAmountPaid = isSale
          ? (form.paymentStatus === 'Fully Paid' ? soldPriceNum : Number(form.amountPaid || 0))
          : undefined;

        const { error: syncError } = await supabase.functions.invoke('sync-to-sheets', {
          body: {
            bike_id:        form.bikeId,
            type:           form.action === 'arrival' ? 'arrival' : 'sale',
            quantity:       qty,
            logged_by:      loggedBy,
            customer_name:  isSale ? form.customerName.trim()  : undefined,
            customer_phone: isSale ? form.customerPhone.trim() : undefined,
            sold_price:     soldPriceNum,
            soldPrice:      soldPriceNum,
            buyer_type:     isSale ? form.buyerType : undefined,
            buyerType:      isSale ? form.buyerType : undefined,
            payment_status: isSale ? form.paymentStatus : undefined,
            paymentStatus:  isSale ? form.paymentStatus : undefined,
            amount_paid:    finalAmountPaid,
            amountPaid:     finalAmountPaid,
            created_at:     new Date().toISOString(),
          },
        });
        if (syncError) {
          // syncError is a FunctionsHttpError wrapper. The real error details
          // (our JSON body with "error" and "detail" fields) live on the raw
          // Response object at syncError.context. We .json() it to extract them.
          let detail = syncError.message; // fallback to the wrapper message
          try {
            if (syncError.context instanceof Response) {
              const body = await syncError.context.json();
              // body looks like: { error: "...", detail: "..." }
              detail = body?.detail
                ? `${body.error} — ${body.detail}`
                : (body?.error ?? syncError.message);
            }
          } catch {
            // If the body isn't valid JSON, stick with the wrapper message
          }
          console.warn('[sync-to-sheets] Edge Function error:', detail);
          syncFailed = true;
        }
      } catch (syncErr) {
        // Unexpected network-level failure (offline, DNS, etc.)
        console.warn('[sync-to-sheets] Failed to reach Edge Function:', syncErr);
        syncFailed = true;
      }

      // 4. Stock email alerts — fire-and-forget.
      //    Only triggered when a sale drives the stock to exactly 0 (out_of_stock)
      //    OR exactly to the low_stock_threshold (low_stock).
      //    Non-blocking: a failure here does NOT affect the stock update result.
      if (form.action === 'sale') {
        const threshold = selectedBike?.low_stock_threshold ?? 2; // fallback if undefined
        
        let alertType = null;
        if (newQty <= 0) {
          alertType = 'out_of_stock';
        } else if (newQty === threshold) {
          alertType = 'low_stock';
        }

        if (alertType) {
          try {
            const { error: notifyError } = await supabase.functions.invoke('notify-out-of-stock', {
              body: {
                bike_name: selectedBike?.name ?? 'Unknown Bike',
                bike_id:   form.bikeId,
                alert_type: alertType,
                current_quantity: newQty,
              },
            });
            if (notifyError) {
              console.warn('[notify-out-of-stock] Edge Function error:', notifyError.message);
            }
          } catch (notifyErr) {
            console.warn('[notify-out-of-stock] Failed to reach Edge Function:', notifyErr);
          }
        }
      }

      if (syncFailed) {
        showToast('Stock updated, but Sheet sync failed ⚠', 'error');
      } else {
        showToast('Stock updated successfully ✓');
      }
      setForm(EMPTY_FORM);
      fetchBikes();
      fetchLogs();
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Logout ───────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-login');
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      <Toast toast={toast} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4
        pb-5 border-b border-[#1f293d]">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Employee Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Stock logging for TVS Raj Automobiles
            {user?.email && (
              <span className="ml-2 text-gray-500">— {user.email}</span>
            )}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowInquiries(!showInquiries)}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-[#1f293d]
              text-gray-300 hover:text-white hover:border-gray-500 text-sm font-semibold
              transition-colors min-h-[44px]"
          >
            <MessageSquare className="w-4 h-4" />
            <span>{showInquiries ? 'Back to Stock Log' : 'View Inquiries'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-[#1f293d]
              text-gray-400 hover:text-red-400 hover:border-red-500/40 text-sm font-semibold
              transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {showInquiries ? (
        <InquiriesSection 
          inquiries={inquiries} 
          loading={inquiriesLoading} 
          updateStatus={updateInquiryStatus} 
        />
      ) : (
        <>
          {/* ── Stock Log Form ── */}
      <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl overflow-hidden">
        {/* Card header */}
        <div className="px-5 py-4 border-b border-[#1f293d] flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-[#0066CC]/15 border border-[#0066CC]/20">
            <Package className="w-4 h-4 text-[#0066CC]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Log Stock Entry</h2>
            <p className="text-xs text-gray-500">Record a new arrival or sale</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">

          {/* Error banner */}
          {formError && (
            <div className="flex items-start space-x-2.5 p-3.5 rounded-xl border
              border-red-500/30 bg-red-500/8 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Bike selector */}
          <Field label="Bike" required>
            <div className="relative">
              {bikesLoading ? (
                <div className={inputCls + ' text-gray-500'}>Loading bikes…</div>
              ) : (
                <select
                  className={selectCls}
                  value={form.bikeId}
                  onChange={set('bikeId')}
                  disabled={submitting}
                  required
                >
                  <option value="">— Select a bike —</option>
                  {bikes.map((bike) => (
                    <option key={bike.id} value={bike.id}>
                      {bike.name} (Qty: {bike.quantity ?? 0})
                    </option>
                  ))}
                </select>
              )}
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4
                text-gray-400 pointer-events-none" />
            </div>
            {/* Live stock indicator */}
            {selectedBike && (
              <div className={`mt-2 text-xs font-semibold inline-flex items-center gap-1.5 px-2.5 py-1
                rounded-full border ${
                  (selectedBike.quantity ?? 0) === 0
                    ? 'bg-red-500/10 text-red-400 border-red-500/30'
                    : (selectedBike.quantity ?? 0) <= 2
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                {(selectedBike.quantity ?? 0) === 0
                  ? 'Out of stock'
                  : `${selectedBike.quantity} in stock`}
              </div>
            )}
          </Field>

          {/* Action toggle */}
          <Field label="Action" required>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, action: 'arrival' }))}
                disabled={submitting}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border
                  text-sm font-bold transition-all ${
                    form.action === 'arrival'
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                      : 'bg-transparent border-[#1f293d] text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <TrendingUp className="w-4 h-4" />
                Stock Arrived
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, action: 'sale' }))}
                disabled={submitting}
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border
                  text-sm font-bold transition-all ${
                    form.action === 'sale'
                      ? 'bg-blue-500/15 border-blue-500/50 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                      : 'bg-transparent border-[#1f293d] text-gray-400 hover:border-gray-600 hover:text-gray-300'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <ShoppingCart className="w-4 h-4" />
                Bike Sold
              </button>
            </div>
          </Field>

          {/* Quantity */}
          <Field label="Quantity" required>
            <input
              className={inputCls}
              type="number"
              min="1"
              value={form.quantity}
              onChange={set('quantity')}
              disabled={submitting}
              required
            />
          </Field>

          {/* Sale-only fields */}
          {form.action === 'sale' && (
            <div className="space-y-5 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
              {/* Customer Details */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Customer Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Customer Name" required>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                      <input
                        className={inputCls + ' pl-9'}
                        type="text"
                        placeholder="Full name"
                        value={form.customerName}
                        onChange={set('customerName')}
                        disabled={submitting}
                        required
                      />
                    </div>
                  </Field>
                  <Field label="Customer Phone" required>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                      <input
                        className={inputCls + ' pl-9'}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        placeholder="10-digit number"
                        maxLength={10}
                        value={form.customerPhone}
                        onChange={setPhone}
                        onKeyDown={(e) => {
                          // Block any key that would push a digit past 10 characters
                          const isDigit = /^\d$/.test(e.key);
                          const wouldExceed = form.customerPhone.length >= 10;
                          if (isDigit && wouldExceed) e.preventDefault();
                        }}
                        disabled={submitting}
                        required
                      />
                    </div>
                  </Field>
                </div>
              </div>

              {/* Sale & Payment Details */}
              <div className="space-y-3 pt-4 border-t border-blue-500/15">
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5" />
                  Sale & Payment Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Sold Price */}
                  <Field label="Sold Price (NPR)" required>
                    <div className="relative">
                      <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                      <input
                        className={inputCls + ' pl-9'}
                        type="number"
                        min="1"
                        placeholder="e.g. 250000"
                        value={form.soldPrice}
                        onChange={handleSoldPriceChange}
                        disabled={submitting}
                        required
                      />
                    </div>
                  </Field>

                  {/* Buyer Type */}
                  <Field label="Buyer Type" required>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                      <select
                        className={selectCls + ' pl-9'}
                        value={form.buyerType}
                        onChange={set('buyerType')}
                        disabled={submitting}
                        required
                      >
                        <option value="">— Select Buyer Type —</option>
                        <option value="Individual">Individual</option>
                        <option value="Corporate">Corporate</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </Field>

                  {/* Payment Status */}
                  <Field label="Payment Status" required>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                      <select
                        className={selectCls + ' pl-9'}
                        value={form.paymentStatus}
                        onChange={handlePaymentStatusChange}
                        disabled={submitting}
                        required
                      >
                        <option value="">— Select Payment Status —</option>
                        <option value="Fully Paid">Fully Paid</option>
                        <option value="Partial">Partial</option>
                        <option value="Pending">Pending</option>
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                  </Field>

                  {/* Amount Paid (NPR) — only shown if Partial or Pending */}
                  {(form.paymentStatus === 'Partial' || form.paymentStatus === 'Pending') && (
                    <Field
                      label={`Amount Paid (NPR)${form.paymentStatus === 'Partial' ? '' : ' (Optional)'}`}
                      required={form.paymentStatus === 'Partial'}
                    >
                      <div className="relative">
                        <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                        <input
                          className={inputCls + ' pl-9'}
                          type="number"
                          min="0"
                          placeholder={form.paymentStatus === 'Pending' ? '0' : 'e.g. 50000'}
                          value={form.amountPaid}
                          onChange={set('amountPaid')}
                          disabled={submitting}
                          required={form.paymentStatus === 'Partial'}
                        />
                      </div>
                    </Field>
                  )}
                </div>

                {/* Calculation summary pill when Sold Price and Payment Status are selected */}
                {form.soldPrice && form.paymentStatus && (
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-gray-400">
                    <span>
                      Total: <strong className="text-white">NPR {Number(form.soldPrice).toLocaleString('en-IN')}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Paid: <strong className="text-emerald-400">
                        NPR {(form.paymentStatus === 'Fully Paid'
                          ? Number(form.soldPrice)
                          : Number(form.amountPaid || 0)
                        ).toLocaleString('en-IN')}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Balance: <strong className="text-amber-400">
                        NPR {Math.max(
                          0,
                          Number(form.soldPrice) - (form.paymentStatus === 'Fully Paid'
                            ? Number(form.soldPrice)
                            : Number(form.amountPaid || 0))
                        ).toLocaleString('en-IN')}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || bikesLoading}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-white transition-all
              flex items-center justify-center gap-2
              bg-[#0066CC] hover:bg-[#0052A3] shadow-[0_4px_15px_-3px_rgba(0,102,204,0.4)]
              hover:shadow-[0_8px_25px_-3px_rgba(0,102,204,0.6)] hover:-translate-y-0.5
              disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Submit Entry
              </>
            )}
          </button>
        </form>
      </div>

      {/* ── Recent Activity ── */}
      <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1f293d] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-500/15 border border-purple-500/20">
              <Clock className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Recent Activity</h2>
              <p className="text-xs text-gray-500">Last 10 stock log entries</p>
            </div>
          </div>
          <button
            onClick={fetchLogs}
            disabled={logsLoading}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-[#151c2c]
              transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {logsLoading ? (
          <div className="py-12 text-center text-gray-500 text-sm">Loading activity…</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm">
            No entries yet. Submit your first stock log above.
          </div>
        ) : (
          <ul className="divide-y divide-[#1f293d]">
            {logs.map((log) => (
              <li key={log.id} className="px-5 py-3.5 flex items-start sm:items-center gap-3
                hover:bg-[#0b0f19]/60 transition-colors">
                {/* Type badge */}
                <div className="shrink-0 pt-0.5 sm:pt-0">
                  <TypeBadge type={log.type} />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {log.bikes?.name ?? '—'}
                    <span className="text-gray-400 font-normal ml-1.5">
                      × {log.quantity}
                    </span>
                  </p>
                  {log.type === 'sale' && log.customer_name && (
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <User className="w-3 h-3 shrink-0" />
                      {log.customer_name}
                      {log.customer_phone && (
                        <span className="ml-1 text-gray-600">· {log.customer_phone}</span>
                      )}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-0.5">{log.logged_by}</p>
                </div>

                {/* Timestamp */}
                <div
                  className="shrink-0 text-xs text-gray-600 text-right"
                  title={formatNepalDateTime(log.created_at)}
                >
                  {relativeTime(log.created_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      </>
      )}
    </div>
  );
}
