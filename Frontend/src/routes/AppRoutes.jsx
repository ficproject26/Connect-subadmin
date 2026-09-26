import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getRoleDashboardPath } from '../utils/permissions';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleBasedRoute } from './RoleBasedRoute';
import { DashboardLayout } from '../layouts/DashboardLayout';

// Auth Pages
import { Login } from '../pages/auth/Login';

// State Admin Pages
import { StateAdminDashboard } from '../pages/state-admin/Dashboard';
import { StatesOverview } from '../pages/state-admin/StatesOverview';
import { StateDistricts } from '../pages/state-admin/Districts';
import { StateDivisions } from '../pages/state-admin/Divisions';
import { StatePincodes } from '../pages/state-admin/Pincodes';
import { StateCustomers } from '../pages/state-admin/Customers';
import { StateMembershipCards } from '../pages/state-admin/MembershipCards';
import { StateVendors } from '../pages/state-admin/Vendors';
import { StateVendorSubscriptions } from '../pages/state-admin/VendorSubscriptions';
import { StateVendorPayments } from '../pages/state-admin/VendorPayments';
import { StateOrders } from '../pages/state-admin/Orders';
import { StateBookings } from '../pages/state-admin/Bookings';
import { StateJobs } from '../pages/state-admin/Jobs';
import { StateDeliveryPartners } from '../pages/state-admin/DeliveryPartners';
import { StateTechnicians } from '../pages/state-admin/Technicians';
import { StateExecutives } from '../pages/state-admin/Executives';
import { StateAgents } from '../pages/state-admin/Agents';
import { StateManagers } from '../pages/state-admin/Managers';
import { StateAgentPayments } from '../pages/state-admin/AgentPayments';
import { StatePayments } from '../pages/state-admin/Payments';
import { StateReports } from '../pages/state-admin/Reports';
import { StateKYC } from '../pages/state-admin/KYC';
import { StateQualityCheck } from '../pages/state-admin/QualityCheck';
import { StateSupportTeam } from '../pages/state-admin/SupportTeam';
import { StateProfile } from '../pages/state-admin/Profile';
import { StateSettings } from '../pages/state-admin/Settings';
import { StateTasks } from '../pages/state-admin/Tasks';
import { StateQueries } from '../pages/state-admin/Queries';

// District Admin Pages
import { DistrictAdminDashboard } from '../pages/district-admin/Dashboard';
import { DistrictOverview } from '../pages/district-admin/Overview';
import { DistrictDivisions } from '../pages/district-admin/Divisions';
import { DistrictPincodes } from '../pages/district-admin/Pincodes';
import { DistrictCustomers } from '../pages/district-admin/Customers';
import { DistrictMembershipCards } from '../pages/district-admin/MembershipCards';
import { DistrictVendors } from '../pages/district-admin/Vendors';
import { DistrictVendorSubscriptions } from '../pages/district-admin/VendorSubscriptions';
import { DistrictVendorPayments } from '../pages/district-admin/VendorPayments';
import { DistrictOrders } from '../pages/district-admin/Orders';
import { DistrictBookings } from '../pages/district-admin/Bookings';
import { DistrictJobs } from '../pages/district-admin/Jobs';
import { DistrictDeliveryPartners } from '../pages/district-admin/DeliveryPartners';
import { DistrictTechnicians } from '../pages/district-admin/Technicians';
import { DistrictExecutives } from '../pages/district-admin/Executives';
import { DistrictSupportTeam } from '../pages/district-admin/SupportTeam';
import { DistrictAgents } from '../pages/district-admin/Agents';
import { DistrictAgentPayments } from '../pages/district-admin/AgentPayments';
import { DistrictKYC } from '../pages/district-admin/KYC';
import { DistrictQualityCheck } from '../pages/district-admin/QualityCheck';
import { DistrictReports } from '../pages/district-admin/Reports';
import { DistrictPayments } from '../pages/district-admin/Payments';
import { DistrictTasks } from '../pages/district-admin/Tasks';
import { DistrictQueries } from '../pages/district-admin/Queries';
import { DistrictProfile } from '../pages/district-admin/Profile';
import { DistrictSettings } from '../pages/district-admin/Settings';

// Divisional Admin Pages
import { DivisionalAdminDashboard } from '../pages/divisional-admin/Dashboard';
import { DivisionalOverview } from '../pages/divisional-admin/Overview';
import { DivisionalPincodes } from '../pages/divisional-admin/Pincodes';
import { DivisionalCustomers } from '../pages/divisional-admin/Customers';
import { DivisionalMembershipCards } from '../pages/divisional-admin/MembershipCards';
import { DivisionalVendors } from '../pages/divisional-admin/Vendors';
import { DivisionalVendorSubscriptions } from '../pages/divisional-admin/VendorSubscriptions';
import { DivisionalVendorPayments } from '../pages/divisional-admin/VendorPayments';
import { DivisionalOrders } from '../pages/divisional-admin/Orders';
import { DivisionalBookings } from '../pages/divisional-admin/Bookings';
import { DivisionalJobs } from '../pages/divisional-admin/Jobs';
import { DivisionalDeliveryPartners } from '../pages/divisional-admin/DeliveryPartners';
import { DivisionalTechnicians } from '../pages/divisional-admin/Technicians';
import { DivisionalExecutives } from '../pages/divisional-admin/Executives';
import { DivisionalSupportTeam } from '../pages/divisional-admin/SupportTeam';
import { DivisionalAgents } from '../pages/divisional-admin/Agents';
import { DivisionalAgentPayments } from '../pages/divisional-admin/AgentPayments';
import { DivisionalKYC } from '../pages/divisional-admin/KYC';
import { DivisionalQualityCheck } from '../pages/divisional-admin/QualityCheck';
import { DivisionalReports } from '../pages/divisional-admin/Reports';
import { DivisionalPayments } from '../pages/divisional-admin/Payments';
import { DivisionalTasks } from '../pages/divisional-admin/Tasks';
import { DivisionalQueries } from '../pages/divisional-admin/Queries';
import { DivisionalProfile } from '../pages/divisional-admin/Profile';
import { DivisionalSettings } from '../pages/divisional-admin/Settings';

// Pincode Admin Pages
import { PincodeAdminDashboard } from '../pages/pincode-admin/Dashboard';
import { PincodeOverview } from '../pages/pincode-admin/Overview';
import { PincodeCustomers } from '../pages/pincode-admin/Customers';
import { PincodeMembershipCards } from '../pages/pincode-admin/MembershipCards';
import { PincodeVendors } from '../pages/pincode-admin/Vendors';
import { PincodeVendorSubscriptions } from '../pages/pincode-admin/VendorSubscriptions';
import { PincodeVendorDetails } from '../pages/pincode-admin/VendorDetails';
import { PincodeVendorPayments } from '../pages/pincode-admin/VendorPayments';
import { PincodeOrders } from '../pages/pincode-admin/Orders';
import { PincodeBookings } from '../pages/pincode-admin/Bookings';
import { PincodeJobs } from '../pages/pincode-admin/Jobs';
import { PincodeDeliveryPartners } from '../pages/pincode-admin/DeliveryPartners';
import { PincodeTechnicians } from '../pages/pincode-admin/Technicians';
import { PincodeExecutives } from '../pages/pincode-admin/Executives';
import { PincodeSupportTeam } from '../pages/pincode-admin/SupportTeam';
import { PincodeAgents } from '../pages/pincode-admin/Agents';
import { PincodeAgentPayments } from '../pages/pincode-admin/AgentPayments';
import { PincodeKYC } from '../pages/pincode-admin/KYC';
import { PincodeQualityCheck } from '../pages/pincode-admin/QualityCheck';
import { PincodeBusinessReports } from '../pages/pincode-admin/BusinessReports';
import { PincodePayments } from '../pages/pincode-admin/Payments';
import { PincodeTasks } from '../pages/pincode-admin/Tasks';
import { PincodeQueries } from '../pages/pincode-admin/Queries';
import { PincodeProfile } from '../pages/pincode-admin/Profile';
import { PincodeSettings } from '../pages/pincode-admin/Settings';

// Manager Pages
import { ManagerDashboard } from '../pages/manager/Dashboard';

// Common Notifications Page
import NotificationsPage from '../pages/common/Notifications';

function RootRedirect() {
  const { user, isAuthenticated, loading } = useAuth();
  // Wait for auth initialization to complete before deciding where to redirect.
  // Without this guard, the component renders during the token/profile fetch
  // and incorrectly sees isAuthenticated=false, causing a /login redirect loop.
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-indigo-400 font-mono text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  return <Navigate to={getRoleDashboardPath(user.role)} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      {/* /login: already-authenticated users are redirected to their dashboard inside Login.jsx */}
      <Route path="/login" element={<Login />} />

      {/* /dashboard: canonical route for Super Admin and Admin roles */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<Navigate to="/state-admin/dashboard" replace />} />
        </Route>
      </Route>

      {/* Protected Dashboards Layout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>

          {/* Super Admin routes redirect to State Admin dashboard */}
          <Route path="/super-admin/*" element={<Navigate to="/state-admin/dashboard" replace />} />

          {/* State Admin Routes */}
          <Route element={<RoleBasedRoute allowedRoles={['State Admin']} />}>
            <Route path="/state-admin/dashboard" element={<StateAdminDashboard />} />
            <Route path="/state-admin/states-overview" element={<StatesOverview />} />
            <Route path="/state-admin/districts" element={<StateDistricts />} />
            <Route path="/state-admin/district-admins" element={<Navigate to="/state-admin/districts" replace />} />
            <Route path="/state-admin/district-details" element={<Navigate to="/state-admin/districts" replace />} />
            <Route path="/state-admin/divisions" element={<StateDivisions />} />
            <Route path="/state-admin/division-admins" element={<Navigate to="/state-admin/divisions" replace />} />
            <Route path="/state-admin/division-details" element={<Navigate to="/state-admin/divisions" replace />} />
            <Route path="/state-admin/pincodes" element={<StatePincodes />} />
            <Route path="/state-admin/pincode-admins" element={<Navigate to="/state-admin/pincodes" replace />} />
            <Route path="/state-admin/pincode-details" element={<Navigate to="/state-admin/pincodes" replace />} />
            <Route path="/state-admin/customers" element={<StateCustomers />} />
            <Route path="/state-admin/membership-cards" element={<StateMembershipCards />} />
            <Route path="/state-admin/vendors" element={<StateVendors />} />
            <Route path="/state-admin/vendor-subscriptions" element={<StateVendorSubscriptions />} />
            <Route path="/state-admin/vendor-payments" element={<StateVendorPayments />} />
            <Route path="/state-admin/orders" element={<StateOrders />} />
            <Route path="/state-admin/bookings" element={<StateBookings />} />
            <Route path="/state-admin/jobs" element={<StateJobs />} />
            <Route path="/state-admin/delivery-partners" element={<StateDeliveryPartners />} />
            <Route path="/state-admin/technicians" element={<StateTechnicians />} />
            <Route path="/state-admin/executives" element={<StateExecutives />} />
            <Route path="/state-admin/support-team" element={<StateSupportTeam />} />
            <Route path="/state-admin/managers" element={<StateManagers level="state" />} />
            <Route path="/state-admin/managers/state" element={<StateManagers level="state" />} />
            <Route path="/state-admin/managers/district" element={<StateManagers level="district" />} />
            <Route path="/state-admin/managers/divisional" element={<StateManagers level="divisional" />} />
            <Route path="/state-admin/managers/pincode" element={<StateManagers level="pincode" />} />
            <Route path="/state-admin/agents" element={<StateAgents level="state" />} />
            <Route path="/state-admin/agents/state" element={<StateAgents level="state" />} />
            <Route path="/state-admin/agents/district" element={<StateAgents level="district" />} />
            <Route path="/state-admin/agents/divisional" element={<StateAgents level="divisional" />} />
            <Route path="/state-admin/agents/pincode" element={<StateAgents level="pincode" />} />
            <Route path="/state-admin/agent-payments" element={<StateAgentPayments />} />
            <Route path="/state-admin/kyc" element={<StateKYC />} />
            <Route path="/state-admin/quality-check" element={<StateQualityCheck />} />
            <Route path="/state-admin/payments" element={<StatePayments />} />
            <Route path="/state-admin/reports" element={<StateReports />} />
            <Route path="/state-admin/tasks" element={<StateTasks />} />
            <Route path="/state-admin/queries" element={<StateQueries />} />
            <Route path="/state-admin/notifications" element={<NotificationsPage />} />
            <Route path="/state-admin/profile" element={<StateProfile />} />
            <Route path="/state-admin/settings" element={<StateSettings />} />
          </Route>

          {/* District Admin Routes */}
          <Route element={<RoleBasedRoute allowedRoles={['District Admin']} />}>
            <Route path="/district-admin/dashboard" element={<DistrictAdminDashboard />} />
            <Route path="/district-admin/overview" element={<Navigate to="/district-admin/dashboard" replace />} />
            <Route path="/district-admin/divisions" element={<DistrictDivisions />} />
            <Route path="/district-admin/division-admins" element={<Navigate to="/district-admin/divisions" replace />} />
            <Route path="/district-admin/division-details" element={<Navigate to="/district-admin/divisions" replace />} />
            <Route path="/district-admin/pincodes" element={<DistrictPincodes />} />
            <Route path="/district-admin/pincode-admins" element={<Navigate to="/district-admin/pincodes" replace />} />
            <Route path="/district-admin/pincode-details" element={<Navigate to="/district-admin/pincodes" replace />} />
            <Route path="/district-admin/customers" element={<DistrictCustomers />} />
            <Route path="/district-admin/membership-cards" element={<DistrictMembershipCards />} />
            <Route path="/district-admin/vendors" element={<DistrictVendors />} />
            <Route path="/district-admin/vendor-subscriptions" element={<DistrictVendorSubscriptions />} />
            <Route path="/district-admin/vendor-payments" element={<DistrictVendorPayments />} />
            <Route path="/district-admin/orders" element={<DistrictOrders />} />
            <Route path="/district-admin/bookings" element={<DistrictBookings />} />
            <Route path="/district-admin/jobs" element={<DistrictJobs />} />
            <Route path="/district-admin/delivery-partners" element={<DistrictDeliveryPartners />} />
            <Route path="/district-admin/technicians" element={<DistrictTechnicians />} />
            <Route path="/district-admin/executives" element={<DistrictExecutives />} />
            <Route path="/district-admin/support-team" element={<DistrictSupportTeam />} />
            <Route path="/district-admin/managers" element={<StateManagers level="district" />} />
            <Route path="/district-admin/managers/district" element={<StateManagers level="district" />} />
            <Route path="/district-admin/managers/divisional" element={<StateManagers level="divisional" />} />
            <Route path="/district-admin/managers/pincode" element={<StateManagers level="pincode" />} />
            <Route path="/district-admin/agents" element={<DistrictAgents level="district" />} />
            <Route path="/district-admin/agents/district" element={<DistrictAgents level="district" />} />
            <Route path="/district-admin/agents/divisional" element={<DistrictAgents level="divisional" />} />
            <Route path="/district-admin/agents/pincode" element={<DistrictAgents level="pincode" />} />
            <Route path="/district-admin/agent-payments" element={<DistrictAgentPayments />} />
            <Route path="/district-admin/kyc" element={<DistrictKYC />} />
            <Route path="/district-admin/quality-check" element={<DistrictQualityCheck />} />
            <Route path="/district-admin/reports" element={<DistrictReports />} />
            <Route path="/district-admin/payments" element={<DistrictPayments />} />
            <Route path="/district-admin/tasks" element={<DistrictTasks />} />
            <Route path="/district-admin/queries" element={<DistrictQueries />} />
            <Route path="/district-admin/notifications" element={<NotificationsPage />} />
            <Route path="/district-admin/profile" element={<DistrictProfile />} />
            <Route path="/district-admin/settings" element={<DistrictSettings />} />
          </Route>

          {/* Divisional Admin Routes */}
          <Route element={<RoleBasedRoute allowedRoles={['Divisional Admin', 'Division Admin']} />}>
            <Route path="/divisional-admin/dashboard" element={<DivisionalAdminDashboard />} />
            <Route path="/divisional-admin/overview" element={<DivisionalOverview />} />
            <Route path="/divisional-admin/pincodes" element={<DivisionalPincodes />} />
            <Route path="/divisional-admin/pincode-admins" element={<Navigate to="/divisional-admin/pincodes" replace />} />
            <Route path="/divisional-admin/pincode-details" element={<Navigate to="/divisional-admin/pincodes" replace />} />
            <Route path="/divisional-admin/managers" element={<StateManagers level="divisional" />} />
            <Route path="/divisional-admin/managers/divisional" element={<StateManagers level="divisional" />} />
            <Route path="/divisional-admin/managers/pincode" element={<StateManagers level="pincode" />} />
            <Route path="/divisional-admin/agents" element={<DistrictAgents level="divisional" />} />
            <Route path="/divisional-admin/agents/divisional" element={<DistrictAgents level="divisional" />} />
            <Route path="/divisional-admin/agents/pincode" element={<DistrictAgents level="pincode" />} />
            <Route path="/divisional-admin/agent-payments" element={<DivisionalAgentPayments />} />
            <Route path="/divisional-admin/customers" element={<DivisionalCustomers />} />
            <Route path="/divisional-admin/membership-cards" element={<DivisionalMembershipCards />} />
            <Route path="/divisional-admin/vendors" element={<DivisionalVendors />} />
            <Route path="/divisional-admin/vendor-subscriptions" element={<DivisionalVendorSubscriptions />} />
            <Route path="/divisional-admin/vendor-payments" element={<DivisionalVendorPayments />} />
            <Route path="/divisional-admin/orders" element={<DivisionalOrders />} />
            <Route path="/divisional-admin/bookings" element={<DivisionalBookings />} />
            <Route path="/divisional-admin/jobs" element={<DivisionalJobs />} />
            <Route path="/divisional-admin/delivery-partners" element={<DivisionalDeliveryPartners />} />
            <Route path="/divisional-admin/technicians" element={<DivisionalTechnicians />} />
            <Route path="/divisional-admin/executives" element={<DivisionalExecutives />} />
            <Route path="/divisional-admin/support-team" element={<DivisionalSupportTeam />} />
            <Route path="/divisional-admin/kyc" element={<DivisionalKYC />} />
            <Route path="/divisional-admin/quality-check" element={<DivisionalQualityCheck />} />
            <Route path="/divisional-admin/payments" element={<DivisionalPayments />} />
            <Route path="/divisional-admin/reports" element={<DivisionalReports />} />
            <Route path="/divisional-admin/tasks" element={<DivisionalTasks />} />
            <Route path="/divisional-admin/queries" element={<DivisionalQueries />} />
            <Route path="/divisional-admin/notifications" element={<NotificationsPage />} />
            <Route path="/divisional-admin/profile" element={<DivisionalProfile />} />
            <Route path="/divisional-admin/settings" element={<DivisionalSettings />} />
          </Route>

          {/* Division Admin URL Aliases */}
          <Route path="/division-admin/dashboard" element={<Navigate to="/divisional-admin/dashboard" replace />} />
          <Route path="/division-admin/*" element={<Navigate to="/divisional-admin/dashboard" replace />} />

          {/* Pincode Admin Routes */}
          <Route element={<RoleBasedRoute allowedRoles={['Pincode Admin']} />}>
            <Route path="/pincode-admin/dashboard" element={<PincodeAdminDashboard />} />
            <Route path="/pincode-admin/overview" element={<Navigate to="/pincode-admin/dashboard" replace />} />
            <Route path="/pincode-admin/customers" element={<PincodeCustomers />} />
            <Route path="/pincode-admin/membership-cards" element={<PincodeMembershipCards />} />
            <Route path="/pincode-admin/vendors" element={<PincodeVendors />} />
            <Route path="/pincode-admin/vendor-subscriptions" element={<PincodeVendorSubscriptions />} />
            <Route path="/pincode-admin/vendor-details" element={<Navigate to="/pincode-admin/vendor-subscriptions" replace />} />
            <Route path="/pincode-admin/vendor-payments" element={<PincodeVendorPayments />} />
            <Route path="/pincode-admin/orders" element={<PincodeOrders />} />
            <Route path="/pincode-admin/bookings" element={<PincodeBookings />} />
            <Route path="/pincode-admin/jobs" element={<PincodeJobs />} />
            <Route path="/pincode-admin/delivery-partners" element={<PincodeDeliveryPartners />} />
            <Route path="/pincode-admin/technicians" element={<PincodeTechnicians />} />
            <Route path="/pincode-admin/executives" element={<PincodeExecutives />} />
            <Route path="/pincode-admin/support-team" element={<PincodeSupportTeam />} />
            <Route path="/pincode-admin/agents" element={<PincodeAgents />} />
            <Route path="/pincode-admin/agent-payments" element={<PincodeAgentPayments />} />
            <Route path="/pincode-admin/kyc" element={<PincodeKYC />} />
            <Route path="/pincode-admin/quality-check" element={<PincodeQualityCheck />} />
            <Route path="/pincode-admin/business-reports" element={<PincodeBusinessReports />} />
            <Route path="/pincode-admin/managers" element={<StateManagers level="pincode" />} />
            <Route path="/pincode-admin/managers/pincode" element={<StateManagers level="pincode" />} />
            <Route path="/pincode-admin/pincode-manager" element={<Navigate to="/pincode-admin/managers" replace />} />
            <Route path="/pincode-admin/payments" element={<PincodePayments />} />
            <Route path="/pincode-admin/tasks" element={<PincodeTasks />} />
            <Route path="/pincode-admin/queries" element={<PincodeQueries />} />
            <Route path="/pincode-admin/notifications" element={<NotificationsPage />} />
            <Route path="/pincode-admin/profile" element={<PincodeProfile />} />
            <Route path="/pincode-admin/settings" element={<PincodeSettings />} />
          </Route>

          {/* Manager Routes */}
          <Route element={<RoleBasedRoute allowedRoles={['Manager', 'state_manager', 'district_manager', 'division_manager', 'pincode_manager']} />}>
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
            <Route path="/manager/overview" element={<Navigate to="/manager/dashboard" replace />} />
            <Route path="/manager/profile" element={<StateProfile />} />
            <Route path="/manager/settings" element={<StateSettings />} />
          </Route>

        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
