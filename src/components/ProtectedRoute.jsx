import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { Loader } from 'lucide-react';

export default function ProtectedRoute({ allowedRoles }) {
  const { user, role, loading } = useAuth();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <Loader className="w-10 h-10 text-[#0066CC] animate-spin mb-4" />
        <h3 className="text-lg font-bold text-white">Verifying Access...</h3>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/admin-login" replace />;
  }

  // Redirect to appropriate dashboard if role is not allowed
  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === 'employee') {
      return <Navigate to="/employee/dashboard" replace />;
    }
    // Fallback if role is completely unauthorized
    return <Navigate to="/admin-login" replace />;
  }

  // If authenticated and authorized, render the child routes
  return <Outlet />;
}
