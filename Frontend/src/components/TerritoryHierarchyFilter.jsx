import React, { useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Filter, Lock, X } from 'lucide-react';
import { normalizeRole, ROLES } from '../utils/permissions';
import { getTerritoryLocking, safeString, safeLowerCase } from '../utils/territoryHelper';

/**
 * Universal Territory Hierarchy Filter Toolbar
 * Enforces role-based locking (State -> District -> Division -> Pincode)
 * Cascading dropdowns with automatic resets on parent changes.
 */
export function TerritoryHierarchyFilter({
  selectedState = '',
  onStateChange,
  selectedDistrict = '',
  onDistrictChange,
  selectedDivision = '',
  onDivisionChange,
  selectedPincode = '',
  onPincodeChange,
  onClear,
  territoryTree = [],
  title = 'Territory Hierarchy Filter',
  className = '',
  managerLevel, // 'state' | 'district' | 'divisional' | 'pincode'
  showState,
  showDistrict,
  showDivision,
  showPincode
}) {
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Role locking rules derived from authenticated user
  const locking = useMemo(() => getTerritoryLocking(user), [user]);
  const normalizedRole = useMemo(() => normalizeRole(user?.role, user), [user]);
  const userTier = locking.tier;

  // Determine role-specific & manager-page-specific control visibility
  let isStateVisible = showState !== undefined ? showState : true;
  let isDistrictVisible = showDistrict !== undefined ? showDistrict : true;
  let isDivisionVisible = showDivision !== undefined ? showDivision : true;
  let isPincodeVisible = showPincode !== undefined ? showPincode : true;

  if (managerLevel) {
    const lvl = String(managerLevel).toLowerCase().trim();
    if (userTier === 'pincode' || normalizedRole === ROLES.PINCODE_ADMIN || normalizedRole === 'pincode-admin') {
      // E. Pincode Admin: Do not display the Territory Hierarchy Filter
      isStateVisible = false;
      isDistrictVisible = false;
      isDivisionVisible = false;
      isPincodeVisible = false;
    } else if (userTier === 'division' || normalizedRole === ROLES.DIVISIONAL_ADMIN || normalizedRole === 'division-admin' || normalizedRole === 'divisional-admin') {
      // D. Division Admin:
      isStateVisible = false;
      isDistrictVisible = false;
      if (lvl === 'pincode') {
        isDivisionVisible = true; // locked
        isPincodeVisible = true;
      } else {
        isDivisionVisible = false;
        isPincodeVisible = false;
      }
    } else if (userTier === 'district' || normalizedRole === ROLES.DISTRICT_ADMIN || normalizedRole === 'district-admin') {
      // C. District Admin:
      isStateVisible = false;
      if (lvl === 'district') {
        isDistrictVisible = false;
        isDivisionVisible = false;
        isPincodeVisible = false;
      } else if (lvl === 'divisional' || lvl === 'division') {
        isDistrictVisible = true; // locked
        isDivisionVisible = true;
        isPincodeVisible = false;
      } else if (lvl === 'pincode') {
        isDistrictVisible = true; // locked
        isDivisionVisible = true;
        isPincodeVisible = true;
      } else {
        isDistrictVisible = false;
        isDivisionVisible = false;
        isPincodeVisible = false;
      }
    } else if (userTier === 'state' || normalizedRole === ROLES.STATE_ADMIN || normalizedRole === 'state-admin') {
      // B. State Admin:
      if (lvl === 'state') {
        isStateVisible = false;
        isDistrictVisible = false;
        isDivisionVisible = false;
        isPincodeVisible = false;
      } else if (lvl === 'district') {
        isStateVisible = true; // locked
        isDistrictVisible = true;
        isDivisionVisible = false;
        isPincodeVisible = false;
      } else if (lvl === 'divisional' || lvl === 'division') {
        isStateVisible = true; // locked
        isDistrictVisible = true;
        isDivisionVisible = true;
        isPincodeVisible = false;
      } else if (lvl === 'pincode') {
        isStateVisible = true; // locked
        isDistrictVisible = true;
        isDivisionVisible = true;
        isPincodeVisible = true;
      }
    } else {
      // A. Super Admin:
      if (lvl === 'state') {
        isStateVisible = false;
        isDistrictVisible = false;
        isDivisionVisible = false;
        isPincodeVisible = false;
      } else if (lvl === 'district') {
        isStateVisible = true;
        isDistrictVisible = true;
        isDivisionVisible = false;
        isPincodeVisible = false;
      } else if (lvl === 'divisional' || lvl === 'division') {
        isStateVisible = true;
        isDistrictVisible = true;
        isDivisionVisible = true;
        isPincodeVisible = false;
      } else if (lvl === 'pincode') {
        isStateVisible = true;
        isDistrictVisible = true;
        isDivisionVisible = true;
        isPincodeVisible = true;
      }
    }
  }

  const visibleCount = [isStateVisible, isDistrictVisible, isDivisionVisible, isPincodeVisible].filter(Boolean).length;
  if (visibleCount === 0) return null;

  const gridColsClass = 
    visibleCount === 1 ? 'grid-cols-1 max-w-sm' :
    visibleCount === 2 ? 'grid-cols-1 sm:grid-cols-2' :
    visibleCount === 3 ? 'grid-cols-1 sm:grid-cols-3' :
    'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  // Synchronize locked parent territories automatically
  useEffect(() => {
    if (locking.stateLocked && locking.defaultState && safeLowerCase(selectedState) !== safeLowerCase(locking.defaultState)) {
      if (onStateChange) onStateChange(locking.defaultState);
    }
  }, [locking.stateLocked, locking.defaultState, selectedState, onStateChange]);

  useEffect(() => {
    if (locking.districtLocked && locking.defaultDistrict && safeLowerCase(selectedDistrict) !== safeLowerCase(locking.defaultDistrict)) {
      if (onDistrictChange) onDistrictChange(locking.defaultDistrict);
    }
  }, [locking.districtLocked, locking.defaultDistrict, selectedDistrict, onDistrictChange]);

  useEffect(() => {
    if (locking.divisionLocked && locking.defaultDivision && safeLowerCase(selectedDivision) !== safeLowerCase(locking.defaultDivision)) {
      if (onDivisionChange) onDivisionChange(locking.defaultDivision);
    }
  }, [locking.divisionLocked, locking.defaultDivision, selectedDivision, onDivisionChange]);

  useEffect(() => {
    if (locking.pincodeLocked && locking.defaultPincode && safeLowerCase(selectedPincode) !== safeLowerCase(locking.defaultPincode)) {
      if (onPincodeChange) onPincodeChange(locking.defaultPincode);
    }
  }, [locking.pincodeLocked, locking.defaultPincode, selectedPincode, onPincodeChange]);

  // Effective territory values
  const effectiveState = locking.stateLocked ? locking.defaultState : (selectedState || '');
  const effectiveDistrict = locking.districtLocked ? locking.defaultDistrict : (selectedDistrict || '');
  const effectiveDivision = locking.divisionLocked ? locking.defaultDivision : (selectedDivision || '');
  const effectivePincode = locking.pincodeLocked ? locking.defaultPincode : (selectedPincode || '');

  // 1. Available States
  const availableStates = useMemo(() => {
    if (!Array.isArray(territoryTree) || territoryTree.length === 0) return [];
    return territoryTree.map(s => ({
      id: String(s.id || s._id || s.stateId || s.name),
      name: safeString(s.name)
    })).filter(s => Boolean(s.name));
  }, [territoryTree]);

  // 2. Available Districts for effective state
  const availableDistricts = useMemo(() => {
    if (!effectiveState || !Array.isArray(territoryTree)) return [];
    const matchedState = territoryTree.find(s => safeLowerCase(s.name) === safeLowerCase(effectiveState));
    if (!matchedState || !Array.isArray(matchedState.districts)) return [];
    return matchedState.districts.map(d => ({
      id: String(d.id || d._id || d.districtId || d.name),
      name: safeString(d.name)
    })).filter(d => Boolean(d.name));
  }, [territoryTree, effectiveState]);

  // 3. Available Divisions for effective district
  const availableDivisions = useMemo(() => {
    if (!effectiveDistrict || !Array.isArray(availableDistricts)) return [];
    const matchedDistObj = territoryTree
      .flatMap(s => s.districts || [])
      .find(d => safeLowerCase(d.name) === safeLowerCase(effectiveDistrict));
    if (!matchedDistObj || !Array.isArray(matchedDistObj.divisions)) return [];
    return matchedDistObj.divisions.map(v => ({
      id: String(v.id || v._id || v.divisionId || v.name),
      name: safeString(v.name)
    })).filter(v => Boolean(v.name));
  }, [territoryTree, availableDistricts, effectiveDistrict]);

  // 4. Available Pincodes for effective division
  const availablePincodes = useMemo(() => {
    if (!effectiveDivision || !Array.isArray(availableDivisions)) return [];
    const matchedDivObj = territoryTree
      .flatMap(s => (s.districts || []).flatMap(d => d.divisions || []))
      .find(v => safeLowerCase(v.name) === safeLowerCase(effectiveDivision));
    if (!matchedDivObj) return [];

    if (Array.isArray(matchedDivObj.rawPincodes) && matchedDivObj.rawPincodes.length > 0) {
      return matchedDivObj.rawPincodes.map(p => ({
        id: String(p.id || p._id || p.code),
        code: safeString(p.code || p.pincode),
        name: safeString(p.name || p.area || p.code || p.pincode)
      })).filter(p => Boolean(p.code));
    }

    if (Array.isArray(matchedDivObj.pincodes)) {
      return matchedDivObj.pincodes.map(p => ({
        id: safeString(p),
        code: safeString(p),
        name: safeString(p)
      })).filter(p => Boolean(p.code));
    }
    return [];
  }, [territoryTree, availableDivisions, effectiveDivision]);

  // Check if any UNLOCKED field is active to show Clear button
  const hasActiveFilters = useMemo(() => {
    if (!locking.stateLocked && selectedState) return true;
    if (!locking.districtLocked && selectedDistrict) return true;
    if (!locking.divisionLocked && selectedDivision) return true;
    if (!locking.pincodeLocked && selectedPincode) return true;
    return false;
  }, [locking, selectedState, selectedDistrict, selectedDivision, selectedPincode]);

  const handleClear = () => {
    if (!locking.stateLocked && onStateChange) onStateChange('');
    if (!locking.districtLocked && onDistrictChange) onDistrictChange('');
    if (!locking.divisionLocked && onDivisionChange) onDivisionChange('');
    if (!locking.pincodeLocked && onPincodeChange) onPincodeChange('');
    if (onClear) onClear();
  };

  return (
    <div className={`p-4 rounded-2xl border ${
      isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
    } shadow-sm space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {title}
          </span>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Filters</span>
          </button>
        )}
      </div>

      <div className={`grid ${gridColsClass} gap-3`}>
        {/* 1. STATE */}
        {isStateVisible && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              State
            </label>
            {locking.stateLocked ? (
              <div className={`w-full text-xs px-3 py-2 rounded-xl border font-semibold flex items-center justify-between cursor-not-allowed ${
                isDark ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}>
                <span className="truncate">{effectiveState || 'Tamil Nadu'}</span>
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
              </div>
            ) : (
              <select
                value={selectedState}
                onChange={(e) => {
                  const val = e.target.value;
                  if (onStateChange) onStateChange(val);
                  if (onDistrictChange) onDistrictChange('');
                  if (onDivisionChange) onDivisionChange('');
                  if (onPincodeChange) onPincodeChange('');
                }}
                className={`w-full text-xs px-3 py-2 rounded-xl border font-medium transition cursor-pointer ${
                  isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-700'
                }`}
              >
                <option value="">All States ({availableStates.length})</option>
                {availableStates.map(s => (
                  <option key={s.id || s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* 2. DISTRICT */}
        {isDistrictVisible && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              District
            </label>
            {locking.districtLocked ? (
              <div className={`w-full text-xs px-3 py-2 rounded-xl border font-semibold flex items-center justify-between cursor-not-allowed ${
                isDark ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}>
                <span className="truncate">{effectiveDistrict || 'Assigned District'}</span>
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
              </div>
            ) : (
              <select
                value={selectedDistrict}
                disabled={!effectiveState && availableDistricts.length === 0}
                onChange={(e) => {
                  const val = e.target.value;
                  if (onDistrictChange) onDistrictChange(val);
                  if (onDivisionChange) onDivisionChange('');
                  if (onPincodeChange) onPincodeChange('');
                }}
                className={`w-full text-xs px-3 py-2 rounded-xl border font-medium transition cursor-pointer ${
                  !effectiveState && availableDistricts.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                } ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-700'}`}
              >
                <option value="">
                  {effectiveState ? `All Districts (${availableDistricts.length})` : 'Select State First'}
                </option>
                {availableDistricts.map(d => (
                  <option key={d.id || d.name} value={d.name}>{d.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* 3. DIVISION */}
        {isDivisionVisible && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Division
            </label>
            {locking.divisionLocked ? (
              <div className={`w-full text-xs px-3 py-2 rounded-xl border font-semibold flex items-center justify-between cursor-not-allowed ${
                isDark ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}>
                <span className="truncate">{effectiveDivision || 'Assigned Division'}</span>
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
              </div>
            ) : (
              <select
                value={selectedDivision}
                disabled={!effectiveDistrict}
                onChange={(e) => {
                  const val = e.target.value;
                  if (onDivisionChange) onDivisionChange(val);
                  if (onPincodeChange) onPincodeChange('');
                }}
                className={`w-full text-xs px-3 py-2 rounded-xl border font-medium transition cursor-pointer ${
                  !effectiveDistrict ? 'opacity-50 cursor-not-allowed' : ''
                } ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-700'}`}
              >
                <option value="">
                  {effectiveDistrict ? `All Divisions (${availableDivisions.length})` : 'Select District First'}
                </option>
                {availableDivisions.map(v => (
                  <option key={v.id || v.name} value={v.name}>{v.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* 4. PINCODE */}
        {isPincodeVisible && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Pincode
            </label>
            {locking.pincodeLocked ? (
              <div className={`w-full text-xs px-3 py-2 rounded-xl border font-semibold flex items-center justify-between cursor-not-allowed ${
                isDark ? 'bg-slate-800/80 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-300 text-slate-700'
              }`}>
                <span className="truncate">{effectivePincode || 'Assigned Pincode'}</span>
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1.5" />
              </div>
            ) : (
              <select
                value={selectedPincode}
                disabled={!effectiveDivision}
                onChange={(e) => {
                  const val = e.target.value;
                  if (onPincodeChange) onPincodeChange(val);
                }}
                className={`w-full text-xs px-3 py-2 rounded-xl border font-medium transition cursor-pointer ${
                  !effectiveDivision ? 'opacity-50 cursor-not-allowed' : ''
                } ${isDark ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-700'}`}
              >
                <option value="">
                  {effectiveDivision ? `All Pincodes (${availablePincodes.length})` : 'Select Division First'}
                </option>
                {availablePincodes.map(p => (
                  <option key={p.id || p.code} value={p.code}>
                    {p.code}{p.name && p.name !== p.code ? ` (${p.name})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
