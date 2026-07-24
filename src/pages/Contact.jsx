import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { showroomInfo, sampleBikes } from '../data/bikes';
import { Phone, MessageSquare, MapPin, Mail, Clock, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function Contact() {
  const location = useLocation();
  
  const [form, setForm] = useState({
    name: '',
    phone: '',
    interested_model: 'TVS Apache RTR 160 4V',
    message: ''
  });
  
  const [status, setStatus] = useState({ type: null, message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (location.state?.model) {
      setForm(prev => ({ ...prev, interested_model: location.state.model }));
    }
  }, [location]);

  const handlePhoneChange = (e) => {
    // Only numeric digits, max 10
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setForm(prev => ({ ...prev, phone: digits }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: null, message: '' });

    if (form.phone.length < 10) {
      setStatus({ type: 'error', message: 'Phone number must be exactly 10 digits.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('inquiries').insert([{
        name: form.name.trim(),
        phone: form.phone,
        interested_model: form.interested_model,
        message: form.message.trim()
      }]);

      if (error) throw error;

      // Sync to Google Sheets non-blockingly
      try {
        const { error: syncError } = await supabase.functions.invoke('sync-to-sheets', {
          body: {
            type: 'inquiry',
            name: form.name.trim(),
            phone: form.phone,
            interested_model: form.interested_model,
            message: form.message.trim(),
            created_at: new Date().toISOString()
          }
        });
        if (syncError) {
          console.warn('[sync-to-sheets] Inquiry sync failed:', syncError.message);
        }
      } catch (syncErr) {
        console.warn('[sync-to-sheets] Inquiry sync network error:', syncErr);
      }

      setStatus({ type: 'success', message: "Thank you! Waiting to see you at the showroom." });
      setForm({
        name: '',
        phone: '',
        interested_model: 'TVS Apache RTR 160 4V',
        message: ''
      });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: 'Failed to submit inquiry. Please try again or contact us directly.' });
    } finally {
      setIsSubmitting(false);
    }
  };

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
          
          {status.message && (
            <div className={`p-4 rounded-xl flex items-start space-x-3 text-sm ${status.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
              {status.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <span>{status.message}</span>
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Your Name *</label>
              <input type="text" required value={form.name} onChange={e => setForm(prev => ({...prev, name: e.target.value}))} placeholder="e.g. Ram Kumar" className="w-full bg-[#0b0f19] border border-[#1f293d] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#0066CC] min-h-[44px]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Phone Number *</label>
              <input type="tel" required value={form.phone} onChange={handlePhoneChange} placeholder="e.g. 9819789215" className="w-full bg-[#0b0f19] border border-[#1f293d] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#0066CC] min-h-[44px]" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Interested Model</label>
              <select value={form.interested_model} onChange={e => setForm(prev => ({...prev, interested_model: e.target.value}))} className="w-full bg-[#0b0f19] border border-[#1f293d] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#0066CC] min-h-[44px]">
                {sampleBikes.map(bike => (
                  <option key={bike.id} value={bike.name}>{bike.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">Message</label>
              <textarea rows={3} value={form.message} onChange={e => setForm(prev => ({...prev, message: e.target.value}))} placeholder="Tell us what you'd like to ask..." className="w-full bg-[#0b0f19] border border-[#1f293d] rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#0066CC]" />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full py-3.5 bg-[#0066CC] hover:bg-[#0052A3] text-white font-bold rounded-lg text-sm transition-colors min-h-[44px] flex items-center justify-center space-x-2 disabled:opacity-50">
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Inquiry</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
