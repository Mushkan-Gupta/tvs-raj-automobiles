import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Clock, Package, Wrench, FileText, CreditCard, Receipt,
  MessageSquare, Users, LogOut, Menu, X, Bike, Globe, ChevronUp,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { StaffBadgeContext } from '../lib/StaffBadgeContext';

/**
 * Staff portal shell: left sidebar on desktop, slide-in drawer on phones.
 * Pages publish their pending counts through <AdminNav ... /> (kept for
 * compatibility) so the sidebar can show badges without refetching.
 */
const ADMIN_SECTIONS = [
  {
    title: 'Main',
    items: [
      { key: 'overview', name: 'Overview', to: '/admin/overview', icon: LayoutDashboard },
      { key: 'approvals', name: 'Approvals', to: '/admin/approvals', icon: Clock, badge: 'approvals', amber: true },
    ],
  },
  {
    title: 'Stock',
    items: [
      { key: 'stock', name: 'Stock management', to: '/admin/dashboard', icon: Package },
      { key: 'parts', name: 'Parts', to: '/admin/parts', icon: Wrench },
    ],
  },
  {
    title: 'Records',
    items: [
      { key: 'docs', name: 'Pending documents', to: '/employee/pending-documents', icon: FileText, badge: 'docs' },
      { key: 'payments', name: 'Payments', to: '/employee/pending-payments', icon: CreditCard, badge: 'payments', amber: true },
      { key: 'sales', name: 'Sales history', to: '/employee/sales', icon: Receipt },
      { key: 'enquiries', name: 'Customer enquiries', to: '/employee/enquiries', icon: MessageSquare },
    ],
  },
  {
    title: 'Admin',
    items: [{ key: 'employees', name: 'Employees', to: '/admin/employees', icon: Users }],
  },
];

const EMPLOYEE_SECTIONS = [
  {
    title: null,
    items: [
      { key: 'stock', name: 'Stock management', to: '/employee/dashboard', icon: Package },
      { key: 'docs', name: 'Pending documents', to: '/employee/pending-documents', icon: FileText, badge: 'docs' },
      { key: 'payments', name: 'Payments', to: '/employee/pending-payments', icon: CreditCard, badge: 'payments', amber: true },
      { key: 'sales', name: 'Sales history', to: '/employee/sales', icon: Receipt },
      { key: 'enquiries', name: 'Customer enquiries', to: '/employee/enquiries', icon: MessageSquare },
    ],
  },
];

function Badge({ value, amber }) {
  if (!value) return null;
  return (
    <span
      className={`ml-auto min-w-[22px] text-center px-1.5 py-0.5 rounded-full text-[11px] font-bold leading-none ${amber ? 'bg-amber-500 text-black' : 'bg-[#0066CC] text-white'
        }`}
    >
      {value}
    </span>
  );
}

function AccountMenu({ user, role, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const initial = (user?.email || '?').charAt(0).toUpperCase();

  // Close on outside click / tap and on Escape
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const itemClass =
    'w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff]';

  return (
    <div
      ref={rootRef}
      className="relative border-t border-[#1f293d] p-3"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {/* Menu opens upwards from the account button */}
      <div
        role="menu"
        aria-label="Account"
        aria-hidden={!open}
        className={`absolute left-3 right-3 bottom-full mb-1 rounded-xl border border-[#1f293d] bg-[#0e1422] p-1.5 shadow-lg origin-bottom transition-[opacity,transform,visibility] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${open ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-1 invisible pointer-events-none'
          }`}
      >
        <div className="px-3 py-2">
          <p className="text-xs text-gray-500 capitalize">{role}</p>
          <p className="text-sm text-white break-all">{user?.email}</p>
        </div>
        <div className="h-px bg-[#1f293d] my-1" />
        <Link
          to="/"
          role="menuitem"
          onClick={() => { setOpen(false); onNavigate?.(); }}
          className={`${itemClass} text-gray-300 hover:text-white hover:bg-[#151c2c]`}
        >
          <Globe className="w-[18px] h-[18px] shrink-0" />
          <span>View website</span>
        </Link>
        <button
          type="button"
          role="menuitem"
          onClick={() => { setOpen(false); onLogout(); }}
          className={`${itemClass} text-gray-300 hover:text-red-400 hover:bg-red-500/10`}
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" />
          <span>Log out</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`w-full flex items-center gap-3 px-2 min-h-[52px] rounded-xl text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4da3ff] ${open ? 'bg-[#151c2c]' : 'hover:bg-[#151c2c]'
          }`}
      >
        <span className="w-9 h-9 rounded-full bg-[#0066CC]/20 text-[#4da3ff] flex items-center justify-center text-sm font-semibold shrink-0">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-white font-medium truncate">{user?.email}</span>
          <span className="block text-xs text-gray-500 capitalize">{role}</span>
        </span>
        <ChevronUp
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-150 motion-reduce:transition-none ${open ? '' : 'rotate-180'}`}
        />
      </button>
    </div>
  );
}

function SidebarContent({ sections, badges, onNavigate, user, role, onLogout }) {
  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0066CC] flex items-center justify-center shrink-0">
          <Bike className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black text-white leading-tight truncate">TVS Raj Automobiles</p>
          <p className="text-xs text-gray-500">Staff Portal</p>
        </div>
      </div>

      {/* Nav */}
      <nav aria-label="Staff navigation" className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {sections.map((section, i) => (
          <div key={section.title || i}>
            {section.title && (
              <p className="px-3 mb-1.5 text-xs font-medium text-gray-500">
                {section.title}
              </p>
            )}
            <ul className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <NavLink
                      to={item.to}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 min-h-[44px] rounded-xl text-sm font-medium transition-colors ${isActive
                          ? 'bg-[#0066CC]/15 text-[#4da3ff] font-bold'
                          : 'text-gray-400 hover:text-white hover:bg-[#151c2c]'
                        }`
                      }
                    >
                      <Icon className="w-[18px] h-[18px] shrink-0" />
                      <span className="truncate">{item.name}</span>
                      <Badge value={item.badge ? badges[item.badge] : 0} amber={item.amber} />
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer: one account button that opens a small menu */}
      <AccountMenu user={user} role={role} onNavigate={onNavigate} onLogout={onLogout} />
    </div>
  );
}

export default function StaffLayout() {
  const { user, role } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [badges, setBadgesState] = useState({ approvals: 0, docs: 0, payments: 0 });

  const setBadges = useCallback((patch) => {
    setBadgesState((prev) => {
      const next = { ...prev, ...patch };
      return next.approvals === prev.approvals && next.docs === prev.docs && next.payments === prev.payments
        ? prev
        : next;
    });
  }, []);

  // Close the drawer whenever the page changes
  useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  // Lock body scroll + close on Escape while the drawer is open
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [drawerOpen]);

  // Pending approvals count (admin only): one light query when the page changes
  useEffect(() => {
    if (role !== 'admin') return;
    let cancelled = false;
    (async () => {
      const { count, error } = await supabase
        .from('pending_sales')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (!cancelled && !error && count !== null) setBadges({ approvals: count });
    })();
    return () => { cancelled = true; };
  }, [role, location.pathname, setBadges]);

  const sections = role === 'admin' ? ADMIN_SECTIONS : EMPLOYEE_SECTIONS;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-login');
  };

  const ctx = useMemo(() => ({ badges, setBadges }), [badges, setBadges]);
  const totalAlerts = role === 'admin' ? badges.approvals : 0;

  return (
    <StaffBadgeContext.Provider value={ctx}>
      <div className="min-h-screen bg-[#0b0f19] text-gray-100">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-[#0a0e17] border-r border-[#1f293d] z-30">
          <div className="w-full">
            <SidebarContent
              sections={sections} badges={badges} user={user} role={role}
              onLogout={handleLogout} onNavigate={undefined}
            />
          </div>
        </aside>

        {/* Mobile top bar */}
        <header
          className="lg:hidden sticky top-0 z-30 flex items-center gap-3 px-3 bg-[#0a0e17]/95 backdrop-blur border-b border-[#1f293d]"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            className="relative w-11 h-11 flex items-center justify-center rounded-xl text-gray-300 hover:bg-[#151c2c]"
          >
            <Menu className="w-6 h-6" />
            {totalAlerts > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-500" />}
          </button>
          <div className="flex items-center gap-2 min-w-0 h-14">
            <div className="w-8 h-8 rounded-lg bg-[#0066CC] flex items-center justify-center shrink-0">
              <Bike className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-black text-white truncate">TVS Raj Staff Portal</span>
          </div>
        </header>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu">
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-black/60"
              onClick={() => setDrawerOpen(false)}
            />
            <div
              className="absolute inset-y-0 left-0 w-[82%] max-w-[300px] bg-[#0a0e17] border-r border-[#1f293d] shadow-2xl"
              style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center rounded-xl text-gray-400 hover:bg-[#151c2c] z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent
                sections={sections} badges={badges} user={user} role={role}
                onLogout={handleLogout} onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="lg:pl-64">
          <Outlet />
        </main>
      </div>
    </StaffBadgeContext.Provider>
  );
}
