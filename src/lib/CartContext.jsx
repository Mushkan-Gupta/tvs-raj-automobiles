import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';

const STORAGE_KEY = 'tvs_cart_v1';

/**
 * Validates and sanitizes raw cart array from storage.
 * Enforces:
 *  - Must be an array
 *  - partId must be a non-empty string
 *  - qty must be an integer between 1 and 99
 *  - Merges duplicate partIds, capping merged qty at 99
 */
function validateCartItems(raw) {
  if (!Array.isArray(raw)) return [];
  const merged = new Map();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { partId, qty } = item;
    if (typeof partId !== 'string' || !partId.trim()) continue;

    const parsedQty = typeof qty === 'number' ? Math.floor(qty) : parseInt(qty, 10);
    if (isNaN(parsedQty) || parsedQty < 1) continue;

    const cleanQty = Math.min(99, parsedQty);
    const id = partId.trim();

    if (merged.has(id)) {
      const existing = merged.get(id);
      merged.set(id, Math.min(99, existing + cleanQty));
    } else {
      merged.set(id, cleanQty);
    }
  }

  return Array.from(merged.entries()).map(([partId, qty]) => ({ partId, qty }));
}

function loadStoredCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return validateCartItems(parsed);
  } catch {
    return [];
  }
}

function saveStoredCart(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage blocked or quota exceeded
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadStoredCart);
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState(null); // non-blocking aria-live notification

  // Save to localStorage whenever items change
  useEffect(() => {
    saveStoredCart(items);
  }, [items]);

  // Sync across tabs via storage event
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY) {
        try {
          const fresh = e.newValue ? JSON.parse(e.newValue) : [];
          setItems(validateCartItems(fresh));
        } catch {
          // ignore corrupted cross-tab payload
        }
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Total quantity count across all items ("99+" cap will be handled in UI)
  const count = useMemo(() => {
    return items.reduce((sum, item) => sum + item.qty, 0);
  }, [items]);

  // Trigger non-blocking feedback announcement
  const notify = useCallback((message) => {
    setFeedback(message);
    const timer = setTimeout(() => {
      setFeedback(null);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const addItem = useCallback((partId, qty = 1) => {
    if (!partId || typeof partId !== 'string') return;
    const cleanId = partId.trim();
    const addQty = Math.max(1, Math.min(99, Math.floor(qty) || 1));

    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.partId === cleanId);
      if (existingIndex >= 0) {
        const next = [...prev];
        const nextQty = Math.min(99, next[existingIndex].qty + addQty);
        next[existingIndex] = { partId: cleanId, qty: nextQty };
        return next;
      }
      return [...prev, { partId: cleanId, qty: addQty }];
    });

    notify('Added to cart');
  }, [notify]);

  const setQty = useCallback((partId, qty) => {
    if (!partId || typeof partId !== 'string') return;
    const cleanId = partId.trim();
    const targetQty = typeof qty === 'number' ? Math.floor(qty) : parseInt(qty, 10);

    setItems((prev) => {
      if (isNaN(targetQty) || targetQty <= 0) {
        return prev.filter((item) => item.partId !== cleanId);
      }
      const clampedQty = Math.min(99, targetQty);
      return prev.map((item) =>
        item.partId === cleanId ? { ...item, qty: clampedQty } : item
      );
    });
  }, []);

  const removeItem = useCallback((partId) => {
    if (!partId || typeof partId !== 'string') return;
    const cleanId = partId.trim();
    setItems((prev) => prev.filter((item) => item.partId !== cleanId));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const openDrawer = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsOpen(false);
  }, []);

  const getItemQty = useCallback((partId) => {
    if (!partId) return 0;
    const cleanId = partId.trim();
    const found = items.find((i) => i.partId === cleanId);
    return found ? found.qty : 0;
  }, [items]);

  const value = useMemo(() => ({
    items,
    count,
    addItem,
    setQty,
    removeItem,
    clear,
    isOpen,
    openDrawer,
    closeDrawer,
    getItemQty,
    feedback,
  }), [
    items,
    count,
    addItem,
    setQty,
    removeItem,
    clear,
    isOpen,
    openDrawer,
    closeDrawer,
    getItemQty,
    feedback,
  ]);

  return (
    <CartContext.Provider value={value}>
      {children}
      {/* Global non-blocking aria-live notification region */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {feedback}
      </div>
      {feedback && (
        <div
          aria-hidden="true"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-[#151c2c] text-white border border-[#0066CC] px-4 py-2 rounded-full text-xs font-semibold shadow-xl transition-all duration-200 pointer-events-none"
        >
          {feedback}
        </div>
      )}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
