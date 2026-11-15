import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { useCart } from './CartContext';
import { availableQty } from './stock';

/**
 * Turns raw cart items ({ partId, qty }) into displayable lines.
 * Pure function, no network. `ready` is true only after the parts were
 * loaded successfully. While not ready every line is "not_loaded" and is
 * NOT treated as a stock problem (so a failed load can never look like
 * "out of stock", and "Fix cart" can never delete items because of it).
 *
 * Rules when ready:
 *  - Missing part or active = false -> "No longer available", excluded from subtotal
 *  - availableQty = 0 -> "Out of stock", excluded from subtotal
 *  - qty > availableQty -> displayed qty clamped, "Only N available"
 *  - Stored qty is never modified here.
 */
export function buildCartLines(items, partsById, ready) {
  const lines = items.map((item) => {
    const part = partsById.get(item.partId);

    if (!ready) {
      return {
        partId: item.partId,
        part: part || { id: item.partId, name: 'Loading item…', category: '', price: 0 },
        qty: item.qty,
        displayedQty: item.qty,
        available: false,
        isClamped: false,
        status: 'not_loaded',
        statusText: null,
        lineTotal: 0,
        stockQty: 0,
      };
    }

    if (!part || part.active === false) {
      return {
        partId: item.partId,
        part: part || { id: item.partId, name: 'Part unavailable', category: '', price: 0 },
        qty: item.qty,
        displayedQty: item.qty,
        available: false,
        isClamped: false,
        status: 'no_longer_available',
        statusText: 'No longer available',
        lineTotal: 0,
        stockQty: 0,
      };
    }

    const stockQty = availableQty(part);
    const unitPrice = typeof part.price === 'number' ? part.price : Number(part.price) || 0;

    if (stockQty <= 0) {
      return {
        partId: item.partId,
        part,
        qty: item.qty,
        displayedQty: item.qty,
        available: false,
        isClamped: false,
        status: 'out_of_stock',
        statusText: 'Out of stock',
        lineTotal: 0,
        stockQty: 0,
      };
    }

    if (item.qty > stockQty) {
      return {
        partId: item.partId,
        part,
        qty: item.qty,
        displayedQty: stockQty,
        available: true,
        isClamped: true,
        status: 'clamped',
        statusText: `Only ${stockQty} available`,
        lineTotal: unitPrice * stockQty,
        stockQty,
      };
    }

    return {
      partId: item.partId,
      part,
      qty: item.qty,
      displayedQty: item.qty,
      available: true,
      isClamped: false,
      status: 'ok',
      statusText: null,
      lineTotal: unitPrice * item.qty,
      stockQty,
    };
  });

  const subtotal = lines.reduce((sum, l) => (l.available ? sum + l.lineTotal : sum), 0);
  const hasIssues = ready && lines.some((l) => !l.available || l.isClamped);

  return { lines, subtotal, hasIssues };
}

function isAuthError(err) {
  if (!err) return false;
  return (
    err.status === 401 ||
    err.code === 'PGRST301' ||
    /jwt|token/i.test(String(err.message || ''))
  );
}

async function fetchParts(ids) {
  const chunks = [];
  for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));

  const responses = await Promise.all(
    chunks.map((chunk) =>
      supabase
        .from('parts')
        .select('id,name,category,price,stock_qty,reserved_qty,low_stock_threshold,image_url,active')
        .in('id', chunk)
    )
  );

  let merged = [];
  for (const res of responses) {
    if (res.error) return { data: null, error: res.error };
    if (res.data) merged = merged.concat(res.data);
  }
  return { data: merged, error: null };
}

/**
 * Hook: resolves cart items into lines using live data from the parts table
 * (never part_costs or cost_price). Debounced refetch when items change.
 * If the saved login token is rejected (401), the broken local session is
 * cleared and the read is retried once as a visitor (parts are public).
 */
export function useCartLines() {
  const { items, setQty, removeItem } = useCart();
  const [partsData, setPartsData] = useState([]);
  const [fetchedKey, setFetchedKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadTick, setReloadTick] = useState(0);

  const idsKey = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.partId).filter(Boolean)))
        .sort()
        .join(','),
    [items]
  );

  useEffect(() => {
    if (idsKey === '') {
      setPartsData([]);
      setFetchedKey('');
      setLoading(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const ids = idsKey.split(',');
        let res = await fetchParts(ids);

        if (res.error && isAuthError(res.error)) {
          console.warn('[useCartLines] Session rejected, clearing it and retrying as visitor');
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            // ignore sign out errors
          }
          res = await fetchParts(ids);
        }

        if (cancelled) return;
        if (res.error) throw res.error;

        setPartsData(res.data);
        setFetchedKey(idsKey);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('[useCartLines] fetch error:', err);
        setError('We could not load your cart details. Please check your connection and try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [idsKey, reloadTick]);

  const ready = !error && fetchedKey === idsKey;

  const partsById = useMemo(() => {
    const map = new Map();
    for (const p of partsData) if (p && p.id) map.set(p.id, p);
    return map;
  }, [partsData]);

  const { lines, subtotal, hasIssues } = useMemo(
    () => buildCartLines(items, partsById, ready),
    [items, partsById, ready]
  );

  // Explicit "Fix cart": only acts on data that was really loaded.
  const fixCart = useCallback(() => {
    if (!ready) return;
    for (const line of lines) {
      if (!line.available) {
        removeItem(line.partId);
      } else if (line.isClamped && line.stockQty > 0) {
        setQty(line.partId, line.stockQty);
      }
    }
  }, [ready, lines, removeItem, setQty]);

  const retry = useCallback(() => setReloadTick((t) => t + 1), []);

  return { lines, subtotal, loading, error, hasIssues, fixCart, retry, ready };
}

export default useCartLines;
