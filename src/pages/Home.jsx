import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Phone, MessageSquare, ChevronRight, Award, Wrench, ShieldCheck, Zap, ArrowRight, Star, Tag, CheckCircle2, Loader, AlertCircle } from 'lucide-react';
import { showroomInfo } from '../data/bikes';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const [featuredBikes, setFeaturedBikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        setLoading(true);
        // Fetch up to 4 bikes from Supabase for the featured section
        const { data, error: err } = await supabase.from('bikes').select('*').limit(4);
        
        if (err) throw err;
        
        const formatted = (data || []).map(bike => ({
          id: bike.id,
          name: bike.name,
          category: bike.category,
          engine: bike.specs?.engine || 'N/A',
          power: bike.specs?.power || 'N/A',
          price: bike.price ? `NPR ${bike.price.toLocaleString()}` : 'Price TBA',
          tag: bike.tag || 'Featured',
          image: bike.image_url || 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80',
          description: bike.description
        }));
        
        setFeaturedBikes(formatted);
      } catch (err) {
        console.error('Error fetching featured bikes:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchFeatured();
  }, []);

  const whyChooseUsPoints = [
    {
      icon: <Award className="w-8 h-8 text-[#0066CC]" />,
      title: "100% Authorized TVS Dealer",
      description: "Direct factory-authorized TVS showroom in Lahan offering genuine warranty and official vehicle registrations."
    },
    {
      icon: <Zap className="w-8 h-8 text-[#0066CC]" />,
      title: "Easy EMI & Low Finance",
      description: "Quick loan approvals with minimum documentation and lowest interest rates through partner finance institutions."
    },
    {
      icon: <Wrench className="w-8 h-8 text-[#0066CC]" />,
      title: "Expert Service & Spare Parts",
      description: "State-of-the-art service center equipped with modern diagnostic tools and 100% original TVS spare parts."
    },
    {
      icon: <ShieldCheck className="w-8 h-8 text-[#0066CC]" />,
      title: "Customer Trust & Satisfaction",
      description: "Thousands of happy riders across Siraha district with dedicated post-sales support and free servicing."
    }
  ];

  return (
    <div className="space-y-12 sm:space-y-16 pb-16">
      
      {/* 1. Hero Section with CSS animated gradient mesh & Framer Motion */}
      <section className="relative overflow-hidden hero-gradient-bg py-14 sm:py-20 lg:py-28 border-b border-[#1f293d]">
        {/* Glow Pulses */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] sm:w-[700px] h-[200px] sm:h-[350px] bg-[#0066CC]/20 blur-[90px] sm:blur-[130px] rounded-full pointer-events-none glow-pulse" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            <motion.div
              initial={{ opacity: 0, y: 35 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="lg:col-span-7 space-y-5 sm:space-y-7 text-center lg:text-left"
            >
              <div className="inline-flex items-center space-x-2 bg-[#151c2c]/80 backdrop-blur-md border border-[#0066CC]/40 px-3.5 py-1.5 rounded-full text-xs font-bold text-blue-400 shadow-lg shadow-[#0066CC]/10 max-w-full">
                <Star className="w-3.5 h-3.5 text-[#0066CC] fill-[#0066CC] shrink-0" />
                <span className="tracking-wide truncate">Premier Authorized TVS Showroom • Lahan, Siraha</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-7xl font-black text-white tracking-tight leading-[1.15]">
                Ride the Power of <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0066CC] via-blue-400 to-indigo-300">
                  TVS Engineering
                </span>
              </h1>

              <p className="text-sm sm:text-lg lg:text-xl text-gray-300 max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
                Discover Nepal's favorite TVS motorcycles and scooters at <strong>TVS Raj Automobiles</strong>. From track-honed racing machines to smart economic commuters, find your dream ride today.
              </p>

              {/* Call to Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
                <Link
                  to="/bikes"
                  className="w-full sm:w-auto min-h-[48px] px-8 py-3.5 rounded-xl btn-primary font-bold text-base flex items-center justify-center space-x-2 group"
                >
                  <span>View All Bikes</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  to="/contact"
                  className="w-full sm:w-auto min-h-[48px] px-8 py-3.5 rounded-xl btn-secondary font-semibold text-base flex items-center justify-center space-x-2"
                >
                  <span>Book Test Ride</span>
                </Link>
              </div>

              {/* Quick Key Highlights */}
              <div className="pt-6 sm:pt-8 grid grid-cols-3 gap-2 sm:gap-6 border-t border-[#1f293d]/80 text-center lg:text-left">
                <div>
                  <p className="text-xl sm:text-3xl font-black text-white">100%</p>
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Genuine TVS Parts</p>
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-black text-[#0066CC]">Low EMI</p>
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Easy Bike Loans</p>
                </div>
                <div>
                  <p className="text-xl sm:text-3xl font-black text-white">Instant</p>
                  <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Delivery in Siraha</p>
                </div>
              </div>

            </motion.div>

            {/* Hero Image Showcase */}
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
              className="lg:col-span-5 flex justify-center"
            >
              <div className="relative w-full max-w-md sm:max-w-lg rounded-3xl overflow-hidden glass-panel shadow-2xl p-2 group">
                <div className="relative rounded-2xl overflow-hidden h-72 sm:h-96">
                  <img
                    src="https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=1000&q=80"
                    alt="TVS Apache RTR Showroom"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-transparent to-transparent opacity-90" />
                  <div className="absolute bottom-4 left-4 right-4 p-4 rounded-xl glass-panel">
                    <span className="text-[10px] bg-[#0066CC] text-white font-bold px-2 py-0.5 rounded tracking-wider uppercase">
                      Best Seller
                    </span>
                    <h3 className="text-lg sm:text-xl font-bold text-white mt-1">TVS Apache RTR 160 4V</h3>
                    <p className="text-xs text-gray-300">SmartXonnect & Race-Tuned EFI</p>
                  </div>
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* 2. Featured Bikes Section */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-24"
        id="featured-bikes"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 sm:mb-10">
          <div>
            <div className="inline-flex items-center space-x-2 text-xs font-bold text-[#0066CC] uppercase tracking-wider mb-2">
              <Tag className="w-3.5 h-3.5" />
              <span>Showroom Highlights</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">Featured TVS Models</h2>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">Explore our most popular motorcycles and scooters in Lahan.</p>
          </div>
          <Link
            to="/bikes"
            className="mt-4 md:mt-0 flex items-center space-x-2 text-xs sm:text-sm font-bold text-[#0066CC] hover:text-blue-400 transition-colors group"
          >
            <span>Explore All Bikes & Filters</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Grid of Featured Bikes */}
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 glass-card rounded-2xl border border-[#1f293d]">
            <Loader className="w-8 h-8 text-[#0066CC] animate-spin mb-4" />
            <h3 className="text-lg font-bold text-white">Loading featured bikes...</h3>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-12 glass-card rounded-2xl border border-red-500/30 bg-red-500/5">
            <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
            <h3 className="text-lg font-bold text-white">Could not load live data</h3>
            <p className="text-sm text-gray-400 mt-2">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredBikes.map((bike, index) => (
            <motion.div
              key={bike.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-card rounded-2xl overflow-hidden flex flex-col justify-between group"
            >
              <div>
                <div className="relative h-48 sm:h-52 overflow-hidden bg-[#0d1527]">
                  <img
                    src={bike.image}
                    alt={bike.name}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3 bg-[#0066CC] text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                    {bike.tag}
                  </div>
                </div>

                <div className="p-4 sm:p-5 space-y-3">
                  <div className="text-xs text-[#0066CC] font-bold tracking-wide">{bike.category}</div>
                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-[#0066CC] transition-colors line-clamp-1">
                    {bike.name}
                  </h3>

                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-300 bg-[#0b0f19]/60 p-2.5 rounded-lg border border-[#1f293d]">
                    <div>
                      <span className="text-gray-500 block text-[10px]">Engine</span>
                      <span className="font-semibold text-gray-200 truncate block">{bike.engine}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block text-[10px]">Power</span>
                      <span className="font-semibold text-gray-200 truncate block">{bike.power}</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                    {bike.description}
                  </p>
                </div>
              </div>

              <div className="p-4 sm:p-5 pt-0 mt-2 border-t border-[#1f293d]/50 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 block">Ex-Showroom Price</span>
                  <span className="text-sm sm:text-base font-extrabold text-white">{bike.price}</span>
                </div>
                <Link
                  to={`/bikes/${bike.id}`}
                  className="px-3.5 py-2 rounded-lg btn-primary text-xs font-semibold min-h-[36px] flex items-center"
                >
                  View Specs
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
        )}
      </motion.section>

      {/* 3. Why Choose Us Section */}
      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6 }}
        className="bg-[#0e1422]/90 py-14 sm:py-16 border-y border-[#1f293d]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">Why Choose TVS Raj Automobiles?</h2>
            <p className="text-gray-400 text-xs sm:text-sm mt-2">
              We deliver the best showroom experience, authentic TVS engineering, and lifetime customer satisfaction in Siraha.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {whyChooseUsPoints.map((point, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-card p-5 sm:p-6 rounded-2xl space-y-4"
              >
                <div className="bg-[#0b0f19] p-4 rounded-xl w-fit border border-[#1f293d] shadow-inner">
                  {point.icon}
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white">{point.title}</h3>
                <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{point.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 4. Contact Section with Call and WhatsApp buttons */}
      <motion.section
        initial={{ opacity: 0, scale: 0.96 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="bg-gradient-to-r from-[#0066CC] via-[#004C99] to-[#0b1326] rounded-3xl p-6 sm:p-14 text-white relative overflow-hidden shadow-2xl border border-[#0066CC]/40">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-7 space-y-4 text-center lg:text-left">
              <span className="bg-white/10 text-white text-xs font-bold px-3.5 py-1 rounded-full uppercase tracking-wider border border-white/20 inline-block">
                Ready to Upgrade Your Ride?
              </span>
              <h2 className="text-2xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Visit TVS Raj Automobiles Today
              </h2>
              <p className="text-blue-100 text-xs sm:text-base leading-relaxed max-w-xl mx-auto lg:mx-0">
                Get instant price quotes, book your free test ride, or inquire about low EMI finance schemes.
              </p>
              <div className="flex items-center justify-center lg:justify-start space-x-2 text-xs text-blue-200 pt-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">Showroom Location: {showroomInfo.address}</span>
              </div>
            </div>

            {/* Quick Action Contact Buttons */}
            <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col gap-4">
              <a
                href="tel:+9779819789215"
                className="flex items-center justify-center space-x-3 px-6 py-4 rounded-xl bg-white text-[#0066CC] font-bold text-sm sm:text-base hover:bg-gray-100 transition-all hover:scale-102 shadow-lg min-h-[48px]"
              >
                <Phone className="w-5 h-5 text-[#0066CC]" />
                <span>Call Us: +977 9819789215</span>
              </a>

              <a
                href="https://wa.me/9779819789215"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-3 px-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm sm:text-base transition-all hover:scale-102 shadow-lg min-h-[48px]"
              >
                <MessageSquare className="w-5 h-5" />
                <span>Chat on WhatsApp (+977 9819789215)</span>
              </a>
            </div>

          </div>
        </div>
      </motion.section>

    </div>
  );
}
