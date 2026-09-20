import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import AdminNav from '../components/AdminNav';
import {
  TrendingUp,
  CreditCard,
  FileText,
  AlertCircle,
  Check,
  RefreshCw,
  LogOut,
  Bike,
  Building2,
  User,
  ExternalLink,
  ChevronRight,
  AlertTriangle,
  ArrowUpRight,
  Layers,
  Banknote,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

// ── Color constants matching TVS Raj Automobiles Design System ───────────────
const STATUS_COLORS = {
  'Fully Paid': '#10B981', // emerald-500
  'Partial': '#F59E0B',    // amber-500
  'Pending': '#EF4444',    // red-500
};

const PIE_COLORS = ['#10B981', '#F59E0B', '#EF4444'];

// ── Custom Dark Tooltip for Charts ──────────────────────────────────────────
function CustomChartTooltip({ active, payload, label, isCurrency = true }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[#0e1422]/95 border border-[#1f293d] p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1 z-50">
      <p className="font-bold text-white border-b border-[#1f293d] pb-1 mb-1">{label}</p>
      {payload.map((entry, idx) => (
        <div key={`entry-${idx}`} className="flex items-center justify-between space-x-4">
          <span className="text-gray-400 capitalize flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: entry.color || entry.fill || '#0066CC' }}
            />
            {entry.name}:
          </span>
          <span className="font-bold text-white">
            {isCurrency && entry.dataKey === 'revenue'
              ? `NPR ${Number(entry.value || 0).toLocaleString('en-IN')}`
              : Number(entry.value || 0).toLocaleString('en-IN')}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Custom Tooltip for Donut Chart ──────────────────────────────────────────
function DonutTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div className="bg-[#0e1422]/95 border border-[#1f293d] p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1.5 z-50 min-w-[160px]">
      <div className="flex items-center gap-2 border-b border-[#1f293d] pb-1">
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[data.status] || '#0066CC' }}
        />
        <p className="font-bold text-white">{data.status}</p>
      </div>
      <div className="flex justify-between text-gray-400">
        <span>Sales Count:</span>
        <strong className="text-white">{data.count}</strong>
      </div>
      <div className="flex justify-between text-gray-400">
        <span>Total Value:</span>
        <strong className="text-emerald-400">
          NPR {Number(data.totalAmount || 0).toLocaleString('en-IN')}
        </strong>
      </div>
      {data.balanceDue > 0 && (
        <div className="flex justify-between text-gray-400">
          <span>Balance Due:</span>
          <strong className="text-amber-400">
            NPR {Number(data.balanceDue || 0).toLocaleString('en-IN')}
          </strong>
        </div>
      )}
    </div>
  );
}

export default function AdminOverview() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overviewData, setOverviewData] = useState(null);

  // Toggle for Model Chart: 'revenue' | 'units'
  const [modelMetric, setModelMetric] = useState('revenue');

  // Fetch overview data from Supabase Edge Function
  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: funcError } = await supabase.functions.invoke('get-admin-overview');

      if (funcError) {
        let detail = funcError.message;
        try {
          if (funcError.context instanceof Response) {
            const body = await funcError.context.json();
            detail = body?.detail || body?.error || funcError.message;
          }
        } catch {}
        throw new Error(detail);
      }

      if (data?.data) {
        setOverviewData(data.data);
      } else {
        throw new Error('No data received from overview function.');
      }
    } catch (err) {
      console.error('[AdminOverview] Error loading overview:', err);
      setError(err.message || 'Failed to load business overview.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/admin-login');
  };

  // Derived metrics with safe fallbacks
  const totalRevenue = overviewData?.totalRevenue ?? 0;
  const totalUnitsSold = overviewData?.totalUnitsSold ?? 0;
  const totalOutstandingBalance = overviewData?.totalOutstandingBalance ?? 0;
  const pendingHandoverCount = overviewData?.pendingHandoverCount ?? 0;
  const currentStockValue = overviewData?.currentStockValue ?? 0;
  const totalStockUnits = overviewData?.totalStockUnits ?? 0;

  const paymentBreakdown = overviewData?.paymentStatusBreakdown ?? [];
  const buyerSplit = overviewData?.buyerTypeSplit ?? [];
  const salesByModel = overviewData?.salesByModel ?? [];
  const monthlyRevenueTrend = overviewData?.monthlyRevenueTrend ?? [];
  const lowStockBikes = overviewData?.lowStockBikes ?? [];

  // Buyer split calculation
  const totalBuyers = buyerSplit.reduce((sum, b) => sum + (b.count || 0), 0);
  const individualCount = buyerSplit.find((b) => b.type === 'Individual')?.count ?? 0;
  const corporateCount = buyerSplit.find((b) => b.type === 'Corporate')?.count ?? 0;
  const individualPercent = totalBuyers > 0 ? Math.round((individualCount / totalBuyers) * 100) : 0;
  const corporatePercent = totalBuyers > 0 ? 100 - individualPercent : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-[#1f293d]">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold text-[#0066CC] uppercase tracking-wider mb-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Executive Suite</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Business Overview & Analytics
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Real-time sales performance, compliance tracking, and inventory valuation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchOverview}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border border-[#1f293d]
              text-gray-300 hover:text-white hover:bg-[#151c2c] text-sm font-semibold transition-colors disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#0066CC]' : ''}`} />
            <span className="hidden sm:inline">Refresh Data</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border border-[#1f293d]
              text-gray-400 hover:text-red-400 hover:border-red-500/40 text-sm font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <AdminNav
        pendingDocsCount={pendingHandoverCount}
        pendingPaymentsCount={paymentBreakdown.find((p) => p.status === 'Partial' || p.status === 'Pending')?.count}
      />

      {/* ── Error Banner ── */}
      {error && (
        <div className="p-5 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-white text-sm">Failed to sync overview data</h3>
              <p className="text-xs text-red-400 mt-1">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchOverview}
            className="px-3.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-white text-xs font-bold transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading Skeleton / Content ── */}
      {loading && !overviewData ? (
        <div className="py-24 text-center space-y-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#0066CC] border-t-transparent animate-spin mx-auto" />
          <p className="text-gray-400 text-sm font-medium">
            Aggregating data from Google Sheets & Supabase…
          </p>
        </div>
      ) : (
        <>
          {/* ── KPI Cards Grid (5 Cards) ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Total Revenue */}
            <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 relative overflow-hidden group hover:border-[#0066CC]/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Total Revenue</span>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Banknote className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white tracking-tight">
                NPR {totalRevenue.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1 font-medium">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Gross sales value</span>
              </p>
            </div>

            {/* Units Sold */}
            <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 relative overflow-hidden group hover:border-[#0066CC]/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Units Sold</span>
                <div className="p-2.5 rounded-xl bg-[#0066CC]/10 border border-[#0066CC]/20 text-[#0066CC]">
                  <Bike className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white tracking-tight">
                {totalUnitsSold}{' '}
                <span className="text-xs font-normal text-gray-400">bikes</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">Logged sales total</p>
            </div>

            {/* Total Outstanding Balance */}
            <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 relative overflow-hidden group hover:border-amber-500/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Accounts Receivable
                </span>
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-amber-400 tracking-tight">
                NPR {totalOutstandingBalance.toLocaleString('en-IN')}
              </div>
              <Link
                to="/employee/pending-payments"
                className="text-xs text-amber-400/80 hover:text-amber-300 mt-2 flex items-center gap-1 font-medium group-hover:underline"
              >
                <span>View pending balances</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Pending Handovers */}
            <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 relative overflow-hidden group hover:border-blue-500/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Pending Handovers
                </span>
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white tracking-tight">
                {pendingHandoverCount}{' '}
                <span className="text-xs font-normal text-gray-400">sales</span>
              </div>
              <Link
                to="/employee/pending-documents"
                className="text-xs text-blue-400 hover:text-blue-300 mt-2 flex items-center gap-1 font-medium group-hover:underline"
              >
                <span>Clear pending documents</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Current Stock Value */}
            <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 relative overflow-hidden group hover:border-purple-500/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Current Stock Value
                </span>
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-purple-400 tracking-tight">
                NPR {currentStockValue.toLocaleString('en-IN')}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Across {totalStockUnits} bikes in showroom
              </p>
            </div>
          </div>

          {/* ── Charts Grid (Row 1: Monthly Trend & Sales by Model) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Revenue Trend */}
            <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Monthly Revenue Trend</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Sales trajectory over the last 6 months</p>
                </div>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>

              <div className="h-72 w-full pt-2">
                {monthlyRevenueTrend.length === 0 || monthlyRevenueTrend.every((m) => m.revenue === 0) ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs">
                    No historical revenue records available.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyRevenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                      <XAxis
                        dataKey="shortMonth"
                        stroke="#6b7280"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#6b7280"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) =>
                          v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v
                        }
                      />
                      <Tooltip content={<CustomChartTooltip isCurrency={true} />} />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="#10B981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#revenueGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Sales by Model (Bar Chart) */}
            <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">Sales by Model</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Performance breakdown by motorcycle</p>
                </div>
                {/* Metric Selector Toggle */}
                <div className="inline-flex rounded-xl bg-[#0b0f19] border border-[#1f293d] p-1 self-start sm:self-auto">
                  <button
                    onClick={() => setModelMetric('revenue')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                      modelMetric === 'revenue'
                        ? 'bg-[#0066CC] text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Revenue
                  </button>
                  <button
                    onClick={() => setModelMetric('units')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                      modelMetric === 'units'
                        ? 'bg-[#0066CC] text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Units Sold
                  </button>
                </div>
              </div>

              <div className="h-72 w-full pt-2">
                {salesByModel.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-xs">
                    No bike sales logged yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={salesByModel.slice(0, 7)}
                      margin={{ top: 10, right: 10, left: 0, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" vertical={false} />
                      <XAxis
                        dataKey="bikeName"
                        stroke="#6b7280"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                        tickFormatter={(v) => (v.length > 14 ? `${v.substring(0, 12)}…` : v)}
                      />
                      <YAxis
                        stroke="#6b7280"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) =>
                          modelMetric === 'revenue'
                            ? v >= 1000000
                              ? `${(v / 1000000).toFixed(1)}M`
                              : v >= 1000
                              ? `${(v / 1000).toFixed(0)}k`
                              : v
                            : v
                        }
                      />
                      <Tooltip
                        content={<CustomChartTooltip isCurrency={modelMetric === 'revenue'} />}
                      />
                      <Bar
                        dataKey={modelMetric === 'revenue' ? 'revenue' : 'unitsSold'}
                        name={modelMetric === 'revenue' ? 'Revenue' : 'Units'}
                        fill="#0066CC"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* ── Charts Grid (Row 2: Payment Status & Buyer Split) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Status Breakdown (Donut Chart) */}
            <div className="lg:col-span-2 bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Payment Status Distribution</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Collection health across all sales records</p>
                </div>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                {/* Donut Chart */}
                <div className="sm:col-span-6 h-64 w-full relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip content={<DonutTooltip />} />
                      <Pie
                        data={paymentBreakdown}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={4}
                        stroke="#0e1422"
                        strokeWidth={3}
                      >
                        {paymentBreakdown.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={STATUS_COLORS[entry.status] || PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Text inside Donut */}
                  <div className="absolute text-center pointer-events-none">
                    <p className="text-2xl font-black text-white">{totalUnitsSold}</p>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Total Sales</p>
                  </div>
                </div>

                {/* Legend & Metric Cards */}
                <div className="sm:col-span-6 space-y-3">
                  {paymentBreakdown.map((item) => {
                    const color = STATUS_COLORS[item.status] || '#0066CC';
                    const pct = totalUnitsSold > 0 ? Math.round((item.count / totalUnitsSold) * 100) : 0;

                    return (
                      <div
                        key={item.status}
                        className="p-3 rounded-xl bg-[#0b0f19] border border-[#1f293d] flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                          <div>
                            <p className="text-xs font-bold text-white">{item.status}</p>
                            <p className="text-[11px] text-gray-500">
                              {item.count} sale{item.count !== 1 ? 's' : ''} ({pct}%)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-white">
                            NPR {Number(item.totalAmount || 0).toLocaleString('en-IN')}
                          </p>
                          {item.balanceDue > 0 && (
                            <p className="text-[10px] text-amber-400 font-medium">
                              Due: NPR {Number(item.balanceDue).toLocaleString('en-IN')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Buyer Type Split Widget */}
            <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-bold text-white">Buyer Demographics</h2>
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <User className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-xs text-gray-400">Distribution between Individual and Corporate buyers</p>
              </div>

              {/* Progress Bar Representation */}
              <div className="space-y-2">
                <div className="h-3.5 w-full bg-[#0b0f19] rounded-full overflow-hidden flex border border-[#1f293d]">
                  <div
                    style={{ width: `${individualPercent}%` }}
                    className="bg-[#0066CC] h-full transition-all duration-500"
                    title={`Individual: ${individualPercent}%`}
                  />
                  <div
                    style={{ width: `${corporatePercent}%` }}
                    className="bg-purple-600 h-full transition-all duration-500"
                    title={`Corporate: ${corporatePercent}%`}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 font-semibold px-0.5">
                  <span className="text-[#0066CC]">{individualPercent}% Individual</span>
                  <span className="text-purple-400">{corporatePercent}% Corporate</span>
                </div>
              </div>

              {/* Detailed Cards */}
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-[#0b0f19] border border-[#1f293d] flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 rounded-lg bg-[#0066CC]/20 text-[#0066CC]">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Individual Customers</p>
                      <p className="text-[10px] text-gray-500">{individualCount} recorded sales</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-white">
                    NPR {Number(buyerSplit.find((b) => b.type === 'Individual')?.revenue || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#0b0f19] border border-[#1f293d] flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Corporate Clients</p>
                      <p className="text-[10px] text-gray-500">{corporateCount} recorded sales</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-white">
                    NPR {Number(buyerSplit.find((b) => b.type === 'Corporate')?.revenue || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Low Stock Alert Section ── */}
          <div className="bg-[#0e1422] border border-[#1f293d] rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Critical & Low Stock Inventory</span>
                    {lowStockBikes.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {lowStockBikes.length} need attention
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Motorcycles at or below reorder threshold (≤ 2 units)
                  </p>
                </div>
              </div>

              <Link
                to="/admin/dashboard"
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] text-white text-xs font-bold transition-colors shrink-0"
              >
                <span>Manage Inventory</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {lowStockBikes.length === 0 ? (
              <div className="py-10 text-center space-y-2 border border-dashed border-[#1f293d] rounded-xl">
                <Check className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold text-white">All inventory levels healthy</p>
                <p className="text-xs text-gray-500">No bikes currently below stock thresholds.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#1f293d]">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#0b0f19] text-gray-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Bike Name</th>
                      <th className="px-4 py-3 font-semibold">Category</th>
                      <th className="px-4 py-3 font-semibold">Price</th>
                      <th className="px-4 py-3 font-semibold">Stock Remaining</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f293d]">
                    {lowStockBikes.map((bike) => (
                      <tr key={bike.name} className="hover:bg-[#151c2c]/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{bike.name}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{bike.category}</td>
                        <td className="px-4 py-3 text-white text-xs font-semibold">
                          {bike.price > 0 ? `NPR ${bike.price.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-white text-sm">{bike.quantity}</span>
                          <span className="text-gray-500 text-xs ml-1">
                            (threshold: {bike.threshold})
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                              bike.quantity === 0
                                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {bike.quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to="/admin/dashboard"
                            className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-[#1f293d] text-gray-300 hover:text-[#0066CC] hover:border-[#0066CC]/40 text-xs font-semibold transition-colors"
                          >
                            <span>Update</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
