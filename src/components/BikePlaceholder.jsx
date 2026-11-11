import React from 'react';

/**
 * Neutral code-drawn recolourable motorcycle placeholder.
 * Used when a bike or color variant lacks a real image.
 * No external images, no Unsplash or hotlinked photos.
 * The primary bodywork/fairing dynamically reflects the selected color hex.
 */
export default function BikePlaceholder({ color = '#0066CC', name = 'TVS Motorcycle' }) {
  const accentColor = color || '#0066CC';

  return (
    <div
      className="w-full h-full aspect-[16/9] bg-[#111827] flex flex-col items-center justify-between p-4 sm:p-6 relative overflow-hidden select-none"
      role="img"
      aria-label={`${name} in ${accentColor}`}
    >
      {/* Studio Floor Line / Blueprint Grid */}
      <svg
        className="absolute inset-0 w-full h-full opacity-10 pointer-events-none text-gray-500"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 800 500"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <line x1="0" y1="420" x2="800" y2="420" stroke="currentColor" strokeWidth="2" />
        <line x1="0" y1="440" x2="800" y2="440" stroke="currentColor" strokeWidth="1" strokeDasharray="8 8" />
        <circle cx="400" cy="250" r="220" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" />
        <circle cx="400" cy="250" r="140" stroke="currentColor" strokeWidth="1" strokeDasharray="4 6" />
      </svg>

      {/* Top watermark / label */}
      <div className="relative z-10 w-full flex items-center justify-between text-xs text-gray-500 font-medium">
        <span className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full border border-white/20"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          />
          <span className="text-gray-400">TVS Visualizer</span>
        </span>
        <span className="text-[11px] text-gray-500">Lahan Showroom</span>
      </div>

      {/* Center Motorcycle SVG Illustration */}
      <div className="relative z-10 w-full max-w-xl flex-1 flex items-center justify-center py-4">
        <svg
          viewBox="0 0 600 360"
          className="w-full h-auto max-h-[320px]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
        >
          {/* Ground Contact Shadow */}
          <ellipse cx="140" cy="305" rx="75" ry="10" fill="#000000" fillOpacity="0.5" />
          <ellipse cx="460" cy="305" rx="75" ry="10" fill="#000000" fillOpacity="0.5" />
          <ellipse cx="300" cy="310" rx="190" ry="8" fill="#000000" fillOpacity="0.3" />

          {/* REAR WHEEL */}
          <g id="rear-wheel">
            {/* Outer Tire */}
            <circle cx="140" cy="235" r="68" stroke="#1c2433" strokeWidth="16" />
            <circle cx="140" cy="235" r="64" stroke="#0e1420" strokeWidth="4" />
            {/* Rim */}
            <circle cx="140" cy="235" r="54" stroke="#334155" strokeWidth="4" />
            {/* Brake Disc & Spokes */}
            <circle cx="140" cy="235" r="34" stroke="#64748b" strokeWidth="2" strokeDasharray="4 4" />
            <circle cx="140" cy="235" r="16" fill="#1e293b" stroke="#475569" strokeWidth="3" />
            <line x1="140" y1="181" x2="140" y2="289" stroke="#475569" strokeWidth="2" />
            <line x1="86" y1="235" x2="194" y2="235" stroke="#475569" strokeWidth="2" />
            <line x1="102" y1="197" x2="178" y2="273" stroke="#475569" strokeWidth="2" />
            <line x1="102" y1="273" x2="178" y2="197" stroke="#475569" strokeWidth="2" />
          </g>

          {/* FRONT WHEEL */}
          <g id="front-wheel">
            {/* Outer Tire */}
            <circle cx="460" cy="235" r="68" stroke="#1c2433" strokeWidth="16" />
            <circle cx="460" cy="235" r="64" stroke="#0e1420" strokeWidth="4" />
            {/* Rim */}
            <circle cx="460" cy="235" r="54" stroke="#334155" strokeWidth="4" />
            {/* Brake Disc & Spokes */}
            <circle cx="460" cy="235" r="38" stroke="#64748b" strokeWidth="2" strokeDasharray="5 5" />
            <circle cx="460" cy="235" r="16" fill="#1e293b" stroke="#475569" strokeWidth="3" />
            <line x1="460" y1="181" x2="460" y2="289" stroke="#475569" strokeWidth="2" />
            <line x1="406" y1="235" x2="514" y2="235" stroke="#475569" strokeWidth="2" />
            <line x1="422" y1="197" x2="498" y2="273" stroke="#475569" strokeWidth="2" />
            <line x1="422" y1="273" x2="498" y2="197" stroke="#475569" strokeWidth="2" />
          </g>

          {/* SWINGARM & EXHAUST */}
          <g id="swingarm-exhaust">
            {/* Swingarm */}
            <polygon points="140,235 260,225 255,245 140,242" fill="#334155" />
            {/* Mono-shock spring */}
            <line x1="240" y1="225" x2="265" y2="185" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" />
            <line x1="240" y1="225" x2="265" y2="185" stroke="#ef4444" strokeWidth="4" strokeDasharray="3 3" />
            {/* Exhaust Canister */}
            <path
              d="M 230,265 L 350,265 L 340,240 L 220,245 Z"
              fill="#1e293b"
              stroke="#475569"
              strokeWidth="2"
            />
            {/* Exhaust Pipe */}
            <path
              d="M 340,240 L 375,200"
              stroke="#64748b"
              strokeWidth="10"
              strokeLinecap="round"
            />
          </g>

          {/* CHASSIS & ENGINE BLOCK */}
          <g id="engine-frame">
            {/* Main Diamond Frame */}
            <polygon points="260,225 410,140 400,125 250,175" fill="#1e293b" stroke="#334155" strokeWidth="2" />
            {/* Engine Core */}
            <rect x="250" y="190" width="115" height="75" rx="10" fill="#0f172a" stroke="#334155" strokeWidth="3" />
            {/* Cooling Fins */}
            <line x1="260" y1="205" x2="355" y2="205" stroke="#475569" strokeWidth="3" />
            <line x1="260" y1="218" x2="355" y2="218" stroke="#475569" strokeWidth="3" />
            <line x1="260" y1="231" x2="355" y2="231" stroke="#475569" strokeWidth="3" />
            <line x1="260" y1="244" x2="355" y2="244" stroke="#475569" strokeWidth="3" />
            <circle cx="310" cy="225" r="14" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
          </g>

          {/* FRONT SUSPENSION / FORK */}
          <g id="front-fork">
            <line x1="460" y1="235" x2="415" y2="105" stroke="#94a3b8" strokeWidth="8" strokeLinecap="round" />
            <line x1="452" y1="235" x2="407" y2="105" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
            {/* Front Mudguard (recoloured) */}
            <path
              d="M 405,185 Q 450,165 495,190 Q 455,150 405,185 Z"
              fill={accentColor}
            />
          </g>

          {/* BODYWORK & FAIRINGS (Dynamically Recoloured) */}
          <g id="colored-bodywork">
            {/* Fuel Tank */}
            <path
              d="M 300,165 Q 320,120 380,120 Q 420,125 415,150 Q 360,185 300,165 Z"
              fill={accentColor}
              stroke="#ffffff"
              strokeWidth="1"
              strokeOpacity="0.2"
            />
            {/* Tank Shadow / Knee Recess */}
            <path
              d="M 330,155 Q 360,135 395,140 Q 370,170 330,155 Z"
              fill="#000000"
              fillOpacity="0.25"
            />
            {/* Rear Tail Cowl */}
            <polygon
              points="155,165 255,175 245,195 180,190"
              fill={accentColor}
            />
            {/* Underbelly Pan / Cowl */}
            <path
              d="M 270,270 L 375,270 L 390,250 L 300,250 Z"
              fill={accentColor}
            />
            {/* Front Headlamp Mask / Fairing */}
            <path
              d="M 415,105 L 450,110 L 460,135 L 430,140 Z"
              fill={accentColor}
            />
          </g>

          {/* SEAT & HANDLEBAR */}
          <g id="seat-controls">
            {/* Rider & Pillion Seat */}
            <path
              d="M 180,165 Q 240,165 260,165 Q 295,160 310,180 Q 250,185 180,165 Z"
              fill="#18181b"
              stroke="#27272a"
              strokeWidth="2"
            />
            {/* Handlebars */}
            <path d="M 410,105 L 395,85 L 420,85" stroke="#cbd5e1" strokeWidth="4" strokeLinecap="round" />
            <circle cx="420" cy="85" r="5" fill="#0f172a" />
            {/* Mirror */}
            <line x1="400" y1="85" x2="385" y2="65" stroke="#64748b" strokeWidth="3" />
            <ellipse cx="380" cy="62" rx="10" ry="6" fill="#1e293b" stroke="#94a3b8" strokeWidth="1.5" />
            {/* Headlamp Beam / Glass */}
            <polygon points="450,115 462,125 455,135" fill="#f8fafc" fillOpacity="0.8" />
          </g>
        </svg>
      </div>

      {/* Bottom text pill */}
      <div className="relative z-10 w-full text-center">
        <p className="text-sm font-semibold text-white truncate">{name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Official TVS Showroom Specification
        </p>
      </div>
    </div>
  );
}
