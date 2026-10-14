import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { normalizeRole, isRoleAllowed } from '../utils/permissions';

export function ProtectedRoute() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-indigo-400 font-mono text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></div>
          <span>Verifying security clearance...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // 1. Role Authorization Check: Sub-Admin portal is strictly for Sub-Admins
  const authorizedRoles = ['State Admin', 'District Admin', 'Divisional Admin', 'Division Admin', 'Pincode Admin', 'Super Admin'];
  const hasAuthorizedRole = isRoleAllowed(user.role, authorizedRoles);
  if (!hasAuthorizedRole) {
    return <Navigate to="/access-denied" replace />;
  }

  // 2. Status & Approval Gate Check
  const statusUpper = String(user.status || '').toUpperCase();
  const isSuspendedOrBlocked = ['SUSPENDED', 'BLOCKED', 'REVOKED', 'INACTIVE', 'REJECTED'].includes(statusUpper);
  if (isSuspendedOrBlocked) {
    return <Navigate to="/access-denied" replace />;
  }

  const isApproved = (statusUpper === 'ACTIVE' || statusUpper === 'APPROVED') &&
    String(user.adminApprovalStatus || 'approved').toLowerCase() === 'approved' &&
    user.isActive !== false &&
    !user.requiresApproval;

  if (!isApproved) {
    return <Navigate to="/registration-status" replace />;
  }

  return <Outlet />;
}
