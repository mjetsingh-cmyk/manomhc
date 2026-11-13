/* POST /api/form — handles every form on the site: saves it and emails NOTIFY_EMAIL. */
const L = require('./_lib');

module.exports = L.wrap(async (req, res) => {
  if (req.method !== 'POST') L.fail('Method not allowed', 405);
  L.sameOrigin(req);
  const inp = L.body(req);
  const type = L.clean(inp.form_type, 40);
  if (!L.REQUEST_LABELS[type]) L.fail('Unknown form.');
  if (inp.website) return L.json(res, { ok: true, id: 'OK' }); // honeypot
  await L.rateLimit(req, 'form', 12, 600);

  const user = await L.currentUser(req);
  const fields = {};
  for (const [k, v] of Object.entries(inp)) {
    if (['form_type', 'website', 'consent'].includes(k) || !/^[a-z0-9_]{1,40}$/.test(k)) continue;
    const val = L.clean(v, ['message', 'details', 'additional_info'].includes(k) ? 4000 : 600);
    if (val) fields[k] = val;
    if (Object.keys(fields).length >= 45) break;
  }
  if (user) {
    fields.name = fields.name || user.name;
    fields.email = fields.email || user.email;
    if (!fields.phone && user.phone) fields.phone = user.phone;
  }
  const email = fields.email || '', phone = fields.phone || '';
  if (type !== 'waitlist' && !fields.name && !fields.hospital_name) L.fail('Please enter your name.');
  if (!email && !phone) L.fail('Please give an email address or phone number so we can reach you.');
  if (email && !L.validEmail(email)) L.fail('Please enter a valid email address.');
  if (phone && !L.validPhone(phone)) L.fail('Please enter a valid phone number.');
  if (type === 'hospital' && !inp.consent) L.fail('Please confirm the consent checkbox.');

  const label = L.REQUEST_LABELS[type];
  const now = new Date().toISOString();
  const rec = { id: L.newId(type.slice(0, 3).toUpperCase() + '-'), type, label, status: 'New', user_id: user ? user.id : null, fields, created: now, updated: now };
  await L.saveSubmission(rec);

  const pretty = {};
  for (const [k, v] of Object.entries(fields)) pretty[k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())] = v;
  pretty.Reference = rec.id;
  pretty.Submitted = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
  pretty.Account = user ? `Registered patient (${user.email})` : 'Guest (not signed in)';
  const mailed = await L.sendMail(L.CFG.NOTIFY_EMAIL, `[${label}] ${fields.name || fields.hospital_name || email} · ${rec.id}`,
    L.mailHTML('New ' + label, 'A new submission arrived from <b>manovahealthconnect.com</b>. Reply to this email to respond directly to the sender.', pretty,
      `Manage all submissions in your admin panel: ${L.h(L.CFG.SITE_URL)}/admin`), email);

  if (email) {
    const first = (fields.name || '').split(' ')[0] || 'there';
    await L.sendMail(email, `We received your request · ${rec.id}`, L.mailHTML('Request received',
      `Hi ${L.h(first)},<br><br>Thank you for contacting Manova Health Connect. We have received your <b>${L.h(label.toLowerCase())}</b> (reference <b>${rec.id}</b>). Our team will get back to you within 24 hours.<br><br>If this is a medical emergency, please call <b>112</b> (or <b>108</b> for an ambulance) right away.`,
      {}, 'Manova Health Connect · ' + L.h(L.CFG.NOTIFY_EMAIL)), L.CFG.NOTIFY_EMAIL);
  }
  L.json(res, { ok: true, id: rec.id, mailed });
});
