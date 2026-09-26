import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { AgentActivityFlowModal } from '../../components/AgentActivityFlowModal';
import { 
  UserPlus, 
  Phone, 
  Layers, 
  Store, 
  MapPin, 
  ArrowRight, 
  CheckCircle2 
} from 'lucide-react';

export function DivisionalAgents() {
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('roster');
  const [selectedActivity, setSelectedActivity] = useState(null);

  const division = user?.division || '';

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataService.getAgents({ division });
      if (res.success && res.agents) setAgents(res.agents);
      else setAgents([]);

      const actRes = await dataService.getAgentActivities({ division });
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

  const handleAdvanceActivity = async (id, notes) => {
    try {
      const res = await dataService.advanceAgentActivity(id, { notes });
      if (res.success) {
        setSelectedActivity(res.activity);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const columns = [
    {
      header: 'Agent Details',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-xs">{row.name}</div>
            <div className="text-[11px] text-slate-500 font-mono">{row.email}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Phone / Contact',
      accessor: 'phone',
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
          <div className="font-bold text-slate-900 dark:text-white text-xs">{row.totalReferrals} Referrals</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{row.vendorOnboardings || 0} Vendors Onboarded</div>
        </div>
      )
    },
    {
      header: 'Wallet Balance',
      accessor: 'walletBalance',
      render: (row) => (
        <span className="font-mono font-bold text-slate-900 dark:text-amber-300 text-xs">
          ₹{row.walletBalance?.toLocaleString()}
        </span>
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
      header: 'Activity & Vendor',
      accessor: 'title',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-emerald-500" />
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">{row.title}</div>
            <div className="text-[10px] text-slate-500">{row.id} • {row.createdDate}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Initiating Pincode Agent',
      accessor: 'pincodeAgent',
      render: (row) => (
        <div className="text-xs">
          <span className="font-semibold">{row.pincodeAgent?.name}</span>
          <span className="text-slate-500 font-mono ml-1">(PIN: {row.pincode})</span>
        </div>
      )
    },
    {
      header: 'Review Stage',
      accessor: 'currentStage',
      render: (row) => (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
          {row.currentStage} ({row.status})
        </span>
      )
    },
    {
      header: 'Action',
      accessor: 'id',
      render: (row) => (
        <button
          type="button"
          onClick={() => setSelectedActivity(row)}
          className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer"
        >
          Verify Activity <ArrowRight className="w-3 h-3" />
        </button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Division Field Operations</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Cluster sales and pincode ground activities within {division ? `${division} Division` : 'assigned division'}.
        </p>
      </div>

      {/* Visibility Rule Notice */}
      <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-200">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-emerald-600" />
          <span className="font-bold">Visibility Rule:</span>
          <span>Pincode Agent ground activities and vendor onboardings are directly visible to the Divisional Agent for cluster verification.</span>
        </div>
        <span className="text-[10px] font-bold bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full">
          Tier 3 Scoped
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
            activeTab === 'roster' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
          }`}
        >
          Divisional Agents ({agents.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('activities')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
            activeTab === 'activities' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
          }`}
        >
          Pincode Agent Activities ({activities.length})
        </button>
      </div>

      {activeTab === 'roster' ? (
        <DataTable
          title="Divisional Agent Network Roster"
          subtitle="Manage customer acquisition agents in assigned division"
          columns={columns}
          data={agents}
          loading={loading}
          onRefresh={loadData}
          searchPlaceholder="Search agent..."
          exportFileName="division_agents.csv"
        />
      ) : (
        <DataTable
          title="Pincode Agent Activities & Vendor Onboardings"
          subtitle={`Activities initiated by ground agents within ${division}`}
          columns={activityColumns}
          data={activities}
          loading={loading}
          onRefresh={loadData}
          searchPlaceholder="Search activity..."
          exportFileName="divisional_agent_activities.csv"
        />
      )}

      <AgentActivityFlowModal
        isOpen={Boolean(selectedActivity)}
        onClose={() => setSelectedActivity(null)}
        activity={selectedActivity}
        onAdvance={handleAdvanceActivity}
      />
    </div>
  );
}
