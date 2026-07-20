import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { sampleBikes } from '../data/bikes';
import { ArrowLeft, CheckCircle2, Phone } from 'lucide-react';

export default function BikeDetail() {
  const { id } = useParams();
  const bike = sampleBikes.find(b => b.id === id) || sampleBikes[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <Link to="/bikes" className="inline-flex items-center space-x-2 text-sm text-[#0066CC] hover:underline">
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Bikes</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7 bg-[#151c2c] rounded-2xl overflow-hidden border border-[#1f293d]">
          <img src={bike.image} alt={bike.name} className="w-full h-96 object-cover" />
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div>
            <span className="text-xs text-[#0066CC] font-bold uppercase tracking-wider">{bike.category}</span>
            <h1 className="text-3xl font-extrabold text-white">{bike.name}</h1>
            <p className="text-2xl font-bold text-[#0066CC] mt-2">{bike.price}</p>
          </div>

          <p className="text-gray-300 text-sm">{bike.description}</p>

          <div className="space-y-3 pt-4 border-t border-[#1f293d]">
            <h3 className="font-bold text-white text-sm">Key Specifications</h3>
            <ul className="space-y-2 text-xs text-gray-300">
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#0066CC]" />
                <span>Engine: {bike.engine}</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#0066CC]" />
                <span>Max Power: {bike.power}</span>
              </li>
              <li className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#0066CC]" />
                <span>Mileage: {bike.mileage}</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 space-y-3">
            <Link to="/contact" className="block w-full py-3.5 bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold text-center rounded-xl text-sm">
              Inquire at Lahan Showroom
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
