import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

import { Plus, Pencil, Trash2, Search, Filter, Check, AlertCircle, Package, Eye, EyeOff, Image as ImageIcon, FileSpreadsheet, RefreshCw, AlertTriangle } from 'lucide-react';
import AdminNav from '../components/AdminNav';
import { formatNPR } from '../lib/formatters';
import { PinnedBadge, InactiveBadge, StockBadge } from '../components/parts/PartBadges';
import PartFormModal from '../components/parts/PartFormModal';
import PartDeleteModal from '../components/parts/PartDeleteModal';

export default function AdminParts() {

  // Data state
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE' | 'LOW_STOCK' | 'PINNED'

  // Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [editingPart, setEditingPart] = useState(null); // null = adding

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Background Sheet Sync Helper ─────────────────────────────────────────
  const triggerBackgroundSync = async (payload) => {
    try {
      const { data, error } = await supabase.functions.invoke('sync-parts-to-sheet', {
        body: payload,
      });
      if (error || (data && !data.ok)) {
        console.warn('[AdminParts] Sheet sync warning:', error || data?.error);
        showToast("Saved, but the Google Sheet could not be updated. Use 'Sync all to Sheet'.", 'warning');
      }
    } catch (err) {
      console.warn('[AdminParts] Sheet sync error:', err);
      showToast("Saved, but the Google Sheet could not be updated. Use 'Sync all to Sheet'.", 'warning');
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-parts-to-sheet', {
        body: { action: 'sync_all' },
      });
      if (error) {
        let msg = error.message;
        try {
          if (error.context instanceof Response) {
            const json = await error.context.json();
            msg = json?.error || msg;
          }
        } catch { /* ignore */ }
        showToast(`Sync failed: ${msg}`, 'error');
      } else if (data?.ok) {
        showToast('All parts synced to Google Sheet successfully ✓');
      } else {
        showToast(`Sync failed: ${data?.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showToast(`Sync error: ${err.message}`, 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  // ─── Fetch Parts ──────────────────────────────────────────────────────────
  const fetchParts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // Query parts ordered by pinned first, then sort_order, then name
      const { data, error } = await supabase
        .from('parts')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setParts(data || []);
    } catch (err) {
      console.error('[AdminParts] fetch error:', err);
      setFetchError(err.message || 'Failed to load parts catalogue.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  // Extract unique categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set();
    parts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [parts]);

  // Filtered & sorted parts list
  const filteredParts = useMemo(() => {
    return parts.filter((part) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = part.name?.toLowerCase().includes(q);
        const matchesCat = part.category?.toLowerCase().includes(q);
        const matchesDesc = part.description?.toLowerCase().includes(q);
        if (!matchesName && !matchesCat && !matchesDesc) return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL' && part.category !== selectedCategory) {
        return false;
      }

      // Status pill filter
      if (statusFilter === 'ACTIVE' && !part.active) return false;
      if (statusFilter === 'INACTIVE' && part.active) return false;
      if (statusFilter === 'PINNED' && !part.is_pinned) return false;
      if (statusFilter === 'LOW_STOCK') {
        const threshold = part.low_stock_threshold || 3;
        if (part.stock_qty > threshold) return false;
      }

      return true;
    });
  }, [parts, searchQuery, selectedCategory, statusFilter]);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleOpenAdd = () => {
    setEditingPart(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (part) => {
    setEditingPart(part);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingPart(null);
  };

  const handleSaved = (action, savedPartId) => {
    setFormOpen(false);
    setEditingPart(null);
    fetchParts();
    showToast(
      action === 'added'
        ? 'Part added successfully!'
        : action === 'updated'
        ? 'Part updated successfully!'
        : 'Changes saved!'
    );

    if (savedPartId) {
      triggerBackgroundSync({ action: 'upsert', part_id: savedPartId });
    }
  };

  // Toggle quick active status from list
  const handleToggleActive = async (part) => {
    try {
      const nextStatus = !part.active;
      const { error } = await supabase
        .from('parts')
        .update({ active: nextStatus })
        .eq('id', part.id);

      if (error) throw error;
      showToast(nextStatus ? 'Part activated!' : 'Part deactivated!');
      fetchParts();
      triggerBackgroundSync({ action: 'upsert', part_id: part.id });
    } catch (err) {
      showToast('Error updating status: ' + err.message, 'error');
    }
  };

  // Deactivate handler from delete modal
  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('parts')
        .update({ active: false })
        .eq('id', targetId);

      if (error) throw error;
      setDeleteTarget(null);
      fetchParts();
      showToast('Part deactivated successfully!');
      triggerBackgroundSync({ action: 'upsert', part_id: targetId });
    } catch (err) {
      showToast('Deactivation failed: ' + err.message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Reactivate handler from modal
  const handleReactivate = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('parts')
        .update({ active: true })
        .eq('id', targetId);

      if (error) throw error;
      setDeleteTarget(null);
      fetchParts();
      showToast('Part reactivated successfully!');
      triggerBackgroundSync({ action: 'upsert', part_id: targetId });
    } catch (err) {
      showToast('Reactivation failed: ' + err.message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Permanent delete handler
  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.id;
    const targetName = deleteTarget.name;
    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('parts')
        .delete()
        .eq('id', targetId);

      if (error) throw error;
      setDeleteTarget(null);
      fetchParts();
      showToast('Part permanently deleted.');
      triggerBackgroundSync({ action: 'delete', part_id: targetId, part_name: targetName });
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* ── Toast notification ── */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-semibold transition-all ${
            toast.type === 'error'
              ? 'bg-red-900/90 border-red-500/50 text-red-200'
              : toast.type === 'warning'
              ? 'bg-amber-900/90 border-amber-500/50 text-amber-200'
              : 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          ) : (
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#1f293d]">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Parts & Accessories</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#0066CC]/20 text-[#3399FF] border border-[#0066CC]/30">
              Admin
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-0.5">
            Manage parts catalogue, photos, pricing, confidential costs, and stock
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-bold transition-colors shadow-lg min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Part</span>
          </button>
        </div>
      </div>

      {/* ── Publishes pending counts to the sidebar badges ── */}
      <AdminNav />

      {/* ── Sync Bar & Sheet Advisory ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#0e1422] border border-[#1f293d] rounded-xl text-xs">
        <div className="flex items-start sm:items-center gap-2 text-gray-400">
          <FileSpreadsheet className="w-4 h-4 text-[#0066CC] shrink-0 mt-0.5 sm:mt-0" />
          <span>
            The Sheet is a copy. Edit parts here, not in the Sheet; edits made in the Sheet are overwritten.
          </span>
        </div>
        <button
          type="button"
          onClick={handleSyncAll}
          disabled={syncingAll || loading}
          className="self-start sm:self-auto min-h-[44px] px-4 py-2 rounded-lg bg-[#0066CC]/15 border border-[#0066CC]/30 hover:bg-[#0066CC]/25 text-[#0066CC] hover:text-white font-bold transition-colors flex items-center gap-2 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
          <span>{syncingAll ? 'Syncing to Sheet…' : 'Sync all to Sheet'}</span>
        </button>
      </div>

      {/* ── Controls & Filter Bar ── */}
      <div className="space-y-3 bg-[#0e1422] p-4 rounded-xl border border-[#1f293d]">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search box */}
          <div className="sm:col-span-7 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search parts by name, category, or description..."
              className="w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[#0066CC] transition-colors placeholder:text-gray-600 min-h-[44px]"
            />
          </div>

          {/* Category dropdown */}
          <div className="sm:col-span-5 relative">
            <Filter className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-xl py-2.5 pl-10 pr-8 text-sm focus:outline-none focus:border-[#0066CC] cursor-pointer appearance-none min-h-[44px]"
            >
              <option value="ALL">All Categories ({categories.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 text-xs">
          {[
            { id: 'ALL', label: `All (${parts.length})` },
            { id: 'ACTIVE', label: `Active (${parts.filter((p) => p.active).length})` },
            { id: 'PINNED', label: `Pinned (${parts.filter((p) => p.is_pinned).length})` },
            {
              id: 'LOW_STOCK',
              label: `Low Stock (${
                parts.filter((p) => p.stock_qty <= (p.low_stock_threshold || 3)).length
              })`,
            },
            { id: 'INACTIVE', label: `Inactive (${parts.filter((p) => !p.active).length})` },
          ].map((pill) => {
            const isActive = statusFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setStatusFilter(pill.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
                  isActive
                    ? 'bg-[#0066CC] text-white'
                    : 'bg-[#151c2c] text-gray-400 hover:text-white border border-[#1f293d]'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Content View ── */}
      {loading ? (
        <div className="text-center py-20 text-gray-400 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#0066CC] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading parts catalogue...</p>
        </div>
      ) : fetchError ? (
        <div className="p-5 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 text-sm">
          <strong>Error loading parts:</strong> {fetchError}
        </div>
      ) : parts.length === 0 ? (
        <div className="text-center py-16 space-y-3 bg-[#0e1422] rounded-2xl border border-[#1f293d] p-8">
          <div className="w-12 h-12 rounded-full bg-[#0066CC]/15 text-[#0066CC] mx-auto flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">No parts in the catalogue yet</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Start building your parts and accessories inventory with photos, retail pricing, confidential costs, and bike compatibility.
          </p>
          <div className="pt-2">
            <button
              onClick={handleOpenAdd}
              className="px-5 py-2.5 rounded-xl bg-[#0066CC] text-white text-sm font-bold hover:bg-[#0052A3] transition-colors min-h-[44px]"
            >
              Add First Part
            </button>
          </div>
        </div>
      ) : filteredParts.length === 0 ? (
        <div className="text-center py-12 space-y-2 bg-[#0e1422] rounded-xl border border-[#1f293d] p-6">
          <p className="text-gray-400 text-sm">No parts match your current search or filter.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('ALL');
              setStatusFilter('ALL');
            }}
            className="text-xs text-[#0066CC] hover:underline font-semibold"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1f293d] bg-[#0b0f19]">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#0e1422] text-gray-400 text-xs uppercase tracking-wider border-b border-[#1f293d]">
              <tr>
                <th className="px-4 py-3.5 font-semibold">Part</th>
                <th className="px-4 py-3.5 font-semibold hidden sm:table-cell">Category</th>
                <th className="px-4 py-3.5 font-semibold">Price</th>
                <th className="px-4 py-3.5 font-semibold">Stock</th>
                <th className="px-4 py-3.5 font-semibold hidden md:table-cell">Fit</th>
                <th className="px-4 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f293d]">
              {filteredParts.map((part) => (
                <tr
                  key={part.id}
                  className={`hover:bg-[#0e1422] transition-colors ${
                    !part.active ? 'opacity-60 bg-[#080c14]' : 'bg-[#0b0f19]'
                  }`}
                >
                  {/* Part Details (Image + Name + Badges) */}
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-3">
                      {/* Thumbnail */}
                      <div className="w-12 h-12 rounded-lg border border-[#1f293d] bg-[#0e1422] flex items-center justify-center shrink-0 overflow-hidden">
                        {part.image_url ? (
                          <img
                            src={part.image_url}
                            alt={part.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-gray-600" />
                        )}
                      </div>

                      {/* Name & Badges */}
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-semibold text-white text-sm truncate max-w-xs sm:max-w-md">
                            {part.name}
                          </p>
                          {part.is_pinned && <PinnedBadge />}
                          {!part.active && <InactiveBadge />}
                        </div>
                        {part.category && (
                          <p className="text-xs text-gray-400 sm:hidden">{part.category}</p>
                        )}
                        {part.description && (
                          <p className="text-[11px] text-gray-500 line-clamp-1 hidden sm:block">
                            {part.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3 text-gray-300 hidden sm:table-cell">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-[#151c2c] text-gray-300 border border-[#1f293d]">
                      {part.category || 'General'}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3">
                    <p className="text-white font-bold">{formatNPR(part.price)}</p>
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-3">
                    <StockBadge
                      stockQty={part.stock_qty}
                      lowStockThreshold={part.low_stock_threshold}
                    />
                  </td>

                  {/* Fit info */}
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        part.fits_all
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : 'text-gray-400 bg-gray-800/40'
                      }`}
                    >
                      {part.fits_all ? 'Fits All Bikes' : 'Specific Models'}
                    </span>
                  </td>

                  {/* Action buttons */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Active toggle button */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(part)}
                        title={part.active ? 'Deactivate part' : 'Activate part'}
                        className={`p-2 rounded-lg border text-xs font-semibold transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                          part.active
                            ? 'border-[#1f293d] text-gray-400 hover:text-amber-400 hover:border-amber-500/40'
                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                        aria-label={part.active ? 'Deactivate' : 'Activate'}
                      >
                        {part.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>

                      {/* Edit button */}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(part)}
                        className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-[#1f293d] text-gray-300 hover:text-[#0066CC] hover:border-[#0066CC]/40 text-xs font-semibold transition-colors min-h-[36px]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>

                      {/* Delete / Deactivate modal trigger */}
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(part)}
                        className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg border border-[#1f293d] text-gray-300 hover:text-red-400 hover:border-red-500/40 text-xs font-semibold transition-colors min-h-[36px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Table Footer Summary */}
          <div className="px-4 py-3 bg-[#0e1422] border-t border-[#1f293d] flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-gray-500 gap-2">
            <span>
              Showing {filteredParts.length} of {parts.length} total parts
            </span>
            <span className="text-[11px] text-gray-500">
              Pinned parts appear at the top • Cost prices accessible to admins only
            </span>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {formOpen && (
        <PartFormModal
          initialData={editingPart}
          existingCategories={categories}
          onSave={handleSaved}
          onClose={handleCloseForm}
        />
      )}

      {/* ── Delete / Deactivate Modal ── */}
      {deleteTarget && (
        <PartDeleteModal
          part={deleteTarget}
          onDeactivate={handleDeactivate}
          onPermanentDelete={handlePermanentDelete}
          onReactivate={handleReactivate}
          onClose={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
