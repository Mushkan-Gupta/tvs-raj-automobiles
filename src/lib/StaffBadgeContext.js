import { createContext, useContext } from 'react';

// Shared by StaffLayout (provider) and AdminNav (publisher) so pages can show
// their pending counts as badges in the sidebar.
export const StaffBadgeContext = createContext(null);
export const useStaffBadges = () => useContext(StaffBadgeContext);
