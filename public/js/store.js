const state = {
  user: null,
  cart: { items: [], count: 0, subtotal: 0, shipping: 0, total: 0, freeShippingFrom: 100 }
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((listener) => listener(state));
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
