import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Bike, Pin, RotateCcw, AlertCircle, Package, ShieldCheck, X, ShoppingCart, Plus, Minus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatNPR } from '../lib/formatters';
import { useCart } from '../lib/CartContext';
import PartImagePlaceholder from '../components/parts/PartImagePlaceholder';

/**
 * Individual Part Card
 */
function PartCard({ part, compatibleBikes = [] }) {
  const [imgFailed, setImgFailed] = useState(false);
  const { getItemQty, addItem, setQty } = useCart();

  const qtyInCart = getItemQty(part.id);

  // Stock status text & style
  const isOutOfStock = part.stock_qty <= 0;
  const isLowStock = !isOutOfStock && part.stock_qty <= (part.low_stock_threshold || 3);

  return (
    <article
      className="bg-[#151c2c] border border-[#1f293d] rounded-xl overflow-hidden flex flex-col justify-between transition-colors duration-150 ease-in-out hover:border-[#0066CC]/60"
    >
      {/* Top Image Section */}
      <div className="relative aspect-[4/3] bg-[#111827] overflow-hidden border-b border-[#1f293d]">
        {part.image_url && !imgFailed ? (
          <img
            src={part.image_url}
            alt={part.name}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-opacity duration-150 ease-in-out"
            loading="lazy"
          />
        ) : (
          <PartImagePlaceholder category={part.category} name={part.name} />
        )}

        {/* Pinned Pill */}
        {part.is_pinned && (
          <div className="absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#0066CC] text-white">
            <Pin className="w-3 h-3 fill-current rotate-45" />
            <span>Featured</span>
          </div>
        )}

        {/* Stock Status Badge */}
        <div className="absolute top-2.5 right-2.5 z-10">
          {isOutOfStock ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#0b0f19]/90 text-gray-400 border border-[#1f293d]">
              Out of stock
            </span>
          ) : isLowStock ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-950/90 text-amber-300 border border-amber-800/80">
              Only {part.stock_qty} left
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-950/90 text-emerald-300 border border-emerald-800/80">
              In stock
            </span>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div className="space-y-1.5">
          {/* Category */}
          {part.category && (
            <span className="block text-xs font-medium text-[#4da3ff]">
              {part.category}
            </span>
          )}

          {/* Part Name */}
          <h3 className="text-base font-semibold text-white leading-snug line-clamp-2">
            {part.name}
          </h3>

          {/* Description */}
          {part.description && (
            <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
              {part.description}
            </p>
          )}
        </div>

        {/* Price & Stock Line */}
        <div className="pt-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-lg font-bold text-white">
              {formatNPR(part.price)}
            </span>
            <span className="text-xs text-gray-400">
              {isOutOfStock ? 'Currently unavailable' : isLowStock ? 'Low inventory' : 'Available at showroom'}
            </span>
          </div>

          {/* Signature Compatibility Tag */}
          <div className="mt-3 pt-3 border-t border-[#1f293d] flex items-start gap-2">
            <Bike className="w-4 h-4 text-[#0066CC] shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <span className="block text-xs text-gray-400 font-medium">
                Compatibility
              </span>
              {part.fits_all ? (
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-[#111827] border border-[#1f293d] text-xs font-medium text-blue-300">
                  All bikes
                </span>
              ) : compatibleBikes.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {compatibleBikes.map((bikeName) => (
                    <span
                      key={bikeName}
                      className="px-2 py-0.5 rounded bg-[#111827] border border-[#1f293d] text-xs text-gray-300"
                    >
                      {bikeName}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="block text-xs text-gray-400 mt-1">
                  Model-specific (contact showroom)
                </span>
              )}
              {/* Action button: Add to cart / Stepper */}
              <div className="mt-4 pt-3 border-t border-[#1f293d]">
                {isOutOfStock ? (
                  <button
                    type="button"
                    disabled
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#111827] border border-[#1f293d] text-gray-500 text-xs font-semibold cursor-not-allowed flex items-center justify-center select-none"
                  >
                    Out of stock
                  </button>
                ) : qtyInCart === 0 ? (
                  <button
                    type="button"
                    onClick={() => addItem(part.id, 1)}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                    aria-label={`Add ${part.name} to cart`}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span>Add to cart</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-between min-h-[44px] rounded-lg bg-[#111827] border border-[#0066CC]/60 px-1 py-0.5">
                    <button
                      type="button"
                      onClick={() => setQty(part.id, qtyInCart - 1)}
                      className="w-10 h-10 min-w-[40px] flex items-center justify-center rounded text-gray-300 hover:text-white hover:bg-[#151c2c] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                      aria-label={qtyInCart === 1 ? `Remove ${part.name} from cart` : `Decrease quantity for ${part.name}`}
                      title={qtyInCart === 1 ? 'Remove from cart' : 'Decrease'}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-bold text-white px-3 select-none" aria-label={`Quantity in cart: ${qtyInCart}`}>
                      {qtyInCart}
                    </span>
                    <button
                      type="button"
                      disabled={qtyInCart >= part.stock_qty}
                      onClick={() => setQty(part.id, qtyInCart + 1)}
                      className="w-10 h-10 min-w-[40px] flex items-center justify-center rounded text-gray-300 hover:text-white hover:bg-[#151c2c] disabled:text-gray-600 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                      aria-label={`Increase quantity for ${part.name}`}
                      title={qtyInCart >= part.stock_qty ? 'Maximum available stock reached' : 'Increase'}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * Skeleton Card for Loading State
 */
function SkeletonCard() {
  return (
    <div className="bg-[#151c2c] border border-[#1f293d] rounded-xl overflow-hidden animate-pulse flex flex-col justify-between">
      <div className="aspect-[4/3] bg-[#111827]" />
      <div className="p-4 space-y-3">
        <div className="h-3 w-1/3 bg-[#1f293d] rounded" />
        <div className="h-5 w-3/4 bg-[#1f293d] rounded" />
        <div className="h-3 w-full bg-[#1f293d] rounded" />
        <div className="pt-3 border-t border-[#1f293d] flex items-center justify-between">
          <div className="h-6 w-1/3 bg-[#1f293d] rounded" />
          <div className="h-4 w-1/4 bg-[#1f293d] rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Main Public Parts Page
 */
export default function Parts() {
  const [parts, setParts] = useState([]);
  const [bikeParts, setBikeParts] = useState([]);
  const [bikes, setBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBikeId, setSelectedBikeId] = useState('all');

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch parts (active only; NEVER read part_costs or cost_price)
      const partsPromise = supabase
        .from('parts')
        .select('id,name,category,description,price,stock_qty,low_stock_threshold,image_url,is_pinned,fits_all,sort_order')
        .eq('active', true)
        .order('is_pinned', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });

      // 2. Fetch bike_parts
      const bikePartsPromise = supabase
        .from('bike_parts')
        .select('part_id,bike_id');

      // 3. Fetch bikes for filter and name resolution
      const bikesPromise = supabase
        .from('bikes')
        .select('id,name')
        .order('name', { ascending: true });

      const [partsRes, bikePartsRes, bikesRes] = await Promise.all([
        partsPromise,
        bikePartsPromise,
        bikesPromise,
      ]);

      if (partsRes.error) throw partsRes.error;
      if (bikePartsRes.error) throw bikePartsRes.error;
      if (bikesRes.error) throw bikesRes.error;

      setParts(partsRes.data || []);
      setBikeParts(bikePartsRes.data || []);
      setBikes(bikesRes.data || []);
    } catch (err) {
      console.error('[Parts] Error loading data:', err);
      setError(err.message || 'Unable to load parts catalogue. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Bike ID to Name map
  const bikeMap = useMemo(() => {
    return new Map(bikes.map((b) => [b.id, b.name]));
  }, [bikes]);

  // Part ID to compatible bike names
  const partBikesMap = useMemo(() => {
    const map = new Map();
    for (const bp of bikeParts) {
      if (!map.has(bp.part_id)) {
        map.set(bp.part_id, []);
      }
      const bName = bikeMap.get(bp.bike_id);
      if (bName) {
        map.get(bp.part_id).push(bName);
      }
    }
    return map;
  }, [bikeParts, bikeMap]);

  // Part ID to compatible bike IDs set (for quick lookup)
  const partBikeIdsMap = useMemo(() => {
    const map = new Map();
    for (const bp of bikeParts) {
      if (!map.has(bp.part_id)) {
        map.set(bp.part_id, new Set());
      }
      map.get(bp.part_id).add(bp.bike_id);
    }
    return map;
  }, [bikeParts]);

  // Unique categories extracted dynamically from parts data
  const categories = useMemo(() => {
    const set = new Set();
    for (const p of parts) {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    }
    return ['All', ...Array.from(set).sort()];
  }, [parts]);

  // Filtered parts
  const filteredParts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return parts.filter((part) => {
      // 1. Category filter
      if (selectedCategory !== 'All' && part.category !== selectedCategory) {
        return false;
      }

      // 2. Search by name
      if (query && !part.name?.toLowerCase().includes(query)) {
        return false;
      }

      // 3. My bike filter
      if (selectedBikeId !== 'all') {
        if (part.fits_all) {
          return true;
        }
        const compatibleIds = partBikeIdsMap.get(part.id);
        if (!compatibleIds || !compatibleIds.has(selectedBikeId)) {
          return false;
        }
      }

      return true;
    });
  }, [parts, selectedCategory, searchQuery, selectedBikeId, partBikeIdsMap]);

  // Ensure strict ordering: is_pinned first, then sort_order, then name
  const sortedParts = useMemo(() => {
    return [...filteredParts].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) {
        return a.is_pinned ? -1 : 1;
      }
      const orderA = a.sort_order ?? 0;
      const orderB = b.sort_order ?? 0;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [filteredParts]);

  // Separate pinned items for the top moment
  const pinnedParts = useMemo(() => sortedParts.filter((p) => p.is_pinned), [sortedParts]);
  const otherParts = useMemo(() => sortedParts.filter((p) => !p.is_pinned), [sortedParts]);

  // Clear filters helper
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All');
    setSelectedBikeId('all');
  };

  const hasActiveFilters = searchQuery.trim() !== '' || selectedCategory !== 'All' || selectedBikeId !== 'all';

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Page Header */}
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#151c2c] border border-[#1f293d] text-xs text-blue-400">
            <ShieldCheck className="w-4 h-4 text-[#0066CC]" />
            <span>100% Genuine TVS Parts & Accessories</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Parts & Accessories
          </h1>
          <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
            Browse authentic TVS replacement parts, safety helmets, and official riding gear. Sourced directly for riders in Lahan, Siraha and Eastern Nepal.
          </p>
        </header>

        {/* Filter Bar */}
        <section
          aria-label="Filter parts"
          className="bg-[#151c2c] border border-[#1f293d] rounded-xl p-4 sm:p-5 space-y-4"
        >
          {/* Search + Bike Filter row */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="sm:col-span-7 lg:col-span-8 relative">
              <label htmlFor="search-input" className="sr-only">
                Search parts by name
              </label>
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by part name..."
                className="w-full pl-10 pr-10 min-h-[44px] bg-[#0b0f19] border border-[#1f293d] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0066CC] transition-colors duration-150 ease-in-out"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center min-w-[44px] min-h-[44px] justify-center text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* My Bike Select Dropdown */}
            <div className="sm:col-span-5 lg:col-span-4">
              <label htmlFor="bike-select" className="sr-only">
                Filter by bike model
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#0066CC]">
                  <Bike className="w-4 h-4" />
                </div>
                <select
                  id="bike-select"
                  value={selectedBikeId}
                  onChange={(e) => setSelectedBikeId(e.target.value)}
                  className="w-full pl-10 pr-4 min-h-[44px] bg-[#0b0f19] border border-[#1f293d] rounded-lg text-sm text-white focus:outline-none focus:border-[#0066CC] transition-colors duration-150 ease-in-out cursor-pointer"
                >
                  <option value="all">My bike: All models</option>
                  {bikes.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Category Chips (built from data) */}
          <div className="space-y-2">
            <span className="text-xs text-gray-400 font-medium">Category</span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`min-h-[44px] px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors duration-150 ease-in-out shrink-0 ${
                      isActive
                        ? 'bg-[#0066CC] text-white border-[#0066CC]'
                        : 'bg-[#0b0f19] text-gray-300 border-[#1f293d] hover:text-white hover:border-gray-500'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Filter Summary / Reset */}
          {hasActiveFilters && (
            <div className="pt-3 border-t border-[#1f293d] flex items-center justify-between gap-3 text-xs">
              <span className="text-gray-400">
                Found {sortedParts.length} {sortedParts.length === 1 ? 'part' : 'parts'} matching criteria
              </span>
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 min-h-[44px] px-2 font-medium transition-colors duration-150 ease-in-out"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset filters</span>
              </button>
            </div>
          )}
        </section>

        {/* Content Area */}
        {loading ? (
          // Loading Skeleton State
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : error ? (
          // Error State
          <div className="bg-[#151c2c] border border-red-500/30 rounded-xl p-8 text-center space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">Error loading parts</h2>
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
        ) : sortedParts.length === 0 ? (
          // Empty State
          <div className="bg-[#151c2c] border border-[#1f293d] rounded-xl p-10 text-center space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-[#111827] border border-[#1f293d] text-gray-400 flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-semibold text-white">No parts found</h2>
              <p className="text-xs text-gray-400">
                No parts match your current search or bike selection. Try selecting a different model or clearing your filters.
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-semibold transition-colors duration-150 ease-in-out"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Clear all filters</span>
              </button>
            )}
          </div>
        ) : (
          // Results
          <div className="space-y-8">
            {/* Pinned / Featured Section Moment */}
            {pinnedParts.length > 0 && (
              <section className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-[#1f293d]">
                  <Pin className="w-4 h-4 text-[#0066CC] rotate-45" />
                  <h2 className="text-base font-semibold text-white">
                    Featured & Essential Gear
                  </h2>
                  <span className="text-xs text-gray-400">({pinnedParts.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {pinnedParts.map((part) => (
                    <PartCard
                      key={part.id}
                      part={part}
                      compatibleBikes={partBikesMap.get(part.id) || []}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Other Parts Section */}
            {otherParts.length > 0 && (
              <section className="space-y-4">
                {pinnedParts.length > 0 && (
                  <div className="flex items-center justify-between pb-2 border-b border-[#1f293d]">
                    <h2 className="text-base font-semibold text-white">
                      Catalogue Parts
                    </h2>
                    <span className="text-xs text-gray-400">({otherParts.length})</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {otherParts.map((part) => (
                    <PartCard
                      key={part.id}
                      part={part}
                      compatibleBikes={partBikesMap.get(part.id) || []}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

