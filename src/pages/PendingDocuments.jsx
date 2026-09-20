import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import AdminNav from '../components/AdminNav';
import {
  FileText, CheckCircle2, Clock, RefreshCw, AlertCircle, Check,
  User, Bike, ShieldCheck, Search,
  Save, LogOut, Package, CreditCard, Sparkles,
} from 'lucide-react';

// Shared styling
const inputCls =
  'w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg py-2.5 px-3 text-sm ' +
  'focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors ' +
  'placeholder:text-gray-600 disabled:opacity-50';

function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === 'error';
  return (
    <div
      className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-xl
        shadow-2xl border text-sm font-semibold animate-in slide-in-from-top-2 duration-300
        ${isErr
          ? 'bg-red-900/90 border-red-500/50 text-red-200'
          : 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200'}`}
    >
      {isErr ? <AlertCircle className="w-5 h-5 text-red-400 shrink-0" /> : <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
      <span>{toast.message}</span>
    </div>
  );
}

// ── Buyer-type document column classification ─────────────────────────────────
// Real Documents tab columns:
// Individual: Citizenship / NID / Passport | Driving License | Passport Photos | PAN Card
// Corporate:  Company Registration Certificate | Company PAN/VAT Certificate |
//             Board Authorization Letter | Authorized Signatory ID
// Common:     Payment Receipt | Insurance Collected

function isIndividualDocCol(name) {
  const h = (name || '').trim().toLowerCase();
  return (
    h.includes('citizenship') || h.includes('nid') ||
    h.includes('passport') ||
    h.includes('driving') || h.includes('license') ||
    (h.includes('pan') && !h.includes('vat') && !h.includes('company'))
  );
}

function isCorporateDocCol(name) {
  const h = (name || '').trim().toLowerCase();
  return (
    h.includes('registration') ||
    h.includes('company') ||
    (h.includes('pan') && h.includes('vat')) ||
    h.includes('board') || h.includes('authorization') || h.includes('signatory')
  );
}

function isCommonDocCol(name) {
  const h = (name || '').trim().toLowerCase();
  return h.includes('payment') || h.includes('insurance');
}

// Determine if a document checkbox column is relevant to the given buyer type
function isDocRelevantForBuyer(docName, buyerType) {
  const isIndividual = (buyerType || 'individual').trim().toLowerCase() === 'individual';
  if (isCommonDocCol(docName)) return true;
  const indCol = isIndividualDocCol(docName);
  const corpCol = isCorporateDocCol(docName);
  if (indCol && !corpCol) return isIndividual;
  if (corpCol && !indCol) return !isIndividual;
  return true; // unknown column — show for everyone
}

export default function PendingDocuments() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBuyer, setFilterBuyer] = useState('ALL');
  const [toast, setToast] = useState(null);

  // Local state tracking modified checkboxes per saleId: { [saleId]: { [colName]: boolean } }
  const [localCheckboxes, setLocalCheckboxes] = useState({});
  const [savingSaleId, setSavingSaleId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchPendingDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-pending-documents');
      if (error) {
        let detail = error.message;
        try {
          if (error.context instanceof Response) {
            const body = await error.context.json();
            detail = body?.detail || body?.error || error.message;
          }
        } catch {}
        console.warn('[get-pending-documents] Error:', detail);
        showToast(`Failed to load documents: ${detail}`, 'error');
        setDocuments([]);
      } else {
        const docs = data?.documents || [];
        setDocuments(docs);
        // Initialize local checkboxes
        const initialMap = {};
        docs.forEach((doc) => {
          initialMap[doc.saleId] = { ...(doc.checkboxes || {}) };
        });
        setLocalCheckboxes(initialMap);
      }
    } catch (err) {
      console.error('[get-pending-documents] Network error:', err);
      showToast('Network error loading pending documents.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingDocuments();
  }, [fetchPendingDocuments]);

  const handleCheckboxToggle = (saleId, colName) => {
    setLocalCheckboxes((prev) => {
      const currentSale = prev[saleId] || {};
      return {
        ...prev,
        [saleId]: {
          ...currentSale,
          [colName]: !currentSale[colName],
        },
      };
    });
  };

  const handleSave = async (doc) => {
    const saleId = doc.saleId;
    const currentLocal = localCheckboxes[saleId] || {};
    const original = doc.checkboxes || {};

    // Calculate only changed checkboxes
    const changedFields = {};
    Object.keys(currentLocal).forEach((key) => {
      if (Boolean(currentLocal[key]) !== Boolean(original[key])) {
        changedFields[key] = Boolean(currentLocal[key]);
      }
    });

    if (Object.keys(changedFields).length === 0) {
      showToast('No changes to save.', 'error');
      return;
    }

    setSavingSaleId(saleId);
    try {
      const { data, error } = await supabase.functions.invoke('update-documents', {
        body: {
          saleId,
          updatedFields: changedFields,
        },
      });

      if (error) {
        let detail = error.message;
        try {
          if (error.context instanceof Response) {
            const body = await error.context.json();
            detail = body?.detail || body?.error || error.message;
          }
        } catch {}
        console.warn('[update-documents] Error:', detail);
        showToast(`Save failed: ${detail}`, 'error');
      } else {
        const isHandoverReady = Boolean(data?.updatedRow?.handoverReady);
        if (isHandoverReady) {
          showToast(`🎉 ${saleId} is now HANDOVER READY! Removed from pending list.`, 'success');
          // Remove from list
          setDocuments((prev) => prev.filter((d) => d.saleId !== saleId));
          setLocalCheckboxes((prev) => {
            const copy = { ...prev };
            delete copy[saleId];
            return copy;
          });
        } else {
          showToast(`Updated documents for ${saleId} ✓`, 'success');
          // Update original doc in state
          setDocuments((prev) =>
            prev.map((d) => {
              if (d.saleId === saleId) {
                return {
                  ...d,
                  checkboxes: { ...d.checkboxes, ...changedFields },
                };
              }
              return d;
            })
          );
        }
      }
    } catch (err) {
      console.error('[update-documents] Exception:', err);
      showToast('Failed to save document updates.', 'error');
    } finally {
      setSavingSaleId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-login');
  };

  // Filtered list
  const filteredDocs = documents.filter((doc) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      doc.saleId?.toLowerCase().includes(q) ||
      doc.customerName?.toLowerCase().includes(q) ||
      doc.bikeName?.toLowerCase().includes(q);

    const matchesBuyer =
      filterBuyer === 'ALL' ||
      (doc.buyerType || '').toUpperCase() === filterBuyer;

    return matchesSearch && matchesBuyer;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <Toast toast={toast} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#1f293d]">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#0066CC] uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Post-Sale Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Pending Documents</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Verify buyer paperwork and activate Handover Ready status
            {user?.email && (
              <span className="ml-2 text-gray-500">— {user.email}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPendingDocuments}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border border-[#1f293d]
              text-gray-300 hover:text-white hover:bg-[#151c2c] text-sm font-semibold transition-colors"
            title="Refresh documents"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border border-[#1f293d]
              text-gray-400 hover:text-red-400 hover:border-red-500/40 text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      {role === 'admin' ? (
        <AdminNav pendingDocsCount={documents.length} />
      ) : (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#1f293d]/80 text-sm font-medium">
          <Link
            to="/employee/dashboard"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#151c2c] transition-colors shrink-0"
          >
            <Package className="w-4 h-4" />
            <span>Stock Logging</span>
          </Link>
          <Link
            to="/employee/pending-documents"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#0066CC]/15 border border-[#0066CC]/40 text-[#0066CC] font-bold shrink-0"
          >
            <FileText className="w-4 h-4" />
            <span>Pending Documents</span>
            {documents.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-[#0066CC] text-white">
                {documents.length}
              </span>
            )}
          </Link>
          <Link
            to="/employee/pending-payments"
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-[#151c2c] transition-colors shrink-0"
          >
            <CreditCard className="w-4 h-4" />
            <span>Pending Payments</span>
          </Link>
        </div>
      )}

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by Sale ID, Customer Name, or Bike..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputCls + ' pl-9'}
          />
        </div>
        <div className="flex gap-2">
          {['ALL', 'INDIVIDUAL', 'CORPORATE'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterBuyer(type)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                filterBuyer === type
                  ? 'bg-[#0066CC] border-[#0066CC] text-white shadow-sm'
                  : 'bg-[#0b0f19] border-[#1f293d] text-gray-400 hover:text-white'
              }`}
            >
              {type === 'ALL' ? 'All Buyers' : type === 'INDIVIDUAL' ? 'Individual' : 'Corporate'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Document List ── */}
      {loading ? (
        <div className="p-16 text-center bg-[#0e1422] border border-[#1f293d] rounded-2xl space-y-3">
          <RefreshCw className="w-8 h-8 text-[#0066CC] animate-spin mx-auto" />
          <p className="text-gray-400 text-sm font-medium">Checking Google Sheets for pending documents…</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="p-16 text-center bg-[#0e1422] border border-[#1f293d] rounded-2xl space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-white">All Documents Complete!</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            {search || filterBuyer !== 'ALL'
              ? 'No pending sales match your search or filter.'
              : 'There are no sales pending document clearance. All logged sales are Handover Ready.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDocs.map((doc) => {
            const saleId = doc.saleId;
            const currentChecks = localCheckboxes[saleId] || {};
            const isSaving = savingSaleId === saleId;

            // Extract all keys present in this doc's checkboxes
            const allCheckKeys = Object.keys(currentChecks);

            // Filter relevant document keys for this buyer type
            const relevantKeys = allCheckKeys.length > 0
              ? allCheckKeys.filter((key) => isDocRelevantForBuyer(key, doc.buyerType))
              : (doc.buyerType?.toLowerCase() === 'corporate'
                  ? [
                      'Company Registration Certificate',
                      'Company PAN/VAT Certificate',
                      'Board Authorization Letter',
                      'Authorized Signatory ID',
                      'Payment Receipt',
                      'Insurance Collected',
                    ]
                  : [
                      'Citizenship / NID / Passport',
                      'Driving License',
                      'Passport Photos',
                      'PAN Card',
                      'Payment Receipt',
                      'Insurance Collected',
                    ]);

            // Calculate progress
            const totalRequired = relevantKeys.length;
            const completedCount = relevantKeys.filter((k) => Boolean(currentChecks[k])).length;
            const allChecked = totalRequired > 0 && completedCount === totalRequired;

            // Check if any change has been made compared to original
            const originalChecks = doc.checkboxes || {};
            const hasUnsavedChanges = relevantKeys.some(
              (k) => Boolean(currentChecks[k]) !== Boolean(originalChecks[k])
            );

            return (
              <div
                key={saleId}
                className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-5 hover:border-gray-700/80 transition-colors"
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#1f293d]">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-black text-white bg-[#151c2c] border border-[#1f293d] px-2.5 py-1 rounded-lg">
                        {saleId}
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                          doc.buyerType?.toLowerCase() === 'corporate'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        }`}
                      >
                        {doc.buyerType || 'Individual'}
                      </span>
                      {allChecked && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Ready for Handover
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 pt-1">
                      <span className="flex items-center gap-1 text-gray-300 font-semibold">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                        {doc.customerName}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-gray-300 font-semibold">
                        <Bike className="w-3.5 h-3.5 text-gray-500" />
                        {doc.bikeName}
                      </span>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-gray-400 font-medium">Compliance Progress</div>
                      <div className="text-sm font-black text-white">
                        <span className={completedCount === totalRequired ? 'text-emerald-400' : 'text-[#0066CC]'}>
                          {completedCount}
                        </span>
                        <span className="text-gray-500"> / {totalRequired} Completed</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Checkboxes Grid */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-gray-500" />
                    Required Documents Checklist ({doc.buyerType})
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {relevantKeys.map((colName) => {
                      const isChecked = Boolean(currentChecks[colName]);
                      const isCommon = colName.toLowerCase().includes('payment') || colName.toLowerCase().includes('insurance');

                      return (
                        <label
                          key={colName}
                          className={`flex items-start space-x-3 p-3 rounded-xl border cursor-pointer select-none transition-all ${
                            isChecked
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                              : 'bg-[#151c2c]/60 border-[#1f293d] text-gray-300 hover:border-gray-600'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleCheckboxToggle(saleId, colName)}
                            disabled={isSaving}
                            className="w-4 h-4 mt-0.5 rounded border-[#1f293d] text-[#0066CC] focus:ring-0 focus:ring-offset-0 bg-[#0b0f19] cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold leading-tight block">
                              {colName}
                            </span>
                            {isCommon && (
                              <span className="text-[10px] text-gray-500 block mt-0.5">Required for handover</span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#1f293d]/80">
                  <div className="text-xs text-gray-500">
                    {hasUnsavedChanges ? (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Unsaved changes pending save
                      </span>
                    ) : (
                      <span>All changes saved to Google Sheet.</span>
                    )}
                  </div>

                  <button
                    onClick={() => handleSave(doc)}
                    disabled={isSaving || !hasUnsavedChanges}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs text-white transition-all
                      flex items-center justify-center gap-2
                      bg-[#0066CC] hover:bg-[#0052A3] disabled:opacity-40 disabled:cursor-not-allowed
                      shadow-[0_2px_10px_rgba(0,102,204,0.3)] min-h-[38px]"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Sheet…</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Document Status</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
