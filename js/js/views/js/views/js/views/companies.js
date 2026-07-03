import { supabase } from '../supabaseClient.js';
import { hasRole, getProfile } from '../auth.js';

export async function renderCompanies(root, params) {
  if (params?.id) return renderCompanyDetail(root, params.id);

  const canWrite = hasRole('senior');

  root.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <h1>Companies</h1>
        <p class="muted">Search for a company to see its accounts and invoice contact.</p>
      </div>
      ${canWrite ? `<button class="btn-ghost" id="add-company-btn">Add company</button>` : ''}
    </div>
    <div class="toolbar" style="margin-top:20px;">
      <input type="search" id="company-search" placeholder="Search by company name or org number" />
    </div>
    <div id="company-list"><p class="muted">Loading companies...</p></div>
  `;

  if (!canWrite) {
    root.querySelector('#company-list').innerHTML = `
      <div class="empty-state"><h3>Companies are restricted.</h3>
      <p>Invoice contact details are only visible to senior and admin users. Ask your admin for access if you need this.</p></div>`;
    return;
  }

  root.querySelector('#company-search').addEventListener('input', debounce(() => loadList(root), 300));
  root.querySelector('#add-company-btn')?.addEventListener('click', () => showAddCompanyModal(root));
  loadList(root);
}

async function loadList(root) {
  const listEl = root.querySelector('#company-list');
  const term = root.querySelector('#company-search').value.trim();

  let query = supabase.from('companies').select('id, name, org_number, industry').eq('is_active', true).order('name');
  if (term) query = query.or(`name.ilike.%${term}%,org_number.ilike.%${term}%`);

  const { data, error } = await query.limit(100);
  if (error) { listEl.innerHTML = `<p class="error-text">${error.message}</p>`; return; }
  if (!data.length) { listEl.innerHTML = `<div class="empty-state"><h3>No companies found.</h3><p>Add one to get started.</p></div>`; return; }

  listEl.innerHTML = `
    <table>
      <thead><tr><th>Company</th><th>Org number</th><th>Industry</th></tr></thead>
      <tbody>
        ${data.map(c => `
          <tr class="row-link" data-id="${c.id}">
            <td>${escapeHtml(c.name)}</td>
            <td class="muted">${escapeHtml(c.org_number || '-')}</td>
            <td class="muted">${escapeHtml(c.industry || '-')}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  listEl.querySelectorAll('tr.row-link').forEach(row => {
    row.addEventListener('click', () => { window.location.hash = `#/companies/${row.dataset.id}`; });
  });
}

async function renderCompanyDetail(root, companyId) {
  root.innerHTML = `<p class="muted">Loading company...</p>`;

  const [companyRes, contactsRes, accountsRes] = await Promise.all([
    supabase.from('companies').select('*').eq('id', companyId).single(),
    supabase.from('company_contacts').select('*').eq('company_id', companyId),
    supabase.from('company_effective_accounts').select('*').eq('company_id', companyId),
  ]);

  if (companyRes.error || !companyRes.data) {
    root.innerHTML = `<p class="error-text">Company not found.</p><a href="#/companies">Back to companies</a>`;
    return;
  }
  const c = companyRes.data;
  const invoiceContact = (contactsRes.data || []).find(x => x.contact_type === 'invoice');

  root.innerHTML = `
    <a href="#/companies" class="muted small">&larr; Back to companies</a>
    <div style="margin-top:16px; padding-bottom:16px; border-bottom:1px solid var(--border);">
      <h1>${escapeHtml(c.name)}</h1>
      <p class="muted">${escapeHtml(c.org_number || '')} ${c.industry ? `- ${escapeHtml(c.industry)}` : ''}</p>
    </div>

    <div class="detail-grid">
      <div>
        <div class="section-label">Invoice contact</div>
        ${invoiceContact
          ? `<div class="card"><p style="font-weight:500;">${escapeHtml(invoiceContact.contact_name || 'No name on file')}</p>
             <p class="muted small" style="margin-top:4px;">${escapeHtml(invoiceContact.email)}</p></div>`
          : `<div class="empty-state"><h3>No invoice contact yet.</h3><p>Add one so this shows up whenever anyone searches this company.</p></div>`}
        <div class="section-label" style="margin-top:20px;">Notes</div>
        <p class="muted">${escapeHtml(c.notes || 'No notes on file.')}</p>
      </div>
      <div>
        <div class="section-label">Accounts used by this company</div>
