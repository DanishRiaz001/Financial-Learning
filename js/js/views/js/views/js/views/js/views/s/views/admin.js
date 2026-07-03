import { supabase } from '../supabaseClient.js';
import { isAdmin } from '../auth.js';

export async function renderAdmin(root) {
  if (!isAdmin()) {
    root.innerHTML = `<div class="empty-state"><h3>Admin access only.</h3><p>This section is restricted to admin users.</p></div>`;
    return;
  }

  root.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <h1>Users</h1>
        <p class="muted">Invite new users, manage roles, and deactivate access.</p>
      </div>
      <button class="btn-ghost" id="invite-btn">Invite user</button>
    </div>
    <div id="users-list" style="margin-top:20px;"><p class="muted">Loading users...</p></div>
  `;

  root.querySelector('#invite-btn').addEventListener('click', () => showInviteModal(root));
  loadUsers(root);
}

async function loadUsers(root) {
  const listEl = root.querySelector('#users-list');
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) { listEl.innerHTML = `<p class="error-text">${error.message}</p>`; return; }

  listEl.innerHTML = `
    <table>
      <thead><tr><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${data.map(u => `
          <tr>
            <td>${escapeHtml(u.email)}</td>
            <td>
              <select data-id="${u.id}" class="role-select" style="width:auto;">
                ${['admin','senior','learner','viewer'].map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('')}
              </select>
            </td>
            <td><span class="badge ${u.is_active ? 'badge-low' : 'badge-high'}">${u.is_active ? 'Active' : 'Deactivated'}</span></td>
            <td><button class="btn-ghost small toggle-active" data-id="${u.id}" data-active="${u.is_active}">${u.is_active ? 'Deactivate' : 'Reactivate'}</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  listEl.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      await supabase.from('profiles').update({ role: sel.value }).eq('id', sel.dataset.id);
    });
  });

  listEl.querySelectorAll('.toggle-active').forEach(btn => {
    btn.addEventListener('click', async () => {
      const newState = btn.dataset.active !== 'true';
      await supabase.from('profiles').update({ is_active: newState }).eq('id', btn.dataset.id);
      loadUsers(root);
    });
  });
}

function showInviteModal(root) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h2>Invite user</h2>
      <p class="muted small" style="margin-top:8px;">
        This calls the invite-user edge function (see supabase/functions/invite-user).
        Deploy that function first — see the README for the one-time setup command.
      </p>
      <form id="invite-form">
        <label>Email</label>
        <input type="email" id="invite-email" required />
        <label>Role</label>
        <select id="invite-role">
          <option value="learner">learner</option>
          <option value="senior">senior</option>
          <option value="viewer">viewer</option>
          <option value="admin">admin</option>
        </select>
        <div style="display:flex; gap:10px; margin-top:20px;">
          <button type="button" class="btn-ghost" id="cancel-invite">Cancel</button>
          <button type="submit" class="btn-primary" style="margin-top:0;">Send invite</button>
        </div>
        <p id="invite-error" class="error-text" hidden></p>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancel-invite').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#invite-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = overlay.querySelector('#invite-email').value.trim();
    const role = overlay.querySelector('#invite-role').value;
    const errEl = overlay.querySelector('#invite-error');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('invite-user', {
        body: { email, role },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      if (res.error) throw res.error;
      overlay.remove();
      loadUsers(root);
    } catch (err) {
      errEl.textContent = err.message || 'Could not send invite. Is the edge function deployed?';
      errEl.hidden = false;
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
