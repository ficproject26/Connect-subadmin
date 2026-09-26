import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { DeliveryPartnerDetailsModal } from '../../components/DeliveryPartnerDetailsModal';
import {
  Truck,
  Phone,
  Star,
  MapPin,
  Clock,
  CheckCircle2,
  Package,
  Bike
} from 'lucide-react';

export function DivisionalDeliveryPartners() {
  const { user } = useAuth();
  const divisionName = user?.division || '';
  const districtName = user?.district || '';
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [partners, setPartners] = useState([]);

  const kpiStats = useMemo(() => {
    const totalPartners = partners.length;
    const onDuty = partners.filter(p => (p.shift || p.status || '').toLowerCase() === 'on duty').length;
    const available = partners.filter(p => (p.shift || p.status || '').toLowerCase() === 'available').length;
    const activeDeliveries = partners.reduce((acc, p) => acc + (p.activeDeliveries || ((p.shift || p.status || '').toLowerCase() === 'on duty' ? 2 : 0)), 0);

    return {
      totalPartners,
      onDuty,
      available,
      activeDeliveries
    };
  }, [partners]);

  const columns = [
    {
      header: 'Partner',
      accessor: (row) => `${row.name} ${row.phone}`,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/70 text-rose-600 border border-rose-100 dark:border-rose-900 shrink-0">
            <Truck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 dark:text-white text-xs">{row.name}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 mt-0.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{row.phone}</span>
            </div>
          </div>
        </div>
      )
    },
    {
      header: 'Vehicle',
      accessor: (row) => `${row.vehicleType} ${row.registrationNumber}`,
      render: (row) => (
        <div className="text-xs">
          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Bike className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>{row.vehicleType}</span>
          </div>
          <div className="font-mono text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
            {row.registrationNumber}
          </div>
        </div>
      )
    },
    {
      header: 'Location',
      accessor: (row) => `${row.district} ${row.pincode}`,
      render: (row) => (
        <div className="text-xs">
          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{row.district}</span>
          </div>
          <div className="font-mono text-emerald-600 dark:text-emerald-400 text-[11px] mt-0.5 pl-4.5">
            PIN: {row.pincode}
          </div>
        </div>
      )
    },
    {
      header: 'Rating & Trips',
      accessor: 'rating',
      render: (row) => (
        <div className="text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{row.rating}</span>
            <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
              ({row.totalTrips.toLocaleString()} trips)
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Shift',
      accessor: 'shift',
      className: 'whitespace-nowrap min-w-[110px]',
      render: (row) => <StatusBadge status={row.shift} />
    },
    {
      header: 'Status',
      accessor: 'status',
      className: 'whitespace-nowrap min-w-[100px]',
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Division Delivery Partners</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Last-mile delivery executives deployed across {divisionName} Division pincode hubs.
        </p>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Partners</span>
            <Truck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.totalPartners.toLocaleString()}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
            Division fleet size
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">On Duty</span>
            <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.onDuty.toLocaleString()}
          </div>
          <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium mt-0.5">
            Active working shift
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Available</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.available.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
            Ready for instant dispatch
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Deliveries</span>
            <Package className="w-4 h-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">
            {kpiStats.activeDeliveries.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
            Orders currently in transit
          </div>
        </div>
      </div>

      <DataTable
        title="Active Delivery Fleet"
        subtitle="Manage logistics partners and delivery fulfillment capacity"
        columns={columns}
        data={partners}
        onRowClick={(partner) => {
          setSelectedPartner(partner);
          setShowDetailsModal(true);
        }}
        searchPlaceholder="Search partner name or vehicle..."
        exportFileName="division_delivery_partners.csv"
      />

      <DeliveryPartnerDetailsModal
        partner={selectedPartner}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
      />
    </div>
  );
}

