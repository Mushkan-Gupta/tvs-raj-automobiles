import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Bike, Phone, MessageSquare } from 'lucide-react';
import { showroomInfo } from '../data/bikes';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Bikes', path: '/bikes' },
    { name: 'Offers', path: '/offers' },
    { name: 'Finance', path: '/finance' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' }
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0b0f19]/90 backdrop-blur-md border-b border-[#1f293d]">
      {/* Top micro bar */}
      <div className="bg-[#111827] text-xs py-1.5 px-4 text-gray-400 border-b border-[#1f293d]/50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <span>📍 {showroomInfo.address}</span>
            <span className="hidden md:inline">🕒 {showroomInfo.openingHours}</span>
          </div>
          <div className="flex items-center space-x-3">
            <a href={`tel:${showroomInfo.phonePlaceholder}`} className="hover:text-white flex items-center space-x-1 transition-colors">
              <Phone className="w-3 h-3 text-[#0066CC]" />
              <span>{showroomInfo.phonePlaceholder}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo / Brand */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-gradient-to-br from-[#0066CC] to-[#004080] p-2.5 rounded-xl shadow-lg shadow-[#0066CC]/20 group-hover:scale-105 transition-transform">
              <Bike className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-xl font-black tracking-tight text-white uppercase">TVS RAJ</span>
                <span className="bg-[#0066CC] text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-widest uppercase">Lahan</span>
              </div>
              <p className="text-xs text-gray-400 font-medium">AUTOMOBILES</p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[#0066CC] text-white shadow-md shadow-[#0066CC]/30 font-semibold'
                      : 'text-gray-300 hover:text-white hover:bg-[#151c2c]'
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center space-x-3">
            <a
              href={`https://wa.me/${showroomInfo.whatsappPlaceholder.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-4 py-2 rounded-lg border border-[#0066CC]/40 bg-[#0066CC]/10 text-white text-sm font-medium hover:bg-[#0066CC] transition-all"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>WhatsApp</span>
            </a>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 rounded-lg bg-[#151c2c] text-gray-300 hover:text-white focus:outline-none border border-[#1f293d]"
              aria-label="Toggle navigation menu"
            >
              {isOpen ? <X className="w-6 h-6 text-[#0066CC]" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isOpen && (
        <div className="md:hidden bg-[#0b0f19] border-b border-[#1f293d] px-4 pt-2 pb-6 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-2.5 rounded-lg text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-[#0066CC] text-white font-semibold'
                    : 'text-gray-300 hover:bg-[#151c2c] hover:text-white'
                }`
              }
            >
              {item.name}
            </NavLink>
          ))}
          <div className="pt-4 border-t border-[#1f293d] flex flex-col space-y-2">
            <a
              href={`tel:${showroomInfo.phonePlaceholder}`}
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-[#151c2c] text-white text-sm font-medium"
            >
              <Phone className="w-4 h-4 text-[#0066CC]" />
              <span>Call Showroom</span>
            </a>
            <a
              href={`https://wa.me/${showroomInfo.whatsappPlaceholder.replace(/[^0-9]/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-lg bg-[#0066CC] text-white text-sm font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
