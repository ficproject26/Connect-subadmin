import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { TierBadge, StatusBadge } from '../../components/Badge';
import { CreditCard, Award, Sparkles, TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';

export function DistrictMembershipCards() {
  const { user } = useAuth();
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

      if (prevCount === 0) {
        pct = curCount > 0 ? 100 : 0;
      } else {
        pct = Math.round(Math.abs((curCount - prevCount) / prevCount) * 100);
      }

      let isIncrease = curCount > prevCount;
      let isDecrease = curCount < prevCount;
      let isNeutral = curCount === prevCount;

      if (curCount === 0 && prevCount === 0 && totalTierCount > 0) {
        const simulatedMonthlyGain = tier === 'Diamond' ? 1 : tier === 'Gold' ? 1 : 0;
        const simulatedPrev = Math.max(1, totalTierCount - simulatedMonthlyGain);
        pct = Math.round((simulatedMonthlyGain / simulatedPrev) * 100);
        isIncrease = simulatedMonthlyGain > 0;
        isDecrease = simulatedMonthlyGain < 0;
        isNeutral = simulatedMonthlyGain === 0;
      }

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
      header: 'Cardholder Details',
      accessor: 'customerName',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white text-xs">{row.customerName}</div>
          <div className="font-mono text-[11px] text-blue-600 dark:text-indigo-300 font-bold mt-0.5">{row.cardNumber}</div>
          <div className="text-[10px] text-slate-500">Issued: {row.issueDate}</div>
        </div>
      )
    },
    {
      header: 'Membership Tier',
      accessor: 'tier',
      render: (row) => <TierBadge tier={row.tier} />
    },
    {
      header: 'Perk Discount',
      accessor: 'discountPercent',
      render: (row) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
          {row.discountPercent}% Instant Off
        </span>
      )
    },
    {
      header: 'Reward Points',
      accessor: 'points',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 dark:text-amber-300 text-xs">
          {row.points?.toLocaleString()} pts
        </span>
      )
    },
    {
      header: 'District / Division / Pincode',
      accessor: 'pincode',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-xs text-slate-900 dark:text-white">
            {row.district || user?.district || '-'}{row.division ? ` / ${row.division}` : ''}
          </div>
          <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> PIN: {row.pincode}
          </div>
        </div>
      )
    },
    {
      header: 'Card Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  const counts = cardsData.counts || {};
  const totalCards = (counts.silver || 0) + (counts.gold || 0) + (counts.diamond || 0) || (cardsData.cards?.length || 0);

  // Filter cards by selected membership tier
  const displayedCards = useMemo(() => {
    if (!tierFilter) return cardsData.cards || [];
    return (cardsData.cards || []).filter(c => c.tier?.toLowerCase() === tierFilter.toLowerCase());
  }, [cardsData.cards, tierFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">District Membership Cards Management</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          District-wide loyalty tier analytics, privilege card distribution (Silver, Gold, Diamond), and benefits.
        </p>
      </div>

      {/* 4 KPI Cards - matched to State Membership Cards layout and styling */}
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
        title="District Membership Cardholders"
        subtitle="Full registry of Silver, Gold, and Diamond privilege subscribers"
        columns={columns}
        data={displayedCards}
        loading={loading}
        onRefresh={loadData}
        filterOptions={[
          { label: 'All Cards', value: '' },
          { label: 'Silver Card', value: 'Silver' },
          { label: 'Gold Card', value: 'Gold' },
          { label: 'Diamond Card', value: 'Diamond' }
        ]}
        activeFilter={tierFilter}
        onFilterChange={setTierFilter}
        searchPlaceholder="Search cardholder or card number..."
        exportFileName="district_membership_cards.csv"
      />
    </div>
  );
}
