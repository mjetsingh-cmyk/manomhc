/* Manova — shared form definitions + API helper (used by homepage and patient portal) */
(function () {
  const SPECIALTIES = ['General Physician / Internal Medicine','Cardiology','Neurology','Neurosurgery','Orthopaedics','Gastroenterology','Pulmonology','Nephrology','Urology','Obstetrics & Gynaecology','Paediatrics','Dermatology','ENT','Ophthalmology','Psychiatry','Endocrinology (Diabetes & Thyroid)','Oncology','General Surgery','Dentistry','Physiotherapy','Not sure — please advise'];
  const PAYMENT = ['Self-pay','Private insurance','Ayushman Bharat (PM-JAY)','CGHS','ECHS','ESIC','State government scheme','Not sure'];
  const BLOOD = ['A+','A-','B+','B-','AB+','AB-','O+','O-',"Don't know"];
  const HOMECARE = {
    'Nursing at home': ['Injection (IM / IV / Subcutaneous)','IV cannulation & infusion','Wound dressing & care','Vitals monitoring (BP, sugar, SpO2)','Catheter care / change',"Ryle's tube feeding",'Post-surgical care','Tracheostomy care','Stoma care','Bedsore care & prevention'],
    'Minor OT at home': ['Stitch / suture removal','Minor dressing change','Abscess drainage','Wound suturing (small cuts)','Ear syringing / wax removal','Ingrown nail removal','Foreign body removal'],
    'Other': ['Home sample collection (lab tests)','Physiotherapy at home','Elderly care / attendant','Other — describe below']
  };

  const contact = [
    { n: 'name', l: 'Full name', t: 'text', r: 1, ac: 'name' },
    { n: 'phone', l: 'Mobile number', t: 'tel', r: 1, ac: 'tel', ph: '+91 98xxxxxxx' },
    { n: 'email', l: 'Email', t: 'email', ac: 'email' },
    { n: 'city', l: 'City / pincode', t: 'text', r: 1 }
  ];

  const S = {
    opd: { title: 'Book an OPD appointment', icon: '🩺', c: 'c-teal', short: 'Zero-wait OPD', sub: 'Skip the queue',
      desc: 'Tell us the specialty and your preferred time. We coordinate with the hospital and confirm your slot, so you arrive at your time, not hours early.',
      fields: [...contact,
        { n: 'specialty', l: 'Specialty needed', t: 'select', o: SPECIALTIES, r: 1 },
        { n: 'preferred_hospital', l: 'Preferred hospital / doctor', t: 'text', ph: 'Optional' },
        { n: 'preferred_date', l: 'Preferred date', t: 'date', r: 1 },
        { n: 'preferred_time', l: 'Preferred time', t: 'select', o: ['Morning (8–12)','Afternoon (12–4)','Evening (4–8)','Any time'] },
        { n: 'visit_type', l: 'Visit type', t: 'select', o: ['First consultation','Follow-up visit'] },
        { n: 'payment', l: 'Payment / coverage', t: 'select', o: PAYMENT },
        { n: 'details', l: 'Symptoms or reason for visit', t: 'textarea', f: 1, ph: 'Briefly describe what is troubling you' }] },

    homecare: { title: 'Home care & minor OT', icon: '🏠', c: 'c-coral', short: 'Home care', sub: 'Nurse or minor OT at home',
      desc: 'Verified nurses and hospital-affiliated staff at your doorstep for injections, dressings, catheter care, suture removal and more.',
      fields: [...contact,
        { n: 'service', l: 'Service needed', t: 'select', g: HOMECARE, r: 1 },
        { n: 'preferred_date', l: 'Preferred date', t: 'date', r: 1 },
        { n: 'preferred_time', l: 'Preferred time', t: 'select', o: ['Morning','Afternoon','Evening','As early as possible'] },
        { n: 'patient_age', l: 'Patient age', t: 'number' },
        { n: 'address', l: 'Full address for the visit', t: 'textarea', f: 1, r: 1, rows: 2 },
        { n: 'details', l: 'Anything the nurse should know?', t: 'textarea', f: 1, ph: 'e.g. prescription details, mobility, previous procedure' }] },

    blood: { title: 'Find blood & blood products', icon: '🩸', c: 'c-rose', short: 'Find blood', sub: 'Blood banks & donors',
      desc: 'Tell us the blood group, component and urgency. We contact linked blood banks and get back to you with availability.',
      note: 'If a life is at risk right now, call 112 immediately as well.',
      fields: [...contact,
        { n: 'blood_group', l: 'Blood group needed', t: 'select', o: BLOOD, r: 1 },
        { n: 'component', l: 'Component', t: 'select', o: ['Whole blood','Packed red cells (PRBC)','Platelets','Fresh frozen plasma (FFP)','Cryoprecipitate','Not sure'], r: 1 },
        { n: 'units', l: 'Units required', t: 'number', r: 1 },
        { n: 'urgency', l: 'How urgent?', t: 'select', o: ['Emergency (within 6 hours)','Within 24 hours','Planned (surgery date known)'], r: 1 },
        { n: 'hospital_name', l: 'Hospital where patient is admitted', t: 'text' },
        { n: 'patient_name', l: 'Patient name', t: 'text' },
        { n: 'details', l: 'Additional details', t: 'textarea', f: 1 }] },

    diagnostic: { title: 'Book a diagnostic test', icon: '🧪', c: 'c-sky', short: 'Lab & scans', sub: 'Home sample collection',
      desc: 'Blood tests, imaging and cardiac tests at hospitals or accredited labs, with home sample collection for pathology tests.',
      fields: [...contact,
        { n: 'test_category', l: 'Category', t: 'select', o: ['Pathology (blood / urine tests)','Radiology (X-ray, USG, CT, MRI)','Cardiology (ECG, ECHO, TMT)','Health check-up package','Not sure'], r: 1 },
        { n: 'tests', l: 'Test name(s)', t: 'text', r: 1, ph: 'e.g. CBC, HbA1c, MRI brain' },
        { n: 'home_collection', l: 'Home sample collection?', t: 'select', o: ['Yes, collect at home','No, I will visit'] },
        { n: 'preferred_date', l: 'Preferred date', t: 'date' },
        { n: 'address', l: 'Address (for home collection)', t: 'textarea', f: 1, rows: 2 },
        { n: 'details', l: 'Doctor\'s advice / notes', t: 'textarea', f: 1 }] },

    second_opinion: { title: 'Get a second opinion', icon: '🧠', c: 'c-amber', short: 'Second opinion', sub: 'Expert review',
      desc: 'Facing surgery or a serious diagnosis? Get your case reviewed by an independent specialist before you decide.',
      note: 'After you submit, our team will reply by email with a secure way to share reports and scans.',
      fields: [...contact,
        { n: 'specialty', l: 'Specialty', t: 'select', o: SPECIALTIES, r: 1 },
        { n: 'current_diagnosis', l: 'Current diagnosis', t: 'text', r: 1 },
        { n: 'proposed_treatment', l: 'Treatment / surgery advised', t: 'text' },
        { n: 'treating_hospital', l: 'Current hospital / doctor', t: 'text' },
        { n: 'details', l: 'Your questions for the specialist', t: 'textarea', f: 1, r: 1 }] },

    cost_estimate: { title: 'Treatment cost estimate', icon: '₹', c: 'c-ink', short: 'Cost estimate', sub: 'Know before you go',
      desc: 'Get a transparent cost range for a procedure across hospital types in your city, including what insurance or schemes may cover.',
      fields: [...contact,
        { n: 'procedure', l: 'Procedure / treatment', t: 'text', r: 1, ph: 'e.g. knee replacement, C-section, angioplasty' },
        { n: 'hospital_type', l: 'Hospital preference', t: 'select', o: ['Any','Government','Private','Trust / charitable','Corporate chain'] },
        { n: 'room_type', l: 'Room preference', t: 'select', o: ['General ward','Semi-private','Private','Not sure'] },
        { n: 'payment', l: 'Payment / coverage', t: 'select', o: PAYMENT },
        { n: 'details', l: 'Anything else (age, other conditions)?', t: 'textarea', f: 1 }] },

    scheme_help: { title: 'Government scheme help', icon: '🏛️', c: 'c-teal', short: 'Scheme help', sub: 'PM-JAY, CGHS, ESIC…',
      desc: 'Many families are eligible for free or subsidised treatment and don\'t know it. We guide you through eligibility and enrolment.',
      fields: [...contact,
        { n: 'scheme', l: 'Scheme', t: 'select', o: ['Ayushman Bharat (PM-JAY)','CGHS','ECHS','ESIC','State health scheme','Not sure — check for me'], r: 1 },
        { n: 'state', l: 'State', t: 'text', r: 1 },
        { n: 'details', l: 'Tell us about your situation', t: 'textarea', f: 1 }] },

    admission: { title: 'Digital admission request', icon: '🛏️', c: 'c-sky', short: 'Admission', sub: 'Paperless admission', auth: 1,
      desc: 'Planned admission? Submit details in advance so paperwork, insurance pre-authorisation and bed allocation are ready before you arrive.',
      fields: [...contact,
        { n: 'hospital', l: 'Hospital', t: 'text', r: 1 },
        { n: 'planned_date', l: 'Planned admission date', t: 'date', r: 1 },
        { n: 'procedure', l: 'Reason / procedure', t: 'text', r: 1 },
        { n: 'treating_doctor', l: 'Treating doctor', t: 'text' },
        { n: 'room_type', l: 'Room preference', t: 'select', o: ['General ward','Semi-private','Private','ICU / HDU (as advised)'] },
        { n: 'payment', l: 'Payment / coverage', t: 'select', o: PAYMENT },
        { n: 'insurer', l: 'Insurer & policy number (if any)', t: 'text', f: 1 },
        { n: 'details', l: 'Notes for the admission desk', t: 'textarea', f: 1 }] }
  };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function fieldHTML(f, uid) {
    const id = uid + '-' + f.n;
    const req = f.r ? ' required' : '';
    const star = f.r ? ' <span class="req">*</span>' : '';
    let ctl;
    if (f.t === 'select') {
      let opts = '<option value="">Select…</option>';
      if (f.g) for (const [grp, list] of Object.entries(f.g)) opts += `<optgroup label="${esc(grp)}">` + list.map(o => `<option>${esc(o)}</option>`).join('') + '</optgroup>';
      else opts += f.o.map(o => `<option>${esc(o)}</option>`).join('');
      ctl = `<select id="${id}" name="${f.n}"${req}>${opts}</select>`;
    } else if (f.t === 'textarea') {
      ctl = `<textarea id="${id}" name="${f.n}" rows="${f.rows || 4}" placeholder="${esc(f.ph || '')}"${req}></textarea>`;
    } else {
      const extra = f.t === 'date' ? ` min="${new Date().toISOString().slice(0, 10)}"` : f.t === 'number' ? ' min="0" max="150"' : '';
      ctl = `<input id="${id}" type="${f.t}" name="${f.n}" placeholder="${esc(f.ph || '')}"${f.ac ? ` autocomplete="${f.ac}"` : ''}${extra}${req}>`;
    }
    return `<div class="field${f.f ? ' full' : ''}"><label for="${id}">${esc(f.l)}${star}</label>${ctl}</div>`;
  }

  function successHTML(title) {
    return `<div class="form-success"><div class="tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5L20 7"/></svg></div>
      <h4>${esc(title || 'Request received')}</h4><p>Your reference is <code class="ref">—</code>. Our team will contact you within 24 hours. A confirmation has been sent to your email.</p>
      <button type="button" class="btn btn-ghost btn-sm" data-again style="margin-top:18px">Submit another</button></div>`;
  }

  function render(type, el, opts = {}) {
    const s = S[type]; if (!s) return;
    const uid = 'f' + Math.random().toString(36).slice(2, 7);
    let patientSel = '';
    if (opts.patients && opts.patients.length > 1) {
      patientSel = `<div class="field full"><label for="${uid}-for">Booking for</label><select id="${uid}-for" name="patient">${opts.patients.map(p => `<option>${esc(p)}</option>`).join('')}</select></div>`;
    }
    el.innerHTML = `<form class="form" data-form="${type}" novalidate>
      <div class="prefill-note">✓ Signed in. Your details are filled in.</div>
      ${patientSel}
      ${s.fields.map(f => fieldHTML(f, uid)).join('')}
      ${s.note ? `<p class="full hint" style="font-size:13.5px;color:var(--muted)">ℹ️ ${esc(s.note)}</p>` : ''}
      <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
      <div class="form-msg" role="alert"></div>
      <div class="full" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-primary" type="submit">Send request <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        <span style="font-size:12.5px;color:var(--muted)">🔒 Sent securely to the Manova care team</span>
      </div>
    </form>${successHTML(s.title.replace(/^(Book|Get|Find) an? /i, '') + ' — request received')}`;
    bind(el.querySelector('form'), opts.onDone);
    if (window.Manova && Manova.user) prefill(el.querySelector('form'), Manova.user);
  }

  function prefill(form, u) {
    if (!form || !u) return;
    form.closest('[data-form-wrap], .hub-panel, .panel, section, body')?.classList.add('signed-in');
    const set = (n, v) => { const i = form.querySelector(`[name="${n}"]`); if (i && !i.value && v) i.value = v; };
    set('name', u.name); set('email', u.email); set('phone', u.phone);
    set('city', u.profile && u.profile.city);
    set('blood_group', u.profile && u.profile.blood_group);
  }

  async function api(url, data, method) {
    const opt = { method: method || (data ? 'POST' : 'GET'), credentials: 'same-origin', headers: {} };
    if (data) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(data); }
    let res;
    try { res = await fetch(url, opt); }
    catch (e) { throw new Error('Network error. Please check your connection and try again.'); }
    let j = null;
    try { j = await res.json(); } catch (e) {}
    if (!j) throw new Error('The server did not respond correctly. If you opened this file directly on your computer, forms only work once the site is uploaded to your hosting.');
    if (!j.ok && j.error) throw new Error(j.error);
    return j;
  }

  function bind(form, onDone) {
    if (!form || form.dataset.bound) return;
    form.dataset.bound = 1;
    const wrap = form.parentElement;
    const msg = form.querySelector('.form-msg');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      msg.className = 'form-msg'; msg.textContent = '';
      // validation
      let bad = null;
      form.querySelectorAll('[required]').forEach(i => {
        const ok = i.type === 'checkbox' ? i.checked : i.value.trim() !== '';
        i.style.borderColor = ok ? '' : '#E2502F';
        if (!ok && !bad) bad = i;
      });
      const em = form.querySelector('[type=email]');
      if (!bad && em && em.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value)) { bad = em; em.style.borderColor = '#E2502F'; }
      if (bad) { msg.className = 'form-msg err'; msg.textContent = 'Please complete the highlighted fields.'; bad.focus(); return; }

      const data = {};
      new FormData(form).forEach((v, k) => { data[k] = data[k] ? data[k] + ', ' + v : v; });
      form.querySelectorAll('input[type=checkbox]').forEach(c => {
        if (!c.name || form.querySelectorAll(`input[type=checkbox][name="${c.name}"]`).length > 1) return;
        data[c.name] = c.checked ? (c.value === 'on' ? 'Yes' : c.value) : '';
      });
      data.form_type = form.dataset.form;
      if (data.patient) { data.patient_name = data.patient; delete data.patient; }

      const btn = form.querySelector('[type=submit]');
      const label = btn.innerHTML;
      btn.disabled = true; btn.innerHTML = 'Sending…';
      try {
        const r = await api(apiBase() + 'form', data);
        const ref = wrap.querySelector('.ref'); if (ref) ref.textContent = r.id;
        wrap.classList.add('sent');
        wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.reset();
        if (window.Manova && Manova.user) prefill(form, Manova.user);
        onDone && onDone(r);
      } catch (err) {
        msg.className = 'form-msg err'; msg.textContent = err.message;
      } finally { btn.disabled = false; btn.innerHTML = label; }
    });
    form.querySelectorAll('input,select,textarea').forEach(i => i.addEventListener('input', () => i.style.borderColor = ''));
    wrap.querySelector('[data-again]')?.addEventListener('click', () => wrap.classList.remove('sent'));
  }

  function apiBase() { return (document.body.dataset.root || '') + 'api/'; }

  window.ManovaForms = { schemas: S, render, bind, prefill, api, apiBase, esc, SPECIALTIES, BLOOD };
})();
