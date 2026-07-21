import React from 'react';
import { Tag, Calendar, Gift, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Offers() {
  const offersList = [
    {
      title: "Dashain Tihar Mega Cashback Offer",
      validity: "Limited Period Festive Offer",
      details: "Get up to NPR 10,000 cash discount on TVS Apache series and free helmet with every purchase.",
      badge: "Festive Special"
    },
    {
      title: "Zero Percent Down Payment Scheme",
      validity: "Valid for All Models",
      details: "Drive home your favorite TVS Raider or NTORQ with easy flexible financing options.",
      badge: "Easy EMI"
    },
    {
      title: "Exchange Bonus on Any Old Two-Wheeler",
      validity: "Ongoing Showroom Offer",
      details: "Bring any old bike or scooter and get up to NPR 7,000 additional exchange valuation bonus.",
      badge: "Exchange Deal"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div className="border-b border-[#1f293d] pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Latest TVS Offers & Deals</h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">Exclusive showroom discounts, festival schemes, and exchange bonuses in Lahan.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {offersList.map((offer, idx) => (
          <div key={idx} className="bg-[#151c2c] p-5 sm:p-6 rounded-2xl border border-[#1f293d] space-y-3.5 flex flex-col justify-between">
            <div className="space-y-3">
              <span className="bg-[#0066CC] text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                {offer.badge}
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white pt-1">{offer.title}</h2>
              <div className="flex items-center space-x-2 text-xs text-gray-400">
                <Calendar className="w-3.5 h-3.5 text-[#0066CC]" />
                <span>{offer.validity}</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{offer.details}</p>
            </div>
            <Link to="/contact" className="inline-flex items-center justify-between text-xs font-bold text-[#0066CC] hover:text-blue-400 pt-3.5 border-t border-[#1f293d]">
              <span>Claim Offer at Showroom</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
