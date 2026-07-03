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
    <a href="#/accounts" class="muted small">&larr; Back to accounts</a>
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-top:16px; padding-bottom:16px; border-bottom:1px solid var(--border);">
      <div>
        <span class="badge badge-class">${a.account_classes ? `Class ${a.class_number} - ${a.account_classes.name_en}` : `Class ${a.class_number}`}</span>
        <h1 style="margin-top:10px;"><span class="stamp large">${a.account_number}</span> ${escapeHtml(a.name_no)}</h1>
        <p class="muted" style="margin-top:6px;">${escapeHtml(a.purpose_en)}</p>
      </div>
      <div class="muted small" style="text-align:right;">
        <p>VAT: ${a.vat_codes ? `${escapeHtml(a.vat_codes.name_en)} (${a.vat_codes.rate_percent}%)` : 'not applicable'}</p>
        <p>SAF-T: ${a.saf_t_codes ? escapeHtml(a.saf_t_codes.code) : 'not mapped'}</p>
      </div>
    </div>

    <div class="detail-grid">
      <div>
        <div class="section-label">Example transactions</div>
        ${renderList(examplesRes.data, e => e.example_en)}

        <div class="section-label" style="margin-top:20px;">Bookkeeping requirements</div>
        ${renderList(requirementsRes.data, r => `
          ${escapeHtml(r.description_en)}
          ${r.law_articles ? `<div class="law-ref">${escapeHtml(r.law_articles.laws?.short_name_no || '')} ${escapeHtml(r.law_articles.paragraph_no || '')}</div>` : ''}
        `)}

        <div class="section-label" style="margin-top:20px;">Audit checkpoints</div>
        ${(auditRes.data || []).map(x => `
          <div class="list-item">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <div>${escapeHtml(x.description_en)}</div>
              <span class="badge badge-${x.risk_level}">${x.risk_level}</span>
            </div>
            ${x.isa_standard_ref ? `<div class="muted small" style="margin-top:4px;">${escapeHtml(x.isa_standard_ref)}</div>` : ''}
          </div>
        `).join('') || emptyLine()}
      </div>

      <div>
        <div class="section-label">Law references</div>
        ${(lawRefsRes.data || []).map(x => `
          <div class="list-item">
            <div>${escapeHtml(x.law_articles?.title_en || x.law_articles?.paragraph_no || '')}</div>
            <div class="muted small" style="margin-top:4px;">${escapeHtml(x.law_articles?.summary_en || '')}</div>
          </div>
        `).join('') || emptyLine()}

        <div class="section-label" style="margin-top:20px;">Linked procedures</div>
        ${(proceduresRes.data || []).map(x => `
          <div class="list-item">${escapeHtml(x.procedures?.title_en || '')}</div>
        `).join('') || emptyLine()}

        ${hasRole('senior') ? `
          <div class="section-label" style="margin-top:20px;">Companies using this account</div>
          ${(companiesRes.data || []).map(x => `<div class="list-item">${escapeHtml(x.company_id)}</div>`).join('') || emptyLine('No companies linked yet.')}
        ` : ''}
      </div>
    </div>
  `;
}

function renderList(items, fn) {
  if (!items || !items.length) return emptyLine();
  return items.map(i => `<div class="list-item">${fn(i)}</div>`).join('');
}
function emptyLine(text = 'Nothing recorded yet.') {
  return `<div class="muted small" style="padding:8px 0;">${text}</div>`;
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
