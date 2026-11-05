import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

/**
 * Persists and restores form draft state in sessionStorage keyed by user ID.
 *
 * @param {string} formKey - Name of the form (e.g. 'sale_form', 'arrival_form', 'part_add_form')
 * @param {object} currentState - Current form state to persist
 * @param {function} restoreState - Callback called once on mount if a saved draft is found
 * @param {boolean} enabled - If false, drafting is disabled (e.g. edit mode in modal)
 * @returns {{ clearDraft: () => void }}
 */
export function useDraft(formKey, currentState, restoreState, enabled = true) {
  const { user } = useAuth();
  const userId = user?.id || 'anonymous';
  const storageKey = `draft_${userId}_${formKey}`;
  const isRestoredRef = useRef(false);

  // Restore saved draft on mount
  useEffect(() => {
    if (!enabled || isRestoredRef.current) return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          restoreState(parsed);
        }
      }
    } catch (err) {
      console.warn(`[useDraft] Could not restore draft for ${storageKey}:`, err);
    } finally {
      isRestoredRef.current = true;
    }
  }, [storageKey, enabled, restoreState]);

  // Persist state updates to sessionStorage (only after initial restore check)
  useEffect(() => {
    if (!enabled || !isRestoredRef.current) return;
    try {
      if (currentState != null) {
        sessionStorage.setItem(storageKey, JSON.stringify(currentState));
      }
    } catch (err) {
      console.warn(`[useDraft] Could not persist draft for ${storageKey}:`, err);
    }
  }, [storageKey, currentState, enabled]);

  const clearDraft = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  }, [storageKey]);

  return { clearDraft };
}

