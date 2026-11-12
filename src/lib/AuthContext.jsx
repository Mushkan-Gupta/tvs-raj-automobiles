import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';

const AuthContext = createContext();

// In-memory cache for user roles keyed by user ID
const memoryRoleCache = new Map();

function getCachedRole(userId) {
  if (!userId) return null;
  if (memoryRoleCache.has(userId)) return memoryRoleCache.get(userId);
  try {
    const stored = sessionStorage.getItem(`auth_role_${userId}`);
    if (stored) {
      memoryRoleCache.set(userId, stored);
      return stored;
    }
  } catch {
    // ignore sessionStorage errors
  }
  return null;
}

function setCachedRole(userId, role) {
  if (!userId) return;
  if (role) {
    memoryRoleCache.set(userId, role);
    try {
      sessionStorage.setItem(`auth_role_${userId}`, role);
    } catch {
      // ignore sessionStorage errors
    }
  } else {
    memoryRoleCache.delete(userId);
    try {
      sessionStorage.removeItem(`auth_role_${userId}`);
    } catch {
      // ignore
    }
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Track the current user ID to detect actual account changes
  const currentUserIdRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    async function fetchRoleForUser(sessionUser, shouldBlockWithLoading = false) {
      if (!sessionUser) {
        currentUserIdRef.current = null;
        if (mounted) {
          setUser(null);
          setRole(null);
          setLoading(false);
        }
        return;
      }

      currentUserIdRef.current = sessionUser.id;
      const cached = getCachedRole(sessionUser.id);

      // If we have a cached role, adopt it immediately so rendering is unblocked
      if (cached && mounted) {
        setUser(sessionUser);
        setRole(cached);
        setLoading(false);
      } else if (shouldBlockWithLoading && mounted) {
        setUser(sessionUser);
        setLoading(true);
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('id', sessionUser.id)
          .maybeSingle();

        if (error) throw error;

        const fetchedRole = data?.role || null;
        setCachedRole(sessionUser.id, fetchedRole);

        if (mounted) {
          setUser(sessionUser);
          setRole(fetchedRole);
          setLoading(false);
        }
      } catch (error) {
        console.error('[AuthContext] Error fetching user role:', error);
        if (mounted) {
          setUser(sessionUser);
          // If we had a cached role, keep it; otherwise set null
          if (!cached) setRole(null);
          setLoading(false);
        }
      }
    }

    // 1. Initial session check on mount (only time loading=true blocks rendering)
    supabase.auth.getSession()
      .then(({ data }) => {
        const sessionUser = data?.session?.user;
        if (sessionUser) {
          const cached = getCachedRole(sessionUser.id);
          fetchRoleForUser(sessionUser, !cached);
        } else {
          if (mounted) setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('[AuthContext] Auth session error:', err);
        if (mounted) setLoading(false);
      });

    // 2. Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const sessionUser = session?.user;

        // Ignore events that don't change the authenticated identity
        if (event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
          if (sessionUser && mounted) {
            setUser(sessionUser);
          }
          return;
        }

        if (event === 'SIGNED_OUT' || !sessionUser) {
          currentUserIdRef.current = null;
          if (mounted) {
            setUser(null);
            setRole(null);
            setLoading(false);
          }
          return;
        }

        // Only re-fetch role if user id actually changed
        if (sessionUser.id !== currentUserIdRef.current) {
          const cached = getCachedRole(sessionUser.id);
          fetchRoleForUser(sessionUser, !cached);
        } else {
          // Same user, keep existing role and update user object in background
          if (mounted) {
            setUser(sessionUser);
          }
        }
      }
    );

    return () => {
      mounted = false;
      if (authListener?.subscription) {
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
