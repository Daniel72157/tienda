import { api } from './api.js';
import { qs, showToast } from './dom.js';

export function initNewsletter() {
  const form = qs('#newsletter-form');
  const message = qs('#newsletter-msg');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = qs('#newsletter-email').value.trim();
    message.textContent = '';

    try {
      if (await api.validateEmail(email)) {
        form.reset();
        message.textContent = '¡Listo! Te avisaremos de las próximas novedades.';
        showToast('Suscripción registrada', 'success');
      } else {
        message.textContent = 'Revisa el formato de tu correo electrónico.';
      }
    } catch {
      message.textContent = 'No pudimos procesar tu solicitud. Inténtalo de nuevo.';
    }
  });
}
