import React from 'react';
import { Tag, FileText, Wrench } from 'lucide-react';

const inputCls =
  'w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg py-2.5 px-3 text-sm ' +
  'focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors ' +
  'placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed';

const selectCls =
  'w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg py-2.5 px-3 text-sm ' +
  'focus:outline-none focus:border-[#0066CC] appearance-none cursor-pointer ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

export default function SaleAdjustments({
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  paperworkCharge,
  setPaperworkCharge,
  modificationCharge,
  setModificationCharge,
  modificationNote,
  setModificationNote,
  disabled,
}) {
  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between border-b border-[#1f293d] pb-2">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-[#0066CC]" />
          Adjustments (Optional)
        </h3>
        <span className="text-[11px] text-gray-500">Discount & Charges</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Discount section */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
            Discount
          </label>
          <div className="flex gap-2">
            <div className="w-24 shrink-0">
              <select
                className={selectCls}
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                disabled={disabled}
              >
                <option value="percent">% Off</option>
                <option value="amount">Rs (NPR)</option>
              </select>
            </div>
            <div className="relative flex-1">
              <input
                type="number"
                min="0"
                step="any"
                className={inputCls}
                placeholder={discountType === 'percent' ? 'e.g. 5' : 'e.g. 10000'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>
        </div>

        {/* Paperwork charge */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-gray-400" />
            Paperwork Charge (NPR)
          </label>
          <input
            type="number"
            min="0"
            step="any"
            className={inputCls}
            placeholder="e.g. 2000"
            value={paperworkCharge}
            onChange={(e) => setPaperworkCharge(e.target.value)}
            disabled={disabled}
          />
        </div>

        {/* Modification charge */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Wrench className="w-3.5 h-3.5 text-gray-400" />
            Modification Charge (NPR)
          </label>
          <input
            type="number"
            min="0"
            step="any"
            className={inputCls}
            placeholder="e.g. 1500"
            value={modificationCharge}
            onChange={(e) => setModificationCharge(e.target.value)}
            disabled={disabled}
          />
        </div>

        {/* Modification Note */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider">
            Modification Note
          </label>
          <input
            type="text"
            maxLength={100}
            className={inputCls}
            placeholder="e.g. Custom leg guard fitting, seat cover"
            value={modificationNote}
            onChange={(e) => setModificationNote(e.target.value)}
            disabled={disabled || !modificationCharge || Number(modificationCharge) <= 0}
          />
        </div>
      </div>
    </div>
  );
}

