import React, { useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, X, Plus, Minus, Trash2, ArrowRight, AlertCircle } from 'lucide-react';
import { useCart } from '../lib/CartContext';
import { useCartLines } from '../lib/useCartLines';
import { formatNPR } from '../lib/formatters';
import PartImagePlaceholder from './parts/PartImagePlaceholder';

export default function CartDrawer() {
  const { isOpen, closeDrawer, setQty, removeItem, count } = useCart();
  const { lines, subtotal, loading, error, hasIssues, fixCart } = useCartLines();
  const navigate = useNavigate();

  const drawerRef = useRef(null);
  const closeButtonRef = useRef(null);
  const previousActiveElementRef = useRef(null);

  // Available lines count
  const availableLines = lines.filter((l) => l.available);
  const hasAvailableLines = availableLines.length > 0;

  // Manage body scroll lock and focus restoration
  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement;
      document.body.style.overflow = 'hidden';

      // Focus close button on open
      requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          closeDrawer();
          return;
        }

        // Focus trap
        if (e.key === 'Tab' && drawerRef.current) {
          const focusable = drawerRef.current.querySelectorAll(
            'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
          );
          if (focusable.length === 0) return;

          const first = focusable[0];
          const last = focusable[focusable.length - 1];

          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
        if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
          previousActiveElementRef.current.focus();
        }
      };
    }
  }, [isOpen, closeDrawer]);

  const handleGoToCart = useCallback(() => {
    closeDrawer();
    navigate('/cart');
  }, [closeDrawer, navigate]);

  const handleCheckout = useCallback(() => {
    closeDrawer();
    navigate('/checkout');
  }, [closeDrawer, navigate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="presentation">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ease-in-out"
        onClick={closeDrawer}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Cart"
        className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-[420px] bg-[#101626] border-l border-[#1f293d] shadow-2xl flex flex-col focus:outline-none"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#1f293d] flex items-center justify-between shrink-0 bg-[#101626]">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-[#0066CC]" />
            <h2 className="text-base font-bold text-white">Cart ({count})</h2>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#151c2c] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
            aria-label="Close cart"
            title="Close cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Issue Alert & Fix Cart Banner */}
        {hasIssues && lines.length > 0 && (
          <div className="bg-amber-950/40 border-b border-amber-800/60 p-3 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>Some items have changed stock.</span>
            </div>
            <button
              type="button"
              onClick={fixCart}
              className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 min-h-[36px]"
            >
              Fix cart
            </button>
          </div>
        )}

        {/* Content list */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
          {error && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading && lines.length === 0 ? (
            <div className="py-16 text-center text-xs text-gray-400 space-y-2">
              <div className="w-6 h-6 border-2 border-[#0066CC] border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Loading your cart...</p>
            </div>
          ) : lines.length === 0 ? (
            /* Empty State */
            <div className="py-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#151c2c] border border-[#1f293d] flex items-center justify-center mx-auto text-gray-500">
                <ShoppingCart className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Your cart is empty</h3>
                <p className="text-xs text-gray-400">
                  Add genuine TVS parts and accessories to get started.
                </p>
              </div>
              <Link
                to="/parts"
                onClick={closeDrawer}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
              >
                <span>Browse parts</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            lines.map((line) => {
              const isUnavailable = !line.available;
              return (
                <div
                  key={line.partId}
                  className={`rounded-xl border p-3 flex gap-3 transition-colors duration-150 ${
                    isUnavailable
                      ? 'bg-[#111827]/70 border-[#1f293d] opacity-75'
                      : 'bg-[#151c2c] border-[#1f293d]'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg bg-[#111827] border border-[#1f293d] overflow-hidden shrink-0 flex items-center justify-center">
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

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-white truncate">
                          {line.part.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => removeItem(line.partId)}
                          className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 shrink-0"
                          aria-label={`Remove ${line.part.name} from cart`}
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {line.part.category && (
                        <span className="block text-[11px] text-gray-400 truncate">
                          {line.part.category}
                        </span>
                      )}

                      {/* Status / Issue text */}
                      {line.statusText && (
                        <div className="mt-1">
                          <span
                            className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded border ${
                              line.status === 'clamped'
                                ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                                : 'bg-red-950/60 text-red-300 border-red-800/80'
                            }`}
                          >
                            {line.statusText}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Price and Stepper Row */}
                    <div className="mt-2 pt-2 border-t border-[#1f293d] flex items-center justify-between gap-2">
                      <div>
                        <span className="block text-xs font-bold text-white">
                          {isUnavailable ? '—' : formatNPR(line.lineTotal)}
                        </span>
                        {line.part.price && !isUnavailable && line.displayedQty > 1 && (
                          <span className="block text-[10px] text-gray-400">
                            {formatNPR(line.part.price)} each
                          </span>
                        )}
                      </div>

                      {/* Stepper */}
                      <div className="flex items-center bg-[#111827] border border-[#1f293d] rounded-lg p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setQty(line.partId, line.qty - 1)}
                          className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-gray-300 hover:text-white hover:bg-[#151c2c] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                          aria-label={line.qty === 1 ? `Remove ${line.part.name}` : `Decrease quantity`}
                          title={line.qty === 1 ? 'Remove from cart' : 'Decrease'}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-bold text-white px-2 min-w-[20px] text-center select-none" aria-label={`Quantity: ${line.qty}`}>
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          disabled={line.stockQty > 0 ? line.qty >= line.stockQty : true}
                          onClick={() => setQty(line.partId, line.qty + 1)}
                          className="w-8 h-8 min-w-[32px] min-h-[32px] flex items-center justify-center rounded text-gray-300 hover:text-white hover:bg-[#151c2c] disabled:text-gray-600 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                          aria-label={`Increase quantity`}
                          title={line.stockQty > 0 && line.qty >= line.stockQty ? 'Maximum stock reached' : 'Increase'}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {lines.length > 0 && (
          <div className="p-4 border-t border-[#1f293d] bg-[#101626] space-y-3 shrink-0">
            {/* Subtotal */}
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium text-gray-300">Subtotal</span>
              <span className="text-lg font-extrabold text-white">
                {formatNPR(subtotal)}
              </span>
            </div>

            <p className="text-xs text-gray-400">
              Delivery and taxes calculated at checkout
            </p>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleGoToCart}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-lg bg-[#151c2c] hover:bg-[#1f293d] border border-[#1f293d] text-white text-xs font-semibold flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
              >
                Go to cart
              </button>

              <button
                type="button"
                disabled={!hasAvailableLines}
                onClick={handleCheckout}
                className="w-full min-h-[44px] px-3 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] disabled:bg-[#151c2c] disabled:text-gray-600 disabled:border disabled:border-[#1f293d] disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
              >
                Checkout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
