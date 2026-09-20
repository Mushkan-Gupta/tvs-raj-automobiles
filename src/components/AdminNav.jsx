import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Package, FileText, CreditCard, Users } from 'lucide-react';

export default function AdminNav({ pendingDocsCount, pendingPaymentsCount }) {
  const location = useLocation();
  const currentPath = location.pathname;

  const navItems = [
    {
      name: 'Overview',
      path: '/admin/overview',
      icon: LayoutDashboard,
      active: currentPath === '/admin/overview',
    },
    {
      name: 'Inventory',
      path: '/admin/dashboard',
      icon: Package,
      active: currentPath === '/admin/dashboard',
    },
    {
      name: 'Employees',
      path: '/admin/employees',
      icon: Users,
      active: currentPath === '/admin/employees',
    },
    {
      name: 'Pending Documents',
      path: '/employee/pending-documents',
      icon: FileText,
      active: currentPath === '/employee/pending-documents',
      badge: pendingDocsCount,
    },
    {
      name: 'Pending Payments',
      path: '/employee/pending-payments',
      icon: CreditCard,
      active: currentPath === '/employee/pending-payments',
      badge: pendingPaymentsCount,
      badgeColor: 'amber',
    },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#1f293d]/80 text-sm font-medium">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.active;

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl shrink-0 transition-all ${
              isActive
                ? 'bg-[#0066CC]/15 border border-[#0066CC]/40 text-[#0066CC] font-bold shadow-sm'
                : 'text-gray-400 hover:text-white hover:bg-[#151c2c] border border-transparent'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{item.name}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span
                className={`ml-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold leading-none ${
                  item.badgeColor === 'amber'
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#0066CC] text-white'
                }`}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
