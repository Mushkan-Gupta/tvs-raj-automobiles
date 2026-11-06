import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Receipt, Search, RefreshCw, Loader } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatNPR } from '../lib/formatters';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('stock_logs')
      .select('id, quantity, logged_by, created_at, customer_name, customer_phone, original_price, discount_amount, final_price, bikes(name)')
      .eq('type', 'sale')
      .order('created_at', { ascending: false })
      .limit(200);
    if (err) setError('Could not load sales history. Please try again.');
    else setSales(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) =>
      [s.customer_name, s.customer_phone, s.bikes?.name, s.logged_by]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [sales, query]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#1f293d]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#0066CC]/15 border border-[#0066CC]/20">
            <Receipt className="w-5 h-5 text-[#0066CC]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Sales history</h1>
            <p className="text-gray-400 text-sm mt-0.5">Latest 200 bike sales</p>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 min-h-[44px] rounded-xl border border-[#1f293d] text-gray-300 hover:text-white hover:border-gray-500 text-sm font-semibold disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer, phone, bike or staff..."
          className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[#0e1422] border border-[#1f293d] text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0066CC]"
        />
      </div>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">{error}</div>
      )}

      {loading && sales.length === 0 ? (
        <div className="py-16 flex items-center justify-center text-gray-500 gap-2 text-sm">
          <Loader className="w-4 h-4 animate-spin" /> Loading sales...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-500 text-sm">
          {query ? 'No sales match your search.' : 'No sales recorded yet.'}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-[#0e1422] border border-[#1f293d] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-[#1f293d]">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Bike</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold text-right">Price</th>
                  <th className="px-4 py-3 font-semibold text-right">Discount</th>
                  <th className="px-4 py-3 font-semibold text-right">Final price</th>
                  <th className="px-4 py-3 font-semibold">Sold by</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-[#1f293d]/60 last:border-0 hover:bg-[#151c2c]/60">
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">{formatDate(s.created_at)}</td>
                    <td className="px-4 py-3 text-white font-medium">
                      {s.bikes?.name || '—'}
                      {s.quantity > 1 && <span className="ml-2 text-xs text-gray-500">x{s.quantity}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-200">{s.customer_name || '—'}</div>
                      <div className="text-xs text-gray-500">{s.customer_phone || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{formatNPR(s.original_price)}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{s.discount_amount ? `- ${formatNPR(s.discount_amount)}` : '—'}</td>
                    <td className="px-4 py-3 text-right text-white font-bold">{formatNPR(s.final_price)}</td>
                    <td className="px-4 py-3 text-gray-400 truncate max-w-[180px]">{s.logged_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((s) => (
              <div key={s.id} className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">
                      {s.bikes?.name || '—'}
                      {s.quantity > 1 && <span className="ml-2 text-xs text-gray-500">x{s.quantity}</span>}
                    </p>
                    <p className="text-xs text-gray-500">{formatDate(s.created_at)}</p>
                  </div>
                  <p className="text-white font-bold whitespace-nowrap">{formatNPR(s.final_price)}</p>
                </div>
                <div className="text-sm text-gray-300">
                  {s.customer_name || '—'}
                  {s.customer_phone && <span className="text-gray-500"> · {s.customer_phone}</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                  <span>Price: {formatNPR(s.original_price)}</span>
                  {s.discount_amount ? <span>Discount: - {formatNPR(s.discount_amount)}</span> : null}
                  <span className="truncate">By: {s.logged_by || '—'}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
