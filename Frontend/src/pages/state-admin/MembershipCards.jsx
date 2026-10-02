import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { TierBadge, StatusBadge } from '../../components/Badge';
import { MembershipCardVisual } from '../../components/MembershipCardVisual';
import { useTheme } from '../../context/ThemeContext';
import { CreditCard, Award, Sparkles, TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';

export function StateMembershipCards() {
  const { isDark } = useTheme();
  const [cardsData, setCardsData] = useState({ cards: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getMembershipCards();
      if (res.success) {
        setCardsData({
          cards: res.cards || [],
          counts: res.counts || {}
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute current vs last month stats dynamically
  const tierComparison = useMemo(() => {
    const cards = cardsData.cards || [];
    const counts = cardsData.counts || {};

    // Get current month and previous month strings based on latest data or real date
    const dates = cards
      .map(c => c.issueDate)
      .filter(Boolean)
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()));

    // Reference date is the latest issue date or today
    const refDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
    const curYear = refDate.getFullYear();
    const curMonth = refDate.getMonth(); // 0-indexed

    const prevDate = new Date(curYear, curMonth - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth();

    const calcTrend = (tier) => {
      const tierCards = tier ? cards.filter(c => c.tier === tier) : cards;
      const curCount = tierCards.filter(c => {
        if (!c.issueDate) return false;
        const d = new Date(c.issueDate);
        return d.getFullYear() === curYear && d.getMonth() === curMonth;
      }).length;

      const prevCount = tierCards.filter(c => {
        if (!c.issueDate) return false;
        const d = new Date(c.issueDate);
        return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
      }).length;

      // Overall count from server or cards
      const totalTierCount = tier ? (counts[tier.toLowerCase()] ?? tierCards.length) : (cards.length);

      let pct = 0;
      let diff = curCount - prevCount;

      if (prevCount === 0) {
        pct = curCount > 0 ? 100 : 0;
      } else {
        pct = Math.round(Math.abs((curCount - prevCount) / prevCount) * 100);
      }

      // If no cards were issued in the latest 2-month window (e.g. historical baseline),
      let isIncrease = curCount > prevCount;
      let isDecrease = curCount < prevCount;
      let isNeutral = curCount === prevCount;

      return {
        curCount,
        prevCount,
        pct,
        isIncrease,
        isDecrease,
        isNeutral
      };
    };

    return {
      total: calcTrend(null),
      silver: calcTrend('Silver'),
      gold: calcTrend('Gold'),
      diamond: calcTrend('Diamond')
    };
  }, [cardsData]);

  const renderTrendBadge = (trend) => {
    if (trend.isIncrease) {
      return (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
          <span className="flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            ↑ {trend.pct}% Increase
          </span>
          <span className="text-slate-400 dark:text-slate-500 font-normal">vs last month</span>
        </div>
      );
    }
    if (trend.isDecrease) {
      return (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
          <span className="flex items-center gap-0.5">
            <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            ↓ {trend.pct}% Decrease
          </span>
          <span className="text-slate-400 dark:text-slate-500 font-normal">vs last month</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
        <span className="flex items-center gap-0.5">
          <Minus className="w-3 h-3 text-slate-400" />
          0% Change
        </span>
        <span className="text-slate-400 dark:text-slate-500 font-normal">vs last month</span>
      </div>
    );
  };

  const columns = [
    {
      header: 'Card Number & Holder',
      accessor: 'customerName',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-mono font-bold text-xs text-blue-600 dark:text-indigo-300">{row.cardNumber || '-'}</div>
          <div className="font-bold text-xs text-slate-900 dark:text-white">{row.customerName || 'Customer Member'}</div>
          {(row.customerMobile || row.mobile || row.phone) && (
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              {row.customerMobile || row.mobile || row.phone}
            </div>
          )}
          {(row.customerId || row.customer_id || row.cid) && (
            <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
              {String(row.customerId || row.customer_id || row.cid).startsWith('CUST')
                ? (row.customerId || row.customer_id || row.cid)
                : `CUST-${row.customerId || row.customer_id || row.cid}`}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Membership Tier',
      accessor: 'tier',
      render: (row) => <TierBadge tier={row.tier} />
    },
    {
      header: 'Territory / Pincode',
      accessor: 'pincode',
      render: (row) => (
        <div className="space-y-0.5">
          {(row.district || row.division) && (
            <div className="font-semibold text-xs text-slate-900 dark:text-white">
              {row.district}{row.division ? ` / ${row.division}` : ''}
            </div>
          )}
          {row.pincode && (
            <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {row.pincode}
            </div>
          )}
          {row.state && (
            <div className="text-[10px] text-slate-400 dark:text-slate-500">{row.state}</div>
          )}
          {!row.pincode && !row.district && (
            <span className="text-slate-400 text-xs">-</span>
          )}
        </div>
      )
    },
    {
      header: 'Validity Period',
      accessor: 'issueDate',
      render: (row) => {
        const issued = row.issueDate
          ? new Date(row.issueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : '-';
        const expires = row.expiryDate || row.expiry || row.validUntil || row.expiresAt
          ? new Date(row.expiryDate || row.expiry || row.validUntil || row.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : null;
        return (
          <div className="space-y-0.5 text-xs">
            <div className={`${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
              <span className="text-slate-400">Issued:</span> {issued}
            </div>
            <div className={`${expires ? (isDark ? 'text-slate-300' : 'text-slate-700') : 'text-rose-400'}`}>
              <span className="text-slate-400">Expires:</span> {expires || 'Not set'}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Card Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Purchase Type',
      accessor: 'purchaseType',
      render: (row) => {
        const pType = row.purchaseType || row.transactionType || row.action || '';
        const prevTier = row.previousTier || row.fromTier || row.upgradedFrom || '';
        const curTier = row.tier || row.currentTier || '';

        const isUpgrade = pType.toLowerCase().includes('upgrade') || (prevTier && curTier && prevTier !== curTier);
        const isDowngrade = pType.toLowerCase().includes('downgrade');
        const isRenewal = pType.toLowerCase().includes('renew');
        const isReplacement = pType.toLowerCase().includes('replac');

        if (isUpgrade && prevTier && curTier) {
          return (
            <div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                UPGRADED
              </span>
              <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                {prevTier} → {curTier}
              </div>
            </div>
          );
        }
        if (isUpgrade) {
          return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              UPGRADED
            </span>
          );
        }
        if (isDowngrade) {
          return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              DOWNGRADED
            </span>
          );
        }
        if (isRenewal) {
          return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              RENEWAL
            </span>
          );
        }
        if (isReplacement) {
          return (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              REPLACEMENT
            </span>
          );
        }
        // Default: new purchase
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            NEW PURCHASE
          </span>
        );
      }
    }
  ];

  const counts = cardsData.counts || {};
  const totalCards = (counts.silver || 0) + (counts.gold || 0) + (counts.diamond || 0) || (cardsData.cards?.length || 0);

  // Filter cards by selected membership tier
  const displayedCards = useMemo(() => {
    if (!tierFilter) return cardsData.cards || [];
    if (tierFilter.toLowerCase() === 'no card') {
      return (cardsData.cards || []).filter(c => c.tier?.toLowerCase() === 'no card' || c.hasCard === false);
    }
    return (cardsData.cards || []).filter(c => c.tier?.toLowerCase() === tierFilter.toLowerCase());
  }, [cardsData.cards, tierFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">State Membership Cards Management</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          State-wide loyalty tier analytics, privilege card distribution (Silver, Gold, Diamond), and benefits.
        </p>
      </div>

      {/* 4 KPI Cards - matched to Managers / Customers styling and size */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Membership Cards */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Cards</span>
            <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {totalCards.toLocaleString()}
          </div>
          {renderTrendBadge(tierComparison.total)}
        </div>

        {/* KPI 2: Silver Cards */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Silver Cards</span>
            <Award className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {(counts.silver || 0).toLocaleString()}
          </div>
          {renderTrendBadge(tierComparison.silver)}
        </div>

        {/* KPI 3: Gold Cards */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Gold Cards</span>
            <Award className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {(counts.gold || 0).toLocaleString()}
          </div>
          {renderTrendBadge(tierComparison.gold)}
        </div>

        {/* KPI 4: Diamond Cards */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Diamond Cards</span>
            <Sparkles className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {(counts.diamond || 0).toLocaleString()}
          </div>
          {renderTrendBadge(tierComparison.diamond)}
        </div>
      </div>

      {/* Cards Table */}
      <DataTable
        title="State Membership Cardholders"
        subtitle="Full registry of Silver, Gold, and Diamond privilege subscribers"
        columns={columns}
        data={displayedCards}
        loading={loading}
        onRefresh={loadData}
        filterOptions={[
          { label: 'All', value: '' },
          { label: 'Diamond', value: 'Diamond' },
          { label: 'Gold', value: 'Gold' },
          { label: 'Silver', value: 'Silver' },
          { label: 'Customer (No Card)', value: 'No Card' }
        ]}
        activeFilter={tierFilter}
        onFilterChange={setTierFilter}
        searchPlaceholder="Search cardholder or card number..."
        exportFileName="state_membership_cards.csv"
      />
    </div>
  );
}
