import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getRoleDashboardPath } from '../../utils/permissions';
import { Mail, Lock, Eye, EyeOff, Shield, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { user, isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  // If already logged in, automatically redirect to assigned role dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      navigate(getRoleDashboardPath(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleManualLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.success && res.user) {
        navigate(getRoleDashboardPath(res.user.role), { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col items-center justify-center p-4 sm:p-6 bg-[#f2f6fc] text-slate-800 overflow-hidden font-sans">
      {/* Abstract Background Elements matching the reference design */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Soft diagonal curved blue gradient in background */}
        <div
          className="absolute -top-[20%] -left-[20%] w-[70vw] h-[70vw] rounded-full opacity-30 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #c7dbfb 0%, #e2edfd 60%, transparent 80%)' }}
        />
        <div
          className="absolute -bottom-[20%] -right-[15%] w-[60vw] h-[60vw] rounded-full opacity-35 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #d5e5fe 0%, #edf4fe 60%, transparent 80%)' }}
        />

        {/* Top-Right Dotted Matrix Grid */}
        <div
          className="absolute top-8 right-8 w-40 h-40 opacity-40"
          style={{
            backgroundImage: 'radial-gradient(#93c5fd 1.5px, transparent 1.5px)',
            backgroundSize: '14px 14px'
          }}
        />

        {/* Bottom-Left Dotted Matrix Grid */}
        <div
          className="absolute bottom-8 left-8 w-40 h-40 opacity-30"
          style={{
            backgroundImage: 'radial-gradient(#93c5fd 1.5px, transparent 1.5px)',
            backgroundSize: '14px 14px'
          }}
        />

        {/* Soft Diagonal Accent Curve */}
        <svg
          className="absolute left-0 top-0 h-full w-2/5 text-blue-100/40 opacity-60 pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path d="M0,0 L70,0 Q30,50 80,100 L0,100 Z" fill="currentColor" />
        </svg>
      </div>

      {/* Main Login Card (Identical to user reference image) */}
      <div className="w-full max-w-[450px] bg-white rounded-[26px] sm:rounded-[30px] shadow-[0_20px_60px_-15px_rgba(28,78,160,0.08)] border border-slate-200/80 p-7 sm:p-10 relative z-10">
        {/* Top Blue Shield with User Avatar and Cog Badge */}
        <div className="flex justify-center mb-3">
          <div className="relative w-20 h-20 flex items-center justify-center">
            {/* SVG Shield with User silhouette and Gear */}
            <svg className="w-20 h-20 drop-shadow-sm" viewBox="0 0 80 88" fill="none">
              {/* Shield Base */}
              <path
                d="M40 3L68 14V42C68 62 40 82 40 82C40 82 12 62 12 42V14L40 3Z"
                fill="#2563EB"
              />
              {/* Inner subtle shield shine */}
              <path
                d="M40 5L66 15.5V41.5C66 60 40 79 40 79V5Z"
                fill="white"
                fillOpacity="0.08"
              />
              {/* User Avatar Silhouette */}
              <circle cx="40" cy="28" r="9" fill="white" />
              <path
                d="M26 49C26 41.5 32 39 40 39C48 39 54 41.5 54 49V51C54 53 52.5 54 50 54H30C27.5 54 26 53 26 51V49Z"
                fill="white"
              />
              {/* Gear / Cog badge on bottom-right of shield */}
              <circle cx="56" cy="57" r="10.5" fill="#2563EB" stroke="white" strokeWidth="2.5" />
              <g transform="translate(56, 57)">
                <circle cx="0" cy="0" r="4" fill="white" />
                <path
                  d="M-2 -8 H2 V-6 H-2 Z M-2 6 H2 V8 H-2 Z M-8 -2 H-6 V2 H-8 Z M6 -2 H8 V2 H6 Z"
                  fill="white"
                />
                <circle cx="0" cy="0" r="2" fill="#2563EB" />
              </g>
            </svg>
          </div>
        </div>

        {/* Card Title & Subtitle */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight">
            Admin Login
          </h1>
          <p className="text-xs sm:text-[13px] text-slate-500 mt-1.5 leading-relaxed max-w-[280px] mx-auto">
            Welcome back! Please sign in to access the admin dashboard.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleManualLogin} className="space-y-4 text-left">
          {/* Email Address Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Email Address
            </label>
            <div className="flex items-center gap-3 px-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition shadow-sm">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full text-xs sm:text-sm text-slate-800 bg-transparent placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Password
            </label>
            <div className="flex items-center gap-3 px-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition shadow-sm">
              <Lock className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full text-xs sm:text-sm text-slate-800 bg-transparent placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-600 focus:outline-none shrink-0"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Remember Me & Forgot Password Row */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-500 hover:text-slate-700">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Remember me</span>
            </label>

            <button
              type="button"
              onClick={() => alert('For password reset, please contact Super Admin support.')}
              className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
            >
              Forgot Password?
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm tracking-wide shadow-md shadow-blue-500/25 transition-all mt-2 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </div>

      {/* Footer Copyright */}
      <footer className="text-center text-xs text-slate-400 mt-6 relative z-10">
        &copy; {new Date().getFullYear()} Your Company. All rights reserved.
      </footer>
    </div>
  );
}
