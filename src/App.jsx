import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './lib/supabaseClient'; // Initialize Supabase client on app startup
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import BikeListing from './pages/BikeListing';
import BikeDetail from './pages/BikeDetail';
import Offers from './pages/Offers';
import Finance from './pages/Finance';
import About from './pages/About';
import Contact from './pages/Contact';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';
import PendingDocuments from './pages/PendingDocuments';
import PendingPayments from './pages/PendingPayments';
import { AuthProvider } from './lib/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { MessageSquare } from 'lucide-react';

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-[#0b0f19] text-gray-100 flex flex-col font-sans selection:bg-[#0066CC] selection:text-white relative">
        <Navbar />
      <main className="flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/bikes" element={<BikeListing />} />
          <Route path="/bikes/:id" element={<BikeDetail />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
          </Route>
          
          <Route element={<ProtectedRoute allowedRoles={['admin', 'employee']} />}>
            <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
            <Route path="/employee/pending-documents" element={<PendingDocuments />} />
            <Route path="/employee/pending-payments" element={<PendingPayments />} />
          </Route>
        </Routes>
      </main>

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
      </div>
    </AuthProvider>
  );
}
