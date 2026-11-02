import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
  X,
  Check,
  AlertCircle,
  Upload,
  Trash2,
  Image as ImageIcon,
  Pin,
  Sparkles,
  Layers,
  Search,
  CheckSquare,
  Square,
  Loader,
} from 'lucide-react';

const DEFAULT_CATEGORIES = [
  'Helmets & Riding Gear',
  'Engine Oil & Lubricants',
  'Tyres & Tubes',
  'Brakes & Suspension',
  'Electrical & Batteries',
  'Body Parts & Styling',
  'Exhaust & Engine',
  'Accessories',
];

const inputCls =
  'w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-xl py-2.5 px-3.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-600 min-h-[44px]';

function Field({ label, children, required, subtitle }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {subtitle && <span className="text-[11px] text-gray-500">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

export default function PartFormModal({
  initialData,
  existingCategories = [],
  onSave,
  onClose,
}) {
  const isEdit = !!initialData;

  // Form fields
  const [name, setName] = useState(initialData?.name || '');
  const [category, setCategory] = useState(initialData?.category || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [price, setPrice] = useState(initialData?.price != null ? String(initialData.price) : '');
  const [costPrice, setCostPrice] = useState('');
  const [stockQty, setStockQty] = useState(initialData?.stock_qty != null ? String(initialData.stock_qty) : '0');
  const [lowStockThreshold, setLowStockThreshold] = useState(
    initialData?.low_stock_threshold != null ? String(initialData.low_stock_threshold) : '3'
  );
  const [imageUrl, setImageUrl] = useState(initialData?.image_url || '');
  const [isPinned, setIsPinned] = useState(initialData?.is_pinned || false);
  const [fitsAll, setFitsAll] = useState(initialData?.fits_all ?? true);
  const [active, setActive] = useState(initialData?.active ?? true);
  const [sortOrder, setSortOrder] = useState(initialData?.sort_order != null ? String(initialData.sort_order) : '0');

  // Photo upload states
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(initialData?.image_url || '');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Compatible bikes selection
  const [bikes, setBikes] = useState([]);
  const [bikesLoading, setBikesLoading] = useState(false);
  const [selectedBikeIds, setSelectedBikeIds] = useState(new Set());
  const [bikeSearch, setBikeSearch] = useState('');

  // Form submission state
  const [saving, setSaving] = useState(false);
  const [costLoading, setCostLoading] = useState(false);
  const [error, setError] = useState(null);

  // Combine category suggestions
  const allCategorySuggestions = Array.from(
    new Set([...existingCategories, ...DEFAULT_CATEGORIES].filter(Boolean))
  );

  // ─── 1. Load cost price for edit mode (Admin only table: part_costs) ──────
  useEffect(() => {
    let isMounted = true;
    async function loadCostPrice() {
      if (!isEdit || !initialData?.id) return;
      setCostLoading(true);
      try {
        const { data, error: costErr } = await supabase
          .from('part_costs')
          .select('cost_price')
          .eq('part_id', initialData.id)
          .maybeSingle();

        if (costErr) {
          console.warn('[PartForm] Could not fetch part_costs:', costErr.message);
        } else if (data && isMounted) {
          setCostPrice(data.cost_price != null ? String(data.cost_price) : '');
        }
      } catch (err) {
        console.error('[PartForm] Error loading cost price:', err);
      } finally {
        if (isMounted) setCostLoading(false);
      }
    }
    loadCostPrice();
    return () => { isMounted = false; };
  }, [isEdit, initialData]);

  // ─── 2. Load bikes & existing bike_parts mappings ─────────────────────────
  useEffect(() => {
    let isMounted = true;
    async function loadBikes() {
      setBikesLoading(true);
      try {
        const { data: bikesData, error: bikesErr } = await supabase
          .from('bikes')
          .select('id, name, model')
          .order('name');

        if (bikesErr) throw bikesErr;
        if (isMounted) setBikes(bikesData || []);

        // If editing and fits_all is false, fetch existing bike_parts
        if (isEdit && initialData?.id && !initialData?.fits_all) {
          const { data: bpData, error: bpErr } = await supabase
            .from('bike_parts')
            .select('bike_id')
            .eq('part_id', initialData.id);

          if (!bpErr && bpData && isMounted) {
            setSelectedBikeIds(new Set(bpData.map((row) => String(row.bike_id))));
          }
        }
      } catch (err) {
        console.warn('[PartForm] Could not load bikes for compatibility:', err.message);
      } finally {
        if (isMounted) setBikesLoading(false);
      }
    }
    loadBikes();
    return () => { isMounted = false; };
  }, [isEdit, initialData]);

  // ─── 3. Image file selection & preview ───────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Photo exceeds the maximum allowed size of 2 MB.');
      return;
    }

    // Validate format
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Only JPG, PNG, and WebP photos are supported.');
      return;
    }

    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setImageUrl('');
  };

  // ─── 4. Bike selection handlers ──────────────────────────────────────────
  const toggleBike = (bikeId) => {
    setSelectedBikeIds((prev) => {
      const next = new Set(prev);
      const strId = String(bikeId);
      if (next.has(strId)) next.delete(strId);
      else next.add(strId);
      return next;
    });
  };

  const selectAllFilteredBikes = (filtered) => {
    setSelectedBikeIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((b) => next.add(String(b.id)));
      return next;
    });
  };

  const deselectAllFilteredBikes = (filtered) => {
    setSelectedBikeIds((prev) => {
      const next = new Set(prev);
      filtered.forEach((b) => next.delete(String(b.id)));
      return next;
    });
  };

  // ─── 5. Submit Handler ───────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Part name is required.');
      return;
    }
    if (price === '' || isNaN(Number(price)) || Number(price) < 0) {
      setError('Please provide a valid price (must be 0 or higher).');
      return;
    }
    if (costPrice !== '' && (isNaN(Number(costPrice)) || Number(costPrice) < 0)) {
      setError('Cost price must be a valid positive number.');
      return;
    }
    if (isNaN(Number(stockQty)) || Number(stockQty) < 0) {
      setError('Stock quantity must be a non-negative integer.');
      return;
    }
    if (!fitsAll && selectedBikeIds.size === 0) {
      setError('Please select at least one compatible bike or enable "Fits all bikes".');
      return;
    }

    setSaving(true);

    try {
      let finalImageUrl = imageUrl;

      // Upload new photo if selected
      if (imageFile) {
        setUploadingImage(true);
        const fileExt = imageFile.name.split('.').pop();
        const safeName = imageFile.name.replace(/[^a-zA-Z0-9]/g, '_');
        const filePath = `parts/${Date.now()}_${safeName}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Photo upload failed: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
          .from('product-images')
          .getPublicUrl(filePath);

        finalImageUrl = publicUrlData.publicUrl;
        setUploadingImage(false);
      }

      // ── A. Save to `parts` ───────────────────────────────────────────────
      const partPayload = {
        name: name.trim(),
        category: category.trim() || null,
        description: description.trim() || null,
        price: Number(price),
        stock_qty: Math.floor(Number(stockQty)),
        low_stock_threshold: Math.max(1, Math.floor(Number(lowStockThreshold || 3))),
        image_url: finalImageUrl || null,
        is_pinned: Boolean(isPinned),
        fits_all: Boolean(fitsAll),
        active: Boolean(active),
        sort_order: Math.floor(Number(sortOrder || 0)),
      };

      let partId = initialData?.id;

      if (isEdit) {
        const { error: updateErr } = await supabase
          .from('parts')
          .update(partPayload)
          .eq('id', partId);
        if (updateErr) throw updateErr;
      } else {
        const { data: insertData, error: insertErr } = await supabase
          .from('parts')
          .insert([partPayload])
          .select('id')
          .single();

        if (insertErr) throw insertErr;
        partId = insertData.id;
      }

      // ── B. Save to `part_costs` (Admin-only table) ────────────────────────
      const costValue = costPrice !== '' ? Number(costPrice) : 0;
      const { error: costUpsertErr } = await supabase
        .from('part_costs')
        .upsert({
          part_id: partId,
          cost_price: costValue,
        });

      if (costUpsertErr) {
        console.warn('[PartForm] Error saving cost price:', costUpsertErr.message);
      }

      // ── C. Save `bike_parts` compatible links ────────────────────────────
      // Always delete existing mappings for this part first
      const { error: deleteBpErr } = await supabase
        .from('bike_parts')
        .delete()
        .eq('part_id', partId);

      if (deleteBpErr) {
        console.warn('[PartForm] Error clearing old bike_parts:', deleteBpErr.message);
      }

      // If not fits_all, insert selected mappings
      if (!fitsAll && selectedBikeIds.size > 0) {
        const bikePartRows = Array.from(selectedBikeIds).map((bikeId) => ({
          bike_id: bikeId,
          part_id: partId,
        }));
        const { error: insertBpErr } = await supabase
          .from('bike_parts')
          .insert(bikePartRows);

        if (insertBpErr) {
          console.warn('[PartForm] Error inserting bike_parts:', insertBpErr.message);
        }
      }

      onSave(isEdit ? 'updated' : 'added');
    } catch (err) {
      console.error('[PartForm] Save error:', err);
      setError(err.message || 'Failed to save part. Please check permissions and input.');
    } finally {
      setSaving(false);
      setUploadingImage(false);
    }
  };

  // Filter bikes for the compatibility picker
  const filteredBikes = bikes.filter((b) => {
    if (!bikeSearch.trim()) return true;
    const q = bikeSearch.toLowerCase();
    return (
      b.name?.toLowerCase().includes(q) ||
      b.model?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl w-full max-w-3xl shadow-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1f293d]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#0066CC]/15 border border-[#0066CC]/30 text-[#0066CC]">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEdit ? 'Edit Part' : 'Add New Part'}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Configure parts catalogue, pricing, cost, and bike compatibility
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#151c2c] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section: Basic Info */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-[#1f293d]/80">
              Basic Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Part Name" required>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. TVS Logo Full Face Helmet"
                  required
                />
              </Field>

              <Field label="Category" subtitle="Type or choose">
                <div className="relative">
                  <input
                    list="category-suggestions"
                    className={inputCls}
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Helmets & Riding Gear"
                  />
                  <datalist id="category-suggestions">
                    {allCategorySuggestions.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
              </Field>
            </div>

            <Field label="Description">
              <textarea
                className={inputCls + ' resize-y min-h-[75px]'}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Specifications, features, warranty, or fit notes..."
              />
            </Field>
          </div>

          {/* Section: Pricing & Stock */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-[#1f293d]/80 flex items-center justify-between">
              <span>Pricing & Inventory</span>
              <span className="text-[11px] font-normal text-amber-400">
                Cost Price is strictly confidential (Admin Only)
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Selling Price (NPR)" required subtitle="Shown to customers">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">
                    Rs
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls + ' pl-10 font-semibold'}
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 3500"
                    required
                  />
                </div>
              </Field>

              <Field
                label="Cost Price (NPR)"
                subtitle="Admin only (part_costs)"
              >
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-500">
                    Rs
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputCls + ' pl-10 border-amber-500/30 focus:border-amber-500 focus:ring-amber-500 font-semibold text-amber-300'}
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder={costLoading ? 'Loading cost...' : 'e.g. 2400'}
                  />
                </div>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Stock Quantity" required>
                <input
                  type="number"
                  min="0"
                  className={inputCls}
                  value={stockQty}
                  onChange={(e) => setStockQty(e.target.value)}
                  placeholder="0"
                  required
                />
              </Field>

              <Field label="Low-Stock Alert Level" subtitle="Default: 3">
                <input
                  type="number"
                  min="1"
                  className={inputCls}
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  placeholder="3"
                />
              </Field>

              <Field label="Display Sort Order" subtitle="Lower shown first">
                <input
                  type="number"
                  className={inputCls}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>
          </div>

          {/* Section: Photo Upload */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-[#1f293d]/80">
              Product Image
            </h3>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              {/* Preview Box */}
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl border border-[#1f293d] bg-[#0b0f19] flex items-center justify-center shrink-0 overflow-hidden relative">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Part Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-gray-600 space-y-1">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-[10px]">No Photo</span>
                  </div>
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-2.5">
                <p className="text-xs text-gray-400">
                  Upload a clean JPG, PNG, or WebP photo (Max 2 MB). Images are stored in the secure{' '}
                  <code className="text-[#0066CC]">product-images</code> bucket.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <label className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#151c2c] hover:bg-[#1a2336] text-white text-xs font-semibold border border-[#1f293d] cursor-pointer transition-colors min-h-[44px]">
                    <Upload className="w-4 h-4 text-[#0066CC]" />
                    <span>{imagePreview ? 'Replace Photo' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>

                  {imagePreview && (
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="inline-flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-semibold transition-colors min-h-[44px]"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Remove Photo</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section: Options & Visibility */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider pb-2 border-b border-[#1f293d]/80">
              Settings & Compatibility
            </h3>

            {/* Toggle cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Pin to top */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors select-none ${
                  isPinned
                    ? 'bg-[#0066CC]/15 border-[#0066CC]/50 text-white'
                    : 'bg-[#0b0f19] border-[#1f293d] text-gray-400 hover:text-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="mt-0.5 rounded text-[#0066CC] focus:ring-[#0066CC]"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                    <Pin className="w-3.5 h-3.5 text-[#0066CC]" />
                    Pinned Part
                  </span>
                  <p className="text-[11px] text-gray-400">
                    Always displays at the top of parts lists
                  </p>
                </div>
              </label>

              {/* Fits all bikes */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors select-none ${
                  fitsAll
                    ? 'bg-[#0066CC]/15 border-[#0066CC]/50 text-white'
                    : 'bg-[#0b0f19] border-[#1f293d] text-gray-400 hover:text-gray-200'
                }`}
              >
                <input
                  type="checkbox"
                  checked={fitsAll}
                  onChange={(e) => setFitsAll(e.target.checked)}
                  className="mt-0.5 rounded text-[#0066CC] focus:ring-[#0066CC]"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    Fits All Bikes
                  </span>
                  <p className="text-[11px] text-gray-400">
                    Universal accessory (helmets, jacket, oil, etc.)
                  </p>
                </div>
              </label>

              {/* Active status */}
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors select-none ${
                  active
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                    : 'bg-gray-800/40 border-gray-700 text-gray-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-white">
                    Active Status
                  </span>
                  <p className="text-[11px] text-gray-400">
                    {active ? 'Visible in public catalogue' : 'Deactivated / hidden'}
                  </p>
                </div>
              </label>
            </div>

            {/* Compatible Bikes Picker (Shown only if fitsAll is OFF) */}
            {!fitsAll && (
              <div className="p-4 rounded-xl border border-[#1f293d] bg-[#0b0f19] space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-white uppercase tracking-wider">
                      Compatible Bikes ({selectedBikeIds.size} selected)
                    </label>
                    <p className="text-[11px] text-gray-400">
                      Select all models that this part specifically fits
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => selectAllFilteredBikes(filteredBikes)}
                      className="text-[11px] text-[#0066CC] hover:underline font-semibold"
                    >
                      Select All
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={() => deselectAllFilteredBikes(filteredBikes)}
                      className="text-[11px] text-gray-400 hover:underline font-semibold"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Bike Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={bikeSearch}
                    onChange={(e) => setBikeSearch(e.target.value)}
                    placeholder="Search bikes by name or model..."
                    className="w-full bg-[#0e1422] border border-[#1f293d] text-white rounded-lg py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-[#0066CC]"
                  />
                </div>

                {/* Bike list */}
                {bikesLoading ? (
                  <div className="py-6 text-center text-xs text-gray-500 flex items-center justify-center space-x-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Loading bikes list...</span>
                  </div>
                ) : filteredBikes.length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-500">
                    No matching bikes found.
                  </p>
                ) : (
                  <div className="max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                    {filteredBikes.map((bike) => {
                      const isSelected = selectedBikeIds.has(String(bike.id));
                      return (
                        <button
                          key={bike.id}
                          type="button"
                          onClick={() => toggleBike(bike.id)}
                          className={`flex items-center space-x-2.5 p-2 rounded-lg border text-left transition-colors text-xs ${
                            isSelected
                              ? 'bg-[#0066CC]/20 border-[#0066CC]/50 text-white font-medium'
                              : 'bg-[#0e1422] border-[#1f293d] text-gray-300 hover:border-gray-600'
                          }`}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#0066CC] shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-600 shrink-0" />
                          )}
                          <span className="truncate">
                            {bike.name} {bike.model ? `(${bike.model})` : ''}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-3 border-t border-[#1f293d]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border border-[#1f293d] text-gray-300 hover:text-white hover:border-gray-500 text-sm font-semibold transition-colors min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center space-x-2 min-h-[44px] shadow-lg"
            >
              <Check className="w-4 h-4" />
              <span>
                {saving
                  ? uploadingImage
                    ? 'Uploading Photo...'
                    : 'Saving Part...'
                  : isEdit
                  ? 'Save Changes'
                  : 'Add Part'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
