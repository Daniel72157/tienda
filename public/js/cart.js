import { api, ApiError } from './api.js';
import { el, qs, clear, formatPrice, showToast } from './dom.js';
import { getState, setState, subscribe } from './store.js';

const drawer = qs('#cart-drawer');
const scrim = qs('#scrim');
const badge = qs('#cart-badge');
let lastCount = 0;

export function openCart() {
  drawer.inert = false;
  drawer.classList.add('open');
  scrim.hidden = false;
  requestAnimationFrame(() => scrim.classList.add('visible'));
  document.body.classList.add('no-scroll');
  qs('.drawer-close', drawer).focus();
}

export function closeCart() {
  drawer.classList.remove('open');
  drawer.inert = true;
  scrim.classList.remove('visible');
  document.body.classList.remove('no-scroll');
  setTimeout(() => {
    if (!drawer.classList.contains('open')) {
      scrim.hidden = true;
    }
  }, 300);
}

async function runCartAction(action, successMessage) {
  try {
    const cart = await action();
    setState({ cart });
    if (successMessage) {
      showToast(successMessage, 'success');
    }
    return true;
  } catch (error) {
    showToast(error instanceof ApiError ? error.message : 'No se pudo actualizar el carrito', 'error');
    return false;
  }
}

export function addToCart(product) {
  return runCartAction(() => api.addToCart(product.id, 1), `${product.name} se añadió al carrito`);
}

function changeQuantity(item, quantity) {
  if (quantity <= 0) {
    return runCartAction(() => api.removeCartItem(item.id));
  }
  return runCartAction(() => api.updateCartItem(item.id, quantity));
}

function stepButton(label, ariaLabel, onclick, disabled = false) {
  return el('button', { type: 'button', 'aria-label': ariaLabel, onclick, disabled }, label);
}

function cartLine(item, index) {
  const line = el(
    'li',
    { class: 'cart-line' },
    el('span', { class: 'cart-thumb', 'aria-hidden': 'true' }, item.emoji),
    el(
      'div',
      { class: 'cart-info' },
      el('p', { class: 'cart-name', text: item.name }),
      el('p', { class: 'cart-price', text: formatPrice(item.price) }),
      el(
        'div',
        { class: 'stepper' },
        stepButton('−', `Quitar una unidad de ${item.name}`, () => changeQuantity(item, item.quantity - 1)),
        el('span', { class: 'stepper-value' }, String(item.quantity)),
        stepButton('+', `Agregar una unidad de ${item.name}`, () => changeQuantity(item, item.quantity + 1), item.quantity >= item.stock)
      )
    ),
    el(
      'div',
      { class: 'cart-line-end' },
      el('strong', { text: formatPrice(item.lineTotal) }),
      el('button', { class: 'link-btn', type: 'button', onclick: () => changeQuantity(item, 0) }, 'Quitar')
    )
  );
  line.style.animationDelay = `${index * 50}ms`;
  return line;
}

function emptyCart() {
  return el(
    'li',
    { class: 'empty-state' },
    el('span', { class: 'big', 'aria-hidden': 'true' }, '🛒'),
    el('p', { text: 'Tu carrito está vacío' }),
    el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: closeCart }, 'Seguir explorando')
  );
}

function renderShipping(cart) {
  const remaining = Math.max(0, cart.freeShippingFrom - cart.subtotal);
  const message = qs('#shipping-message');
  if (cart.items.length === 0) {
    message.textContent = `Envío gratis en compras desde ${formatPrice(cart.freeShippingFrom)}`;
  } else if (remaining === 0) {
    message.textContent = '¡Tienes envío gratis en este pedido!';
  } else {
    message.textContent = `Te faltan ${formatPrice(remaining)} para el envío gratis`;
  }
  const percent = Math.min(100, (cart.subtotal / cart.freeShippingFrom) * 100);
  qs('#shipping-fill').style.width = `${percent}%`;
}

function renderBadge(count) {
  badge.hidden = count === 0;
  badge.textContent = String(count);
  if (count !== lastCount) {
    badge.classList.remove('bump');
    requestAnimationFrame(() => badge.classList.add('bump'));
  }
  lastCount = count;
}

function renderCart({ cart }) {
  const list = qs('#cart-items');
  clear(list);
  if (cart.items.length === 0) {
    list.append(emptyCart());
  } else {
    cart.items.forEach((item, index) => list.append(cartLine(item, index)));
  }

  renderShipping(cart);
  qs('#cart-subtotal').textContent = formatPrice(cart.subtotal);
  qs('#cart-shipping').textContent = cart.shipping === 0 ? 'Gratis' : formatPrice(cart.shipping);
  qs('#cart-total').textContent = formatPrice(cart.total);
  qs('#btn-checkout').disabled = cart.items.length === 0;
  renderBadge(cart.count);
}

export function initCart() {
  qs('#btn-cart').addEventListener('click', openCart);
  qs('.drawer-close', drawer).addEventListener('click', closeCart);
  scrim.addEventListener('click', closeCart);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer.classList.contains('open')) {
      closeCart();
    }
  });

  qs('#btn-checkout').addEventListener('click', () => {
    closeCart();
    if (getState().user) {
      document.dispatchEvent(new CustomEvent('checkout:open'));
    } else {
      showToast('Inicia sesión para finalizar tu compra', 'info');
      document.dispatchEvent(new CustomEvent('auth:required'));
    }
  });

  subscribe(renderCart);
  renderCart(getState());
}
