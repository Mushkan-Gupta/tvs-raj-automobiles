import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import AdminNav from '../components/AdminNav';
import {
  Clock, CheckCircle, XCircle, AlertCircle, RefreshCw,
  User, Phone, Bike, ShoppingBag, Calendar, Check, X
} from 'lucide-react';

export default function AdminApprovals() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Reject modal state
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pending_sales')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const pendingList = requests.filter((r) => r.status === 'pending');
  const pastList = requests.filter((r) => r.status !== 'pending');

  const handleApprove = async (pendingId) => {
    if (!window.confirm('Are you sure you want to approve this sale? Stock will be updated and row synced to Google Sheets.')) {
      return;
    }
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('review-sale', {
        body: {
          pending_id: pendingId,
          decision: 'approve',
        },
      });

      if (error) {
        let detail = error.message;
        try {
          if (error.context instanceof Response) {
            const body = await error.context.json();
            detail = body?.error || error.message;
          }
        } catch { /* ignore */ }
        showToast(detail, 'error');
      } else if (data?.status === 'approved') {
        showToast(data.warning ? `Sale approved with warning: ${data.warning}` : 'Sale approved & committed successfully ✓');
        fetchRequests();
      }
    } catch (err) {
      showToast(err.message || 'Failed to approve sale', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReject = (pendingId) => {
    setRejectingId(pendingId);
    setRejectReason('');
    setRejectError('');
  };

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setRejectError('A reason is required to reject this sale.');
      return;
    }

    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('review-sale', {
        body: {
          pending_id: rejectingId,
          decision: 'reject',
          reject_reason: rejectReason.trim(),
        },
      });

      if (error) {
        let detail = error.message;
        try {
          if (error.context instanceof Response) {
            const body = await error.context.json();
            detail = body?.error || error.message;
          }
        } catch { /* ignore */ }
        showToast(detail, 'error');
      } else if (data?.status === 'rejected') {
        showToast('Sale rejected successfully.');
        setRejectingId(null);
        setRejectReason('');
        fetchRequests();
      }
    } catch (err) {
      showToast(err.message || 'Failed to reject sale', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-semibold animate-in slide-in-from-top-2 duration-300 ${
            toast.type === 'error'
              ? 'bg-red-900/90 border-red-500/50 text-red-200'
              : 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#1f293d]">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Sale Approvals</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Review employee discount requests requiring admin authorization
          </p>
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading || actionLoading}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl border border-[#1f293d] text-gray-400 hover:text-white hover:border-gray-500 text-sm font-semibold transition-colors min-h-[44px] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Admin Navigation */}
      <AdminNav pendingApprovalsCount={pendingList.length} />

      {/* Pending Queue Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            Pending Approval ({pendingList.length})
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-500 text-sm bg-[#0e1422] border border-[#1f293d] rounded-2xl">
            Loading approval requests…
          </div>
        ) : pendingList.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-sm bg-[#0e1422] border border-[#1f293d] rounded-2xl">
            No pending sale approvals right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingList.map((req) => {
              const payload = req.payload || {};
              const customerName = payload.customer_name || '—';
              const customerPhone = payload.customer_phone || '—';
              const extras = Array.isArray(payload.extras) ? payload.extras : [];

              return (
                <div
                  key={req.id}
                  className="bg-[#0e1422] border border-amber-500/30 rounded-2xl p-5 space-y-4 shadow-lg"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1f293d] pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-white flex items-center gap-1.5">
                          <Bike className="w-4 h-4 text-[#0066CC]" />
                          {req.bike_name}
                        </span>
                        <span className="text-xs text-gray-400">× {payload.quantity || 1}</span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Pending
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-gray-500" />
                          Requested by: <strong className="text-gray-300">{req.requested_by_email}</strong>
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-gray-500" />
                          {new Date(req.created_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Kathmandu',
                          })}
                        </span>
                      </p>
                    </div>

                    {/* Customer info */}
                    <div className="text-xs text-gray-300 bg-[#151c2c] px-3.5 py-2 rounded-xl border border-[#1f293d]">
                      <p className="font-semibold text-white">Customer: {customerName}</p>
                      <p className="text-gray-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {customerPhone} ({payload.buyer_type || 'Individual'})
                      </p>
                    </div>
                  </div>

                  {/* Financial Details Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0b0f19] p-4 rounded-xl border border-[#1f293d] text-xs">
                    <div>
                      <span className="text-gray-500 block uppercase tracking-wider text-[10px] font-bold">
                        Bike Price
                      </span>
                      <span className="font-bold text-white text-sm">
                        NPR {Number(req.original_price).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block uppercase tracking-wider text-[10px] font-bold">
                        Discount Requested
                      </span>
                      <span className="font-bold text-amber-400 text-sm">
                        NPR {Number(req.discount_amount).toLocaleString('en-IN')}{' '}
                        <span className="text-xs font-normal">
                          ({Number(req.discount_percent || 0).toFixed(1)}%)
                        </span>
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block uppercase tracking-wider text-[10px] font-bold">
                        Adjustments & Extras
                      </span>
                      <span className="font-bold text-gray-300 text-sm">
                        {extras.length > 0 ? `${extras.length} product(s)` : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 block uppercase tracking-wider text-[10px] font-bold">
                        Final Price
                      </span>
                      <span className="font-black text-emerald-400 text-base">
                        NPR {Number(req.final_price).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Extras List if any */}
                  {extras.length > 0 && (
                    <div className="text-xs text-gray-400 space-y-1">
                      <span className="font-bold text-gray-300 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                        <ShoppingBag className="w-3 h-3" /> Extra Products Included:
                      </span>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {extras.map((ex, idx) => (
                          <span
                            key={idx}
                            className="bg-[#151c2c] border border-[#1f293d] px-2.5 py-1 rounded-lg text-gray-300"
                          >
                            Part ID: {ex.part_id.slice(0, 8)}… × {ex.qty}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenReject(req.id)}
                      disabled={actionLoading}
                      className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      <span>Reject Sale</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(req.id)}
                      disabled={actionLoading}
                      className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approve Sale</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1f293d] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-400" />
                Reject Sale Request
              </h3>
              <button
                onClick={() => setRejectingId(null)}
                className="text-gray-400 hover:text-white p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Please enter the reason for rejecting this sale. The employee will see this explanation in their dashboard.
            </p>

            {rejectError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {rejectError}
              </div>
            )}

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                setRejectError('');
              }}
              placeholder="e.g. Discount is too steep for this model; maximum allowed is 8%."
              className="w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg p-3 text-sm focus:outline-none focus:border-red-500 transition-colors"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                disabled={actionLoading}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#1f293d] text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionLoading}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Section */}
      {pastList.length > 0 && (
        <div className="space-y-4 pt-6 border-t border-[#1f293d]">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-gray-400" />
            Decision History ({pastList.length})
          </h2>

          <div className="divide-y divide-[#1f293d] bg-[#0e1422] border border-[#1f293d] rounded-2xl overflow-hidden">
            {pastList.map((req) => (
              <div key={req.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{req.bike_name}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        req.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30'
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <p className="text-gray-400 mt-0.5">
                    Requested by {req.requested_by_email} for {req.payload?.customer_name || 'Customer'}
                  </p>
                  {req.reject_reason && (
                    <p className="text-red-400 mt-1 italic">Reason: {req.reject_reason}</p>
                  )}
                </div>

                <div className="text-left sm:text-right">
                  <span className="font-bold text-white block">
                    NPR {Number(req.final_price).toLocaleString('en-IN')}
                  </span>
                  <span className="text-gray-500 text-[11px]">
                    Discount: NPR {Number(req.discount_amount).toLocaleString('en-IN')} ({Number(req.discount_percent || 0).toFixed(1)}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
