import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import {
  User,
  LogOut,
  Loader,
  AlertCircle,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────

function isValidPhone(v) {
  if (!v) return true; // optional is OK; completeness checked elsewhere
  return /^\+?\d+$/.test(v) && v.length >= 8 && v.length <= 15;
}

// ─── Component ─────────────────────────────────────────────────────────

export default function Account() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Profile form
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');

  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null); // { type: 'success' | 'error', text }

  // Password recovery handling
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  // ── Redirect if not signed in ──
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?next=/account', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // ── Listen for PASSWORD_RECOVERY event ──
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load profile ──
  const loadProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setCity(data.city || '');
        setArea(data.area || '');
        setLandmark(data.landmark || '');
      }
    } catch {
      // profile may not exist yet
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // ── Save profile ──
  const handleSave = async (e) => {
    e.preventDefault();
    setSaveMsg(null);

    const trimmedPhone = phone.trim();
    if (trimmedPhone && !isValidPhone(trimmedPhone)) {
      setSaveMsg({
        type: 'error',
        text: 'Phone must be 8 to 15 digits, with an optional leading +.',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: fullName.trim(),
        phone: trimmedPhone,
        city: city.trim(),
        area: area.trim(),
        landmark: landmark.trim(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setSaveMsg({ type: 'success', text: 'Profile saved.' });
    } catch (err) {
      setSaveMsg({
        type: 'error',
        text: err.message || 'Could not save profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Update password ──
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setPwMsg(null);

    if (newPassword.length < 8) {
      setPwMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPwMsg({ type: 'success', text: 'Password updated.' });
      setNewPassword('');
      setConfirmNewPassword('');
      setShowNewPw(false);
      // hide the section after a short delay
      setTimeout(() => setShowPasswordReset(false), 2000);
    } catch (err) {
      setPwMsg({
        type: 'error',
        text: err.message || 'Could not update password.',
      });
    } finally {
      setPwSaving(false);
    }
  };

  // ── Log out ──
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  // ── Loading ──
  if (authLoading || (!user && true)) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader className="w-8 h-8 text-[#0066CC] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] max-w-lg mx-auto px-4 py-10 space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0066CC]/20 border border-[#0066CC]/30 flex items-center justify-center">
            <User className="w-5 h-5 text-[#0066CC]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white">My Account</h1>
            <p className="text-xs text-gray-400 truncate">{user.email}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="min-h-[44px] px-4 py-2 rounded-lg border border-[#1f293d] bg-[#0b0f19] hover:bg-[#1f293d] text-sm font-medium text-gray-300 hover:text-white flex items-center gap-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>

      {/* ─── Password reset section (shown after clicking password reset link) ─── */}
      {showPasswordReset && (
        <div className="bg-[#151c2c] border border-amber-500/30 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-bold text-white">
              Set a new password
            </h2>
          </div>

          {pwMsg && (
            <div
              className={`p-3 rounded-xl border flex items-start gap-2.5 text-sm ${
                pwMsg.type === 'success'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-red-500/30 bg-red-500/10 text-red-400'
              }`}
            >
              {pwMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{pwMsg.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="new-password"
                className="block text-xs font-semibold text-gray-300"
              >
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg pl-4 pr-11 py-2.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500"
                  placeholder="At least 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded"
                  aria-label={
                    showNewPw ? 'Hide password' : 'Show password'
                  }
                >
                  {showNewPw ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirm-new-password"
                className="block text-xs font-semibold text-gray-300"
              >
                Confirm new password
              </label>
              <input
                id="confirm-new-password"
                type={showNewPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500"
                placeholder="Re-enter new password"
              />
            </div>

            <button
              type="submit"
              disabled={pwSaving}
              className="w-full min-h-[44px] rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold flex items-center justify-center transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#151c2c]"
            >
              {pwSaving ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                'Update password'
              )}
            </button>
          </form>
        </div>
      )}

      {/* ─── Profile form ─── */}
      <div className="bg-[#151c2c] border border-[#1f293d] rounded-2xl p-6 space-y-5">
        <h2 className="text-base font-bold text-white">Profile</h2>

        {profileLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 text-[#0066CC] animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {/* Save message */}
            {saveMsg && (
              <div
                className={`p-3 rounded-xl border flex items-start gap-2.5 text-sm ${
                  saveMsg.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-400'
                }`}
              >
                {saveMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{saveMsg.text}</span>
              </div>
            )}

            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-300">
                Email
              </label>
              <input
                type="email"
                value={user.email || ''}
                disabled
                className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-gray-400 rounded-lg px-4 py-2.5 text-sm cursor-not-allowed"
              />
            </div>

            {/* Full name */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-name"
                className="block text-xs font-semibold text-gray-300"
              >
                Full name
              </label>
              <input
                id="profile-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500"
                placeholder="Your full name"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-phone"
                className="block text-xs font-semibold text-gray-300"
              >
                Phone
              </label>
              <input
                id="profile-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500"
                placeholder="+977 98XXXXXXXX"
              />
            </div>

            {/* City */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-city"
                className="block text-xs font-semibold text-gray-300"
              >
                City
              </label>
              <input
                id="profile-city"
                type="text"
                autoComplete="address-level2"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500"
                placeholder="e.g. Lahan"
              />
            </div>

            {/* Area (tole/village) */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-area"
                className="block text-xs font-semibold text-gray-300"
              >
                Tole / Village
              </label>
              <input
                id="profile-area"
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500"
                placeholder="e.g. Hospital Chowk"
              />
            </div>

            {/* Landmark */}
            <div className="space-y-1.5">
              <label
                htmlFor="profile-landmark"
                className="block text-xs font-semibold text-gray-300"
              >
                Landmark
              </label>
              <input
                id="profile-landmark"
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500"
                placeholder="Near hospital, school, etc."
              />
            </div>

            {/* Save button */}
            <button
              type="submit"
              disabled={saving}
              className="w-full min-h-[44px] rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-semibold flex items-center justify-center transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151c2c]"
            >
              {saving ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                'Save profile'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

