/* /admin (rewritten to /api/admin) — view submissions & patients, update status, export CSV.
   Sign in with the ADMIN_PASSWORD environment variable. */
const crypto = require('crypto');
const L = require('./_lib');
const { h } = L;

function form(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const out = {}; new URLSearchParams(String(req.body || '')).forEach((v, k) => out[k] = v); return out;
}
const isAdmin = req => L.readToken(L.cookies(req).ma) === 'admin';
const redirect = (res, to) => { res.statusCode = 303; res.setHeader('Location', to); res.end(); };
const pwOk = p => { const a = Buffer.from(String(p)), b = Buffer.from(L.CFG.ADMIN_PASSWORD); return a.length === b.length && crypto.timingSafeEqual(a, b); };

const CSS = `*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f3f6f5;color:#0b1f2a}
.top{background:#0b3b3a;color:#fff;padding:14px 24px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.top b span{color:#7ee0cf}
.wrap{max-width:1200px;margin:0 auto;padding:24px}a{color:#0e7c7b}
.btn{background:#0e7c7b;color:#fff;border:0;padding:9px 14px;border-radius:8px;cursor:pointer;font-weight:600;text-decoration:none;display:inline-block;font-size:14px}
.btn.ghost{background:transparent;border:1px solid #cfdcd9;color:#0b1f2a}.top .btn.ghost{color:#fff;border-color:#2f6b69}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.stat{background:#fff;border-radius:12px;padding:16px;border:1px solid #e3ebe9}.stat b{font-size:26px;display:block}.stat small{color:#5b6b70}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}.tabs a{padding:8px 12px;border-radius:999px;background:#fff;border:1px solid #e3ebe9;text-decoration:none;color:#0b1f2a;font-size:13px}.tabs a.on{background:#0b1f2a;color:#fff}
.card{background:#fff;border:1px solid #e3ebe9;border-radius:12px;padding:16px;margin-bottom:12px}.card h3{margin:0 0 4px;font-size:16px}.meta{color:#5b6b70;font-size:12px;margin-bottom:10px}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:12px;font-weight:600;background:#e6f4f1;color:#0e7c7b}.pill.New{background:#fff1e6;color:#c25a12}.pill.Cancelled{background:#fdecea;color:#b03a2e}.pill.Completed{background:#eceff1;color:#455a64}
dl{display:grid;grid-template-columns:180px 1fr;gap:4px 14px;margin:0 0 12px;font-size:14px}dt{color:#5b6b70}dd{margin:0;white-space:pre-wrap;word-break:break-word}
form.inline{display:flex;gap:8px;flex-wrap:wrap;align-items:center;border-top:1px dashed #e3ebe9;padding-top:10px}
select,input[type=text],input[type=password],input[type=search]{padding:8px 10px;border:1px solid #cfdcd9;border-radius:8px;font-size:14px}
table{width:100%;border-collapse:collapse;background:#fff;font-size:14px}th,td{padding:10px;border-bottom:1px solid #eef2f1;text-align:left}th{background:#f7faf9;color:#5b6b70}
.login{max-width:380px;margin:12vh auto;background:#fff;padding:28px;border-radius:14px;border:1px solid #e3ebe9}.login input{width:100%;margin:10px 0}
.err{background:#fdecea;color:#b03a2e;padding:10px;border-radius:8px;font-size:14px}@media(max-width:640px){dl{grid-template-columns:1fr}}`;
const page = (body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Admin · Manova Health Connect</title><style>${CSS}</style></head><body>${body}</body></html>`;
const send = (res, html, code = 200) => { res.statusCode = code; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex'); res.end(html); };

function loginPage(err) {
  return page(`<div class="login"><h2 style="margin-top:0">Manova Admin</h2>${err ? `<p class="err">${h(err)}</p>` : ''}
<form method="post" action="/admin"><input type="hidden" name="do" value="login"><input type="password" name="password" placeholder="Admin password" required autofocus><button class="btn" style="width:100%">Sign in</button></form>
<p style="font-size:12px;color:#5b6b70">The password is the <code>ADMIN_PASSWORD</code> environment variable in Vercel.</p></div>`);
}

module.exports = L.wrap(async (req, res) => {
  if (req.method === 'POST') {
    L.sameOrigin(req);
    const f = form(req);
    if (f.do === 'login') {
      if (L.CFG.ADMIN_PASSWORD.length < 10) return send(res, loginPage('ADMIN_PASSWORD is not set (or is shorter than 10 characters). Add it in Vercel → Settings → Environment Variables, then redeploy.'));
      await L.rateLimit(req, 'admin', 8, 900);
      if (!pwOk(f.password || '')) return send(res, loginPage('Wrong password.'));
      L.setCookie(res, 'ma', L.makeToken('admin', 1), 86400, 'Strict');
      return redirect(res, '/admin');
    }
    if (!isAdmin(req)) return redirect(res, '/admin');
    if (f.do === 'logout') { L.setCookie(res, 'ma', '', 0, 'Strict'); return redirect(res, '/admin'); }
    if (f.do === 'status' && L.STATUSES.includes(f.status)) {
      const s = await L.getJSON('sub:' + L.clean(f.id, 40));
      if (s) {
        const note = L.clean(f.note, 500);
        s.status = f.status; if (note) s.note = note; s.updated = new Date().toISOString();
        await L.setJSON('sub:' + s.id, s);
        if (f.notify && s.fields.email) await L.sendMail(s.fields.email, `Update on your request ${s.id}: ${s.status}`, L.mailHTML('Your request is now: ' + s.status,
          `Your <b>${h(s.label.toLowerCase())}</b> (reference <b>${h(s.id)}</b>) has been updated to <b>${h(s.status)}</b>.${note ? `<br><br><b>Note from our team:</b> ${h(note)}` : ''}<br><br>Signed-in patients can track every request at <a href="${h(L.CFG.SITE_URL)}/dashboard.html">${h(L.CFG.SITE_URL)}/dashboard.html</a>.`), L.CFG.NOTIFY_EMAIL);
      }
      return redirect(res, '/admin?' + new URLSearchParams({ type: f.type || '' }) + '#' + encodeURIComponent(f.id || ''));
    }
    if (f.do === 'delete') {
      const s = await L.getJSON('sub:' + L.clean(f.id, 40));
      if (s) { await L.redis('DEL', 'sub:' + s.id); await L.redis('ZREM', 'subs', s.id); if (s.user_id) await L.redis('SREM', 'usersubs:' + s.user_id, s.id); }
      return redirect(res, '/admin');
    }
    return redirect(res, '/admin');
  }

  if (!isAdmin(req)) return send(res, loginPage(''));

  const q = req.query || {};
  const subs = await L.listSubmissions((await L.redis('ZREVRANGE', 'subs', 0, 1999)) || []);

  if (q.export === 'csv') {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Reference', 'Type', 'Status', 'Date', 'Name', 'Email', 'Phone', 'All details'].map(esc).join(',')];
    subs.forEach(s => { const f = s.fields; lines.push([s.id, s.label, s.status, s.created, f.name || f.hospital_name, f.email, f.phone, Object.entries(f).map(([k, v]) => `${k}: ${v}`).join(' | ')].map(esc).join(',')); });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="manova-submissions-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.end('﻿' + lines.join('\n'));
  }

  const userIds = (await L.redis('SMEMBERS', 'users')) || [];
  const users = (await L.mgetJSON(userIds.map(i => 'user:' + i))).sort((a, b) => b.created.localeCompare(a.created));
  const view = q.view || 'subs', type = q.type || '', term = String(q.q || '').toLowerCase();
  const counts = {}; subs.forEach(s => counts[s.type] = (counts[s.type] || 0) + 1);
  const fresh = subs.filter(s => s.status === 'New').length;

  let main = '';
  if (view === 'users') {
    main = '<table><tr><th>Name</th><th>Email</th><th>Phone</th><th>Blood group</th><th>Family</th><th>Joined</th></tr>' +
      (users.filter(u => !term || (u.name + u.email + (u.phone || '')).toLowerCase().includes(term)).map(u =>
        `<tr><td>${h(u.name)}</td><td><a href="mailto:${h(u.email)}">${h(u.email)}</a></td><td>${h(u.phone || '')}</td><td>${h((u.profile || {}).blood_group || '—')}</td><td>${(u.family || []).length}</td><td>${h(new Date(u.created).toLocaleDateString('en-IN'))}</td></tr>`).join('') || '<tr><td colspan="6">No patient accounts yet.</td></tr>') + '</table>';
  } else {
    const list = subs.filter(s => (!type || s.type === type) && (!term || JSON.stringify(s).toLowerCase().includes(term)));
    main = list.map(s => {
      const f = s.fields;
      const dl = Object.entries(f).map(([k, v]) => `<dt>${h(k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}</dt><dd>${k === 'email' ? `<a href="mailto:${h(v)}">${h(v)}</a>` : k === 'phone' ? `<a href="tel:${h(v)}">${h(v)}</a>` : h(v)}</dd>`).join('');
      return `<div class="card" id="${h(s.id)}"><h3>${h(s.label)} — ${h(f.name || f.hospital_name || f.email || '')} <span class="pill ${h(s.status.replace(/\s/g, ''))}">${h(s.status)}</span></h3>
<div class="meta">${h(s.id)} · ${h(new Date(s.created).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }))} IST · ${s.user_id ? 'Registered patient' : 'Guest'}${s.note ? ' · Note: ' + h(s.note) : ''}</div><dl>${dl}</dl>
<form method="post" action="/admin" class="inline"><input type="hidden" name="do" value="status"><input type="hidden" name="id" value="${h(s.id)}"><input type="hidden" name="type" value="${h(type)}">
<select name="status">${L.STATUSES.map(st => `<option${st === s.status ? ' selected' : ''}>${h(st)}</option>`).join('')}</select>
<input type="text" name="note" placeholder="Note to patient (optional)" style="flex:1;min-width:180px"><label style="font-size:13px"><input type="checkbox" name="notify" value="1" checked> Email update</label><button class="btn">Update</button></form>
<form method="post" action="/admin" style="margin-top:8px" onsubmit="return confirm('Delete this submission permanently?')"><input type="hidden" name="do" value="delete"><input type="hidden" name="id" value="${h(s.id)}"><button class="btn ghost" style="font-size:12px;padding:5px 10px">Delete</button></form></div>`;
    }).join('') || '<p>No submissions yet.</p>';
  }

  send(res, page(`<div class="top"><b>MANOVA <span>ADMIN</span></b><div style="display:flex;gap:8px"><a class="btn ghost" href="/" target="_blank">View site</a><a class="btn ghost" href="/admin?export=csv">Export CSV</a>
<form method="post" action="/admin" style="margin:0"><input type="hidden" name="do" value="logout"><button class="btn">Log out</button></form></div></div>
<div class="wrap"><div class="stats"><div class="stat"><b>${subs.length}</b><small>Total submissions</small></div><div class="stat"><b>${fresh}</b><small>New / unhandled</small></div><div class="stat"><b>${users.length}</b><small>Patient accounts</small></div><div class="stat"><b>${counts.hospital || 0}</b><small>Hospital registrations</small></div></div>
<div class="tabs"><a href="/admin" class="${view === 'subs' && !type ? 'on' : ''}">All submissions</a>${Object.entries(L.REQUEST_LABELS).filter(([k]) => counts[k]).map(([k, l]) => `<a href="/admin?type=${k}" class="${type === k ? 'on' : ''}">${h(l)} (${counts[k]})</a>`).join('')}<a href="/admin?view=users" class="${view === 'users' ? 'on' : ''}">Patients (${users.length})</a></div>
<form method="get" action="/admin" style="margin-bottom:14px;display:flex;gap:8px"><input type="hidden" name="view" value="${h(view)}"><input type="hidden" name="type" value="${h(type)}"><input type="search" name="q" value="${h(q.q || '')}" placeholder="Search name, email, phone, reference…" style="flex:1"><button class="btn">Search</button></form>
${main}</div>`));
});
