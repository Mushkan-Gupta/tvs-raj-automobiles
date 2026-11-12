import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import './lib/supabaseClient'; // Initialize Supabase client on app startup
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import BikeListing from './pages/BikeListing';
import BikeDetail from './pages/BikeDetail';
import Parts from './pages/Parts';
import Offers from './pages/Offers';
import Finance from './pages/Finance';
import About from './pages/About';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Account from './pages/Account';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminOverview from './pages/AdminOverview';
import AdminApprovals from './pages/AdminApprovals';
import AdminParts from './pages/AdminParts';
import ManageEmployees from './pages/ManageEmployees';
import EmployeeDashboard from './pages/EmployeeDashboard';
import PendingDocuments from './pages/PendingDocuments';
import PendingPayments from './pages/PendingPayments';
import SalesHistory from './pages/SalesHistory';
import StaffLayout from './components/StaffLayout';
import { AuthProvider } from './lib/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { MessageSquare } from 'lucide-react';

function AppShell() {
  const { pathname } = useLocation();
  // Staff pages (admin + employee) use their own sidebar layout, so the public
  // header, footer and WhatsApp button are hidden there.
  const isStaffArea = pathname.startsWith('/admin/') || pathname.startsWith('/employee/');

  return (
    <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col font-sans selection:bg-[#0066CC] selection:text-white relative">
      {!isStaffArea && <Navbar />}
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/bikes" element={<BikeListing />} />
          <Route path="/bikes/:id" element={<BikeDetail />} />
          <Route path="/parts" element={<Parts />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin-login" element={<AdminLogin />} />

          {/* All staff pages share one sidebar layout */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'employee']} />}>
            <Route element={<StaffLayout />}>
              <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
              <Route path="/employee/enquiries" element={<EmployeeDashboard view="enquiries" />} />
              <Route path="/employee/sales" element={<SalesHistory />} />
              <Route path="/employee/pending-documents" element={<PendingDocuments />} />
              <Route path="/employee/pending-payments" element={<PendingPayments />} />

              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/overview" element={<AdminOverview />} />
                <Route path="/admin/approvals" element={<AdminApprovals />} />
                <Route path="/admin/parts" element={<AdminParts />} />
                <Route path="/admin/employees" element={<ManageEmployees />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </main>

      {!isStaffArea && (
        <>
          {/* Sticky Floating Mobile/Desktop WhatsApp Quick Contact Button */}
          <a
            href="https://wa.me/9779819789215"
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-5 right-5 z-40 bg-emerald-600 hover:bg-emerald-500 text-white p-3.5 sm:px-4 sm:py-3 rounded-full shadow-2xl flex items-center space-x-2 transition-transform hover:scale-108 border border-emerald-400/30"
            aria-label="Chat on WhatsApp"
          >
            <MessageSquare className="w-5 h-5 fill-white/10" />
            <span className="hidden sm:inline text-xs font-bold">WhatsApp Us</span>
          </a>
          <Footer />
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
