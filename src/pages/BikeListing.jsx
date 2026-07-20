import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Slider from 'rc-slider';
import { Filter, RotateCcw, X, SlidersHorizontal, Check, AlertCircle, ArrowRight, Zap } from 'lucide-react';
import { sampleBikes } from '../data/bikes';

export default function BikeListing() {
  // Dynamic categories & fuel types present in dataset
  const availableCategories = useMemo(() => Array.from(new Set(sampleBikes.map(b => b.category))), []);
  const availableFuelTypes = useMemo(() => Array.from(new Set(sampleBikes.map(b => b.fuelType))), []);

  // Filter States
  const [minPrice, setMinPrice] = useState(200000);
  const [maxPrice, setMaxPrice] = useState(900000);

  const [anyCC, setAnyCC] = useState(true);
  const [minCC, setMinCC] = useState(100);
  const [maxCC, setMaxCC] = useState(350);

  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedFuelTypes, setSelectedFuelTypes] = useState([]);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Clear filters handler
  const handleClearFilters = () => {
    setMinPrice(200000);
    setMaxPrice(900000);
    setAnyCC(true);
    setMinCC(100);
    setMaxCC(350);
    setSelectedCategories([]);
    setSelectedFuelTypes([]);
    setOnlyInStock(false);
  };

  // Toggle Category Selection
  const toggleCategory = (cat) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(selectedCategories.filter(c => c !== cat));
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  // Toggle Fuel Type Selection
  const toggleFuelType = (fuel) => {
    if (selectedFuelTypes.includes(fuel)) {
      setSelectedFuelTypes(selectedFuelTypes.filter(f => f !== fuel));
    } else {
      setSelectedFuelTypes([...selectedFuelTypes, fuel]);
    }
  };

  // Real-time filtering logic
  const filteredBikes = useMemo(() => {
    return sampleBikes.filter(bike => {
      // 1. Price filter
      if (bike.priceValue < minPrice || bike.priceValue > maxPrice) return false;

      // 2. CC filter (disabled if anyCC is checked)
      if (!anyCC) {
        if (bike.ccValue < minCC || bike.ccValue > maxCC) return false;
      }

      // 3. Category filter
      if (selectedCategories.length > 0 && !selectedCategories.includes(bike.category)) {
        return false;
      }

      // 4. Fuel type filter
      if (selectedFuelTypes.length > 0 && !selectedFuelTypes.includes(bike.fuelType)) {
        return false;
      }

      // 5. Availability filter
      if (onlyInStock && !bike.inStock) {
        return false;
      }

      return true;
    });
  }, [minPrice, maxPrice, anyCC, minCC, maxCC, selectedCategories, selectedFuelTypes, onlyInStock]);

  const formatNPR = (val) => `NPR ${val.toLocaleString()}`;

  // Render Filter Sidebar / Content
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#1f293d]">
        <div className="flex items-center space-x-2 text-white font-bold text-lg">
          <SlidersHorizontal className="w-5 h-5 text-[#0066CC]" />
          <span>Find Your Bike</span>
        </div>
        <button
          onClick={handleClearFilters}
          className="text-xs font-semibold text-[#0066CC] hover:text-blue-300 flex items-center space-x-1 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Clear all</span>
        </button>
      </div>

      {/* 1. Dual-Handle Price Range Slider */}
      <div className="space-y-4">
        <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
          Price Range
        </label>
        <div className="flex items-center justify-between text-xs text-[#0066CC] font-bold bg-[#0b0f19] p-3 rounded-xl border border-[#1f293d]">
          <span>{formatNPR(minPrice)}</span>
          <span className="text-gray-500 font-normal">to</span>
          <span>{formatNPR(maxPrice)}</span>
        </div>

        <div className="px-1 pt-2 pb-1">
          <Slider
            range
            min={200000}
            max={900000}
            step={10000}
            value={[minPrice, maxPrice]}
            onChange={([min, max]) => {
              setMinPrice(min);
              setMaxPrice(max);
            }}
            handleRender={(node, handleProps) => {
              return React.cloneElement(node, {
                children: (
                  <span className="slider-tooltip">
                    NPR {handleProps.value.toLocaleString()}
                  </span>
                ),
              });
            }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 px-1 font-medium">
          <span>NPR 200,000</span>
          <span>NPR 900,000</span>
        </div>
      </div>

      {/* 2. Dual-Handle Engine CC Range Slider */}
      <div className="space-y-4 pt-4 border-t border-[#1f293d]">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
            Engine Capacity (CC)
          </label>
          {/* Any CC Checkbox */}
          <label className="flex items-center space-x-1.5 cursor-pointer text-xs text-gray-300">
            <input
              type="checkbox"
              checked={anyCC}
              onChange={(e) => setAnyCC(e.target.checked)}
              className="rounded bg-[#0b0f19] border-[#1f293d] text-[#0066CC] focus:ring-0 cursor-pointer"
            />
            <span className="font-semibold text-blue-400">Any CC</span>
          </label>
        </div>

        {!anyCC ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#0066CC] font-bold bg-[#0b0f19] p-3 rounded-xl border border-[#1f293d]">
              <span>{minCC} cc</span>
              <span className="text-gray-500 font-normal">to</span>
              <span>{maxCC} cc</span>
            </div>
            <div className="px-1 pt-2 pb-1">
              <Slider
                range
                min={100}
                max={350}
                step={10}
                value={[minCC, maxCC]}
                onChange={([min, max]) => {
                  setMinCC(min);
                  setMaxCC(max);
                }}
                disabled={anyCC}
                handleRender={(node, handleProps) => {
                  return React.cloneElement(node, {
                    children: (
                      <span className="slider-tooltip">
                        {handleProps.value} cc
                      </span>
                    ),
                  });
                }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 px-1 font-medium">
              <span>100 cc</span>
              <span>350 cc</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic bg-[#0b0f19]/40 p-3 rounded-xl border border-[#1f293d]/50">
            Filtering for all engine displacement sizes. Uncheck "Any CC" to adjust CC range.
          </p>
        )}
      </div>

      {/* 3. Category Checkboxes */}
      <div className="space-y-3 pt-4 border-t border-[#1f293d]">
        <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
          Vehicle Category
        </label>
        <div className="space-y-2">
          {availableCategories.map((cat) => {
            const isChecked = selectedCategories.includes(cat);
            return (
              <label
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  isChecked
                    ? 'bg-[#0066CC]/20 border-[#0066CC] text-white font-semibold'
                    : 'bg-[#0b0f19]/60 border-[#1f293d] text-gray-300 hover:border-gray-600'
                }`}
              >
                <span>{cat}</span>
                {isChecked && <Check className="w-4 h-4 text-[#0066CC]" />}
              </label>
            );
          })}
        </div>
      </div>

      {/* 4. Fuel Type Checkboxes */}
      <div className="space-y-3 pt-4 border-t border-[#1f293d]">
        <label className="block text-xs font-bold text-gray-200 uppercase tracking-wider">
          Fuel Type
        </label>
        <div className="grid grid-cols-2 gap-2">
          {availableFuelTypes.map((fuel) => {
            const isChecked = selectedFuelTypes.includes(fuel);
            return (
              <label
                key={fuel}
                onClick={() => toggleFuelType(fuel)}
                className={`flex items-center justify-center space-x-1.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                  isChecked
                    ? 'bg-[#0066CC]/20 border-[#0066CC] text-white'
                    : 'bg-[#0b0f19]/60 border-[#1f293d] text-gray-400 hover:border-gray-600'
                }`}
              >
                {fuel === 'Electric' && <Zap className="w-3.5 h-3.5 text-amber-400" />}
                <span>{fuel}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 5. In-Stock Toggle */}
      <div className="pt-4 border-t border-[#1f293d]">
        <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl bg-[#0b0f19]/80 border border-[#1f293d]">
          <span className="text-xs font-semibold text-gray-200">Show only in-stock bikes</span>
          <input
            type="checkbox"
            checked={onlyInStock}
            onChange={(e) => setOnlyInStock(e.target.checked)}
            className="w-4 h-4 rounded accent-[#0066CC] cursor-pointer"
          />
        </label>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#1f293d] pb-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">TVS Bikes & Scooters</h1>
          <p className="text-gray-400 text-sm mt-1">Explore the complete TVS vehicle lineup available at Lahan Showroom.</p>
        </div>

        {/* Mobile Filter Toggle Button */}
        <button
          onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
          className="lg:hidden flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#0066CC] text-white text-sm font-bold shadow-lg"
        >
          <Filter className="w-4 h-4" />
          <span>Filter Bikes ({filteredBikes.length})</span>
        </button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Desktop Filter Sidebar */}
        <div className="hidden lg:block lg:col-span-4 glass-panel p-6 rounded-2xl sticky top-28">
          <FilterContent />
        </div>

        {/* Mobile Filter Drawer / Modal */}
        <AnimatePresence>
          {mobileFilterOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden flex justify-end"
            >
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-full max-w-xs h-full bg-[#0b0f19] border-l border-[#1f293d] p-6 overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-6 border-b border-[#1f293d] pb-4">
                  <span className="font-bold text-white text-lg">Filter Bikes</span>
                  <button onClick={() => setMobileFilterOpen(false)} className="p-2 text-gray-400 hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <FilterContent />
                <button
                  onClick={() => setMobileFilterOpen(false)}
                  className="w-full mt-6 py-3 bg-[#0066CC] text-white font-bold rounded-xl text-sm"
                >
                  View {filteredBikes.length} Bikes
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Section */}
        <div className="lg:col-span-8 space-y-6">
          {/* Results Count Header */}
          <div className="flex items-center justify-between text-sm bg-[#151c2c]/60 p-4 rounded-xl border border-[#1f293d]">
            <span className="text-gray-300 font-semibold">
              Showing <span className="text-[#0066CC] font-bold">{filteredBikes.length}</span> of {sampleBikes.length} bikes
            </span>

            {(selectedCategories.length > 0 || selectedFuelTypes.length > 0 || !anyCC || onlyInStock || minPrice > 200000 || maxPrice < 900000) && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-[#0066CC] hover:underline font-medium flex items-center space-x-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          {/* Bike Cards Grid */}
          {filteredBikes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {filteredBikes.map((bike) => (
                <motion.div
                  key={bike.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between group"
                >
                  <div>
                    <div className="relative h-52 overflow-hidden bg-[#0d1527]">
                      <img
                        src={bike.image}
                        alt={bike.name}
                        className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                      />
                      <div className="absolute top-3 left-3 bg-[#0066CC] text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                        {bike.tag}
                      </div>

                      {/* Stock Badge */}
                      <div className={`absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        bike.inStock ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'
                      }`}>
                        {bike.inStock ? 'In Stock' : 'Pre-order'}
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#0066CC] font-bold">{bike.category}</span>
                        <span className="text-gray-400">{bike.fuelType}</span>
                      </div>

                      <h3 className="text-xl font-bold text-white group-hover:text-[#0066CC] transition-colors line-clamp-1">
                        {bike.name}
                      </h3>

                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-300 bg-[#0b0f19]/60 p-2.5 rounded-lg border border-[#1f293d]">
                        <div>
                          <span className="text-gray-500 block text-[10px]">Engine</span>
                          <span className="font-semibold text-gray-200">{bike.engine}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 block text-[10px]">Mileage</span>
                          <span className="font-semibold text-gray-200">{bike.mileage}</span>
                        </div>
                      </div>

                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                        {bike.description}
                      </p>
                    </div>
                  </div>

                  <div className="p-5 pt-0 mt-2 border-t border-[#1f293d]/50 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-gray-400 block">Showroom Price</span>
                      <span className="text-lg font-black text-white">{bike.price}</span>
                    </div>
                    <Link
                      to={`/bikes/${bike.id}`}
                      className="px-4 py-2.5 rounded-xl btn-primary text-xs font-bold flex items-center space-x-1"
                    >
                      <span>Inquire</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            /* Friendly Empty State */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-12 rounded-3xl text-center space-y-4 border border-[#1f293d]"
            >
              <div className="bg-[#0066CC]/10 p-4 rounded-full w-fit mx-auto border border-[#0066CC]/30">
                <AlertCircle className="w-10 h-10 text-[#0066CC]" />
              </div>
              <h3 className="text-xl font-bold text-white">No bikes match your filters</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                Try adjusting your price range, clearing engine CC limits, or unchecking specific categories to explore more models.
              </p>
              <button
                onClick={handleClearFilters}
                className="mt-2 px-6 py-3 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold text-xs transition-all shadow-lg"
              >
                Clear All Filters
              </button>
            </motion.div>
          )}

        </div>

      </div>
    </div>
  );
}
