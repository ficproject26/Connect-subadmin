import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

  const isManagerOrAgent = user?.role && (
    user.role.toLowerCase().includes('manager') ||
    user.role.toLowerCase().includes('agent')
  );
  const statusUpper = String(user?.status || '').toUpperCase();
  const adminApprovalStatus = String(user?.adminApprovalStatus || '').toLowerCase();
  const kycStatus = String(user?.kycStatus || '').toLowerCase();

  const isFullyApproved = (statusUpper === 'ACTIVE' || statusUpper === 'APPROVED') &&
    adminApprovalStatus === 'approved' &&
    (kycStatus === 'verified' || kycStatus === 'approved') &&
    user?.isActive !== false &&
    !user?.requiresApproval;

  // Strictly block direct URL navigation to any dashboard for unapproved applicants
  if ((isManagerOrAgent && !isFullyApproved) || user?.requiresApproval || (statusUpper !== 'ACTIVE' && statusUpper !== 'APPROVED')) {
    return <Navigate to="/registration-status" replace />;
  }

  return <Outlet />;
}
