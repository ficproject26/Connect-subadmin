import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { normalizeRole } from '../utils/permissions';
import { dataService } from '../services/dataService';
import {
  Search, Store, ShoppingBag, CalendarCheck, Briefcase,
  Truck, Wrench, UserCheck, Headphones, Users, CreditCard,
  IndianRupee, FileCheck2, ClipboardCheck, BarChart3,
  Building2, Layers, MapPin, UserCog, UserPlus, X,
  ArrowRight, Package, CircleHelp, ClipboardList, Bell
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Static module catalogue – built once, keyed by role-prefix at search time
// ─────────────────────────────────────────────────────────────────────────────
const MODULE_CATALOGUE = [
  { label: 'Dashboard',             path: '/dashboard',              icon: BarChart3,     keywords: ['dashboard', 'home', 'overview'] },
  { label: 'Vendors',               path: '/vendors',                icon: Store,         keywords: ['vendor', 'vend', 'shop', 'store', 'business'] },
  { label: 'Vendor Subscription',   path: '/vendor-subscriptions',   icon: Store,         keywords: ['vendor subscription', 'subscription', 'vend sub'] },
  { label: 'Vendor Payment Status', path: '/vendor-payments',        icon: IndianRupee,   keywords: ['vendor payment', 'vendor pay', 'vend pay'] },
  { label: 'Orders',                path: '/orders',                 icon: ShoppingBag,   keywords: ['order', 'orders', 'purchase'] },
  { label: 'Bookings',              path: '/bookings',               icon: CalendarCheck, keywords: ['booking', 'book', 'schedule', 'appointment'] },
  { label: 'Jobs',                  path: '/jobs',                   icon: Briefcase,     keywords: ['job', 'jobs', 'work', 'employment'] },
  { label: 'Customers',             path: '/customers',              icon: Users,         keywords: ['customer', 'client', 'user', 'member', 'cust'] },
  { label: 'Membership Cards',      path: '/membership-cards',       icon: CreditCard,    keywords: ['membership', 'card', 'loyalty', 'mem'] },
  { label: 'Delivery Partners',     path: '/delivery-partners',      icon: Truck,         keywords: ['delivery', 'partner', 'courier', 'deliv', 'logistics'] },
  { label: 'Technicians',           path: '/technicians',            icon: Wrench,        keywords: ['technician', 'tech', 'repair', 'service'] },
  { label: 'Executives',            path: '/executives',             icon: UserCheck,     keywords: ['executive', 'exec', 'officer'] },
  { label: 'Support Team',          path: '/support-team',           icon: Headphones,    keywords: ['support', 'help', 'ticket', 'helpdesk'] },
  { label: 'Agents (State)',        path: '/agents/state',           icon: UserPlus,      keywords: ['agent', 'state agent', 'agents'] },
  { label: 'Agents (District)',     path: '/agents/district',        icon: UserPlus,      keywords: ['agent', 'district agent', 'agents'] },
  { label: 'Agents (Division)',     path: '/agents/divisional',      icon: UserPlus,      keywords: ['agent', 'division agent', 'agents'] },
  { label: 'Agents (Pincode)',      path: '/agents/pincode',         icon: UserPlus,      keywords: ['agent', 'pincode agent', 'agents'] },
  { label: 'Agent Payments',        path: '/agent-payments',         icon: IndianRupee,   keywords: ['agent payment', 'agent pay', 'commission', 'payout'] },
  { label: 'Payments',              path: '/payments',               icon: IndianRupee,   keywords: ['payment', 'pay', 'finance', 'invoice', 'payout'] },
  { label: 'KYC',                   path: '/kyc',                    icon: FileCheck2,    keywords: ['kyc', 'know your customer', 'verification', 'identity'] },
  { label: 'Quality Check',         path: '/quality-check',          icon: ClipboardCheck,keywords: ['quality', 'qc', 'check', 'inspection'] },
  { label: 'Business Reports',      path: '/reports',                icon: BarChart3,     keywords: ['report', 'analytics', 'business', 'stats'] },
  { label: 'Tasks',                 path: '/tasks',                  icon: ClipboardList, keywords: ['task', 'todo', 'assignment'] },
  { label: 'Queries',               path: '/queries',                icon: CircleHelp,    keywords: ['query', 'queries', 'question', 'request'] },
  { label: 'Notifications',         path: '/notifications',          icon: Bell,          keywords: ['notification', 'alert', 'notify'] },
  { label: 'District Admins',       path: '/districts',              icon: Building2,     keywords: ['district', 'district admin'] },
  { label: 'Division Admins',       path: '/divisions',              icon: Layers,        keywords: ['division', 'division admin', 'divisional'] },
  { label: 'Pincode Admins',        path: '/pincodes',               icon: MapPin,        keywords: ['pincode', 'pin', 'pincode admin', 'zip'] },
  { label: 'State Managers',        path: '/managers/state',         icon: UserCog,       keywords: ['manager', 'state manager'] },
  { label: 'District Managers',     path: '/managers/district',      icon: UserCog,       keywords: ['manager', 'district manager'] },
  { label: 'Divisional Managers',   path: '/managers/divisional',    icon: UserCog,       keywords: ['manager', 'divisional manager', 'division manager'] },
  { label: 'Pincode Managers',      path: '/managers/pincode',       icon: UserCog,       keywords: ['manager', 'pincode manager'] },
];

// Which modules are allowed per role prefix
const ROLE_PREFIX_MAP = {
  'Super Admin':     '/state-admin',
  'State Admin':     '/state-admin',
  'District Admin':  '/district-admin',
  'Divisional Admin':'/divisional-admin',
  'Pincode Admin':   '/pincode-admin',
  'Manager':         '/manager',
};

// Modules NOT available per role (paths that don't exist for a role)
const ROLE_EXCLUSIONS = {
  'District Admin':   ['/agents/state', '/managers/state', '/districts'],
  'Divisional Admin': ['/agents/state', '/agents/district', '/managers/state', '/managers/district', '/districts', '/divisions'],
  'Pincode Admin':    ['/agents/state', '/agents/district', '/agents/divisional', '/managers/state', '/managers/district', '/managers/divisional', '/districts', '/divisions'],
  'Manager':          ['/agents/state', '/agents/district', '/agents/divisional', '/agents/pincode', '/managers/state', '/managers/district', '/managers/divisional', '/managers/pincode', '/districts', '/divisions', '/pincodes', '/customers', '/membership-cards', '/orders', '/bookings', '/jobs', '/kyc', '/quality-check', '/reports', '/tasks', '/queries', '/notifications', '/vendor-subscriptions', '/vendor-payments', '/agent-payments', '/payments'],
};

function getRolePrefix(role) {
  return ROLE_PREFIX_MAP[role] || '/state-admin';
}

function getModulesForRole(role) {
  const prefix = getRolePrefix(role);
  const exclusions = ROLE_EXCLUSIONS[role] || [];
  return MODULE_CATALOGUE
    .filter(m => !exclusions.includes(m.path))
    .map(m => ({ ...m, fullPath: `${prefix}${m.path}` }));
}

function searchModules(modules, query) {
  const q = query.toLowerCase().trim();
  const results = [];
  const seen = new Set();
  for (const m of modules) {
    const score = m.keywords.reduce((best, kw) => {
      if (kw === q) return Math.max(best, 100);
      if (kw.startsWith(q)) return Math.max(best, 80);
      if (kw.includes(q)) return Math.max(best, 60);
      if (q.length >= 2 && kw.split(' ').some(w => w.startsWith(q))) return Math.max(best, 50);
      return best;
    }, 0);
    if (score > 0 && !seen.has(m.fullPath)) {
      seen.add(m.fullPath);
      results.push({ ...m, score });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 8);
}

// ─────────────────────────────────────────────────────────────────────────────
export function GlobalSearch({ isDark: isDarkProp }) {
  const { user } = useAuth();
  const { isDark: isDarkCtx } = useTheme();
  const isDark = isDarkProp !== undefined ? isDarkProp : isDarkCtx;
  const navigate = useNavigate();
  const role = normalizeRole(user?.role);

  const [query, setQuery] = useState('');
  const [moduleResults, setModuleResults] = useState([]);
  const [vendorResults, setVendorResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  const modules = getModulesForRole(role);

  // Compute fixed dropdown position below the input
  const recomputePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const dropW = Math.min(400, vw - 16);
    let left = rect.left;
    if (left + dropW > vw - 8) left = vw - dropW - 8;
    if (left < 8) left = 8;
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left,
      width: dropW,
    });
  }, []);

  useEffect(() => {
    if (open) recomputePosition();
  }, [open, recomputePosition]);

  useEffect(() => {
    window.addEventListener('resize', recomputePosition);
    return () => window.removeEventListener('resize', recomputePosition);
  }, [recomputePosition]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const doSearch = useCallback((q) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setModuleResults([]);
      setVendorResults([]);
      setOpen(false);
      return;
    }

    // Static module search (instant)
    const mods = searchModules(modules, trimmed);
    setModuleResults(mods);
    setOpen(true);
    recomputePosition();

    // Cancel previous vendor fetch
    if (abortRef.current) abortRef.current = false;
    const thisRequest = {};
    abortRef.current = thisRequest;

    setLoading(true);
    dataService.getVendors({ search: trimmed, limit: 5 })
      .then(res => {
        if (abortRef.current !== thisRequest) return; // stale
        if (res?.success && Array.isArray(res.vendors)) {
          setVendorResults(res.vendors.slice(0, 5));
        } else {
          setVendorResults([]);
        }
      })
      .catch(() => {
        if (abortRef.current === thisRequest) setVendorResults([]);
      })
      .finally(() => {
        if (abortRef.current === thisRequest) setLoading(false);
      });
  }, [modules, recomputePosition]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) {
      setModuleResults([]);
      setVendorResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (path) => {
    setQuery('');
    setOpen(false);
    setModuleResults([]);
    setVendorResults([]);
    navigate(path);
  };

  const handleVendorSelect = (vendor) => {
    const prefix = getRolePrefix(role);
    setQuery('');
    setOpen(false);
    setModuleResults([]);
    setVendorResults([]);
    navigate(`${prefix}/vendors`);
  };

  const hasResults = moduleResults.length > 0 || vendorResults.length > 0;
  const showEmpty = open && query.trim().length >= 2 && !loading && !hasResults;

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
        open
          ? isDark
            ? 'bg-slate-800 border-blue-500/60 ring-1 ring-blue-500/30'
            : 'bg-white border-blue-400 ring-1 ring-blue-200'
          : isDark
            ? 'bg-slate-800 border-slate-700 hover:border-slate-600'
            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
      } shadow-sm`}>
        <Search className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Search pages, vendors..."
          className={`w-36 sm:w-48 text-xs bg-transparent border-none outline-none font-medium placeholder:font-normal ${
            isDark ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
          }`}
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setOpen(false); setModuleResults([]); setVendorResults([]); }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[1098]" onClick={() => setOpen(false)} aria-hidden />
          <div
            style={dropdownStyle}
            className={`z-[1099] rounded-2xl border shadow-2xl overflow-hidden backdrop-blur-xl ${
              isDark
                ? 'bg-[#0f1b2e]/98 border-slate-700/80 text-white'
                : 'bg-white border-slate-200 text-slate-900 shadow-slate-200/80'
            }`}
          >
            {/* Search header */}
            <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${
              isDark ? 'border-slate-800 bg-[#132238]/60' : 'border-slate-100 bg-slate-50'
            }`}>
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                {loading ? 'Searching...' : `Results for "${query.trim()}"`}
              </span>
            </div>

            <div className="max-h-[min(72vh,420px)] overflow-y-auto">
              {/* Module Results */}
              {moduleResults.length > 0 && (
                <div>
                  <div className={`px-4 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-widest ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Pages
                  </div>
                  {moduleResults.map((m, idx) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelect(m.fullPath)}
                        className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition cursor-pointer ${
                          isDark
                            ? 'hover:bg-slate-800/70'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          isDark ? 'bg-blue-950/80 text-blue-400' : 'bg-blue-50 text-blue-600'
                        }`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {m.label}
                          </div>
                          <div className={`text-[10px] font-mono truncate ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {m.fullPath}
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Vendor Results */}
              {vendorResults.length > 0 && (
                <div>
                  <div className={`px-4 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-widest ${
                    isDark ? 'text-slate-500' : 'text-slate-400'
                  }`}>
                    Vendors
                  </div>
                  {vendorResults.map((v, idx) => {
                    const vendorId = v._id || v.id || v.vendorId;
                    const name = v.businessName || v.name || v.shopName || 'Unnamed Vendor';
                    const vid = v.vendorId || v.vendorCode || (vendorId ? `VEN-${String(vendorId).slice(-6).toUpperCase()}` : '—');
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleVendorSelect(v)}
                        className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition cursor-pointer ${
                          isDark ? 'hover:bg-slate-800/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`p-1.5 rounded-lg shrink-0 ${
                          isDark ? 'bg-amber-950/80 text-amber-400' : 'bg-amber-50 text-amber-600'
                        }`}>
                          <Store className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {name}
                          </div>
                          <div className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            ID: {vid}
                          </div>
                        </div>
                        <span className={`text-[10px] font-semibold shrink-0 ${
                          isDark ? 'text-amber-400' : 'text-amber-600'
                        }`}>
                          View →
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Loading shimmer for vendors */}
              {loading && moduleResults.length > 0 && (
                <div className={`px-4 py-3 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'} flex items-center gap-2`}>
                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                  Searching vendors...
                </div>
              )}

              {/* Empty state */}
              {showEmpty && (
                <div className="px-4 py-8 text-center">
                  <Search className="w-7 h-7 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className={`text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    No results found
                  </p>
                  <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                    Try another keyword or vendor name.
                  </p>
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className={`px-4 py-2 border-t text-[10px] ${
              isDark ? 'border-slate-800 text-slate-600' : 'border-slate-100 text-slate-400'
            } flex items-center gap-1`}>
              <kbd className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'
              }`}>Esc</kbd>
              <span>to close</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
