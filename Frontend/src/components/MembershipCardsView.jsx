import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { dataService } from '../services/dataService';
import { DataTable } from './DataTable';
import { TierBadge, StatusBadge } from './Badge';
import { MembershipCardVisual } from './MembershipCardVisual';
import { TerritoryHierarchyFilter } from './TerritoryHierarchyFilter';
import { getTerritoryLocking } from '../utils/territoryHelper';
import { CreditCard, Award, Sparkles, TrendingUp, TrendingDown, Minus, MapPin, Eye, X } from 'lucide-react';

export function MembershipCardsView({ title = 'Membership Cards Directory', subtitle = 'Card issuance and status tracking across assigned jurisdiction' }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const locking = useMemo(() => getTerritoryLocking(user), [user]);

  const [cardsData, setCardsData] = useState({ cards: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');
  const [selectedCardForModal, setSelectedCardForModal] = useState(null);

  // Territory filters
  const [selectedState, setSelectedState] = useState(locking.defaultState || '');
  const [selectedDistrict, setSelectedDistrict] = useState(locking.defaultDistrict || '');
  const [selectedDivision, setSelectedDivision] = useState(locking.defaultDivision || '');
  const [selectedPincode, setSelectedPincode] = useState(locking.defaultPincode || '');
  const [territoryTree, setTerritoryTree] = useState([]);

  // Sync locked territory when user profile loads
  useEffect(() => {
    if (locking.stateLocked && locking.defaultState) setSelectedState(locking.defaultState);
    if (locking.districtLocked && locking.defaultDistrict) setSelectedDistrict(locking.defaultDistrict);
    if (locking.divisionLocked && locking.defaultDivision) setSelectedDivision(locking.defaultDivision);
    if (locking.pincodeLocked && locking.defaultPincode) setSelectedPincode(locking.defaultPincode);
  }, [locking]);

  useEffect(() => {
    let isMounted = true;
    dataService.getTerritoryHierarchy().then(res => {
      if (isMounted && res?.success && Array.isArray(res.hierarchy)) setTerritoryTree(res.hierarchy);
      else if (isMounted && res?.data) setTerritoryTree(res.data);
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const reqState = locking.stateLocked ? locking.defaultState : selectedState;
      const reqDistrict = locking.districtLocked ? locking.defaultDistrict : selectedDistrict;
      const reqDivision = locking.divisionLocked ? locking.defaultDivision : selectedDivision;
      const reqPincode = locking.pincodeLocked ? locking.defaultPincode : selectedPincode;

      const params = {
        tier: tierFilter || undefined,
        state: reqState || undefined,
        district: reqDistrict || undefined,
        division: reqDivision || undefined,
        pincode: reqPincode || undefined
      };
      const res = await dataService.getMembershipCards(params);
      if (res && res.success) {
        setCardsData({
          cards: res.cards || [],
          counts: res.counts || {}
        });
      }
    } catch (e) {
      console.error('Failed to load membership cards:', e);
    } finally {
      setLoading(false);
    }
  }, [tierFilter, locking, selectedState, selectedDistrict, selectedDivision, selectedPincode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

      let pct = 0;
      if (prevCount === 0) {
        pct = curCount > 0 ? 100 : 0;
      } else {
        pct = Math.round(Math.abs((curCount - prevCount) / prevCount) * 100);
      }

      return {
        curCount,
        prevCount,
        pct,
        isIncrease: curCount > prevCount,
        isDecrease: curCount < prevCount,
        isNeutral: curCount === prevCount
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
    if (!trend) return null;
    if (trend.isIncrease) {
      return (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
          <span className="flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            +{trend.pct}%
          </span>
          <span className="text-slate-400 dark:text-slate-500 font-normal">vs last month</span>
        </div>
      );
    }
    if (trend.isDecrease) {
      return (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 mt-0.5">
          <span className="flex items-center gap-0.5">
            <TrendingDown className="w-3 h-3 text-rose-500" />
            -{trend.pct}%
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
      header: 'S.No',
      accessor: (row, idx) => idx + 1,
      className: 'w-14 text-center',
      render: (row, idx) => (
        <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
          {idx + 1}
        </span>
      )
    },
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
      render: (row) => (
        <span className="text-xs text-slate-600 dark:text-slate-300 capitalize">
          {row.purchaseType ? String(row.purchaseType).replace(/_/g, ' ') : 'Standard'}
        </span>
      )
    },
    {
      header: 'Amount Paid',
      accessor: 'amount',
      render: (row) => (
        <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
          {row.amount || row.paymentAmount ? `₹${(row.amount || row.paymentAmount).toLocaleString('en-IN')}` : '₹0'}
        </div>
      )
    },
    {
      header: 'Action',
      accessor: 'actions',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedCardForModal(row);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white transition border border-blue-500/20 cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5" /> View Card
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
          {title}
        </h2>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          {subtitle}
        </p>
      </div>

      {/* Territory Filter Toolbar */}
      <TerritoryHierarchyFilter
        territoryTree={territoryTree}
        selectedState={selectedState}
        onStateChange={(st) => {
          setSelectedState(st);
          if (!locking.districtLocked) setSelectedDistrict('');
          if (!locking.divisionLocked) setSelectedDivision('');
          if (!locking.pincodeLocked) setSelectedPincode('');
        }}
        selectedDistrict={selectedDistrict}
        onDistrictChange={(dt) => {
          setSelectedDistrict(dt);
          if (!locking.divisionLocked) setSelectedDivision('');
          if (!locking.pincodeLocked) setSelectedPincode('');
        }}
        selectedDivision={selectedDivision}
        onDivisionChange={(dv) => {
          setSelectedDivision(dv);
          if (!locking.pincodeLocked) setSelectedPincode('');
        }}
        selectedPincode={selectedPincode}
        onPincodeChange={(pin) => setSelectedPincode(pin)}
        onClear={() => {
          if (!locking.stateLocked) setSelectedState('');
          if (!locking.districtLocked) setSelectedDistrict('');
          if (!locking.divisionLocked) setSelectedDivision('');
          if (!locking.pincodeLocked) setSelectedPincode('');
        }}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Cards</span>
            <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {cardsData.counts.total ?? cardsData.cards.filter(c => c.tier !== 'No Card').length}
          </div>
          {renderTrendBadge(tierComparison.total)}
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Silver Cards</span>
            <Award className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {cardsData.counts.silver ?? cardsData.cards.filter(c => c.tier === 'Silver').length}
          </div>
          {renderTrendBadge(tierComparison.silver)}
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Gold Cards</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {cardsData.counts.gold ?? cardsData.cards.filter(c => c.tier === 'Gold').length}
          </div>
          {renderTrendBadge(tierComparison.gold)}
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Diamond Cards</span>
            <Sparkles className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {cardsData.counts.diamond ?? cardsData.cards.filter(c => c.tier === 'Diamond').length}
          </div>
          {renderTrendBadge(tierComparison.diamond)}
        </div>
      </div>

      <DataTable
        title="Membership Cards Directory"
        subtitle="With visible serial numbers • Filter by Diamond, Gold, Silver, or non-card members"
        columns={columns}
        data={cardsData.cards}
        loading={loading}
        onRefresh={loadData}
        filterOptions={[
          { label: 'All Cards', value: '' },
          { label: 'Diamond Card', value: 'Diamond' },
          { label: 'Gold Card', value: 'Gold' },
          { label: 'Silver Card', value: 'Silver' },
          { label: 'No Active Card', value: 'No Card' },
        ]}
        activeFilter={tierFilter}
        onFilterChange={setTierFilter}
        exportFileName="membership_cards_directory.csv"
      />

      {/* Card Visual Preview Modal */}
      {selectedCardForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl transition ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-base">Membership Card Preview</h3>
              <button
                onClick={() => setSelectedCardForModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-center my-4">
              <MembershipCardVisual card={selectedCardForModal} />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedCardForModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
