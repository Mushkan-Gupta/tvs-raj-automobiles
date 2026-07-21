import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Slider from 'rc-slider';
import { Filter, RotateCcw, X, SlidersHorizontal, Check, AlertCircle, ArrowRight, Zap, Loader } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// ─── Filter Sidebar (extracted as a top-level component to avoid re-mount on parent state changes) ───
const FilterSidebar = React.memo(function FilterSidebar({
  priceRange, setPriceRange, setAppliedPriceRange,
  ccRange, setCcRange, setAppliedCcRange,
  anyCC, setAnyCC,
  selectedCategories, toggleCategory,
  selectedFuelTypes, toggleFuelType,
  onlyInStock, setOnlyInStock,
  handleClearFilters,
  availableCategories, availableFuelTypes,
}) {
  const formatNPR = (val) => `NPR ${val.toLocaleString()}`;

  // Commit price filter on drag end
  const onPriceAfterChange = useCallback((val) => setAppliedPriceRange(val), [setAppliedPriceRange]);
  const onCCAfterChange = useCallback((val) => setAppliedCcRange(val), [setAppliedCcRange]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1f293d]">
        <div className="flex items-center space-x-2 text-white font-bold text-base">
          <SlidersHorizontal className="w-5 h-5 text-[#0066CC]" />
          <span>Find Your Bike</span>
        </div>
        <button
          onClick={handleClearFilters}
          className="text-xs font-semibold text-[#0066CC] hover:text-blue-300 flex items-center space-x-1 transition-colors min-h-[32px] px-1"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear all</span>
        </button>
      </div>

      {/* Price Range Slider */}
      <div className="space-y-3">
        <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">Price Range</label>
        <div className="flex items-center justify-between text-xs text-[#0066CC] font-bold bg-[#0b0f19] p-3 rounded-xl border border-[#1f293d]">
          <span>{formatNPR(priceRange[0])}</span>
          <span className="text-gray-500 font-normal">to</span>
          <span>{formatNPR(priceRange[1])}</span>
        </div>
        <div className="px-1 pt-2 pb-1">
          <Slider
            range
            min={200000}
            max={900000}
            step={5000}
            value={priceRange}
            onChange={setPriceRange}
            onChangeComplete={onPriceAfterChange}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 px-1 font-medium">
          <span>NPR 200,000</span>
          <span>NPR 900,000</span>
        </div>
      </div>

      {/* Engine CC Slider */}
      <div className="space-y-3 pt-4 border-t border-[#1f293d]">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">Engine CC</label>
          <label className="flex items-center space-x-2 cursor-pointer text-xs text-gray-300 py-1 px-1">
            <input type="checkbox" checked={anyCC} onChange={(e) => setAnyCC(e.target.checked)}
              className="w-4 h-4 rounded bg-[#0b0f19] border-[#1f293d] text-[#0066CC] focus:ring-0 cursor-pointer" />
            <span className="font-semibold text-blue-400">Any CC</span>
          </label>
        </div>

        {!anyCC ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#0066CC] font-bold bg-[#0b0f19] p-3 rounded-xl border border-[#1f293d]">
              <span>{ccRange[0]} cc</span>
              <span className="text-gray-500 font-normal">to</span>
              <span>{ccRange[1]} cc</span>
            </div>
            <div className="px-1 pt-2 pb-1">
              <Slider
                range
                min={100}
                max={350}
                step={5}
                value={ccRange}
                onChange={setCcRange}
                onChangeComplete={onCCAfterChange}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 px-1 font-medium">
              <span>100 cc</span>
              <span>350 cc</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic bg-[#0b0f19]/40 p-3 rounded-xl border border-[#1f293d]/50">
            Showing all engine sizes. Uncheck "Any CC" to adjust.
          </p>
        )}
      </div>

      {/* Category Checkboxes */}
      <div className="space-y-2.5 pt-4 border-t border-[#1f293d]">
        <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">Category</label>
        <div className="space-y-1.5">
          {availableCategories.map((cat) => {
            const isChecked = selectedCategories.includes(cat);
            return (
              <label key={cat} onClick={() => toggleCategory(cat)}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-colors min-h-[40px] ${
                  isChecked ? 'bg-[#0066CC]/20 border-[#0066CC] text-white font-semibold' : 'bg-[#0b0f19]/60 border-[#1f293d] text-gray-300 hover:border-gray-600'
                }`}>
                <span>{cat}</span>
                {isChecked && <Check className="w-4 h-4 text-[#0066CC]" />}
              </label>
            );
          })}
        </div>
      </div>

      {/* Fuel Type */}
      <div className="space-y-2.5 pt-4 border-t border-[#1f293d]">
        <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">Fuel Type</label>
        <div className="grid grid-cols-2 gap-2">
          {availableFuelTypes.map((fuel) => {
            const isChecked = selectedFuelTypes.includes(fuel);
            return (
              <label key={fuel} onClick={() => toggleFuelType(fuel)}
                className={`flex items-center justify-center space-x-1.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors min-h-[40px] ${
                  isChecked ? 'bg-[#0066CC]/20 border-[#0066CC] text-white' : 'bg-[#0b0f19]/60 border-[#1f293d] text-gray-400 hover:border-gray-600'
                }`}>
                {fuel === 'Electric' && <Zap className="w-3.5 h-3.5 text-amber-400" />}
                <span>{fuel}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* In-Stock Toggle */}
      <div className="pt-4 border-t border-[#1f293d]">
        <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-[#0b0f19]/80 border border-[#1f293d] min-h-[44px]">
          <span className="text-xs font-semibold text-gray-200">Show only in-stock bikes</span>
          <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)}
            className="w-4 h-4 rounded accent-[#0066CC] cursor-pointer" />
        </label>
      </div>
    </div>
  );
});

// ─── Bike Card (extracted to avoid re-render of all cards on slider drag) ───
const BikeCard = React.memo(function BikeCard({ bike }) {
  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between group">
      <div>
        <div className="relative h-48 sm:h-52 overflow-hidden bg-[#0d1527]">
          <img src={bike.image} alt={bike.name} loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute top-3 left-3 bg-[#0066CC] text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
            {bike.tag}
          </div>
          <div className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            bike.inStock ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'
          }`}>
            {bike.inStock ? 'In Stock' : 'Pre-order'}
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#0066CC] font-bold">{bike.category}</span>
            <span className="text-gray-400">{bike.fuelType}</span>
          </div>
          <h3 className="text-lg font-bold text-white group-hover:text-[#0066CC] transition-colors line-clamp-1">{bike.name}</h3>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-300 bg-[#0b0f19]/60 p-2.5 rounded-lg border border-[#1f293d]">
            <div>
              <span className="text-gray-500 block text-[10px]">Engine</span>
              <span className="font-semibold text-gray-200 truncate block">{bike.engine}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Mileage</span>
              <span className="font-semibold text-gray-200 truncate block">{bike.mileage}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{bike.description}</p>
        </div>
      </div>

      <div className="p-4 sm:p-5 pt-0 mt-1.5 border-t border-[#1f293d]/50 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-gray-400 block">Showroom Price</span>
          <span className="text-base font-black text-white">{bike.price}</span>
        </div>
        <Link to={`/bikes/${bike.id}`}
          className="px-4 py-2.5 rounded-xl btn-primary text-xs font-bold flex items-center space-x-1 min-h-[40px]">
          <span>Inquire</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
});


// ─── Main Page Component ───
export default function BikeListing() {
  // Supabase state
  const [supabaseBikes, setSupabaseBikes] = useState([]);
  const [supabaseLoading, setSupabaseLoading] = useState(true);
  const [supabaseError, setSupabaseError] = useState(null);

  const availableCategories = useMemo(() => Array.from(new Set(supabaseBikes.map(b => b.category).filter(Boolean))), [supabaseBikes]);
  const availableFuelTypes = useMemo(() => Array.from(new Set(supabaseBikes.map(b => b.fuelType).filter(Boolean))), [supabaseBikes]);

  useEffect(() => {
    async function fetchBikes() {
      try {
        setSupabaseLoading(true);
        const { data, error } = await supabase.from('bikes').select('*');
        
        if (error) throw error;

        // Map Supabase data to match BikeCard expected props
        const formattedBikes = (data || []).map(bike => ({
          ...bike,
          id: bike.id,
          name: bike.name,
          category: bike.category,
          engine: bike.specs?.engine || 'N/A',
          mileage: bike.specs?.mileage || 'N/A',
          power: bike.specs?.power,
          torque: bike.specs?.torque,
          transmission: bike.specs?.transmission,
          price: bike.price ? `NPR ${bike.price.toLocaleString()}` : 'Price TBA',
          priceValue: bike.price || 0,
          ccValue: bike.engine_cc || 0,
          fuelType: bike.fuel_type || 'Petrol',
          inStock: bike.in_stock,
          tag: bike.tag,
          image: bike.image_url || 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
          description: bike.description
        }));

        setSupabaseBikes(formattedBikes);
      } catch (err) {
        console.error('Error fetching bikes:', err);
        setSupabaseError(err.message);
      } finally {
        setSupabaseLoading(false);
      }
    }

    fetchBikes();
  }, []);

  // Slider display state (updates instantly on every drag pixel — never triggers filtering)
  const [priceRange, setPriceRange] = useState([200000, 900000]);
  const [ccRange, setCcRange] = useState([100, 350]);

  // Applied filter state (only updated on drag END via onChangeComplete/onAfterChange)
  const [appliedPriceRange, setAppliedPriceRange] = useState([200000, 900000]);
  const [appliedCcRange, setAppliedCcRange] = useState([100, 350]);

  const [anyCC, setAnyCC] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedFuelTypes, setSelectedFuelTypes] = useState([]);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const handleClearFilters = useCallback(() => {
    setPriceRange([200000, 900000]);
    setAppliedPriceRange([200000, 900000]);
    setCcRange([100, 350]);
    setAppliedCcRange([100, 350]);
    setAnyCC(true);
    setSelectedCategories([]);
    setSelectedFuelTypes([]);
    setOnlyInStock(false);
  }, []);

  const toggleCategory = useCallback((cat) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  }, []);

  const toggleFuelType = useCallback((fuel) => {
    setSelectedFuelTypes(prev => prev.includes(fuel) ? prev.filter(f => f !== fuel) : [...prev, fuel]);
  }, []);

  // Filtering only runs when APPLIED state changes (not on drag movement)
  const filteredBikes = useMemo(() => {
    const [minP, maxP] = appliedPriceRange;
    const [minC, maxC] = appliedCcRange;
    return supabaseBikes.filter(bike => {
      if (bike.priceValue < minP || bike.priceValue > maxP) return false;
      if (!anyCC && (bike.ccValue < minC || bike.ccValue > maxC)) return false;
      if (selectedCategories.length > 0 && (!bike.category || !selectedCategories.includes(bike.category))) return false;
      if (selectedFuelTypes.length > 0 && (!bike.fuelType || !selectedFuelTypes.includes(bike.fuelType))) return false;
      if (onlyInStock && !bike.inStock) return false;
      return true;
    });
  }, [supabaseBikes, appliedPriceRange, appliedCcRange, anyCC, selectedCategories, selectedFuelTypes, onlyInStock]);

  const isFiltered = selectedCategories.length > 0 || selectedFuelTypes.length > 0 || !anyCC || onlyInStock
    || priceRange[0] > 200000 || priceRange[1] < 900000;

  // Shared filter sidebar props
  const filterProps = {
    priceRange, setPriceRange, setAppliedPriceRange,
    ccRange, setCcRange, setAppliedCcRange,
    anyCC, setAnyCC,
    selectedCategories, toggleCategory,
    selectedFuelTypes, toggleFuelType,
    onlyInStock, setOnlyInStock,
    handleClearFilters,
    availableCategories, availableFuelTypes,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1f293d] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">TVS Bikes & Scooters</h1>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">Explore the complete TVS vehicle lineup available at Lahan Showroom.</p>
        </div>
        <button onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
          className="lg:hidden flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-[#0066CC] text-white text-sm font-bold shadow-lg w-full sm:w-auto min-h-[44px]">
          <Filter className="w-4 h-4" />
          <span>Filter Bikes ({filteredBikes.length})</span>
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Filter Sidebar — uses filter-panel (no backdrop-filter for perf) */}
        <div className="hidden lg:block lg:col-span-4 filter-panel p-5 rounded-2xl sticky top-24">
          <FilterSidebar {...filterProps} />
        </div>

        {/* Mobile Filter Drawer */}
        <AnimatePresence>
          {mobileFilterOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden flex justify-end">
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-full max-w-[320px] h-full bg-[#0b0f19] border-l border-[#1f293d] p-5 overflow-y-auto overscroll-contain flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-5 border-b border-[#1f293d] pb-4">
                    <span className="font-bold text-white text-lg">Filter Bikes</span>
                    <button onClick={() => setMobileFilterOpen(false)}
                      className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-[#151c2c] min-h-[40px] min-w-[40px] flex items-center justify-center">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <FilterSidebar {...filterProps} />
                </div>
                <button onClick={() => setMobileFilterOpen(false)}
                  className="w-full mt-5 py-3.5 bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-xl text-sm min-h-[44px]">
                  View {filteredBikes.length} Bikes
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <div className="lg:col-span-8 space-y-5">
          {supabaseLoading ? (
            <div className="flex flex-col items-center justify-center p-12 sm:p-20 filter-panel rounded-2xl border border-[#1f293d]">
              <Loader className="w-10 h-10 text-[#0066CC] animate-spin mb-4" />
              <h3 className="text-lg font-bold text-white">Loading bikes...</h3>
              <p className="text-xs sm:text-sm text-gray-400 mt-2">Fetching live data from database</p>
            </div>
          ) : supabaseError ? (
            <div className="flex flex-col items-center justify-center p-12 sm:p-20 filter-panel rounded-2xl border border-red-500/30 bg-red-500/5">
              <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
              <h3 className="text-lg font-bold text-white">Could not load live data</h3>
              <p className="text-xs sm:text-sm text-gray-400 mt-2">{supabaseError}</p>
            </div>
          ) : (
            <>
              {/* Count bar */}
              <div className="flex items-center justify-between text-xs sm:text-sm bg-[#151c2c]/60 p-3.5 rounded-xl border border-[#1f293d]">
                <span className="text-gray-300 font-semibold">
                  Showing <span className="text-[#0066CC] font-bold">{filteredBikes.length}</span> of {supabaseBikes.length} bikes
                </span>
                {isFiltered && (
                  <button onClick={handleClearFilters}
                    className="text-xs text-[#0066CC] hover:underline font-medium flex items-center space-x-1">
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Bike Grid */}
              {filteredBikes.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {filteredBikes.map((bike) => (
                    <BikeCard key={bike.id} bike={bike} />
                  ))}
                </div>
              ) : (
                <div className="filter-panel p-8 sm:p-10 rounded-2xl text-center space-y-4 border border-[#1f293d]">
                  <div className="bg-[#0066CC]/10 p-4 rounded-full w-fit mx-auto border border-[#0066CC]/30">
                    <AlertCircle className="w-10 h-10 text-[#0066CC]" />
                  </div>
                  <h3 className="text-lg font-bold text-white">No bikes match your filters</h3>
                  <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto">
                    Try adjusting your price range, clearing engine CC limits, or unchecking specific categories.
                  </p>
                  <button onClick={handleClearFilters}
                    className="mt-2 px-6 py-3 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold text-xs transition-all shadow-lg min-h-[44px]">
                    Clear All Filters
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
