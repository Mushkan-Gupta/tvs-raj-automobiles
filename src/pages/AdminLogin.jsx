import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { AlertCircle, Lock, Mail, ArrowRight } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      // 1. Authenticate with Supabase
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (authError) {
        throw new Error('Invalid email or password');
      }
      
      if (!authData.user) {
        throw new Error('User not found');
      }

      // 2. Query user_roles table
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('id', authData.user.id)
        .single();
        
      if (roleError) {
        console.error("Role lookup error:", roleError);
        throw new Error('Could not determine user role');
      }
      
      const role = roleData?.role;
      
      // 3. Redirect based on role
      if (role === 'admin') {
        navigate('/admin/dashboard');
      } else if (role === 'employee') {
        navigate('/employee/dashboard');
      } else {
        throw new Error('Unauthorized role');
      }
      
    } catch (err) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl border border-[#1f293d] shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#0b0f19] border border-[#1f293d] mb-4">
            <Lock className="w-6 h-6 text-[#0066CC]" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">Staff Portal</h1>
          <p className="text-sm text-gray-400 mt-2">Authorized personnel only</p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start space-x-3 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="employee@rajautomobiles.com.np"
                className="w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors"
                required
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors"
                required
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-3.5 mt-2 rounded-xl btn-primary text-sm font-bold flex items-center justify-center space-x-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span>{loading ? 'Authenticating...' : 'Secure Login'}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
