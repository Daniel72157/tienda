import { api, ApiError } from './api.js';
import { qs, openDialog, closeDialog, showToast } from './dom.js';
import { getState, setState, subscribe } from './store.js';

const authDialog = qs('#auth-dialog');
const accountDialog = qs('#account-dialog');
const form = qs('#auth-form');
const errorBox = qs('#auth-error');
const submit = qs('#auth-submit');
let mode = 'login';

export async function refreshSession() {
  const [me, cart] = await Promise.all([api.me(), api.cart()]);
  setState({ user: me.authenticated ? me.user : null, cart });
}

function setMode(nextMode) {
  mode = nextMode;
  for (const tab of document.querySelectorAll('#auth-tabs .tab')) {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  }
  submit.textContent = mode === 'login' ? 'Ingresar' : 'Crear cuenta';
  form.elements.password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  errorBox.textContent = '';
}

function validate(username, secret) {
  if (username.length < 3) {
    return 'El usuario debe tener al menos 3 caracteres';
  }
  if (mode === 'register' && secret.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres';
  }
  if (secret.length === 0) {
    return 'Escribe tu contraseña';
  }
  return '';
}

async function handleSubmit(event) {
  event.preventDefault();
  const data = new FormData(form);
  const username = String(data.get('username')).trim();
  const secret = String(data.get('password'));

  const problem = validate(username, secret);
  if (problem) {
    errorBox.textContent = problem;
    return;
  }

  submit.disabled = true;
  errorBox.textContent = '';
  try {
    if (mode === 'register') {
      await api.register(username, secret);
    }
    await api.login(username, secret);
    await refreshSession();
    form.reset();
    closeDialog(authDialog);
    showToast(`¡Hola, ${username}!`, 'success');
  } catch (error) {
    errorBox.textContent = error instanceof ApiError ? error.message : 'No se pudo completar la solicitud';
  } finally {
    submit.disabled = false;
  }
}

async function handleLogout() {
  try {
    await api.logout();
    setState({ user: null, cart: await api.cart() });
    closeDialog(accountDialog);
    showToast('Cerraste sesión', 'info');
  } catch {
    showToast('No se pudo cerrar la sesión', 'error');
  }
}

function renderAccountButton({ user }) {
  qs('#btn-account').textContent = user ? user.username : 'Ingresar';
  qs('#account-name').textContent = user ? `Sesión iniciada como ${user.username}` : '';
}

export function initAuth() {
  qs('#btn-account').addEventListener('click', () => {
    openDialog(getState().user ? accountDialog : authDialog);
  });
  document.addEventListener('auth:required', () => {
    setMode('login');
    openDialog(authDialog);
  });

  for (const tab of document.querySelectorAll('#auth-tabs .tab')) {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  }
  form.addEventListener('submit', handleSubmit);
  qs('#btn-logout').addEventListener('click', handleLogout);
  qs('#btn-orders').addEventListener('click', () => {
    closeDialog(accountDialog);
    document.dispatchEvent(new CustomEvent('orders:open'));
  });

  subscribe(renderAccountButton);
  renderAccountButton(getState());
}
