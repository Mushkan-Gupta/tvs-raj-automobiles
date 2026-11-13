import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, Trash2, ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { useCart } from '../lib/CartContext';
import { useCartLines } from '../lib/useCartLines';
import { formatNPR } from '../lib/formatters';
import PartImagePlaceholder from '../components/parts/PartImagePlaceholder';

export default function Cart() {
  const { count, setQty, removeItem } = useCart();
  const { lines, subtotal, loading, error, hasIssues, fixCart } = useCartLines();

  const availableLines = lines.filter((l) => l.available);
  const hasAvailableLines = availableLines.length > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-[#1f293d] pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-[#0066CC] p-2.5 rounded-xl">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Shopping Cart
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {count} {count === 1 ? 'item' : 'items'} in your cart
            </p>
          </div>
        </div>

        <Link
          to="/parts"
          className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 rounded-lg bg-[#151c2c] hover:bg-[#1f293d] border border-[#1f293d] text-xs font-semibold text-gray-300 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
        >
          <ArrowLeft className="w-4 h-4 text-[#0066CC]" />
          <span>Continue shopping</span>
        </Link>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stock Issues & Fix Cart Banner */}
      {hasIssues && lines.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-amber-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
            <span>Some items in your cart are out of stock or have limited inventory.</span>
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

      {loading && lines.length === 0 ? (
        <div className="py-20 text-center text-sm text-gray-400 space-y-3">
          <div className="w-8 h-8 border-2 border-[#0066CC] border-t-transparent rounded-full animate-spin mx-auto" />
          <p>Loading your cart items...</p>
        </div>
      ) : lines.length === 0 ? (
        /* Empty State */
        <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-12 text-center space-y-6 max-w-lg mx-auto my-8">
          <div className="w-20 h-20 rounded-2xl bg-[#111827] border border-[#1f293d] flex items-center justify-center mx-auto text-gray-500">
            <ShoppingCart className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Your cart is empty</h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              Explore genuine TVS motorcycle parts, engine lubricants, and official accessories.
            </p>
          </div>
          <Link
            to="/parts"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-3 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
          >
            <span>Browse parts catalogue</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        /* Roomy 2-Column Layout */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Lines List */}
          <div className="lg:col-span-8 space-y-4">
            {lines.map((line) => {
              const isUnavailable = !line.available;
              return (
                <div
                  key={line.partId}
                  className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row gap-4 transition-colors duration-150 ${
                    isUnavailable
                      ? 'bg-[#111827]/70 border-[#1f293d] opacity-75'
                      : 'bg-[#151c2c] border-[#1f293d]'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-[#111827] border border-[#1f293d] overflow-hidden shrink-0 flex items-center justify-center">
                    {line.part.image_url ? (
                      <img
                        src={line.part.image_url}
                        alt={line.part.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <PartImagePlaceholder category={line.part.category} name={line.part.name} />
                    )}
                  </div>

                  {/* Info & Controls */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-white truncate">
                            {line.part.name}
                          </h3>
                          {line.part.category && (
                            <span className="block text-xs text-gray-400 mt-0.5">
                              {line.part.category}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(line.partId)}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 shrink-0"
                          aria-label={`Remove ${line.part.name} from cart`}
                          title="Remove item"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Status badge if any */}
                      {line.statusText && (
                        <div className="mt-2">
                          <span
                            className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-md border ${
                              line.status === 'clamped'
                                ? 'bg-amber-950/70 text-amber-300 border-amber-800/80'
                                : 'bg-red-950/70 text-red-300 border-red-800/80'
                            }`}
                          >
                            {line.statusText}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Controls: Unit price, Stepper, Line Total */}
                    <div className="pt-3 border-t border-[#1f293d] flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <span className="block text-xs text-gray-400">Unit Price</span>
                        <span className="block text-sm font-semibold text-white">
                          {formatNPR(line.part.price)}
                        </span>
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center bg-[#111827] border border-[#1f293d] rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => setQty(line.partId, line.qty - 1)}
                          className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded text-gray-300 hover:text-white hover:bg-[#151c2c] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                          aria-label={line.qty === 1 ? `Remove ${line.part.name}` : `Decrease quantity`}
                          title={line.qty === 1 ? 'Remove from cart' : 'Decrease'}
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-bold text-white px-3 min-w-[28px] text-center select-none" aria-label={`Quantity: ${line.qty}`}>
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          disabled={line.stockQty > 0 ? line.qty >= line.stockQty : true}
                          onClick={() => setQty(line.partId, line.qty + 1)}
                          className="w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded text-gray-300 hover:text-white hover:bg-[#151c2c] disabled:text-gray-600 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                          aria-label={`Increase quantity`}
                          title={line.stockQty > 0 && line.qty >= line.stockQty ? 'Maximum stock reached' : 'Increase'}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Line Total */}
                      <div className="text-right">
                        <span className="block text-xs text-gray-400">Item Total</span>
                        <span className="block text-base sm:text-lg font-bold text-white">
                          {isUnavailable ? '—' : formatNPR(line.lineTotal)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Order Summary Card */}
          <div className="lg:col-span-4 sticky top-24">
            <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-6 space-y-6 shadow-xl">
              <h2 className="text-lg font-bold text-white border-b border-[#1f293d] pb-4">
                Order Summary
              </h2>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Items subtotal</span>
                  <span className="font-bold text-white text-base">
                    {formatNPR(subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-400 pt-2 border-t border-[#1f293d]">
                  <span>Delivery</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <Link
                  to={hasAvailableLines ? '/checkout' : '#'}
                  aria-disabled={!hasAvailableLines}
                  onClick={(e) => {
                    if (!hasAvailableLines) e.preventDefault();
                  }}
                  className={`w-full min-h-[48px] px-6 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                    hasAvailableLines
                      ? 'bg-[#0066CC] hover:bg-[#0052A3] text-white shadow-lg shadow-[#0066CC]/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]'
                      : 'bg-[#111827] text-gray-600 border border-[#1f293d] cursor-not-allowed pointer-events-none'
                  }`}
                >
                  <span>Proceed to checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  to="/parts"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#111827] hover:bg-[#1f293d] border border-[#1f293d] text-gray-300 hover:text-white text-xs font-semibold flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                >
                  Continue shopping
                </Link>
              </div>

              <div className="pt-2 text-center">
                <p className="text-[11px] text-gray-500">
                  Genuine TVS parts guaranteed by Raj Automobiles, Lahan.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
