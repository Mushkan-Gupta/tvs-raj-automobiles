import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import {
  Truck,
  Store,
  CreditCard,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader,
  Lock,
  User,
} from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { useCart } from '../lib/CartContext';
import { useCartLines } from '../lib/useCartLines';
import { useCustomer } from '../lib/useCustomer';
import { supabase } from '../lib/supabaseClient';
import { formatNPR } from '../lib/formatters';

export default function Checkout() {
  const { user, loading: authLoading } = useAuth();
  const { profile } = useCustomer();
  const { items, clear } = useCart();
  const { lines, subtotal, loading: linesLoading, hasIssues, fixCart } = useCartLines();
  const navigate = useNavigate();

  // ── Form State ──
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('delivery'); // 'delivery' | 'pickup'
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod] = useState('cod');
  const [saveToProfile, setSaveToProfile] = useState(true);

  // ── UI / Submission State ──
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState(null); // { type, message }

  // ── Idempotency request_id ──
  const requestIdRef = useRef(null);

  // Track cart item signature to invalidate request_id when cart changes
  const prevItemsSigRef = useRef(JSON.stringify(items));
  useEffect(() => {
    const currentSig = JSON.stringify(items);
    if (prevItemsSigRef.current !== currentSig) {
      prevItemsSigRef.current = currentSig;
      requestIdRef.current = null;
    }
  }, [items]);

  // ── Prefill from customer profile (once loaded, if untouched) ──
  const hasPrefilledRef = useRef(false);
  useEffect(() => {
    if (profile && !hasPrefilledRef.current) {
      hasPrefilledRef.current = true;
      if (profile.full_name) setName((prev) => prev || profile.full_name);
      if (profile.phone) setPhone((prev) => prev || profile.phone);
      if (profile.city) setCity((prev) => prev || profile.city);
      if (profile.area) setArea((prev) => prev || profile.area);
      if (profile.landmark) setLandmark((prev) => prev || profile.landmark);
    }
  }, [profile]);

  // ── Available lines ──
  const availableLines = useMemo(() => lines.filter((l) => l.available), [lines]);
  const hasAvailableLines = availableLines.length > 0;

  // ── Totals ──
  const deliveryFee = deliveryMethod === 'delivery' ? 500 : 0;
  const grandTotal = subtotal + deliveryFee;

  // ── Client Form Validation ──
  const validateForm = useCallback(() => {
    const errors = {};
    const cleanName = name.trim();
    if (!cleanName || cleanName.length < 2) {
      errors.name = 'Please enter your full name (at least 2 characters).';
    }

    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!/^\+?[0-9]{8,15}$/.test(cleanPhone)) {
      errors.phone = 'Please enter a valid phone number (8 to 15 digits).';
    }

    if (deliveryMethod === 'delivery') {
      const cleanCity = city.trim();
      if (!cleanCity || cleanCity.length < 2) {
        errors.city = 'Please enter your delivery city or town.';
      }
      const cleanArea = area.trim();
      if (!cleanArea || cleanArea.length < 2) {
        errors.area = 'Please enter your tole, village, or street address.';
      }
    }

    if (note && note.length > 300) {
      errors.note = 'Note must be at most 300 characters.';
    }

    return errors;
  }, [name, phone, deliveryMethod, city, area, note]);

  // ── Submit Order ──
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setServerError(null);

    // Guard: issues must be resolved first
    if (hasIssues) {
      setServerError({
        type: 'stock',
        message: 'Please review and fix stock changes in your cart before placing the order.',
      });
      return;
    }

    if (!hasAvailableLines) {
      setServerError({
        type: 'empty',
        message: 'Your cart has no available items to order.',
      });
      return;
    }

    // Validate inputs
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    // Ensure idempotency key (reuse on network/500 retry, create on first press)
    if (!requestIdRef.current) {
      requestIdRef.current = crypto.randomUUID();
    }

    const cleanPhone = phone.replace(/[\s-]/g, '');
    const payload = {
      request_id: requestIdRef.current,
      delivery_method: deliveryMethod,
      payment_method: 'cod',
      name: name.trim(),
      phone: cleanPhone,
      address:
        deliveryMethod === 'delivery'
          ? {
              city: city.trim(),
              area: area.trim(),
              landmark: landmark.trim() || null,
            }
          : undefined,
      note: note.trim() || undefined,
      items: availableLines.map((l) => ({
        part_id: l.partId,
        qty: l.qty,
      })),
    };

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-order', {
        body: payload,
      });

      if (error) {
        let errorData = null;
        let status = null;

        if (error.context) {
          status = error.context.status;
          try {
            if (typeof error.context.json === 'function') {
              errorData = await error.context.json();
            }
          } catch {
            // context.json parse error ignored
          }
        }

        // 409 Out of stock / inventory changed
        if (status === 409 || errorData?.code === 'out_of_stock') {
          setServerError({
            type: 'stock',
            message:
              errorData?.error ||
              'One or more items in your cart are out of stock or have changed quantity.',
          });
          requestIdRef.current = null; // Next submission after cart fix needs a new UUID
        } else if (status === 401) {
          setServerError({
            type: 'auth',
            message: 'Your session has expired. Please sign in again to place your order.',
          });
          requestIdRef.current = null;
        } else if (status === 429) {
          setServerError({
            type: 'rate',
            message: errorData?.error || 'Too many orders in the last hour. Please try later.',
          });
          requestIdRef.current = null;
        } else if (status === 400) {
          setServerError({
            type: 'validation',
            message: errorData?.error || 'Invalid order information. Please review your details.',
          });
          requestIdRef.current = null;
        } else {
          // Network failure or 500 internal server error
          setServerError({
            type: 'network',
            message:
              'We could not confirm your order. Please try again; you will not be charged twice.',
          });
          // Re-use requestIdRef.current so the server can safely deduplicate!
        }

        setSubmitting(false);
        return;
      }

      // ── Order Placed Successfully ──
      // Save profile if checked
      if (saveToProfile && user) {
        try {
          await supabase.from('profiles').upsert({
            id: user.id,
            full_name: name.trim(),
            phone: cleanPhone,
            city: deliveryMethod === 'delivery' ? city.trim() : profile?.city || null,
            area: deliveryMethod === 'delivery' ? area.trim() : profile?.area || null,
            landmark:
              deliveryMethod === 'delivery'
                ? landmark.trim() || null
                : profile?.landmark || null,
            updated_at: new Date().toISOString(),
          });
        } catch (profileErr) {
          console.warn('[Checkout] Non-critical profile save warning:', profileErr);
        }
      }

      // Clear the cart
      clear();

      // Navigate to order confirmation
      navigate(`/orders/${data.order_id}`, {
        replace: true,
        state: { justPlaced: true },
      });
    } catch (invokeErr) {
      console.error('[Checkout] Unexpected invocation error:', invokeErr);
      setServerError({
        type: 'network',
        message:
          'We could not confirm your order. Please try again; you will not be charged twice.',
      });
      setSubmitting(false);
    }
  };

  // ── Loading Skeleton ──
  if (authLoading || (items.length > 0 && linesLoading && lines.length === 0)) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-[#151c2c] rounded-lg w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 h-96 bg-[#151c2c] rounded-2xl border border-[#1f293d]" />
            <div className="lg:col-span-5 h-72 bg-[#151c2c] rounded-2xl border border-[#1f293d]" />
          </div>
        </div>
      </div>
    );
  }

  // ── 1) Not Signed In: Sign-in Card ──
  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-[#151c2c] border border-[#1f293d] rounded-2xl p-8 text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-[#111827] border border-[#1f293d] flex items-center justify-center mx-auto text-[#0066CC]">
            <User className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Sign in to place your order
            </h1>
            <p className="text-sm text-gray-300 leading-relaxed">
              Please sign in or create an account to complete your checkout. Your shopping cart
              stays saved and ready.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Link
              to="/login?next=/checkout"
              className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
            >
              <Lock className="w-4 h-4" />
              <span>Sign in</span>
            </Link>

            <Link
              to="/login?next=/checkout&tab=signup"
              className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-[#111827] hover:bg-[#1a2337] border border-[#1f293d] text-gray-200 hover:text-white text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
            >
              <span>Create account</span>
            </Link>

            <div className="pt-2">
              <Link
                to="/cart"
                className="inline-flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors py-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to cart</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 2) Cart empty or no available lines: redirect to /cart ──
  if (!linesLoading && (items.length === 0 || lines.length === 0 || !hasAvailableLines)) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Page Title & Back link */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-[#1f293d] pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Checkout
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Complete your order for genuine TVS motorcycle parts.
          </p>
        </div>

        <Link
          to="/cart"
          className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-[#151c2c] hover:bg-[#1f293d] border border-[#1f293d] text-xs font-semibold text-gray-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
        >
          <ArrowLeft className="w-4 h-4 text-[#0066CC]" />
          <span>Return to cart</span>
        </Link>
      </div>

      {/* ── 3) Stock Issues Notice with Fix Cart Button ── */}
      {hasIssues && lines.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-amber-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
            <span>
              Some items in your cart have changed stock or are no longer available. Please update
              your cart before proceeding.
            </span>
          </div>
          <button
            type="button"
            onClick={fixCart}
            className="min-h-[40px] px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Fix cart
          </button>
        </div>
      )}

      {/* Server Error Alert */}
      {serverError && (
        <div className="bg-red-950/40 border border-red-800/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-red-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{serverError.message}</span>
          </div>
          {serverError.type === 'stock' && (
            <button
              type="button"
              onClick={fixCart}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-semibold transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              Fix cart
            </button>
          )}
        </div>
      )}

      <form onSubmit={handlePlaceOrder} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── 4) Form Details (Left Column) ── */}
          <div className="lg:col-span-7 space-y-6">
            {/* Contact Information */}
            <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-[#1f293d] pb-3">
                <User className="w-4 h-4 text-[#0066CC]" />
                <span>Contact Details</span>
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: null }));
                    }}
                    placeholder="e.g. Ram Bahadur Shrestha"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#111827] border border-[#1f293d] text-white text-sm placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] transition-colors"
                  />
                  {fieldErrors.name && (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-xs font-semibold text-gray-300 mb-1.5"
                  >
                    Phone Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="phone"
                    name="tel"
                    type="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (fieldErrors.phone) setFieldErrors((prev) => ({ ...prev, phone: null }));
                    }}
                    placeholder="e.g. 9819789215"
                    className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#111827] border border-[#1f293d] text-white text-sm placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] transition-colors"
                  />
                  {fieldErrors.phone && (
                    <p className="mt-1 text-xs text-red-400">{fieldErrors.phone}</p>
                  )}
                  <p className="mt-1 text-[11px] text-gray-500">
                    We will call you on this number to confirm the order.
                  </p>
                </div>
              </div>
            </div>

            {/* Delivery Method */}
            <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-[#1f293d] pb-3">
                <Truck className="w-4 h-4 text-[#0066CC]" />
                <span>Delivery Method</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup">
                {/* Home delivery option */}
                <label
                  className={`min-h-[44px] p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    deliveryMethod === 'delivery'
                      ? 'bg-[#101626] border-[#0066CC] ring-1 ring-[#0066CC]'
                      : 'bg-[#111827] border-[#1f293d] hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="delivery"
                    checked={deliveryMethod === 'delivery'}
                    onChange={() => setDeliveryMethod('delivery')}
                    className="mt-1 w-4 h-4 text-[#0066CC] focus:ring-[#0066CC] border-gray-600 bg-gray-900"
                  />
                  <div className="space-y-0.5">
                    <span className="block text-sm font-bold text-white">Home delivery</span>
                    <span className="block text-xs text-gray-400">
                      Rs 500 flat fee anywhere in Nepal
                    </span>
                  </div>
                </label>

                {/* Pick up option */}
                <label
                  className={`min-h-[44px] p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-colors ${
                    deliveryMethod === 'pickup'
                      ? 'bg-[#101626] border-[#0066CC] ring-1 ring-[#0066CC]'
                      : 'bg-[#111827] border-[#1f293d] hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryMethod"
                    value="pickup"
                    checked={deliveryMethod === 'pickup'}
                    onChange={() => setDeliveryMethod('pickup')}
                    className="mt-1 w-4 h-4 text-[#0066CC] focus:ring-[#0066CC] border-gray-600 bg-gray-900"
                  />
                  <div className="space-y-0.5">
                    <span className="block text-sm font-bold text-white">Pick up at showroom</span>
                    <span className="block text-xs text-emerald-400 font-medium">Free</span>
                  </div>
                </label>
              </div>

              {/* Delivery Address fields (hidden for pickup) */}
              {deliveryMethod === 'delivery' ? (
                <div className="pt-2 space-y-4 border-t border-[#1f293d]">
                  <div>
                    <label
                      htmlFor="city"
                      className="block text-xs font-semibold text-gray-300 mb-1.5"
                    >
                      City / Town <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="city"
                      name="city"
                      type="text"
                      autoComplete="address-level2"
                      value={city}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (fieldErrors.city) setFieldErrors((prev) => ({ ...prev, city: null }));
                      }}
                      placeholder="e.g. Lahan, Siraha"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#111827] border border-[#1f293d] text-white text-sm placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] transition-colors"
                    />
                    {fieldErrors.city && (
                      <p className="mt-1 text-xs text-red-400">{fieldErrors.city}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="area"
                      className="block text-xs font-semibold text-gray-300 mb-1.5"
                    >
                      Tole / Village / Street <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="area"
                      name="area"
                      type="text"
                      autoComplete="address-line1"
                      value={area}
                      onChange={(e) => {
                        setArea(e.target.value);
                        if (fieldErrors.area) setFieldErrors((prev) => ({ ...prev, area: null }));
                      }}
                      placeholder="e.g. Ward 4, Main Chowk"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#111827] border border-[#1f293d] text-white text-sm placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] transition-colors"
                    />
                    {fieldErrors.area && (
                      <p className="mt-1 text-xs text-red-400">{fieldErrors.area}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="landmark"
                      className="block text-xs font-semibold text-gray-300 mb-1.5"
                    >
                      Landmark (optional)
                    </label>
                    <input
                      id="landmark"
                      name="landmark"
                      type="text"
                      autoComplete="off"
                      value={landmark}
                      onChange={(e) => setLandmark(e.target.value)}
                      placeholder="e.g. Near Sagarmatha Hospital"
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg bg-[#111827] border border-[#1f293d] text-white text-sm placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] transition-colors"
                    />
                  </div>
                </div>
              ) : (
                <div className="pt-2 p-3 bg-[#111827] border border-[#1f293d] rounded-xl flex items-start gap-3">
                  <Store className="w-5 h-5 text-[#0066CC] shrink-0 mt-0.5" />
                  <div className="text-xs text-gray-300 space-y-1">
                    <p className="font-semibold text-white">Showroom Collection Address:</p>
                    <p>TVS Raj Automobiles, Main Road, Lahan, Siraha, Nepal</p>
                    <p className="text-gray-400">
                      Open Sunday–Friday 9:00 AM – 6:00 PM. Call (+977 9819789215) when you arrive.
                    </p>
                  </div>
                </div>
              )}

              {/* Note to the shop */}
              <div className="pt-2 border-t border-[#1f293d]">
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="note" className="block text-xs font-semibold text-gray-300">
                    Note to the shop (optional)
                  </label>
                  <span className="text-[11px] text-gray-500">{note.length}/300</span>
                </div>
                <textarea
                  id="note"
                  name="note"
                  rows={2}
                  maxLength={300}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Please deliver after 2:00 PM or call before arriving"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#111827] border border-[#1f293d] text-white text-sm placeholder-gray-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] transition-colors resize-none"
                />
                {fieldErrors.note && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.note}</p>
                )}
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-[#1f293d] pb-3">
                <CreditCard className="w-4 h-4 text-[#0066CC]" />
                <span>Payment Method</span>
              </h2>

              <div className="space-y-3">
                {/* Cash on delivery / Pay at showroom */}
                <label className="min-h-[44px] p-4 rounded-xl border bg-[#101626] border-[#0066CC] ring-1 ring-[#0066CC] flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    readOnly
                    className="mt-1 w-4 h-4 text-[#0066CC] focus:ring-[#0066CC] border-gray-600 bg-gray-900"
                  />
                  <div className="space-y-0.5">
                    <span className="block text-sm font-bold text-white">
                      {deliveryMethod === 'pickup' ? 'Pay at the showroom' : 'Cash on delivery'}
                    </span>
                    <span className="block text-xs text-gray-400">
                      {deliveryMethod === 'pickup'
                        ? 'Pay with cash or mobile banking when picking up your parts.'
                        : 'Pay cash to the delivery courier when your package arrives.'}
                    </span>
                  </div>
                </label>

                {/* Khalti (Disabled) */}
                <div className="min-h-[44px] p-4 rounded-xl border bg-[#111827]/60 border-[#1f293d] flex items-center justify-between gap-3 opacity-60 cursor-not-allowed">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border border-gray-600 bg-gray-800" />
                    <div>
                      <span className="block text-sm font-medium text-gray-300">Khalti</span>
                      <span className="block text-xs text-gray-500">Online digital wallet</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1f293d] text-gray-400 border border-[#2d3a54]">
                    Coming soon
                  </span>
                </div>

                {/* Fonepay QR (Disabled) */}
                <div className="min-h-[44px] p-4 rounded-xl border bg-[#111827]/60 border-[#1f293d] flex items-center justify-between gap-3 opacity-60 cursor-not-allowed">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border border-gray-600 bg-gray-800" />
                    <div>
                      <span className="block text-sm font-medium text-gray-300">Fonepay QR</span>
                      <span className="block text-xs text-gray-500">Scan & pay with any bank</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1f293d] text-gray-400 border border-[#2d3a54]">
                    Coming soon
                  </span>
                </div>
              </div>
            </div>

            {/* Save to Profile Checkbox */}
            <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-4">
              <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToProfile}
                  onChange={(e) => setSaveToProfile(e.target.checked)}
                  className="w-4 h-4 rounded text-[#0066CC] focus:ring-[#0066CC] border-gray-600 bg-gray-900"
                />
                <span className="text-xs sm:text-sm font-medium text-gray-200 select-none">
                  Save these details to my profile for faster checkout
                </span>
              </label>
            </div>
          </div>

          {/* ── 5) Order Summary (Right Column / Sticky on Desktop) ── */}
          <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6">
            <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-6 space-y-6 shadow-xl">
              <h2 className="text-lg font-bold text-white border-b border-[#1f293d] pb-4 flex items-center justify-between">
                <span>Order Summary</span>
                <span className="text-xs font-normal text-gray-400">
                  {availableLines.length} {availableLines.length === 1 ? 'item' : 'items'}
                </span>
              </h2>

              {/* Items List */}
              <div className="max-h-60 overflow-y-auto overscroll-contain divide-y divide-[#1f293d] -my-2 pr-1 space-y-1">
                {availableLines.map((line) => (
                  <div key={line.partId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white truncate">{line.part.name}</p>
                      <p className="text-gray-400 mt-0.5">
                        Qty: {line.qty} {line.part.price ? `× ${formatNPR(line.part.price)}` : ''}
                      </p>
                    </div>
                    <span className="font-bold text-white shrink-0">
                      {formatNPR(line.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Calculations */}
              <div className="space-y-3 pt-4 border-t border-[#1f293d]">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="font-semibold text-white">{formatNPR(subtotal)}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">
                    Delivery ({deliveryMethod === 'pickup' ? 'Showroom pickup' : 'Standard'})
                  </span>
                  <span
                    className={`font-semibold ${
                      deliveryFee === 0 ? 'text-emerald-400' : 'text-white'
                    }`}
                  >
                    {deliveryFee === 0 ? 'Free' : formatNPR(deliveryFee)}
                  </span>
                </div>

                <div className="pt-3 border-t border-[#1f293d] flex items-baseline justify-between">
                  <span className="text-base font-bold text-white">Total</span>
                  <span className="text-xl font-extrabold text-[#4da3ff]">
                    {formatNPR(grandTotal)}
                  </span>
                </div>
              </div>

              {/* Note on upcoming online discount */}
              <div className="p-3 bg-[#111827] border border-[#1f293d] rounded-xl text-[11px] text-gray-400 leading-relaxed">
                Online payment will bring delivery down to Rs 250 when it opens.
              </div>

              {/* ── 6) Place Order Button ── */}
              <div className="space-y-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting || hasIssues || !hasAvailableLines}
                  className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] disabled:bg-[#111827] disabled:text-gray-600 disabled:border disabled:border-[#1f293d] disabled:cursor-not-allowed text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#0066CC]/20 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                >
                  {submitting ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin text-white" />
                      <span>Placing order...</span>
                    </>
                  ) : (
                    <>
                      <span>Place order</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center text-gray-500">
                  By placing an order, you agree to receive a confirmation call from Raj
                  Automobiles, Lahan.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
