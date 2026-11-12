import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import {
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Loader,
  Bike,
} from 'lucide-react';

// ─── Helpers ───────────────────────────────────────────────────────────

function getRedirectPath(searchParams) {
  const next = searchParams.get('next');
  if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) return next;
  return '/account';
}

function friendlyError(msg) {
  if (!msg) return 'Something went wrong. Please try again.';
  const lower = msg.toLowerCase();
  if (lower.includes('invalid login credentials'))
    return 'Wrong email or password.';
  if (lower.includes('email not confirmed'))
    return 'Please confirm your email first. Check your inbox for a confirmation link.';
  if (lower.includes('user already registered'))
    return 'An account with this email already exists. Try signing in instead.';
  if (
    lower.includes('invalid otp') ||
    lower.includes('token has expired') ||
    (lower.includes('otp') && lower.includes('expired'))
  )
    return 'Incorrect or expired code. Please try again.';
  if (
    lower.includes('rate') ||
    lower.includes('too many') ||
    lower.includes('email rate limit')
  )
    return 'Too many attempts. Please wait a moment before trying again.';
  if (lower.includes('signup') && lower.includes('disabled'))
    return 'Account creation is currently disabled.';
  return msg;
}

const GOOGLE_ENABLED = import.meta.env.VITE_ENABLE_GOOGLE_LOGIN === 'true';

// ─── Component ─────────────────────────────────────────────────────────

export default function Login() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── State ──
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup'
  const [view, setView] = useState('password');
  // 'password' | 'otp-email' | 'otp-code' | 'forgot' | 'forgot-sent' | 'signup-done'

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);

  const timerRef = useRef(null);

  // ── Redirect if already signed in ──
  useEffect(() => {
    if (!authLoading && user) {
      navigate(getRedirectPath(searchParams), { replace: true });
    }
  }, [user, authLoading, navigate, searchParams]);

  // ── Resend countdown ──
  useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(
        () => setResendTimer((t) => t - 1),
        1000,
      );
      return () => clearTimeout(timerRef.current);
    }
  }, [resendTimer]);

  // ── Switch tab ──
  const switchTab = useCallback((newTab) => {
    setTab(newTab);
    setView('password');
    setError(null);
    setOtpCode('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }, []);

  // ── Switch view (keep email) ──
  const switchView = useCallback(
    (v) => {
      setView(v);
      setError(null);
      setOtpCode('');
      if (v === 'password') {
        setPassword('');
        setConfirmPassword('');
        setShowPassword(false);
      }
    },
    [],
  );

  // ── Handlers ──

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();

    if (tab === 'signup') {
      if (password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (tab === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (err) throw err;
        // Auth state change will trigger redirect via useEffect
      } else {
        const { error: err } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (err) throw err;
        setView('signup-done');
      }
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: { shouldCreateUser: true },
      });
      if (err) throw err;
      setView('otp-code');
      setResendTimer(30);
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    const code = otpCode.trim();
    if (code.length !== 6) {
      setError('Please enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: 'email',
      });
      if (err) throw err;
      // Auth state change will trigger redirect
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (err) throw err;
      setResendTimer(30);
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        trimmedEmail,
        { redirectTo: `${window.location.origin}/account` },
      );
      if (err) throw err;
      setView('forgot-sent');
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const dest = getRedirectPath(searchParams);
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${dest}`,
        },
      });
      if (err) throw err;
    } catch (err) {
      setError(friendlyError(err.message));
    }
  };

  // ── Show loading while auth checks ──
  if (authLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader className="w-8 h-8 text-[#0066CC] animate-spin" />
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-[#151c2c] border border-[#1f293d] rounded-2xl overflow-hidden">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-center gap-2 pt-6 pb-2">
          <div className="bg-[#0066CC] p-2 rounded-lg">
            <Bike className="w-5 h-5 text-white" />
          </div>
          <span className="text-sm font-bold text-white">
            TVS Raj Automobiles
          </span>
        </div>

        {/* ─── Tabs ─── */}
        <div className="flex border-b border-[#1f293d] mx-6 mt-2">
          {['signin', 'signup'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`flex-1 py-3 text-sm font-semibold text-center transition-colors duration-150 ease-in-out border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] focus-visible:ring-inset ${
                tab === t
                  ? 'text-white border-[#0066CC]'
                  : 'text-gray-400 border-transparent hover:text-gray-200'
              }`}
            >
              {t === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {/* ─── Body ─── */}
        <div className="p-6 space-y-5">
          {/* Error banner */}
          {error && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-2.5 text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* ─── Success states ─── */}
          {view === 'signup-done' && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">
                  Check your email to confirm your account
                </h2>
                <p className="text-sm text-gray-400">
                  We sent a confirmation link to{' '}
                  <span className="text-white font-medium">{email}</span>.
                  Click it to activate your account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchTab('signin')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4da3ff] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </button>
            </div>
          )}

          {view === 'forgot-sent' && (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">
                  Reset link sent
                </h2>
                <p className="text-sm text-gray-400">
                  Check{' '}
                  <span className="text-white font-medium">{email}</span>{' '}
                  for a password reset link.
                </p>
              </div>
              <button
                type="button"
                onClick={() => switchView('password')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#4da3ff] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </button>
            </div>
          )}

          {/* ─── Forgot password form ─── */}
          {view === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-white">
                  Forgot your password?
                </h2>
                <p className="text-sm text-gray-400">
                  Enter your email and we will send a reset link.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="forgot-email"
                  className="block text-xs font-semibold text-gray-300"
                >
                  Email address
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-semibold flex items-center justify-center transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151c2c]"
              >
                {loading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  'Send reset link'
                )}
              </button>

              <button
                type="button"
                onClick={() => switchView('password')}
                className="w-full text-center text-sm font-medium text-[#4da3ff] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded py-1"
              >
                <span className="inline-flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to sign in
                </span>
              </button>
            </form>
          )}

          {/* ─── OTP email form ─── */}
          {view === 'otp-email' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-white">
                  Sign in with a code
                </h2>
                <p className="text-sm text-gray-400">
                  We will email you a 6-digit code.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="otp-email"
                  className="block text-xs font-semibold text-gray-300"
                >
                  Email address
                </label>
                <input
                  id="otp-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500"
                  placeholder="you@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-semibold flex items-center justify-center transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151c2c]"
              >
                {loading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  'Send code'
                )}
              </button>

              <button
                type="button"
                onClick={() => switchView('password')}
                className="w-full text-center text-sm font-medium text-[#4da3ff] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded py-1"
              >
                <span className="inline-flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Use password instead
                </span>
              </button>
            </form>
          )}

          {/* ─── OTP code form ─── */}
          {view === 'otp-code' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-base font-bold text-white">
                  Enter your code
                </h2>
                <p className="text-sm text-gray-400">
                  We sent a 6-digit code to{' '}
                  <span className="text-white font-medium">{email}</span>.
                </p>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="otp-code"
                  className="block text-xs font-semibold text-gray-300"
                >
                  Code
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  required
                  className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg px-4 py-2.5 text-sm tracking-[0.3em] text-center font-semibold focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500 placeholder:tracking-normal"
                  placeholder="000000"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-semibold flex items-center justify-center transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151c2c]"
              >
                {loading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  'Verify'
                )}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || loading}
                  className="text-sm font-medium text-[#4da3ff] hover:text-white disabled:text-gray-500 disabled:cursor-not-allowed transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded py-1"
                >
                  {resendTimer > 0
                    ? `Resend code (${resendTimer}s)`
                    : 'Resend code'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => switchView('password')}
                className="w-full text-center text-sm font-medium text-[#4da3ff] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded py-1"
              >
                <span className="inline-flex items-center gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Use password instead
                </span>
              </button>
            </form>
          )}

          {/* ─── Password form (default) ─── */}
          {view === 'password' && (
            <>
              <form
                onSubmit={handlePasswordSubmit}
                className="space-y-4"
              >
                {/* Email */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-semibold text-gray-300"
                  >
                    Email address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500"
                    placeholder="you@example.com"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-gray-300"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={
                        tab === 'signin'
                          ? 'current-password'
                          : 'new-password'
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg pl-4 pr-11 py-2.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm password (signup only) */}
                {tab === 'signup' && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="login-confirm"
                      className="block text-xs font-semibold text-gray-300"
                    >
                      Confirm password
                    </label>
                    <input
                      id="login-confirm"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="w-full min-h-[44px] bg-[#0b0f19] border border-[#1f293d] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors placeholder:text-gray-500"
                      placeholder="Re-enter your password"
                    />
                  </div>
                )}

                {/* Forgot password (signin only) */}
                {tab === 'signin' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => switchView('forgot')}
                      className="text-xs font-medium text-[#4da3ff] hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] rounded py-0.5"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full min-h-[44px] rounded-lg bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-semibold flex items-center justify-center transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#151c2c]"
                >
                  {loading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : tab === 'signin' ? (
                    'Sign in'
                  ) : (
                    'Create account'
                  )}
                </button>
              </form>

              {/* ─── Divider + alternate methods ─── */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#1f293d]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#151c2c] px-3 text-gray-500">
                    or
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {/* Email OTP */}
                <button
                  type="button"
                  onClick={() => switchView('otp-email')}
                  className="w-full min-h-[44px] rounded-lg border border-[#1f293d] bg-[#0b0f19] hover:bg-[#1f293d] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                >
                  <Mail className="w-4 h-4 text-[#0066CC]" />
                  Email me a code
                </button>

                {/* Google OAuth */}
                {GOOGLE_ENABLED && (
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full min-h-[44px] rounded-lg border border-[#1f293d] bg-[#0b0f19] hover:bg-[#1f293d] text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0066CC]"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continue with Google
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

