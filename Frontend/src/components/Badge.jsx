import React from 'react';
import { CreditCard } from 'lucide-react';
import { TIER_CONFIG } from '../utils/constants';

export function CardTierIcon({ tier, className = 'w-3.5 h-3.5' }) {
  const normalized = tier ? tier.toLowerCase() : '';
  let fillColor = '#06b6d4'; // Cyan for Diamond
  let strokeColor = '#0891b2';
  let stripeColor = '#ffffff';

  if (normalized === 'gold') {
    fillColor = '#f59e0b'; // Amber for Gold
    strokeColor = '#d97706';
    stripeColor = '#ffffff';
  } else if (normalized === 'silver') {
    fillColor = '#94a3b8'; // Slate for Silver
    strokeColor = '#64748b';
    stripeColor = '#ffffff';
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={`shrink-0 select-none ${className}`}
      fill="none"
    >
      <rect
        width="20"
        height="14"
        x="2"
        y="5"
        rx="2.5"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth="1.2"
      />
      <line
        x1="2"
        x2="22"
        y1="9.5"
        y2="9.5"
        stroke={stripeColor}
        strokeWidth="1.8"
        strokeOpacity="0.9"
      />
    </svg>
  );
}

export function TierBadge({ tier, className = '' }) {
  const norm = tier ? tier.toLowerCase() : '';
  if (!tier || norm === 'customer' || norm === 'customers' || norm === 'no card') {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 whitespace-nowrap shrink-0 ${className}`}>
        {norm === 'no card' ? 'No Card' : 'Customer'}
      </span>
    );
  }

  const normalizedTier = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
  const config = TIER_CONFIG[normalizedTier] || TIER_CONFIG[tier] || TIER_CONFIG.Silver;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0 ${config.badgeClass} ${className}`}>
      <CardTierIcon tier={normalizedTier} className="w-3 h-3" />
      {normalizedTier} Card
    </span>
  );
}

export function StatusBadge({ status, className = '' }) {
  if (!status) return null;

  const s = status.toLowerCase();
  let colorStyles = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

  if (['active', 'delivered', 'approved', 'verified', 'resolved', 'available', 'shortlisted', 'selected', 'selected / offer', 'completed', 'kyc approved'].includes(s)) {
    colorStyles = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-500/30';
  } else if (['paid', 'packed', 'confirmed', 'interview scheduled', 'interview', 'reviewed', 'pincode admin approved', 'kyc pending', 'pending kyc review'].includes(s)) {
    colorStyles = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/70 dark:text-indigo-300 dark:border-indigo-500/30';
  } else if (['pending', 'processing', 'scheduled', 'busy', 'order placed', 'under review', 'application submitted', 'pending pincode admin approval', 'pending verification'].includes(s)) {
    colorStyles = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-500/30';
  } else if (['in progress', 'shipped', 'out for delivery', 'on duty'].includes(s)) {
    colorStyles = 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/70 dark:text-sky-300 dark:border-sky-500/30';
  } else if (['rejected', 'cancelled', 'inactive', 'urgent', 'high', 'pincode admin rejected', 'kyc rejected'].includes(s)) {
    colorStyles = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-500/30';
  } else if (['return requested', 'return approved', 'returned'].includes(s)) {
    colorStyles = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-500/30';
  }

  let displayLabel = status;
  if (s === 'pending pincode admin approval') {
    displayLabel = 'Pending Pincode Approval';
  } else if (s === 'pincode admin approved') {
    displayLabel = 'Pincode Approved';
  } else if (s === 'pincode admin rejected') {
    displayLabel = 'Pincode Rejected';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap shrink-0 ${colorStyles} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0"></span>
      <span>{displayLabel}</span>
    </span>
  );
}
