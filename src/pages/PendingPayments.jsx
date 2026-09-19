import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import {
  CreditCard, CheckCircle2, Clock, RefreshCw, AlertCircle, Check,
  User, Bike, Search, LogOut, Package,
  FileText, Banknote, Wallet,
} from 'lucide-react';

const inputCls =
  'w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg py-2.5 px-3 text-sm ' +
  'focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors ' +
  'placeholder:text-gray-600 disabled:opacity-50';

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
      {isErr ? <AlertCircle className="w-5 h-5 text-red-400 shrink-0" /> : <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
      <span>{toast.message}</span>
    </div>
  );
}

export default function PendingPayments() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  // Input states per saleId: { [saleId]: string }
  const [receivedAmounts, setReceivedAmounts] = useState({});
  const [updatingSaleId, setUpdatingSaleId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPendingPayments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-pending-payments');
      if (error) {
        let detail = error.message;
        try {
          if (error.context instanceof Response) {
            const body = await error.context.json();
            detail = body?.detail || body?.error || error.message;
          }
        } catch {}
        console.warn('[get-pending-payments] Error:', detail);
        showToast(`Failed to load payments: ${detail}`, 'error');
        setPayments([]);
      } else {
        setPayments(data?.pendingPayments || []);
      }
    } catch (err) {
      console.error('[get-pending-payments] Exception:', err);
      showToast('Network error loading pending payments.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingPayments();
  }, [fetchPendingPayments]);

  const handleAmountChange = (saleId, value) => {
    setReceivedAmounts((prev) => ({
      ...prev,
      [saleId]: value,
    }));
  };

  const handlePayFull = (saleId, balanceDue) => {
    setReceivedAmounts((prev) => ({
      ...prev,
      [saleId]: String(balanceDue),
    }));
  };

  const handleUpdatePayment = async (item) => {
    const saleId = item.saleId;
    const rawVal = receivedAmounts[saleId];
    const amountNum = Number(rawVal);

    if (!rawVal || isNaN(amountNum) || amountNum <= 0) {
      showToast('Please enter a valid amount greater than 0.', 'error');
      return;
    }

    if (amountNum > item.balanceDue) {
      showToast(
        `Amount received (NPR ${amountNum.toLocaleString('en-IN')}) cannot exceed balance due (NPR ${item.balanceDue.toLocaleString('en-IN')}).`,
        'error'
      );
      return;
    }

    setUpdatingSaleId(saleId);
    try {
      const { data, error } = await supabase.functions.invoke('update-payment', {
        body: {
          saleId,
          additionalAmount: amountNum,
        },
      });

      if (error) {
        let detail = error.message;
        try {
          if (error.context instanceof Response) {
            const body = await error.context.json();
            detail = body?.detail || body?.error || error.message;
          }
        } catch {}
        console.warn('[update-payment] Error:', detail);
        showToast(`Update failed: ${detail}`, 'error');
      } else {
        const updatedRow = data?.updatedRow;
        const newBalance = Number(updatedRow?.balanceDue ?? (item.balanceDue - amountNum));
        const newPaid = Number(updatedRow?.amountPaid ?? (item.amountPaid + amountNum));
        const newStatus = updatedRow?.paymentStatus || (newBalance <= 0 ? 'Fully Paid' : 'Partial');

        if (newBalance <= 0 || newStatus.toLowerCase() === 'fully paid') {
          showToast(`🎉 Sale ${saleId} is now FULLY PAID! Removed from pending list.`, 'success');
          // Remove from pending list
          setPayments((prev) => prev.filter((p) => p.saleId !== saleId));
          setReceivedAmounts((prev) => {
            const copy = { ...prev };
            delete copy[saleId];
            return copy;
          });
        } else {
          showToast(
            `Payment recorded for ${saleId} ✓ Remaining balance: NPR ${newBalance.toLocaleString('en-IN')}`,
            'success'
          );
          // Update item in place
          setPayments((prev) =>
            prev.map((p) => {
              if (p.saleId === saleId) {
                return {
                  ...p,
                  amountPaid: newPaid,
                  balanceDue: newBalance,
                  paymentStatus: newStatus,
                };
              }
              return p;
            })
          );
          // Clear input
          setReceivedAmounts((prev) => ({ ...prev, [saleId]: '' }));
        }
      }
    } catch (err) {
      console.error('[update-payment] Exception:', err);
      showToast('Network error while recording payment.', 'error');
    } finally {
      setUpdatingSaleId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-login');
  };

  // Filtered list
  const filteredPayments = payments.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.saleId?.toLowerCase().includes(q) ||
      p.customerName?.toLowerCase().includes(q) ||
      p.bikeName?.toLowerCase().includes(q) ||
      p.customerPhone?.toLowerCase().includes(q)
    );
  });

  const totalOutstanding = payments.reduce((sum, p) => sum + (Number(p.balanceDue) || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <Toast toast={toast} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#1f293d]">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
            <Banknote className="w-3.5 h-3.5" />
            <span>Accounts Receivable</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Pending Payments</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Collect installments, track balance dues, and sync payments to Google Sheets
            {user?.email && (
              <span className="ml-2 text-gray-500">— {user.email}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPendingPayments}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border border-[#1f293d]
              text-gray-300 hover:text-white hover:bg-[#151c2c] text-sm font-semibold transition-colors"
            title="Refresh payments"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border border-[#1f293d]
              text-gray-400 hover:text-red-400 hover:border-red-500/40 text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#1f293d]/80 text-sm font-medium">
        <Link
          to="/employee/dashboard"
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#151c2c] transition-colors shrink-0"
        >
          <Package className="w-4 h-4" />
          <span>Stock Logging</span>
        </Link>
        <Link
          to="/employee/pending-documents"
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#151c2c] transition-colors shrink-0"
        >
          <FileText className="w-4 h-4" />
          <span>Pending Documents</span>
        </Link>
        <Link
          to="/employee/pending-payments"
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 font-bold shrink-0"
        >
          <CreditCard className="w-4 h-4" />
          <span>Pending Payments</span>
          {payments.length > 0 && (
            <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-black">
              {payments.length}
            </span>
          )}
        </Link>
      </div>

      {/* ── Metric Summary Pill ── */}
      {payments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium">Total Outstanding Balance</p>
              <p className="text-xl font-black text-amber-400 mt-0.5">
                NPR {totalOutstanding.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 font-medium">Sales Awaiting Payment</p>
              <p className="text-xl font-black text-white mt-0.5">
                {payments.length} <span className="text-xs font-normal text-gray-500">records</span>
              </p>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* ── Search Bar ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input
          type="text"
          placeholder="Search by Sale ID, Customer Name, Phone, or Bike..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputCls + ' pl-9'}
        />
      </div>

      {/* ── Payments List ── */}
      {loading ? (
        <div className="p-16 text-center bg-[#0e1422] border border-[#1f293d] rounded-2xl space-y-3">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-gray-400 text-sm font-medium">Fetching outstanding payment logs from Google Sheets…</p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="p-16 text-center bg-[#0e1422] border border-[#1f293d] rounded-2xl space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-white">All Payments Up to Date!</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            {search
              ? 'No outstanding payments match your search criteria.'
              : 'There are no pending balances in the Sold sheet. All bike sales are fully paid.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPayments.map((item) => {
            const saleId = item.saleId;
            const isUpdating = updatingSaleId === saleId;
            const amountInput = receivedAmounts[saleId] ?? '';
            const amountNum = Number(amountInput || 0);
            const previewRemaining = Math.max(0, item.balanceDue - amountNum);

            return (
              <div
                key={saleId}
                className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-5 hover:border-gray-700/80 transition-colors"
              >
                {/* Header info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1f293d]">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black text-white bg-[#151c2c] border border-[#1f293d] px-2.5 py-1 rounded-lg">
                        {saleId}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        {item.paymentStatus || 'Partial'}
                      </span>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        {item.buyerType || 'Individual'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 pt-1">
                      <span className="flex items-center gap-1 text-gray-300 font-semibold">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                        {item.customerName}
                        {item.customerPhone && <span className="text-gray-500 font-normal">({item.customerPhone})</span>}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-gray-300 font-semibold">
                        <Bike className="w-3.5 h-3.5 text-gray-500" />
                        {item.bikeName}
                      </span>
                      {item.date && (
                        <>
                          <span>•</span>
                          <span className="text-gray-500">{item.date}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Balance Due Highlight */}
                  <div className="text-left sm:text-right bg-[#151c2c] sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-[#1f293d]">
                    <div className="text-xs text-gray-400 font-medium">Balance Due</div>
                    <div className="text-lg sm:text-xl font-black text-amber-400">
                      NPR {Number(item.balanceDue).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Financial Breakup */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs bg-[#151c2c]/50 p-3.5 rounded-xl border border-[#1f293d]/80">
                  <div>
                    <span className="text-gray-500 block">Total Sold Price:</span>
                    <span className="font-bold text-white text-sm">
                      NPR {Number(item.soldPrice).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Amount Paid So Far:</span>
                    <span className="font-bold text-emerald-400 text-sm">
                      NPR {Number(item.amountPaid).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-gray-500 block">Remaining Due:</span>
                    <span className="font-bold text-amber-400 text-sm">
                      NPR {Number(item.balanceDue).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Update Payment Input & Action */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold pointer-events-none">
                      NPR
                    </div>
                    <input
                      type="number"
                      min="1"
                      max={item.balanceDue}
                      placeholder={`Amount received (max: ${item.balanceDue})`}
                      value={amountInput}
                      onChange={(e) => handleAmountChange(saleId, e.target.value)}
                      disabled={isUpdating}
                      className={inputCls + ' pl-12'}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePayFull(saleId, item.balanceDue)}
                    disabled={isUpdating}
                    className="px-3.5 py-2.5 rounded-lg border border-[#1f293d] text-xs font-semibold
                      text-gray-300 hover:text-white hover:bg-[#151c2c] transition-colors whitespace-nowrap"
                  >
                    Pay Full Due
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdatePayment(item)}
                    disabled={isUpdating || !amountInput || Number(amountInput) <= 0}
                    className="px-6 py-2.5 rounded-xl font-bold text-xs text-white transition-all
                      flex items-center justify-center gap-2
                      bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed
                      shadow-[0_2px_10px_rgba(217,119,6,0.3)] min-h-[42px] whitespace-nowrap"
                  >
                    {isUpdating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Sheet…</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Update Payment</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Live calculation preview when typing amount */}
                {amountNum > 0 && amountNum <= item.balanceDue && (
                  <div className="text-xs text-gray-400 flex flex-wrap items-center gap-2 pt-1 pl-1">
                    <span>After payment:</span>
                    <span>
                      Paid: <strong className="text-emerald-400">NPR {(item.amountPaid + amountNum).toLocaleString('en-IN')}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Remaining Balance:{' '}
                      <strong className={previewRemaining === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                        NPR {previewRemaining.toLocaleString('en-IN')} {previewRemaining === 0 ? '(Fully Paid!)' : ''}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
