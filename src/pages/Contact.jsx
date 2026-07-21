import React from 'react';
import { showroomInfo } from '../data/bikes';
import { Phone, MessageSquare, MapPin, Mail, Clock } from 'lucide-react';

export default function Contact() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      <div className="border-b border-[#1f293d] pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Contact TVS Raj Automobiles</h1>
        <p className="text-gray-400 text-xs sm:text-sm mt-1">Get in touch with our sales & service team in Lahan, Siraha.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 bg-[#151c2c] p-6 sm:p-8 rounded-2xl border border-[#1f293d] space-y-6">
          <h2 className="text-lg sm:text-xl font-bold text-white">Showroom Information</h2>
          <div className="space-y-4 text-xs sm:text-sm text-gray-300">
            <div className="flex items-start space-x-3">
              <MapPin className="w-5 h-5 text-[#0066CC] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Address</p>
                <p>{showroomInfo.address}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Phone className="w-5 h-5 text-[#0066CC] shrink-0" />
              <div>
                <p className="font-semibold text-white">Phone</p>
                <p>+977 9819789215</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <MessageSquare className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-semibold text-white">WhatsApp</p>
                <p>+977 9819789215</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-[#0066CC] shrink-0" />
              <div>
                <p className="font-semibold text-white">Email</p>
                <p>{showroomInfo.emailPlaceholder}</p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Clock className="w-5 h-5 text-[#0066CC] shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">Opening Hours</p>
                <p>{showroomInfo.openingHours}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-4">
            <a
              href="tel:+9779819789215"
              className="flex-1 py-3.5 px-4 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold text-center flex items-center justify-center space-x-2 text-sm min-h-[44px]"
            >
              <Phone className="w-4 h-4" />
              <span>Call Showroom</span>
            </a>
            <a
              href="https://wa.me/9779819789215"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-center flex items-center justify-center space-x-2 text-sm min-h-[44px]"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp Us</span>
            </a>
          </div>
        </div>

        {/* Quick Inquiry Form */}
        <div className="lg:col-span-6 bg-[#151c2c] p-6 sm:p-8 rounded-2xl border border-[#1f293d] space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-white">Send Quick Inquiry</h2>
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Your Name</label>
              <input type="text" placeholder="e.g. Ram Kumar" className="w-full bg-[#0b0f19] border border-[#1f293d] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#0066CC] min-h-[44px]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Phone Number</label>
              <input type="tel" placeholder="e.g. 9819789215" className="w-full bg-[#0b0f19] border border-[#1f293d] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#0066CC] min-h-[44px]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Interested Model</label>
              <select className="w-full bg-[#0b0f19] border border-[#1f293d] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#0066CC] min-h-[44px]">
                <option>TVS Apache RTR 160 4V</option>
                <option>TVS Apache RTR 200 4V</option>
                <option>TVS Apache RR 310</option>
                <option>TVS Raider 125</option>
                <option>TVS Ronin</option>
                <option>TVS NTORQ 125</option>
                <option>TVS Jupiter</option>
                <option>TVS iQube</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Message</label>
              <textarea rows={3} placeholder="Tell us what you'd like to ask..." className="w-full bg-[#0b0f19] border border-[#1f293d] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#0066CC]" />
            </div>
            <button type="submit" className="w-full py-3.5 bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-lg text-sm transition-colors min-h-[44px]">
              Submit Inquiry
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
