import { api } from './api.js';
import { el, qs, clear, formatPrice, formatDate, renderStars, showToast, openDialog, closeDialog, debounce } from './dom.js';
import { getState } from './store.js';
import { addToCart } from './cart.js';

const PAGE_SIZE = 8;
const query = { category: '', sort: 'relevance', q: '', page: 1 };

function stockBadge(product) {
  if (product.stock === 0) {
    return el('span', { class: 'pill pill-danger' }, 'Agotado');
  }
  if (product.stock <= 5) {
    return el('span', { class: 'pill pill-warning' }, `Quedan ${product.stock}`);
  }
  return null;
}

function productCard(product, index) {
  const soldOut = product.stock === 0;
  const open = () => openProduct(product.id);
  const card = el(
    'article',
    { class: 'card' },
    el(
      'button',
      { class: 'card-thumb', type: 'button', 'data-cat': product.category_slug, 'aria-label': `Ver detalles de ${product.name}`, onclick: open },
      el('span', { class: 'emoji', 'aria-hidden': 'true' }, product.emoji),
      stockBadge(product)
    ),
    el(
      'div',
      { class: 'card-body' },
      el('p', { class: 'card-category', text: product.category }),
      el('h3', { class: 'card-title' }, el('button', { class: 'link-reset', type: 'button', onclick: open, text: product.name })),
      el('div', { class: 'card-rating' }, renderStars(product.rating), el('span', { class: 'muted', text: product.rating.toFixed(1) })),
      el(
        'div',
        { class: 'card-footer' },
        el('strong', { class: 'price', text: formatPrice(product.price) }),
        el('button', { class: 'btn btn-primary btn-sm', type: 'button', disabled: soldOut, onclick: () => addToCart(product), text: soldOut ? 'Sin stock' : 'Agregar' })
      )
    )
  );
  card.style.setProperty('--i', String(index));
  return card;
}

function messageState(icon, text, action) {
  return el(
    'div',
    { class: 'empty-state' },
    el('span', { class: 'big', 'aria-hidden': 'true' }, icon),
    el('p', { text }),
    action
  );
}

function skeletons(count) {
  return Array.from({ length: count }, () => el('div', { class: 'skeleton', 'aria-hidden': 'true' }));
}

function pageButton(label, page, { disabled = false, current = false } = {}) {
  return el('button', {
    class: 'page-btn',
    type: 'button',
    disabled,
    'aria-current': current ? 'page' : false,
    'aria-label': current ? `Página ${label}, actual` : `Ir a ${typeof label === 'number' ? `la página ${label}` : label}`,
    onclick: () => {
      query.page = page;
      void loadProducts();
      qs('#catalogo').scrollIntoView({ behavior: 'smooth' });
    },
    text: String(label)
  });
}

function renderPagination({ page, totalPages }) {
  const nav = qs('#pagination');
  clear(nav);
  if (totalPages <= 1) {
    return;
  }
  nav.append(pageButton('Anterior', page - 1, { disabled: page === 1 }));
  for (let number = 1; number <= totalPages; number += 1) {
    nav.append(pageButton(number, number, { current: number === page }));
  }
  nav.append(pageButton('Siguiente', page + 1, { disabled: page === totalPages }));
}

async function loadProducts() {
  const grid = qs('#product-grid');
  grid.setAttribute('aria-busy', 'true');
  grid.replaceChildren(...skeletons(PAGE_SIZE));

  try {
    const params = { page: query.page, pageSize: PAGE_SIZE, sort: query.sort };
    if (query.category) {
      params.category = query.category;
    }
    if (query.q) {
      params.q = query.q;
    }
    const result = await api.products(params);

    qs('#result-count').textContent = `${result.total} ${result.total === 1 ? 'producto' : 'productos'}`;
    if (result.items.length === 0) {
      grid.replaceChildren(messageState('🔎', 'No encontramos productos con esos filtros'));
    } else {
      grid.replaceChildren(...result.items.map(productCard));
    }
    renderPagination(result);
  } catch {
    const retry = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: loadProducts }, 'Reintentar');
    grid.replaceChildren(messageState('⚠️', 'No pudimos cargar el catálogo', retry));
  } finally {
    grid.setAttribute('aria-busy', 'false');
  }
}

async function loadFeatured() {
  try {
    const items = await api.featured();
    qs('#featured-grid').replaceChildren(...items.map(productCard));
  } catch {
    qs('#featured-grid').replaceChildren(messageState('⚠️', 'No pudimos cargar los destacados'));
  }
}

async function renderCategories() {
  const chips = qs('#category-chips');
  const categories = await api.categories();
  const total = categories.reduce((sum, category) => sum + category.total, 0);
  const options = [{ slug: '', name: 'Todos', total }, ...categories];

  const buttons = options.map((option) =>
    el(
      'button',
      {
        class: 'chip',
        type: 'button',
        'aria-pressed': String(option.slug === query.category),
        onclick: () => {
          query.category = option.slug;
          query.page = 1;
          buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(options[index].slug === option.slug)));
          void loadProducts();
        }
      },
      option.name,
      el('small', { text: `(${option.total})` })
    )
  );
  chips.replaceChildren(...buttons);
}

function reviewItem(review) {
  return el(
    'article',
    { class: 'review' },
    el('div', { class: 'review-head' }, el('strong', { text: review.author }), renderStars(review.rating), el('span', { class: 'muted small', text: formatDate(review.created_at) })),
    el('p', { text: review.comment })
  );
}

function reviewForm(product, body) {
  if (!getState().user) {
    return el(
      'div',
      { class: 'review-form' },
      el('p', { class: 'muted', text: 'Inicia sesión para dejar tu opinión.' }),
      el(
        'button',
        {
          class: 'btn btn-ghost btn-sm',
          type: 'button',
          onclick: () => {
            closeDialog(qs('#product-dialog'));
            document.dispatchEvent(new CustomEvent('auth:required'));
          }
        },
        'Ingresar'
      )
    );
  }

  const select = el(
    'select',
    { name: 'rating', required: true },
    el('option', { value: '' }, 'Elige una calificación'),
    ...[5, 4, 3, 2, 1].map((value) => el('option', { value: String(value) }, `${'★'.repeat(value)} (${value})`))
  );
  const comment = el('textarea', { name: 'comment', maxlength: '400', required: true, placeholder: 'Cuéntanos qué te pareció' });
  const error = el('p', { class: 'form-error', role: 'alert' });

  const form = el(
    'form',
    {
      class: 'review-form',
      novalidate: true,
      onsubmit: async (event) => {
        event.preventDefault();
        if (!select.value || comment.value.trim().length < 3) {
          error.textContent = 'Elige una calificación y escribe un comentario';
          return;
        }
        try {
          const updated = await api.review(product.id, Number(select.value), comment.value.trim());
          renderProductDetail(body, updated);
          showToast('¡Gracias por tu reseña!', 'success');
          void loadProducts();
          void loadFeatured();
        } catch (failure) {
          error.textContent = failure.message;
        }
      }
    },
    el('label', { class: 'field' }, el('span', {}, 'Tu calificación'), select),
    el('label', { class: 'field' }, el('span', {}, 'Tu comentario'), comment),
    error,
    el('button', { class: 'btn btn-primary btn-sm', type: 'submit' }, 'Publicar reseña')
  );
  return form;
}

function renderProductDetail(body, product) {
  const soldOut = product.stock === 0;
  const reviews = product.reviews.length > 0 ? product.reviews.map(reviewItem) : [el('p', { class: 'muted', text: 'Aún no hay reseñas. ¡Sé la primera persona en opinar!' })];

  body.replaceChildren(
    el(
      'div',
      { class: 'product-detail' },
      el('div', { class: 'product-visual', 'aria-hidden': 'true' }, product.emoji),
      el(
        'div',
        { class: 'product-info' },
        el('p', { class: 'card-category', text: product.category }),
        el('h2', { text: product.name }),
        el('div', { class: 'card-rating' }, renderStars(product.rating), el('span', { class: 'muted', text: `${product.rating.toFixed(1)} · ${product.reviews.length} reseñas` })),
        el('p', { class: 'muted', text: product.description }),
        el('p', { class: 'product-price', text: formatPrice(product.price) }),
        stockBadge(product),
        el('button', { class: 'btn btn-primary', type: 'button', disabled: soldOut, onclick: () => addToCart(product), text: soldOut ? 'Sin stock' : 'Agregar al carrito' })
      )
    ),
    el('section', { class: 'reviews' }, el('h3', { text: 'Reseñas' }), ...reviews, reviewForm(product, body))
  );
}

async function openProduct(id) {
  const body = qs('#product-dialog-body');
  body.replaceChildren(el('p', { class: 'muted', text: 'Cargando…' }));
  openDialog(qs('#product-dialog'));
  try {
    renderProductDetail(body, await api.product(id));
  } catch {
    body.replaceChildren(el('p', { class: 'form-error', text: 'No pudimos cargar este producto.' }));
  }
}

export async function initCatalog() {
  qs('#sort-select').addEventListener('change', (event) => {
    query.sort = event.target.value;
    query.page = 1;
    void loadProducts();
  });
  qs('#filter-input').addEventListener(
    'input',
    debounce((event) => {
      query.q = event.target.value.trim();
      query.page = 1;
      void loadProducts();
    }, 300)
  );
  document.addEventListener('catalog:refresh', () => {
    void loadProducts();
    void loadFeatured();
  });

  await renderCategories().catch(() => showToast('No pudimos cargar las categorías', 'error'));
  await Promise.all([loadFeatured(), loadProducts()]);
}
