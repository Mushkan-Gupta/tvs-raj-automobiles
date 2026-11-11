import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Bike,
  MessageSquare,
  Pin,
  RotateCcw,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
  Gauge,
  Fuel,
  Settings,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatNPR } from '../lib/formatters';
import BikePlaceholder from '../components/BikePlaceholder';
import PartImagePlaceholder from '../components/parts/PartImagePlaceholder';

/**
 * Small part row component inside the "Parts for this bike" panel.
 */
function BikePartRow({ part }) {
  const [imgFailed, setImgFailed] = useState(false);

  const isOutOfStock = part.stock_qty <= 0;
  const isLowStock = !isOutOfStock && part.stock_qty <= (part.low_stock_threshold || 3);

  return (
    <div className="bg-[#151c2c] border border-[#1f293d] rounded-xl p-3 flex items-center gap-3 transition-colors duration-150 ease-in-out hover:border-[#0066CC]/60">
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-lg bg-[#111827] border border-[#1f293d] overflow-hidden shrink-0 relative">
        {part.image_url && !imgFailed ? (
          <img
            src={part.image_url}
            alt={part.name}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <PartImagePlaceholder category={part.category} name={part.name} />
        )}
        {part.is_pinned && (
          <div
            className="absolute top-1 left-1 bg-[#0066CC] text-white p-0.5 rounded shadow-sm"
            title="Featured part"
          >
            <Pin className="w-2.5 h-2.5 fill-current rotate-45" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-white truncate">
            {part.name}
          </h4>
          {part.is_pinned && (
            <span className="text-[10px] font-medium text-blue-400 bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-900/50 shrink-0">
              Featured
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold text-white">
            {formatNPR(part.price)}
          </span>

          {/* Stock status */}
          {isOutOfStock ? (
            <span className="text-xs text-gray-500 font-medium">
              Out of stock
            </span>
          ) : isLowStock ? (
            <span className="text-xs text-amber-400 font-medium">
              Only {part.stock_qty} left
            </span>
          ) : (
            <span className="text-xs text-emerald-400 font-medium">
              In stock
            </span>
          )}
        </div>

        {/* Signature Compatibility Tag */}
        <div className="pt-1">
          {part.fits_all ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-blue-300 font-medium bg-[#111827] px-2 py-0.5 rounded border border-[#1f293d]">
              <Bike className="w-3 h-3 text-[#0066CC]" />
              <span>All bikes</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-300 font-medium bg-[#111827] px-2 py-0.5 rounded border border-[#1f293d]">
              <Bike className="w-3 h-3 text-[#0066CC]" />
              <span>Fits this bike</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Loading Skeleton Component
 */
function BikeDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 animate-pulse">
      <div className="h-6 w-32 bg-[#151c2c] rounded-lg" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left col */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <div className="h-4 w-24 bg-[#151c2c] rounded" />
            <div className="h-8 w-3/4 bg-[#151c2c] rounded" />
            <div className="flex gap-3">
              <div className="w-11 h-11 rounded-full bg-[#151c2c]" />
              <div className="w-11 h-11 rounded-full bg-[#151c2c]" />
              <div className="w-11 h-11 rounded-full bg-[#151c2c]" />
            </div>
          </div>
          <div className="aspect-[16/10] bg-[#151c2c] rounded-2xl" />
          <div className="h-8 w-48 bg-[#151c2c] rounded" />
          <div className="h-20 bg-[#151c2c] rounded-xl" />
        </div>
        {/* Right col */}
        <div className="lg:col-span-5 space-y-4">
          <div className="h-6 w-48 bg-[#151c2c] rounded" />
          <div className="space-y-3">
            <div className="h-20 bg-[#151c2c] rounded-xl" />
            <div className="h-20 bg-[#151c2c] rounded-xl" />
            <div className="h-20 bg-[#151c2c] rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BikeDetail() {
  const { id } = useParams();

  const [bike, setBike] = useState(null);
  const [colors, setColors] = useState([]);
  const [selectedColor, setSelectedColor] = useState(null);
  const [bikeParts, setBikeParts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [bikeImageFailed, setBikeImageFailed] = useState(false);

  // Fetch bike and related data
  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    setBikeImageFailed(false);

    try {
      // 1. Fetch bike
      const bikePromise = supabase
        .from('bikes')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      // 2. Fetch bike colours
      const colorsPromise = supabase
        .from('bike_colors')
        .select('id,name,hex,image_url,sort_order')
        .eq('bike_id', id)
        .order('sort_order', { ascending: true });

      // 3. Fetch parts (active only; NEVER read part_costs or cost_price)
      const partsPromise = supabase
        .from('parts')
        .select('id,name,category,price,stock_qty,low_stock_threshold,image_url,is_pinned,fits_all,sort_order')
        .eq('active', true)
        .order('is_pinned', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      // 4. Fetch bike_parts mapped for this bike
      const bikePartsPromise = supabase
        .from('bike_parts')
        .select('part_id')
        .eq('bike_id', id);

      const [bikeRes, colorsRes, partsRes, bikePartsRes] = await Promise.all([
        bikePromise,
        colorsPromise,
        partsPromise,
        bikePartsPromise,
      ]);

      if (bikeRes.error) throw bikeRes.error;
      if (!bikeRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setBike(bikeRes.data);

      const colorData = colorsRes.data || [];
      setColors(colorData);
      if (colorData.length > 0) {
        setSelectedColor(colorData[0]);
      } else {
        setSelectedColor(null);
      }

      // Filter parts: fits_all === true OR bike_parts includes this part
      const compatiblePartIds = new Set((bikePartsRes.data || []).map((bp) => bp.part_id));
      const relevantParts = (partsRes.data || []).filter(
        (part) => part.fits_all || compatiblePartIds.has(part.id)
      );
      setBikeParts(relevantParts);
    } catch (err) {
      console.error('[BikeDetail] fetch error:', err);
      setError(err.message || 'Unable to load bike specifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset image error flag when selected color changes
  useEffect(() => {
    setBikeImageFailed(false);
  }, [selectedColor]);

  // Group compatible parts by category
  const partsByCategory = useMemo(() => {
    const groups = new Map();
    for (const part of bikeParts) {
      const cat = part.category?.trim() || 'General Accessories';
      if (!groups.has(cat)) {
        groups.set(cat, []);
      }
      groups.get(cat).push(part);
    }

    // Sort items within each category: pinned first, then sort_order, then name
    for (const [, list] of groups.entries()) {
      list.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        const oA = a.sort_order ?? 0;
        const oB = b.sort_order ?? 0;
        if (oA !== oB) return oA - oB;
        return (a.name || '').localeCompare(b.name || '');
      });
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [bikeParts]);

  // Compute WhatsApp link with prefilled enquiry message
  const waUrl = useMemo(() => {
    if (!bike?.name) return 'https://wa.me/9779819789215';
    const msg = `Hello TVS Raj Automobiles, I am interested in inquiring about the ${bike.name}. Is it available at your Lahan showroom?`;
    return `https://wa.me/9779819789215?text=${encodeURIComponent(msg)}`;
  }, [bike?.name]);

  // Determine which image to show:
  // Rule: if selected colour has image_url show it; else if bike.image_url exists and no colours exist show it; else show BikePlaceholder
  const activeImageUrl = useMemo(() => {
    if (bikeImageFailed) return null;
    if (selectedColor?.image_url) {
      return selectedColor.image_url;
    }
    if (bike?.image_url && (!colors || colors.length === 0)) {
      return bike.image_url;
    }
    return null;
  }, [selectedColor, bike, colors, bikeImageFailed]);

  // ─── Loading State ───
  if (loading) {
    return <BikeDetailSkeleton />;
  }

  // ─── Error State ───
  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-md mx-auto bg-[#151c2c] border border-red-500/30 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">Error loading bike</h2>
            <p className="text-xs text-gray-400">{error}</p>
          </div>
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-semibold transition-colors duration-150 ease-in-out"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try again</span>
          </button>
        </div>
      </div>
    );
  }

  // ─── Not Found State ───
  if (notFound || !bike) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-md mx-auto bg-[#151c2c] border border-[#1f293d] rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#111827] border border-[#1f293d] text-gray-400 flex items-center justify-center mx-auto">
            <Bike className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">Bike not found</h2>
            <p className="text-xs text-gray-400">
              The requested motorcycle could not be found in our showroom catalogue.
            </p>
          </div>
          <Link
            to="/bikes"
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-semibold transition-colors duration-150 ease-in-out"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Browse all TVS bikes</span>
          </Link>
        </div>
      </div>
    );
  }

  // Extract specs (only those that exist)
  const specs = bike.specs || {};
  const hasSpecs = specs.engine || specs.power || specs.mileage || specs.transmission || specs.torque;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 py-6 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Breadcrumb / Back link */}
        <nav aria-label="Breadcrumb">
          <Link
            to="/bikes"
            className="inline-flex items-center gap-2 text-sm text-[#4da3ff] hover:text-white transition-colors duration-150 ease-in-out min-h-[44px] py-1"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to all TVS bikes</span>
          </Link>
        </nav>

        {/* Configurator Grid: Left 60% (desktop) / Right 40% (desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ─── LEFT COLUMN (approx 60%) ─── */}
          <div className="lg:col-span-7 space-y-6">

            {/* Mobile/Desktop Header: Tag, Name & Swatches */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {bike.category && (
                    <span className="text-xs text-[#4da3ff] font-medium bg-[#151c2c] border border-[#1f293d] px-2.5 py-1 rounded-md">
                      {bike.category}
                    </span>
                  )}
                  {bike.tag && (
                    <span className="text-xs font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1 rounded-md">
                      {bike.tag}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                  {bike.name}
                </h1>
              </div>

              {/* Colour Swatches */}
              {colors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="font-medium">
                      Select Colour:{' '}
                      <span className="text-white font-semibold">
                        {selectedColor?.name || 'Default'}
                      </span>
                    </span>
                    <span className="text-gray-500">
                      {colors.length} {colors.length === 1 ? 'option' : 'options'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    {colors.map((c) => {
                      const isSelected = selectedColor?.id === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedColor(c)}
                          aria-label={c.name}
                          aria-pressed={isSelected}
                          title={c.name}
                          className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center p-1 transition-colors duration-150 ease-in-out ${
                            isSelected
                              ? 'ring-2 ring-[#0066CC] ring-offset-2 ring-offset-[#0b0f19]'
                              : 'hover:ring-1 hover:ring-gray-500'
                          }`}
                        >
                          <span
                            className="w-7 h-7 rounded-full border border-white/20 shadow-inner"
                            style={{ backgroundColor: c.hex }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Large Bike Image / Recolourable Visualizer */}
            <div className="relative aspect-[16/10] sm:aspect-[16/9] bg-[#111827] rounded-2xl border border-[#1f293d] overflow-hidden flex items-center justify-center">
              {activeImageUrl ? (
                <img
                  src={activeImageUrl}
                  alt={`${bike.name} - ${selectedColor?.name || 'Default'}`}
                  onError={() => setBikeImageFailed(true)}
                  className="w-full h-full object-cover transition-opacity duration-150 ease-in-out"
                />
              ) : (
                <BikePlaceholder
                  color={selectedColor?.hex}
                  name={bike.name}
                />
              )}
            </div>

            {/* Price & Primary Action Buttons */}
            <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-4 border-b border-[#1f293d]">
                <div>
                  <span className="text-xs text-gray-400 block font-medium">
                    Showroom Price (Lahan)
                  </span>
                  {bike.price != null && bike.price !== '' ? (
                    <span className="text-2xl sm:text-3xl font-extrabold text-white">
                      {formatNPR(bike.price)}
                    </span>
                  ) : (
                    <span className="text-2xl sm:text-3xl font-extrabold text-white">
                      Price on request
                    </span>
                  )}
                </div>

                {!bike.price_confirmed && (
                  <span className="inline-block text-xs text-amber-400 bg-amber-950/80 border border-amber-800/80 px-2.5 py-1 rounded-md font-medium">
                    Price not confirmed
                  </span>
                )}
              </div>

              {/* Description */}
              {bike.description && (
                <p className="text-sm text-gray-300 leading-relaxed">
                  {bike.description}
                </p>
              )}

              {/* Action Buttons: Enquire + WhatsApp */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  to="/contact"
                  state={{ model: bike.name }}
                  className="flex-1 min-h-[44px] px-6 py-3 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-semibold flex items-center justify-center text-center transition-colors duration-150 ease-in-out shadow-sm"
                >
                  Enquire at Lahan Showroom
                </Link>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-5 py-3 rounded-lg bg-[#111827] hover:bg-[#1f293d] border border-[#1f293d] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-150 ease-in-out"
                >
                  <MessageSquare className="w-4 h-4 text-emerald-400" />
                  <span>Chat on WhatsApp</span>
                </a>
              </div>
            </div>

            {/* Key Specifications (Only those that exist) */}
            {hasSpecs && (
              <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#0066CC]" />
                  <span>Key Specifications</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {specs.engine && (
                    <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-3.5 flex items-center gap-3">
                      <Zap className="w-4 h-4 text-[#0066CC] shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-xs text-gray-400">Engine</span>
                        <span className="block text-sm font-semibold text-white truncate">
                          {specs.engine}
                        </span>
                      </div>
                    </div>
                  )}

                  {specs.power && (
                    <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-3.5 flex items-center gap-3">
                      <Gauge className="w-4 h-4 text-[#0066CC] shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-xs text-gray-400">Max Power</span>
                        <span className="block text-sm font-semibold text-white truncate">
                          {specs.power}
                        </span>
                      </div>
                    </div>
                  )}

                  {specs.mileage && (
                    <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-3.5 flex items-center gap-3">
                      <Fuel className="w-4 h-4 text-[#0066CC] shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-xs text-gray-400">Mileage</span>
                        <span className="block text-sm font-semibold text-white truncate">
                          {specs.mileage}
                        </span>
                      </div>
                    </div>
                  )}

                  {specs.transmission && (
                    <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-3.5 flex items-center gap-3">
                      <Settings className="w-4 h-4 text-[#0066CC] shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-xs text-gray-400">Transmission</span>
                        <span className="block text-sm font-semibold text-white truncate">
                          {specs.transmission}
                        </span>
                      </div>
                    </div>
                  )}

                  {specs.torque && (
                    <div className="bg-[#111827] border border-[#1f293d] rounded-xl p-3.5 flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-[#0066CC] shrink-0" />
                      <div className="min-w-0">
                        <span className="block text-xs text-gray-400">Torque</span>
                        <span className="block text-sm font-semibold text-white truncate">
                          {specs.torque}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT COLUMN (approx 40%): Parts For This Bike Panel ─── */}
          <div className="lg:col-span-5">
            <aside
              aria-label="Parts for this bike"
              className="bg-[#111827] border border-[#1f293d] rounded-2xl p-5 space-y-5 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#1f293d]">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Parts for this bike
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Official gear &amp; compatible TVS spares
                  </p>
                </div>
                <Link
                  to="/parts"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4da3ff] hover:text-white transition-colors duration-150 ease-in-out min-h-[44px] px-2 py-1"
                >
                  <span>See all parts</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Parts Grouped by Category */}
              {partsByCategory.length === 0 ? (
                <div className="bg-[#151c2c] border border-[#1f293d] rounded-xl p-6 text-center space-y-3">
                  <Bike className="w-8 h-8 text-gray-500 mx-auto" />
                  <p className="text-xs text-gray-400">
                    No accessories or specific parts currently linked to this model.
                  </p>
                  <Link
                    to="/parts"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4da3ff] hover:underline min-h-[44px] py-1"
                  >
                    <span>Browse complete parts catalogue</span>
                    <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {partsByCategory.map(([categoryName, items]) => (
                    <div key={categoryName} className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-gray-300">
                          {categoryName}
                        </h3>
                        <span className="text-[11px] text-gray-500">
                          {items.length} {items.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {items.map((part) => (
                          <BikePartRow key={part.id} part={part} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>

        </div>
      </div>
    </div>
  );
}
