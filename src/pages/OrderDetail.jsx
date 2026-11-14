import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Package,
  CheckCircle2,
  Calendar,
  Clock,
  Phone,
  Truck,
  Store,
  MapPin,
  ArrowLeft,
  ArrowRight,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { formatNPR } from '../lib/formatters';
import { OrderStatusBadge } from './Orders';

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const justPlaced = Boolean(location.state?.justPlaced);

  // Redirect to login if signed out
  useEffect(() => {
    if (!authLoading && !user) {
      navigate(`/login?next=/orders/${id}`, { replace: true });
    }
  }, [user, authLoading, id, navigate]);

  // Fetch order & order_items
  useEffect(() => {
    if (!user || !id) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      supabase.from('orders').select('*').eq('id', id).maybeSingle(),
      supabase.from('order_items').select('*').eq('order_id', id),
    ])
      .then(([{ data: orderData, error: orderError }, { data: itemsData, error: itemsError }]) => {
        if (!mounted) return;

        if (orderError) {
          console.error('[OrderDetail] Order fetch error:', orderError);
          setError('Could not load order details.');
        } else if (!orderData) {
          setOrder(null);
        } else {
          setOrder(orderData);
          setItems(itemsData || []);
        }

        if (itemsError) {
          console.warn('[OrderDetail] Items fetch error:', itemsError);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error('[OrderDetail] Network error:', err);
        setError('Network error loading order.');
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user, id]);

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-6">
        <div className="h-8 bg-[#151c2c] rounded-lg w-48 animate-pulse" />
        <div className="h-64 bg-[#151c2c] border border-[#1f293d] rounded-2xl animate-pulse" />
      </div>
    );
  }

  // Not found state (RLS protects rows so nonexistent or other users' orders are null)
  if (!order) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-[#151c2c] border border-[#1f293d] rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[#111827] border border-[#1f293d] flex items-center justify-center mx-auto text-gray-400">
            <Package className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Order not found</h1>
            <p className="text-xs text-gray-400 leading-relaxed">
              This order does not exist or you do not have permission to view it.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to="/orders"
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg bg-[#111827] hover:bg-[#1f293d] border border-[#1f293d] text-gray-200 text-xs font-semibold flex items-center justify-center transition-colors"
            >
              My orders
            </Link>
            <Link
              to="/parts"
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-semibold flex items-center justify-center transition-colors"
            >
              Browse parts
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const createdDate = new Date(order.created_at);
  const formattedDate = createdDate.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = createdDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      {/* ── Just Placed Success Banner ── */}
      {justPlaced && (
        <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-2xl p-5 flex items-start gap-4">
          <div className="p-2 rounded-xl bg-emerald-600/20 text-emerald-400 shrink-0 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white">Order placed successfully!</h2>
            <p className="text-xs text-emerald-200 leading-relaxed">
              Thank you for ordering with TVS Raj Automobiles. Your request has been recorded, and
              our representative will call you shortly to confirm the shipment.
            </p>
          </div>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Top Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-[#1f293d] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <Link to="/orders" className="hover:text-white transition-colors">
              My Orders
            </Link>
            <span>/</span>
            <span className="text-gray-300 font-mono">{order.order_no}</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
              {order.order_no}
            </h1>
            <OrderStatusBadge status={order.status} />
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-400 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <span>{formattedDate}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span>{formattedTime}</span>
            </span>
          </div>
        </div>

        <Link
          to="/orders"
          className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-[#151c2c] hover:bg-[#1f293d] border border-[#1f293d] text-xs font-semibold text-gray-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
        >
          <ArrowLeft className="w-4 h-4 text-[#0066CC]" />
          <span>All orders</span>
        </Link>
      </div>

      {/* ── Phone Call Confirmation Notice ── */}
      <div className="bg-[#151c2c] border border-[#1f293d] rounded-xl p-4 flex items-center gap-3 text-xs text-gray-300">
        <Phone className="w-4 h-4 text-[#0066CC] shrink-0" />
        <span>
          We will call you on <strong className="text-white">{order.customer_phone}</strong> to
          confirm.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column: Items Table & Shipping Details ── */}
        <div className="lg:col-span-7 space-y-6">
          {/* Ordered Items Table */}
          <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-[#1f293d] pb-3">
              <Package className="w-4 h-4 text-[#0066CC]" />
              <span>Items Ordered</span>
              <span className="text-xs font-normal text-gray-400">
                ({items.length} {items.length === 1 ? 'item' : 'items'})
              </span>
            </h2>

            <div className="divide-y divide-[#1f293d]">
              {items.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{item.part_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Qty: {item.qty} × {formatNPR(item.unit_price)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-bold text-white">
                      {formatNPR(item.line_total)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery or Pickup Address */}
          <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-[#1f293d] pb-3">
              {order.delivery_method === 'pickup' ? (
                <>
                  <Store className="w-4 h-4 text-[#0066CC]" />
                  <span>Collection Location</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4 text-[#0066CC]" />
                  <span>Delivery Address</span>
                </>
              )}
            </h2>

            <div className="text-xs sm:text-sm text-gray-300 space-y-2">
              {order.delivery_method === 'pickup' ? (
                <div className="space-y-1.5">
                  <p className="font-semibold text-white text-base">
                    Pick up at TVS Raj Automobiles, Lahan
                  </p>
                  <p className="text-gray-400">Main Road, Lahan, Siraha, Nepal</p>
                  <p className="text-gray-400">Customer: {order.customer_name}</p>
                  <p className="text-gray-400">Contact: {order.customer_phone}</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <p className="font-semibold text-white text-base">{order.customer_name}</p>
                  <p className="text-gray-300">
                    {order.ship_area}, {order.ship_city}
                  </p>
                  {order.ship_landmark && (
                    <p className="text-gray-400">Landmark: {order.ship_landmark}</p>
                  )}
                  <p className="text-gray-400">Phone: {order.customer_phone}</p>
                </div>
              )}

              {/* Courier & Tracking (when present) */}
              {(order.courier || order.tracking_no) && (
                <div className="mt-3 pt-3 border-t border-[#1f293d] space-y-1">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-[#0066CC]" />
                    <span className="font-semibold text-white">Shipping Details:</span>
                  </div>
                  {order.courier && (
                    <p className="text-xs text-gray-300">Courier: {order.courier}</p>
                  )}
                  {order.tracking_no && (
                    <p className="text-xs text-gray-300 font-mono">
                      Tracking No: {order.tracking_no}
                    </p>
                  )}
                </div>
              )}

              {/* Note to the shop */}
              {order.ship_note && (
                <div className="mt-3 pt-3 border-t border-[#1f293d] flex items-start gap-2 text-xs text-gray-400">
                  <FileText className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                  <p>
                    <span className="font-semibold text-gray-300">Customer note: </span>
                    "{order.ship_note}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right Column: Payment & Price Summary ── */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-6 space-y-6 shadow-xl">
            <h2 className="text-base font-bold text-white border-b border-[#1f293d] pb-3">
              Payment Summary
            </h2>

            {/* Payment instruction banner */}
            <div className="p-4 bg-[#111827] border border-[#1f293d] rounded-xl space-y-1">
              <span className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Payment Due
              </span>
              <p className="text-sm font-bold text-white">
                {order.delivery_method === 'pickup'
                  ? `Pay ${formatNPR(order.total)} at the showroom when you pick it up`
                  : `Pay ${formatNPR(order.total)} in cash when your order arrives`}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                Method: Cash on Delivery ({order.payment_status === 'paid' ? 'Paid' : 'Unpaid'})
              </p>
            </div>

            {/* Price breakdown */}
            <div className="space-y-3 pt-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Subtotal</span>
                <span className="font-medium text-white">{formatNPR(order.subtotal)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">
                  Delivery ({order.delivery_method === 'pickup' ? 'Showroom pickup' : 'Standard'})
                </span>
                <span
                  className={`font-medium ${
                    Number(order.delivery_fee) === 0 ? 'text-emerald-400' : 'text-white'
                  }`}
                >
                  {Number(order.delivery_fee) === 0 ? 'Free' : formatNPR(order.delivery_fee)}
                </span>
              </div>

              <div className="pt-3 border-t border-[#1f293d] flex items-baseline justify-between">
                <span className="text-base font-bold text-white">Total</span>
                <span className="text-xl font-extrabold text-[#4da3ff]">
                  {formatNPR(order.total)}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-3 pt-2">
              <Link
                to="/parts"
                className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
              >
                <span>Continue shopping</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/orders"
                className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#111827] hover:bg-[#1f293d] border border-[#1f293d] text-gray-300 hover:text-white text-xs font-semibold flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
              >
                View all my orders
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
