import { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';

/**
 * Hook for customer-facing pages.
 *
 * Returns:
 *  - user:            the Supabase auth user (or null)
 *  - isCustomer:      true when signed in and NOT staff (role === null)
 *  - profile:         the public.profiles row (or null)
 *  - profileComplete: true when full_name, phone, city, and area are filled
 *  - loading:         true while auth or profile data is still loading
 */
export function useCustomer() {
  const { user, role, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const isCustomer = !!user && role === null;

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    let mounted = true;
    setProfileLoading(true);

    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (mounted) {
          setProfile(data || null);
          setProfileLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setProfile(null);
          setProfileLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [user]);

  const profileComplete = !!(
    profile?.full_name?.trim() &&
    profile?.phone?.trim() &&
    profile?.city?.trim() &&
    profile?.area?.trim()
  );

  return {
    user,
    isCustomer,
    profile,
    profileComplete,
    loading: authLoading || profileLoading,
  };
}

export default useCustomer;

