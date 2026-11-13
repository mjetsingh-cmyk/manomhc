/* Manova — homepage interactions */
window.Manova = window.Manova || { user: null };
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const F = window.ManovaForms;

  /* nav */
  const nav = $('.nav');
  const onScroll = () => nav && nav.classList.toggle('scrolled', scrollY > 20);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  $('.menu-btn')?.addEventListener('click', () => nav.classList.toggle('open'));
  $$('.mobile-menu a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));

  /* reveal */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  $$('.reveal').forEach(el => io.observe(el));

  /* score bars */
  const bars = $('.bars');
  if (bars) new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { $$('.bar i', bars).forEach(i => i.style.width = i.dataset.w + '%'); o.disconnect(); } }), { threshold: .3 }).observe(bars);

  /* toast */
  window.toast = (m) => { let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3800); };

  /* services hub */
  const hub = $('#hub');
  if (hub) {
    const types = ['opd', 'homecare', 'blood', 'diagnostic', 'second_opinion', 'cost_estimate', 'scheme_help'];
    const tabs = $('.hub-tabs', hub), panels = $('.hub-panels', hub);
    types.forEach((t, i) => {
      const s = F.schemas[t];
      tabs.insertAdjacentHTML('beforeend', `<button class="hub-tab${i ? '' : ' on'}" data-t="${t}" role="tab"><i class="${s.c}">${s.icon}</i><span>${s.short}<small>${s.sub}</small></span></button>`);
      panels.insertAdjacentHTML('beforeend', `<div class="hub-panel${i ? '' : ' on'}" id="panel-${t}" role="tabpanel"><h3>${s.title}</h3><p>${s.desc}</p><div class="fw"></div></div>`);
      F.render(t, $(`#panel-${t} .fw`));
    });
    tabs.addEventListener('click', e => { const b = e.target.closest('.hub-tab'); if (b) openService(b.dataset.t, false); });
  }
  window.openService = (t, scroll = true, preset = {}) => {
    $$('.hub-tab').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    $$('.hub-panel').forEach(p => p.classList.toggle('on', p.id === 'panel-' + t));
    const panel = $('#panel-' + t);
    if (panel) {
      for (const [k, v] of Object.entries(preset)) { const el = panel.querySelector(`[name="${k}"]`); if (el) el.value = v; }
      if (scroll) $('#services').scrollIntoView({ behavior: 'smooth' });
    }
  };
  $$('[data-service]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); openService(a.dataset.service); }));

  /* static forms */
  $$('form[data-form]').forEach(f => F.bind(f));

  /* ---------- Symptom → specialist ---------- */
  const SYM = {
    'Chest pain / palpitations': { s: 'Cardiology', w: 'a Cardiologist' },
    'Breathlessness / chronic cough': { s: 'Pulmonology', w: 'a Pulmonologist (chest physician)' },
    'Headache / dizziness / seizures': { s: 'Neurology', w: 'a Neurologist' },
    'Back or neck pain with numbness': { s: 'Neurosurgery', w: 'a Neurosurgeon or Spine specialist' },
    'Joint, bone or muscle pain': { s: 'Orthopaedics', w: 'an Orthopaedic specialist' },
    'Stomach pain / acidity / bowel': { s: 'Gastroenterology', w: 'a Gastroenterologist' },
    'Skin, hair or nail problem': { s: 'Dermatology', w: 'a Dermatologist' },
    'Urine problems / kidney': { s: 'Urology', w: 'a Urologist or Nephrologist' },
    'Periods / pregnancy': { s: 'Obstetrics & Gynaecology', w: 'an Obstetrician & Gynaecologist' },
    'Child is unwell': { s: 'Paediatrics', w: 'a Paediatrician' },
    'Ear, nose or throat': { s: 'ENT', w: 'an ENT specialist' },
    'Eye problem': { s: 'Ophthalmology', w: 'an Ophthalmologist' },
    'Anxiety, low mood or sleep': { s: 'Psychiatry', w: 'a Psychiatrist' },
    'Sugar, thyroid or weight': { s: 'Endocrinology (Diabetes & Thyroid)', w: 'an Endocrinologist' },
    'Fever / general weakness': { s: 'General Physician / Internal Medicine', w: 'a General Physician' },
    'Teeth or gums': { s: 'Dentistry', w: 'a Dentist' }
  };
  const FLAGS = ['Chest pain spreading to arm/jaw', 'Severe difficulty breathing', 'Sudden worst-ever headache', 'Face drooping / slurred speech / one-sided weakness', 'Fainting or unconsciousness', 'Heavy bleeding', 'Seizure lasting > 5 minutes', 'Thoughts of self-harm'];
  const symBox = $('#sym');
  if (symBox) {
    $('#sym-areas').innerHTML = Object.keys(SYM).map(k => `<button type="button" class="chip" data-k="${k}">${k}</button>`).join('');
    $('#sym-flags').innerHTML = FLAGS.map(k => `<button type="button" class="chip flag" data-f="${k}">${k}</button>`).join('');
    let pick = null;
    $('#sym-areas').addEventListener('click', e => { const c = e.target.closest('.chip'); if (!c) return; $$('#sym-areas .chip').forEach(x => x.classList.toggle('on', x === c)); pick = c.dataset.k; });
    $('#sym-flags').addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) c.classList.toggle('on'); });
    const sev = $('#sym-sev'); sev.addEventListener('input', () => $('#sym-sev-v').textContent = sev.value);
    $('#sym-go').addEventListener('click', () => {
      const out = $('#sym-out');
      const flags = $$('#sym-flags .chip.on').map(c => c.dataset.f);
      out.className = 'result show';
      if (flags.length) {
        out.classList.add('emergency');
        const self = flags.includes('Thoughts of self-harm');
        out.innerHTML = `<h4>⚠️ This may be an emergency</h4><p>You selected: <b>${flags.join(', ')}</b>. Please do not wait for an appointment. ${self ? 'You deserve support right now. Call <b>Tele-MANAS 14416</b> (free, 24×7) or <b>112</b>.' : 'Call <b>112</b> now or go to the nearest emergency department.'}</p>
          <div class="actions"><a class="btn btn-coral btn-sm" href="tel:112">Call 112</a><a class="btn btn-ghost btn-sm" href="tel:108">Ambulance 108</a>${self ? '<a class="btn btn-ghost btn-sm" href="tel:14416">Tele-MANAS 14416</a>' : ''}</div>`;
        return;
      }
      if (!pick) { out.innerHTML = '<p>Please choose what is troubling you most.</p>'; return; }
      const r = SYM[pick]; const sevV = +sev.value; const dur = $('#sym-dur').value;
      const urgent = sevV >= 8;
      out.innerHTML = `<h4>Consider seeing ${r.w}</h4><p>Based on “${pick}”${dur ? `, ${dur.toLowerCase()}` : ''}, severity ${sevV}/10. ${urgent ? '<b>High severity: please try to be seen today, and go to emergency if it gets worse.</b>' : 'Book an OPD visit at a time that suits you.'}</p>
        <div class="actions"><button class="btn btn-primary btn-sm" id="sym-book">Book ${r.s.split(' (')[0]} OPD →</button></div>`;
      $('#sym-book').onclick = () => openService('opd', true, { specialty: r.s, details: `${pick}${dur ? ' · ' + dur : ''} · severity ${sevV}/10` });
    });
  }

  /* ---------- Scheme checker ---------- */
  const sc = $('#scheme');
  if (sc) {
    $('#scheme-go').addEventListener('click', () => {
      const a = Object.fromEntries($$('select', sc).map(s => [s.name, s.value]));
      const res = [];
      if (a.job === 'central') res.push(['CGHS', 'Central Government Health Scheme, for serving & retired central government employees and their dependants.']);
      if (a.job === 'exservice') res.push(['ECHS', 'Ex-Servicemen Contributory Health Scheme, for ex-servicemen and dependants.']);
      if (a.job === 'organised') res.push(['ESIC', 'Employees\' State Insurance, for employees in covered establishments within the wage ceiling.']);
      if (a.income === 'low' || a.card === 'yes') res.push(['Ayushman Bharat PM-JAY', 'Up to ₹5 lakh per family per year for hospitalisation at empanelled hospitals, based on eligibility.']);
      if (a.age === '70') res.push(['Ayushman Vay Vandana (PM-JAY 70+)', 'Senior citizens aged 70 and above may be covered under PM-JAY regardless of income.']);
      res.push(['Your state\'s health scheme', 'Most states run their own schemes (often merged with PM-JAY). We can check what applies in your state.']);
      $('#scheme-out').innerHTML = res.map(r => `<div><b>${r[0]}</b>${r[1]}</div>`).join('') +
        '<p class="disclaimer">ℹ️ Indicative only. Final eligibility is decided by the scheme authority.</p><button class="btn btn-teal btn-sm" onclick="openService(\'scheme_help\')">Get free enrolment help →</button>';
    });
  }

  /* ---------- Session-aware nav ---------- */
  F.api(F.apiBase() + 'auth?action=me').then(r => {
    if (!r.user) return;
    Manova.user = r.user;
    const ini = r.user.name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
    $$('[data-auth-slot]').forEach(s => s.outerHTML = `<a href="dashboard.html" class="user-chip"><i>${F.esc(ini)}</i>My Health</a>`);
    $$('form[data-form]').forEach(f => F.prefill(f, r.user));
  }).catch(() => {});

  /* year */
  $$('[data-year]').forEach(y => y.textContent = new Date().getFullYear());
})();
