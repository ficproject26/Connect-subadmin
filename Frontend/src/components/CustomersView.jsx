import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { dataService } from '../services/dataService';
import { DataTable } from './DataTable';
import { TierBadge, StatusBadge } from './Badge';
import { CustomerDetailsModal } from './CustomerDetailsModal';
import { TerritoryHierarchyFilter } from './TerritoryHierarchyFilter';
import { getTerritoryLocking } from '../utils/territoryHelper';
import { Users, Phone, MapPin, CreditCard, UserCheck, TrendingUp, RefreshCw } from 'lucide-react';

export function CustomersView({ title = 'Customer Directory', subtitle = 'All registered customers within assigned jurisdiction' }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const locking = useMemo(() => getTerritoryLocking(user), [user]);

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

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
      const res = await dataService.getCustomers(params);
      if (res && res.success) {
        setCustomers(res.customers || res.data || []);
      }
    } catch (e) {
      console.error('Failed to load customers:', e);
    } finally {
      setLoading(false);
    }
  }, [tierFilter, locking, selectedState, selectedDistrict, selectedDivision, selectedPincode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute 4 KPI stats from customer records
  const kpiStats = useMemo(() => {
    const total = customers.length;
    const hasActiveCard = (c) => Boolean(c.membership?.tier && String(c.membership?.status || '').toLowerCase() === 'active');
    const cards = customers.filter(hasActiveCard).length;
    const nonCard = total - cards;

    const districtCounts = customers.reduce((acc, c) => {
      const dist = c.district && c.district !== 'Unknown' ? c.district : (c.division || '');
      if (dist) acc[dist] = (acc[dist] || 0) + 1;
      return acc;
    }, {});

    let peakDistrict = total > 0 ? 'All Assigned' : '—';
    let peakCount = 0;
    Object.entries(districtCounts).forEach(([dist, count]) => {
      if (count > peakCount) {
        peakCount = count;
        peakDistrict = dist;
      }
    });

    return {
      total,
      nonCard,
      cards,
      peakDistrict,
      peakCount
    };
  }, [customers]);

  const columns = [
    {
      header: 'S.No.',
      accessor: (row, idx) => idx + 1,
      className: 'w-14 text-center',
      render: (row, idx) => (
        <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
          {idx + 1}
        </span>
      )
    },
    {
      header: 'Customer Details',
      accessor: 'name',
      render: (row) => (
        <div>
          <div className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>{row.name}</div>
          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{row.email}</div>
          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-1 mt-0.5`}>
            <Phone className="w-3 h-3 text-slate-400" />
            {row.phone}
          </div>
        </div>
      )
    },
    {
      header: 'Membership Tier',
      accessor: (row) => row.membership?.tier ? `${row.membership.tier} Card` : 'Customer',
      render: (row) => (
        <div>
          <TierBadge tier={row.membership?.tier || 'Customer'} />
          {row.membership?.cardNumber && (
            <div className="font-mono text-[11px] text-blue-600 dark:text-indigo-300 font-semibold mt-1">
              {row.membership.cardNumber}
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Geographic Scope',
      accessor: 'pincode',
      render: (row) => {
        const areaParts = [row.district, row.division].filter(Boolean);
        const streetCity = [row.street, row.city && row.city !== row.district ? row.city : ''].filter(Boolean).join(', ');
        return (
          <div className="space-y-0.5">
            {areaParts.length > 0 && (
              <div className={`font-semibold text-xs ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {areaParts.join(' • ')}
              </div>
            )}
            {streetCity && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={row.fullAddress || streetCity}>
                {streetCity}
              </div>
            )}
            {row.pincode && (
              <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> PIN: {row.pincode}
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Orders & Spend',
      accessor: 'totalSpent',
      render: (row) => {
        const spent = Number(row.totalSpent || row.totalSpend || 0);
        const orders = Number(row.totalOrders || row.ordersCount || 0);
        const bookings = Number(row.totalBookings || row.bookingsCount || 0);

        return (
          <div>
            <div className={`font-bold font-mono text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
              ₹{spent.toLocaleString('en-IN')}
            </div>
            <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-1 mt-0.5`}>
              <span>{orders} {orders === 1 ? 'total order' : 'total orders'}</span>
              {bookings > 0 && (
                <>
                  <span>•</span>
                  <span>{bookings} {bookings === 1 ? 'booking' : 'bookings'}</span>
                </>
              )}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
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

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Customers</span>
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.total.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Newest registrations first
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Customers</span>
            <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.nonCard.toLocaleString()}
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
            Without membership card
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Membership Cards</span>
            <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.cards.toLocaleString()}
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
            Active cardholders
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Customer Peak</span>
            <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 truncate" title={kpiStats.peakDistrict}>
            {kpiStats.peakDistrict}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 truncate">
            {kpiStats.peakCount > 0 ? `${kpiStats.peakCount} customers • Peak district` : (kpiStats.total > 0 ? `${kpiStats.total} customers in jurisdiction` : '0 customers')}
          </div>
        </div>
      </div>

      <DataTable
        title="Customer Profiles & Membership Tiers"
        subtitle="Sorted by newest registration timestamp first • Filter by tier or territory"
        columns={columns}
        data={customers}
        loading={loading}
        onRefresh={loadData}
        onRowClick={(row) => setSelectedCustomer(row)}
        filterOptions={[
          { label: 'All Customers', value: '' },
          { label: 'Diamond Card', value: 'Diamond' },
          { label: 'Gold Card', value: 'Gold' },
          { label: 'Silver Card', value: 'Silver' },
          { label: 'Customer (No Card)', value: 'Customer' },
        ]}
        activeFilter={tierFilter}
        onFilterChange={setTierFilter}
        exportFileName="customers_directory.csv"
      />

      {selectedCustomer && (
        <CustomerDetailsModal
          isOpen={!!selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
          customer={selectedCustomer}
        />
      )}
    </div>
  );
}
