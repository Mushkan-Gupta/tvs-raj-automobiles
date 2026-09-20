import React from 'react';
import { Link } from 'react-router-dom';
import { Bike, MapPin, Phone, Mail, Clock, ShieldCheck, ChevronRight, Lock } from 'lucide-react';
import { showroomInfo } from '../data/bikes';

export default function Footer() {
  return (
    <footer className="bg-[#070a12] text-gray-400 border-t border-[#1f293d] pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          
          {/* Column 1: Showroom Info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="bg-[#0066CC] p-2 rounded-lg">
                <Bike className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">TVS RAJ AUTOMOBILES</span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Authorized TVS Motorcycle & Scooter Dealer in Lahan, Siraha. We deliver premium TVS bikes with complete sales, genuine spare parts, and expert servicing.
            </p>
            <div className="inline-flex items-center space-x-2 bg-[#151c2c] px-3 py-1.5 rounded-full border border-[#1f293d] text-xs text-blue-400">
              <ShieldCheck className="w-4 h-4 text-[#0066CC]" />
              <span>100% Authorized TVS Showroom</span>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h3 className="text-white text-base font-semibold mb-4 pb-2 border-b border-[#1f293d] inline-block">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: 'All TVS Bikes', path: '/bikes' },
                { label: 'Latest Offers', path: '/offers' },
                { label: 'Finance & EMI Calculator', path: '/finance' },
                { label: 'About Our Showroom', path: '/about' },
                { label: 'Book a Test Ride', path: '/contact' },
                { label: 'Service & Spare Parts', path: '/contact' }
              ].map((link, index) => (
                <li key={index}>
                  <Link
                    to={link.path}
                    className="hover:text-[#0066CC] flex items-center space-x-1.5 transition-colors group"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#0066CC] transition-colors" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: TVS Models */}
          <div>
            <h3 className="text-white text-base font-semibold mb-4 pb-2 border-b border-[#1f293d] inline-block">
              Popular Models
            </h3>
            <ul className="space-y-2 text-sm">
              {['Apache RTR 160 4V', 'Apache RTR 200 4V', 'Apache RR 310', 'TVS Raider 125', 'TVS Ronin', 'TVS NTORQ 125', 'TVS Jupiter', 'TVS iQube'].map((model, index) => (
                <li key={index}>
                  <Link to="/bikes" className="hover:text-[#0066CC] flex items-center space-x-1.5 transition-colors group">
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 group-hover:text-[#0066CC] transition-colors" />
                    <span>{model}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact Info */}
          <div>
            <h3 className="text-white text-base font-semibold mb-4 pb-2 border-b border-[#1f293d] inline-block">
              Contact & Location
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-[#0066CC] shrink-0 mt-0.5" />
                <span>{showroomInfo.address}</span>
              </li>
              <li className="flex items-center space-x-3">
                <Phone className="w-4 h-4 text-[#0066CC] shrink-0" />
                <a href="tel:+9779819789215" className="hover:text-white transition-colors">
                  +977 9819789215
                </a>
              </li>
              <li className="flex items-center space-x-3">
                <Mail className="w-4 h-4 text-[#0066CC] shrink-0" />
                <a href={`mailto:${showroomInfo.emailPlaceholder}`} className="hover:text-white transition-colors">
                  {showroomInfo.emailPlaceholder}
                </a>
              </li>
              <li className="flex items-start space-x-3 text-xs text-gray-400">
                <Clock className="w-4 h-4 text-[#0066CC] shrink-0 mt-0.5" />
                <span>{showroomInfo.openingHours}</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright section */}
        <div className="pt-8 border-t border-[#1f293d] flex flex-col sm:flex-row justify-between items-center text-xs text-gray-500 space-y-4 sm:space-y-0">
          <p>© {new Date().toLocaleDateString('en-US', { year: 'numeric', timeZone: 'Asia/Kathmandu' })} TVS Raj Automobiles - Lahan, Siraha. All Rights Reserved.</p>
          <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 text-gray-400">
            <span>Privacy Policy</span>
            <span>•</span>
            <span>Terms of Service</span>
            <span>•</span>
            <span>Showroom Location</span>
            <span>•</span>
            <Link
              to="/admin-login"
              className="hover:text-[#0066CC] transition-colors inline-flex items-center space-x-1 text-gray-400"
            >
              <Lock className="w-3 h-3 text-gray-500" />
              <span>Staff Login</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
