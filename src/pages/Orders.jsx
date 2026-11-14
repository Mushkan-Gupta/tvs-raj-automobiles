import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Package,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Truck,
  Store,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { formatNPR } from '../lib/formatters';

export function OrderStatusBadge({ status }) {
  const normalized = (status || 'new').toLowerCase();

  switch (normalized) {
    case 'packed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-700/60">
          Packed
        </span>
      );
    case 'shipped':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950/60 text-sky-300 border border-sky-700/60">
          Shipped
        </span>
      );
    case 'delivered':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-700/60">
          Delivered
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-950/60 text-red-300 border border-red-800/60">
          Cancelled
        </span>
      );
    case 'new':
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#0066CC]/20 text-[#4da3ff] border border-[#0066CC]/40">
          New
        </span>
      );
  }
}

export default function Orders() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?next=/orders', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Fetch orders
  useEffect(() => {
    if (!user) return;

    let mounted = true;
    setLoading(true);

    supabase
      .from('orders')
      .select('id, order_no, created_at, status, total, delivery_method, order_items(id)')
      .order('created_at', { ascending: false })
      .then(({ data, error: fetchError }) => {
        if (!mounted) return;
        if (fetchError) {
          console.error('[Orders] Fetch error:', fetchError);
          setError('Could not load your orders. Please try again.');
        } else {
          setOrders(data || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('[Orders] Network error:', err);
        setError('Network error loading orders. Please try again.');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  if (authLoading || (loading && orders.length === 0)) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="h-8 bg-[#151c2c] rounded-lg w-40 animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 bg-[#151c2c] border border-[#1f293d] rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-[#1f293d] pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-[#0066CC] p-2.5 rounded-xl text-white">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              My Orders
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {orders.length} {orders.length === 1 ? 'order placed' : 'orders placed'}
            </p>
          </div>
        </div>

        <Link
          to="/account"
          className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-[#151c2c] hover:bg-[#1f293d] border border-[#1f293d] text-xs font-semibold text-gray-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
        >
          <ArrowLeft className="w-4 h-4 text-[#0066CC]" />
          <span>My account</span>
        </Link>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && orders.length === 0 ? (
        <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-12 text-center space-y-5 max-w-md mx-auto my-6">
          <div className="w-16 h-16 rounded-2xl bg-[#111827] border border-[#1f293d] flex items-center justify-center mx-auto text-gray-500">
            <Package className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">You haven't placed any orders yet</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Explore genuine TVS motorcycle parts, engine lubricants, and official accessories.
            </p>
          </div>
          <Link
            to="/parts"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
          >
            <span>Browse parts catalogue</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        /* Orders List */
        <div className="space-y-4">
          {orders.map((order) => {
            const itemCount = Array.isArray(order.order_items) ? order.order_items.length : 0;
            const dateStr = new Date(order.created_at).toLocaleDateString('en-US', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            return (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="block bg-[#151c2c] border border-[#1f293d] hover:border-[#0066CC]/50 rounded-2xl p-5 transition-all duration-150 group focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Left: Order ID, status, date */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-base sm:text-lg font-bold text-white group-hover:text-[#4da3ff] transition-colors">
                        {order.order_no}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        <span>{dateStr}</span>
                      </span>

                      <span className="inline-flex items-center gap-1.5">
                        {order.delivery_method === 'pickup' ? (
                          <>
                            <Store className="w-3.5 h-3.5 text-gray-500" />
                            <span>Showroom pickup</span>
                          </>
                        ) : (
                          <>
                            <Truck className="w-3.5 h-3.5 text-gray-500" />
                            <span>Home delivery</span>
                          </>
                        )}
                      </span>

                      <span>
                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Total and view arrow */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 sm:pt-0 border-t sm:border-t-0 border-[#1f293d]">
                    <div className="sm:text-right">
                      <span className="block text-[11px] text-gray-400">Total</span>
                      <span className="block text-base sm:text-lg font-extrabold text-white">
                        {formatNPR(order.total)}
                      </span>
                    </div>

                    <div className="w-9 h-9 rounded-lg bg-[#111827] border border-[#1f293d] group-hover:border-[#0066CC]/40 flex items-center justify-center text-gray-400 group-hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
