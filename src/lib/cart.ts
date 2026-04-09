const CART_KEY = "rs_cart";

export type CartState = {
  address: string;
  distance: number;
  price: number;
  quantity: number;
  pitId: string;
  pitName: string;
  operatingDays: number[];
  satSurcharge: number;
  sameDayCutoff: string | null;
  savedAt: number;
};

export const saveCart = (cart: CartState) => {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
};

export const loadCart = (): CartState | null => {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return null;
    const cart = JSON.parse(raw) as CartState;
    // Expire after 24 hours
    if (Date.now() - cart.savedAt > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CART_KEY);
      return null;
    }
    return cart;
  } catch {
    return null;
  }
};

export const clearCart = () => localStorage.removeItem(CART_KEY);
