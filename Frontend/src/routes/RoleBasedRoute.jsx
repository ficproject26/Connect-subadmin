import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleDashboardPath, isRoleAllowed } from '../utils/permissions';

export function RoleBasedRoute({ allowedRoles = [] }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user) return <Navigate to="/login" replace />;

  if (allowedRoles.length > 0 && !isRoleAllowed(user.role, allowedRoles)) {
    // Strictly prevent cross-role dashboard/module access and redirect to access-denied
    return <Navigate to="/access-denied" replace />;
  }

  return <Outlet />;
}
