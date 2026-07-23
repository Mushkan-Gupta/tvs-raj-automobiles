import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, TrendingUp, ShoppingCart, AlertCircle, Check,
  ChevronDown, Package, Clock, User, Phone, RefreshCw,
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

// ─── Relative time helper ──────────────────────────────────────────────────
function relativeTime(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Bikes list ──
  const [bikes, setBikes] = useState([]);
  const [bikesLoading, setBikesLoading] = useState(true);

  // ── Form state ──
  const EMPTY_FORM = { bikeId: '', action: 'arrival', quantity: 1, customerName: '', customerPhone: '' };
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  // ── Recent activity ──
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);

  // ── Toast ──
  const [toast, setToast] = useState(null);

  // ─── Helpers ───────────────────────────────────────────────────────────
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const selectedBike = bikes.find((b) => String(b.id) === String(form.bikeId));

  // ─── Fetch bikes ───────────────────────────────────────────────────────
  const fetchBikes = useCallback(async () => {
    setBikesLoading(true);
    const { data, error } = await supabase
      .from('bikes')
      .select('id, name, quantity, availability')
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

  useEffect(() => { fetchBikes(); fetchLogs(); }, [fetchBikes, fetchLogs]);

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

      showToast('Stock updated successfully ✓');
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
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-[#1f293d]
            text-gray-400 hover:text-red-400 hover:border-red-500/40 text-sm font-semibold
            transition-colors min-h-[44px] self-start sm:self-auto"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>

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
            <div className="space-y-4 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5">
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
                      type="tel"
                      placeholder="Phone number"
                      value={form.customerPhone}
                      onChange={set('customerPhone')}
                      disabled={submitting}
                      required
                    />
                  </div>
                </Field>
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
                <div className="shrink-0 text-xs text-gray-600 text-right">
                  {relativeTime(log.created_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
