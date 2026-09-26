import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { useTheme } from '../../context/ThemeContext';
import { AgentHierarchyBanner } from '../../components/AgentHierarchyBanner';
import { AgentActivityFlowModal } from '../../components/AgentActivityFlowModal';
import { AgentDetailsModal } from '../../components/AgentDetailsModal';
import { InitiateVendorOnboardingModal } from '../../components/InitiateVendorOnboardingModal';
import { 
  UserPlus, 
  Phone, 
  Building2, 
  Layers, 
  MapPin, 
  Award, 
  Wallet, 
  TrendingUp, 
  CheckCircle2, 
  Users,
  Store,
  ArrowRight,
  GitFork,
  Filter,
  RefreshCw,
  Plus,
  ShieldCheck,
  Clock,
  Eye
} from 'lucide-react';

const LEVEL_CONFIGS = {
  district: {
    title: 'District Agents',
    subtitle: 'District-level field directors, territorial sales leads, and regional distribution coordinators.',
    breadcrumb: 'District Agent',
    badge: 'District Agent',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60',
    icon: Building2,
    tableTitle: 'District Agent Directory',
    tableSubtitle: 'Territorial lead agents managing division clusters and district customer onboarding',
    exportFile: 'district_agents.csv',
    defaultData: []
  },
  divisional: {
    title: 'Divisional Agents',
    subtitle: 'Cluster coordinators supervising multiple pincodes, field executives, and merchant onboardings.',
    breadcrumb: 'Divisional Agent',
    badge: 'Divisional Agent',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    icon: Layers,
    tableTitle: 'Divisional Agent Roster',
    tableSubtitle: 'Cluster supervisory agents managing ground activations, pincode agents & KYC reviews',
    exportFile: 'divisional_agents.csv',
    defaultData: []
  },
  pincode: {
    title: 'Pincode Agents',
    subtitle: 'Ground-level grassroots representatives executing customer acquisition and direct vendor onboarding.',
    breadcrumb: 'Pincode Agent',
    badge: 'Pincode Agent',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    icon: MapPin,
    tableTitle: 'Pincode Agent Field Force',
    tableSubtitle: 'Frontline agents driving card enrollments, local vendor onboarding, and KYC verification',
    exportFile: 'pincode_agents.csv',
    defaultData: []
  }
};

export function DistrictAgents({ level = 'district' }) {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const district = user?.district || '-';

  // Determine active level from URL pathname
  let activeLevel = level;
  if (location.pathname.includes('/agents/pincode')) activeLevel = 'pincode';
  else if (location.pathname.includes('/agents/divisional')) activeLevel = 'divisional';
  else if (location.pathname.includes('/agents/district') || location.pathname.endsWith('/agents')) activeLevel = 'district';

  const config = LEVEL_CONFIGS[activeLevel] || LEVEL_CONFIGS.district;

  // View tabs: 'roster' | 'activities' | 'tree'
  const [activeTab, setActiveTab] = useState('roster');

  const [agents, setAgents] = useState(config.defaultData);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters for activities
  const [stageFilter, setStageFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');

  // Modals state
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);

  // Fetch agents and activities
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getAgents({ district, level: activeLevel });
      if (res.success && res.agents) {
        setAgents(res.agents);
      } else {
        setAgents([]);
      }

      const actRes = await dataService.getAgentActivities({ district });
      if (actRes.success && actRes.activities) {
        setActivities(actRes.activities);
      } else {
        setActivities([]);
      }
    } catch (err) {
      console.error('Error loading district agent data:', err);
      setAgents([]);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeLevel, district]);

  const handleAdvanceStage = async (activityId, notes) => {
    try {
      const res = await dataService.advanceAgentActivity(activityId, { notes });
      if (res.success) {
        setSelectedActivity(res.activity);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Metrics summary
  const totalAgentsCount = agents.length;
  const totalOnboardingsSum = agents.reduce((acc, a) => acc + (Number(a.vendorOnboardings) || 0), 0);
  const totalWalletSum = agents.reduce((acc, a) => acc + (Number(a.walletBalance) || 0), 0);
  const totalReferralsSum = agents.reduce((acc, a) => acc + (Number(a.totalReferrals) || 0), 0);

  // Filtered activities
  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      const matchStage = stageFilter ? act.currentStage === stageFilter : true;
      const matchDiv = divisionFilter ? (act.division === divisionFilter) : true;
      return matchStage && matchDiv;
    });
  }, [activities, stageFilter, divisionFilter]);

  const columns = [
    {
      header: 'Agent Details',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 shrink-0">
            <UserPlus className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-slate-900 dark:text-white text-xs">{row.name}</div>
            <div className="text-[11px] text-slate-500 font-mono truncate">{row.email}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Jurisdiction',
      accessor: 'jurisdiction',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-blue-500" />
            <span>{row.jurisdiction || `${district} District`}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {row.assignedArea || 'District Divisions'}
          </div>
        </div>
      )
    },
    {
      header: 'Reporting Supervisor',
      accessor: 'supervisorName',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
          {row.supervisorName || 'Apex Governance'}
        </span>
      )
    },
    {
      header: 'Contact',
      accessor: 'phone',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="text-xs text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1">
          <Phone className="w-3 h-3 text-slate-400" /> {row.phone}
        </span>
      )
    },
    {
      header: 'Referrals & Onboardings',
      accessor: 'totalReferrals',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white text-xs">
            {row.totalReferrals || 0} Referrals
          </div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
            {row.vendorOnboardings || 0} Vendors Onboarded
          </div>
        </div>
      )
    },
    {
      header: 'Wallet Balance',
      accessor: 'walletBalance',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 dark:text-amber-300 text-xs">
          ₹{(row.walletBalance || 0).toLocaleString()}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      className: 'whitespace-nowrap',
      render: (row) => <StatusBadge status={row.status || 'Active'} />
    },
    {
      header: 'Actions',
      accessor: 'id',
      className: 'whitespace-nowrap',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedAgent(row)}
          className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <Eye className="w-3 h-3" /> Profile
        </button>
      )
    }
  ];

  const activityColumns = [
    {
      header: 'Activity ID & Merchant',
      accessor: 'merchantName',
      render: (row) => (
        <div>
          <div className="font-bold text-xs text-slate-900 dark:text-white">{row.merchantName}</div>
          <div className="text-[10px] text-slate-400 font-mono">{row.id} • {row.merchantCategory}</div>
        </div>
      )
    },
    {
      header: 'Agent & Division',
      accessor: 'agentName',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{row.agentName}</div>
          <div className="text-[10px] text-slate-500">{row.division} • {row.pincode}</div>
        </div>
      )
    },
    {
      header: 'Lifecycle Stage',
      accessor: 'currentStage',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
          {row.currentStage}
        </span>
      )
    },
    {
      header: 'Target Completion',
      accessor: 'targetCompletionDate',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
          {row.targetCompletionDate}
        </span>
      )
    },
    {
      header: 'Action',
      accessor: 'actions',
      className: 'whitespace-nowrap',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedActivity(row)}
          className="px-2.5 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-all flex items-center gap-1 cursor-pointer"
        >
          <span>Audit Flow</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{config.title}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{config.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowOnboardModal(true)}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Initiate Vendor Onboarding</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            title="Refresh Data"
            className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4-Tier Agent Hierarchy Banner scoped to District Admin */}
      <AgentHierarchyBanner activeLevel={activeLevel} basePath="/district-admin" />

      {/* Top Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total {config.title}</span>
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{totalAgentsCount}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">100% verified network</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Vendor Onboardings</span>
            <Store className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{totalOnboardingsSum}</div>
          <div className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">Ground merchant sign-ups</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Wallet Hold</span>
            <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">₹{totalWalletSum.toLocaleString()}</div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">Eligible for payout</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Referrals</span>
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{totalReferralsSum}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Customer enrollments</div>
        </div>
      </div>

      {/* Main Mode Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'roster'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          {config.title} Directory ({agents.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('activities')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'activities'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
          }`}
        >
          Ground Onboarding Workflows ({activities.length})
        </button>
      </div>

      {/* Tab 1: Agent Directory Table */}
      {activeTab === 'roster' && (
        <DataTable
          title={config.tableTitle}
          subtitle={config.tableSubtitle}
          columns={columns}
          data={agents}
          loading={loading}
          onRefresh={loadData}
          searchPlaceholder={`Search ${config.title.toLowerCase()} by name, email, phone...`}
          exportFileName={config.exportFile}
        />
      )}

      {/* Tab 2: Activity Flow Workflow Table */}
      {activeTab === 'activities' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-9 inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="bg-transparent border-none text-slate-800 dark:text-slate-200 text-xs focus:outline-none cursor-pointer"
              >
                <option value="">All Stages</option>
                <option value="Lead Generation">Lead Generation</option>
                <option value="Store Verification">Store Verification</option>
                <option value="Documents Collected">Documents Collected</option>
                <option value="Admin Final Approval">Admin Final Approval</option>
                <option value="Store Live & Active">Store Live & Active</option>
              </select>
            </div>
          </div>

          <DataTable
            title="District Ground Vendor Onboarding Pipeline"
            subtitle="Live status of merchant acquisition pipeline supervised by district agents"
            columns={activityColumns}
            data={filteredActivities}
            loading={loading}
            onRefresh={loadData}
            searchPlaceholder="Search merchant, ID, or agent name..."
            exportFileName="district_vendor_onboardings.csv"
          />
        </div>
      )}

      {/* Audit Modal */}
      {selectedActivity && (
        <AgentActivityFlowModal
          activity={selectedActivity}
          isOpen={!!selectedActivity}
          onClose={() => setSelectedActivity(null)}
          onAdvance={handleAdvanceStage}
        />
      )}

      {/* Profile Modal */}
      {selectedAgent && (
        <AgentDetailsModal
          agent={selectedAgent}
          isOpen={!!selectedAgent}
          onClose={() => setSelectedAgent(null)}
        />
      )}

      {/* Vendor Onboard Modal */}
      {showOnboardModal && (
        <InitiateVendorOnboardingModal
          isOpen={showOnboardModal}
          onClose={() => setShowOnboardModal(false)}
          onSuccess={() => {
            setShowOnboardModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
