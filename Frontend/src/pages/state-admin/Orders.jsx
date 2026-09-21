import React, { useState, useEffect, useMemo } from 'react';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge, TierBadge, CardTierIcon } from '../../components/Badge';
import { OrderDetailsModal } from '../../components/OrderDetailsModal';
import { useTheme } from '../../context/ThemeContext';
import { ShoppingBag, Users, CreditCard, TrendingUp, MapPin, Eye } from 'lucide-react';

export function StateOrders() {
  const { isDark } = useTheme();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getOrders();
      if (res.success) setOrders(res.orders || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute 4 KPI stats from orders dataset
  const kpiStats = useMemo(() => {
    const total = orders.length;
    const isMembership = (tier) => 
      tier && !['normal', 'standard', 'customer', 'none'].includes(String(tier).toLowerCase());

    const membershipOrders = orders.filter(o => isMembership(o.membershipTier)).length;
    const normalOrders = total - membershipOrders;

    // Calculate Highest Ordering District
    let peakDistrict = '-';
    let peakCount = 0;
    if (total > 0) {
      const districtCounts = orders.reduce((acc, o) => {
        const dist = o.district || o.deliveryDistrict || 'Unassigned';
        acc[dist] = (acc[dist] || 0) + 1;
        return acc;
      }, {});

      Object.entries(districtCounts).forEach(([dist, count]) => {
        if (count > peakCount) {
          peakCount = count;
          peakDistrict = dist;
        }
      });
    }

    const peakPercent = total > 0 ? Math.round((peakCount / total) * 100) : 0;

    return {
      total,
      normalOrders,
      membershipOrders,
      peakDistrict,
      peakCount,
      peakPercent
    };
  }, [orders]);

  const columns = [
    {
      header: 'Order Details',
      accessor: (row) => `${row.customerName} - ${row.orderNumber}`,
      className: 'whitespace-nowrap min-w-[150px]',
      render: (row) => (
        <div className="whitespace-nowrap">
          <div className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {row.customerName}
          </div>
          <div className={`font-bold text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-900'} mt-0.5`}>
            {row.orderNumber}
          </div>
          <div className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'} mt-0.5`}>
            {row.orderDate}
          </div>
        </div>
      )
    },
    {
      header: 'Product Details',
      accessor: (row) => row.items?.map(i => `${i.name} (x${i.qty})`).join(', ') || '',
      className: 'min-w-[240px]',
      render: (row) => (
        <div className="min-w-[240px]">
          {row.items && row.items.length > 0 ? (
            <div className="space-y-1">
              {row.items.map((item, idx) => (
                <div key={idx} className="text-xs flex items-center gap-1.5 whitespace-nowrap">
                  <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                    {item.name}
                  </span>
                  <span className="text-[11px] font-semibold text-blue-600 dark:text-indigo-400 shrink-0 font-mono">
                    (x{item.qty})
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>-</span>
          )}
        </div>
      )
    },
    {
      header: 'Location Scope',
      accessor: 'pincode',
      className: 'whitespace-nowrap min-w-[150px]',
      render: (row) => (
        <div className="whitespace-nowrap">
          <div className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{row.district} / {row.division}</div>
          <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 shrink-0" /> PIN: {row.pincode}
          </div>
        </div>
      )
    },
    {
      header: 'Amount & Savings',
      accessor: 'netPayable',
      className: 'whitespace-nowrap min-w-[150px]',
      render: (row) => {
        const tier = row.membershipTier;
        const isCardMember = tier && !['normal', 'standard', 'customer', 'none'].includes(String(tier).toLowerCase());
        const normalizedTier = isCardMember ? (tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase()) : null;

        return (
          <div className="whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                ₹{row.netPayable?.toLocaleString()}
              </span>
              {isCardMember && (
                <span title={`${normalizedTier} Card`} className="inline-flex items-center">
                  <CardTierIcon
                    tier={normalizedTier}
                    className="w-3.5 h-3.5 cursor-default"
                  />
                </span>
              )}
            </div>
            {row.discountAmount > 0 && (
              <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'} whitespace-nowrap mt-0.5`}>
                Card Discount: -₹{row.discountAmount?.toLocaleString()}
              </div>
            )}
            <div className={`text-[10px] ${isDark ? 'text-slate-500' : 'text-slate-400'} whitespace-nowrap mt-0.5`}>
              {row.paymentMode}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Status',
      accessor: 'status',
      className: 'whitespace-nowrap min-w-[120px]',
      render: (row) => <StatusBadge status={row.status} />
    },
    {
      header: 'Action',
      className: 'whitespace-nowrap min-w-[130px] text-right',
      render: (row) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setSelectedOrder(row);
              setShowDetailsModal(true);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
            } border transition shadow-sm cursor-pointer`}
            title="View Order Details & Status Timeline"
          >
            <Eye className="w-3.5 h-3.5 text-blue-500" />
            <span>View Details</span>
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>State Orders Overview</h2>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          All customer orders dispatched and delivered across the state.
        </p>
      </div>

      {/* 4 KPI Cards in a single row, equal size and consistent styling matching 1st image */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* KPI 1: Total Orders */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Orders</span>
            <ShoppingBag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.total.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Active state ledger volume
          </div>
        </div>

        {/* KPI 2: Normal Customer Orders */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Normal Customer Orders</span>
            <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.normalOrders.toLocaleString()}
          </div>
          <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium mt-0.5">
            Standard non-card orders
          </div>
        </div>

        {/* KPI 3: Membership Card Orders */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Membership Card Orders</span>
            <CreditCard className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.membershipOrders.toLocaleString()}
          </div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">
            Diamond, Gold & Silver tiers
          </div>
        </div>

        {/* KPI 4: Order Peak – Highest Ordering District */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Order Peak</span>
            <TrendingUp className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 truncate" title={kpiStats.peakDistrict}>
            {kpiStats.peakDistrict}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5 truncate">
            Leading district ({kpiStats.peakCount} orders • {kpiStats.peakPercent}%)
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <DataTable
        title="Orders Ledger"
        subtitle="Live orders from all state districts and pincodes"
        columns={columns}
        data={orders}
        loading={loading}
        onRefresh={loadData}
        onRowClick={(order) => {
          setSelectedOrder(order);
          setShowDetailsModal(true);
        }}
        searchPlaceholder="Search order ID, customer name..."
        exportFileName="state_orders.csv"
      />

      {/* Detailed Order Timeline & Items Modal */}
      <OrderDetailsModal
        order={selectedOrder}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
      />
    </div>
  );
}
