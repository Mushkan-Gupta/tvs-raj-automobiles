import React from 'react';
import { Wrench, Shield, Disc } from 'lucide-react';

/**
 * Neutral code-drawn placeholder for TVS parts when image_url is missing or fails to load.
 * No external images, no Unsplash, no hotlinks.
 * Adheres strictly to the showroom & workshop aesthetic: dark graphite with TVS blue accents.
 */
export default function PartImagePlaceholder({ category, name }) {
  const isGear = category?.toLowerCase().includes('helmet') || category?.toLowerCase().includes('gear');
  const isService = category?.toLowerCase().includes('oil') || category?.toLowerCase().includes('fluid') || category?.toLowerCase().includes('service');

  return (
    <div
      className="w-full h-full bg-[#111827] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none"
      aria-label={name ? `${name} placeholder image` : 'Part placeholder image'}
    >
      {/* Background mechanical blueprint motif */}
      <svg
        className="absolute inset-0 w-full h-full opacity-15 text-gray-500 pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 160 120"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        aria-hidden="true"
      >
        <circle cx="80" cy="60" r="46" strokeDasharray="4 4" />
        <circle cx="80" cy="60" r="30" />
        <line x1="80" y1="8" x2="80" y2="112" strokeDasharray="2 4" />
        <line x1="28" y1="60" x2="132" y2="60" strokeDasharray="2 4" />
        <circle cx="80" cy="60" r="8" fill="currentColor" fillOpacity="0.2" />
      </svg>

      {/* Category icon */}
      <div className="relative z-10 w-12 h-12 rounded-lg bg-[#151c2c] border border-[#1f293d] flex items-center justify-center text-gray-400">
        {isGear ? (
          <Shield className="w-6 h-6 text-[#0066CC]" />
        ) : isService ? (
          <Disc className="w-6 h-6 text-[#0066CC]" />
        ) : (
          <Wrench className="w-6 h-6 text-[#0066CC]" />
        )}
      </div>

      <div className="relative z-10 mt-2.5 text-center">
        <span className="block text-[11px] font-medium text-gray-400">
          Genuine TVS Part
        </span>
        <span className="block text-[10px] text-gray-400 mt-0.5">
          {category || 'Workshop Approved'}
        </span>
      </div>
    </div>
  );
}

