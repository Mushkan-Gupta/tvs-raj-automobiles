import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export default function MySaleRequests({ currentUserId, refreshTrigger }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('pending_sales')
      .select('id, bike_name, payload, original_price, discount_amount, discount_percent, final_price, status, reject_reason, created_at')
      .eq('requested_by', currentUserId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setRequests(data);
    }
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests, refreshTrigger]);

  if (requests.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl overflow-hidden mt-6">
      <div className="px-5 py-4 border-b border-[#1f293d] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/20">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">My Sale Requests</h2>
            <p className="text-xs text-gray-500">Approvals queue status</p>
          </div>
        </div>
        <button
          onClick={fetchRequests}
          disabled={loading}
          className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-[#151c2c] transition-colors disabled:opacity-40"
          title="Refresh requests"
          aria-label="Refresh requests"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="divide-y divide-[#1f293d]">
        {requests.map((req) => {
          const isPending = req.status === 'pending';
          const isApproved = req.status === 'approved';
          const isRejected = req.status === 'rejected';

          return (
            <div key={req.id} className="p-4 sm:p-5 space-y-2 hover:bg-[#0b0f19]/40 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{req.bike_name}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        isPending
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : isApproved
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-red-500/15 text-red-400 border-red-500/30'
                      }`}
                    >
                      {isPending && <Clock className="w-3 h-3" />}
                      {isApproved && <CheckCircle className="w-3 h-3" />}
                      {isRejected && <XCircle className="w-3 h-3" />}
                      {req.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Customer: {req.payload?.customer_name || '—'} ({req.payload?.customer_phone || '—'})
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-xs text-gray-400">
                    Final Price:{' '}
                    <strong className="text-white">
                      NPR {Number(req.final_price).toLocaleString('en-IN')}
                    </strong>
                  </p>
                  <p className="text-[11px] text-amber-400">
                    Discount: NPR {Number(req.discount_amount).toLocaleString('en-IN')} (
                    {Number(req.discount_percent || 0).toFixed(1)}%)
                  </p>
                </div>
              </div>

              {isRejected && req.reject_reason && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
                  <strong>Rejection reason:</strong> {req.reject_reason}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
