import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function getSessionAndRole(sessionUser) {
      if (!sessionUser) {
        if (mounted) {
          setUser(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', sessionUser.id)
          .single();

        if (error) throw error;

        if (mounted) {
          setUser(sessionUser);
          setRole(data?.role || null);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        if (mounted) {
          setUser(sessionUser); // Keep user even if role fetch fails
          setRole(null);
          setLoading(false);
        }
      }
    }

    // 1. Get initial session
    supabase.auth.getSession()
      .then(({ data }) => {
        getSessionAndRole(data?.session?.user);
      })
      .catch((err) => {
        console.warn('[AuthContext] Auth session error:', err);
        if (mounted) setLoading(false);
      });

    // 2. Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // If event is SIGN_IN, SIGN_OUT, etc., re-fetch role
        setLoading(true);
        getSessionAndRole(session?.user);
      }
    );

    return () => {
      mounted = false;
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
