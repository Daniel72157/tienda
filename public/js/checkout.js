import { api, ApiError } from './api.js';
import { el, qs, clear, formatPrice, formatDate, openDialog } from './dom.js';
import { getState, setState } from './store.js';

const checkoutDialog = qs('#checkout-dialog');
const ordersDialog = qs('#orders-dialog');
const form = qs('#checkout-form');
const errorBox = qs('#checkout-error');
const submit = qs('#checkout-submit');

function renderSummary() {
  const { cart } = getState();
  const list = qs('#checkout-summary');
  clear(list);
  for (const item of cart.items) {
    list.append(
      el('li', {}, el('span', { text: `${item.quantity} × ${item.name}` }), el('span', { text: formatPrice(item.lineTotal) }))
    );
  }
  list.append(el('li', {}, el('span', { text: 'Envío' }), el('span', { text: cart.shipping === 0 ? 'Gratis' : formatPrice(cart.shipping) })));
  qs('#checkout-total').textContent = formatPrice(cart.total);
}

function burstConfetti() {
  const container = qs('#confetti');
  clear(container);
  for (let index = 0; index < 36; index += 1) {
    const seed = Math.abs(Math.sin((index + 1) * 12.9898) * 43758.5453) % 1;
    const piece = el('span', { class: 'confetti-piece' });
    piece.style.setProperty('--x', `${Math.round((seed - 0.5) * 380)}px`);
    piece.style.setProperty('--y', `${-60 - ((index * 37) % 100)}px`);
    piece.style.setProperty('--r', `${(index * 47) % 360}deg`);
    piece.style.setProperty('--delay', `${(index % 6) * 40}ms`);
    container.append(piece);
  }
}

function showCheckoutForm() {
  qs('#checkout-view').hidden = false;
  qs('#success-view').hidden = true;
  errorBox.textContent = '';
  renderSummary();
  openDialog(checkoutDialog);
}

function showSuccess(order) {
  qs('#checkout-view').hidden = true;
  qs('#success-view').hidden = false;
  qs('#success-text').textContent = `Tu pedido #${order.id} por ${formatPrice(order.total)} fue registrado. Lo enviaremos a ${order.city}.`;
  burstConfetti();
}

async function handleCheckout(event) {
  event.preventDefault();
  const data = new FormData(form);
  const details = {
    fullName: String(data.get('fullName')).trim(),
    address: String(data.get('address')).trim(),
    city: String(data.get('city')).trim()
  };
  if (!details.fullName || !details.address || !details.city) {
    errorBox.textContent = 'Completa todos los datos de envío';
    return;
  }

  submit.disabled = true;
  errorBox.textContent = '';
  try {
    const order = await api.checkout(details);
    setState({ cart: await api.cart() });
    form.reset();
    showSuccess(order);
    document.dispatchEvent(new CustomEvent('catalog:refresh'));
  } catch (error) {
    errorBox.textContent = error instanceof ApiError ? error.message : 'No se pudo registrar el pedido';
  } finally {
    submit.disabled = false;
  }
}

function orderDetail(order) {
  return el(
    'div',
    {},
    el('ul', {}, ...order.items.map((item) => el('li', {}, el('span', { text: `${item.quantity} × ${item.name}` }), el('span', { text: formatPrice(item.line_total) })))),
    el('p', { class: 'muted small', text: `Envío a: ${order.address}, ${order.city}` })
  );
}

function orderRow(order) {
  const detail = el('div', { class: 'order-detail', text: 'Cargando…' });
  const row = el(
    'details',
    { class: 'order' },
    el(
      'summary',
      {},
      el('span', {}, el('strong', { text: `Pedido #${order.id}` }), el('span', { class: 'muted small', text: ` · ${formatDate(order.created_at)} · ${order.item_count} uds.` })),
      el('span', { class: 'pill', text: order.status }),
      el('strong', { text: formatPrice(order.total) })
    ),
    detail
  );
  row.addEventListener('toggle', async () => {
    if (!row.open || row.dataset.loaded) {
      return;
    }
    row.dataset.loaded = 'true';
    try {
      detail.replaceChildren(orderDetail(await api.order(order.id)));
    } catch {
      detail.textContent = 'No pudimos cargar el detalle de este pedido.';
    }
  });
  return row;
}

async function showOrders() {
  const list = qs('#orders-list');
  list.replaceChildren(el('p', { class: 'muted', text: 'Cargando…' }));
  openDialog(ordersDialog);
  try {
    const orders = await api.orders();
    list.replaceChildren(...(orders.length > 0 ? orders.map(orderRow) : [el('p', { class: 'muted', text: 'Todavía no tienes pedidos.' })]));
  } catch {
    list.replaceChildren(el('p', { class: 'form-error', text: 'No pudimos cargar tus pedidos.' }));
  }
}

export function initCheckout() {
  document.addEventListener('checkout:open', showCheckoutForm);
  document.addEventListener('orders:open', showOrders);
  form.addEventListener('submit', handleCheckout);
}
