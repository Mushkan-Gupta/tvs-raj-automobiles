import React from 'react';
import { Calculator, CheckCircle2, FileText, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Finance() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="border-b border-[#1f293d] pb-6">
        <h1 className="text-3xl font-extrabold text-white">TVS Bike Finance & Easy EMI</h1>
        <p className="text-gray-400 text-sm mt-1">Affordable monthly installments with quick approval at TVS Raj Automobiles, Lahan.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-[#151c2c] p-8 rounded-2xl border border-[#1f293d] space-y-6">
          <div className="flex items-center space-x-3">
            <Landmark className="w-8 h-8 text-[#0066CC]" />
            <h2 className="text-2xl font-bold text-white">Our Finance Partners</h2>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            We partner with leading banks, financial institutions, and TVS Credit to ensure seamless loan processing, minimal down payment options, and low interest rates for buyers across Siraha district.
          </p>

          <div className="space-y-4 pt-4 border-t border-[#1f293d]">
            <h3 className="font-bold text-white text-base">Required Documents for Finance</h3>
            <ul className="space-y-3 text-sm text-gray-300">
              {['Nepali Citizenship Card (Original & Photocopy)', 'Recent Passport Size Photographs (2 copies)', 'Proof of Income / Salary Certificate or Bank Statement', 'Guarantor Citizenship & Photo'].map((doc, idx) => (
                <li key={idx} className="flex items-start space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-[#0066CC] shrink-0 mt-0.5" />
                  <span>{doc}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#151c2c] p-8 rounded-2xl border border-[#1f293d] space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Calculator className="w-7 h-7 text-[#0066CC]" />
              <h2 className="text-xl font-bold text-white">Quick EMI Assistance</h2>
            </div>
            <p className="text-sm text-gray-300">
              Want to calculate your exact monthly EMI and down payment for TVS Apache, Raider, or NTORQ? Visit our showroom or speak with our finance specialist.
            </p>
          </div>

          <div className="space-y-3 pt-6 border-t border-[#1f293d]">
            <Link to="/contact" className="block w-full py-3.5 bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold text-center rounded-xl text-sm">
              Apply for Bike Loan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
