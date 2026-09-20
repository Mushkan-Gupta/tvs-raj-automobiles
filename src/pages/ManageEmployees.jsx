import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import AdminNav from '../components/AdminNav';
import {
  Users,
  UserPlus,
  RefreshCw,
  LogOut,
  AlertCircle,
  Check,
  Search,
  Eye,
  EyeOff,
  Copy,
  CheckCheck,
  Trash2,
  UserX,
  UserCheck,
  X,
  Sparkles,
  ShieldCheck,
  Mail,
  Lock,
  User,
  Calendar,
} from 'lucide-react';

const inputCls =
  'w-full bg-[#0b0f19] border border-[#1f293d] text-white rounded-xl py-2.5 px-3.5 text-sm ' +
  'focus:outline-none focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] transition-colors ' +
  'placeholder:text-gray-600 disabled:opacity-50';

function formatDisplayDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kathmandu',
    });
  } catch {
    return isoString;
  }
}

// Generate secure random password
function generateSecurePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  let result = '';
  const cryptoObj = window.crypto || window.msCrypto;
  const values = new Uint32Array(10);
  cryptoObj.getRandomValues(values);
  for (let i = 0; i < 10; i++) {
    result += chars[values[i] % chars.length];
  }
  return result;
}

export default function ManageEmployees() {
  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Toast notification: { message, type: 'success' | 'error' }
  const [toast, setToast] = useState(null);

  // Modal: Add Employee
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Post-Creation Credentials Box (shown inside modal or banner)
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Modal: Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Status update in-flight state: userId -> boolean
  const [updatingUserId, setUpdatingUserId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── 1. Fetch Employees ──
  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error: funcError } = await supabase.functions.invoke('list-employees', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (funcError) {
        let detail = funcError.message;
        try {
          if (funcError.context instanceof Response) {
            const body = await funcError.context.json();
            detail = body?.error || funcError.message;
          }
        } catch {}
        throw new Error(detail);
      }

      setEmployees(data?.employees || []);
    } catch (err) {
      console.error('[ManageEmployees] Error fetching employees:', err);
      setError(err.message || 'Failed to load employee accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ── 2. Create Employee ──
  const handleOpenAddModal = () => {
    setFullName('');
    setEmail('');
    setPassword(generateSecurePassword());
    setShowPassword(true);
    setCreateError(null);
    setCreatedCredentials(null);
    setAddModalOpen(true);
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    setCreateError(null);

    if (!fullName.trim()) {
      setCreateError('Full name is required.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCreateError('Valid email is required.');
      return;
    }
    if (!password || password.length < 6) {
      setCreateError('Password must be at least 6 characters.');
      return;
    }

    setCreating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { data, error: funcError } = await supabase.functions.invoke('create-employee', {
        body: {
          fullName: fullName.trim(),
          email: email.trim(),
          password,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (funcError) {
        let detail = funcError.message;
        try {
          if (funcError.context instanceof Response) {
            const body = await funcError.context.json();
            detail = body?.error || funcError.message;
          }
        } catch {}
        throw new Error(detail);
      }

      // Store created credentials for the copyable box
      setCreatedCredentials({
        fullName: fullName.trim(),
        email: email.trim(),
        password: password,
      });

      showToast('Employee account created successfully!');
      fetchEmployees();
    } catch (err) {
      console.error('[ManageEmployees] Create error:', err);
      setCreateError(err.message || 'Failed to create employee account.');
    } finally {
      setCreating(false);
    }
  };

  // ── 3. Toggle Status (Deactivate / Activate) ──
  const handleToggleStatus = async (emp) => {
    const nextAction = emp.isActive ? 'deactivate' : 'activate';
    setUpdatingUserId(emp.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { error: funcError } = await supabase.functions.invoke('update-employee-status', {
        body: {
          userId: emp.id,
          action: nextAction,
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (funcError) {
        let detail = funcError.message;
        try {
          if (funcError.context instanceof Response) {
            const body = await funcError.context.json();
            detail = body?.error || funcError.message;
          }
        } catch {}
        throw new Error(detail);
      }

      showToast(
        nextAction === 'deactivate'
          ? `Account deactivated for ${emp.full_name}.`
          : `Account re-activated for ${emp.full_name}.`
      );

      // Optimistically update local list
      setEmployees((prev) =>
        prev.map((item) =>
          item.id === emp.id ? { ...item, isActive: nextAction === 'activate' } : item
        )
      );
    } catch (err) {
      console.error('[ManageEmployees] Toggle status error:', err);
      showToast(err.message || 'Failed to update employee status.', 'error');
    } finally {
      setUpdatingUserId(null);
    }
  };

  // ── 4. Delete Employee ──
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const { error: funcError } = await supabase.functions.invoke('update-employee-status', {
        body: {
          userId: deleteTarget.id,
          action: 'delete',
        },
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (funcError) {
        let detail = funcError.message;
        try {
          if (funcError.context instanceof Response) {
            const body = await funcError.context.json();
            detail = body?.error || funcError.message;
          }
        } catch {}
        throw new Error(detail);
      }

      showToast(`Account for ${deleteTarget.full_name} deleted permanently.`);
      setDeleteTarget(null);
      setEmployees((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    } catch (err) {
      console.error('[ManageEmployees] Delete error:', err);
      showToast(err.message || 'Failed to delete employee account.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Copy helper
  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-login');
  };

  // Filtered employees by search
  const filteredEmployees = employees.filter((emp) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      emp.full_name?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Toast Notification ── */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-semibold animate-in slide-in-from-top-2 duration-300 ${
            toast.type === 'error'
              ? 'bg-red-900/90 border-red-500/50 text-red-200'
              : 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          ) : (
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#1f293d]">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#0066CC] uppercase tracking-wider mb-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Staff Access Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Employee Accounts
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Create, activate, deactivate, or delete staff credentials for stock & sales logging
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-bold transition-colors shadow-lg min-h-[44px]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
          <button
            onClick={fetchEmployees}
            disabled={loading}
            className="p-2.5 rounded-xl border border-[#1f293d] text-gray-300 hover:text-white hover:bg-[#151c2c] transition-colors disabled:opacity-50 min-h-[44px]"
            title="Refresh employees"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0066CC]' : ''}`} />
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border border-[#1f293d] text-gray-400 hover:text-red-400 hover:border-red-500/40 text-sm font-semibold transition-colors min-h-[44px]"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <AdminNav />

      {/* ── Search Bar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search employees by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputCls + ' pl-10'}
          />
        </div>

        <div className="text-xs text-gray-400 self-start sm:self-auto font-medium">
          {employees.length} registered employee{employees.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-white text-sm">Failed to load employee list</h3>
              <p className="text-xs text-red-400 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchEmployees}
            className="px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-white text-xs font-bold transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Employees Table ── */}
      {loading ? (
        <div className="py-20 text-center space-y-3 bg-[#0e1422] border border-[#1f293d] rounded-2xl">
          <RefreshCw className="w-8 h-8 text-[#0066CC] animate-spin mx-auto" />
          <p className="text-gray-400 text-sm font-medium">Loading staff accounts…</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-[#0e1422] border border-[#1f293d] rounded-2xl p-6">
          <Users className="w-12 h-12 text-gray-600 mx-auto" />
          <h3 className="text-base font-bold text-white">
            {search ? 'No employees matched your search.' : 'No employee accounts created yet.'}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {search
              ? 'Try searching with a different name or email address.'
              : 'Add your first showroom employee so they can log stock arrivals and sales.'}
          </p>
          {!search && (
            <button
              onClick={handleOpenAddModal}
              className="mt-2 px-4 py-2 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-bold transition-colors"
            >
              Add First Employee
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[#1f293d] bg-[#0e1422]">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#0b0f19] text-gray-400 text-xs uppercase tracking-wider border-b border-[#1f293d]">
              <tr>
                <th className="px-5 py-3.5 font-semibold">Employee</th>
                <th className="px-5 py-3.5 font-semibold">Email</th>
                <th className="px-5 py-3.5 font-semibold">Created Date</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f293d]">
              {filteredEmployees.map((emp) => {
                const isUpdating = updatingUserId === emp.id;

                return (
                  <tr key={emp.id} className="hover:bg-[#151c2c]/40 transition-colors">
                    {/* Employee Name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-[#151c2c] border border-[#1f293d] flex items-center justify-center text-[#0066CC] font-bold text-sm shrink-0">
                          {emp.full_name?.charAt(0)?.toUpperCase() || 'E'}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{emp.full_name}</p>
                          <span className="text-[11px] text-gray-500 font-mono">
                            ID: {emp.id.substring(0, 8)}…
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-1.5 text-gray-300 text-xs font-medium">
                        <Mail className="w-3.5 h-3.5 text-gray-500" />
                        <span>{emp.email}</span>
                      </div>
                    </td>

                    {/* Created Date */}
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-1.5 text-gray-400 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        <span>{formatDisplayDate(emp.created_at)}</span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                          emp.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            emp.isActive ? 'bg-emerald-400' : 'bg-gray-400'
                          }`}
                        />
                        {emp.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>

                    {/* Action Buttons */}
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Deactivate / Activate Button */}
                        <button
                          onClick={() => handleToggleStatus(emp)}
                          disabled={isUpdating}
                          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors min-h-[34px] ${
                            emp.isActive
                              ? 'border-[#1f293d] text-gray-300 hover:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/5'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          } disabled:opacity-50`}
                          title={emp.isActive ? 'Deactivate account' : 'Reactivate account'}
                        >
                          {isUpdating ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : emp.isActive ? (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              <span>Deactivate</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Activate</span>
                            </>
                          )}
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => setDeleteTarget(emp)}
                          className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border border-[#1f293d] text-gray-400 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/5 text-xs font-semibold transition-colors min-h-[34px]"
                          title="Delete account permanently"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal: Add Employee ── */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#1f293d]">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-[#0066CC]/15 border border-[#0066CC]/30 text-[#0066CC]">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Create Employee Account</h2>
                  <p className="text-xs text-gray-400">Add credentials for staff portal login</p>
                </div>
              </div>
              <button
                onClick={() => setAddModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-[#151c2c] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* If account was just created, show copyable credentials box */}
            {createdCredentials ? (
              <div className="p-6 space-y-5">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-white text-sm">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Account Created Successfully!</span>
                  </div>
                  <p className="text-xs text-gray-300">
                    Share these login details with the employee. The password will not be shown again.
                  </p>
                </div>

                <div className="space-y-3 p-4 rounded-2xl bg-[#0b0f19] border border-[#1f293d]">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                      Employee Name
                    </span>
                    <p className="font-semibold text-white text-sm">{createdCredentials.fullName}</p>
                  </div>

                  <div className="pt-2 border-t border-[#1f293d]/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                        Email Address
                      </span>
                      <p className="font-mono text-xs text-white select-all">{createdCredentials.email}</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(createdCredentials.email, 'email')}
                      className="p-2 rounded-lg border border-[#1f293d] text-gray-300 hover:text-white hover:bg-[#151c2c] transition-colors"
                      title="Copy email"
                    >
                      {copiedField === 'email' ? (
                        <CheckCheck className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-[#1f293d]/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                        Initial Password
                      </span>
                      <p className="font-mono text-sm font-bold text-emerald-400 select-all">
                        {createdCredentials.password}
                      </p>
                    </div>
                    <button
                      onClick={() => copyToClipboard(createdCredentials.password, 'password')}
                      className="p-2 rounded-lg border border-[#1f293d] text-gray-300 hover:text-white hover:bg-[#151c2c] transition-colors"
                      title="Copy password"
                    >
                      {copiedField === 'password' ? (
                        <CheckCheck className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setAddModalOpen(false);
                      setCreatedCredentials(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-bold transition-colors"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateEmployee} className="p-6 space-y-4">
                {createError && (
                  <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{createError}</span>
                  </div>
                )}

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Thapa"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={creating}
                      className={inputCls + ' pl-10'}
                      required
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="employee@tvsraj.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={creating}
                      className={inputCls + ' pl-10'}
                      required
                    />
                  </div>
                </div>

                {/* Password Field with Generator */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider">
                      Temporary Password <span className="text-red-400">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPassword(generateSecurePassword())}
                      className="text-[11px] text-[#0066CC] hover:text-blue-300 font-bold flex items-center gap-1 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Generate random password</span>
                    </button>
                  </div>

                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={creating}
                      className={inputCls + ' pl-10 pr-10 font-mono text-sm'}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Must be at least 6 characters. You will be able to copy this upon creation.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setAddModalOpen(false)}
                    disabled={creating}
                    className="flex-1 py-2.5 rounded-xl border border-[#1f293d] text-gray-300 hover:text-white hover:border-gray-500 text-sm font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-2.5 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    {creating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Creating…</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Create Account</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Delete Confirmation ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start space-x-3">
              <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded-full shrink-0 text-red-400">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete Employee Account</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Are you sure you want to permanently delete the account for{' '}
                  <span className="text-white font-semibold">{deleteTarget.full_name}</span> (
                  {deleteTarget.email})?
                </p>
                <p className="text-xs text-red-400 mt-2 font-medium">
                  This action is permanent and cannot be undone. They will no longer be able to log in.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-[#1f293d] text-gray-300 hover:text-white hover:border-gray-500 text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center space-x-2"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deleting…</span>
                  </>
                ) : (
                  <span>Delete Permanently</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
