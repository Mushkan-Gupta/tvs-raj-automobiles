import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, Pencil, Trash2, X, Check, AlertCircle, ChevronDown } from 'lucide-react';
import AdminNav from '../components/AdminNav';

// ─── Constants ───
const CATEGORIES = ['Sports', 'Naked', 'Commuter', 'Cruiser', 'Scooter', 'Electric'];
const AVAILABILITY = [
  { value: 'in_stock', label: 'In Stock' },
  { value: 'out_of_stock', label: 'Out of Stock' },
];

const EMPTY_FORM = {
  name: '',
  model: '',
  category: 'Commuter',
  price: '',
  offer_price: '',
  availability: 'in_stock',
  description: '',
  engine: '',
  mileage: '',
  power: '',
  torque: '',
  transmission: '',
};

// ─── Small UI helpers ───
function Field({ label, children, required }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-600';

const selectCls =
  'w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg py-2.5 px-3 text-sm focus:outline-none focus:border-[#0066CC] appearance-none cursor-pointer';

// ─── Delete Confirmation Modal ───
function DeleteModal({ bikeName, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
        <div className="flex items-start space-x-3">
          <div className="bg-red-500/10 border border-red-500/30 p-2 rounded-full shrink-0">
            <AlertCircle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Confirm Delete</h3>
            <p className="text-sm text-gray-400 mt-1">
              Are you sure you want to delete <span className="text-white font-semibold">"{bikeName}"</span>? This action cannot be undone.
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-[#1f293d] text-gray-300 hover:text-white hover:border-gray-500 text-sm font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-60"
          >
            {loading ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bike Form Modal ───
function BikeFormModal({ initialData, onSave, onClose }) {
  const isEdit = !!initialData;
  const [form, setForm] = useState(
    isEdit
      ? {
          name: initialData.name || '',
          model: initialData.model || '',
          category: initialData.category || 'Commuter',
          price: initialData.price != null ? String(initialData.price) : '',
          offer_price: initialData.offer_price != null ? String(initialData.offer_price) : '',
          availability: initialData.availability || 'in_stock',
          description: initialData.description || '',
          engine: initialData.specs?.engine || '',
          mileage: initialData.specs?.mileage || '',
          power: initialData.specs?.power || '',
          torque: initialData.specs?.torque || '',
          transmission: initialData.specs?.transmission || '',
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError('Bike name is required.'); return; }
    if (!form.price || isNaN(Number(form.price))) { setError('Price must be a valid number.'); return; }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        model: form.model.trim() || null,
        category: form.category,
        price: Number(form.price),
        offer_price: form.offer_price ? Number(form.offer_price) : null,
        availability: form.availability,
        description: form.description.trim() || null,
        specs: {
          engine: form.engine.trim() || null,
          mileage: form.mileage.trim() || null,
          power: form.power.trim() || null,
          torque: form.torque.trim() || null,
          transmission: form.transmission.trim() || null,
        },
      };

      let result;
      if (isEdit) {
        result = await supabase.from('bikes').update(payload).eq('id', initialData.id);
      } else {
        result = await supabase.from('bikes').insert([payload]);
      }

      if (result.error) throw result.error;
      onSave(isEdit ? 'updated' : 'added');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center px-4 py-6 overflow-y-auto">
      <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1f293d]">
          <h2 className="text-lg font-bold text-white">{isEdit ? 'Edit Bike' : 'Add New Bike'}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#151c2c] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {error && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Name + Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Bike Name" required>
              <input className={inputCls} value={form.name} onChange={set('name')} placeholder="e.g. TVS Apache RTR 160 4V" required />
            </Field>
            <Field label="Model">
              <input className={inputCls} value={form.model} onChange={set('model')} placeholder="e.g. RTR 160 4V" />
            </Field>
          </div>

          {/* Row 2: Category + Availability */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Category" required>
              <div className="relative">
                <select className={selectCls} value={form.category} onChange={set('category')}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </Field>
            <Field label="Availability" required>
              <div className="relative">
                <select className={selectCls} value={form.availability} onChange={set('availability')}>
                  {AVAILABILITY.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </Field>
          </div>

          {/* Row 3: Price + Offer Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Price (NPR)" required>
              <input className={inputCls} type="number" value={form.price} onChange={set('price')} placeholder="e.g. 290900" min="0" required />
            </Field>
            <Field label="Offer Price (NPR) — optional">
              <input className={inputCls} type="number" value={form.offer_price} onChange={set('offer_price')} placeholder="Leave blank if none" min="0" />
            </Field>
          </div>

          {/* Description */}
          <Field label="Description">
            <textarea className={inputCls + ' resize-y min-h-[80px]'} value={form.description} onChange={set('description')} placeholder="Short description of the bike…" />
          </Field>

          {/* Specs */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 pb-2 border-b border-[#1f293d]">Specs (optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Engine">
                <input className={inputCls} value={form.engine} onChange={set('engine')} placeholder="e.g. 159.7 cc, Oil Cooled" />
              </Field>
              <Field label="Mileage">
                <input className={inputCls} value={form.mileage} onChange={set('mileage')} placeholder="e.g. 45 kmpl" />
              </Field>
              <Field label="Power">
                <input className={inputCls} value={form.power} onChange={set('power')} placeholder="e.g. 17.55 PS @ 9250rpm" />
              </Field>
              <Field label="Torque">
                <input className={inputCls} value={form.torque} onChange={set('torque')} placeholder="e.g. 14.73 Nm @ 7250rpm" />
              </Field>
              <Field label="Transmission">
                <input className={inputCls} value={form.transmission} onChange={set('transmission')} placeholder="e.g. 5-speed" />
              </Field>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#1f293d] text-gray-300 hover:text-white hover:border-gray-500 text-sm font-semibold transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-3 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center space-x-2">
              <Check className="w-4 h-4" />
              <span>{saving ? 'Saving...' : (isEdit ? 'Save Changes' : 'Add Bike')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───
export default function AdminDashboard() {
  const navigate = useNavigate();

  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingBike, setEditingBike] = useState(null); // null = adding

  const [deleteTarget, setDeleteTarget] = useState(null); // bike object to delete
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState(null); // { message, type }

  // ─── Fetch bikes ───
  const fetchBikes = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const { data, error } = await supabase.from('bikes').select('*').order('name');
    if (error) {
      setFetchError(error.message);
    } else {
      setBikes(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBikes(); }, [fetchBikes]);

  // ─── Toast ───
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ─── Handlers ───
  const handleSaved = (action) => {
    setFormOpen(false);
    setEditingBike(null);
    fetchBikes();
    showToast(
      action === 'added' ? 'Bike added successfully!' :
      action === 'updated' ? 'Bike updated successfully!' :
      'Done!'
    );
  };

  const handleOpenAdd = () => {
    setEditingBike(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (bike) => {
    setEditingBike(bike);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingBike(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('bikes').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) {
      showToast('Delete failed: ' + error.message, 'error');
    } else {
      fetchBikes();
      showToast('Bike deleted successfully!');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-login');
  };

  // ─── Helpers ───
  const formatPrice = (price) =>
    price != null ? `NPR ${Number(price).toLocaleString()}` : '—';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-semibold transition-all ${
          toast.type === 'error'
            ? 'bg-red-900/90 border-red-500/50 text-red-200'
            : 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200'
        }`}>
          {toast.type === 'error'
            ? <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            : <Check className="w-5 h-5 text-emerald-400 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#1f293d]">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Manage bikes in the TVS Raj Automobiles inventory</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-bold transition-colors shadow-lg min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Bike</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-[#1f293d] text-gray-400 hover:text-red-400 hover:border-red-500/40 text-sm font-semibold transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <AdminNav />

      {/* ── Bikes Table ── */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading bikes...</div>
      ) : fetchError ? (
        <div className="p-5 rounded-xl border border-red-500/30 bg-red-500/5 text-red-400 text-sm">
          <strong>Error loading bikes:</strong> {fetchError}
        </div>
      ) : bikes.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-gray-400 text-sm">No bikes in the database yet.</p>
          <button onClick={handleOpenAdd} className="px-5 py-2.5 rounded-xl bg-[#0066CC] text-white text-sm font-bold hover:bg-[#0052A3]">
            Add Your First Bike
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#1f293d]">
          <table className="w-full text-sm">
            <thead className="bg-[#0e1422] text-gray-400 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Bike Name</th>
                <th className="text-left px-4 py-3 font-semibold">Category</th>
                <th className="text-left px-4 py-3 font-semibold">Price</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f293d]">
              {bikes.map((bike) => (
                <tr key={bike.id} className="bg-[#0b0f19] hover:bg-[#0e1422] transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{bike.name}</p>
                    {bike.model && <p className="text-xs text-gray-500 mt-0.5">{bike.model}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{bike.category || '—'}</td>
                  <td className="px-4 py-3">
                    <p className="text-white font-semibold">{formatPrice(bike.price)}</p>
                    {bike.offer_price && (
                      <p className="text-xs text-emerald-400 mt-0.5">Offer: {formatPrice(bike.offer_price)}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      bike.in_stock || bike.availability === 'in_stock'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {bike.in_stock || bike.availability === 'in_stock' ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(bike)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#1f293d] text-gray-300 hover:text-[#0066CC] hover:border-[#0066CC]/40 text-xs font-semibold transition-colors min-h-[34px]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(bike)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-[#1f293d] text-gray-300 hover:text-red-400 hover:border-red-500/40 text-xs font-semibold transition-colors min-h-[34px]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 bg-[#0e1422] border-t border-[#1f293d] text-xs text-gray-500">
            {bikes.length} bike{bikes.length !== 1 ? 's' : ''} in inventory
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {formOpen && (
        <BikeFormModal
          initialData={editingBike}
          onSave={handleSaved}
          onClose={handleCloseForm}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <DeleteModal
          bikeName={deleteTarget.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}
