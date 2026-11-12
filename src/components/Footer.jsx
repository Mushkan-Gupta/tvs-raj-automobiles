import React from 'react';
import { Link } from 'react-router-dom';
import { Bike, MapPin, Phone, Clock, Lock } from 'lucide-react';
import { showroomInfo } from '../data/bikes';
import { useAuth } from '../lib/AuthContext';

export default function Footer() {
  const { user, role } = useAuth();
  const isCustomer = !!user && role === null;
  const year = new Date().toLocaleDateString('en-US', { year: 'numeric', timeZone: 'Asia/Kathmandu' });

  return (
    <footer className="bg-[#070a12] text-gray-400 border-t border-[#1f293d] py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        {/* Row 1: three groups */}
        <div className="flex flex-col sm:flex-row gap-8 sm:gap-12">

          {/* a) Brand */}
          <div className="flex items-start gap-3 shrink-0">
            <div className="bg-[#0066CC] p-2 rounded-lg shrink-0">
              <Bike className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="block text-sm font-bold text-white">TVS Raj Automobiles</span>
              <span className="block text-xs text-gray-400 mt-0.5">Authorized TVS dealer, Lahan, Siraha</span>
            </div>
          </div>

          {/* b) Five links */}
          <nav aria-label="Footer navigation" className="shrink-0">
            <ul className="flex flex-col sm:flex-row flex-wrap gap-y-1 gap-x-6 text-sm">
              {[
                { label: 'All Bikes',    path: '/bikes'   },
                { label: 'Parts',        path: '/parts'   },
                { label: 'Offers',       path: '/offers'  },
                { label: 'Finance & EMI',path: '/finance' },
                { label: 'Contact',      path: '/contact' },
              ].map(({ label, path }) => (
                <li key={path}>
                  <Link
                    to={path}
                    className="min-h-[44px] sm:min-h-0 flex items-center hover:text-[#0066CC] transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* c) Contact */}
          <div className="text-xs space-y-1.5 sm:ml-auto">
            <div className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#0066CC] shrink-0 mt-0.5" />
              <span>{showroomInfo.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-[#0066CC] shrink-0" />
              <a
                href="tel:+9779819789215"
                className="min-h-[44px] sm:min-h-0 flex items-center hover:text-white transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded"
              >
                +977 9819789215
              </a>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-[#0066CC] shrink-0 mt-0.5" />
              <span>{showroomInfo.openingHours}</span>
            </div>
          </div>

        </div>

        {/* Row 2: copyright + Staff Login */}
        <div className="border-t border-[#1f293d] pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>© {year} TVS Raj Automobiles — Lahan, Siraha. All rights reserved.</p>
          {!isCustomer && (
            <Link
              to="/admin-login"
              className="inline-flex items-center gap-1.5 hover:text-[#0066CC] transition-colors duration-150 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded min-h-[44px] sm:min-h-0 px-1"
            >
              <Lock className="w-3 h-3" />
              <span>Staff Login</span>
            </Link>
          )}
        </div>

      </div>
    </footer>
  );
}
