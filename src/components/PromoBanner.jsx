import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Tag, ShieldCheck, Gift } from 'lucide-react';

const DEFAULT_PROMO_CONFIG = {
  badge: "LIMITED OFFER",
  headline: "Festive Season Mega Sale",
  subtext: "Get up to NPR 15,000 off + free helmet on all TVS models this month",
  ctaText: "Claim Offer Now",
  ctaLink: "/offers",
  image: "https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1000&q=80"
};

export default function PromoBanner({ config = DEFAULT_PROMO_CONFIG }) {
  const { badge, headline, subtext, ctaText, ctaLink, image } = {
    ...DEFAULT_PROMO_CONFIG,
    ...config
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-12 sm:my-16">
      <motion.div
        initial={{ opacity: 0, y: 35 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative rounded-3xl overflow-hidden shadow-2xl border border-[#0066CC]/40 bg-gradient-to-br from-[#0c1427] via-[#0b0f19] to-[#151d33] group"
      >
        {/* Animated Ambient Glow Circles */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-[#0066CC]/25 rounded-full blur-[100px] pointer-events-none animate-pulse" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-[#E31837]/20 rounded-full blur-[100px] pointer-events-none animate-pulse" />

        {/* Shimmer Light Sweep Effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out pointer-events-none z-10" />

        {/* Corner Ribbon Badge */}
        <div className="absolute top-5 left-5 z-20">
          <div className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-[#E31837] to-rose-600 text-white text-[11px] font-extrabold px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-lg shadow-rose-900/40 border border-rose-400/30">
            <Tag className="w-3.5 h-3.5" />
            <span>{badge}</span>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center p-6 sm:p-10 lg:p-14">
          {/* Left Text & CTA Content Column */}
          <div className="lg:col-span-7 space-y-5 pt-8 lg:pt-0 text-center lg:text-left">
            
            <div className="inline-flex items-center space-x-2 text-xs font-bold text-blue-400 uppercase tracking-wider bg-[#0066CC]/15 px-3 py-1 rounded-lg border border-[#0066CC]/30">
              <Sparkles className="w-3.5 h-3.5 text-[#0066CC]" />
              <span>Exclusive TVS Showroom Deal</span>
            </div>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1]">
              {headline.split(' ').map((word, i) => (
                <React.Fragment key={i}>
                  {i === 1 ? (
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0066CC] via-blue-400 to-indigo-300">
                      {word}{' '}
                    </span>
                  ) : (
                    word + ' '
                  )}
                </React.Fragment>
              ))}
            </h2>

            <p className="text-sm sm:text-lg text-gray-200 font-normal leading-relaxed max-w-xl mx-auto lg:mx-0">
              {subtext}
            </p>

            {/* Feature Highlights Badges */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2 text-xs font-semibold text-gray-300">
              <div className="flex items-center space-x-1.5 bg-[#0b0f19]/70 px-3 py-1.5 rounded-lg border border-[#1f293d]">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>5-Year Official TVS Warranty</span>
              </div>
              <div className="flex items-center space-x-1.5 bg-[#0b0f19]/70 px-3 py-1.5 rounded-lg border border-[#1f293d]">
                <Gift className="w-4 h-4 text-amber-400" />
                <span>Free Service Vouchers</span>
              </div>
            </div>

            {/* Pulsing CTA Button */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link
                to={ctaLink}
                className="w-full sm:w-auto min-h-[52px] px-8 py-4 rounded-xl btn-primary font-black text-base flex items-center justify-center space-x-3 shadow-xl shadow-[#0066CC]/40 relative overflow-hidden group/btn border border-blue-400/40"
              >
                <span className="relative z-10">{ctaText}</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover/btn:translate-x-1.5 transition-transform" />
              </Link>

              <span className="text-xs text-gray-400 font-medium">
                * Offer valid until stock lasts at Lahan showroom
              </span>
            </div>
          </div>

          {/* Right Showcase Image Column */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-md lg:max-w-none rounded-2xl overflow-hidden border border-[#0066CC]/30 shadow-2xl group/img">
              <img
                src={image}
                alt={headline}
                className="w-full h-64 sm:h-80 lg:h-96 object-cover group-hover/img:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c1427] via-transparent to-transparent opacity-80" />
              
              <div className="absolute bottom-4 left-4 right-4 p-3.5 rounded-xl glass-panel text-center sm:text-left">
                <p className="text-xs font-bold text-white">TVS Apache RTR & Scooter Range</p>
                <p className="text-[11px] text-blue-300">Available immediately in Siraha district</p>
              </div>
            </div>
          </div>

        </div>
      </motion.div>
    </section>
  );
}
