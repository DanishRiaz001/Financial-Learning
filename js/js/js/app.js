import { supabase } from './supabaseClient.js';
import { signIn, signOut, getSession, loadProfile, getProfile, isAdmin } from './auth.js';
import { renderHome } from './views/home.js';
import { renderAccounts } from './views/accounts.js';
import { renderCompanies } from './views/companies.js';
import { renderProcedures } from './views/procedures.js';
import { renderAdmin } from './views/admin.js';

const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const viewRoot = document.getElementById('view-root');
const sidebar = document.getElementById('sidebar');

const routes = {
  home: renderHome,
  accounts: renderAccounts,
  companies: renderCompanies,
  procedures: renderProcedures,
  admin: renderAdmin,
};

async function boot() {
  const session = await getSession();
  if (session) {
    await loadProfile(session.user.id);
    showApp(session.user.email);
  } else {
    showLogin();
  }
}

function showLogin() {
  loginScreen.hidden = false;
  appShell.hidden = true;
}

function showApp(email) {
  loginScreen.hidden = true;
  appShell.hidden = false;
  document.getElementById('user-email').textContent = email;
  document.getElementById('nav-admin').style.display = isAdmin() ? 'flex' : 'none';
  router();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit');

  errorEl.hidden = true;
  submitBtn.textContent = 'Signing in...';
  submitBtn.disabled = true;

  try {
    await signIn(email, password);
    showApp(email);
  } catch (err) {
    errorEl.textContent = err.message || 'Could not sign in. Check your email and password.';
    errorEl.hidden = false;
  } finally {
    submitBtn.textContent = 'Sign in';
    submitBtn.disabled = false;
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await signOut();
  window.location.hash = '';
  showLogin();
});

document.getElementById('global-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    window.location.hash = '#/accounts';
    // account search box picks up focus after route renders
    setTimeout(() => {
      const box = document.getElementById('accounts-search');
      if (box) { box.value = e.target.value; box.dispatchEvent(new Event('input')); }
    }, 50);
  }
});

async function router() {
  const hash = window.location.hash.replace('#/', '') || 'home';
  const [routeName, id] = hash.split('/');
  const renderFn = routes[routeName] || renderHome;

  sidebar.querySelectorAll('a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === routeName);
  });

  viewRoot.innerHTML = '';
  await renderFn(viewRoot, id ? { id } : undefined);
}

window.addEventListener('hashchange', router);

// keep the session in sync if the token refreshes or expires elsewhere
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') showLogin();
});

boot();
