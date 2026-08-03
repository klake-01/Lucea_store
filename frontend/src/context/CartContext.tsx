import React, {
  createContext, useContext, useState, useEffect, useCallback, useMemo, useRef
} from 'react';
import { fetchApi, ApiError } from '../lib/api';

export interface CartItem {
  id: string;
  variant_id: string;
  quantity: number;
  config_text?: string;
  unit_price_cents: number;
  item_total_cents: number;
  variant_sku?: string;
  product_name?: string;
  product_image?: string;
}

export interface CartState {
  id: string;
  items: CartItem[];
  subtotal_cents: number;
  delivery_charge_cents: number;
  discount_cents: number;
  total_cents: number;
  voucher_code?: string;
}

interface CartContextType {
  cart: CartState | null;
  isOpen: boolean;
  /** Number of units across all lines, used by the header badge. */
  itemCount: number;
  busy: boolean;
  error: string | null;
  /** Delivery city, drives the shipping charge computed by the API. */
  city: string;
  voucherCode: string | null;
  openCart: () => void;
  closeCart: () => void;
  setCity: (city: string) => void;
  addToCart: (variantId: string, quantity?: number, configText?: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  applyVoucher: (code: string) => Promise<void>;
  clearVoucher: () => Promise<void>;
  refreshCart: () => Promise<void>;
  clearCart: () => void;
  dismissError: () => void;
}

const CART_ID_KEY = 'lucea_cart_id';
const CITY_KEY = 'lucea_cart_city';
const VOUCHER_KEY = 'lucea_cart_voucher';

const CartContext = createContext<CartContextType | undefined>(undefined);

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode, cart stays in memory for this session */
  }
};

let cartCreationPromise: Promise<string> | null = null;

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartState | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [city, setCityState] = useState<string>(() => readStorage(CITY_KEY) || 'Casablanca');
  const [voucherCode, setVoucherCode] = useState<string | null>(() => readStorage(VOUCHER_KEY));

  // Kept in a ref so callbacks stay stable while still reading fresh values
  const contextRef = useRef({ city, voucherCode });
  contextRef.current = { city, voucherCode };

  const pricingQuery = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams({ city: contextRef.current.city, ...extra });
    if (contextRef.current.voucherCode) {
      params.set('voucher_code', contextRef.current.voucherCode);
    }
    return params.toString();
  }, []);

  const handleError = useCallback((err: unknown) => {
    const message =
      err instanceof ApiError || err instanceof Error
        ? err.message
        : 'Une erreur est survenue. Merci de reessayer.';
    setError(message);
  }, []);

  const refreshCart = useCallback(async () => {
    const cartId = readStorage(CART_ID_KEY);
    if (!cartId) {
      setCart(null);
      return;
    }
    try {
      const res = await fetchApi(`/cart/${cartId}?${pricingQuery()}`, { auth: false });
      setCart(res);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // The cart was consumed by an order or expired server side
        writeStorage(CART_ID_KEY, null);
        setCart(null);
        return;
      }
      handleError(err);
    }
  }, [pricingQuery, handleError]);

  // On boot, only load a cart that already exists. Creating one eagerly would
  // mint an empty cart row on every visit, including admin page loads.
  useEffect(() => {
    if (readStorage(CART_ID_KEY)) {
      refreshCart();
    }
  }, [refreshCart]);

  const ensureCartId = useCallback(async (): Promise<string> => {
    const existing = readStorage(CART_ID_KEY);
    if (existing) return existing;

    if (cartCreationPromise) {
      return cartCreationPromise;
    }

    cartCreationPromise = (async () => {
      try {
        const created = await fetchApi('/cart', { method: 'POST', auth: false });
        if (!created?.id) throw new Error('Creation du panier impossible.');
        writeStorage(CART_ID_KEY, created.id);
        return created.id;
      } finally {
        cartCreationPromise = null;
      }
    })();

    return cartCreationPromise;
  }, []);

  const addToCart = useCallback(
    async (variantId: string, quantity = 1, configText?: string) => {
      setBusy(true);
      setError(null);
      try {
        const cartId = await ensureCartId();
        const updated = await fetchApi(
          `/cart/items?${pricingQuery({ cart_id: cartId })}`,
          {
            method: 'POST',
            auth: false,
            body: JSON.stringify({
              variant_id: variantId,
              quantity,
              config_text: configText || null,
            }),
          }
        );
        setCart(updated);
        setIsOpen(true);
      } catch (err) {
        handleError(err);
      } finally {
        setBusy(false);
      }
    },
    [ensureCartId, pricingQuery, handleError]
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      setBusy(true);
      setError(null);
      try {
        if (quantity <= 0) {
          const updated = await fetchApi(`/cart/items/${itemId}?${pricingQuery()}`, {
            method: 'DELETE',
            auth: false,
          });
          setCart(updated);
        } else {
          const updated = await fetchApi(`/cart/items/${itemId}?${pricingQuery()}`, {
            method: 'PATCH',
            auth: false,
            body: JSON.stringify({ quantity }),
          });
          setCart(updated);
        }
      } catch (err) {
        handleError(err);
        // Pull the authoritative state back so the UI never shows a phantom quantity
        await refreshCart();
      } finally {
        setBusy(false);
      }
    },
    [pricingQuery, handleError, refreshCart]
  );

  const removeFromCart = useCallback(
    async (itemId: string) => {
      setBusy(true);
      setError(null);
      try {
        const updated = await fetchApi(`/cart/items/${itemId}?${pricingQuery()}`, {
          method: 'DELETE',
          auth: false,
        });
        setCart(updated);
      } catch (err) {
        handleError(err);
        await refreshCart();
      } finally {
        setBusy(false);
      }
    },
    [pricingQuery, handleError, refreshCart]
  );

  const applyVoucher = useCallback(
    async (code: string) => {
      const cartId = readStorage(CART_ID_KEY);
      const cleaned = code.trim().toUpperCase();
      if (!cartId || !cleaned) return;

      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          city: contextRef.current.city,
          voucher_code: cleaned,
        });
        const res = await fetchApi(`/cart/${cartId}?${params.toString()}`, { auth: false });
        setCart(res);

        if (res?.voucher_code) {
          setVoucherCode(res.voucher_code);
          writeStorage(VOUCHER_KEY, res.voucher_code);
        } else {
          // The API returns the cart unchanged when the code is unknown,
          // expired or fully used up.
          setVoucherCode(null);
          writeStorage(VOUCHER_KEY, null);
          setError(`Le code ${cleaned} n est pas valide ou a expire.`);
        }
      } catch (err) {
        handleError(err);
      } finally {
        setBusy(false);
      }
    },
    [handleError]
  );

  const clearVoucher = useCallback(async () => {
    setVoucherCode(null);
    writeStorage(VOUCHER_KEY, null);
    const cartId = readStorage(CART_ID_KEY);
    if (!cartId) return;
    try {
      const res = await fetchApi(
        `/cart/${cartId}?city=${encodeURIComponent(contextRef.current.city)}`,
        { auth: false }
      );
      setCart(res);
    } catch (err) {
      handleError(err);
    }
  }, [handleError]);

  const setCity = useCallback((nextCity: string) => {
    setCityState(nextCity);
    writeStorage(CITY_KEY, nextCity);
  }, []);

  // Shipping depends on the city, so re prices the cart whenever it changes
  const firstCityRun = useRef(true);
  useEffect(() => {
    if (firstCityRun.current) {
      firstCityRun.current = false;
      return;
    }
    if (readStorage(CART_ID_KEY)) refreshCart();
  }, [city, refreshCart]);

  const clearCart = useCallback(() => {
    writeStorage(CART_ID_KEY, null);
    writeStorage(VOUCHER_KEY, null);
    setVoucherCode(null);
    setCart(null);
    setIsOpen(false);
  }, []);

  const itemCount = useMemo(
    () => cart?.items.reduce((acc, item) => acc + item.quantity, 0) ?? 0,
    [cart]
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        isOpen,
        itemCount,
        busy,
        error,
        city,
        voucherCode,
        openCart: () => setIsOpen(true),
        closeCart: () => setIsOpen(false),
        setCity,
        addToCart,
        updateQuantity,
        removeFromCart,
        applyVoucher,
        clearVoucher,
        refreshCart,
        clearCart,
        dismissError: () => setError(null),
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
