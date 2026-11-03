import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Plus, Trash2, ShoppingBag } from 'lucide-react';

export default function SaleExtras({ extras, setExtras, disabled }) {
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPartId, setSelectedPartId] = useState('');

  // Fetch active parts only (pinned first, never fetch part_costs)
  useEffect(() => {
    async function loadParts() {
      setLoading(true);
      const { data, error } = await supabase
        .from('parts')
        .select('id, name, category, price, stock_qty, is_pinned')
        .eq('active', true)
        .order('is_pinned', { ascending: false })
        .order('name', { ascending: true });

      if (!error && data) {
        setParts(data);
      }
      setLoading(false);
    }
    loadParts();
  }, []);

  const filteredParts = parts.filter((p) => {
    // Only show parts with stock > 0
    if (p.stock_qty <= 0) return false;
    // Don't show parts already added
    if (extras.some((ex) => ex.part_id === p.id)) return false;
    if (!search.trim()) return true;
    return p.name.toLowerCase().includes(search.toLowerCase());
  });

  const handleAddPart = () => {
    if (!selectedPartId) return;
    const part = parts.find((p) => p.id === selectedPartId);
    if (!part || part.stock_qty <= 0) return;

    setExtras((prev) => [
      ...prev,
      {
        part_id: part.id,
        part_name: part.name,
        unit_price: Number(part.price),
        stock_qty: part.stock_qty,
        qty: 1,
      },
    ]);
    setSelectedPartId('');
    setSearch('');
  };

  const handleUpdateQty = (partId, delta) => {
    setExtras((prev) =>
      prev.map((item) => {
        if (item.part_id !== partId) return item;
        const newQty = item.qty + delta;
        if (newQty < 1) return item;
        if (newQty > item.stock_qty) return item;
        return { ...item, qty: newQty };
      })
    );
  };

  const handleRemove = (partId) => {
    setExtras((prev) => prev.filter((item) => item.part_id !== partId));
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between border-b border-[#1f293d] pb-2">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
          <ShoppingBag className="w-3.5 h-3.5 text-[#0066CC]" />
          Extra Products & Accessories
        </h3>
        <span className="text-[11px] text-gray-500">Helmets, Guards, etc.</span>
      </div>

      {/* Part selector dropdown + Add button */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <select
            className="w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-[#0066CC] appearance-none cursor-pointer disabled:opacity-50 min-h-[44px]"
            value={selectedPartId}
            onChange={(e) => setSelectedPartId(e.target.value)}
            disabled={disabled || loading || filteredParts.length === 0}
          >
            <option value="">
              {loading
                ? 'Loading accessories…'
                : filteredParts.length === 0
                ? 'No available accessories to add'
                : '— Select an accessory / product —'}
            </option>
            {filteredParts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.is_pinned ? '★ ' : ''}
                {p.name} — NPR {Number(p.price).toLocaleString('en-IN')} (Stock: {p.stock_qty})
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleAddPart}
          disabled={disabled || !selectedPartId}
          className="min-h-[44px] px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider bg-[#0066CC]/20 border border-[#0066CC]/40 text-[#0066CC] hover:bg-[#0066CC]/30 hover:border-[#0066CC] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Product</span>
        </button>
      </div>

      {/* Added Extras List */}
      {extras.length > 0 && (
        <div className="space-y-2">
          {extras.map((item) => (
            <div
              key={item.part_id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0b0f19] border border-[#1f293d]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{item.part_name}</p>
                <p className="text-xs text-gray-400">
                  NPR {item.unit_price.toLocaleString('en-IN')} each · Stock: {item.stock_qty}
                </p>
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center gap-1.5 bg-[#151c2c] border border-[#1f293d] rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => handleUpdateQty(item.part_id, -1)}
                  disabled={disabled || item.qty <= 1}
                  className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold min-h-[32px]"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="w-8 text-center text-xs font-bold text-white">{item.qty}</span>
                <button
                  type="button"
                  onClick={() => handleUpdateQty(item.part_id, 1)}
                  disabled={disabled || item.qty >= item.stock_qty}
                  className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-white rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-sm font-bold min-h-[32px]"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>

              {/* Line total & remove */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-white whitespace-nowrap">
                  NPR {(item.unit_price * item.qty).toLocaleString('en-IN')}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(item.part_id)}
                  disabled={disabled}
                  className="p-2 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                  title="Remove item"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
