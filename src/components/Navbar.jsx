import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, Bike, Phone, MessageSquare, Lock } from 'lucide-react';

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
    <header className="sticky top-0 z-50 bg-[#0b0f19]/95 backdrop-blur-md border-b border-[#1f293d]">
      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo / Brand */}
          <Link to="/" className="flex items-center space-x-3 group">
            <div className="bg-gradient-to-br from-[#0066CC] to-[#004080] p-2.5 rounded-xl shadow-lg shadow-[#0066CC]/20 group-hover:scale-105 transition-transform">
              <Bike className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-lg sm:text-xl font-black tracking-tight text-white uppercase">TVS RAJ</span>
                <span className="bg-[#0066CC] text-white text-[10px] font-bold px-1.5 py-0.5 rounded tracking-widest uppercase">Lahan</span>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-400 font-medium tracking-wider">AUTOMOBILES</p>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
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

          {/* Right Actions: WhatsApp CTA + subtle Staff Login */}
          <div className="hidden md:flex items-center space-x-3">
            <a
              href="https://wa.me/9779819789215"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center space-x-2 px-4 py-2 rounded-lg border border-[#0066CC]/40 bg-[#0066CC]/10 text-white text-sm font-medium hover:bg-[#0066CC] transition-all min-h-[40px]"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>WhatsApp</span>
            </a>

            <Link
              to="/admin-login"
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-[#151c2c] border border-[#1f293d]/70 hover:border-[#0066CC]/40 transition-all"
              title="Staff & Admin Portal"
            >
              <Lock className="w-3.5 h-3.5 text-gray-400" />
              <span>Staff Login</span>
            </Link>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-2.5 rounded-lg bg-[#151c2c] text-gray-300 hover:text-white focus:outline-none border border-[#1f293d] min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                `block px-4 py-3 rounded-lg text-base font-medium transition-colors min-h-[44px] ${
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
              href="tel:+9779819789215"
              className="flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-[#151c2c] text-white text-sm font-medium min-h-[44px]"
            >
              <Phone className="w-4 h-4 text-[#0066CC]" />
              <span>Call (+977 9819789215)</span>
            </a>
            <a
              href="https://wa.me/9779819789215"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium min-h-[44px]"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Chat on WhatsApp (+977 9819789215)</span>
            </a>
            <Link
              to="/admin-login"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center space-x-1.5 py-2.5 text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-[#151c2c] rounded-lg border border-[#1f293d] transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-gray-400" />
              <span>Staff Login</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
