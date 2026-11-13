import React from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, ArrowLeft } from 'lucide-react';

export default function Checkout() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#151c2c] border border-[#1f293d] rounded-2xl p-8 text-center space-y-6 shadow-xl">
        <div className="w-16 h-16 rounded-2xl bg-[#111827] border border-[#1f293d] flex items-center justify-center mx-auto text-[#0066CC]">
          <ShoppingCart className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white tracking-tight">Checkout</h1>
          <p className="text-sm text-gray-300 leading-relaxed">
            Checkout opens soon. Your cart is saved.
          </p>
        </div>

        <div className="pt-2">
          <Link
            to="/cart"
            className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to cart</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

