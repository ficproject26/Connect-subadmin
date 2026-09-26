import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { TierBadge, StatusBadge } from '../../components/Badge';
import { useTheme } from '../../context/ThemeContext';
import { Users, Phone, MapPin, CreditCard, UserCheck, TrendingUp } from 'lucide-react';

export function DivisionalCustomers() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [customers, setCustomers] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');
  const [searchParams] = useSearchParams();

  const pincodeFilter = searchParams.get('pincode');
  const divisionName = user?.division || '';

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, allRes] = await Promise.all([
        dataService.getCustomers({ tier: tierFilter, division: divisionName }),
        dataService.getCustomers({ division: divisionName })
      ]);
      let list = res.success ? (res.customers || []) : [];
      let allList = allRes.success ? (allRes.customers || []) : [];

      if (pincodeFilter) {
        list = list.filter(c => String(c.pincode) === String(pincodeFilter));
      }
      setCustomers(list);
      setAllCustomers(allList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tierFilter, pincodeFilter]);

  // Compute 4 KPI stats from all customer records
  const kpiStats = useMemo(() => {
    const dataset = allCustomers.length > 0 ? allCustomers : customers;
    const total = dataset.length;
    const nonCard = dataset.filter(c => !c.membership?.tier).length;
    const cards = dataset.filter(c => c.membership?.tier).length;

    const pinCounts = dataset.reduce((acc, c) => {
      const pin = String(c.pincode || '');
      if (pin) acc[pin] = (acc[pin] || 0) + 1;
      return acc;
    }, {});

    let peakPin = '-';
    let peakCount = 0;
    Object.entries(pinCounts).forEach(([pin, count]) => {
      if (count > peakCount) {
        peakCount = count;
        peakPin = pin;
      }
    });

    return {
      total,
      nonCard,
      cards,
      peakPin,
      peakCount
    };
  }, [allCustomers, customers]);

  const columns = [
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
      render: (row) => (
        <div className="space-y-0.5">
          <div className={`font-semibold text-xs ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
            {row.division || divisionName}
          </div>
          <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> PIN: {row.pincode}
          </div>
        </div>
      )
    },
    {
      header: 'Orders & Spend',
      accessor: 'totalSpent',
      render: (row) => (
        <div>
          <div className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
            ₹{row.totalSpent?.toLocaleString()}
          </div>
          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {row.totalOrders} total orders
          </div>
        </div>
      )
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
          Division Customer Directory
        </h2>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          All registered customers within {divisionName} Division jurisdiction, including card and non-card members.
        </p>
      </div>

      {/* 4 Metric Cards matching District Model */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Customers */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Customers</span>
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.total.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            100% active roster
          </div>
        </div>

        {/* KPI 2: Customers (Without Card) */}
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

        {/* KPI 3: Membership Cards */}
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

        {/* KPI 4: Customer Peak */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Customer Peak</span>
            <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 truncate">
            PIN: {kpiStats.peakPin}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 truncate">
            {kpiStats.peakCount} customers &bull; Peak zone
          </div>
        </div>
      </div>

      <DataTable
        title="Customer Profiles & Membership Tiers"
        subtitle="Filter by All, Diamond, Gold, Silver, or non-card Customers"
        columns={columns}
        data={customers}
        loading={loading}
        onRefresh={loadData}
        filterOptions={[
          { label: 'All Customers', value: '' },
          { label: 'Diamond Card', value: 'Diamond' },
          { label: 'Gold Card', value: 'Gold' },
          { label: 'Silver Card', value: 'Silver' },
          { label: 'Customer (No Card)', value: 'Customer' },
        ]}
        activeFilter={tierFilter}
        onFilterChange={setTierFilter}
        exportFileName="divisional_customers.csv"
      />
    </div>
  );
}
