import React from 'react';
import { Pin, AlertTriangle, CheckCircle2, EyeOff } from 'lucide-react';

export function PinnedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0066CC]/20 text-[#3399FF] border border-[#0066CC]/40 tracking-wide">
      <Pin className="w-3 h-3 fill-current rotate-45" />
      Pinned
    </span>
  );
}

export function InactiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-700/40 text-gray-400 border border-gray-600/40 tracking-wide">
      <EyeOff className="w-3 h-3" />
      Inactive
    </span>
  );
}

export function StockBadge({ stockQty, lowStockThreshold }) {
  const isOutOfStock = stockQty <= 0;
  const isLowStock = !isOutOfStock && stockQty <= (lowStockThreshold || 3);

  if (isOutOfStock) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
        <AlertTriangle className="w-3 h-3" />
        Out of Stock (0)
      </span>
    );
  }

  if (isLowStock) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
        <AlertTriangle className="w-3 h-3" />
        Low Stock ({stockQty})
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
      <CheckCircle2 className="w-3 h-3" />
      {stockQty} in stock
    </span>
  );
}
