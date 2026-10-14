import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  MapPin,
  Mail,
  Phone,
  Calendar,
  User,
  CreditCard,
  Building,
  CheckCircle2,
  Lock,
  Globe,
  FileText,
  Smartphone
} from 'lucide-react';

export function SubAdminProfileView({ title = 'Administrator Profile', subtitle = 'Authenticated administrator credentials, territorial jurisdiction, and verified registration dossier.' }) {
  const { user } = useAuth();

  // Helper to mask sensitive numbers
  const maskAadhaar = (num) => {
    if (!num) return '•••• •••• 9812';
    const clean = String(num).replace(/\s+/g, '');
    return `•••• •••• ${clean.slice(-4)}`;
  };

  const maskPan = (pan) => {
    if (!pan) return 'ABC•••••1F';
    const clean = String(pan).trim();
    if (clean.length < 5) return '••••••••';
    return `${clean.slice(0, 2)}•••••${clean.slice(-1)}`;
  };

  const maskAccount = (acc) => {
    if (!acc) return '••••••••3842';
    const clean = String(acc).trim();
    return `••••••••${clean.slice(-4)}`;
  };

  const formatTerritoryDisplay = () => {
    const parts = [
      user?.pincode ? `PIN ${user.pincode}` : null,
      user?.division ? `${user.division} Division` : null,
      user?.district ? `${user.district} District` : null,
      user?.state || 'All India'
    ].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>

      {/* Main Profile Header Card */}
      <div className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm rounded-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="relative">
            <img
              src={user?.avatar || user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
              alt={user?.name || 'Administrator'}
              className="w-24 h-24 rounded-2xl object-cover border-2 border-blue-500/50 shadow-md ring-4 ring-blue-50 dark:ring-blue-950/40"
            />
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1 rounded-full shadow-md" title="Active Verified Session">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {user?.name || 'Authorized Administrator'}
              </h3>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-purple-950/80 text-blue-700 dark:text-purple-300 border border-blue-200 dark:border-purple-500/40">
                  {user?.role || 'Sub-Admin'}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Active Verified
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center justify-center sm:justify-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>Jurisdiction: </span>
              <span className="font-semibold text-slate-900 dark:text-white">{formatTerritoryDisplay()}</span>
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                ID: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{user?.subAdminId || user?.id || user?._id || 'ADM-001'}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                {user?.email || 'admin@connect.com'}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                {user?.mobile || user?.phone || 'Not provided'}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                Active Since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'Jan 2026'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Registration Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Official Account & Identity Credentials */}
        <div className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <User className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Account & Identity Details
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Full Legal Name</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.name || '-'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">System Username</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{user?.username || user?.loginId || user?.email || '-'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Sub-Admin Unique ID</span>
              <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{user?.subAdminId || user?.id || user?._id || '-'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Administrative Role</span>
              <span className="font-semibold text-purple-700 dark:text-purple-300">{user?.role || '-'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Official Email</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">{user?.email || '-'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Registered Mobile</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{user?.mobile || user?.phone || '-'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Alternate Mobile</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{user?.alternateMobile || user?.altPhone || 'Not provided'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Date of Birth / Gender</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {user?.dob ? new Date(user.dob).toLocaleDateString('en-IN') : 'Not provided'} {user?.gender ? `(${user.gender})` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Territorial Jurisdiction & Coverage */}
        <div className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Globe className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Assigned Territory & Jurisdiction
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Assigned State</span>
              <span className="font-bold text-slate-900 dark:text-white">{user?.state || user?.assignedState || 'Tamil Nadu'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Assigned District</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.district || user?.assignedDistrict || (user?.level === 1 ? 'All Districts' : '-')}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Assigned Division</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.division || user?.assignedDivision || (user?.level <= 2 ? 'All Divisions' : '-')}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Assigned PIN Code</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{user?.pincode || user?.assignedPincode || (user?.level <= 3 ? 'All PINs' : '-')}</span>
            </div>
            <div className="col-span-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Official Administrative Address</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {user?.address || `${user?.city || 'Regional Office'}, ${user?.district || ''} ${user?.state || 'Tamil Nadu'}`}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Headquarters City</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{user?.city || user?.town || user?.district || 'HQ'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Supervisory Authority</span>
              <span className="font-medium text-slate-800 dark:text-slate-200">{user?.parentAdminName || 'Apex Main Admin'}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Verified Banking & KYC Dossier (Strictly Masked) */}
        <div className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <CreditCard className="w-4 h-4 text-amber-600" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Banking & KYC Dossier (Masked & Protected)
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Bank Name</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.bankName || 'HDFC Bank'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Branch Name</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.branchName || 'Central Branch'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Account Holder</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.accountHolderName || user?.name || '-'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Account Number</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{maskAccount(user?.accountNumber)}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">IFSC Code</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{user?.ifscCode || 'HDFC0001234'}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Aadhaar Card</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{maskAadhaar(user?.aadharNumber)}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">PAN Card</span>
              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{maskPan(user?.panNumber)}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">KYC Compliance</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                <CheckCircle2 className="w-3 h-3" /> Fully Verified
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Security & Access Integrity */}
        <div className="admin-card p-6 bg-white dark:bg-[#131f37] border border-slate-200/90 dark:border-[#1f3358] shadow-sm rounded-2xl space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Lock className="w-4 h-4 text-purple-600" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Security & Access Integrity
            </h4>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
              <Shield className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">Strict Password Protection</div>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Passwords and private authentication keys are stored using irreversible bcrypt hashing. Plaintext credentials are never exposed or transmitted.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-start gap-3">
              <MapPin className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">Territorial Data Isolation</div>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  Queries, task assignments, and directory views are strictly confined to {user?.state || 'your assigned territory'}. Cross-territory requests are denied.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
