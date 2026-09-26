import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Award, 
  Building2, 
  Layers, 
  MapPin, 
  ArrowRight, 
  ArrowUpRight, 
  Store, 
  Eye, 
  ShieldCheck, 
  CheckCircle2 
} from 'lucide-react';

export function AgentHierarchyBanner({ activeLevel = 'state', basePath = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentBase = basePath || (location.pathname.startsWith('/district-admin') ? '/district-admin' : '/state-admin');

  const levels = [
    {
      id: 'state',
      num: '1',
      title: 'State Agent',
      tier: 'Tier 1 • Apex',
      scope: 'Statewide (Tamil Nadu)',
      desc: 'Complete agent & activity oversight across state',
      icon: Award,
      path: currentBase === '/district-admin' ? '/district-admin/agents/district' : '/state-admin/agents/state',
      activeColor: 'from-purple-600 to-indigo-600 text-white shadow-purple-500/20',
      badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300'
    },
    {
      id: 'district',
      num: '2',
      title: 'District Agent',
      tier: 'Tier 2 • Territory',
      scope: 'District Level',
      desc: 'Supervises divisions & territorial onboarding',
      icon: Building2,
      path: `${currentBase}/agents/district`,
      activeColor: 'from-blue-600 to-cyan-600 text-white shadow-blue-500/20',
      badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300'
    },
    {
      id: 'divisional',
      num: '3',
      title: 'Divisional Agent',
      tier: 'Tier 3 • Cluster',
      scope: 'Division Level',
      desc: 'Reviews & verifies pincode ground activities',
      icon: Layers,
      path: `${currentBase}/agents/divisional`,
      activeColor: 'from-emerald-600 to-teal-600 text-white shadow-emerald-500/20',
      badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
    },
    {
      id: 'pincode',
      num: '4',
      title: 'Pincode Agent',
      tier: 'Tier 4 • Ground',
      scope: 'Pincode Level',
      desc: 'Field execution, cards & vendor onboarding',
      icon: MapPin,
      path: `${currentBase}/agents/pincode`,
      activeColor: 'from-amber-600 to-orange-600 text-white shadow-amber-500/20',
      badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
    }
  ];

  return (
    <div className="space-y-4">
      {/* 4-Tier Interactive Navigation Pipeline */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800/90 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                Strict Hierarchy Structure
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                State → District → Division → Pincode
              </span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-1">
              Hierarchical Agent Operational Network
            </h3>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 self-start md:self-auto bg-slate-50 dark:bg-slate-800/70 px-3 py-1.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
            <Eye className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-300">Visibility Scope:</span>
            <span>Upper tiers oversee all subordinate levels</span>
          </div>
        </div>

        {/* 4 Level Cards / Switcher */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {levels.map((lvl, index) => {
            const Icon = lvl.icon;
            const isSelected = activeLevel === lvl.id;

            return (
              <button
                key={lvl.id}
                type="button"
                onClick={() => navigate(lvl.path)}
                className={`relative text-left p-3.5 rounded-xl transition-all duration-200 border ${
                  isSelected
                    ? `bg-gradient-to-br ${lvl.activeColor} border-transparent shadow-lg text-white`
                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : lvl.badgeColor
                  }`}>
                    {lvl.tier}
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                      {lvl.title}
                    </span>
                    {index < levels.length - 1 && (
                      <span className={`text-[10px] ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>↓</span>
                    )}
                  </div>
                  <div className={`text-[11px] font-medium mt-0.5 ${isSelected ? 'text-white/90' : 'text-blue-600 dark:text-blue-400 font-semibold'}`}>
                    {lvl.scope}
                  </div>
                  <div className={`text-[10px] mt-1 line-clamp-1 ${isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                    {lvl.desc}
                  </div>
                </div>

                {isSelected && (
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 ring-4 ring-emerald-400/30 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Activity & Vendor Onboarding Flow Indicator */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-md border border-indigo-900/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-300">
                Agent Activity & Vendor Onboarding Flow
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Ground vendor onboarding begins at the Pincode Agent and flows upward through Division and District to State oversight.
            </p>
          </div>

          {/* Flow Stepper visualization */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] font-semibold">
            {/* Step 1 */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200">
              <MapPin className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Pincode Agent</span>
            </div>
            <span className="text-slate-400">➔</span>

            {/* Step 2 */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-500/20 border border-blue-400/40 text-blue-200">
              <Store className="w-3.5 h-3.5 text-blue-400" />
              <span>2. Vendor Onboarding</span>
            </div>
            <span className="text-slate-400">➔</span>

            {/* Step 3 */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>3. Divisional Agent</span>
            </div>
            <span className="text-slate-400">➔</span>

            {/* Step 4 */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-200">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>4. District Agent</span>
            </div>
            <span className="text-slate-400">➔</span>

            {/* Step 5 */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-purple-500/30 border border-purple-400/50 text-purple-200 font-bold">
              <Award className="w-3.5 h-3.5 text-purple-300" />
              <span>5. State Agent (Apex)</span>
            </div>
          </div>
        </div>

        {/* Visibility Rule Pills */}
        <div className="mt-3 pt-3 border-t border-indigo-900/40 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-300">
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Pincode activity visible to Divisional Agent</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Divisional activity visible to District Agent</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>District activity visible to State Agent</span>
          </div>
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg font-semibold text-purple-200">
            <ShieldCheck className="w-3 h-3 text-purple-400 shrink-0" />
            <span>State Agent views complete statewide activity</span>
          </div>
        </div>
      </div>
    </div>
  );
}
