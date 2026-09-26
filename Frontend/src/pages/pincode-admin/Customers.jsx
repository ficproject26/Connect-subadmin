import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { TierBadge, StatusBadge } from '../../components/Badge';
import { Users, Phone, MapPin, CreditCard, UserCheck, TrendingUp } from 'lucide-react';

export function PincodeCustomers() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [customers, setCustomers] = useState([]);
  const [allCustomers, setAllCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');

  const pincode = user?.pincode || '';
  const areaName = user?.pincodeName || user?.areaName || user?.pincode || '';

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, allRes] = await Promise.all([
        dataService.getCustomers({ tier: tierFilter, pincode }),
        dataService.getCustomers({ pincode })
      ]);
      setCustomers(res.success ? (res.customers || []) : []);
      setAllCustomers(allRes.success ? (allRes.customers || []) : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [tierFilter]);

  const kpiStats = useMemo(() => {
    const dataset = allCustomers.length > 0 ? allCustomers : customers;
    const total = dataset.length;
    const nonCard = dataset.filter(c => !c.membership?.tier).length;
    const cards = dataset.filter(c => c.membership?.tier).length;

    return {
      total,
      nonCard,
      cards,
      activeArea: areaName
    };
  }, [allCustomers, customers, areaName]);

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
      header: 'Address in Pincode',
      accessor: 'address',
      render: (row) => (
        <div className="space-y-0.5">
          <div className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{row.address || areaName}</div>
          <div className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> PIN: {row.pincode || pincode}
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
          Pincode Customers Directory
        </h2>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          Registered customers strictly restricted to Pincode {pincode} ({areaName}).
        </p>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Customers</span>
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{kpiStats.total}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Active in PIN {pincode}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Without Card</span>
            <UserCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{kpiStats.nonCard}</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
            Standard patrons
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Membership Cards</span>
            <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{kpiStats.cards}</div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
            Active cardholders
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Station Zone</span>
            <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 truncate">
            {kpiStats.activeArea}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 truncate">
            PIN: {pincode} Jurisdiction
          </div>
        </div>
      </div>

      <DataTable
        title="Pincode Registered Customers"
        subtitle="Silver, Gold, and Diamond Cardholders"
        columns={columns}
        data={customers}
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
        exportFileName="pincode_customers.csv"
      />
    </div>
  );
}
