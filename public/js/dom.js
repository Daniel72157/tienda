function applyProp(node, key, value) {
  if (key === 'class') {
    node.className = value;
  } else if (key === 'text') {
    node.textContent = value;
  } else if (key === 'dataset') {
    Object.assign(node.dataset, value);
  } else if (key.startsWith('on') && typeof value === 'function') {
    node.addEventListener(key.slice(2), value);
  } else {
    node.setAttribute(key, value === true ? '' : String(value));
  }
}

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined && value !== null && value !== false) {
      applyProp(node, key, value);
    }
  }
  for (const child of children.flat()) {
    if (child !== undefined && child !== null && child !== false) {
      node.append(child);
    }
  }
  return node;
}

export const qs = (selector, root = document) => root.querySelector(selector);

export const clear = (node) => node.replaceChildren();

const priceFormat = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const formatPrice = (value) => priceFormat.format(value);

export function formatDate(value) {
  const date = new Date(`${String(value).replace(' ', 'T')}Z`);
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function renderStars(rating) {
  const full = Math.round(rating);
  return el(
    'span',
    { class: 'stars', role: 'img', 'aria-label': `${rating.toFixed(1)} de 5 estrellas` },
    '★'.repeat(full) + '☆'.repeat(5 - full)
  );
}

export function debounce(callback, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  };
}

export function showToast(message, type = 'info') {
  const toast = el('div', { class: `toast toast-${type}`, role: 'status', text: message });
  qs('#toasts').append(toast);
  setTimeout(() => {
    toast.classList.add('leaving');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, 3200);
  setTimeout(() => toast.remove(), 4200);
}

export function openDialog(dialog) {
  if (!dialog.open) {
    dialog.showModal();
  }
}

export function closeDialog(dialog) {
  if (dialog.open) {
    dialog.close();
  }
}

export function bindDialogs() {
  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        dialog.close();
      }
    });
    for (const button of dialog.querySelectorAll('[data-close]')) {
      button.addEventListener('click', () => dialog.close());
    }
  }
}
