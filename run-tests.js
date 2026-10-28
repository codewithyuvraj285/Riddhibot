/* Runs the real Code.gs against an in-memory fake of SpreadsheetApp / CacheService / UrlFetchApp etc.
   Usage: node backend/test/run-tests.js */
const fs = require('fs'), vm = require('vm'), crypto = require('crypto'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');

function makeEnv(opts = {}) {
  const props = Object.assign({ SPREADSHEET_ID: 'SHEET1', ANTHROPIC_API_KEY: 'test-key' }, opts.props || {});
  class Range { constructor(s, r, c, nr, nc) { Object.assign(this, { s, r, c, nr, nc }); }
    getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(((this.s.data[this.r - 1 + i] || [])[this.c - 1 + j]) ?? ''); o.push(row); } return o; }
    getValue() { return this.getValues()[0][0]; }
    setValues(v) { if (this.s.failWrites) throw new Error('write denied'); v.forEach((row, i) => row.forEach((x, j) => this.put(this.r + i, this.c + j, x))); return this; }
    setValue(x) { if (this.s.failWrites) throw new Error('write denied'); this.put(this.r, this.c, x); return this; }
    put(r, c, x) { while (this.s.data.length < r) this.s.data.push([]); const row = this.s.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = x; }
    setNumberFormat(f) { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.s.fmt[(this.r + i) + ',' + (this.c + j)] = f; return this; }
    getDataValidation() { return this.s.validation && this.s.validation[this.c] ? { getCriteriaType: () => 'VALUE_IN_LIST', getCriteriaValues: () => [this.s.validation[this.c]] } : null; } }
  class Sheet { constructor(name, rows) { this.name = name; this.data = rows || []; this.fmt = {}; }
    getName() { return this.name; }
    getLastRow() { let n = 0; this.data.forEach((r, i) => { if (r.some(v => v !== '')) n = i + 1; }); return n; }
    getLastColumn() { return this.data.reduce((m, r) => Math.max(m, r.length), 0); }
    getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
    getDataRange() { return new Range(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); } }
  const sheets = opts.sheets || [];
  const ss = { getSheets: () => sheets, insertSheet: n => { const s = new Sheet(n); sheets.push(s); return s; } };
  const cache = new Map(), pstore = props;
  const ai = { calls: 0, handler: opts.ai || (() => ({ reply: 'Thanks! What problem are you solving?', quick_replies: ['Website', 'App'], summary: 'Visitor enquiry.', lead: {}, requirements: {}, ready_to_finalize: false })) };
  const ctx = {
    console, Math, Date, JSON, String, Number, Array, Object, RegExp, Error, isNaN, parseInt,
    SpreadsheetApp: { openById: id => { if (opts.denyAccess || id !== 'SHEET1') throw new Error('No access'); return ss; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => pstore[k] ?? null, setProperty: (k, v) => { pstore[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: k => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; } }) },
    Utilities: {
      formatDate: (d, tz, f) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
        return f.replace('yyyy', p.year).replace('MM', p.month).replace('dd', p.day).replace('HH', p.hour).replace('mm', p.minute).replace('ss', p.second); },
      computeDigest: (a, s) => [...crypto.createHash('sha256').update(s).digest()].map(b => b > 127 ? b - 256 : b),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' } },
    UrlFetchApp: { fetch: (url, o) => { ai.calls++; const payload = JSON.parse(o.payload); ai.last = payload;
      const r = ai.handler(payload, ai.calls);
      if (r && r.__http) return { getResponseCode: () => r.__http, getContentText: () => 'err' };
      return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ content: [{ type: 'text', text: typeof r === 'string' ? r : JSON.stringify(r) }] }) }; } },
    Logger: { log() {} }
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const call = body => JSON.parse(ctx.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).s);
  return { ctx, call, sheets, ai, props };
}
const H = {
  leads: ['Lead ID', 'Conversation ID', 'Date & Time', 'Client Name', 'Company', 'Email', 'Phone', 'Country', 'Requested Service', 'Problem Summary', 'Project Requirements', 'Budget', 'Currency', 'Timeline', 'Lead Status', 'Priority', 'Conversation Summary', 'Report Status', 'Assigned Person', 'Follow-up Date'],
  chat: ['Message ID', 'Conversation ID', 'Lead ID', 'Timestamp', 'Sender', 'Message Text', 'Content Type'],
  req: ['Lead ID', 'Conversation ID', 'Project Type', 'Current Problem', 'Expected Solution', 'Requested Features', 'Integrations', 'Target Users', 'Platform', 'Technical Constraints', 'Existing System', 'Success Criteria', 'Missing Information', 'Recommendations', 'Final Report', 'Last Updated']
};
const fresh = (o = {}) => { const e = makeEnv(Object.assign({}, o, { sheets: o.sheets || [mk('All Leads', H.leads), mk('Chat History', H.chat), mk('Requirements', H.req), mk('Instructions', null, [['Rule', 'Never promise delivery dates']])] })); return e; };
function mk(name, headers, rows) { const E = makeEnv({}); /* reuse Sheet class via a throwaway env */ const s = E.sheets; const sh = new (Object.getPrototypeOf(E.ctx.SpreadsheetApp.openById('SHEET1').insertSheet('x')).constructor)(name, headers ? [headers.slice()] : (rows || [])); return sh; }
const uid = () => crypto.randomUUID();
let pass = 0, failN = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  PASS ' + name); } catch (e) { failN++; console.log('  FAIL ' + name + '\n       ' + e.message); } };
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ' expected ' + JSON.stringify(b) + ' got ' + JSON.stringify(a)); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const rows = (e, i) => e.sheets[i].data.slice(1).filter(r => r.some(v => v !== ''));
const base = (o = {}) => Object.assign({ action: 'chat', conversation_id: uid(), message_id: uid(), message: 'I need a billing system', lead: {}, history: [] }, o);

console.log('Backend tests (real Code.gs, fake Google services)');
t('ping works and reports config without secrets', () => { const e = fresh(); const r = e.call({ action: 'ping' }); ok(r.ok && r.ai === true && r.sheet === true); ok(!JSON.stringify(r).includes('test-key')); });
t('chat saves lead, customer + assistant messages, requirements', () => {
  const e = fresh({ ai: () => ({ reply: 'Which platform?', quick_replies: ['Web'], summary: 'Billing system enquiry', lead: { name: 'Asha', service: 'Custom Software Development', email: 'asha@x.com' }, requirements: { project_type: 'Billing', missing: 'budget' }, ready_to_finalize: false }) });
  const r = e.call(base()); ok(r.ok && r.saved.ok, JSON.stringify(r));
  eq(rows(e, 0).length, 1); eq(rows(e, 1).length, 2); eq(rows(e, 2).length, 1);
  eq(rows(e, 0)[0][3], 'Asha'); eq(rows(e, 0)[0][5], 'asha@x.com'); eq(rows(e, 1)[0][4], 'Customer'); eq(rows(e, 1)[1][4], 'Assistant'); eq(rows(e, 2)[0][2], 'Billing');
  eq(rows(e, 0)[0][14], 'New'); eq(rows(e, 0)[0][17], 'Draft');
});
t('IDs have the expected shape', () => { const e = fresh(); const r = e.call(base()); ok(/^LD-\d{8}-[0-9A-F]{6}$/.test(r.ids.lead_id)); ok(/^CNV-[0-9A-F]{10}$/.test(r.ids.conversation_id)); ok(/^MSG-[0-9A-F]{12}$/.test(r.ids.message_id)); });
t('two clients at once never share or overwrite records', () => {
  const e = fresh({ ai: p => ({ reply: 'ok', summary: 's:' + p.messages[p.messages.length - 1].content, lead: { name: p.messages[p.messages.length - 1].content.includes('Alpha') ? 'Alpha' : 'Beta' }, requirements: {} }) });
  const A = { conversation_id: uid(), lead_id: uid() }, B = { conversation_id: uid(), lead_id: uid() };
  const a1 = e.call(base(Object.assign({ message: 'Alpha one' }, A))), b1 = e.call(base(Object.assign({ message: 'Beta one' }, B))), a2 = e.call(base(Object.assign({ message: 'Alpha two' }, A)));
  ok(a1.ids.lead_id === a2.ids.lead_id && a1.ids.lead_id !== b1.ids.lead_id);
  eq(rows(e, 0).length, 2); eq(rows(e, 1).length, 6);
  const alpha = rows(e, 0).find(r => r[0] === a1.ids.lead_id), beta = rows(e, 0).find(r => r[0] === b1.ids.lead_id);
  eq(alpha[3], 'Alpha'); eq(beta[3], 'Beta');
  ok(rows(e, 1).filter(r => r[1] === a1.ids.conversation_id).every(r => r[2] === a1.ids.lead_id));
});
t('retrying the same message creates no duplicates and does not call the AI again', () => {
  const e = fresh(); const b = base(); const r1 = e.call(b), calls = e.ai.calls, r2 = e.call(b);
  eq(e.ai.calls, calls, 'AI calls'); eq(r2.reply, r1.reply); ok(r2.replayed); eq(rows(e, 0).length, 1); eq(rows(e, 1).length, 2); eq(rows(e, 2).length, 1);
});
t('AI outage keeps the visitor message once; retry then completes without duplicates', () => {
  const e = fresh({ ai: (p, n) => n === 1 ? { __http: 529 } : { reply: 'Back!', summary: 's', lead: {}, requirements: {} } }); const b = base();
  const r1 = e.call(b); eq(r1.ok, false); eq(r1.error.code, 'ai_unavailable'); eq(rows(e, 1).length, 1);
  const r2 = e.call(b); ok(r2.ok && r2.saved.ok); eq(rows(e, 1).length, 2); eq(rows(e, 0).length, 1);
});
t('spreadsheet unreachable: reply still returned, but saved is reported false', () => {
  const e = fresh({ denyAccess: true }); const r = e.call(base()); ok(r.ok); eq(r.saved.ok, false); eq(r.saved.error, 'sheet_unavailable');
});
t('write failure after the AI reply is reported honestly', () => {
  const e = fresh({ ai: () => { e.sheets[1].failWrites = true; return { reply: 'hi', summary: '', lead: {}, requirements: {} }; } }); const r = e.call(base()); ok(r.ok); eq(r.saved.ok, false); eq(r.saved.error, 'sheet_write_failed');
});
t('AI not configured returns a clear error, visitor message still saved', () => {
  const e = fresh({ props: { ANTHROPIC_API_KEY: '' } }); const r = e.call(base()); eq(r.ok, false); eq(r.error.code, 'ai_not_configured'); eq(rows(e, 1).length, 1);
});
t('invalid email/phone from the AI are dropped, nothing invented', () => {
  const e = fresh({ ai: () => ({ reply: 'ok', lead: { email: 'not-an-email', phone: 'abc', name: 'Ravi' }, requirements: {} }) }); const r = e.call(base()); eq(r.lead_update.email, ''); eq(r.lead_update.phone, ''); eq(rows(e, 0)[0][5] || '', ''); eq(rows(e, 0)[0][3], 'Ravi');
});
t('formula-like text is stored as plain text (text number format)', () => {
  const e = fresh(); e.call(base({ message: '=HYPERLINK("http://evil","x")' })); const sh = e.sheets[1]; const row = sh.data.findIndex(r => String(r[5]).startsWith('=')) + 1; ok(row > 0); eq(sh.fmt[row + ',6'], '@');
});
t('non-JSON AI output is shown as plain reply, no fields invented', () => { const e = fresh({ ai: () => 'Sure, tell me more.' }); const r = e.call(base()); eq(r.reply, 'Sure, tell me more.'); eq(rows(e, 0)[0][3] || '', ''); });
t('input validation: bad ids, empty/oversized message, bad JSON, unknown action', () => {
  const e = fresh(); eq(e.call(base({ conversation_id: 'x' })).error.code, 'bad_request'); eq(e.call(base({ message_id: '!!' })).error.code, 'bad_request');
  eq(e.call(base({ message: '   ' })).error.code, 'bad_request'); eq(e.call('not json').error.code, 'bad_request'); eq(e.call({ action: 'nope' }).error.code, 'bad_request');
  eq(e.call(base({ message: 'x'.repeat(5000) })).ok, true); const msg = rows(e, 1)[0][5]; eq(msg.length, 1000);
  eq(e.call({ action: 'chat', pad: 'x'.repeat(100000) }).error.code, 'payload_too_large');
});
t('honeypot, shared token and rate limits', () => {
  let e = fresh(); eq(e.call(base({ website: 'spam.com' })).error.code, 'rejected');
  e = fresh({ props: { CLIENT_TOKEN: 'abc' } }); eq(e.call(base()).error.code, 'unauthorized'); ok(e.call(base({ token: 'abc' })).ok);
  e = fresh(); const cid = uid(); let last; for (let i = 0; i < 62; i++) last = e.call(base({ conversation_id: cid })); eq(last.error.code, 'rate_limited');
  e = fresh({ props: { DAILY_AI_LIMIT: '2' } }); e.call(base()); e.call(base()); eq(e.call(base()).error.code, 'ai_budget');
});
t('timestamps are Asia/Kolkata (UTC+05:30)', () => {
  const e = fresh(); e.call(base()); const ts = rows(e, 1)[0][3]; ok(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(ts), ts);
  const ist = new Date(ts.replace(' ', 'T') + '+05:30').getTime(); ok(Math.abs(ist - Date.now()) < 5000, 'diff ' + (ist - Date.now()));
});
t('finalize writes final report, sets priority, keeps human-owned status', () => {
  const full = { reply: 'ok', summary: 'run', lead: { name: 'Meera', email: 'm@x.com', service: 'Mobile Application', requirements: 'Android app for deliveries with live tracking and payments', budget: '₹5 lakh', timeline: '3 months' }, requirements: { project_type: 'Mobile', missing: 'users' } };
  const e = fresh({ ai: p => /final records/.test(p.messages[p.messages.length - 1].content) ? Object.assign({}, full, { final_report: 'Overview...\nAI recommendations: ...', summary: 'Final summary' }) : full });
  const A = { conversation_id: uid(), lead_id: uid() }; const m1 = base(A); const r1 = e.call(m1);
  e.sheets[0].data[1][14] = 'Contacted'; /* human changes status */
  const hist = [{ message_id: m1.message_id, sender_type: 'customer', message_text: m1.message, timestamp: new Date().toISOString() }];
  const f = e.call({ action: 'finalize', conversation_id: A.conversation_id, lead_id: A.lead_id, history: hist, lead: {}, reason: 'completed' });
  ok(f.ok && f.saved.ok && f.ai_report, JSON.stringify(f)); const L = rows(e, 0)[0];
  eq(L[14], 'Contacted', 'status preserved'); eq(L[17], 'Final'); eq(L[15], 'High'); eq(L[16], 'Final summary'); ok(rows(e, 2)[0][14].includes('AI recommendations')); eq(rows(e, 0).length, 1); eq(rows(e, 1).length, 2, 'no duplicate chat rows after finalize');
  const f2 = e.call({ action: 'finalize', conversation_id: A.conversation_id, lead_id: A.lead_id, history: hist, reason: 'left' }); ok(f2.ok); eq(rows(e, 0).length, 1); eq(rows(e, 1).length, 2); eq(rows(e, 0)[0][17], 'Incomplete - visitor left');
});
t('finalize with no visitor messages is rejected; with sheet down it fails honestly', () => {
  let e = fresh(); eq(e.call({ action: 'finalize', conversation_id: uid(), history: [] }).error.code, 'bad_request');
  e = fresh({ denyAccess: true }); const h = [{ message_id: uid(), sender_type: 'customer', message_text: 'hi', timestamp: new Date().toISOString() }]; const r = e.call({ action: 'finalize', conversation_id: uid(), history: h }); eq(r.ok, false); eq(r.error.code, 'sheet_unavailable');
});
t('finalize without AI still saves the facts and says so in Report Status', () => {
  const e = fresh({ props: { ANTHROPIC_API_KEY: '' } }); const id = uid(); const h = [{ message_id: id, sender_type: 'customer', message_text: 'hello', timestamp: new Date().toISOString() }];
  const r = e.call({ action: 'finalize', conversation_id: uid(), history: h, lead: { name: 'Zed' } }); ok(r.ok && !r.ai_report); eq(rows(e, 0)[0][17], 'Draft (no AI report)'); ok(rows(e, 2)[0][14].includes('no AI analysis'));
});
t('legacy guided "lead" submission saves everything and is retry-safe', () => {
  const e = fresh({ props: { ANTHROPIC_API_KEY: '' } }); const c = uid(), l = uid(), now = new Date().toISOString();
  const p = { action: 'lead', lead_id: l, conversation_id: c, customer: { name: 'Kiran', email: 'k@x.com', phone: '+91 98765 43210' }, project_type: 'Website Design', requirements_summary: 'E-commerce store', estimated_budget: 'Not decided yet', expected_timeline: 'Flexible',
    messages: [{ message_id: uid(), sender_type: 'assistant', message_text: 'Hi', timestamp: now }, { message_id: uid(), sender_type: 'customer', message_text: 'I need a store', timestamp: now }] };
  const r1 = e.call(p), r2 = e.call(p); ok(r1.ok && r2.ok); eq(rows(e, 0).length, 1); eq(rows(e, 1).length, 2); eq(rows(e, 0)[0][6], '+91 98765 43210'); eq(rows(e, 0)[0][8], 'Website Design');
});
t('existing sheet conventions: dropdown status and different header names respected', () => {
  const lh = H.leads.map(h => h === 'Client Name' ? 'Name' : h).filter(h => h !== 'Follow-up Date');
  const leads = mk('Leads', lh); leads.validation = { 15: ['Open', 'New Lead', 'Won'] }; leads.validation[lh.indexOf('Lead Status') + 1] = ['Open', 'New Lead', 'Won'];
  const e = fresh({ sheets: [leads, mk('Chat History', H.chat), mk('Requirements', H.req)], ai: () => ({ reply: 'hi', lead: { name: 'Neel' }, requirements: {} }) });
  const r = e.call(base()); ok(r.ok && r.saved.ok); ok(r.setup_notes.some(n => /Follow-up Date/.test(n))); eq(rows(e, 0)[0][lh.indexOf('Name')], 'Neel'); eq(rows(e, 0)[0][lh.indexOf('Lead Status')], 'New Lead');
});
t('missing tabs are created with the standard headers and reported', () => {
  const e = fresh({ sheets: [] }); const r = e.call(base()); ok(r.saved.ok); eq(e.sheets.length, 3); ok(r.setup_notes.length === 3); eq(e.sheets[0].data[0][0], 'Lead ID');
});
t('Instructions tab text is passed to the AI', () => { const e = fresh(); e.call(base()); ok(e.ai.last.system.includes('Never promise delivery dates')); });
t('system prompt forbids inventing facts and the key is never in the prompt', () => { const e = fresh(); e.call(base()); ok(/Never invent/.test(e.ai.last.system)); ok(!e.ai.last.system.includes('test-key')); });
t('history is converted to strictly alternating turns ending with the visitor', () => {
  const e = fresh(); const h = [{ message_id: uid(), sender_type: 'assistant', message_text: 'Welcome', timestamp: new Date().toISOString() }, { message_id: uid(), sender_type: 'customer', message_text: 'A', timestamp: new Date().toISOString() }, { message_id: uid(), sender_type: 'customer', message_text: 'B', timestamp: new Date().toISOString() }];
  e.call(base({ history: h, message: 'C' })); const m = e.ai.last.messages; eq(m[0].role, 'user'); eq(m[m.length - 1].role, 'user'); m.forEach((x, i) => i && eq(x.role === m[i - 1].role, false));
});
console.log(`\n${pass} passed, ${failN} failed`); process.exit(failN ? 1 : 0);
