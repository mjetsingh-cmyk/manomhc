/* Manova — patient portal */
window.Manova = { user: null };
(function () {
  const F = ManovaForms, esc = F.esc;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const API = F.apiBase() + 'auth?action=';
  let U = null, REQS = [];
  const ICON = { opd: ['🩺', 'c-teal'], homecare: ['🏠', 'c-coral'], blood: ['🩸', 'c-rose'], diagnostic: ['🧪', 'c-sky'], second_opinion: ['🧠', 'c-amber'], cost_estimate: ['₹', 'c-ink'], scheme_help: ['🏛️', 'c-teal'], admission: ['🛏️', 'c-sky'], contact: ['✉️', 'c-ink'], hospital: ['🏥', 'c-teal'], waitlist: ['📱', 'c-ink'], callback: ['📞', 'c-ink'] };
  const CONDS = ['Diabetes Type 1', 'Diabetes Type 2', 'Hypertension', 'Asthma', 'Heart disease', 'Kidney disease', 'Thyroid', 'Arthritis', 'Epilepsy', 'Cancer', 'Other'];

  const toast = m => { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200); };
  const P = () => U.profile && !Array.isArray(U.profile) ? U.profile : {};
  const save = async (section, data) => { const r = await F.api(API + 'save', { section, data }); U = r.user; Manova.user = U; return U; };
  const fmtDate = d => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date(d)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const age = dob => { if (!dob) return ''; const d = new Date(dob), n = new Date(); let a = n.getFullYear() - d.getFullYear(); if (n < new Date(n.getFullYear(), d.getMonth(), d.getDate())) a--; return a >= 0 ? a : ''; };

  /* ---------- boot ---------- */
  F.api(API + 'me').then(r => {
    if (!r.user) { location.replace('login.html?next=dashboard.html'); return; }
    U = r.user; Manova.user = U; $('#app').hidden = false; init();
  }).catch(() => location.replace('login.html'));

  function init() {
    $$('select[name=blood_group], .bg-sel').forEach(s => F.BLOOD.forEach(b => s.insertAdjacentHTML('beforeend', `<option>${b}</option>`)));
    $('#conds').innerHTML = CONDS.map(c => `<button type="button" class="chip" data-c="${c}">${c}</button>`).join('');
    $('#conds').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) c.classList.toggle('on'); });
    $('#today').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    buildBook(); bindForms(); route(); addEventListener('hashchange', route);
    $('#side-btn').onclick = () => $('#side').classList.toggle('open');
    $('#logout').onclick = async () => { await F.api(API + 'logout', {}); location.href = 'index.html'; };
    $('#care-filter').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; $$('#care-filter .chip').forEach(x => x.classList.toggle('on', x === c)); renderReqs(c.dataset.f); });
    if (new URLSearchParams(location.search).get('welcome')) toast('🎉 Account created. Welcome to Manova!');
    paint(); loadReqs();
  }

  function route() {
    const v = (location.hash || '#overview').slice(1);
    const view = $('#v-' + v) ? v : 'overview';
    $$('.view').forEach(s => s.classList.toggle('on', s.id === 'v-' + view));
    $$('.side a.nl').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + view));
    $('#side').classList.remove('open'); scrollTo(0, 0);
    if (view === 'book' && U) pickSvc(current);
    if ((view === 'mycare' || view === 'overview') && U) loadReqs();
  }

  /* ---------- paint everything from U ---------- */
  function paint() {
    const p = P(), first = U.name.split(' ')[0];
    const h = new Date().getHours();
    $('#greet').textContent = `${h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'}, ${first}`;
    // completeness
    const checks = [p.dob, p.gender, p.blood_group, p.city, p.height && p.weight, p.allergies || (p.conditions && p.conditions.length), p.insurer, (U.contacts || []).length, U.phone];
    const pct = Math.round(checks.filter(Boolean).length / checks.length * 100);
    $('#pct').textContent = pct; setTimeout(() => $('#pct-bar').style.width = pct + '%', 100);
    $('#w-title').textContent = pct >= 100 ? `You're all set, ${first}` : `Welcome, ${first}`;
    $('#w-sub').textContent = pct >= 100 ? 'Your health profile is complete. Book care any time.' : 'Complete your health profile for faster bookings and safer emergency care.';
    // quick actions
    $('#qa').innerHTML = [['opd', 'Book OPD', 'Zero-wait slot'], ['homecare', 'Home care', 'Nurse at home'], ['blood', 'Find blood', 'Blood banks'], ['second_opinion', 'Second opinion', 'Expert review']]
      .map(([t, b, s]) => `<a class="qa" href="#book" data-svc="${t}"><i class="${ICON[t][1]}">${ICON[t][0]}</i><b>${b}</b><small>${s}</small></a>`).join('');
    $$('#qa [data-svc]').forEach(a => a.onclick = () => pickSvc(a.dataset.svc));
    // snapshot + card
    const prim = (U.contacts || []).find(c => c.primary) || (U.contacts || [])[0];
    const rows = [['Blood group', p.blood_group || '—'], ['Allergies', p.allergies || 'None recorded'], ['Conditions', (p.conditions || []).join(', ') || 'None recorded'], ['Medications', p.medications || 'None recorded'], ['Emergency contact', prim ? `${prim.name} (${prim.relation}) ${prim.phone}` : 'Not added']];
    $('#snap').innerHTML = '<dl style="display:grid;grid-template-columns:140px 1fr;gap:10px 14px;margin:0;font-size:14.5px">' + rows.map(r => `<dt style="color:var(--muted)">${r[0]}</dt><dd style="margin:0;font-weight:600">${esc(r[1])}</dd>`).join('') + '</dl>';
    $('#ecard').innerHTML = `<h3><span>🆘 Emergency profile</span><span style="font-size:13px;opacity:.7">MANOVA</span></h3><dl>
      <dt>Name</dt><dd>${esc(U.name)}</dd><dt>Age / gender</dt><dd>${esc([age(p.dob), p.gender].filter(x => x !== '' && x).join(' · ') || '—')}</dd>
      ${rows.map(r => `<dt>${r[0]}</dt><dd>${esc(r[1])}</dd>`).join('')}
      <dt>Insurance</dt><dd>${esc([p.insurer, p.policy_no].filter(Boolean).join(' · ') || '—')}</dd>${p.abha ? `<dt>ABHA</dt><dd>${esc(p.abha)}</dd>` : ''}</dl>`;
    // profile form
    const f = $('#f-profile');
    f.name.value = U.name; f.phone.value = U.phone || '';
    ['dob', 'gender', 'blood_group', 'city', 'height', 'weight', 'abha', 'allergies', 'medications', 'surgeries', 'insurer', 'policy_no', 'policy_from', 'policy_to'].forEach(k => { if (f[k]) f[k].value = p[k] || ''; });
    $$('#conds .chip').forEach(c => c.classList.toggle('on', (p.conditions || []).includes(c.dataset.c)));
    bmi();
    // lists
    $('#fam-list').innerHTML = (U.family || []).length ? U.family.map((m, i) => `<div class="list-item"><div><b>${esc(m.name)}</b><small>${esc([m.relation, age(m.dob) !== '' ? age(m.dob) + ' yrs' : '', m.gender, m.blood_group].filter(Boolean).join(' · '))}${m.notes ? '<br>' + esc(m.notes) : ''}</small></div><div style="display:flex;gap:6px"><button class="btn btn-ghost btn-sm" data-book="${i}">Book</button><button class="x-btn" data-del-fam="${i}" aria-label="Remove">✕</button></div></div>`).join('') : '<div class="empty"><i>👨‍👩‍👧</i>No family members yet.</div>';
    $$('[data-del-fam]').forEach(b => b.onclick = async () => { if (!confirm('Remove this family member?')) return; const fam = [...U.family]; fam.splice(+b.dataset.delFam, 1); await save('family', fam); paint(); toast('Removed'); });
    $$('[data-book]').forEach(b => b.onclick = () => { const who = U.family[+b.dataset.book].name; current = 'opd'; location.hash = 'book'; setTimeout(() => pickSvc('opd', who), 0); });
    $('#con-list').innerHTML = (U.contacts || []).length ? U.contacts.map((c, i) => `<div class="list-item"><div><b>${esc(c.name)} ${c.primary ? '<span class="status st-Confirmed">Primary</span>' : ''}</b><small>${esc(c.relation)} · <a href="tel:${esc(c.phone)}" class="link">${esc(c.phone)}</a></small></div><button class="x-btn" data-del-con="${i}" aria-label="Remove">✕</button></div>`).join('') : '<div class="empty" style="padding:20px"><i>📇</i>No emergency contacts yet.</div>';
    $$('[data-del-con]').forEach(b => b.onclick = async () => { const c = [...U.contacts]; c.splice(+b.dataset.delCon, 1); await save('contacts', c); paint(); toast('Removed'); });
    // prefs
    const pr = U.prefs || {}; const pf = $('#f-prefs');
    pf.email_updates.checked = pr.email_updates !== false; pf.health_tips.checked = !!pr.health_tips; pf.language.value = pr.language || 'English';
  }

  function bmi() {
    const f = $('#f-profile'), h = +f.height.value / 100, w = +f.weight.value, b = $('#bmi');
    if (h > 0.5 && w > 0) { const v = w / (h * h); b.hidden = false; b.textContent = `BMI ${v.toFixed(1)}`; } else b.hidden = true;
  }

  /* ---------- book ---------- */
  let current = 'opd';
  function buildBook() {
    const types = ['opd', 'homecare', 'blood', 'diagnostic', 'admission', 'second_opinion', 'cost_estimate', 'scheme_help'];
    $('#svc-tabs').innerHTML = types.map(t => `<button class="chip${t === current ? ' on' : ''}" data-t="${t}">${F.schemas[t].icon} ${F.schemas[t].short}</button>`).join('');
    $('#svc-tabs').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) pickSvc(c.dataset.t); });
    pickSvc(current);
  }
  function pickSvc(t, who) {
    current = t;
    $$('#svc-tabs .chip').forEach(c => c.classList.toggle('on', c.dataset.t === t));
    const s = F.schemas[t];
    $('#svc-desc').innerHTML = `<h3 style="font-size:22px;color:var(--ink);margin-bottom:4px">${s.title}</h3>${s.desc}`;
    const people = [U.name + ' (myself)', ...(U.family || []).map(m => `${m.name} (${m.relation})`)];
    F.render(t, $('#svc-form'), { patients: people, onDone: () => { loadReqs(); toast('Request sent. Track it in My care.'); } });
    if (who) { const sel = $('#svc-form [name=patient]'); if (sel) [...sel.options].forEach(o => { if (o.text.startsWith(who)) sel.value = o.text; }); }
  }

  /* ---------- requests ---------- */
  async function loadReqs() {
    try { const r = await F.api(API + 'requests'); REQS = r.requests || []; } catch (e) { REQS = []; }
    const open = REQS.filter(q => !['Completed', 'Cancelled'].includes(q.status));
    $('#active').innerHTML = open.length ? open.slice(0, 4).map(reqHTML).join('') : '<div class="empty"><i>🌿</i>No active requests.<br><a href="#book" class="link">Book care →</a></div>';
    renderReqs($('#care-filter .chip.on')?.dataset.f || 'all');
  }
  function reqHTML(q) {
    const f = q.fields || {}, ic = ICON[q.type] || ['📄', 'c-ink'];
    const what = f.specialty || f.service || f.tests || f.procedure || f.current_diagnosis || f.scheme || (f.blood_group ? `${f.blood_group} · ${f.component || ''}` : '') || f.subject || '';
    const when = f.preferred_date || f.planned_date || '';
    const canCancel = !['Completed', 'Cancelled'].includes(q.status);
    return `<div class="rq"><i class="${ic[1]}">${ic[0]}</i><div><b>${esc(q.label)}</b><small>${esc([what, when && 'for ' + fmtDate(when), f.patient_name].filter(Boolean).join(' · '))}<br>${esc(q.id)} · sent ${fmtDate(q.created)}${q.note ? `<br><b style="color:var(--teal-d)">Note: ${esc(q.note)}</b>` : ''}</small></div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end"><span class="status st-${q.status.replace(/\s/g, '')}">${esc(q.status)}</span>${canCancel ? `<button class="link no-print" style="border:0;background:none;font-size:12.5px" data-cancel="${esc(q.id)}">Cancel</button>` : ''}</div></div>`;
  }
  function renderReqs(filter) {
    const list = REQS.filter(q => filter === 'all' || (filter === 'open' ? !['Completed', 'Cancelled'].includes(q.status) : ['Completed', 'Cancelled'].includes(q.status)));
    $('#all-req').innerHTML = list.length ? list.map(reqHTML).join('') : '<div class="empty"><i>🗂️</i>Nothing here yet.</div>';
    $$('[data-cancel]').forEach(b => b.onclick = async () => {
      if (!confirm('Cancel this request?')) return;
      try { await F.api(API + 'cancel', { id: b.dataset.cancel }); toast('Request cancelled'); loadReqs(); } catch (e) { toast(e.message); }
    });
  }

  /* ---------- forms ---------- */
  function wrap(form, fn) {
    const msg = form.querySelector('.form-msg');
    form.addEventListener('submit', async e => {
      e.preventDefault(); if (msg) msg.className = 'form-msg';
      const bad = [...form.querySelectorAll('[required]')].find(i => !i.value.trim());
      if (bad) { if (msg) { msg.className = 'form-msg err'; msg.textContent = 'Please complete the required fields.'; } bad.focus(); return; }
      const btn = form.querySelector('[type=submit]'); btn.disabled = true;
      try { await fn(form); } catch (err) { if (msg) { msg.className = 'form-msg err'; msg.textContent = err.message; } else toast(err.message); }
      finally { btn.disabled = false; }
    });
  }
  function bindForms() {
    const fp = $('#f-profile');
    fp.height.oninput = fp.weight.oninput = bmi;
    wrap(fp, async f => {
      const d = {};
      ['dob', 'gender', 'blood_group', 'city', 'height', 'weight', 'abha', 'allergies', 'medications', 'surgeries', 'insurer', 'policy_no', 'policy_from', 'policy_to'].forEach(k => d[k] = f[k].value.trim());
      d.conditions = $$('#conds .chip.on').map(c => c.dataset.c);
      await save('basic', { name: f.name.value.trim(), phone: f.phone.value.trim() });
      await save('profile', d); paint(); toast('✓ Health profile saved');
    });
    wrap($('#f-fam'), async f => {
      const m = Object.fromEntries(new FormData(f)); await save('family', [...(U.family || []), m]); f.reset(); paint(); toast('✓ Family member added');
    });
    wrap($('#f-con'), async f => {
      const c = Object.fromEntries(new FormData(f)); c.primary = f.primary.checked;
      let list = [...(U.contacts || [])]; if (list.length >= 5) throw new Error('You can add up to 5 emergency contacts.');
      if (c.primary || !list.length) { list = list.map(x => ({ ...x, primary: false })); c.primary = true; }
      await save('contacts', [...list, c]); f.reset(); paint(); toast('✓ Contact added');
    });
    wrap($('#f-prefs'), async f => { await save('prefs', { email_updates: f.email_updates.checked, health_tips: f.health_tips.checked, language: f.language.value }); toast('✓ Preferences saved'); });
    wrap($('#f-pw'), async f => { await F.api(API + 'password', { current: f.current.value, new: f.new.value }); f.reset(); toast('✓ Password updated'); });
    wrap($('#f-del'), async f => {
      if (!confirm('This permanently deletes your account. Continue?')) return;
      await F.api(API + 'delete', { password: f.password.value }); location.href = 'index.html';
    });
  }
})();
