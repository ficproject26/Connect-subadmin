import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { TierBadge, StatusBadge } from '../../components/Badge';
import { MembershipCardVisual } from '../../components/MembershipCardVisual';
import { Modal } from '../../components/Modal';
import { CreditCard, Sparkles, Award, ShieldCheck, ArrowUpRight, MapPin } from 'lucide-react';

export function PincodeMembershipCards() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [cardsData, setCardsData] = useState({ counts: {}, cards: [] });
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');
  
  // Upgrade Modal
  const [selectedCard, setSelectedCard] = useState(null);
  const [newTier, setNewTier] = useState('Diamond');
  const [bonusPoints, setBonusPoints] = useState(500);
  const [updating, setUpdating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getMembershipCards();
      if (res.success) setCardsData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpgrade = async () => {
    if (!selectedCard) return;
    setUpdating(true);
    try {
      await dataService.upgradeMembership({
        customerId: selectedCard.customerId,
        tier: newTier,
        pointsBonus: bonusPoints
      });
      setSelectedCard(null);
      loadData();
    } catch (e) {
      alert(e.message || 'Upgrade failed');
    } finally {
      setUpdating(false);
    }
  };

  const filteredCards = useMemo(() => {
    const list = cardsData.cards || [];
    if (!tierFilter) return list;
    if (tierFilter.toLowerCase() === 'no card') {
      return list.filter(c => c.tier?.toLowerCase() === 'no card' || c.hasCard === false);
    }
    return list.filter(c => c.tier?.toLowerCase() === tierFilter.toLowerCase());
  }, [cardsData.cards, tierFilter]);

  const columns = [
    {
      header: 'Card Number & Holder',
      accessor: 'cardNumber',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-mono font-bold text-xs text-blue-600 dark:text-indigo-300">{row.cardNumber || '-'}</div>
          <div className="font-bold text-xs text-slate-900 dark:text-white">{row.customerName || 'Customer Member'}</div>
          {(row.customerMobile || row.mobile || row.customerPhone || row.phone) && (
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
              {row.customerMobile || row.mobile || row.customerPhone || row.phone}
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
          <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
            <MapPin className="w-3.5 h-3.5" /> PIN: {row.pincode || user?.pincode || '-'}
          </div>
          {row.division && (
            <div className="text-[10px] text-slate-400 dark:text-slate-500">{row.division}</div>
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
      header: 'Purchase Type & Actions',
      accessor: 'purchaseType',
      render: (row) => {
        const pType = row.purchaseType || row.transactionType || row.action || '';
        const prevTier = row.previousTier || row.fromTier || row.upgradedFrom || '';
        const curTier = row.tier || row.currentTier || '';

        const isUpgrade = pType.toLowerCase().includes('upgrade') || (prevTier && curTier && prevTier !== curTier);
        const isDowngrade = pType.toLowerCase().includes('downgrade');
        const isRenewal = pType.toLowerCase().includes('renew');
        const isReplacement = pType.toLowerCase().includes('replac');

        let badge = null;
        if (isUpgrade && prevTier && curTier) {
          badge = (
            <div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                UPGRADED
              </span>
              <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                {prevTier} → {curTier}
              </div>
            </div>
          );
        } else if (isUpgrade) {
          badge = (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              UPGRADED
            </span>
          );
        } else if (isDowngrade) {
          badge = (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              DOWNGRADED
            </span>
          );
        } else if (isRenewal) {
          badge = (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              RENEWAL
            </span>
          );
        } else if (isReplacement) {
          badge = (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
              REPLACEMENT
            </span>
          );
        } else if (row.tier === 'No Card') {
          badge = (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              NO CARD
            </span>
          );
        } else {
          badge = (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              NEW PURCHASE
            </span>
          );
        }

        return (
          <div className="flex items-center gap-2">
            {badge}
            {row.tier !== 'Diamond' && row.tier !== 'No Card' && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCard(row);
                  setNewTier(row.tier === 'Diamond' ? 'Diamond' : row.tier === 'Gold' ? 'Diamond' : 'Gold');
                }}
                className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold transition flex items-center gap-0.5 cursor-pointer shrink-0"
              >
                <ArrowUpRight className="w-3 h-3" />
                <span>Upgrade</span>
              </button>
            )}
          </div>
        );
      }
    }
  ];

  const counts = cardsData.counts || {};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pincode Membership Cards</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Manage privilege loyalty cards across Silver, Gold, and Diamond tiers in this Pincode jurisdiction.
        </p>
      </div>

      {/* Tier Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Silver Card Box */}
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Silver Advantage</span>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              5% Off
            </span>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white mt-3 font-mono">
            {counts.silver || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Active Silver cardholders</p>
        </div>

        {/* Gold Card Box */}
        <div className="p-4 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Gold Privilege</span>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              12% Off
            </span>
          </div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-3 font-mono">
            {counts.gold || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Active Gold cardholders</p>
        </div>

        {/* Diamond Card Box */}
        <div className="p-4 rounded-2xl border border-cyan-200/80 dark:border-cyan-800/40 bg-white dark:bg-slate-900/60 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">Diamond VIP</span>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
              20% Off
            </span>
          </div>
          <div className="text-3xl font-black text-cyan-600 dark:text-cyan-400 mt-3 font-mono">
            {counts.diamond || 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Active VIP Diamond members</p>
        </div>
      </div>

      {/* Cards Table */}
      <DataTable
        title="Membership Cards Directory"
        subtitle="Full registry of Silver, Gold, and Diamond privilege subscribers"
        columns={columns}
        data={filteredCards}
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
        exportFileName="pincode_membership_cards.csv"
      />

      {/* Upgrade Tier Modal */}
      <Modal
        isOpen={!!selectedCard}
        onClose={() => setSelectedCard(null)}
        title="Upgrade Customer Membership Tier"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500">Card Holder</div>
            <div className="font-bold text-slate-900 dark:text-white text-base">{selectedCard?.customerName}</div>
            <div className="text-xs font-mono text-slate-400 mt-0.5">{selectedCard?.cardNumber}</div>
            <div className="mt-2 text-xs">
              Current Tier: <TierBadge tier={selectedCard?.tier} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Select New Membership Tier
            </label>
            <div className="grid grid-cols-3 gap-2">
              {['Silver', 'Gold', 'Diamond'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewTier(t)}
                  className={`p-3 rounded-xl border text-xs font-bold transition flex flex-col items-center gap-1 cursor-pointer ${
                    newTier === t
                      ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{t}</span>
                  <span className="text-[10px] font-normal opacity-80">
                    {t === 'Diamond' ? '20% Off' : t === 'Gold' ? '12% Off' : '5% Off'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Bonus Loyalty Points to Award
            </label>
            <input
              type="number"
              value={bonusPoints}
              onChange={(e) => setBonusPoints(e.target.value)}
              placeholder="e.g. 500"
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setSelectedCard(null)}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              disabled={updating}
              onClick={handleUpgrade}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              {updating ? 'Upgrading...' : `Confirm Upgrade to ${newTier}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
