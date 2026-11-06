export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function extractMessage(isJson, payload) {
  if (isJson && payload && payload.error) {
    return payload.error;
  }
  if (typeof payload === 'string' && payload.length > 0 && payload.length < 160) {
    return payload;
  }
  return 'Ocurrió un error inesperado';
}

async function request(path, { method = 'GET', body } = {}) {
  const options = { method, headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(path, options);
  const isJson = (response.headers.get('content-type') || '').includes('application/json');
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiError(response.status, extractMessage(isJson, payload));
  }
  return payload;
}

export const api = {
  me: () => request('/api/me'),
  login: (username, password) => request('/login', { method: 'POST', body: { username, password } }),
  register: (username, password) => request('/register', { method: 'POST', body: { username, password } }),
  logout: () => request('/api/logout', { method: 'POST' }),

  categories: () => request('/api/categories'),
  products: (params) => request(`/api/products?${new URLSearchParams(params)}`),
  featured: () => request('/api/products/featured'),
  product: (id) => request(`/api/products/${id}`),
  review: (id, rating, comment) => request(`/api/products/${id}/reviews`, { method: 'POST', body: { rating, comment } }),

  cart: () => request('/api/cart'),
  addToCart: (productId, quantity = 1) => request('/api/cart/items', { method: 'POST', body: { productId, quantity } }),
  updateCartItem: (productId, quantity) => request(`/api/cart/items/${productId}`, { method: 'PATCH', body: { quantity } }),
  removeCartItem: (productId) => request(`/api/cart/items/${productId}`, { method: 'DELETE' }),

  checkout: (details) => request('/api/orders', { method: 'POST', body: details }),
  orders: () => request('/api/orders'),
  order: (id) => request(`/api/orders/${id}`),

  validateEmail: async (email) => (await request('/validate-email', { method: 'POST', body: { email } })) === 'valido'
};
