import { el, qs, openDialog, formatPrice } from './dom.js';

function renderResults(container, data) {
  const items = data.results.map((product) =>
    el(
      'li',
      {},
      el('span', { text: `${product.emoji} ${product.name}` }),
      el('strong', { text: formatPrice(product.price) })
    )
  );
  const body = items.length > 0 ? el('ul', {}, ...items) : el('p', { class: 'muted', text: 'No hay coincidencias.' });
  container.replaceChildren(el('h3', { text: `Resultados para: ${data.query}` }), body);
}

export function initSearch() {
  const dialog = qs('#search-dialog');
  const form = qs('#search-form');
  const input = qs('#search-input');
  const results = qs('#search-results');

  qs('#btn-search').addEventListener('click', () => {
    openDialog(dialog);
    input.focus();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const response = await fetch(`/search?q=${encodeURIComponent(input.value)}`);
      renderResults(results, await response.json());
    } catch {
      results.replaceChildren(el('p', { class: 'form-error', text: 'No pudimos completar la búsqueda.' }));
    }
  });
}
