import React from 'react';
import { supabase } from '../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

export default function AdminDashboard() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-login');
  };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center space-y-4">
      <h1 className="text-3xl font-black text-white">Admin Dashboard</h1>
      <div className="px-4 py-2 rounded-lg bg-[#0066CC]/20 border border-[#0066CC]/40 text-[#0066CC] font-bold tracking-wide">
        Coming Soon
      </div>
      <p className="text-gray-400 max-w-md pb-4">
        This is a placeholder page for the admin dashboard. In future steps, this will be protected and filled with management tools.
      </p>

      <button 
        onClick={handleLogout}
        className="flex items-center space-x-2 px-6 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 font-bold text-sm transition-all shadow-lg mt-8"
      >
        <LogOut className="w-4 h-4" />
        <span>Secure Logout</span>
      </button>
    </div>
  );
}
