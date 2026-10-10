import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { dataService } from '../../services/dataService';
import { useAuth } from '../../context/AuthContext';
import { normalizeRole } from '../../utils/permissions';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/Badge';
import { ManagerApprovalModal } from '../../components/ManagerApprovalModal';
import { Modal } from '../../components/Modal';
import { useTheme } from '../../context/ThemeContext';
import { TerritoryHierarchyFilter } from '../../components/TerritoryHierarchyFilter';
import { getTerritoryLocking, safeString, safeLowerCase, extractTerritoryName, extractPincode } from '../../utils/territoryHelper';
import {
  UserCog,
  Phone,
  Building2,
  Layers,
  MapPin,
  Award,
  Users,
  ShieldCheck,
  TrendingUp,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
  RefreshCw,
  Filter,
  Plus,
  User,
  Home,
  FileText,
  Landmark,
  KeyRound,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Globe,
  GitFork,
  Send,
  List as ListIcon,
  Upload,
  X,
  ArrowRight,
  Lock,
  Loader2
} from 'lucide-react';
import { ALL_INDIAN_STATES, getDistrictsForState, getDivisionsForDistrict, getPincodesForDivision } from '../../utils/indiaPostalData';
import {
  validateBankDetails,
  validateAddressDetails,
  cleanAccountNumber,
  cleanIFSC,
  cleanPincode
} from '../../utils/formValidation';

const STEPS = [
  { id: 1, label: 'Personal',      icon: User },
  { id: 2, label: 'Assignment',    icon: ShieldCheck },
  { id: 3, label: 'Address',       icon: Home },
  { id: 4, label: 'Official Docs', icon: FileText },
  { id: 5, label: 'Bank',          icon: Landmark },
  { id: 6, label: 'Login',         icon: KeyRound },
];

const EMPTY_MGR_FORM = {
  fullName: '',
  email: '',
  mobile: '',
  dob: '',
  gender: 'Male',
  profilePhoto: null,
  profilePhotoPreview: '',
  role: 'state_manager',
  assignedState: '',
  assignedStateId: '',
  assignedDistrict: '',
  assignedDistrictId: '',
  assignedDivision: '',
  assignedDivisionId: '',
  assignedPincode: '',
  assignedPincodeId: '',
  doorStreet: '',
  area: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  aadharNumber: '',
  aadharUrl: '',
  aadharFileName: '',
  aadharPhoto: null,
  aadharPhotoPreview: '',
  panNumber: '',
  panUrl: '',
  panFileName: '',
  panPhoto: null,
  panPhotoPreview: '',
  bankPassbookUrl: '',
  bankPassbookFileName: '',
  bankPassbookPhoto: null,
  bankPassbookPhotoPreview: '',
  cancelledChequeUrl: '',
  cancelledChequeFileName: '',
  cancelledChequePhoto: null,
  cancelledChequePhotoPreview: '',
  signatureUrl: '',
  signatureFileName: '',
  signaturePhoto: null,
  signaturePhotoPreview: '',
  accountHolderName: '',
  bankName: '',
  accountNumber: '',
  ifscCode: '',
  branchName: '',
  status: 'active',
  loginId: '',
  password: '',
  confirmPassword: ''
};

function FieldInput({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const LEVEL_CONFIGS = {
  state: {
    title: 'State Managers',
    subtitle: 'Apex state-level operations managers, nodal coordinators, and zone directors across Tamil Nadu.',
    breadcrumb: 'State Managers',
    badge: 'State Manager',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60',
    icon: Award,
    tableTitle: 'State Operations Management Directory',
    tableSubtitle: 'Master executive managers overseeing district nodes, strategic ops, and state compliance',
    exportFile: 'state_managers.csv'
  },
  district: {
    title: 'District Managers',
    subtitle: 'District-level operational leaders managing divisional networks, logistics hubs, and territorial compliance.',
    breadcrumb: 'District Managers',
    badge: 'District Manager',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60',
    icon: Building2,
    tableTitle: 'District Manager Roster',
    tableSubtitle: 'Regional management leads managing division clusters, field supervisors, and admin operations',
    exportFile: 'district_managers.csv'
  },
  divisional: {
    title: 'Divisional Managers',
    subtitle: 'Divisional operations managers supervising pincode clusters, delivery terminals, and local coordinators.',
    breadcrumb: 'Divisional Managers',
    badge: 'Divisional Manager',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    icon: Layers,
    tableTitle: 'Divisional Manager Directory',
    tableSubtitle: 'Zonal hub leaders monitoring daily dispatch, field workforce, and local customer escalations',
    exportFile: 'divisional_managers.csv'
  },
  pincode: {
    title: 'Pincode Managers',
    subtitle: 'Hyperlocal pincode managers responsible for last-mile delivery SLA, agent coordination, and merchant liaison.',
    breadcrumb: 'Pincode Managers',
    badge: 'Pincode Manager',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    icon: MapPin,
    tableTitle: 'Pincode Micro-Zone Manager Roster',
    tableSubtitle: 'Last-mile facility managers and field operations leads assigned to postal zones',
    exportFile: 'pincode_managers.csv'
  }
};

export function StateManagers({ level }) {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'active'
  const [selectedManager, setSelectedManager] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Resilient user extraction (supports auth state + localStorage fallback during rehydration)
  const effectiveUser = useMemo(() => {
    if (user && user.role) return user;
    try {
      const stored = localStorage.getItem('ams_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.role || parsed.name)) return { ...parsed, ...user };
      }
    } catch (e) {
      // ignore JSON parse error
    }
    return user || {};
  }, [user]);

  const rawRole = (effectiveUser?.role || '').toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ').trim();
  const normalizedUserRole = normalizeRole(effectiveUser?.role || '');

  // Determine active level from path or prop
  let activeLevel = 'state';
  if (location.pathname.includes('/managers/district')) activeLevel = 'district';
  else if (location.pathname.includes('/managers/divisional')) activeLevel = 'divisional';
  else if (location.pathname.includes('/managers/pincode')) activeLevel = 'pincode';
  else if (location.pathname.includes('/managers/state')) activeLevel = 'state';
  else if (level) activeLevel = level;
  else if (location.pathname.includes('/district-admin/')) activeLevel = 'district';
  else if (location.pathname.includes('/divisional-admin/') || location.pathname.includes('/division-admin/')) activeLevel = 'divisional';
  else if (location.pathname.includes('/pincode-admin/')) activeLevel = 'pincode';
  else {
    activeLevel = rawRole.includes('district')
      ? 'district'
      : rawRole.includes('division') || rawRole.includes('divisional')
      ? 'divisional'
      : rawRole.includes('pincode')
      ? 'pincode'
      : 'state';
  }

  const config = LEVEL_CONFIGS[activeLevel] || LEVEL_CONFIGS.state;

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const queryState = searchParams.get('state');
  const queryDistrict = searchParams.get('district');
  const queryDivision = searchParams.get('division');
  const queryPincode = searchParams.get('pincode');

  const [viewTab, setViewTab] = useState('list'); // 'list' | 'hierarchy' | 'requests'
  const [allManagers, setAllManagers] = useState([]);
  const [territoryTree, setTerritoryTree] = useState([]);
  const [territoryLoading, setTerritoryLoading] = useState(false);
  const [expandedStates, setExpandedStates] = useState({});
  const [expandedDistricts, setExpandedDistricts] = useState({});
  const [expandedDivisions, setExpandedDivisions] = useState({});
  const [expandedPincodes, setExpandedPincodes] = useState({});

  const loadTerritoryTree = async () => {
    setTerritoryLoading(true);
    try {
      let tree = [];
      const res = await dataService.getTerritoryHierarchy();
      if (res?.success && Array.isArray(res.hierarchy) && res.hierarchy.length > 0) {
        tree = res.hierarchy;
      } else {
        const alt = await dataService.getHierarchy();
        if (alt?.success && Array.isArray(alt.hierarchy || alt.states)) {
          tree = alt.hierarchy || alt.states || [];
        }
      }
      setTerritoryTree(tree);
      if (tree.length > 0) {
        const initial = {};
        tree.forEach(s => {
          initial[s.id || s._id || s.name] = true;
        });
        setExpandedStates(initial);
      }
    } catch (e) {
      console.error('Failed to load territory tree:', e);
    } finally {
      setTerritoryLoading(false);
    }
  };

  // Deriving role-based territory locking
  const locking = useMemo(() => getTerritoryLocking(effectiveUser), [effectiveUser]);

  const [selectedFilterState, setSelectedFilterState] = useState(queryState || locking.defaultState || '');
  const [selectedFilterDistrict, setSelectedFilterDistrict] = useState(queryDistrict || locking.defaultDistrict || '');
  const [selectedFilterDivision, setSelectedFilterDivision] = useState(queryDivision || locking.defaultDivision || '');
  const [selectedFilterPincode, setSelectedFilterPincode] = useState(queryPincode || locking.defaultPincode || '');

  // Synchronize locked territory filter state from authenticated user
  useEffect(() => {
    if (locking.stateLocked && locking.defaultState) {
      setSelectedFilterState(locking.defaultState);
    }
    if (locking.districtLocked && locking.defaultDistrict) {
      setSelectedFilterDistrict(locking.defaultDistrict);
    }
    if (locking.divisionLocked && locking.defaultDivision) {
      setSelectedFilterDivision(locking.defaultDivision);
    }
    if (locking.pincodeLocked && locking.defaultPincode) {
      setSelectedFilterPincode(locking.defaultPincode);
    }
  }, [locking]);

  const loadData = async () => {
    setLoading(true);
    try {
      const reqState = locking.stateLocked ? locking.defaultState : (selectedFilterState || queryState);
      const reqDistrict = locking.districtLocked ? locking.defaultDistrict : (selectedFilterDistrict || queryDistrict);
      const reqDivision = locking.divisionLocked ? locking.defaultDivision : (selectedFilterDivision || queryDivision);
      const reqPincode = locking.pincodeLocked ? locking.defaultPincode : (selectedFilterPincode || queryPincode);

      const qParams = { level: activeLevel };
      if (reqState) qParams.state = reqState;
      if (reqDistrict) qParams.district = reqDistrict;
      if (reqDivision) qParams.division = reqDivision;
      if (reqPincode) qParams.pincode = reqPincode;

      const [res, allRes] = await Promise.all([
        dataService.getManagers(qParams),
        dataService.getManagers()
      ]);

      if (res?.success && Array.isArray(res.subordinates || res.data || res.managers)) {
        setManagers(res.subordinates || res.data || res.managers || []);
      } else {
        setManagers([]);
      }

      if (allRes?.success && Array.isArray(allRes.subordinates || allRes.data || allRes.managers)) {
        setAllManagers(allRes.subordinates || allRes.data || allRes.managers || []);
      } else {
        setAllManagers([]);
      }
    } catch (err) {
      console.error('Failed to load managers directory:', err);
      setManagers([]);
      setAllManagers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadTerritoryTree();
  }, [activeLevel, location.search, locking]);

  // Filtered managers based on status tab and hierarchy query
  const filteredManagers = useMemo(() => {
    let list = managers;
    const effectiveState = locking.stateLocked ? locking.defaultState : (selectedFilterState || queryState);
    const effectiveDistrict = locking.districtLocked ? locking.defaultDistrict : (selectedFilterDistrict || queryDistrict);
    const effectiveDivision = locking.divisionLocked ? locking.defaultDivision : (selectedFilterDivision || queryDivision);
    const effectivePincode = locking.pincodeLocked ? locking.defaultPincode : (selectedFilterPincode || queryPincode);

    if (effectiveState) {
      list = list.filter(m => safeLowerCase(m.state || m.assignedState || m.stateName) === safeLowerCase(effectiveState));
    }
    if (effectiveDistrict) {
      list = list.filter(m => safeLowerCase(m.district || m.assignedDistrict || m.districtName) === safeLowerCase(effectiveDistrict));
    }
    if (effectiveDivision) {
      list = list.filter(m => safeLowerCase(m.division || m.assignedDivision || m.divisionName) === safeLowerCase(effectiveDivision));
    }
    if (effectivePincode) {
      list = list.filter(m => safeString(m.pincode || m.assignedPincode || m.pincodeCode) === safeString(effectivePincode));
    }
    if (statusFilter === 'pending') {
      return list.filter(m => m.status === 'under_review' || m.status === 'pending' || m.status === 'pending_admin_approval');
    }
    if (statusFilter === 'active') {
      return list.filter(m => m.status === 'active');
    }
    return list;
  }, [managers, statusFilter, queryState, queryDistrict, queryDivision, queryPincode, selectedFilterState, selectedFilterDistrict, selectedFilterDivision, selectedFilterPincode, locking]);

  const totalCount = managers.length;
  const pendingCount = managers.filter(m => m.status === 'under_review' || m.status === 'pending' || m.status === 'pending_admin_approval').length;
  const activeCount = managers.filter(m => m.status === 'active').length;

  const handleOpenModal = (manager) => {
    setSelectedManager(manager);
    setModalOpen(true);
  };

  const handleManagerUpdated = (updatedManager) => {
    setManagers(prev => prev.map(m => (m.id === updatedManager.id || m._id === updatedManager._id ? updatedManager : m)));
    loadData();
  };

  // Add Manager Wizard State
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({ ...EMPTY_MGR_FORM });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const fileRef = useRef();
  const aadharFileRef = useRef();
  const panFileRef = useRef();
  const bankFileRef = useRef();
  const chequeFileRef = useRef();
  const sigFileRef = useRef();
  const [uploadingDocs, setUploadingDocs] = useState({
    aadhar: false,
    pan: false,
    bankPassbook: false,
    cancelledCheque: false,
    signature: false
  });
  const [docErrors, setDocErrors] = useState({
    aadhar: '',
    pan: '',
    bankPassbook: '',
    cancelledCheque: '',
    signature: ''
  });
  const [previewDocModal, setPreviewDocModal] = useState({ isOpen: false, url: '', title: '', isPdf: false });
  const [registeredDistrictList, setRegisteredDistrictList] = useState([]);

  useEffect(() => {
    dataService.getDistricts().then(res => {
      if (res?.success && Array.isArray(res.districts) && res.districts.length > 0) {
        setRegisteredDistrictList(res.districts.map(d => d.name));
      }
    }).catch(console.error);
  }, []);

  const setF = (patch) => setForm(f => ({ ...f, ...patch }));

  const isSuperAdmin = 
    normalizedUserRole === 'Super Admin' ||
    rawRole === 'admin' ||
    rawRole.includes('super') ||
    rawRole.includes('main admin');

  const isStateAdmin = !isSuperAdmin && (
    normalizedUserRole === 'State Admin' ||
    (rawRole.includes('state') && !rawRole.includes('manager')) ||
    (!normalizedUserRole && location.pathname.includes('/state-admin/'))
  );

  const isDistrictAdmin = !isSuperAdmin && !isStateAdmin && (
    normalizedUserRole === 'District Admin' ||
    (rawRole.includes('district') && !rawRole.includes('manager')) ||
    (!normalizedUserRole && location.pathname.includes('/district-admin/'))
  );

  const isDivisionalAdmin = !isSuperAdmin && !isStateAdmin && !isDistrictAdmin && (
    normalizedUserRole === 'Divisional Admin' ||
    ((rawRole.includes('division') || rawRole.includes('divisional')) && !rawRole.includes('manager')) ||
    (!normalizedUserRole && (location.pathname.includes('/divisional-admin/') || location.pathname.includes('/division-admin/')))
  );

  const isPincodeAdmin = !isSuperAdmin && !isStateAdmin && !isDistrictAdmin && !isDivisionalAdmin && (
    normalizedUserRole === 'Pincode Admin' ||
    (rawRole.includes('pincode') && !rawRole.includes('manager')) ||
    (!normalizedUserRole && location.pathname.includes('/pincode-admin/'))
  );

  // Hierarchy-based manager creation authorization rules:
  // - State Admin can create State Managers ONLY.
  // - District Admin can create District Managers ONLY.
  // - Division Admin can create Divisional Managers ONLY.
  // - Pincode Admin can create Pincode Managers ONLY.
  // - Super Admin can create any manager level.
  const adminAllowedCreationRole = useMemo(() => {
    if (isSuperAdmin) return 'all';
    if (isStateAdmin) return 'state_manager';
    if (isDistrictAdmin) return 'district_manager';
    if (isDivisionalAdmin) return 'division_manager';
    if (isPincodeAdmin) return 'pincode_manager';
    return null;
  }, [isSuperAdmin, isStateAdmin, isDistrictAdmin, isDivisionalAdmin, isPincodeAdmin]);

  // Role creation validation helper
  const canCreateRole = (targetRole, targetTerritory = {}) => {
    if (!targetRole) return false;
    if (isSuperAdmin) return true;
    if (adminAllowedCreationRole !== targetRole) return false;

    // Territory boundaries validation
    if (isStateAdmin) {
      if (locking.stateLocked && targetTerritory.state && locking.defaultState &&
          targetTerritory.state.toLowerCase() !== locking.defaultState.toLowerCase()) {
        return false;
      }
      return true;
    }
    if (isDistrictAdmin) {
      if (locking.districtLocked && targetTerritory.district && locking.defaultDistrict &&
          targetTerritory.district.toLowerCase() !== locking.defaultDistrict.toLowerCase()) {
        return false;
      }
      return true;
    }
    if (isDivisionalAdmin) {
      if (locking.divisionLocked && targetTerritory.division && locking.defaultDivision &&
          targetTerritory.division.toLowerCase() !== locking.defaultDivision.toLowerCase()) {
        return false;
      }
      return true;
    }
    if (isPincodeAdmin) {
      if (locking.pincodeLocked && targetTerritory.pincode && locking.defaultPincode &&
          String(targetTerritory.pincode).trim() !== String(locking.defaultPincode).trim()) {
        return false;
      }
      return true;
    }
    return false;
  };

  // Map the current roster level to its corresponding manager role
  const currentRosterRole = 
    activeLevel === 'district' ? 'district_manager' :
    activeLevel === 'divisional' ? 'division_manager' :
    activeLevel === 'pincode' ? 'pincode_manager' :
    'state_manager';

  // Can the admin add a manager on this active roster view?
  // Only true if the admin is permitted to create the manager role for this activeLevel
  const canAddManager = canCreateRole(currentRosterRole);

  const designatedRole = (adminAllowedCreationRole && adminAllowedCreationRole !== 'all')
    ? adminAllowedCreationRole
    : currentRosterRole;

  const designatedRoleLabel = 
    designatedRole === 'state_manager' ? 'State Manager' :
    designatedRole === 'district_manager' ? 'District Manager' :
    designatedRole === 'division_manager' ? 'Division Manager' :
    'Pincode Manager';

  const openAddManager = (prefill = {}) => {
    const roleToUse = (adminAllowedCreationRole && adminAllowedCreationRole !== 'all')
      ? adminAllowedCreationRole
      : (prefill.role || designatedRole);
    const stateToUse = locking.stateLocked
      ? (locking.defaultState || 'Tamil Nadu')
      : (prefill.assignedState || effectiveUser?.state || user?.state || (territoryTree[0]?.name || 'Tamil Nadu'));
    const matchedState = territoryTree.find(s => s.name?.toLowerCase() === stateToUse?.toLowerCase());
    const stateIdToUse = prefill.assignedStateId || (matchedState ? String(matchedState.id || matchedState._id) : '');

    const districtToUse = locking.districtLocked
      ? (locking.defaultDistrict || '')
      : (prefill.assignedDistrict || (isStateAdmin ? '' : (effectiveUser?.district || user?.district || '')));

    const divisionToUse = locking.divisionLocked
      ? (locking.defaultDivision || '')
      : (prefill.assignedDivision || ((isStateAdmin || isDistrictAdmin) ? '' : (effectiveUser?.division || user?.division || '')));

    const pincodeToUse = locking.pincodeLocked
      ? (locking.defaultPincode || '')
      : (prefill.assignedPincode || (isPincodeAdmin ? (effectiveUser?.pincode || user?.pincode || '') : ''));

    setForm({
      ...EMPTY_MGR_FORM,
      role: roleToUse,
      assignedState: stateToUse,
      assignedStateId: stateIdToUse,
      assignedDistrict: districtToUse,
      assignedDistrictId: prefill.assignedDistrictId || '',
      assignedDivision: divisionToUse,
      assignedDivisionId: prefill.assignedDivisionId || '',
      assignedPincode: pincodeToUse,
      assignedPincodeId: prefill.assignedPincodeId || '',
      state: stateToUse,
      district: districtToUse,
      division: divisionToUse,
      pincode: pincodeToUse,
      status: 'active'
    });
    setCurrentStep(1);
    setAddError('');
    setAddSuccess('');
    setShowAddModal(true);
  };

  const closeAddManager = () => {
    setShowAddModal(false);
    setAddSuccess('');
    setAddError('');
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setF({ profilePhoto: file, profilePhotoPreview: preview });
  };

  const handleDocUpload = async (docKey, file) => {
    if (!file) return;
    setDocErrors(prev => ({ ...prev, [docKey]: '' }));

    // File validation: Size (10MB limit) & Type
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setDocErrors(prev => ({ ...prev, [docKey]: 'File size exceeds 10MB limit. Please choose a smaller file.' }));
      return;
    }
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (!allowed.includes(ext)) {
      setDocErrors(prev => ({ ...prev, [docKey]: 'Invalid file type. Only PDF, JPG, and PNG files are accepted.' }));
      return;
    }

    setUploadingDocs(prev => ({ ...prev, [docKey]: true }));
    try {
      const res = await dataService.uploadDocument(file);
      if (res && res.success && res.file) {
        const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
        if (docKey === 'aadhar') {
          setF({ aadharPhoto: file, aadharUrl: res.file.url, aadharFileName: res.file.name, aadharPhotoPreview: preview });
        } else if (docKey === 'pan') {
          setF({ panPhoto: file, panUrl: res.file.url, panFileName: res.file.name, panPhotoPreview: preview });
        } else if (docKey === 'bankPassbook') {
          setF({ bankPassbookPhoto: file, bankPassbookUrl: res.file.url, bankPassbookFileName: res.file.name, bankPassbookPhotoPreview: preview });
        } else if (docKey === 'cancelledCheque') {
          setF({ cancelledChequePhoto: file, cancelledChequeUrl: res.file.url, cancelledChequeFileName: res.file.name, cancelledChequePhotoPreview: preview });
        } else if (docKey === 'signature') {
          setF({ signaturePhoto: file, signatureUrl: res.file.url, signatureFileName: res.file.name, signaturePhotoPreview: preview });
        }
      } else {
        setDocErrors(prev => ({ ...prev, [docKey]: res?.message || 'Document upload failed. Please try again.' }));
      }
    } catch (err) {
      setDocErrors(prev => ({ ...prev, [docKey]: err.message || 'Document upload failed. Please try again.' }));
    } finally {
      setUploadingDocs(prev => ({ ...prev, [docKey]: false }));
    }
  };

  const handleAadharUpload = (e) => {
    const file = e.target.files[0];
    if (file) handleDocUpload('aadhar', file);
  };

  const handlePanUpload = (e) => {
    const file = e.target.files[0];
    if (file) handleDocUpload('pan', file);
  };

  const handleBankUpload = (e) => {
    const file = e.target.files[0];
    if (file) handleDocUpload('bankPassbook', file);
  };

  const handleChequeUpload = (e) => {
    const file = e.target.files[0];
    if (file) handleDocUpload('cancelledCheque', file);
  };

  const handleSigUpload = (e) => {
    const file = e.target.files[0];
    if (file) handleDocUpload('signature', file);
  };

  const handleAddSubmit = async () => {
    setAddError('');
    setAddSuccess('');

    const isUploadingAny = Object.values(uploadingDocs).some(Boolean);
    if (isUploadingAny) {
      setAddError('Please wait for document uploads to complete before submitting.');
      return;
    }

    for (let s = 1; s <= 6; s++) {
      const err = validateStep(s);
      if (err) {
        setAddError(err);
        setCurrentStep(s);
        return;
      }
    }

    setAddLoading(true);
    try {
      const stateVal = locking.stateLocked ? locking.defaultState : (form.assignedState || form.state || 'Tamil Nadu');
      const districtVal = locking.districtLocked ? locking.defaultDistrict : (form.assignedDistrict || form.district || '');
      const divisionVal = locking.divisionLocked ? locking.defaultDivision : (form.assignedDivision || form.division || '');
      const pincodeVal = locking.pincodeLocked ? locking.defaultPincode : (form.assignedPincode || form.pincode || '');

      const payload = {
        name: form.fullName.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        role: form.role,
        state: stateVal,
        assignedState: stateVal,
        assignedStateId: form.assignedStateId || '',
        stateId: form.assignedStateId || '',
        dob: form.dob,
        gender: form.gender,
        doorStreet: form.doorStreet,
        area: form.area,
        city: form.city,
        aadharNumber: form.aadharNumber.trim(),
        aadharUrl: form.aadharUrl,
        aadharPhoto: form.aadharUrl,
        aadharFileName: form.aadharFileName,
        panNumber: form.panNumber.trim().toUpperCase(),
        panUrl: form.panUrl,
        panPhoto: form.panUrl,
        panFileName: form.panFileName,
        bankPassbookUrl: form.bankPassbookUrl,
        bankPassbookPhoto: form.bankPassbookUrl,
        bankPassbookFileName: form.bankPassbookFileName,
        bankUrl: form.bankPassbookUrl,
        bankFileName: form.bankPassbookFileName,
        cancelledChequeUrl: form.cancelledChequeUrl,
        cancelledChequePhoto: form.cancelledChequeUrl,
        cancelledChequeFileName: form.cancelledChequeFileName,
        signatureUrl: form.signatureUrl,
        signaturePhoto: form.signatureUrl,
        signatureFileName: form.signatureFileName,
        accountHolderName: form.accountHolderName || form.fullName.trim(),
        bankName: form.bankName,
        accountNumber: form.accountNumber,
        ifscCode: form.ifscCode,
        branchName: form.branchName,
        status: form.status || 'active',
        loginId: form.loginId.trim(),
        password: form.password
      };

      if (form.role === 'district_manager' || form.role === 'division_manager' || form.role === 'pincode_manager') {
        payload.district = districtVal;
        payload.assignedDistrict = districtVal;
        payload.assignedDistrictId = form.assignedDistrictId || '';
        payload.districtId = form.assignedDistrictId || '';
      }

      if (form.role === 'division_manager' || form.role === 'pincode_manager') {
        payload.division = divisionVal;
        payload.assignedDivision = divisionVal;
        payload.assignedDivisionId = form.assignedDivisionId || '';
        payload.divisionId = form.assignedDivisionId || '';
      }

      if (form.role === 'pincode_manager') {
        payload.pincode = pincodeVal;
        payload.assignedPincode = pincodeVal;
        payload.assignedPincodeId = form.assignedPincodeId || '';
        payload.pincodeId = form.assignedPincodeId || '';
      }

      const res = await dataService.addManager(payload);
      if (res.success) {
        setAddSuccess(res.message || 'Manager registered successfully with verified documents!');
        loadData();
        loadTerritoryTree();
        setTimeout(() => {
          setShowAddModal(false);
          setAddSuccess('');
        }, 1200);
      } else {
        setAddError(res.message || 'Failed to register manager.');
      }
    } catch (err) {
      setAddError(err.message || 'Failed to add manager.');
    } finally {
      setAddLoading(false);
    }
  };

  const getMaxDobDate = () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const is18Plus = (dobString) => {
    if (!dobString) return true;
    const dobDate = new Date(dobString);
    if (isNaN(dobDate.getTime())) return false;
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() - 18);
    maxDate.setHours(23, 59, 59, 999);
    return dobDate <= maxDate;
  };

  const handleMobileChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.startsWith('91') && val.length === 12) {
      val = val.slice(2);
    }
    if (val.length > 0 && !/^[6-9]/.test(val)) {
      return;
    }
    if (val.length > 10) {
      val = val.slice(0, 10);
    }
    setF({ mobile: val });
  };

  const validateStep = (step) => {
    if (step === 1) {
      if (!form.fullName.trim()) return 'Please enter the Full Name.';
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Please enter a valid Email Address.';
      if (!form.mobile.trim()) return 'Please enter the Mobile Number.';
      if (!/^[6-9]\d{9}$/.test(form.mobile.trim())) return 'Mobile number must be 10 digits and start with 6, 7, 8, or 9.';
      if (form.dob && !is18Plus(form.dob)) return 'Date of Birth must be 18+ years ago (Manager must be at least 18 years old).';
      return null;
    }
    if (step === 2) {
      const activeRole = form.role || designatedRole;
      if (activeRole === 'state_manager' && !(form.assignedState || user?.state)) return 'Please assign State jurisdiction.';
      if (activeRole === 'district_manager' && (!(form.assignedState || user?.state) || !(form.assignedDistrict || user?.district))) return 'Please assign District jurisdiction.';
      if (activeRole === 'division_manager' && (!(form.assignedState || user?.state) || !(form.assignedDistrict || user?.district) || !(form.assignedDivision || user?.division))) return 'Please assign Division jurisdiction.';
      if (activeRole === 'pincode_manager' && !(form.assignedPincode || user?.pincode)) return 'Please assign Pincode jurisdiction.';
      return null;
    }
    if (step === 3) {
      return validateAddressDetails(form, { requiresDistrict: false });
    }
    if (step === 4) {
      // All 7 identity and official documents are strictly mandatory
      const aadharNum = (form.aadharNumber || '').trim();
      if (!aadharNum) return 'Please enter the 12-digit Aadhaar Card Number.';
      if (!/^\d{12}$/.test(aadharNum)) return 'Aadhaar Card Number must be exactly 12 numeric digits.';
      if (!form.aadharUrl && !form.aadharPhoto) return 'Aadhaar Card Document is mandatory. Please upload Aadhaar front/back document.';

      const panNum = (form.panNumber || '').trim().toUpperCase();
      if (!panNum) return 'Please enter the PAN Card Number.';
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNum)) return 'PAN Card Number must be valid format (e.g. ABCDE1234F - 5 uppercase letters, 4 digits, 1 uppercase letter).';
      if (!form.panUrl && !form.panPhoto) return 'PAN Card Document is mandatory. Please upload PAN card scan.';

      if (!form.bankPassbookUrl && !form.bankPassbookPhoto) return 'Bank Passbook / Bank Account Document is mandatory. Please upload the bank document.';
      if (!form.cancelledChequeUrl && !form.cancelledChequePhoto) return 'Cancelled Cheque document is mandatory. Please upload the cancelled cheque.';
      if (!form.signatureUrl && !form.signaturePhoto) return 'Digital Signature is mandatory. Please upload the manager\'s digital signature.';

      return null;
    }
    if (step === 5) {
      return validateBankDetails(form);
    }
    if (step === 6) {
      if (!form.loginId.trim()) return 'Please enter a Login ID.';
      if (form.password.length < 6) return 'Password must be at least 6 characters.';
      if (form.password !== form.confirmPassword) return 'Password and Confirm Password do not match.';
      return null;
    }
    return null;
  };

  const canNextStep = () => {
    return !validateStep(currentStep);
  };

  const inputCls = `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition ${
    isDark
      ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:border-blue-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
  }`;

  // Dynamic cascading territory options derived from territoryTree
  const dynamicStates = useMemo(() => {
    if (territoryTree && territoryTree.length > 0) {
      return territoryTree.map(s => ({
        id: String(s.id || s._id || s.stateId || s.name),
        name: s.name
      }));
    }
    return ALL_INDIAN_STATES.map(s => ({ id: s, name: s }));
  }, [territoryTree]);

  const selectedStateObj = useMemo(() => {
    if (!form.assignedState && !form.assignedStateId) return null;
    return territoryTree.find(s => 
      (form.assignedStateId && String(s.id || s._id) === String(form.assignedStateId)) ||
      (form.assignedState && s.name?.toLowerCase() === form.assignedState.toLowerCase())
    ) || null;
  }, [territoryTree, form.assignedState, form.assignedStateId]);

  const dynamicDistricts = useMemo(() => {
    if (selectedStateObj && Array.isArray(selectedStateObj.districts) && selectedStateObj.districts.length > 0) {
      return selectedStateObj.districts.map(d => ({
        id: String(d.id || d._id || d.districtId || d.name),
        name: d.name,
        stateId: d.stateId
      }));
    }
    return registeredDistrictList.map(d => ({ id: d, name: d }));
  }, [selectedStateObj, registeredDistrictList]);

  const selectedDistrictObj = useMemo(() => {
    if (!selectedStateObj || (!form.assignedDistrict && !form.assignedDistrictId)) return null;
    return (selectedStateObj.districts || []).find(d =>
      (form.assignedDistrictId && String(d.id || d._id) === String(form.assignedDistrictId)) ||
      (form.assignedDistrict && d.name?.toLowerCase() === form.assignedDistrict.toLowerCase())
    ) || null;
  }, [selectedStateObj, form.assignedDistrict, form.assignedDistrictId]);

  const dynamicDivisions = useMemo(() => {
    if (selectedDistrictObj && Array.isArray(selectedDistrictObj.divisions) && selectedDistrictObj.divisions.length > 0) {
      return selectedDistrictObj.divisions.map(v => ({
        id: String(v.id || v._id || v.divisionId || v.name),
        name: v.name,
        districtId: v.districtId
      }));
    }
    return form.assignedState && form.assignedDistrict ? getDivisionsForDistrict(form.assignedState, form.assignedDistrict).map(d => ({ id: d, name: d })) : [];
  }, [selectedDistrictObj, form.assignedState, form.assignedDistrict]);

  const selectedDivisionObj = useMemo(() => {
    if (!selectedDistrictObj || (!form.assignedDivision && !form.assignedDivisionId)) return null;
    return (selectedDistrictObj.divisions || []).find(v =>
      (form.assignedDivisionId && String(v.id || v._id) === String(form.assignedDivisionId)) ||
      (form.assignedDivision && v.name?.toLowerCase() === form.assignedDivision.toLowerCase())
    ) || null;
  }, [selectedDistrictObj, form.assignedDivision, form.assignedDivisionId]);

  const dynamicPincodes = useMemo(() => {
    if (selectedDivisionObj) {
      if (Array.isArray(selectedDivisionObj.rawPincodes) && selectedDivisionObj.rawPincodes.length > 0) {
        return selectedDivisionObj.rawPincodes.map(p => ({
          id: String(p.id || p._id || p.code),
          code: String(p.code || p.pincode),
          name: p.name || p.area || String(p.code || p.pincode)
        }));
      }
      if (Array.isArray(selectedDivisionObj.pincodes) && selectedDivisionObj.pincodes.length > 0) {
        return selectedDivisionObj.pincodes.map(pin => ({
          id: String(pin),
          code: String(pin),
          name: String(pin)
        }));
      }
    }
    return (form.assignedState && form.assignedDistrict && form.assignedDivision)
      ? getPincodesForDivision(form.assignedState, form.assignedDistrict, form.assignedDivision).map(p => ({ id: p, code: p, name: p }))
      : [];
  }, [selectedDivisionObj, form.assignedState, form.assignedDistrict, form.assignedDivision]);

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <FieldInput label="Full Name" required>
                  <input
                    type="text"
                    className={inputCls}
                    placeholder="e.g. Anand Kumar"
                    value={form.fullName}
                    onChange={(e) => setF({ fullName: e.target.value })}
                  />
                </FieldInput>
              </div>
              <FieldInput label="Email Address" required>
                <input
                  type="email"
                  className={inputCls}
                  placeholder="e.g. anand.mgr@gmail.com"
                  value={form.email}
                  onChange={(e) => setF({ email: e.target.value, loginId: form.loginId || e.target.value })}
                />
              </FieldInput>
              <FieldInput label="Mobile Number" required>
                <input
                  type="tel"
                  className={inputCls}
                  placeholder="10-digit number (starts with 6,7,8,9)"
                  maxLength={10}
                  value={form.mobile}
                  onChange={handleMobileChange}
                />
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-slate-400">10 digits starting with 6, 7, 8, 9</span>
                  {form.mobile && form.mobile.length > 0 && form.mobile.length < 10 && (
                    <span className="text-amber-500 font-medium">
                      {10 - form.mobile.length} more digit{10 - form.mobile.length > 1 ? 's' : ''} needed
                    </span>
                  )}
                  {form.mobile && form.mobile.length === 10 && (
                    <span className="text-emerald-500 font-semibold">Valid 10-digit number</span>
                  )}
                </div>
              </FieldInput>
              <FieldInput label="Date of Birth">
                <input
                  type="date"
                  className={inputCls}
                  max={getMaxDobDate()}
                  value={form.dob}
                  onChange={(e) => setF({ dob: e.target.value })}
                />
                <div className="flex items-center justify-between mt-1 text-[10px]">
                  <span className="text-slate-400">Must be at least 18 years old (18+)</span>
                  {form.dob && !is18Plus(form.dob) && (
                    <span className="text-rose-500 font-semibold">Under 18 not allowed</span>
                  )}
                  {form.dob && is18Plus(form.dob) && (
                    <span className="text-emerald-500 font-semibold">Age verified (18+)</span>
                  )}
                </div>
              </FieldInput>
              <FieldInput label="Gender">
                <select
                  className={inputCls}
                  value={form.gender}
                  onChange={(e) => setF({ gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </FieldInput>
              <div className="sm:col-span-2">
                <FieldInput label="Profile Photo">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition ${
                      isDark
                        ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400'
                        : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                    }`}
                  >
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-xs text-slate-400">
                      {form.profilePhoto ? form.profilePhoto.name : 'Choose JPG/PNG photo'}
                    </span>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </div>
                </FieldInput>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            {isSuperAdmin ? (
              <FieldInput label="Manager Operational Role" required>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { id: 'state_manager', label: 'State Manager', level: 1 },
                    { id: 'district_manager', label: 'District Manager', level: 2 },
                    { id: 'division_manager', label: 'Division Manager', level: 3 },
                    { id: 'pincode_manager', label: 'Pincode Manager', level: 4 }
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setF({ role: r.id })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        form.role === r.id
                          ? isDark
                            ? 'bg-blue-950/70 border-blue-500 text-blue-300 ring-2 ring-blue-500/40'
                            : 'bg-blue-50 border-blue-600 text-blue-900 ring-2 ring-blue-100'
                          : isDark
                          ? 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs">{r.label}</div>
                      <div className="text-[10px] opacity-75 mt-0.5">Tier {r.level} Operations</div>
                    </button>
                  ))}
                </div>
              </FieldInput>
            ) : (
              <div className={`p-4 rounded-xl border ${
                isDark ? 'bg-blue-950/40 border-blue-800/60' : 'bg-blue-50/70 border-blue-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                        Designated Operational Role
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        Authority Locked
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {designatedRoleLabel}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      As a {user?.role || 'Administrator'}, you are authorized to add and onboard {designatedRoleLabel}s within your administrative jurisdiction.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <FieldInput label="Assigned State" required>
                {locking.stateLocked ? (
                  <div className="relative">
                    <input
                      type="text"
                      disabled
                      readOnly
                      className={`${inputCls} opacity-90 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold pr-9`}
                      value={form.assignedState || locking.defaultState || 'Tamil Nadu'}
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                ) : (
                  <select
                    className={inputCls}
                    value={form.assignedStateId || form.assignedState}
                    onChange={(e) => {
                      const val = e.target.value;
                      const sObj = dynamicStates.find(s => s.id === val || s.name === val);
                      setF({
                        assignedState: sObj ? sObj.name : val,
                        assignedStateId: sObj ? sObj.id : '',
                        assignedDistrict: '',
                        assignedDistrictId: '',
                        assignedDivision: '',
                        assignedDivisionId: '',
                        assignedPincode: '',
                        assignedPincodeId: ''
                      });
                    }}
                  >
                    <option value="">Select State</option>
                    {dynamicStates.map((s) => (
                      <option key={s.id || s.name} value={s.id || s.name}>{s.name}</option>
                    ))}
                  </select>
                )}
              </FieldInput>

              {form.role !== 'state_manager' && (
                <FieldInput label="Assigned District" required={form.role !== 'state_manager'}>
                  {locking.districtLocked ? (
                    <div className="relative">
                      <input
                        type="text"
                        disabled
                        readOnly
                        className={`${inputCls} opacity-90 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold pr-9`}
                        value={form.assignedDistrict || locking.defaultDistrict || ''}
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  ) : dynamicDistricts.length > 0 ? (
                    <select
                      className={inputCls}
                      value={form.assignedDistrictId || form.assignedDistrict}
                      onChange={(e) => {
                        const val = e.target.value;
                        const dObj = dynamicDistricts.find(d => d.id === val || d.name === val);
                        setF({
                          assignedDistrict: dObj ? dObj.name : val,
                          assignedDistrictId: dObj ? dObj.id : '',
                          assignedDivision: '',
                          assignedDivisionId: '',
                          assignedPincode: '',
                          assignedPincodeId: ''
                        });
                      }}
                    >
                      <option value="">Select District</option>
                      {dynamicDistricts.map((d) => (
                        <option key={d.id || d.name} value={d.id || d.name}>{d.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. Krishnagiri"
                      value={form.assignedDistrict}
                      onChange={(e) => setF({ assignedDistrict: e.target.value })}
                    />
                  )}
                </FieldInput>
              )}

              {(form.role === 'division_manager' || form.role === 'pincode_manager') && (
                <FieldInput label="Assigned Division" required>
                  {locking.divisionLocked ? (
                    <div className="relative">
                      <input
                        type="text"
                        disabled
                        readOnly
                        className={`${inputCls} opacity-90 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold pr-9`}
                        value={form.assignedDivision || locking.defaultDivision || ''}
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  ) : dynamicDivisions.length > 0 ? (
                    <select
                      className={inputCls}
                      value={form.assignedDivisionId || form.assignedDivision}
                      onChange={(e) => {
                        const val = e.target.value;
                        const vObj = dynamicDivisions.find(v => v.id === val || v.name === val);
                        setF({
                          assignedDivision: vObj ? vObj.name : val,
                          assignedDivisionId: vObj ? vObj.id : '',
                          assignedPincode: '',
                          assignedPincodeId: ''
                        });
                      }}
                    >
                      <option value="">Select Division</option>
                      {dynamicDivisions.map((div) => (
                        <option key={div.id || div.name} value={div.id || div.name}>{div.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. Attur"
                      value={form.assignedDivision}
                      onChange={(e) => setF({ assignedDivision: e.target.value })}
                    />
                  )}
                </FieldInput>
              )}

              {form.role === 'pincode_manager' && (
                <FieldInput label="Assigned Pincode" required>
                  {locking.pincodeLocked ? (
                    <div className="relative">
                      <input
                        type="text"
                        disabled
                        readOnly
                        className={`${inputCls} opacity-90 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold pr-9`}
                        value={form.assignedPincode || locking.defaultPincode || ''}
                      />
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  ) : dynamicPincodes.length > 0 ? (
                    <select
                      className={inputCls}
                      value={form.assignedPincodeId || form.assignedPincode}
                      onChange={(e) => {
                        const val = e.target.value;
                        const pObj = dynamicPincodes.find(p => p.id === val || p.code === val);
                        setF({
                          assignedPincode: pObj ? pObj.code : val,
                          assignedPincodeId: pObj ? pObj.id : ''
                        });
                      }}
                    >
                      <option value="">Select 6-digit Pincode</option>
                      {dynamicPincodes.map((pin) => (
                        <option key={pin.id || pin.code} value={pin.id || pin.code}>
                          {pin.code}{pin.name && pin.name !== pin.code ? ` (${pin.name})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="e.g. 636102"
                      maxLength={6}
                      value={form.assignedPincode}
                      onChange={(e) => setF({ assignedPincode: e.target.value.replace(/\D/g, '') })}
                    />
                  )}
                </FieldInput>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldInput label="Door No / Street" required>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. 12, Bazaar Street"
                  value={form.doorStreet}
                  onChange={(e) => setF({ doorStreet: e.target.value })}
                />
              </FieldInput>
            </div>
            <FieldInput label="Village / Area / Locality" required>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Gandhinagar"
                value={form.area}
                onChange={(e) => setF({ area: e.target.value })}
              />
            </FieldInput>
            <FieldInput label="City / Town">
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Salem"
                value={form.city}
                onChange={(e) => setF({ city: e.target.value })}
              />
            </FieldInput>
            <FieldInput label="District" required>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Salem"
                value={form.district}
                onChange={(e) => setF({ district: e.target.value })}
              />
            </FieldInput>
            <FieldInput label="State" required>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Tamil Nadu"
                value={form.state}
                onChange={(e) => setF({ state: e.target.value })}
              />
            </FieldInput>
            <FieldInput label="Pincode" required>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. 636001"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => setF({ pincode: cleanPincode(e.target.value) })}
              />
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                <span>Exact 6 digits</span>
                {form.pincode && form.pincode.length === 6 && (
                  <span className="text-emerald-500 font-semibold">Valid 6-digit Pincode</span>
                )}
              </div>
            </FieldInput>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
              isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong>Identity & Official Documents:</strong> All 7 items below are mandatory for onboarding this manager. Documents must be clear PDF, JPG, or PNG files under 10MB.
              </div>
            </div>

            {/* Aadhaar Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Aadhaar Card Number" required>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="12-digit Aadhaar Number"
                  maxLength={12}
                  value={form.aadharNumber}
                  onChange={(e) => setF({ aadharNumber: e.target.value.replace(/\D/g, '') })}
                />
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span>Exact 12 numeric digits</span>
                  {form.aadharNumber && form.aadharNumber.length === 12 && (
                    <span className="text-emerald-500 font-semibold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Valid length
                    </span>
                  )}
                </div>
              </FieldInput>

              <FieldInput label="Aadhaar Document Photo" required>
                <div className="space-y-1">
                  <div
                    onClick={() => !uploadingDocs.aadhar && aadharFileRef.current?.click()}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition ${
                      docErrors.aadhar
                        ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                        : form.aadharUrl || form.aadharPhoto
                        ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 dark:border-emerald-800'
                        : isDark
                        ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400'
                        : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {uploadingDocs.aadhar ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                      ) : form.aadharUrl || form.aadharPhoto ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className={`text-xs truncate ${form.aadharUrl || form.aadharPhoto ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
                        {uploadingDocs.aadhar
                          ? 'Uploading Aadhaar to secure storage...'
                          : form.aadharPhoto?.name || form.aadharFileName || 'Upload Aadhaar front/back'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {(form.aadharUrl || form.aadharPhoto) && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                          Uploaded
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                        {form.aadharUrl || form.aadharPhoto ? 'Replace' : 'Browse'}
                      </span>
                    </div>
                    <input ref={aadharFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleAadharUpload} />
                  </div>
                  {docErrors.aadhar && (
                    <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {docErrors.aadhar}
                    </p>
                  )}
                </div>
              </FieldInput>
            </div>

            {/* PAN Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="PAN Card Number" required>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                  value={form.panNumber}
                  onChange={(e) => setF({ panNumber: e.target.value.toUpperCase() })}
                />
                <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                  <span>5 letters + 4 digits + 1 letter</span>
                  {form.panNumber && /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.panNumber) && (
                    <span className="text-emerald-500 font-semibold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> Valid PAN format
                    </span>
                  )}
                </div>
              </FieldInput>

              <FieldInput label="PAN Document Photo" required>
                <div className="space-y-1">
                  <div
                    onClick={() => !uploadingDocs.pan && panFileRef.current?.click()}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition ${
                      docErrors.pan
                        ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                        : form.panUrl || form.panPhoto
                        ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 dark:border-emerald-800'
                        : isDark
                        ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400'
                        : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {uploadingDocs.pan ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                      ) : form.panUrl || form.panPhoto ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className={`text-xs truncate ${form.panUrl || form.panPhoto ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
                        {uploadingDocs.pan
                          ? 'Uploading PAN to secure storage...'
                          : form.panPhoto?.name || form.panFileName || 'Upload PAN card scan'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {(form.panUrl || form.panPhoto) && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                          Uploaded
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                        {form.panUrl || form.panPhoto ? 'Replace' : 'Browse'}
                      </span>
                    </div>
                    <input ref={panFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handlePanUpload} />
                  </div>
                  {docErrors.pan && (
                    <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {docErrors.pan}
                    </p>
                  )}
                </div>
              </FieldInput>
            </div>

            {/* Bank Passbook & Cancelled Cheque */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Bank Passbook / Bank Account Document" required>
                <div className="space-y-1">
                  <div
                    onClick={() => !uploadingDocs.bankPassbook && bankFileRef.current?.click()}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition ${
                      docErrors.bankPassbook
                        ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                        : form.bankPassbookUrl || form.bankPassbookPhoto
                        ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 dark:border-emerald-800'
                        : isDark
                        ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400'
                        : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {uploadingDocs.bankPassbook ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                      ) : form.bankPassbookUrl || form.bankPassbookPhoto ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className={`text-xs truncate ${form.bankPassbookUrl || form.bankPassbookPhoto ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
                        {uploadingDocs.bankPassbook
                          ? 'Uploading bank doc to secure storage...'
                          : form.bankPassbookPhoto?.name || form.bankPassbookFileName || 'Upload Bank Passbook / Statement'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {(form.bankPassbookUrl || form.bankPassbookPhoto) && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                          Uploaded
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                        {form.bankPassbookUrl || form.bankPassbookPhoto ? 'Replace' : 'Browse'}
                      </span>
                    </div>
                    <input ref={bankFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleBankUpload} />
                  </div>
                  {docErrors.bankPassbook && (
                    <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {docErrors.bankPassbook}
                    </p>
                  )}
                </div>
              </FieldInput>

              <FieldInput label="Cancelled Cheque" required>
                <div className="space-y-1">
                  <div
                    onClick={() => !uploadingDocs.cancelledCheque && chequeFileRef.current?.click()}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition ${
                      docErrors.cancelledCheque
                        ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                        : form.cancelledChequeUrl || form.cancelledChequePhoto
                        ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 dark:border-emerald-800'
                        : isDark
                        ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400'
                        : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {uploadingDocs.cancelledCheque ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                      ) : form.cancelledChequeUrl || form.cancelledChequePhoto ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className={`text-xs truncate ${form.cancelledChequeUrl || form.cancelledChequePhoto ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
                        {uploadingDocs.cancelledCheque
                          ? 'Uploading cheque to secure storage...'
                          : form.cancelledChequePhoto?.name || form.cancelledChequeFileName || 'Upload Cancelled Cheque'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {(form.cancelledChequeUrl || form.cancelledChequePhoto) && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                          Uploaded
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                        {form.cancelledChequeUrl || form.cancelledChequePhoto ? 'Replace' : 'Browse'}
                      </span>
                    </div>
                    <input ref={chequeFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleChequeUpload} />
                  </div>
                  {docErrors.cancelledCheque && (
                    <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {docErrors.cancelledCheque}
                    </p>
                  )}
                </div>
              </FieldInput>
            </div>

            {/* Digital Signature */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Digital Signature" required>
                <div className="space-y-1">
                  <div
                    onClick={() => !uploadingDocs.signature && sigFileRef.current?.click()}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition ${
                      docErrors.signature
                        ? 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/20'
                        : form.signatureUrl || form.signaturePhoto
                        ? 'border-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20 dark:border-emerald-800'
                        : isDark
                        ? 'border-slate-600 bg-slate-800/50 hover:border-blue-400'
                        : 'border-slate-300 bg-slate-50 hover:border-blue-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {uploadingDocs.signature ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                      ) : form.signatureUrl || form.signaturePhoto ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      ) : (
                        <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span className={`text-xs truncate ${form.signatureUrl || form.signaturePhoto ? 'font-medium text-emerald-700 dark:text-emerald-300' : 'text-slate-400'}`}>
                        {uploadingDocs.signature
                          ? 'Uploading signature to secure storage...'
                          : form.signaturePhoto?.name || form.signatureFileName || 'Upload Digital Signature (image or PDF)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {(form.signatureUrl || form.signaturePhoto) && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                          Uploaded
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                        {form.signatureUrl || form.signaturePhoto ? 'Replace' : 'Browse'}
                      </span>
                    </div>
                    <input ref={sigFileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleSigUpload} />
                  </div>
                  {docErrors.signature && (
                    <p className="text-[11px] font-medium text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {docErrors.signature}
                    </p>
                  )}
                </div>
              </FieldInput>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <FieldInput label="Account Holder Name" required>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. Anand Kumar"
                  value={form.accountHolderName}
                  onChange={(e) => setF({ accountHolderName: e.target.value })}
                />
              </FieldInput>
            </div>
            <FieldInput label="Bank Name" required>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. State Bank of India"
                value={form.bankName}
                onChange={(e) => setF({ bankName: e.target.value })}
              />
            </FieldInput>
            <FieldInput label="Account Number" required>
              <input
                type="text"
                className={inputCls}
                placeholder="9-18 digits"
                maxLength={18}
                value={form.accountNumber}
                onChange={(e) => setF({ accountNumber: cleanAccountNumber(e.target.value) })}
              />
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                <span>Digits only (9–18 digits)</span>
                {form.accountNumber && form.accountNumber.length >= 9 && form.accountNumber.length <= 18 && (
                  <span className="text-emerald-500 font-semibold">Valid length</span>
                )}
              </div>
            </FieldInput>
            <FieldInput label="IFSC Code" required>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. SBIN0001234"
                maxLength={11}
                value={form.ifscCode}
                onChange={(e) => setF({ ifscCode: cleanIFSC(e.target.value) })}
              />
              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                <span>Format: 4 letters + 0 + 6 alphanumeric</span>
                {form.ifscCode && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode) && (
                  <span className="text-emerald-500 font-semibold">Valid IFSC</span>
                )}
              </div>
            </FieldInput>
            <FieldInput label="Branch Name" required>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. Salem Main Branch"
                value={form.branchName}
                onChange={(e) => setF({ branchName: e.target.value })}
              />
            </FieldInput>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className={`p-3 rounded-xl border text-xs ${
              isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <strong>Account Setup:</strong> Login ID can be an email or custom username. Password must be at least 6 characters.
            </div>

            <FieldInput label="Login ID / Username" required>
              <input
                type="text"
                className={inputCls}
                placeholder="e.g. anand.mgr or email"
                value={form.loginId}
                onChange={(e) => setF({ loginId: e.target.value })}
              />
            </FieldInput>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldInput label="Password" required>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    className={inputCls}
                    placeholder="Min 6 characters"
                    value={form.password}
                    onChange={(e) => setF({ password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FieldInput>

              <FieldInput label="Confirm Password" required>
                <div className="relative">
                  <input
                    type={showConfirmPwd ? 'text' : 'password'}
                    className={`${inputCls} ${form.confirmPassword && form.password !== form.confirmPassword ? '!border-rose-400 !ring-rose-100' : ''}`}
                    placeholder="Re-enter password"
                    value={form.confirmPassword}
                    onChange={(e) => setF({ confirmPassword: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </FieldInput>
            </div>

            <div className="p-3.5 rounded-xl border border-blue-200/80 bg-blue-50/60 dark:bg-blue-950/40 dark:border-blue-800/60 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-bold text-blue-900 dark:text-blue-200">
                  Direct KYC Pipeline Registration
                </div>
                <div className="text-blue-700/90 dark:text-blue-300/90 mt-0.5">
                  When registered by an Admin, this manager profile will automatically move directly to the KYC Team for document verification. Once verified, the manager account will activate and login will be enabled.
                </div>
              </div>
            </div>

            {/* Registration Summary */}
            <div className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
              isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'
            }`}>
              <p className="font-semibold text-slate-600 dark:text-slate-300 mb-2">Registration Summary</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div><span className="text-slate-400">Name:</span> <span className={`font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.fullName || '—'}</span></div>
                <div><span className="text-slate-400">Email:</span> <span className={`font-medium font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>{form.email || '—'}</span></div>
                <div><span className="text-slate-400">Role:</span> <span className="font-semibold text-blue-600 capitalize">{form.role.replace('_', ' ')}</span></div>
                <div><span className="text-slate-400">Jurisdiction:</span> <span className={`font-medium ${isDark ? 'text-cyan-300' : 'text-blue-600'}`}>
                  {form.assignedPincode ? `PIN: ${form.assignedPincode}` : form.assignedDivision ? `${form.assignedDivision} Div` : form.assignedDistrict ? `${form.assignedDistrict} Dist` : `${form.assignedState || 'State'} Tier`}
                </span></div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const columns = [
    {
      header: 'Manager Details',
      accessor: 'name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center font-bold text-xs shrink-0">
            {row.name ? row.name.charAt(0).toUpperCase() : <UserCog className="w-4 h-4" />}
          </div>
          <div>
            <div className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <span>{row.name}</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${config.badgeColor}`}>
                {config.badge}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">{row.email}</div>
          </div>
        </div>
      )
    },
    {
      header: 'Jurisdiction & Authority',
      accessor: 'jurisdiction',
      render: (row) => (
        <div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {row.jurisdiction || 'Tamil Nadu'}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={row.assignedArea}>
            {row.assignedArea || 'State Zone'}
          </div>
          {row.targetAdminRole && (
            <div className="mt-1">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200/60 dark:border-blue-800/50">
                Routed: {row.targetAdminRole}
              </span>
            </div>
          )}
        </div>
      )
    },
    {
      header: 'Contact',
      accessor: 'phone',
      render: (row) => (
        <span className="text-xs text-slate-700 dark:text-slate-300 font-mono flex items-center gap-1">
          <Phone className="w-3 h-3 text-slate-400" /> {row.mobile || row.phone}
        </span>
      )
    },
    {
      header: 'Applied / Joined Date',
      accessor: 'joinedDate',
      render: (row) => (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {row.joinedDate || 'Recently Registered'}
        </span>
      )
    },
    {
      header: 'Status',
      accessor: 'status',
      render: (row) => <StatusBadge status={row.status || 'Active'} />
    },
    {
      header: 'Action',
      accessor: 'actions',
      render: (row) => {
        const isPendingAdmin = row.status === 'under_review' || row.status === 'pending' || row.status === 'pending_admin_approval';
        const canApprove = row.canApprove !== false;
        return (
          <div className="flex items-center gap-2">
            {isPendingAdmin ? (
              <button
                type="button"
                onClick={() => handleOpenModal(row)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer ${
                  canApprove
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                {canApprove ? 'Review & Approve' : 'View Request'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenModal(row)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                View Details
              </button>
            )}

            {activeLevel === 'state' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const s = row.state || row.assignedState || queryState || 'Tamil Nadu';
                  navigate(`/state-admin/managers/district?state=${encodeURIComponent(s)}`);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition shadow-xs cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                }`}
                title="View District Managers"
              >
                <span>District Managers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {activeLevel === 'district' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const s = row.state || row.assignedState || queryState || 'Tamil Nadu';
                  const d = row.district || row.assignedDistrict || '';
                  navigate(`/state-admin/managers/divisional?state=${encodeURIComponent(s)}&district=${encodeURIComponent(d)}`);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition shadow-xs cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                }`}
                title="View Division Managers"
              >
                <span>Division Managers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {activeLevel === 'divisional' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const s = row.state || row.assignedState || queryState || 'Tamil Nadu';
                  const d = row.district || row.assignedDistrict || queryDistrict || '';
                  const v = row.division || row.assignedDivision || '';
                  navigate(`/state-admin/managers/pincode?state=${encodeURIComponent(s)}&district=${encodeURIComponent(d)}&division=${encodeURIComponent(v)}`);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition shadow-xs cursor-pointer ${
                  isDark
                    ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                }`}
                title="View Pincode Managers"
              >
                <span>Pincode Managers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      }
    }
  ];

  const getStateManagers = (state) => {
    const sId = String(state.id || state._id || '').toLowerCase().trim();
    const sName = (state.name || '').toLowerCase().trim();
    return allManagers.filter(m => 
      m.role === 'state_manager' && (
        (sId && String(m.stateId || m.assignedStateId || '').toLowerCase().trim() === sId) ||
        (sName && (
          (m.stateName || '').toLowerCase().trim() === sName ||
          (m.state || '').toLowerCase().trim() === sName ||
          (m.assignedState || '').toLowerCase().trim() === sName
        ))
      )
    );
  };

  const getDistrictManagers = (district, state) => {
    const dId = String(district.id || district._id || district.districtId || '').toLowerCase().trim();
    const dName = (district.name || '').toLowerCase().trim();
    const sName = (state?.name || '').toLowerCase().trim();
    return allManagers.filter(m => 
      m.role === 'district_manager' && (
        (dId && String(m.districtId || m.assignedDistrictId || '').toLowerCase().trim() === dId) ||
        (dName && (
          (m.districtName || '').toLowerCase().trim() === dName ||
          (m.district || '').toLowerCase().trim() === dName ||
          (m.assignedDistrict || '').toLowerCase().trim() === dName
        ))
      ) && (
        !sName ||
        (m.stateName || '').toLowerCase().trim() === sName ||
        (m.state || '').toLowerCase().trim() === sName ||
        (m.assignedState || '').toLowerCase().trim() === sName
      )
    );
  };

  const getDivisionManagers = (division, district, state) => {
    const vId = String(division.id || division._id || division.divisionId || '').toLowerCase().trim();
    const vName = (division.name || '').toLowerCase().trim();
    return allManagers.filter(m => 
      m.role === 'division_manager' && (
        (vId && String(m.divisionId || m.assignedDivisionId || '').toLowerCase().trim() === vId) ||
        (vName && (
          (m.divisionName || '').toLowerCase().trim() === vName ||
          (m.division || '').toLowerCase().trim() === vName ||
          (m.assignedDivision || '').toLowerCase().trim() === vName
        ))
      )
    );
  };

  const getPincodeManagers = (pin, division, district, state) => {
    const pCode = String(pin.code || pin.pincode || pin || '').trim();
    const pId = String(pin.id || pin._id || '').trim();
    return allManagers.filter(m => 
      m.role === 'pincode_manager' && (
        (pId && String(m.pincodeId || m.assignedPincodeId || '').trim() === pId) ||
        (pCode && (
          String(m.pincodeCode || '').trim() === pCode ||
          String(m.pincode || '').trim() === pCode ||
          String(m.assignedPincode || '').trim() === pCode
        ))
      )
    );
  };

  const toggleState = (key) => setExpandedStates(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleDistrict = (key) => setExpandedDistricts(prev => ({ ...prev, [key]: !prev[key] }));
  const toggleDivision = (key) => setExpandedDivisions(prev => ({ ...prev, [key]: !prev[key] }));
  const togglePincode = (key) => setExpandedPincodes(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-6">
      {/* Subtitle / Territory Navigation Instructions matching Image 2 */}
      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Send className="w-3.5 h-3.5 text-blue-500 shrink-0" />
        <span>Click any state to expand. Navigate: State (Max 8) → District (Max 2) → Division (Max 2) → Pincode (Max 2)</span>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total {config.title}</span>
            <UserCog className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{allManagers.length || totalCount}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-0.5">Across territory network</div>
        </div>

        <div className={`p-3.5 rounded-2xl border shadow-sm transition ${
          pendingCount > 0
            ? 'bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
            : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold ${pendingCount > 0 ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
              Pending Approvals
            </span>
            <AlertCircle className={`w-4 h-4 ${pendingCount > 0 ? 'text-amber-600 animate-pulse' : 'text-slate-400'}`} />
          </div>
          <div className={`text-lg font-bold mt-1.5 ${pendingCount > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-900 dark:text-white'}`}>
            {pendingCount}
          </div>
          <div className={`text-[10px] font-medium mt-0.5 ${pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
            {pendingCount > 0 ? 'Awaiting your admin review' : 'All registrations verified'}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Roster</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">{activeCount}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Approved & active</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Territory Coverage</span>
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-white mt-1.5">100%</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">Dynamic DB synchronization</div>
        </div>
      </div>

      {/* Pending Approvals Alert Banner */}
      {pendingCount > 0 && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200/80 dark:border-amber-800/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                {pendingCount} New Manager Registration{pendingCount > 1 ? 's' : ''} Awaiting Admin Approval
              </h4>
              <p className="text-[11px] text-amber-700/90 dark:text-amber-400 mt-0.5">
                Review candidate credentials and accept registration to activate their manager account.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setViewTab('requests')}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-100 dark:hover:bg-amber-700 transition self-start sm:self-auto cursor-pointer"
          >
            Review Pending Requests
          </button>
        </div>
      )}

      {/* VIEW MODE 1: HIERARCHY ACCORDION VIEW */}
      {viewTab === 'hierarchy' && (
        <div className="space-y-4">
          {territoryLoading ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Loading live territory hierarchy...</p>
            </div>
          ) : territoryTree.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No territory records found in database.</p>
            </div>
          ) : (
            territoryTree.map((state) => {
              const stateKey = String(state.id || state._id || state.name);
              const isStateExpanded = !!expandedStates[stateKey];
              const stateMgrs = getStateManagers(state);

              // Calculate active/pending in this state branch
              const allStateBranchManagers = allManagers.filter(m => {
                const sName = (state.name || '').toLowerCase().trim();
                const sId = String(state.id || state._id || '').toLowerCase().trim();
                return (
                  (sId && String(m.stateId || m.assignedStateId || '').toLowerCase().trim() === sId) ||
                  (sName && (
                    (m.stateName || '').toLowerCase().trim() === sName ||
                    (m.state || '').toLowerCase().trim() === sName ||
                    (m.assignedState || '').toLowerCase().trim() === sName
                  ))
                );
              });
              const stateActiveCount = allStateBranchManagers.filter(m => m.status === 'active').length;
              const statePendingCount = allStateBranchManagers.filter(m => m.status === 'under_review' || m.status === 'pending' || m.status === 'pending_admin_approval').length;

              return (
                <div
                  key={stateKey}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition"
                >
                  {/* State Node Header matching Image 2 */}
                  <div
                    onClick={() => toggleState(stateKey)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition border-b border-transparent select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{state.name}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            STATE LEVEL
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {stateActiveCount} active · {statePendingCount} pending
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Managers: {stateMgrs.length} / 8
                      </span>
                      {canCreateRole('state_manager', { state: state.name }) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openAddManager({
                              role: 'state_manager',
                              assignedState: state.name,
                              assignedStateId: state.id || state._id
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Nominate</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      >
                        {isStateExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded State Content */}
                  {isStateExpanded && (
                    <div className="p-4 pt-0 space-y-4 bg-slate-50/50 dark:bg-slate-950/20 border-t border-slate-100 dark:border-slate-800/60">
                      {/* State Managers Assigned to this State */}
                      <div className="pt-3">
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                          State Managers ({stateMgrs.length})
                        </div>
                        {stateMgrs.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {stateMgrs.map((mgr) => (
                              <div
                                key={mgr.id || mgr._id}
                                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                                  isDark ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800' : 'bg-white border-slate-200 hover:shadow-sm'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center font-bold text-xs shrink-0">
                                    {mgr.name ? mgr.name.charAt(0).toUpperCase() : <UserCog className="w-4 h-4" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-xs text-slate-900 dark:text-white">{mgr.name}</span>
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300">
                                        State Manager
                                      </span>
                                      <StatusBadge status={mgr.status || 'Active'} />
                                    </div>
                                    <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                      <span className="font-mono">{mgr.email}</span>
                                      <span>·</span>
                                      <span className="font-mono flex items-center gap-1">
                                        <Phone className="w-3 h-3 text-slate-400" /> {mgr.mobile || mgr.phone}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenModal(mgr)}
                                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                    <span>View Details</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 flex items-center justify-between">
                            <span>No State Manager assigned yet.</span>
                            {canCreateRole('state_manager', { state: state.name }) && (
                              <button
                                type="button"
                                onClick={() => openAddManager({
                                  role: 'state_manager',
                                  assignedState: state.name,
                                  assignedStateId: state.id || state._id
                                })}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                              >
                                + Add State Manager
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Districts Under State */}
                      <div className="space-y-3 pt-2">
                        {(() => {
                          const assignedDistricts = (state.districts || []).filter(district => {
                            const dMgrs = getDistrictManagers(district, state);
                            if (dMgrs.length > 0) return true;
                            return (district.divisions || []).some(div => {
                              if (getDivisionManagers(div, district, state).length > 0) return true;
                              const rawPins = div.rawPincodes || div.pincodes || [];
                              return rawPins.some(p => getPincodeManagers(p, div, district, state).length > 0);
                            });
                          });

                          if (assignedDistricts.length === 0) {
                            return (
                              <div className="p-4 text-center text-xs text-slate-400 italic bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                No assigned records found.
                              </div>
                            );
                          }

                          return assignedDistricts.map((district) => {
                          const distKey = String(district.id || district._id || district.name);
                          const isDistExpanded = !!expandedDistricts[distKey];
                          const distMgrs = getDistrictManagers(district, state);
                          const distActiveCount = distMgrs.filter(m => m.status === 'active').length;

                          return (
                            <div
                              key={distKey}
                              className="rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 overflow-hidden"
                            >
                              {/* District Header matching Image 2 */}
                              <div
                                onClick={() => toggleDistrict(distKey)}
                                className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition select-none"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                    <Building2 className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{district.name}</span>
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                        DISTRICT
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                      {distActiveCount} active
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3">
                                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    Managers: {distMgrs.length} / 2
                                  </span>
                                  {canCreateRole('district_manager', { state: state.name, district: district.name }) && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openAddManager({
                                          role: 'district_manager',
                                          assignedState: state.name,
                                          assignedStateId: state.id || state._id,
                                          assignedDistrict: district.name,
                                          assignedDistrictId: district.id || district._id
                                        });
                                      }}
                                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Nominate</span>
                                    </button>
                                  )}
                                  <button type="button" className="p-1 text-slate-400">
                                    {isDistExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>

                              {/* Expanded District Content */}
                              {isDistExpanded && (
                                <div className="p-3.5 pt-0 space-y-3 bg-slate-50/60 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800">
                                  {/* District Managers */}
                                  <div className="pt-2">
                                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                                      District Managers ({distMgrs.length})
                                    </div>
                                    {distMgrs.length > 0 ? (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {distMgrs.map((mgr) => (
                                          <div
                                            key={mgr.id || mgr._id}
                                            className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                                              isDark ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800' : 'bg-white border-slate-200 hover:shadow-sm'
                                            }`}
                                          >
                                            <div className="flex items-center gap-3">
                                              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center font-bold text-xs shrink-0">
                                                {mgr.name ? mgr.name.charAt(0).toUpperCase() : <UserCog className="w-4 h-4" />}
                                              </div>
                                              <div>
                                                <div className="flex items-center gap-2">
                                                  <span className="font-bold text-xs text-slate-900 dark:text-white">{mgr.name}</span>
                                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300">
                                                    District Manager
                                                  </span>
                                                  <StatusBadge status={mgr.status || 'Active'} />
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                  <span className="font-mono">{mgr.email}</span>
                                                  <span>·</span>
                                                  <span className="font-mono flex items-center gap-1">
                                                    <Phone className="w-3 h-3 text-slate-400" /> {mgr.mobile || mgr.phone}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => handleOpenModal(mgr)}
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                                              >
                                                <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                                <span>View Details</span>
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 flex items-center justify-between">
                                        <span>No District Manager assigned yet.</span>
                                        {canCreateRole('district_manager', { state: state.name, district: district.name }) && (
                                          <button
                                            type="button"
                                            onClick={() => openAddManager({
                                              role: 'district_manager',
                                              assignedState: state.name,
                                              assignedStateId: state.id || state._id,
                                              assignedDistrict: district.name,
                                              assignedDistrictId: district.id || district._id
                                            })}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                                          >
                                            + Add District Manager
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {/* Divisions Under District */}
                                  <div className="space-y-2.5 pt-1">
                                    {(() => {
                                      const assignedDivisions = (district.divisions || []).filter(division => {
                                        if (getDivisionManagers(division, district, state).length > 0) return true;
                                        const rawPins = division.rawPincodes || division.pincodes || [];
                                        return rawPins.some(p => getPincodeManagers(p, division, district, state).length > 0);
                                      });

                                      if (assignedDivisions.length === 0) {
                                        return (
                                          <div className="p-3 text-center text-xs text-slate-400 italic bg-white dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                                            No assigned records found.
                                          </div>
                                        );
                                      }

                                      return assignedDivisions.map((division) => {
                                      const divKey = String(division.id || division._id || division.name);
                                      const isDivExpanded = !!expandedDivisions[divKey];
                                      const divMgrs = getDivisionManagers(division, district, state);
                                      const divActiveCount = divMgrs.filter(m => m.status === 'active').length;

                                      return (
                                        <div
                                          key={divKey}
                                          className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden"
                                        >
                                          {/* Division Header */}
                                          <div
                                            onClick={() => toggleDivision(divKey)}
                                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition select-none"
                                          >
                                            <div className="flex items-center gap-2.5">
                                              <div className="w-7 h-7 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                                <Layers className="w-3.5 h-3.5" />
                                              </div>
                                              <div>
                                                <div className="flex items-center gap-1.5">
                                                  <span className="font-bold text-xs text-slate-900 dark:text-white">{division.name}</span>
                                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                    DIVISION
                                                  </span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                                  {divActiveCount} active
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2.5">
                                              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                Managers: {divMgrs.length} / 2
                                              </span>
                                              {canCreateRole('division_manager', { state: state.name, district: district.name, division: division.name }) && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    openAddManager({
                                                      role: 'division_manager',
                                                      assignedState: state.name,
                                                      assignedStateId: state.id || state._id,
                                                      assignedDistrict: district.name,
                                                      assignedDistrictId: district.id || district._id,
                                                      assignedDivision: division.name,
                                                      assignedDivisionId: division.id || division._id
                                                    });
                                                  }}
                                                  className="px-2 py-0.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold transition shadow-sm cursor-pointer flex items-center gap-1"
                                                >
                                                  <Plus className="w-3 h-3" />
                                                  <span>Nominate</span>
                                                </button>
                                              )}
                                              <button type="button" className="p-0.5 text-slate-400">
                                                {isDivExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                              </button>
                                            </div>
                                          </div>

                                          {/* Expanded Division Content */}
                                          {isDivExpanded && (
                                            <div className="p-3 pt-0 space-y-2.5 bg-slate-50/40 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800">
                                              {/* Divisional Managers */}
                                              <div className="pt-2">
                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                                                  Divisional Managers ({divMgrs.length})
                                                </div>
                                                {divMgrs.length > 0 ? (
                                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    {divMgrs.map((mgr) => (
                                                      <div
                                                        key={mgr.id || mgr._id}
                                                        className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                                                          isDark ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800' : 'bg-white border-slate-200 hover:shadow-sm'
                                                        }`}
                                                      >
                                                        <div className="flex items-center gap-3">
                                                          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-center font-bold text-xs shrink-0">
                                                            {mgr.name ? mgr.name.charAt(0).toUpperCase() : <UserCog className="w-4 h-4" />}
                                                          </div>
                                                          <div>
                                                            <div className="flex items-center gap-2">
                                                              <span className="font-bold text-xs text-slate-900 dark:text-white">{mgr.name}</span>
                                                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                                Divisional Manager
                                                              </span>
                                                              <StatusBadge status={mgr.status || 'Active'} />
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                              <span className="font-mono">{mgr.email}</span>
                                                              <span>·</span>
                                                              <span className="font-mono flex items-center gap-1">
                                                                <Phone className="w-3 h-3 text-slate-400" /> {mgr.mobile || mgr.phone}
                                                              </span>
                                                            </div>
                                                          </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                          <button
                                                            type="button"
                                                            onClick={() => handleOpenModal(mgr)}
                                                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                                                          >
                                                            <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                                            <span>View Details</span>
                                                          </button>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                ) : (
                                                  <div className="p-2 rounded bg-white dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-[11px] text-slate-400 flex items-center justify-between">
                                                    <span>No Divisional Manager assigned yet.</span>
                                                    {canCreateRole('division_manager', { state: state.name, district: district.name, division: division.name }) && (
                                                      <button
                                                        type="button"
                                                        onClick={() => openAddManager({
                                                          role: 'division_manager',
                                                          assignedState: state.name,
                                                          assignedStateId: state.id || state._id,
                                                          assignedDistrict: district.name,
                                                          assignedDistrictId: district.id || district._id,
                                                          assignedDivision: division.name,
                                                          assignedDivisionId: division.id || division._id
                                                        })}
                                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                                                      >
                                                        + Add Division Manager
                                                      </button>
                                                    )}
                                                  </div>
                                                )}
                                              </div>

                                              {/* Pincodes Under Division */}
                                              <div className="space-y-1.5 pt-1">
                                                {(() => {
                                                  const rawPinList = division.rawPincodes || (division.pincodes || []).map(p => ({ id: p, code: p, name: p }));
                                                  const assignedPins = rawPinList.filter(pin => getPincodeManagers(pin, division, district, state).length > 0);

                                                  if (assignedPins.length === 0) {
                                                    return (
                                                      <div className="p-2.5 text-center text-[11px] text-slate-400 italic bg-white dark:bg-slate-850 rounded-md border border-dashed border-slate-200 dark:border-slate-800">
                                                        No assigned records found.
                                                      </div>
                                                    );
                                                  }

                                                  return assignedPins.map((pin) => {
                                                  const pinCode = String(pin.code || pin.pincode || pin);
                                                  const pinKey = String(pin.id || pin._id || pinCode);
                                                  const isPinExpanded = !!expandedPincodes[pinKey];
                                                  const pinMgrs = getPincodeManagers(pin, division, district, state);

                                                  return (
                                                    <div
                                                      key={pinKey}
                                                      className="rounded-md bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 overflow-hidden"
                                                    >
                                                      {/* Pincode Header */}
                                                      <div
                                                        onClick={() => togglePincode(pinKey)}
                                                        className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition select-none"
                                                      >
                                                        <div className="flex items-center gap-2">
                                                          <div className="w-6 h-6 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                                            <MapPin className="w-3 h-3" />
                                                          </div>
                                                          <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 font-mono">
                                                              {pinCode}
                                                            </span>
                                                            {pin.name && pin.name !== pinCode && (
                                                              <span className="text-[10px] text-slate-500">
                                                                ({pin.name})
                                                              </span>
                                                            )}
                                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                              PINCODE
                                                            </span>
                                                          </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                          <span className="text-[11px] font-semibold text-slate-500">
                                                            Managers: {pinMgrs.length} / 2
                                                          </span>
                                                          {canCreateRole('pincode_manager', { state: state.name, district: district.name, division: division.name, pincode: pinCode }) && (
                                                            <button
                                                              type="button"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                openAddManager({
                                                                  role: 'pincode_manager',
                                                                  assignedState: state.name,
                                                                  assignedStateId: state.id || state._id,
                                                                  assignedDistrict: district.name,
                                                                  assignedDistrictId: district.id || district._id,
                                                                  assignedDivision: division.name,
                                                                  assignedDivisionId: division.id || division._id,
                                                                  assignedPincode: pinCode,
                                                                  assignedPincodeId: pin.id || pin._id
                                                                });
                                                              }}
                                                              className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold transition shadow-sm cursor-pointer flex items-center gap-0.5"
                                                            >
                                                              <Plus className="w-2.5 h-2.5" />
                                                              <span>Nominate</span>
                                                            </button>
                                                          )}
                                                          <button type="button" className="p-0.5 text-slate-400">
                                                            {isPinExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                          </button>
                                                        </div>
                                                      </div>

                                                      {/* Expanded Pincode Content */}
                                                      {isPinExpanded && (
                                                        <div className="p-2.5 pt-0 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/60 border-t border-slate-100 dark:border-slate-800">
                                                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 pt-1.5">
                                                            Pincode Managers ({pinMgrs.length})
                                                          </div>
                                                          {pinMgrs.length > 0 ? (
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                              {pinMgrs.map((mgr) => (
                                                                <div
                                                                  key={mgr.id || mgr._id}
                                                                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                                                                    isDark ? 'bg-slate-800/60 border-slate-700/80 hover:bg-slate-800' : 'bg-white border-slate-200 hover:shadow-sm'
                                                                  }`}
                                                                >
                                                                  <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 flex items-center justify-center font-bold text-xs shrink-0">
                                                                      {mgr.name ? mgr.name.charAt(0).toUpperCase() : <UserCog className="w-4 h-4" />}
                                                                    </div>
                                                                    <div>
                                                                      <div className="flex items-center gap-2">
                                                                        <span className="font-bold text-xs text-slate-900 dark:text-white">{mgr.name}</span>
                                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300">
                                                                          Pincode Manager
                                                                        </span>
                                                                        <StatusBadge status={mgr.status || 'Active'} />
                                                                      </div>
                                                                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                                        <span className="font-mono">{mgr.email}</span>
                                                                        <span>·</span>
                                                                        <span className="font-mono flex items-center gap-1">
                                                                          <Phone className="w-3 h-3 text-slate-400" /> {mgr.mobile || mgr.phone}
                                                                        </span>
                                                                      </div>
                                                                    </div>
                                                                  </div>

                                                                  <div className="flex items-center gap-2 shrink-0">
                                                                    <button
                                                                      type="button"
                                                                      onClick={() => handleOpenModal(mgr)}
                                                                      className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                                                                    >
                                                                      <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                                                                      <span>View Details</span>
                                                                    </button>
                                                                  </div>
                                                                </div>
                                                              ))}
                                                            </div>
                                                          ) : (
                                                            <div className="p-2 rounded bg-white dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-[11px] text-slate-400 flex items-center justify-between">
                                                              <span>No Pincode Manager assigned yet.</span>
                                                              {canCreateRole('pincode_manager', { state: state.name, district: district.name, division: division.name, pincode: pinCode }) && (
                                                                <button
                                                                  type="button"
                                                                  onClick={() => openAddManager({
                                                                    role: 'pincode_manager',
                                                                    assignedState: state.name,
                                                                    assignedStateId: state.id || state._id,
                                                                    assignedDistrict: district.name,
                                                                    assignedDistrictId: district.id || district._id,
                                                                    assignedDivision: division.name,
                                                                    assignedDivisionId: division.id || division._id,
                                                                    assignedPincode: pinCode,
                                                                    assignedPincodeId: pin.id || pin._id
                                                                  })}
                                                                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                                                                >
                                                                  + Add Pincode Manager
                                                                </button>
                                                              )}
                                                            </div>
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                });
                                              })()}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    });
                                  })()}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW MODE 2: LIST VIEW (DATA TABLE) */}
      {viewTab === 'list' && (
        <div className="space-y-4">
          {/* Dynamic Territory Hierarchy Filter Toolbar (State -> District -> Division -> Pincode) */}
          <TerritoryHierarchyFilter
            selectedState={selectedFilterState}
            onStateChange={(st) => setSelectedFilterState(st)}
            selectedDistrict={selectedFilterDistrict}
            onDistrictChange={(dt) => setSelectedFilterDistrict(dt)}
            selectedDivision={selectedFilterDivision}
            onDivisionChange={(dv) => setSelectedFilterDivision(dv)}
            selectedPincode={selectedFilterPincode}
            onPincodeChange={(pin) => setSelectedFilterPincode(pin)}
            onClear={() => {
              if (!locking.stateLocked) setSelectedFilterState('');
              if (!locking.districtLocked) setSelectedFilterDistrict('');
              if (!locking.divisionLocked) setSelectedFilterDivision('');
              if (!locking.pincodeLocked) setSelectedFilterPincode('');
            }}
            territoryTree={territoryTree}
          />

          <DataTable
            title={config.tableTitle}
            subtitle={config.tableSubtitle}
            columns={columns}
            data={filteredManagers}
            onRowClick={(row) => handleOpenModal(row)}
            loading={loading}
            onRefresh={loadData}
            filterOptions={[
              { label: `All Managers (${totalCount})`, value: 'all' },
              { label: `Pending Approvals (${pendingCount})`, value: 'pending' },
              { label: `Active Managers (${activeCount})`, value: 'active' }
            ]}
            activeFilter={statusFilter}
            onFilterChange={setStatusFilter}
            searchPlaceholder={`Search ${config.title.toLowerCase()} by name, jurisdiction, or phone...`}
            exportFileName={config.exportFile}
            emptyMessage="No managers found matching this territory selection."
            actions={
              canAddManager ? (
                <button
                  type="button"
                  onClick={() => openAddManager()}
                  id="add-manager-table-btn"
                  className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer shrink-0"
                  title={`Add ${designatedRoleLabel}`}
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-nowrap">Add Manager</span>
                </button>
              ) : null
            }
          />
        </div>
      )}

      {/* VIEW MODE 3: REQUESTS VIEW */}
      {viewTab === 'requests' && (
        <DataTable
          title="Manager Approval & Registration Requests"
          subtitle="Awaiting regional administration verification, authorization, and KYC activation."
          columns={columns}
          data={allManagers.filter(m => m.status === 'under_review' || m.status === 'pending' || m.status === 'pending_admin_approval')}
          onRowClick={(row) => handleOpenModal(row)}
          loading={loading}
          onRefresh={loadData}
          searchPlaceholder="Search pending manager registrations by name or territory..."
          exportFileName="pending_manager_requests.csv"
          actions={
            adminAllowedCreationRole ? (
              <button
                type="button"
                onClick={() => openAddManager({ role: adminAllowedCreationRole === 'all' ? 'state_manager' : adminAllowedCreationRole })}
                className="h-9 inline-flex items-center gap-1.5 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">New Manager Request</span>
              </button>
            ) : null
          }
        />
      )}

      {/* Manager Registration & KYC Review Modal */}
      <ManagerApprovalModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        manager={selectedManager}
        onManagerUpdated={handleManagerUpdated}
      />

      {/* Add Manager Wizard Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={closeAddManager}
        title={`Add ${designatedRoleLabel} / Operations Lead`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5">
          {/* Step Indicator */}
          <div className="flex items-center justify-between border-b pb-3 dark:border-slate-700 overflow-x-auto scrollbar-none gap-1">
            {STEPS.map((step) => {
              const StepIcon = step.icon;
              const isDone = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              return (
                <div key={step.id} className="flex flex-col items-center flex-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isCurrent
                      ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                      : isDark
                      ? 'bg-slate-800 text-slate-400'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                  </div>
                  <span className={`text-[10px] mt-1 font-medium hidden sm:block ${
                    isCurrent ? 'text-blue-600 dark:text-cyan-400 font-bold' : isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step Title */}
          <div className={`pb-2 border-b ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
              Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1]?.label} Information
            </h3>
            <p className="text-xs text-slate-500">
              {currentStep === 1 && 'Enter manager personal, contact, and identity details.'}
              {currentStep === 2 && 'Assign operational tier, designated administrative jurisdiction, and service zone.'}
              {currentStep === 3 && 'Residential permanent/correspondence address details.'}
              {currentStep === 4 && 'Identity & Official Documents verification (Aadhaar, PAN, Bank Passbook, Cheque & Signature). All mandatory.'}
              {currentStep === 5 && 'Bank account details for commissions, allowances, and settlements.'}
              {currentStep === 6 && 'Create manager portal login credentials and finalize status.'}
            </p>
          </div>

          {/* Error / Success Feedback */}
          {addError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}
          {addSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{addSuccess}</span>
            </div>
          )}

          {/* Step Content */}
          <div className="min-h-[260px]">
            {renderStepContent()}
          </div>

          {/* Wizard Footer Navigation */}
          <div className="flex items-center justify-between pt-4 border-t dark:border-slate-700">
            <button
              type="button"
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
              disabled={currentStep === 1 || addLoading}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                currentStep === 1
                  ? 'opacity-40 cursor-not-allowed text-slate-400'
                  : isDark
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeAddManager}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition cursor-pointer"
              >
                Cancel
              </button>

              {currentStep < STEPS.length ? (
                <button
                  type="button"
                  onClick={() => {
                    const err = validateStep(currentStep);
                    if (!err) {
                      setAddError('');
                      setCurrentStep((s) => Math.min(STEPS.length, s + 1));
                    } else {
                      setAddError(err);
                    }
                  }}
                  className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAddSubmit}
                  disabled={addLoading}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {addLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Register Manager</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
