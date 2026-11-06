import { useEffect } from 'react';
import { useStaffBadges } from '../lib/StaffBadgeContext';

/**
 * Kept so existing pages keep working. The horizontal tabs are gone (the left
 * sidebar in StaffLayout replaced them); this now only publishes the pending
 * counts a page already knows, so the sidebar can show the badges.
 */
export default function AdminNav({ pendingDocsCount, pendingPaymentsCount, pendingApprovalsCount }) {
  const ctx = useStaffBadges();
  const setBadges = ctx?.setBadges;

  useEffect(() => {
    if (!setBadges) return;
    const patch = {};
    if (pendingDocsCount !== undefined) patch.docs = pendingDocsCount;
    if (pendingPaymentsCount !== undefined) patch.payments = pendingPaymentsCount;
    if (pendingApprovalsCount !== undefined) patch.approvals = pendingApprovalsCount;
    if (Object.keys(patch).length) setBadges(patch);
  }, [setBadges, pendingDocsCount, pendingPaymentsCount, pendingApprovalsCount]);

  return null;
}
