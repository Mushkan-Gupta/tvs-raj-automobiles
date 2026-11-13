import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { useCart } from './CartContext';

/**
 * Hook to resolve raw cart items ({ partId, qty }) into rich displayable lines.
 * Fetches parts data directly from Supabase (NEVER reading part_costs or cost_price).
 *
 * Rules:
 *  - Missing part or active = false -> available = false, "No longer available", excluded from subtotal
 *  - stock_qty = 0 -> available = false, "Out of stock", excluded from subtotal
 *  - qty > stock_qty -> clamp displayed qty to stock_qty, show "Only N available"
 *  - Stored qty is NEVER modified during render.
 *  - Debounced refetching when items change.
 */
export function useCartLines() {
  const { items, setQty, removeItem } = useCart();
  const [partsData, setPartsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceTimerRef = useRef(null);

  // Debounced fetch of parts data
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const uniqueIds = Array.from(new Set(items.map((i) => i.partId).filter(Boolean)));

    if (uniqueIds.length === 0) {
      setPartsData([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        // Chunk requests into batches of 50 IDs
        const chunks = [];
        for (let i = 0; i < uniqueIds.length; i += 50) {
          chunks.push(uniqueIds.slice(i, i + 50));
        }

        const responses = await Promise.all(
          chunks.map((chunk) =>
            supabase
              .from('parts')
              .select('id,name,category,price,stock_qty,low_stock_threshold,image_url,active')
              .in('id', chunk)
          )
        );

        let merged = [];
        let queryError = null;

        for (const res of responses) {
          if (res.error) {
            queryError = res.error;
            break;
          }
          if (res.data) {
            merged = merged.concat(res.data);
          }
        }

        if (queryError) {
          throw queryError;
        }

        setPartsData(merged);
        setError(null);
      } catch (err) {
        console.error('[useCartLines] fetch error:', err);
        setError(err.message || 'Unable to load cart parts details');
      } finally {
        setLoading(false);
      }
    }, 120);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [items]);

  // Map parts data to id lookup
  const partsMap = useMemo(() => {
    const map = new Map();
    for (const p of partsData) {
      if (p && p.id) {
        map.set(p.id, p);
      }
    }
    return map;
  }, [partsData]);

  // Construct lines for display
  const lines = useMemo(() => {
    return items.map((item) => {
      const part = partsMap.get(item.partId);

      // 1. Part missing or inactive
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

      const stockQty = typeof part.stock_qty === 'number' ? Math.max(0, Math.floor(part.stock_qty)) : 0;
      const unitPrice = typeof part.price === 'number' ? part.price : Number(part.price) || 0;

      // 2. Out of stock
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

      // 3. Stored quantity exceeds current stock -> clamp displayed quantity
      if (item.qty > stockQty) {
        const displayedQty = stockQty;
        const lineTotal = unitPrice * displayedQty;
        return {
          partId: item.partId,
          part,
          qty: item.qty,
          displayedQty,
          available: true,
          isClamped: true,
          status: 'clamped',
          statusText: `Only ${stockQty} available`,
          lineTotal,
          stockQty,
        };
      }

      // 4. Normal available line
      const displayedQty = item.qty;
      const lineTotal = unitPrice * displayedQty;
      return {
        partId: item.partId,
        part,
        qty: item.qty,
        displayedQty,
        available: true,
        isClamped: false,
        status: 'ok',
        statusText: null,
        lineTotal,
        stockQty,
      };
    });
  }, [items, partsMap]);

  // Subtotal: sum of lineTotal for available lines only
  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      if (line.available) {
        return sum + line.lineTotal;
      }
      return sum;
    }, 0);
  }, [lines]);

  // Has unavailable or clamped lines
  const hasIssues = useMemo(() => {
    return lines.some((l) => !l.available || l.isClamped);
  }, [lines]);

  // Explicit "Fix cart" action requested by user
  const fixCart = useCallback(() => {
    for (const line of lines) {
      if (!line.available) {
        removeItem(line.partId);
      } else if (line.isClamped && line.stockQty > 0) {
        setQty(line.partId, line.stockQty);
      }
    }
  }, [lines, removeItem, setQty]);

  return {
    lines,
    subtotal,
    loading,
    error,
    hasIssues,
    fixCart,
  };
}

export default useCartLines;
