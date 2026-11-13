import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Plus,
  Minus,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatNPR } from '../lib/formatters';
import { useCart } from '../lib/CartContext';
import BikePlaceholder from '../components/BikePlaceholder';
import PartImagePlaceholder from '../components/parts/PartImagePlaceholder';

/**
 * Single part row component for the parts panel.
 */
function BikePartRow({ part }) {
  const [imgFailed, setImgFailed] = useState(false);
  const { getItemQty, addItem, setQty } = useCart();

  const qtyInCart = getItemQty(part.id);
  const isOutOfStock = part.stock_qty <= 0;
  const isLowStock = !isOutOfStock && part.stock_qty <= (part.low_stock_threshold || 3);

  return (
    <div className="bg-[#151c2c] border border-[#1f293d] rounded-xl p-3 flex items-center gap-3 transition-colors duration-150 ease-in-out hover:border-[#0066CC]/60">
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-lg bg-[#111827] border border-[#1f293d] overflow-hidden shrink-0 relative flex items-center justify-center">
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
        <div className="flex items-center gap-1.5">
          <h4 className="text-xs sm:text-sm font-semibold text-white truncate">
            {part.name}
          </h4>
          {part.is_pinned && (
            <span className="text-[10px] font-medium text-blue-400 bg-blue-950/60 px-1 py-0.2 rounded border border-blue-900/50 shrink-0">
              Featured
            </span>
          )}
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs sm:text-sm font-bold text-white">
            {formatNPR(part.price)}
          </span>

          {/* Stock status */}
          {isOutOfStock ? (
            <span className="text-[11px] text-gray-500 font-medium shrink-0">
              Out of stock
            </span>
          ) : isLowStock ? (
            <span className="text-[11px] text-amber-400 font-medium shrink-0">
              Only {part.stock_qty} left
            </span>
          ) : (
            <span className="text-[11px] text-emerald-400 font-medium shrink-0">
              In stock
            </span>
          )}
        </div>

        {/* Signature Compatibility Tag */}
        <div className="pt-0.5">
          {part.fits_all ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-blue-300 font-medium bg-[#111827] px-2 py-0.5 rounded border border-[#1f293d]">
              <Bike className="w-3 h-3 text-[#0066CC]" />
              <span>All bikes</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-gray-300 font-medium bg-[#111827] px-2 py-0.5 rounded border border-[#1f293d]">
              <Bike className="w-3 h-3 text-[#0066CC]" />
              <span>Fits this bike</span>
            </span>
          )}
        </div>
      </div>

      {/* Action: Compact Add Button / Stepper (44px tap target) */}
      <div className="shrink-0">
        {isOutOfStock ? (
          <button
            type="button"
            disabled
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-lg bg-[#111827] border border-[#1f293d] text-gray-600 cursor-not-allowed flex items-center justify-center select-none"
            aria-label="Out of stock"
            title="Out of stock"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : qtyInCart === 0 ? (
          <button
            type="button"
            onClick={() => addItem(part.id, 1)}
            className="min-w-[44px] min-h-[44px] px-3 py-2 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
            aria-label={`Add ${part.name} to cart`}
            title="Add to cart"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        ) : (
          <div className="flex items-center min-h-[44px] bg-[#111827] border border-[#0066CC]/60 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setQty(part.id, qtyInCart - 1)}
              className="w-8 h-8 min-w-[32px] flex items-center justify-center rounded text-gray-300 hover:text-white hover:bg-[#151c2c] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
              aria-label={qtyInCart === 1 ? `Remove ${part.name} from cart` : `Decrease quantity`}
              title={qtyInCart === 1 ? 'Remove from cart' : 'Decrease'}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-white px-1.5 min-w-[18px] text-center select-none" aria-label={`Quantity: ${qtyInCart}`}>
              {qtyInCart}
            </span>
            <button
              type="button"
              disabled={qtyInCart >= part.stock_qty}
              onClick={() => setQty(part.id, qtyInCart + 1)}
              className="w-8 h-8 min-w-[32px] flex items-center justify-center rounded text-gray-300 hover:text-white hover:bg-[#151c2c] disabled:text-gray-600 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
              aria-label={`Increase quantity`}
              title={qtyInCart >= part.stock_qty ? 'Maximum available stock reached' : 'Increase'}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Shared grouped list of parts used by both desktop side panel and mobile expander.
 */
function GroupedPartsList({ partsByCategory, totalCount }) {
  if (totalCount === 0) {
    return (
      <div className="bg-[#151c2c] border border-[#1f293d] rounded-xl p-5 text-center space-y-3">
        <Bike className="w-7 h-7 text-gray-500 mx-auto" />
        <p className="text-xs text-gray-400">
          No accessories or specific parts currently linked to this model.
        </p>
        <Link
          to="/parts"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#4da3ff] hover:underline min-h-[44px] py-1"
        >
          <span>Browse complete parts catalogue</span>
          <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {partsByCategory.map(([categoryName, items]) => (
        <div key={categoryName} className="space-y-2">
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

      {/* Footer link to full catalogue */}
      <div className="pt-2 border-t border-[#1f293d]">
        <Link
          to="/parts"
          className="w-full flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-lg bg-[#151c2c] hover:bg-[#1f293d] border border-[#1f293d] text-xs font-semibold text-[#4da3ff] hover:text-white transition-colors duration-150 ease-in-out"
        >
          <span>See all parts & accessories</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}

/**
 * Skeleton Loading View
 */
function BikeDetailSkeleton() {
  return (
    <div className="min-h-screen bg-[#0b0f19] pt-4 sm:pt-5 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="h-6 w-36 bg-[#151c2c] rounded-lg" />
      <div className="h-8 w-64 bg-[#151c2c] rounded" />
      <div className="w-full aspect-[16/9] bg-[#151c2c] rounded-2xl" />
      <div className="h-14 bg-[#151c2c] rounded-xl" />
      <div className="h-32 bg-[#151c2c] rounded-2xl" />
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

  // Panel collapsed state: desktop open by default, mobile collapsed by default
  const [isDesktopPanelOpen, setIsDesktopPanelOpen] = useState(true);
  const [isMobilePartsOpen, setIsMobilePartsOpen] = useState(false);

  // ── Resizable panel width (desktop only) ──────────────────────────────────
  const PANEL_MIN = 320;
  const PANEL_MAX = 560;
  const PANEL_DEFAULT = 380;

  const readStoredWidth = () => {
    try {
      const v = localStorage.getItem('partsPanelWidth');
      if (v !== null) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= PANEL_MIN && n <= PANEL_MAX) return n;
      }
    } catch { /* storage blocked */ }
    return PANEL_DEFAULT;
  };

  const [panelWidth, setPanelWidth] = useState(readStoredWidth);

  const saveWidth = useCallback((w) => {
    try { localStorage.setItem('partsPanelWidth', String(w)); } catch { /* ignore */ }
  }, []);

  const dragState = useRef(null); // { startX, startW }

  const onPointerDown = useCallback((e) => {
    if (e.button !== 0) return; // primary button / pen only
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startW: panelWidth };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, [panelWidth]);

  const onPointerMove = useCallback((e) => {
    if (!dragState.current) return;
    // Handle is on the LEFT edge: dragging left → expand, right → shrink
    const dx = dragState.current.startX - e.clientX;
    const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, dragState.current.startW + dx));
    setPanelWidth(next);
  }, []);

  const onPointerUp = useCallback((e) => {
    if (!dragState.current) return;
    const dx = dragState.current.startX - e.clientX;
    const next = Math.min(PANEL_MAX, Math.max(PANEL_MIN, dragState.current.startW + dx));
    dragState.current = null;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    saveWidth(next);
  }, [saveWidth]);

  const onHandleDoubleClick = useCallback(() => {
    setPanelWidth(PANEL_DEFAULT);
    saveWidth(PANEL_DEFAULT);
  }, [saveWidth]);

  const onHandleKeyDown = useCallback((e) => {
    let next = panelWidth;
    if (e.key === 'ArrowLeft') next = Math.min(PANEL_MAX, panelWidth + 16);
    else if (e.key === 'ArrowRight') next = Math.max(PANEL_MIN, panelWidth - 16);
    else if (e.key === 'Home') next = PANEL_MIN;
    else if (e.key === 'End') next = PANEL_MAX;
    else return;
    e.preventDefault();
    setPanelWidth(next);
    saveWidth(next);
  }, [panelWidth, saveWidth]);

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

  // Determine active image:
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
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-semibold transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
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
            className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-semibold transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
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
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col lg:flex-row">

      {/* ─── LEFT: MAIN BIKE CONTENT ─── */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 pb-10 space-y-4">

        {/* 1. Header Row: Compact 'All bikes' back link, Category, Tag, and Bike Name */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400">
            <Link
              to="/bikes"
              className="inline-flex items-center gap-1.5 font-semibold text-gray-400 hover:text-white transition-colors duration-150 ease-in-out min-h-[44px] px-2 py-1 -ml-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
            >
              <ArrowLeft className="w-4 h-4 text-[#0066CC]" />
              <span>All bikes</span>
            </Link>

            <span className="text-gray-600 hidden sm:inline" aria-hidden="true">•</span>

            {bike.category && (
              <span className="font-medium text-[#4da3ff] bg-[#151c2c] border border-[#1f293d] px-2.5 py-1 rounded-md">
                {bike.category}
              </span>
            )}

            {bike.tag && (
              <span className="font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-800/80 px-2.5 py-1 rounded-md">
                {bike.tag}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight break-words">
            {bike.name}
          </h1>
        </div>

        {/* 2. Bike Image Area: Fixed Aspect Ratio aspect-[16/9] with object-contain */}
        <div className="relative w-full aspect-[16/9] bg-[#111827] rounded-2xl border border-[#1f293d] overflow-hidden flex items-center justify-center select-none">
          {activeImageUrl ? (
            <img
              src={activeImageUrl}
              alt={`${bike.name} - ${selectedColor?.name || 'Default'}`}
              onError={() => setBikeImageFailed(true)}
              className="w-full h-full object-contain transition-opacity duration-150 ease-in-out"
            />
          ) : (
            <BikePlaceholder
              color={selectedColor?.hex}
              name={bike.name}
            />
          )}
        </div>

        {/* 3. Colour Swatches: Placed BELOW the bike image */}
        {colors.length > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap bg-[#151c2c] border border-[#1f293d] rounded-xl px-4 py-2">
            <span className="text-xs font-medium text-gray-400">
              Colour: <span className="text-white font-semibold">{selectedColor?.name || 'Default'}</span>
            </span>

            <div className="flex items-center gap-2">
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
                    className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center p-1 transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f19] ${
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

        {/* 4. Price & Enquire Buttons Block */}
        <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-5 space-y-4">
          <div>
            <span className="text-xs text-gray-400 block font-medium">Showroom Price (Lahan)</span>
            <div className="mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-white">
                {bike.price != null && bike.price !== '' ? formatNPR(bike.price) : 'Price on request'}
              </span>
            </div>
            {!bike.price_confirmed && (
              <p className="text-xs text-amber-400 font-medium mt-1">
                Price not confirmed
              </p>
            )}
          </div>

          {bike.description && (
            <p className="text-sm text-gray-300 leading-relaxed border-t border-[#1f293d] pt-3">
              {bike.description}
            </p>
          )}

          {/* Action buttons: side by side on desktop, stacked on mobile */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <Link
              to="/contact"
              state={{ model: bike.name }}
              className="flex-1 min-h-[44px] px-6 py-3 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-semibold flex items-center justify-center text-center transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f19]"
            >
              Enquire at Lahan Showroom
            </Link>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-5 py-3 rounded-lg bg-[#111827] hover:bg-[#1f293d] border border-[#1f293d] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0f19]"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>

        {/* 5. Key Specifications (only ones that exist) */}
        {hasSpecs && (
          <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-5 space-y-4">
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

        {/* 6. Mobile Inline Parts Section (< lg screens) */}
        <div className="lg:hidden pt-2">
          <button
            type="button"
            onClick={() => setIsMobilePartsOpen((v) => !v)}
            aria-expanded={isMobilePartsOpen}
            aria-controls="parts-mobile-content"
            className="w-full flex items-center justify-between p-4 rounded-xl bg-[#151c2c] border border-[#1f293d] text-left min-h-[44px] font-semibold text-white transition-colors duration-150 ease-in-out hover:border-[#0066CC]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
          >
            <div className="flex items-center gap-2">
              <Bike className="w-4 h-4 text-[#0066CC]" />
              <span>Parts for this bike</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#0066CC]/20 text-[#4da3ff] border border-[#0066CC]/30">
                {bikeParts.length}
              </span>
            </div>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform duration-150 ease-in-out ${
                isMobilePartsOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isMobilePartsOpen && (
            <div
              id="parts-mobile-content"
              className="mt-3 space-y-4 bg-[#101626] border border-[#1f293d] rounded-xl p-4"
            >
              <GroupedPartsList
                partsByCategory={partsByCategory}
                totalCount={bikeParts.length}
              />
            </div>
          )}
        </div>

      </main>

      {/* ─── RIGHT: COLLAPSIBLE FULL-HEIGHT ASIDE (DESKTOP lg+) ─── */}
      <aside
        id="parts-panel"
        aria-label="Parts for this bike"
        className={`hidden lg:flex flex-col sticky top-20 h-[calc(100vh-5rem)] border-l border-[#1f293d] bg-[#101626] overscroll-contain transition-none shrink-0 ${
          isDesktopPanelOpen ? '' : 'w-14'
        }`}
        style={isDesktopPanelOpen ? { width: `${panelWidth}px` } : undefined}
      >
        {isDesktopPanelOpen ? (
          <div className="relative flex flex-col h-full overflow-hidden">
            {/* Drag Handle — left edge */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize parts panel"
              aria-valuemin={PANEL_MIN}
              aria-valuemax={PANEL_MAX}
              aria-valuenow={panelWidth}
              tabIndex={0}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={onHandleDoubleClick}
              onKeyDown={onHandleKeyDown}
              className="absolute left-0 top-0 h-full w-3 cursor-col-resize z-10 flex items-center justify-center group select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] focus-visible:ring-inset"
              style={{ touchAction: 'none' }}
            >
              {/* Thin visible line */}
              <div className="w-px h-full bg-[#1f293d] group-hover:bg-[#0066CC]/60 transition-colors duration-150" />
            </div>

            {/* Panel Header */}
            <div className="pl-3 pr-4 py-4 border-b border-[#1f293d] bg-[#101626] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="text-base font-bold text-white truncate">
                  Parts for this bike
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#0066CC]/20 text-[#4da3ff] border border-[#0066CC]/30 shrink-0">
                  {bikeParts.length}
                </span>
              </div>

              {/* Minimise button */}
              <button
                type="button"
                onClick={() => setIsDesktopPanelOpen(false)}
                aria-expanded="true"
                aria-controls="parts-panel-content"
                aria-label="Hide parts"
                title="Hide parts"
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#151c2c] transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Panel Content (independent scroll) */}
            <div
              id="parts-panel-content"
              className="flex-1 overflow-y-auto overscroll-contain p-4"
            >
              <GroupedPartsList
                partsByCategory={partsByCategory}
                totalCount={bikeParts.length}
              />
            </div>
          </div>
        ) : (
          /* Minimised Slim Strip (56px) */
          <div className="flex flex-col h-full items-center py-4 justify-between w-full">
            {/* Reopen button */}
            <button
              type="button"
              onClick={() => setIsDesktopPanelOpen(true)}
              aria-expanded="false"
              aria-controls="parts-panel-content"
              aria-label="Show parts"
              title="Show parts"
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#151c2c] transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Vertical Label Strip */}
            <button
              type="button"
              onClick={() => setIsDesktopPanelOpen(true)}
              aria-label={`Show parts (${bikeParts.length})`}
              className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-white [writing-mode:vertical-rl] rotate-180 text-xs font-semibold tracking-wider py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded-lg w-full"
            >
              <div className="flex items-center gap-2">
                <Bike className="w-3.5 h-3.5 text-[#0066CC] rotate-90" />
                <span>Parts ({bikeParts.length})</span>
              </div>
            </button>
          </div>
        )}
      </aside>

    </div>
  );
}
