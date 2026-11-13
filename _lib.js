/* Shared helpers for Manova's Vercel functions: storage (Upstash Redis), email (Resend), sessions, security.
   Files starting with "_" are not public endpoints on Vercel. All settings come from Vercel Environment Variables. */
const crypto = require('crypto');

const CFG = {
  NOTIFY_EMAIL: process.env.NOTIFY_EMAIL || 'info@manovahealthconnect.com',
  FROM_EMAIL: process.env.FROM_EMAIL || 'Manova Health Connect <onboarding@resend.dev>',
  SITE_URL: (process.env.SITE_URL || 'https://manovahealthconnect.com').replace(/\/$/, ''),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  SECRET: process.env.SESSION_SECRET || '',
  RESEND_KEY: process.env.RESEND_API_KEY || '',
  REDIS_URL: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '',
  REDIS_TOKEN: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '',
};

const REQUEST_LABELS = {
  contact: 'Contact Message', hospital: 'Hospital Registration', waitlist: 'App Early Access',
  callback: 'Callback Request', opd: 'OPD Appointment Request', homecare: 'Home Care / Minor OT Request',
  blood: 'Blood Requirement', diagnostic: 'Diagnostic Test Booking', second_opinion: 'Second Opinion Request',
  cost_estimate: 'Treatment Cost Estimate', admission: 'Digital Admission Request', scheme_help: 'Govt. Scheme Enrolment Help',
};
const STATUSES = ['New', 'In review', 'Confirmed', 'Completed', 'Cancelled'];

/* ---------- errors & responses ---------- */
class HttpError extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }
const fail = (msg, code) => { throw new HttpError(msg, code); };
function json(res, data, code = 200) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (e) {
      if (e instanceof HttpError) return json(res, { ok: false, error: e.message }, e.code);
      console.error('Manova error:', e);
      json(res, { ok: false, error: 'Something went wrong on our side. Please try again, or email ' + CFG.NOTIFY_EMAIL }, 500);
    }
  };
}

/* ---------- input ---------- */
function body(req) {
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  return b && typeof b === 'object' ? b : {};
}
function clean(v, max = 2000) {
  if (Array.isArray(v)) v = v.filter(x => typeof x !== 'object').join(', ');
  if (v === null || v === undefined || typeof v === 'object') return '';
  return String(v).replace(/\0/g, '').trim().slice(0, max);
}
const validEmail = e => /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i.test(e) && e.length <= 120;
const validPhone = p => /^[0-9 +()\-]{7,20}$/.test(p);
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newId = (p = '') => p + crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
const ipHash = req => crypto.createHash('sha256').update(String((req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket?.remoteAddress || 'x')).digest('hex').slice(0, 24);

function sameOrigin(req) {
  const o = req.headers.origin || req.headers.referer || '';
  if (!o) return;
  let host; try { host = new URL(o).hostname; } catch { return fail('Request blocked.', 403); }
  const strip = x => String(x || '').toLowerCase().replace(/:\d+$/, '').replace(/^www\./, '');
  const reqHost = strip(req.headers['x-forwarded-host'] || req.headers.host);
  if (strip(host) !== reqHost) fail('Request blocked.', 403);
}

/* ---------- Redis (Upstash REST) ---------- */
async function redis(...cmd) {
  if (!CFG.REDIS_URL || !CFG.REDIS_TOKEN) fail('The database is not connected yet. In Vercel, open Storage and connect Upstash Redis to this project, then redeploy.', 503);
  const r = await fetch(CFG.REDIS_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + CFG.REDIS_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd.map(String)) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error('Redis: ' + (j.error || r.status));
  return j.result;
}
const getJSON = async k => { const v = await redis('GET', k); try { return v ? JSON.parse(v) : null; } catch { return null; } };
const setJSON = (k, v, ex) => ex ? redis('SET', k, JSON.stringify(v), 'EX', ex) : redis('SET', k, JSON.stringify(v));
async function mgetJSON(keys) {
  if (!keys.length) return [];
  const out = [];
  for (let i = 0; i < keys.length; i += 200) {
    const vals = await redis('MGET', ...keys.slice(i, i + 200));
    vals.forEach(v => { try { if (v) out.push(JSON.parse(v)); } catch {} });
  }
  return out;
}

async function rateLimit(req, key, max, windowSec) {
  const k = `rl:${key}:${ipHash(req)}`;
  const n = await redis('INCR', k);
  if (n === 1) await redis('EXPIRE', k, windowSec);
  if (n > max) fail('Too many attempts. Please wait a few minutes and try again.', 429);
}

/* ---------- users & submissions ---------- */
const userKey = id => 'user:' + id;
async function getUser(id) { return id ? getJSON(userKey(id)) : null; }
async function saveUser(u) { u.updated = new Date().toISOString(); await setJSON(userKey(u.id), u); return u; }
async function findUserByEmail(email) { const id = await redis('GET', 'email:' + email.toLowerCase()); return id ? getUser(id) : null; }
function publicUser(u) { const { password, ...rest } = u; return rest; }

async function saveSubmission(s) {
  await setJSON('sub:' + s.id, s);
  await redis('ZADD', 'subs', Date.parse(s.created), s.id);
  if (s.user_id) await redis('SADD', 'usersubs:' + s.user_id, s.id);
}
async function listSubmissions(ids) { return (await mgetJSON(ids.map(i => 'sub:' + i))).sort((a, b) => b.created.localeCompare(a.created)); }

/* ---------- passwords (scrypt) ---------- */
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [alg, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const a = crypto.scryptSync(String(pw), salt, 64), b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- signed cookies ---------- */
function needSecret() { if (CFG.SECRET.length < 16) fail('SESSION_SECRET is missing. Add it in Vercel → Settings → Environment Variables, then redeploy.', 503); }
const sign = v => crypto.createHmac('sha256', CFG.SECRET).update(v).digest('base64url');
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
  return out;
}
function setCookie(res, name, value, maxAge, sameSite = 'Lax') {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'Secure', `SameSite=${sameSite}`, `Max-Age=${maxAge}`];
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(prev ? [].concat(prev) : []), parts.join('; ')]);
}
function makeToken(sub, days) { needSecret(); const v = `${sub}.${Date.now() + days * 864e5}`; return `${v}.${sign(v)}`; }
function readToken(tok) {
  if (!tok || CFG.SECRET.length < 16) return null;
  const i = tok.lastIndexOf('.'); if (i < 0) return null;
  const v = tok.slice(0, i), s = tok.slice(i + 1), good = sign(v);
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  const [sub, exp] = v.split('.');
  return +exp > Date.now() ? sub : null;
}
async function currentUser(req) { return getUser(readToken(cookies(req).ms)); }
async function requireUser(req) { const u = await currentUser(req); if (!u) fail('Please sign in to continue.', 401); return u; }
const startSession = (res, uid) => setCookie(res, 'ms', makeToken(uid, 14), 14 * 86400);
const endSession = res => setCookie(res, 'ms', '', 0);

/* ---------- email (Resend) ---------- */
function mailHTML(title, intro, fields = {}, footer = '') {
  const rows = Object.entries(fields).filter(([, v]) => v !== '' && v != null).map(([k, v]) =>
    `<tr><td style="padding:10px 14px;border-bottom:1px solid #e8eeec;color:#5b6b70;font-size:13px;width:38%;vertical-align:top">${h(k)}</td><td style="padding:10px 14px;border-bottom:1px solid #e8eeec;color:#0b1f2a;font-size:14px;white-space:pre-wrap">${h(v).replace(/\n/g, '<br>')}</td></tr>`).join('');
  const table = rows ? `<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e8eeec;margin-top:16px">${rows}</table>` : '';
  return `<!doctype html><html><body style="margin:0;background:#f4f7f6;font-family:Segoe UI,Arial,sans-serif"><div style="max-width:640px;margin:0 auto;padding:28px 18px">
<div style="background:#0b3b3a;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0;font-weight:700;letter-spacing:.5px">MANOVA <span style="color:#7ee0cf">HEALTH CONNECT</span></div>
<div style="background:#fff;padding:24px 22px;border-radius:0 0 12px 12px"><h2 style="margin:0 0 8px;color:#0b1f2a;font-size:20px">${h(title)}</h2>
<p style="margin:0;color:#3e5157;font-size:14px;line-height:1.6">${intro}</p>${table}${footer ? `<p style="margin:18px 0 0;color:#6b7c80;font-size:12px;line-height:1.6">${footer}</p>` : ''}</div></div></body></html>`;
}
async function sendMail(to, subject, html, replyTo) {
  if (!CFG.RESEND_KEY) { console.warn('RESEND_API_KEY not set; email skipped:', subject); return false; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: 'Bearer ' + CFG.RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: CFG.FROM_EMAIL, to: [to], subject: subject.replace(/[\r\n]+/g, ' ').slice(0, 200), html, ...(replyTo && validEmail(replyTo) ? { reply_to: replyTo } : {}) }),
    });
    if (!r.ok) { console.error('Resend error', r.status, await r.text()); return false; }
    return true;
  } catch (e) { console.error('Resend failed', e); return false; }
}

module.exports = { CFG, REQUEST_LABELS, STATUSES, HttpError, fail, json, wrap, body, clean, validEmail, validPhone, h, newId, ipHash, sameOrigin,
  redis, getJSON, setJSON, mgetJSON, rateLimit, getUser, saveUser, findUserByEmail, publicUser, saveSubmission, listSubmissions,
  hashPassword, checkPassword, cookies, setCookie, makeToken, readToken, currentUser, requireUser, startSession, endSession, needSecret, sign, mailHTML, sendMail };
