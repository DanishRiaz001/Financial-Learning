import { supabase } from '../supabaseClient.js';
import { getProfile } from '../auth.js';

export async function renderHome(root) {
  root.innerHTML = `<p class="muted">Loading your dashboard...</p>`;

  const [accountsCount, companiesCount, proceduresCount, recentEntries] = await Promise.all([
    supabase.from('accounts').select('id', { count: 'exact', head: true }),
    supabase.from('companies').select('id', { count: 'exact', head: true }),
    supabase.from('procedures').select('id', { count: 'exact', head: true }),
    supabase.from('knowledge_entries').select('*').order('created_at', { ascending: false }).limit(5),
  ]);

  const profile = getProfile();
  const firstName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'there';

  const activityHtml = (recentEntries.data || []).length
    ? recentEntries.data.map(e => `
        <div class="list-item">
          <div>${escapeHtml(e.title)}</div>
          <div class="muted small" style="margin-top:2px;">${e.category.replace('_',' ')} - ${timeAgo(e.created_at)}</div>
        </div>
      `).join('')
    : `<div class="empty-state"><h3>Nothing logged yet.</h3><p>Add a law, trend, or note from the knowledge log to see it here.</p></div>`;

  root.innerHTML = `
    <h1>Welcome back, ${escapeHtml(firstName)}</h1>
    <p class="muted">Here is what has changed since your last visit.</p>

    <div class="stat-grid">
      <div class="stat-card"><div class="muted small">Accounts</div><div class="value">${accountsCount.count ?? 0}</div></div>
      <div class="stat-card"><div class="muted small">Companies</div><div class="value">${companiesCount.count ?? 0}</div></div>
      <div class="stat-card"><div class="muted small">Procedures</div><div class="value">${proceduresCount.count ?? 0}</div></div>
      <div class="stat-card"><div class="muted small">Knowledge log entries</div><div class="value">${recentEntries.data?.length ?? 0}</div></div>
    </div>

    <div class="section-label">Recent activity</div>
    ${activityHtml}
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}
