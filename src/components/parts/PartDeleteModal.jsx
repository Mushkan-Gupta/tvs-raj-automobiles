import React, { useState } from 'react';
import { AlertCircle, EyeOff, Trash2, X, RefreshCw } from 'lucide-react';

export default function PartDeleteModal({
  part,
  onDeactivate,
  onPermanentDelete,
  onReactivate,
  onClose,
  loading,
}) {
  const [showPermanentConfirm, setShowPermanentConfirm] = useState(false);

  if (!part) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full shrink-0 ${
              showPermanentConfirm
                ? 'bg-red-500/15 border border-red-500/30 text-red-400'
                : 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
            }`}>
              {showPermanentConfirm ? (
                <Trash2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {showPermanentConfirm ? 'Confirm Permanent Delete' : (part.active ? 'Remove or Deactivate Part' : 'Manage Inactive Part')}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">{part.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#151c2c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {showPermanentConfirm ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs leading-relaxed">
              <strong className="block text-red-200 font-semibold mb-1">Warning: Permanent Action</strong>
              This will permanently delete <strong>"{part.name}"</strong>, including its cost price and bike compatibility records. This action cannot be undone.
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowPermanentConfirm(false)}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl border border-[#1f293d] text-gray-300 hover:text-white text-sm font-semibold transition-colors min-h-[44px]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={onPermanentDelete}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center space-x-2 min-h-[44px]"
              >
                <Trash2 className="w-4 h-4" />
                <span>{loading ? 'Deleting...' : 'Yes, Delete Permanently'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-300">
              {part.active ? (
                <>
                  By default, deleting deactivates the part so it is hidden from the public catalogue while preserving stock and sales history.
                </>
              ) : (
                <>
                  This part is currently <strong>inactive</strong>. You can reactivate it anytime, or permanently delete it from the system.
                </>
              )}
            </p>

            <div className="space-y-2.5 pt-2">
              {part.active ? (
                <>
                  {/* Primary recommended option: Deactivate */}
                  <button
                    type="button"
                    onClick={onDeactivate}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-colors flex items-center justify-center space-x-2 min-h-[44px] shadow-lg"
                  >
                    <EyeOff className="w-4 h-4" />
                    <span>{loading ? 'Deactivating...' : 'Deactivate Part (Recommended)'}</span>
                  </button>

                  {/* Secondary option: Permanent delete */}
                  <button
                    type="button"
                    onClick={() => setShowPermanentConfirm(true)}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-semibold transition-colors flex items-center justify-center space-x-2 min-h-[44px]"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Delete...</span>
                  </button>
                </>
              ) : (
                <>
                  {/* Option to reactivate */}
                  {onReactivate && (
                    <button
                      type="button"
                      onClick={onReactivate}
                      disabled={loading}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors flex items-center justify-center space-x-2 min-h-[44px] shadow-lg"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{loading ? 'Reactivating...' : 'Reactivate Part'}</span>
                    </button>
                  )}

                  {/* Option to permanently delete */}
                  <button
                    type="button"
                    onClick={() => setShowPermanentConfirm(true)}
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors flex items-center justify-center space-x-2 min-h-[44px]"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Permanently Delete Part</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl border border-[#1f293d] text-gray-400 hover:text-white text-sm font-semibold transition-colors min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
