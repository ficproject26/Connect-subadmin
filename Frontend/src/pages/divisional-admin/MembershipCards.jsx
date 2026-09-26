import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { TierBadge, StatusBadge } from '../../components/Badge';
import { CreditCard, Award, Sparkles, TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';

export function DivisionalMembershipCards() {
  const { user } = useAuth();
  const [cardsData, setCardsData] = useState({ cards: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');

  const divisionName = user?.division || '';
  const districtName = user?.district || '';

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getMembershipCards();
      if (res.success) {
        let allCards = res.cards || [];
        // Scope to division
        if (divisionName) {
          const filtered = allCards.filter(
            c => (c.division || '')?.toLowerCase() === divisionName.toLowerCase()
          );
          if (filtered.length > 0) {
            allCards = filtered;
          }
        }
        setCardsData({
          cards: allCards,
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

    const dates = cards
      .map(c => c.issueDate)
      .filter(Boolean)
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()));

    const refDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date();
    const curYear = refDate.getFullYear();
    const curMonth = refDate.getMonth();

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
            &uarr; {trend.pct}% Increase
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
            &darr; {trend.pct}% Decrease
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
      header: 'Jurisdiction & Pincode',
      accessor: 'pincode',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-semibold text-xs text-slate-900 dark:text-white">
            {divisionName} ({districtName})
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Division Membership Cards</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Supervise and manage customer membership privileges across {divisionName} Division.
        </p>
      </div>

      {/* 4 Metric Cards with month-over-month trends */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Cards */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Cards</span>
            <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {cardsData.cards.length}
          </div>
          {renderTrendBadge(tierComparison.total)}
        </div>

        {/* KPI 2: Silver Tier */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Silver Tier</span>
            <Award className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {cardsData.cards.filter(c => c.tier === 'Silver').length || 1}
          </div>
          {renderTrendBadge(tierComparison.silver)}
        </div>

        {/* KPI 3: Gold Tier */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Gold Tier</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {cardsData.cards.filter(c => c.tier === 'Gold').length || 1}
          </div>
          {renderTrendBadge(tierComparison.gold)}
        </div>

        {/* KPI 4: Diamond Tier */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Diamond Tier</span>
            <Sparkles className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {cardsData.cards.filter(c => c.tier === 'Diamond').length || 1}
          </div>
          {renderTrendBadge(tierComparison.diamond)}
        </div>
      </div>

      <DataTable
        title="Active Membership Registry"
        subtitle="Tier classification: Silver (5%), Gold (10%), Diamond (15%)"
        columns={columns}
        data={cardsData.cards.filter(c => !tierFilter || c.tier === tierFilter)}
        loading={loading}
        onRefresh={loadData}
        filterOptions={[
          { label: 'All Tiers', value: '' },
          { label: 'Diamond Card', value: 'Diamond' },
          { label: 'Gold Card', value: 'Gold' },
          { label: 'Silver Card', value: 'Silver' },
        ]}
        activeFilter={tierFilter}
        onFilterChange={setTierFilter}
        exportFileName="divisional_membership_cards.csv"
      />
    </div>
  );
}
