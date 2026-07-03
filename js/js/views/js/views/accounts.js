import { supabase } from '../supabaseClient.js';
import { hasRole } from '../auth.js';

let activeClassFilter = null;

export async function renderAccounts(root, params) {
  if (params?.id) {
    return renderAccountDetail(root, params.id);
  }
  root.innerHTML = `
    <h1>Accounts</h1>
    <p class="muted">Search the Norwegian chart of accounts.</p>
    <div class="toolbar" style="margin-top:20px;">
      <input type="search" id="accounts-search" placeholder="Search by number, Norwegian name, or English purpose" />
    </div>
    <div class="chip-row" id="class-chips"></div>
    <div id="accounts-list"><p class="muted">Loading accounts...</p></div>
  `;

  const chipRow = root.querySelector('#class-chips');
  const classes = [
    { n: null, label: 'All classes' },
    { n: 1, label: '1 Assets' }, { n: 2, label: '2 Equity/liab' },
    { n: 3, label: '3 Revenue' }, { n: 4, label: '4 COGS' },
    { n: 5, label: '5 Payroll' }, { n: 6, label: '6-7 Opex' }, { n: 8, label: '8 Finance/tax' },
  ];
  chipRow.innerHTML = classes.map(c =>
    `<span class="chip ${c.n === activeClassFilter ? 'active' : ''}" data-class="${c.n ?? ''}">${c.label}</span>`
  ).join('');
  chipRow.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      activeClassFilter = chip.dataset.class ? Number(chip.dataset.class) : null;
      loadList(root);
    });
  });

  root.querySelector('#accounts-search').addEventListener('input', debounce(() => loadList(root), 300));

  loadList(root);
}

async function loadList(root) {
  const listEl = root.querySelector('#accounts-list');
  const searchTerm = root.querySelector('#accounts-search').value.trim();

  let query = supabase.from('accounts')
    .select('id, account_number, name_no, purpose_en, class_number')
    .eq('is_active', true)
    .order('account_number');

  if (activeClassFilter) query = query.eq('class_number', activeClassFilter);
  if (searchTerm) {
    query = query.or(`account_number.ilike.%${searchTerm}%,name_no.ilike.%${searchTerm}%,purpose_en.ilike.%${searchTerm}%`);
  }

  const { data, error } = await query.limit(100);
  if (error) {
    listEl.innerHTML = `<p class="error-text">Could not load accounts: ${error.message}</p>`;
    return;
  }
  if (!data.length) {
    listEl.innerHTML = `<div class="empty-state"><h3>No accounts match your search.</h3><p>Try a different account number or keyword.</p></div>`;
    return;
  }

  listEl.innerHTML = `
    <table>
      <thead><tr><th>Konto</th><th>Navn</th><th>Purpose</th></tr></thead>
      <tbody>
        ${data.map(a => `
          <tr class="row-link" data-id="${a.id}">
            <td><span class="stamp small">${a.account_number}</span></td>
            <td>${escapeHtml(a.name_no)}</td>
            <td class="muted">${escapeHtml(a.purpose_en)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  listEl.querySelectorAll('tr.row-link').forEach(row => {
    row.addEventListener('click', () => {
      window.location.hash = `#/accounts/${row.dataset.id}`;
    });
  });
}

async function renderAccountDetail(root, accountId) {
  root.innerHTML = `<p class="muted">Loading account...</p>`;

  const [accountRes, examplesRes, requirementsRes, auditRes, lawRefsRes, proceduresRes, companiesRes] = await Promise.all([
    supabase.from('accounts').select('*, account_classes(name_no, name_en), vat_codes(name_en, rate_percent), saf_t_codes(code)').eq('id', accountId).single(),
    supabase.from('account_examples').select('*').eq('account_id', accountId).order('order_index'),
    supabase.from('account_requirements').select('*, law_articles(paragraph_no, laws(short_name_no, full_name_en))').eq('account_id', accountId),
    supabase.from('account_audit_requirements').select('*').eq('account_id', accountId),
    supabase.from('account_law_references').select('law_articles(paragraph_no, title_en, summary_en, laws(short_name_no, full_name_en))').eq('account_id', accountId),
    supabase.from('procedure_related_accounts').select('procedures(id, title_en, category)').eq('account_id', accountId),
    hasRole('senior')
      ? supabase.from('company_effective_accounts').select('*').eq('account_id', accountId)
      : Promise.resolve({ data: [] }),
  ]);

  if (accountRes.error || !accountRes.data) {
    root.innerHTML = `<p class="error-text">Account not found.</p><a href="#/accounts">Back to accounts</a>`;
    return;
  }
  const a = accountRes.data;

  root.innerHTML = `
