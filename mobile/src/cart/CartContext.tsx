import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * specs/006-student-browse-cart-checkout research.md §1: the cart is
 * client-side only, no backend table/endpoint until POST /student/orders.
 * Home and Cart are separate screens/navigator entries (AppShell.tsx), so
 * the quantities have to live above both — HomeScreen previously kept this
 * in its own local useState, which only worked because Cart was a stub with
 * nothing to read it from.
 */
interface CartContextValue {
  quantities: Record<string, number>;
  setQuantity: (productId: string, quantity: number) => void;
  itemCount: number;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setQuantities((prev) => {
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[productId];
      } else {
        next[productId] = quantity;
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setQuantities({}), []);

  const itemCount = useMemo(() => Object.values(quantities).reduce((sum, q) => sum + q, 0), [quantities]);

  const value = useMemo(() => ({ quantities, setQuantity, itemCount, clear }), [quantities, setQuantity, itemCount, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider');
  }
  return ctx;
}
