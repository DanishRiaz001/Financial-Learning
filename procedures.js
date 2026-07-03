import { supabase } from '../supabaseClient.js';

export async function renderProcedures(root, params) {
  if (params?.id) return renderProcedureDetail(root, params.id);

  root.innerHTML = `
    <h1>Procedures</h1>
    <p class="muted">Step-by-step reconciliations and review workflows.</p>
    <div id="procedures-list" style="margin-top:20px;"><p class="muted">Loading...</p></div>
  `;

  const { data, error } = await supabase.from('procedures').select('*').order('title_en');
  const listEl = root.querySelector('#procedures-list');
  if (error) { listEl.innerHTML = `<p class="error-text">${error.message}</p>`; return; }
  if (!data.length) {
    listEl.innerHTML = `<div class="empty-state"><h3>No procedures yet.</h3><p>Add your first walkthrough, like a bank reconciliation, to get started.</p></div>`;
    return;
  }

  listEl.innerHTML = data.map(p => `
    <div class="card row-link" data-id="${p.id}" style="margin-bottom:10px; cursor:pointer;">
      <h3>${escapeHtml(p.title_en)}</h3>
      <p class="muted small" style="margin-top:4px;">${escapeHtml(p.description_en || '')}</p>
    </div>
  `).join('');
  listEl.querySelectorAll('.row-link').forEach(row => {
    row.addEventListener('click', () => { window.location.hash = `#/procedures/${row.dataset.id}`; });
  });
}

async function renderProcedureDetail(root, procedureId) {
  root.innerHTML = `<p class="muted">Loading procedure...</p>`;

  const [procRes, stepsRes] = await Promise.all([
    supabase.from('procedures').select('*').eq('id', procedureId).single(),
    supabase.from('procedure_steps').select('*').eq('procedure_id', procedureId).order('step_order'),
  ]);

  if (procRes.error || !procRes.data) {
    root.innerHTML = `<p class="error-text">Procedure not found.</p><a href="#/procedures">Back to procedures</a>`;
    return;
  }

  const stepsHtml = await Promise.all((stepsRes.data || []).map(async (s, i) => {
    let imageHtml = '';
    if (s.image_path) {
      const { data: signed } = await supabase.storage.from('procedure-images').createSignedUrl(s.image_path, 3600);
      if (signed?.signedUrl) {
        imageHtml = `<img src="${signed.signedUrl}" alt="Screenshot for step ${i + 1}" style="max-width:100%; border-radius:var(--radius); margin-top:10px; border:1px solid var(--border);" />`;
      }
    }
    return `
      <div class="card" style="margin-bottom:12px;">
        <div class="muted small">Step ${i + 1}</div>
        <h3 style="margin-top:4px;">${escapeHtml(s.title)}</h3>
        <p style="margin-top:8px;">${escapeHtml(s.content_en)}</p>
        ${s.warning_note ? `<p class="law-ref" style="color:var(--amber);">${escapeHtml(s.warning_note)}</p>` : ''}
        ${imageHtml}
      </div>
    `;
  }));

  root.innerHTML = `
    <a href="#/procedures" class="muted small">&larr; Back to procedures</a>
    <h1 style="margin-top:16px;">${escapeHtml(procRes.data.title_en)}</h1>
    <p class="muted" style="margin-bottom:20px;">${escapeHtml(procRes.data.description_en || '')}</p>
    ${stepsHtml.join('') || `<div class="empty-state"><h3>No steps added yet.</h3></div>`}
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
