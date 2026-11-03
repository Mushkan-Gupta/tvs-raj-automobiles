import React from 'react';
import { AlertTriangle, CheckCircle, Calculator } from 'lucide-react';

export default function SaleSummary({ computed, paymentStatus, amountPaid }) {
  if (!computed) return null;

  const {
    base,
    discount_amount,
    discount_percent_effective,
    sold_price,
    extras_total,
    final_price,
    needs_approval,
  } = computed;

  const paidNum =
    paymentStatus === 'Fully Paid'
      ? final_price
      : Math.min(final_price, Number(amountPaid || 0));
  const balance = Math.max(0, final_price - paidNum);

  return (
    <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3.5">
      <div className="flex items-center justify-between border-b border-blue-500/15 pb-2">
        <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5" />
          Price Breakdown
        </span>
        {needs_approval ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            Needs Admin Approval
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" />
            Auto-Approved
          </span>
        )}
      </div>

      {/* Line item breakdown */}
      <div className="space-y-1.5 text-xs text-gray-300">
        <div className="flex justify-between">
          <span className="text-gray-400">Bike Price</span>
          <span className="font-semibold text-white">NPR {base.toLocaleString('en-IN')}</span>
        </div>

        {discount_amount > 0 && (
          <div className="flex justify-between text-amber-400">
            <span>
              Discount ({discount_percent_effective.toFixed(1)}%)
            </span>
            <span className="font-semibold">- NPR {discount_amount.toLocaleString('en-IN')}</span>
          </div>
        )}

        <div className="flex justify-between border-t border-[#1f293d] pt-1 text-gray-200">
          <span>Sold Price</span>
          <span className="font-semibold">NPR {sold_price.toLocaleString('en-IN')}</span>
        </div>

        {extras_total > 0 && (
          <div className="flex justify-between text-[#0066CC]">
            <span>Extra Products / Accessories</span>
            <span className="font-semibold">+ NPR {extras_total.toLocaleString('en-IN')}</span>
          </div>
        )}

        <div className="flex justify-between border-t border-blue-500/20 pt-2 text-sm">
          <span className="font-bold text-white uppercase tracking-wider">Final Price</span>
          <span className="font-black text-emerald-400 text-base">
            NPR {final_price.toLocaleString('en-IN')}
          </span>
        </div>

        {/* Payment and balance status */}
        {paymentStatus && (
          <div className="flex flex-wrap items-center justify-between pt-2 border-t border-blue-500/15 text-xs">
            <span className="text-gray-400">
              Paid: <strong className="text-white">NPR {paidNum.toLocaleString('en-IN')}</strong>
            </span>
            <span className="text-gray-400">
              Balance Due: <strong className={balance > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                NPR {balance.toLocaleString('en-IN')}
              </strong>
            </span>
          </div>
        )}
      </div>

      {needs_approval && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <span>
            Discount exceeds 10% of bike price. This sale will be submitted to the admin for approval before stock is updated.
          </span>
        </div>
      )}
    </div>
  );
}

