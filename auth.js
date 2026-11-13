/* /api/auth?action=... — patient accounts: register, login, profile, family, requests, password reset. */
const crypto = require('crypto');
const L = require('./_lib');

function sanitize(v, depth = 0) {
  if (depth > 3) return null;
  if (Array.isArray(v)) return v.slice(0, 60).map(x => sanitize(x, depth + 1));
  if (v && typeof v === 'object') { const o = {}; Object.entries(v).slice(0, 60).forEach(([k, x]) => { o[L.clean(k, 40)] = sanitize(x, depth + 1); }); return o; }
  if (typeof v === 'boolean') return v;
  return L.clean(v, 1500);
}

module.exports = L.wrap(async (req, res) => {
  const action = String(req.query.action || '');
  if (req.method === 'POST') L.sameOrigin(req);
  const inp = L.body(req);

  switch (action) {
    case 'me': {
      const u = await L.currentUser(req);
      return L.json(res, u ? { ok: true, user: L.publicUser(u) } : { ok: false, user: null });
    }

    case 'register': {
      L.needSecret();
      await L.rateLimit(req, 'register', 6, 3600);
      if (inp.website) L.fail('Request blocked.');
      const name = L.clean(inp.name, 80), email = L.clean(inp.email, 120).toLowerCase(), phone = L.clean(inp.phone, 20), pass = String(inp.password || '');
      if (name.length < 2) L.fail('Please enter your full name.');
      if (!L.validEmail(email)) L.fail('Please enter a valid email address.');
      if (phone && !L.validPhone(phone)) L.fail('Please enter a valid phone number.');
      if (pass.length < 8) L.fail('Password must be at least 8 characters.');
      if (!inp.consent) L.fail('Please accept the Terms and Privacy Policy.');
      const id = L.newId('U');
      const claimed = await L.redis('SET', 'email:' + email, id, 'NX');
      if (claimed !== 'OK') L.fail('An account with this email already exists. Please sign in.');
      const now = new Date().toISOString();
      const user = { id, name, email, phone, password: L.hashPassword(pass), created: now, profile: {}, contacts: [], family: [], prefs: { email_updates: true, health_tips: true, language: 'English' } };
      await L.saveUser(user);
      await L.redis('SADD', 'users', id);
      L.startSession(res, id);
      await L.sendMail(L.CFG.NOTIFY_EMAIL, `[New Patient Account] ${name}`, L.mailHTML('New patient registered', 'A new patient account was created on the website.',
        { Name: name, Email: email, Phone: phone, 'Account ID': id, Date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }), email);
      await L.sendMail(email, 'Welcome to Manova Health Connect', L.mailHTML(`Welcome, ${name.split(' ')[0]}!`,
        `Your Manova account is ready. Sign in any time at <a href="${L.h(L.CFG.SITE_URL)}/login.html">${L.h(L.CFG.SITE_URL)}/login.html</a> to complete your health profile, add family members and emergency contacts, and request appointments, home care, blood or a second opinion.`), L.CFG.NOTIFY_EMAIL);
      return L.json(res, { ok: true, user: L.publicUser(user) });
    }

    case 'login': {
      L.needSecret();
      await L.rateLimit(req, 'login', 10, 900);
      const u = await L.findUserByEmail(L.clean(inp.email, 120));
      if (!u || !L.checkPassword(String(inp.password || ''), u.password)) L.fail('Incorrect email or password.');
      L.startSession(res, u.id);
      return L.json(res, { ok: true, user: L.publicUser(u) });
    }

    case 'logout': L.endSession(res); return L.json(res, { ok: true });

    case 'forgot': {
      await L.rateLimit(req, 'forgot', 5, 3600);
      const u = await L.findUserByEmail(L.clean(inp.email, 120));
      if (u) {
        const token = crypto.randomBytes(24).toString('hex');
        await L.redis('SET', 'reset:' + crypto.createHash('sha256').update(token).digest('hex'), u.id, 'EX', 3600);
        const link = `${L.CFG.SITE_URL}/reset.html?token=${token}`;
        await L.sendMail(u.email, 'Reset your Manova password', L.mailHTML('Reset your password',
          `We received a request to reset your password. Click the button below within 1 hour:<br><br><a href="${L.h(link)}" style="display:inline-block;background:#0e7c7b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Set a new password</a><br><br>If you did not ask for this, you can ignore this email.`));
      }
      return L.json(res, { ok: true });
    }

    case 'reset': {
      await L.rateLimit(req, 'reset', 10, 3600);
      const pass = String(inp.password || '');
      if (pass.length < 8) L.fail('Password must be at least 8 characters.');
      const key = 'reset:' + crypto.createHash('sha256').update(L.clean(inp.token, 100)).digest('hex');
      const uid = await L.redis('GET', key);
      const u = uid && await L.getUser(uid);
      if (!u) L.fail('This reset link is invalid or has expired. Please request a new one.');
      u.password = L.hashPassword(pass); await L.saveUser(u); await L.redis('DEL', key);
      return L.json(res, { ok: true });
    }

    case 'save': {
      const u = await L.requireUser(req);
      const section = L.clean(inp.section, 20);
      if (!['basic', 'profile', 'contacts', 'family', 'prefs'].includes(section)) L.fail('Unknown section.');
      const data = sanitize(inp.data);
      if (section === 'contacts' && (data || []).length > 5) L.fail('You can add up to 5 emergency contacts.');
      if (section === 'family' && (data || []).length > 12) L.fail('You can add up to 12 family members.');
      if (section === 'basic') {
        const name = L.clean(data && data.name, 80), phone = L.clean(data && data.phone, 20);
        if (name.length < 2) L.fail('Please enter your name.');
        if (phone && !L.validPhone(phone)) L.fail('Please enter a valid phone number.');
        u.name = name; u.phone = phone;
      } else u[section] = data || (section === 'profile' || section === 'prefs' ? {} : []);
      await L.saveUser(u);
      return L.json(res, { ok: true, user: L.publicUser(u) });
    }

    case 'password': {
      const u = await L.requireUser(req);
      await L.rateLimit(req, 'pwchange', 8, 900);
      if (!L.checkPassword(String(inp.current || ''), u.password)) L.fail('Current password is incorrect.');
      if (String(inp.new || '').length < 8) L.fail('New password must be at least 8 characters.');
      u.password = L.hashPassword(String(inp.new)); await L.saveUser(u);
      return L.json(res, { ok: true });
    }

    case 'requests': {
      const u = await L.requireUser(req);
      const ids = await L.redis('SMEMBERS', 'usersubs:' + u.id);
      return L.json(res, { ok: true, requests: await L.listSubmissions(ids || []) });
    }

    case 'cancel': {
      const u = await L.requireUser(req);
      const s = await L.getJSON('sub:' + L.clean(inp.id, 40));
      if (!s || s.user_id !== u.id || ['Completed', 'Cancelled'].includes(s.status)) L.fail('This request cannot be cancelled.');
      s.status = 'Cancelled'; s.updated = new Date().toISOString(); await L.setJSON('sub:' + s.id, s);
      await L.sendMail(L.CFG.NOTIFY_EMAIL, `[Cancelled by patient] ${s.label} · ${s.id}`, L.mailHTML('Request cancelled by patient', `${L.h(u.name)} (${L.h(u.email)}) cancelled request <b>${L.h(s.id)}</b>.`));
      return L.json(res, { ok: true });
    }

    case 'export': {
      const u = await L.requireUser(req);
      const ids = await L.redis('SMEMBERS', 'usersubs:' + u.id);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="manova-my-data.json"');
      return res.end(JSON.stringify({ account: L.publicUser(u), requests: await L.listSubmissions(ids || []) }, null, 2));
    }

    case 'delete': {
      const u = await L.requireUser(req);
      if (!L.checkPassword(String(inp.password || ''), u.password)) L.fail('Password is incorrect.');
      const ids = (await L.redis('SMEMBERS', 'usersubs:' + u.id)) || [];
      for (const s of await L.listSubmissions(ids)) { s.user_id = 'deleted'; await L.setJSON('sub:' + s.id, s); }
      await L.redis('DEL', 'user:' + u.id, 'email:' + u.email, 'usersubs:' + u.id);
      await L.redis('SREM', 'users', u.id);
      await L.sendMail(L.CFG.NOTIFY_EMAIL, '[Account deleted] ' + u.name, L.mailHTML('Patient deleted their account', `${L.h(u.name)} (${L.h(u.email)}) deleted their account.`));
      L.endSession(res);
      return L.json(res, { ok: true });
    }

    default: L.fail('Unknown action.', 404);
  }
});
