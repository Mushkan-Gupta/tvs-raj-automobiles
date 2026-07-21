import React from 'react';
import { showroomInfo } from '../data/bikes';
import { Award, ShieldCheck, Users, Wrench } from 'lucide-react';

export default function About() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div className="border-b border-[#1f293d] pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">About TVS Raj Automobiles</h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">Your trusted authorized TVS dealership in Lahan, Siraha.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-3.5 text-gray-300 text-sm leading-relaxed">
          <p>
            Welcome to <strong>TVS Raj Automobiles</strong>, the premier authorized 3S (Sales, Service, and Spare Parts) dealership of TVS Motor Company located at Hospital Chowk, Lahan-1, Siraha.
          </p>
          <p>
            We take pride in bringing TVS's world-class racing technology, innovation, and durability to riders across Siraha and surrounding regions. Whether you're looking for performance bikes like the Apache RTR series, stylish commuters like the Raider 125, or versatile scooters like the NTORQ 125, we offer the complete range with genuine factory warranty.
          </p>
          <p>
            Our facility includes a modern showroom floor and an advanced service center managed by factory-trained technicians to guarantee top performance for your vehicle.
          </p>
        </div>

        <div className="lg:col-span-5 grid grid-cols-2 gap-4">
          <div className="bg-[#151c2c] p-4 sm:p-5 rounded-2xl border border-[#1f293d] text-center space-y-2">
            <Award className="w-7 h-7 text-[#0066CC] mx-auto" />
            <h3 className="font-bold text-white text-sm sm:text-base">Authorized 3S</h3>
            <p className="text-xs text-gray-400">Sales, Service & Spares</p>
          </div>
          <div className="bg-[#151c2c] p-4 sm:p-5 rounded-2xl border border-[#1f293d] text-center space-y-2">
            <Users className="w-7 h-7 text-[#0066CC] mx-auto" />
            <h3 className="font-bold text-white text-sm sm:text-base">5,000+</h3>
            <p className="text-xs text-gray-400">Happy Customers</p>
          </div>
          <div className="bg-[#151c2c] p-4 sm:p-5 rounded-2xl border border-[#1f293d] text-center space-y-2">
            <Wrench className="w-7 h-7 text-[#0066CC] mx-auto" />
            <h3 className="font-bold text-white text-sm sm:text-base">Certified</h3>
            <p className="text-xs text-gray-400">Mechanics & Tools</p>
          </div>
          <div className="bg-[#151c2c] p-4 sm:p-5 rounded-2xl border border-[#1f293d] text-center space-y-2">
            <ShieldCheck className="w-7 h-7 text-[#0066CC] mx-auto" />
            <h3 className="font-bold text-white text-sm sm:text-base">100% Genuine</h3>
            <p className="text-xs text-gray-400">Original TVS Parts</p>
          </div>
        </div>
      </div>
    </div>
  );
}
