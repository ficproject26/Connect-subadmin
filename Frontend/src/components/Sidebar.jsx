import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { normalizeRole } from '../utils/permissions';
import {
  LayoutDashboard,
  MapPin,
  Building2,
  Users,
  CreditCard,
  Store,
  ShoppingBag,
  CalendarCheck,
  Briefcase,
  Wrench,
  UserCheck,
  Headphones,
  UserPlus,
  UserCog,
  IndianRupee,
  FileCheck2,
  BarChart3,
  ShieldAlert,
  ShieldCheck,
  LogOut,
  Sliders,
  Settings,
  Globe2,
  Layers,
  User,
  Truck,
  ClipboardList,
  CircleHelp,
  Receipt,
  ClipboardCheck
} from 'lucide-react';

export function Sidebar({ isOpen, setIsOpen }) {
  const { user, logout } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();

  if (!user) return null;

  const role = normalizeRole(user?.role);
  let navSections = [];

  if (role === 'Super Admin' || role === 'Main Admin') {
    navSections = [
      {
        title: '',
        items: [
          { name: 'Dashboard', path: '/super-admin/dashboard', icon: LayoutDashboard },
        ]
      },
      {
        title: 'States',
        items: [
          { name: 'State List', path: '/super-admin/states', icon: Building2 },
          { name: 'State Details', path: '/super-admin/state-details', icon: Building2 },
        ]
      },
      {
        title: 'Districts',
        items: [
          { name: 'District List', path: '/super-admin/districts', icon: Building2 },
          { name: 'District Details', path: '/super-admin/district-details', icon: Building2 },
        ]
      },
      {
        title: 'Divisions',
        items: [
          { name: 'Division List', path: '/super-admin/divisions', icon: Layers },
          { name: 'Division Details', path: '/super-admin/division-details', icon: Building2 },
        ]
      },
      {
        title: 'Pincodes',
        items: [
          { name: 'Pincode List', path: '/super-admin/pincodes', icon: MapPin },
          { name: 'Pincode Details', path: '/super-admin/pincode-details', icon: Building2 },
        ]
      },
      {
        title: 'Managers',
        items: [
          { name: 'State Managers', path: '/super-admin/managers/state', icon: UserCog },
          { name: 'District Managers', path: '/super-admin/managers/district', icon: Building2 },
          { name: 'Divisional Managers', path: '/super-admin/managers/divisional', icon: Layers },
          { name: 'Pincode Managers', path: '/super-admin/managers/pincode', icon: MapPin },
        ]
      },
      {
        title: 'Account',
        items: [
          { name: 'Settings', path: '/super-admin/settings', icon: Settings },
        ]
      }
    ];
  } else if (role === 'State Admin') {
    navSections = [
      {
        title: '',
        items: [
          { name: 'Dashboard', path: '/state-admin/dashboard', icon: LayoutDashboard },
        ]
      },
      {
        title: 'Districts',
        items: [
          { name: 'District List', path: '/state-admin/districts', icon: Building2 },
          { name: 'District Details', path: '/state-admin/district-details', icon: Building2 },
        ]
      },
      {
        title: 'Divisions',
        items: [
          { name: 'Division List', path: '/state-admin/divisions', icon: Layers },
          { name: 'Division Details', path: '/state-admin/division-details', icon: Building2 },
        ]
      },
      {
        title: 'Pincodes',
        items: [
          { name: 'Pincode List', path: '/state-admin/pincodes', icon: MapPin },
          { name: 'Pincode Details', path: '/state-admin/pincode-details', icon: Building2 },
        ]
      },
      {
        title: 'Managers',
        items: [
          { name: 'State Managers', path: '/state-admin/managers/state', icon: UserCog },
          { name: 'District Managers', path: '/state-admin/managers/district', icon: Building2 },
          { name: 'Divisional Managers', path: '/state-admin/managers/divisional', icon: Layers },
          { name: 'Pincode Managers', path: '/state-admin/managers/pincode', icon: MapPin },
        ]
      },
      {
        title: 'Agents',
        items: [
          { name: 'State Agent', path: '/state-admin/agents/state', icon: UserPlus },
          { name: 'District Agent', path: '/state-admin/agents/district', icon: Building2 },
          { name: 'Divisional Agent', path: '/state-admin/agents/divisional', icon: Layers },
          { name: 'Pincode Agent', path: '/state-admin/agents/pincode', icon: MapPin },
          { name: 'Agents Payment', path: '/state-admin/agent-payments', icon: IndianRupee },
        ]
      },
      {
        title: 'Customers & Membership',
        items: [
          { name: 'Customers', path: '/state-admin/customers', icon: Users },
          { name: 'Membership Cards', path: '/state-admin/membership-cards', icon: CreditCard },
        ]
      },
      {
        title: 'Vendors',
        items: [
          { name: 'Vendors', path: '/state-admin/vendors', icon: Store },
          { name: 'Vendor Subscription', path: '/state-admin/vendor-subscriptions', icon: Receipt },
          { name: 'Vendor Payment Status', path: '/state-admin/vendor-payments', icon: IndianRupee },
        ]
      },
      {
        title: 'Operations',
        items: [
          { name: 'Orders', path: '/state-admin/orders', icon: ShoppingBag },
          { name: 'Bookings', path: '/state-admin/bookings', icon: CalendarCheck },
          { name: 'Jobs', path: '/state-admin/jobs', icon: Briefcase },
          { name: 'Delivery Partners', path: '/state-admin/delivery-partners', icon: Truck },
          { name: 'Technicians', path: '/state-admin/technicians', icon: Wrench },
          { name: 'Executives', path: '/state-admin/executives', icon: UserCheck },
          { name: 'Support Team', path: '/state-admin/support-team', icon: Headphones },
        ]
      },
      {
        title: 'Finance & Compliance',
        items: [
          { name: 'KYC', path: '/state-admin/kyc', icon: FileCheck2 },
          { name: 'Quality Check', path: '/state-admin/quality-check', icon: ClipboardCheck },
          { name: 'Payments', path: '/state-admin/payments', icon: IndianRupee },
          { name: 'Business Reports', path: '/state-admin/reports', icon: BarChart3 },
          { name: 'Tasks', path: '/state-admin/tasks', icon: ClipboardList },
          { name: 'Queries', path: '/state-admin/queries', icon: CircleHelp },
        ]
      },
      {
        title: 'Account',
        items: [
          { name: 'Profile', path: '/state-admin/profile', icon: User },
          { name: 'Settings', path: '/state-admin/settings', icon: Settings },
        ]
      }
    ];
  } else if (role === 'District Admin') {
    navSections = [
      {
        title: '',
        items: [
          { name: 'Dashboard', path: '/district-admin/dashboard', icon: LayoutDashboard },
        ]
      },
      {
        title: 'Divisions',
        items: [
          { name: 'Division List', path: '/district-admin/divisions', icon: Layers },
          { name: 'Division Details', path: '/district-admin/division-details', icon: Building2 },
        ]
      },
      {
        title: 'Pincodes',
        items: [
          { name: 'Pincode List', path: '/district-admin/pincodes', icon: MapPin },
          { name: 'Pincode Details', path: '/district-admin/pincode-details', icon: Building2 },
        ]
      },
      {
        title: 'Managers',
        items: [
          { name: 'District Managers', path: '/district-admin/managers/district', icon: Building2 },
          { name: 'Divisional Managers', path: '/district-admin/managers/divisional', icon: Layers },
          { name: 'Pincode Managers', path: '/district-admin/managers/pincode', icon: MapPin },
        ]
      },
      {
        title: 'Agents',
        items: [
          { name: 'District Agent', path: '/district-admin/agents/district', icon: Building2 },
          { name: 'Divisional Agent', path: '/district-admin/agents/divisional', icon: Layers },
          { name: 'Pincode Agent', path: '/district-admin/agents/pincode', icon: MapPin },
          { name: 'Agents Payment', path: '/district-admin/agent-payments', icon: IndianRupee },
        ]
      },
      {
        title: 'Customers & Membership',
        items: [
          { name: 'Customers', path: '/district-admin/customers', icon: Users },
          { name: 'Membership Cards', path: '/district-admin/membership-cards', icon: CreditCard },
        ]
      },
      {
        title: 'Vendors',
        items: [
          { name: 'Vendors', path: '/district-admin/vendors', icon: Store },
          { name: 'Vendor Subscription', path: '/district-admin/vendor-subscriptions', icon: Receipt },
          { name: 'Vendor Payment Status', path: '/district-admin/vendor-payments', icon: IndianRupee },
        ]
      },
      {
        title: 'Operations',
        items: [
          { name: 'Orders', path: '/district-admin/orders', icon: ShoppingBag },
          { name: 'Bookings', path: '/district-admin/bookings', icon: CalendarCheck },
          { name: 'Jobs', path: '/district-admin/jobs', icon: Briefcase },
          { name: 'Delivery Partners', path: '/district-admin/delivery-partners', icon: Truck },
          { name: 'Technicians', path: '/district-admin/technicians', icon: Wrench },
          { name: 'Executives', path: '/district-admin/executives', icon: UserCheck },
          { name: 'Support Team', path: '/district-admin/support-team', icon: Headphones },
        ]
      },
      {
        title: 'Finance & Compliance',
        items: [
          { name: 'KYC', path: '/district-admin/kyc', icon: FileCheck2 },
          { name: 'Quality Check', path: '/district-admin/quality-check', icon: ClipboardCheck },
          { name: 'Payments', path: '/district-admin/payments', icon: IndianRupee },
          { name: 'Business Reports', path: '/district-admin/reports', icon: BarChart3 },
          { name: 'Tasks', path: '/district-admin/tasks', icon: ClipboardList },
          { name: 'Queries', path: '/district-admin/queries', icon: CircleHelp },
        ]
      },
      {
        title: 'Account',
        items: [
          { name: 'Profile', path: '/district-admin/profile', icon: User },
          { name: 'Settings', path: '/district-admin/settings', icon: Settings },
        ]
      }
    ];
  } else if (role === 'Divisional Admin' || role === 'Division Admin') {
    navSections = [
      {
        title: '',
        items: [
          { name: 'Dashboard', path: '/divisional-admin/dashboard', icon: LayoutDashboard },
        ]
      },
      {
        title: 'Pincodes',
        items: [
          { name: 'Pincode List', path: '/divisional-admin/pincodes', icon: MapPin },
          { name: 'Pincode Details', path: '/divisional-admin/pincode-details', icon: Building2 },
        ]
      },
      {
        title: 'Managers',
        items: [
          { name: 'Divisional Managers', path: '/divisional-admin/managers/divisional', icon: Layers },
          { name: 'Pincode Managers', path: '/divisional-admin/managers/pincode', icon: MapPin },
        ]
      },
      {
        title: 'Agents',
        items: [
          { name: 'Divisional Agent', path: '/divisional-admin/agents/divisional', icon: Layers },
          { name: 'Pincode Agent', path: '/divisional-admin/agents/pincode', icon: MapPin },
          { name: 'Agents Payment', path: '/divisional-admin/agent-payments', icon: IndianRupee },
        ]
      },
      {
        title: 'Customers & Membership',
        items: [
          { name: 'Customers', path: '/divisional-admin/customers', icon: Users },
          { name: 'Membership Cards', path: '/divisional-admin/membership-cards', icon: CreditCard },
        ]
      },
      {
        title: 'Vendors',
        items: [
          { name: 'Vendors', path: '/divisional-admin/vendors', icon: Store },
          { name: 'Vendor Subscription', path: '/divisional-admin/vendor-subscriptions', icon: Receipt },
          { name: 'Vendor Payment Status', path: '/divisional-admin/vendor-payments', icon: IndianRupee },
        ]
      },
      {
        title: 'Operations',
        items: [
          { name: 'Orders', path: '/divisional-admin/orders', icon: ShoppingBag },
          { name: 'Bookings', path: '/divisional-admin/bookings', icon: CalendarCheck },
          { name: 'Jobs', path: '/divisional-admin/jobs', icon: Briefcase },
          { name: 'Delivery Partners', path: '/divisional-admin/delivery-partners', icon: Truck },
          { name: 'Technicians', path: '/divisional-admin/technicians', icon: Wrench },
          { name: 'Executives', path: '/divisional-admin/executives', icon: UserCheck },
          { name: 'Support Team', path: '/divisional-admin/support-team', icon: Headphones },
        ]
      },
      {
        title: 'Finance & Compliance',
        items: [
          { name: 'KYC', path: '/divisional-admin/kyc', icon: FileCheck2 },
          { name: 'Quality Check', path: '/divisional-admin/quality-check', icon: ClipboardCheck },
          { name: 'Payments', path: '/divisional-admin/payments', icon: IndianRupee },
          { name: 'Business Reports', path: '/divisional-admin/reports', icon: BarChart3 },
          { name: 'Tasks', path: '/divisional-admin/tasks', icon: ClipboardList },
          { name: 'Queries', path: '/divisional-admin/queries', icon: CircleHelp },
        ]
      },
      {
        title: 'Account',
        items: [
          { name: 'Profile', path: '/divisional-admin/profile', icon: User },
          { name: 'Settings', path: '/divisional-admin/settings', icon: Settings },
        ]
      }
    ];
  } else if (role === 'Pincode Admin') {
    navSections = [
      {
        title: '',
        items: [
          { name: 'Dashboard', path: '/pincode-admin/dashboard', icon: LayoutDashboard },
        ]
      },
      {
        title: 'Managers',
        items: [
          { name: 'Pincode Managers', path: '/pincode-admin/managers', icon: UserCog },
        ]
      },
      {
        title: 'Agents',
        items: [
          { name: 'Pincode Agent', path: '/pincode-admin/agents', icon: UserPlus },
          { name: 'Agent Payments', path: '/pincode-admin/agent-payments', icon: IndianRupee },
        ]
      },
      {
        title: 'Customers & Loyalty',
        items: [
          { name: 'Customers', path: '/pincode-admin/customers', icon: Users },
          { name: 'Membership Cards', path: '/pincode-admin/membership-cards', icon: CreditCard },
        ]
      },
      {
        title: 'Vendors',
        items: [
          { name: 'Vendor List', path: '/pincode-admin/vendors', icon: Store },
          { name: 'Vendor Subscription', path: '/pincode-admin/vendor-subscriptions', icon: Receipt },
          { name: 'Vendor Payments', path: '/pincode-admin/vendor-payments', icon: IndianRupee },
        ]
      },
      {
        title: 'Operations',
        items: [
          { name: 'Orders', path: '/pincode-admin/orders', icon: ShoppingBag },
          { name: 'Bookings', path: '/pincode-admin/bookings', icon: CalendarCheck },
          { name: 'Jobs', path: '/pincode-admin/jobs', icon: Briefcase },
          { name: 'Delivery Partner', path: '/pincode-admin/delivery-partners', icon: Truck },
          { name: 'Technicians', path: '/pincode-admin/technicians', icon: Wrench },
          { name: 'Executives', path: '/pincode-admin/executives', icon: UserCheck },
          { name: 'Support Team', path: '/pincode-admin/support-team', icon: Headphones },
        ]
      },
      {
        title: 'Finance & Compliance',
        items: [
          { name: 'KYC', path: '/pincode-admin/kyc', icon: FileCheck2 },
          { name: 'Quality Check', path: '/pincode-admin/quality-check', icon: ClipboardCheck },
          { name: 'Business Reports', path: '/pincode-admin/business-reports', icon: BarChart3 },
          { name: 'Payments', path: '/pincode-admin/payments', icon: IndianRupee },
          { name: 'Tasks', path: '/pincode-admin/tasks', icon: ClipboardList },
          { name: 'Queries', path: '/pincode-admin/queries', icon: CircleHelp },
        ]
      },
      {
        title: 'Account',
        items: [
          { name: 'Profile', path: '/pincode-admin/profile', icon: User },
          { name: 'Settings', path: '/pincode-admin/settings', icon: Settings },
        ]
      }
    ];
  } else if (role === 'Manager' || (role && role.toLowerCase().includes('manager'))) {
    navSections = [
      {
        title: '',
        items: [
          { name: 'Dashboard', path: '/manager/dashboard', icon: LayoutDashboard },
        ]
      },
      {
        title: 'Operations',
        items: [
          { name: 'Field Overview', path: '/manager/overview', icon: Layers },
        ]
      },
      {
        title: 'Account',
        items: [
          { name: 'Profile', path: '/manager/profile', icon: User },
          { name: 'Settings', path: '/manager/settings', icon: Settings },
        ]
      }
    ];
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden backdrop-blur-sm"
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-60 bg-[#001D51] text-slate-200 border-r border-[#0d2f70]/70 flex flex-col transition-all duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } shadow-2xl`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#0d2f70]/70 bg-[#00153a]/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FED766] flex items-center justify-center text-[#001D51] font-black text-lg shadow-sm shadow-[#FED766]/30 shrink-0">
              A
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-white tracking-wider leading-none">
                FORGE INDIA
              </h1>
              <span className="text-[10px] text-[#FED766] font-bold tracking-wider uppercase mt-1 block">
                {role === 'Super Admin' || role === 'Main Admin' ? 'MAIN ADMIN' : role === 'State Admin' ? 'STATE ADMIN' : role === 'District Admin' ? 'DISTRICT ADMIN' : role?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3">
          {navSections.map((section, sIdx) => (
            <div key={section.title || sIdx} className="space-y-0.5">
              {section.title && (
                <div className="text-[10px] font-extrabold text-[#FED766]/80 uppercase tracking-wider px-3 pt-2 pb-1">
                  {section.title}
                </div>
              )}

              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <NavLink
                    key={item.name + item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all group ${
                      isActive
                        ? 'bg-[#FED766] text-[#001D51] font-bold shadow-md shadow-[#FED766]/20'
                        : 'text-slate-200 font-medium hover:text-white hover:bg-[#082b6b]/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive
                            ? 'text-[#001D51]'
                            : 'text-slate-300 group-hover:text-[#FED766]'
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Logout at bottom */}
        <div className="p-3 border-t border-[#0d2f70]/70 bg-[#00153a]/40">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-rose-300 hover:bg-rose-950/40 transition"
          >
            <LogOut className="w-4 h-4 text-slate-300 group-hover:text-rose-300" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
