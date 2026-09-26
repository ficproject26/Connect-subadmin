import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { getPincodesForDivision, getDivisionsForDistrict } from '../../utils/indiaPostalData';
import {
  Layers,
  MapPin,
  Users,
  Store,
  ArrowRight,
  Building2,
  X,
  Eye,
  UserCog,
  Truck,
  Wrench,
  Award,
  ShieldAlert,
  Package,
  CalendarCheck,
  Briefcase,
  CreditCard,
  Loader2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Modal } from '../../components/Modal';

export function StateDivisionDetails() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const districtFilter = searchParams.get('district');
  const divisionFilter = searchParams.get('division');

  const [selectedDivision, setSelectedDivision] = useState(null);
  const [divisionCards, setDivisionCards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDivisions = async () => {
      setLoading(true);
      try {
        const res = await dataService.getDivisions();
        if (res.success && res.divisions) {
          const list = res.divisions.map(div => {
            const state = div.stateName || div.state || user?.state || '-';
            const district = div.districtName || div.district || user?.district || '-';
            const name = div.name;
            const registeredPins = Array.isArray(div.pincodes) && div.pincodes.length > 0 ? div.pincodes : [];
            const pinCount = div.pincodesCount !== undefined ? div.pincodesCount : registeredPins.length;
            return {
              id: div.id || `DIV-${name?.slice(0, 3).toUpperCase() || '001'}`,
              name: name,
              district: district,
              state: state,
              status: div.status || 'Active',
              admin: div.adminName || 'Unassigned',
              adminEmail: div.adminEmail || '-',
              adminPhone: div.adminPhone || '-',
              pincodes: registeredPins,
              pincodesCount: pinCount,
              totalManagers: div.totalManagers || 0,
              totalAgents: div.totalAgents || 0,
              deliveryPartner: div.deliveryPartner || 0,
              technician: div.technician || 0,
              executive: div.executive || 0,
              pendingKYC: div.pendingKYC || 0,
              totalVendors: div.totalVendors || 0,
              totalOrders: div.totalOrders || 0,
              totalBookings: div.totalBookings || 0,
              totalJobApplied: div.totalJobApplied || 0,
              totalMembershipCards: div.totalMembershipCards || 0,
              totalCustomers: div.totalCustomers || 0,
            };
          });
          setDivisionCards(list);
        }
      } catch (err) {
        console.error('Failed to load division details:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDivisions();
  }, [user]);

  const filteredCards = divisionCards.filter(d => {
    if (districtFilter && d.district?.toLowerCase() !== districtFilter.toLowerCase()) return false;
    if (divisionFilter && d.name?.toLowerCase() !== divisionFilter.toLowerCase() && d.id?.toLowerCase() !== divisionFilter.toLowerCase()) return false;
    return true;
  });
  const displayCards = filteredCards;

  useEffect(() => {
    if (divisionFilter && divisionCards.length > 0) {
      const match = divisionCards.find(d => d.name?.toLowerCase() === divisionFilter.toLowerCase() || d.id?.toLowerCase() === divisionFilter.toLowerCase());
      if (match) setSelectedDivision(match);
    }
  }, [divisionFilter, divisionCards]);

  const getWorkforceMetrics = (div) => [
    { label: 'Total Managers', value: div.totalManagers, icon: UserCog, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/50' },
    { label: 'Total Agents', value: div.totalAgents, icon: Users, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/60 dark:text-violet-400 border-violet-100 dark:border-violet-900/50' },
    { label: 'Delivery Partner', value: div.deliveryPartner, icon: Truck, color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/60 dark:text-orange-400 border-orange-100 dark:border-orange-900/50' },
    { label: 'Technician', value: div.technician, icon: Wrench, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 dark:text-purple-400 border-purple-100 dark:border-purple-900/50' },
    { label: 'Executive', value: div.executive, icon: Award, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/60 dark:text-teal-400 border-teal-100 dark:border-teal-900/50' },
    { label: 'Pending KYC', value: div.pendingKYC, icon: ShieldAlert, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/60 dark:text-amber-400 border-amber-100 dark:border-amber-900/50' }
  ];

  const getCommerceMetrics = (div) => [
    { label: 'Total Vendors', value: div.totalVendors, icon: Store, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/60 dark:text-blue-400 border-blue-100 dark:border-blue-900/50' },
    { label: 'Total Orders', value: div.totalOrders, icon: Package, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50' },
    { label: 'Total Bookings', value: div.totalBookings, icon: CalendarCheck, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/60 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/50' },
    { label: 'Total Job Applied', value: div.totalJobApplied, icon: Briefcase, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/60 dark:text-sky-400 border-sky-100 dark:border-sky-900/50' },
    { label: 'Total Membership Cards', value: div.totalMembershipCards?.toLocaleString(), icon: CreditCard, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/60 dark:text-rose-400 border-rose-100 dark:border-rose-900/50' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">State Division Operational Details</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            In-depth structural breakdown and operational health metrics of each authorized division in {user?.state || 'Tamil Nadu'}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {districtFilter && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/50">
              <Building2 className="w-3.5 h-3.5" />
              <span>District: {districtFilter}</span>
              <button
                type="button"
                onClick={() => navigate('/state-admin/division-details')}
                className="ml-1 p-0.5 hover:bg-blue-200/60 dark:hover:bg-blue-900/60 rounded-full transition cursor-pointer"
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {divisionFilter && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900/50">
              <Layers className="w-3.5 h-3.5" />
              <span>Division: {divisionFilter}</span>
              <button
                type="button"
                onClick={() => navigate('/state-admin/division-details')}
                className="ml-1 p-0.5 hover:bg-blue-200/60 dark:hover:bg-blue-900/60 rounded-full transition cursor-pointer"
                title="Clear filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* 3-column grid identical to District Details */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] rounded-2xl">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-xs text-slate-500">Loading registered division operations...</p>
        </div>
      ) : displayCards.length === 0 ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] rounded-2xl">
          <Layers className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="font-medium text-base text-slate-800 dark:text-slate-200">No divisions found</p>
          <p className="text-xs mt-1 text-slate-400">There are no operational divisions configured for this view.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayCards.map((div) => (
            <div
              key={div.id}
              className="admin-card p-5 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm space-y-4 rounded-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-[15px] whitespace-nowrap truncate" title={`${div.name} Division`}>
                      {div.name} Division
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap block truncate">
                      ID: {div.id} • {div.district}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/50 shrink-0">
                  {div.status}
                </span>
              </div>

              {/* 3 Grid Stat Counters */}
              <div className="grid grid-cols-3 gap-3 py-2">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 text-center">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Pincodes</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">{div.pincodesCount}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 text-center">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Vendors</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">{div.totalVendors}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 text-center">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Orders</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">{div.totalOrders}</div>
                </div>
              </div>

              {/* Structured Rows */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400">Assigned Admin:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{div.admin}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400">Total Customers:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{div.totalCustomers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400">Total Orders:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{div.totalOrders.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons: View Pincodes & View Details */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/state-admin/pincode-details?division=${encodeURIComponent(div.name)}`)}
                  className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-400 dark:hover:bg-blue-900/60 transition cursor-pointer whitespace-nowrap"
                >
                  <span className="whitespace-nowrap">View Pincodes</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDivision(div)}
                  className="flex-1 min-w-0 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-500 transition shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <span className="whitespace-nowrap">View Details</span>
                  <Eye className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Division Full Operational Details Modal */}
      <Modal
        isOpen={!!selectedDivision}
        onClose={() => setSelectedDivision(null)}
        title={`${selectedDivision?.name || 'Division'} Operations & Metrics Overview`}
        maxWidth="max-w-3xl"
      >
        {selectedDivision && (
          <div className="space-y-4">
            {/* Header info bar */}
            <div className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">
                    {selectedDivision.name} Division Jurisdiction
                  </h4>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">
                    ID: {selectedDivision.id} • District: <span className="text-slate-800 dark:text-slate-200 font-semibold">{selectedDivision.district}</span> • Assigned Admin: <span className="text-blue-600 dark:text-cyan-400 font-semibold">{selectedDivision.admin}</span>
                  </div>
                </div>
              </div>
              <span className="self-start sm:self-auto px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-900/50">
                {selectedDivision.status}
              </span>
            </div>

            {/* Structured Dual-Panel Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Panel 1: Workforce & Field Operations */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Workforce & Field Force
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {getWorkforceMetrics(selectedDivision).length} Parameters
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {getWorkforceMetrics(selectedDivision).map((metric, idx) => {
                    const Icon = metric.icon;
                    return (
                      <div
                        key={idx}
                        className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                      >
                        <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                          <div className={`p-1.5 rounded-lg border ${metric.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-medium">{metric.label}</span>
                        </div>
                        <span className="font-bold text-sm font-mono px-2.5 py-0.5 rounded-md border text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                          {metric.value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Panel 2: Commerce, Orders & Compliance */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900/40 shadow-2xs">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Business, Orders & Commerce
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {getCommerceMetrics(selectedDivision).length} Parameters
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                  {getCommerceMetrics(selectedDivision).map((metric, idx) => {
                    const Icon = metric.icon;
                    return (
                      <div
                        key={idx}
                        className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
                      >
                        <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-300">
                          <div className={`p-1.5 rounded-lg border ${metric.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-medium">{metric.label}</span>
                        </div>
                        <span className="font-bold text-sm font-mono px-2.5 py-0.5 rounded-md border text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                          {metric.value}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDivision(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
              >
                Close Metrics
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
