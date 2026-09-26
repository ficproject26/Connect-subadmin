import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { InitiateVendorOnboardingModal } from '../../components/InitiateVendorOnboardingModal';
import { AgentActivityFlowModal } from '../../components/AgentActivityFlowModal';
import { 
  UserPlus, 
  Phone, 
  Mail, 
  Wallet, 
  MapPin, 
  Store, 
  Plus, 
  ArrowRight, 
  CheckCircle2 
} from 'lucide-react';

export function PincodeAgents() {
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('roster');
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showOnboardModal, setShowOnboardModal] = useState(false);

  const pincode = user?.pincode || '';

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getAgents({ pincode });
      if (res.success && res.agents) setAgents(res.agents);
      else setAgents([]);

      const actRes = await dataService.getAgentActivities({ pincode });
      if (actRes.success && actRes.activities) setActivities(actRes.activities);
      else setActivities([]);
    } catch (e) {
      console.error(e);
      setAgents([]);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateOnboarding = async (formData) => {
    const res = await dataService.createAgentActivity(formData);
    if (res.success) {
      loadData();
      setActiveTab('activities');
    }
  };

  const columns = [
    {
      header: 'Agent Details',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-700/40 text-indigo-400">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-sm">{row.name}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Phone className="w-3 h-3 text-slate-400" />
              {row.phone}
            </div>
            <div className="text-[11px] text-slate-400">{row.email}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Referrals & Subscriptions',
      accessor: 'totalReferrals',
      render: (row) => (
        <div>
          <div className="font-bold text-slate-900 dark:text-white">{row.totalReferrals} Referrals</div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">{row.vendorOnboardings || 0} Vendors Onboarded</div>
        </div>
      )
    },
    {
      header: 'Wallet Balance',
      accessor: 'walletBalance',
      render: (row) => (
        <span className="font-mono font-bold text-amber-500 dark:text-amber-300 text-sm">
          ₹{row.walletBalance?.toLocaleString()}
        </span>
      )
    },
    {
      header: 'Total Earned',
      accessor: 'totalEarned',
      render: (row) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{row.totalEarned?.toLocaleString()}</span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status} />
    }
  ];

  const activityColumns = [
    {
      header: 'Activity & Onboarding',
      accessor: 'title',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-amber-500" />
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">{row.title}</div>
            <div className="text-[10px] text-slate-500 font-mono">{row.id} • {row.createdDate}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Escalation Status',
      accessor: 'status',
      render: (row) => (
        <div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            {row.status}
          </span>
          <div className="text-[10px] text-slate-500 mt-0.5">Currently at: {row.currentStage}</div>
        </div>
      )
    },
    {
      header: 'Action',
      accessor: 'id',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedActivity(row)}
          className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
        >
          Track Flow <ArrowRight className="w-3 h-3" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pincode Ground Agents{pincode ? ` (PIN: ${pincode})` : ''}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Field sales, customer acquisition, and vendor onboarding.</p>
        </div>

        <button
          type="button"
          onClick={() => setShowOnboardModal(true)}
          className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Vendor Onboarding</span>
        </button>
      </div>

      {/* Visibility Rule Notice */}
      <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-600" />
          <span className="font-bold">Hierarchy Rule:</span>
          <span>Pincode Agents initiate ground vendor onboarding and membership card activities, which flow upward to the Divisional Agent.</span>
        </div>
        <span className="text-[10px] font-bold bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
          Tier 4 Ground
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
            activeTab === 'roster' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
          }`}
        >
          Pincode Agents ({agents.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('activities')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
            activeTab === 'activities' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
          }`}
        >
          Ground Activities & Onboardings ({activities.length})
        </button>
      </div>

      {activeTab === 'roster' ? (
        <DataTable
          title="Agent Network Roster"
          subtitle="Manage acquisition agents and referral track records"
          columns={columns}
          data={agents}
          loading={loading}
          onRefresh={loadData}
          searchPlaceholder="Search agent by name or phone..."
          exportFileName="pincode_agents.csv"
        />
      ) : (
        <DataTable
          title="Ground Activities & Vendor Onboardings"
          subtitle="Direct activities initiated within this pincode"
          columns={activityColumns}
          data={activities}
          loading={loading}
          onRefresh={loadData}
          searchPlaceholder="Search activity..."
          exportFileName="pincode_agent_activities.csv"
        />
      )}

      <AgentActivityFlowModal
        isOpen={Boolean(selectedActivity)}
        onClose={() => setSelectedActivity(null)}
        activity={selectedActivity}
      />

      <InitiateVendorOnboardingModal
        isOpen={showOnboardModal}
        onClose={() => setShowOnboardModal(false)}
        onSuccess={handleCreateOnboarding}
        defaultPincode={pincode}
      />
    </div>
  );
}
