/* Riddhix enquiry chatbot: full-screen chat + AI conversation + lead capture.
   Modes
   - AI mode: chatEndpoint is set in js/config.js. Every message goes to the backend (backend/Code.gs), which replies with the
     AI, saves the conversation, lead and requirement report to Google Sheets, and confirms what was saved.
   - Guided mode: no endpoint (or the AI is unavailable). Answers come from this site's own content, the enquiry is collected
     step by step, and the visitor can email it (or it is sent to leadEndpoint if configured).
   Never invents prices, capabilities or commitments, and never says something was saved unless the backend confirmed it. */
(function () {
  const root = document.getElementById('chat'); if (!root || window.__rxChat) return; window.__rxChat = true;
  const CFG = Object.assign({ email: 'info@riddhix.com', chatEndpoint: '', leadEndpoint: '', clientToken: '', timeoutMs: 30000, budgetOptions: [], timelineOptions: [] }, window.RIDDHIX_CONFIG || {});
  const $ = id => document.getElementById(id);
  const log = $('chat-log'), qr = $('chat-qr'), form = $('chat-form'), input = $('chat-input'), send = $('chat-send'), empty = $('cx-empty'), jump = $('cx-jump'), statusEl = $('cx-status');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const KEY = 'riddhix_chat_v2';
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
  const sleep = ms => new Promise(r => setTimeout(r, reduce ? Math.min(ms, 120) : ms));
  const ENDPOINT_END = () => CFG.leadEndpoint || CFG.chatEndpoint;

  const SERVICES = ['Website Design', 'IoT', 'Mobile Application', 'Custom Software Development', 'Not sure yet'];
  const FEATURES = {
    'Website Design': ['Business website', 'E-commerce store', 'Redesign my current site', 'Booking or enquiry forms'],
    'IoT': ['Sensor monitoring', 'Live dashboard', 'Alerts and automation', 'Connect existing devices'],
    'Mobile Application': ['Android', 'iOS', 'Both Android and iOS', 'Login and payments'],
    'Custom Software Development': ['ERP or CRM', 'Billing software', 'Workflow automation', 'API integrations'],
    'Not sure yet': ['Help me decide', 'Replace spreadsheets', 'Automate a manual process']
  };
  const BUDGET = CFG.budgetOptions.length ? CFG.budgetOptions : ['Not decided yet'];
  const TIME = CFG.timelineOptions.length ? CFG.timelineOptions : ['Flexible'];

  /* ---------- knowledge for guided mode: only what the website already says ---------- */
  const KB = [
    [/\b(price|pricing|cost|quote|charge|charges|fee|fees|rate|rates|kitna|paise|paisa)\b/i, 'Pricing depends on the scope, so I can’t give you a number here and I don’t want to guess. Once we understand your requirements, our team sends a written plan with timeline and budget.'],
    [/(\b(delete|privacy|my data|personal data|data|gdpr|stored)\b|\b(do|what do) you (store|save|keep|collect)\b)/i, 'Only what you share here (name, contact details and project requirements) is used, and only to respond to your enquiry. To access or delete your data, email ' + CFG.email + '.'],
    [/\b(nda|confidential|confidentiality|secret|idea safe)\b/i, 'Absolutely. We sign an NDA before discussing your project in detail.'],
    [/(how long|timeline|duration|turnaround|how many (weeks|months)|kitna time|kab tak|kitne din)/i, 'A business website often takes 3 to 6 weeks; mobile apps and custom software usually take a few months. You get a clear timeline before we start.'],
    [/\b(support|maintenance|after launch|after the launch|bug fix|bugs)\b/i, 'Yes. Maintenance plans cover bug fixes, security updates, monitoring and feature upgrades.'],
    [/\b(billing|invoice|invoicing|pos|inventory)\b/i, 'Billing and workflow tools fall under our custom software work. Tell me what you need and the team will confirm the scope.'],
    [/\b(erp|crm|saas|automation|api|apis|integration|integrations|custom software|software|ai)\b/i, 'Custom Software Development: platforms, integrations and automation shaped around your workflow. That includes enterprise and SaaS platforms, ERP, CRM and workflow automation, APIs and third-party integrations.'],
    [/\b(iot|sensor|sensors|device|devices|hardware|gateway|dashboard)\b/i, 'IoT: we connect hardware to the cloud and give your team a live view of what is happening. That means device and sensor integration, cloud dashboards and reports, and real-time alerts and automation.'],
    [/\b(app|apps|android|ios|iphone|mobile|flutter)\b/i, 'Mobile Application: iOS and Android apps built for daily use, from prototype to store launch. Native-feeling apps, cross-platform builds, and a release process that keeps updates painless.'],
    [/\b(website|websites|web site|web design|e-?commerce|store|seo|cms|landing page)\b/i, 'Website Design: fast, responsive sites and web apps. That covers UI and UX design, business and e-commerce sites, and CMS, SEO and performance tuning.'],
    [/\b(process|how do you work|steps|workflow of work|methodology)\b/i, 'Four steps: Discover (goals, scope, timeline and budget agreed in writing), Design (clickable prototypes reviewed with you), Build (short sprints with weekly demos) and Launch and support (deployment, monitoring and a maintenance plan).'],
    [/\b(tech|stack|technology|technologies|react|node|python|aws|firebase|postgres|postgresql|wordpress|mqtt)\b/i, 'We work with HTML5, React, Node.js, Flutter, Python, MQTT, AWS, Firebase, PostgreSQL and WordPress. The right stack depends on your project.'],
    [/\b(sector|sectors|industry|industries|healthcare|retail|logistics|manufacturing|education|finance)\b/i, 'We work across healthcare, retail and e-commerce, logistics, manufacturing, education and finance.'],
    [/\b(services?|what do you (do|build|offer)|offer|kya karte|kya banate)\b/i, 'We do four things: Website Design, IoT, Mobile Applications and Custom Software Development.'],
    [/\b(human|person|someone|call me|call|talk to|speak to|contact|email|phone number|your team)\b/i, 'Leave your details and a person from our team will reply within one working day. Shall we put your enquiry together?'],
    [/^\s*(hi|hello|hey|hii|namaste|good (morning|afternoon|evening))\b/i, 'Hello! Happy to help.'],
    [/\b(thanks|thank you|thx|shukriya|dhanyavad)\b/i, 'You’re welcome!']
  ];
  const NOANSWER = 'I’m not sure about that, and I don’t want to guess. Our team can answer it properly, so leave your details and they’ll reply within one working day.';
  const localAnswer = t => { for (const [re, a] of KB) if (re.test(t)) return a; return null; };
  const looksLikeQuestion = t => /\?\s*$/.test(t) || /^\s*(what|how|why|when|where|which|who|do|does|did|can|could|is|are|will|would|should|kya|kaise|kitna|kitne|kab|kyu|kyun)\b/i.test(t);

  /* ---------- state (kept in sessionStorage so close/reopen and reloads in the same tab keep the chat) ---------- */
  const fresh = () => ({ cid: uid(), leadId: uid(), step: 'start', lead: {}, msgs: [], done: false, mode: '', chips: [], saved: null, warned: false, beaconAt: -1 });
  let S;
  try { S = JSON.parse(sessionStorage.getItem(KEY)); } catch (e) { S = null; }
  if (!S || !S.cid || !Array.isArray(S.msgs)) S = fresh();
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };
  let busy = false;
  const aiMode = () => !!CFG.chatEndpoint && S.mode !== 'guided';
  const custCount = () => S.msgs.filter(m => m.sender_type === 'customer').length;

  /* ---------- rendering ---------- */
  const nearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 96;
  const toBottom = instant => { log.scrollTo({ top: log.scrollHeight, behavior: (reduce || instant) ? 'auto' : 'smooth' }); jump.hidden = true; };
  function place(node, mine) { const stick = mine || nearBottom(); log.appendChild(node); if (stick) toBottom(); else jump.hidden = false; }
  log.addEventListener('scroll', () => { if (nearBottom()) jump.hidden = true; }, { passive: true });
  jump.onclick = () => { toBottom(); input.focus({ preventScroll: true }); };
  const hideEmpty = () => { empty.hidden = true; };

  function inline(parent, text) { text.split(/(\*\*[^*]+\*\*)/).forEach(p => { if (/^\*\*[^*]+\*\*$/.test(p)) { const b = document.createElement('strong'); b.textContent = p.slice(2, -2); parent.appendChild(b); } else if (p) parent.appendChild(document.createTextNode(p)); }); }
  function render(el, text) { /* tiny safe markdown: paragraphs, - lists, 1. lists, **bold**; never uses innerHTML */
    String(text).split(/\n{2,}/).forEach(block => {
      const lines = block.split('\n').filter(l => l.trim() !== '');
      if (!lines.length) return;
      const ul = lines.every(l => /^\s*[-•*]\s+/.test(l)), ol = !ul && lines.every(l => /^\s*\d+[.)]\s+/.test(l));
      if (ul || ol) { const list = document.createElement(ul ? 'ul' : 'ol'); lines.forEach(l => { const li = document.createElement('li'); inline(li, l.replace(/^\s*([-•*]|\d+[.)])\s+/, '')); list.appendChild(li); }); el.appendChild(list); }
      else { const p = document.createElement('p'); inline(p, lines.join('\n')); el.appendChild(p); }
    });
  }
  function bubble(text, cls, animate) {
    const d = document.createElement('div'); d.className = 'msg ' + cls;
    if (cls.indexOf('me') === 0) d.textContent = text; else render(d, text);
    if (animate === false) d.style.animation = 'none';
    hideEmpty(); place(d, cls.indexOf('me') === 0); return d;
  }
  function record(sender, text, extra) { const m = Object.assign({ message_id: uid(), conversation_id: S.cid, sender_type: sender, message_text: text, timestamp: new Date().toISOString() }, extra || {}); S.msgs.push(m); save(); return m; }
  function typing() { const t = document.createElement('div'); t.className = 'typing'; t.setAttribute('role', 'status'); t.innerHTML = '<span class="vh">Assistant is typing</span><i></i><i></i><i></i>'; hideEmpty(); place(t, false); return t; }
  async function say(text, cls, local) { const t = typing(); await sleep(Math.min(1000, 380 + text.length * 6)); t.remove(); bubble(text, cls || 'bot'); if (cls !== 'sys') record('assistant', text, local ? { local: true } : null); }
  function chips(list) {
    qr.innerHTML = ''; S.chips = (list || []).filter(c => typeof c === 'string'); save();
    (list || []).forEach(c => {
      const o = typeof c === 'string' ? { label: c } : c;
      const b = document.createElement(o.href ? 'a' : 'button'); b.className = 'qb' + (o.primary ? ' pri' : ''); b.textContent = o.label;
      if (o.href) b.href = o.href; else { b.type = 'button'; b.onclick = () => { if (busy) return; if (o.action) o.action(); else handle(o.value || o.label, 'quick_reply'); }; }
      qr.appendChild(b);
    });
    if (nearBottom()) toBottom(true);
  }
  function setBusy(v) { busy = v; send.disabled = v; root.setAttribute('aria-busy', v); if (v) chips([]); }
  function setInput(ph, mode, ac) { input.placeholder = ph; input.inputMode = mode || 'text'; input.autocomplete = ac || 'off'; }
  function setStatus(text, warn) { statusEl.textContent = text; statusEl.previousElementSibling.classList.toggle('warn', !!warn); }
  const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 154) + 'px'; };
  const mailto = () => { const L = S.lead, lines = S.msgs.filter(m => !m.local).slice(-12).map(m => (m.sender_type === 'customer' ? 'Me: ' : 'Assistant: ') + m.message_text).join('\n');
    return 'mailto:' + CFG.email + '?subject=' + encodeURIComponent('Project enquiry from ' + (L.name || 'website visitor')) + '&body=' + encodeURIComponent('New website enquiry\nName: ' + (L.name || '') + '\nEmail: ' + (L.email || '') + '\nPhone: ' + (L.phone || '') + '\n\n' + lines + '\n\nConversation ID: ' + S.cid); };

  /* ---------- network ---------- */
  async function post(url, body) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), CFG.timeoutMs);
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ token: CFG.clientToken || undefined, website: '' }, body)), signal: ctl.signal });
      if (!r.ok) { const e = new Error('HTTP ' + r.status); e.code = 'http_' + r.status; throw e; }
      const j = await r.json().catch(() => ({}));
      if (j && j.ok === false) { const e = new Error((j.error && j.error.message) || 'Request failed'); e.code = (j.error && j.error.code) || 'failed'; throw e; }
      return j;
    } catch (e) { if (e.name === 'AbortError') { e.code = 'timeout'; } else if (e instanceof TypeError) { e.code = 'network'; } throw e; }
    finally { clearTimeout(to); }
  }
  function reason(e) {
    if (!navigator.onLine || e.code === 'network') return 'It looks like you’re offline or the server can’t be reached.';
    if (e.code === 'timeout') return 'The request took too long.';
    if (e.code === 'rate_limited' || e.code === 'ai_budget') return e.message;
    return 'Something went wrong on our side.';
  }
  const stripMsg = m => ({ message_id: m.message_id, sender_type: m.sender_type, message_text: m.message_text, timestamp: m.timestamp });
  const history = skipId => S.msgs.filter(m => !m.local && !m.failed && m.message_id !== skipId).slice(-24).map(stripMsg);

  /* ---------- AI mode ---------- */
  async function aiSend(text, type) {
    const m = record('customer', text, { content_type: type === 'quick_reply' ? 'quick_reply' : 'text' });
    const d = bubble(text, 'me'); d.dataset.mid = m.message_id; setBusy(true); await aiTurn(m);
  }
  async function aiTurn(m) {
    setBusy(true); const t = typing();
    try {
      const r = await post(CFG.chatEndpoint, { action: 'chat', conversation_id: S.cid, lead_id: S.leadId, message_id: m.message_id, message: m.message_text, content_type: m.content_type, lead: S.lead, history: history(m.message_id) });
      t.remove(); delete m.failed;
      const mark = log.querySelector('[data-mid="' + m.message_id + '"]'); if (mark) mark.classList.remove('failed');
      if (r.lead_update) Object.keys(r.lead_update).forEach(k => { if (r.lead_update[k]) S.lead[k] = r.lead_update[k]; });
      S.msgs.push({ message_id: (r.ids && r.ids.assistant_message_id) || uid(), conversation_id: S.cid, sender_type: 'assistant', message_text: r.reply, timestamp: new Date().toISOString() });
      bubble(r.reply, 'bot'); reportSaved(r);
      const list = (r.quick_replies || []).slice(0, 4);
      if (r.ready || (custCount() >= 3 && (S.lead.email || S.lead.phone))) list.push({ label: 'Finish and send to our team', primary: true, action: finalize });
      if (!S.saved || !S.saved.ok) list.push({ label: 'Email us instead', href: mailto() });
      save(); chips(list);
    } catch (e) {
      t.remove();
      if (e.code === 'ai_not_configured') { S.mode = 'guided'; save(); await say('Our AI assistant isn’t available right now, so I’ll answer from what I know about Riddhix.', 'sys'); setBusy(true); try { await route(m.message_text); } catch (x) { setBusy(false); } return; }
      m.failed = true; save(); const mark = log.querySelector('[data-mid="' + m.message_id + '"]'); if (mark) mark.classList.add('failed');
      failure(reason(e) + ' Your message was not sent.', () => aiTurn(m), true);
    } finally { setBusy(false); }
  }
  function reportSaved(r) {
    S.saved = r.saved || { ok: false };
    if (S.saved.ok) { setStatus('Saved · our team can see this conversation'); S.warned = false; }
    else { setStatus('Not saved yet · chat is kept on this device', true);
      if (!S.warned) { S.warned = true; bubble('I couldn’t save this conversation to our records just now. You can keep chatting, and we’ll try again with your next message, or email us at ' + CFG.email + '.', 'sys'); } }
  }
  function failure(text, retry, withMail) {
    const d = document.createElement('div'); d.className = 'msg sys'; d.setAttribute('role', 'alert');
    const p = document.createElement('span'); p.textContent = text; d.appendChild(p);
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'qb pri'; b.textContent = 'Retry'; b.onclick = () => { if (busy) return; d.remove(); retry(); };
    row.appendChild(b);
    if (withMail) { const a = document.createElement('a'); a.className = 'qb'; a.href = mailto(); a.textContent = 'Email us instead'; row.appendChild(a); }
    d.appendChild(row); place(d, true); setBusy(false); b.focus({ preventScroll: true });
  }
  async function finalize() {
    if (!S.lead.email && !S.lead.phone) { await say('Before I send this to our team, please share an email address or phone number so they can reply to you.', 'bot', true); return setBusy(false); }
    setBusy(true); const t = typing();
    try {
      const r = await post(ENDPOINT_END(), { action: 'finalize', conversation_id: S.cid, lead_id: S.leadId, lead: S.lead, history: history(), reason: 'completed' });
      if (!(r.saved && r.saved.ok)) throw Object.assign(new Error('not saved'), { code: 'not_saved' });
      t.remove(); S.done = true; S.step = 'sent'; S.beaconAt = S.msgs.length; save(); setStatus('Enquiry recorded · our team will follow up');
      const n = (S.lead.name || '').split(/\s+/)[0];
      await say('Thank you' + (n ? ', ' + n : '') + '. Your enquiry has been recorded and a person from our team will follow up' + (S.lead.email ? ' at ' + S.lead.email : '') + ' within one working day.', 'bot', true);
      chips([{ label: 'Start a new enquiry', action: () => restart() }]); setBusy(false);
    } catch (e) { t.remove(); failure('I couldn’t record your enquiry: ' + reason(e).replace(/\.$/, '') + '. Nothing has been sent yet.', finalize, true); }
  }

  /* ---------- guided mode ---------- */
  const firstName = () => (S.lead.name || '').split(/\s+/)[0] || '';
  const STEP = {
    consent: { ph: 'Type your message…', q: () => 'To prepare an enquiry for our team I’ll ask for your name, contact details and project requirements. They are used only to respond to you, and I never ask for passwords or payment details. Shall we begin?', chips: () => ['Yes, let’s start', 'What do you store?', 'I just have a question'] },
    name: { ph: 'Your name', ac: 'name', q: () => 'Great. What should we call you? Your details are used only to respond to your enquiry.', chips: () => [] },
    service: { ph: 'Or type what you need…', q: () => 'Nice to meet you, ' + firstName() + '. What do you need help with?', chips: () => SERVICES },
    features: { ph: 'Describe what you want to build…', q: () => 'Tell me a little about the project: what should it do, and who is it for? Pick a suggestion or write your own.', chips: () => (FEATURES[S.lead.service] || FEATURES['Not sure yet']).concat(['Not sure yet']) },
    budget: { ph: 'Or type your budget…', q: () => 'Do you have a budget range in mind? A rough idea is fine, and it helps the team plan.', chips: () => BUDGET },
    timeline: { ph: 'Or type your timeline…', q: () => 'When would you like it ready?', chips: () => TIME },
    email: { ph: 'you@company.com', mode: 'email', ac: 'email', q: () => 'What email address should the team reply to?', chips: () => [] },
    phone: { ph: 'Phone number (optional)', mode: 'tel', ac: 'tel', q: () => 'And a phone number, if you’d like a call. This one is optional.', chips: () => ['Skip'] },
    confirm: { ph: 'Type your message…', q: () => '', chips: () => [{ label: 'Send to Riddhix team', value: 'Send to Riddhix team', primary: true }, 'Start over'] },
    sent: { ph: 'Ask another question…', q: () => '', chips: () => ['Start a new enquiry'] },
    free: { ph: 'Type your message…', q: () => 'Would you like to put together an enquiry for our team?', chips: () => ['Yes, let’s start', 'Ask another question'] }
  };
  STEP.start = STEP.consent;
  async function ask(step, preface) {
    S.step = step; save(); const d = STEP[step]; setInput(d.ph, d.mode, d.ac);
    if (step === 'confirm') await showSummary(); else await say((preface ? preface + '\n\n' : '') + d.q());
    chips(d.chips()); setBusy(false);
  }
  function summaryText() { const L = S.lead, row = (k, v) => k + ': ' + (v || 'Not provided'); return ['Here’s your enquiry:', row('Name', L.name), row('Service', L.service), row('Project', L.features), row('Budget', L.budget), row('Timeline', L.timeline), row('Email', L.email), row('Phone', L.phone)].join('\n'); }
  async function showSummary() {
    const t = typing(); await sleep(600); t.remove(); const text = summaryText(); const b = bubble(text, 'bot sum'); record('assistant', text);
    const n = document.createElement('div'); n.style.cssText = 'margin-top:10px;font-size:13px;color:#b4c3e3'; n.textContent = 'Check the details, then send it to our team.'; b.appendChild(n);
  }
  async function answerThenResume(text) {
    const t = typing(); await sleep(300); t.remove(); const a = localAnswer(text) || NOANSWER;
    bubble(a, 'bot'); record('assistant', a);
    if (['name', 'service', 'features', 'budget', 'timeline', 'email', 'phone'].includes(S.step)) { await sleep(400); return ask(S.step, 'Back to your enquiry.'); }
    if (S.step === 'consent' || S.step === 'confirm' || S.step === 'sent') { chips(STEP[S.step].chips()); return setBusy(false); }
    await sleep(300); return ask('free');
  }
  const matchService = t => { const x = t.toLowerCase();
    if (/web|site|e-?commerce|store|seo/.test(x)) return 'Website Design'; if (/iot|sensor|device|hardware/.test(x)) return 'IoT'; if (/\b(app|apps|android|ios|mobile)\b/.test(x)) return 'Mobile Application';
    if (/software|erp|crm|saas|billing|automation|api|custom|\bai\b/.test(x)) return 'Custom Software Development'; if (/not sure|don.?t know|unsure|help me/.test(x)) return 'Not sure yet';
    return SERVICES.find(s => s.toLowerCase() === x) || null; };
  const cleanName = t => t.replace(/^\s*(hi|hello|hey)[,!. ]*/i, '').replace(/^\s*(i am|i'm|im|my name is|this is|mera naam|main)\s+/i, '').replace(/[^\p{L}\p{M}' .-]/gu, '').trim().slice(0, 60);
  const isRestart = t => /^(start over|start a new enquiry|restart|reset)$/i.test(t.trim());

  async function route(text) {
    const L = S.lead, step = S.step;
    if (isRestart(text)) return restart(step === 'sent');
    if (step === 'start' || step === 'consent') {
      if (/^(yes|yeah|yep|ok|okay|sure|haan|ha|let.?s (start|go|begin)|start|begin|go ahead)/i.test(text)) return ask('name');
      if (/^i just have a question$/i.test(text)) { S.step = 'free'; save(); await say('Of course. Ask me anything about our services, process or timelines.'); setInput(STEP.free.ph); chips(['What services do you offer?', 'How long does a project take?', 'Do you offer support after launch?']); return setBusy(false); }
      const sv = matchService(text);
      if (sv && !/\?\s*$/.test(text) && !/^how\b/i.test(text)) { L.service = sv; save(); const a = localAnswer(text); return ask('name', (a ? a + '\n\n' : '') + 'I can help you put together an enquiry for this.'); }
      return answerThenResume(text);
    }
    if (step === 'free' || step === 'sent') {
      if (/^(yes|yeah|sure|ok|okay|haan|let.?s start|start a new enquiry)/i.test(text)) { if (step === 'sent') return restart(true); return ask('name'); }
      if (/^ask another question$/i.test(text)) { await say('Go ahead, I’m listening.'); chips([]); return setBusy(false); }
      return answerThenResume(text);
    }
    if (step === 'name') {
      if (/\?\s*$/.test(text) || (looksLikeQuestion(text) && text.split(/\s+/).length > 2)) return answerThenResume(text);
      const n = cleanName(text); if (n.length < 2) { await say('I didn’t catch that. What name should we use?'); return setBusy(false); }
      L.name = n; save(); return L.service ? ask('features') : ask('service');
    }
    if (step === 'service') {
      const sv = matchService(text);
      if (sv && !/\?\s*$/.test(text)) { L.service = sv; save(); return ask('features'); }
      if (looksLikeQuestion(text)) return answerThenResume(text);
      await say('Please pick one of the options below, or tell me a little more.'); chips(SERVICES); return setBusy(false);
    }
    if (step === 'features') { if (/\?\s*$/.test(text)) return answerThenResume(text); L.features = /^not sure yet$/i.test(text) ? 'Not sure yet, would like the team’s advice' : text; save(); return ask('budget'); }
    if (step === 'budget') { if (/\?\s*$/.test(text)) return answerThenResume(text); L.budget = text; save(); return ask('timeline'); }
    if (step === 'timeline') { if (/\?\s*$/.test(text)) return answerThenResume(text); L.timeline = text; save(); return ask('email'); }
    if (step === 'email') {
      const m = text.match(/[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}/); if (m) { L.email = m[0]; save(); return ask('phone'); }
      if (looksLikeQuestion(text)) return answerThenResume(text);
      await say('That doesn’t look like an email address. Could you check it? For example name@company.com'); return setBusy(false);
    }
    if (step === 'phone') {
      if (/^(skip|no|none|nahi|na|n\/a)$/i.test(text)) { L.phone = ''; save(); return ask('confirm'); }
      const digits = text.replace(/\D/g, '');
      if (/^[+\d][\d\s().-]{5,}$/.test(text) && digits.length >= 7 && digits.length <= 15) { L.phone = text; save(); return ask('confirm'); }
      if (looksLikeQuestion(text)) return answerThenResume(text);
      await say('That doesn’t look like a phone number. You can type it with the country code, or tap Skip.'); chips(['Skip']); return setBusy(false);
    }
    if (step === 'confirm') { if (/^send/i.test(text) || /^(yes|ok|confirm|submit)$/i.test(text)) return submit(); return answerThenResume(text); }
  }
  function leadPayload() {
    const L = S.lead;
    return { action: 'lead', lead_id: S.leadId, conversation_id: S.cid, customer: { name: L.name, email: L.email, phone: L.phone || '', email_verified: false, phone_verified: false },
      project_type: L.service, requirements_summary: L.features, estimated_budget: L.budget, expected_timeline: L.timeline, lead_status: 'new', created_at: new Date().toISOString(), consent: true, messages: S.msgs.filter(m => !m.local).map(stripMsg) };
  }
  async function submit() {
    if (!CFG.leadEndpoint) {
      S.step = 'sent'; save(); await say('Almost done, ' + firstName() + '. Tap the button below to send this summary to our team from your email app. We reply within one working day.');
      setInput(STEP.sent.ph); chips([{ label: 'Email it to our team', href: mailto(), primary: true }, 'Start a new enquiry']); return setBusy(false);
    }
    const t = typing();
    try {
      const p = leadPayload(); try { await post(CFG.leadEndpoint, p); } catch (e) { if (e.code && !/^(network|timeout|http_5)/.test(e.code)) throw e; await sleep(800); await post(CFG.leadEndpoint, p); }
      t.remove(); S.step = 'sent'; S.done = true; save();
      await say('Thank you, ' + firstName() + '! Your enquiry has been recorded. We’ll reply to ' + S.lead.email + ' within one working day.');
      setInput(STEP.sent.ph); chips(['Start a new enquiry']); setBusy(false);
    } catch (e) {
      t.remove(); await say('I couldn’t send your enquiry just now, so nothing has been recorded yet. Your details are kept in this chat, so you can try again or email us directly.', 'sys');
      chips([{ label: 'Try again', value: 'Send to Riddhix team', primary: true }, { label: 'Email us instead', href: mailto() }]); setBusy(false);
    }
  }

  /* ---------- input ---------- */
  async function handle(raw, type) {
    const text = String(raw).trim().slice(0, 1000); if (!text || busy) return;
    input.value = ''; autosize(); chips([]);
    if (aiMode()) return aiSend(text, type);
    setBusy(true); bubble(text, 'me'); record('customer', text);
    try { await route(text); } catch (e) { console.error(e); await say('Something went wrong on my side. Please try again.', 'sys'); setBusy(false); }
  }
  form.onsubmit = e => { e.preventDefault(); handle(input.value, 'text'); if (matchMedia('(pointer:fine)').matches) input.focus(); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  input.addEventListener('input', autosize);
  root.querySelectorAll('.cx-sug .qb').forEach(b => b.onclick = () => handle(b.textContent, 'quick_reply'));

  /* ---------- restore / restart ---------- */
  function restore() {
    S.msgs.forEach(m => { if (m.local && m.sender_type === 'assistant') { bubble(m.message_text, 'bot', false); return; }
      const d = bubble(m.message_text, m.sender_type === 'customer' ? 'me' : 'bot' + (/^Here.s your enquiry:/.test(m.message_text) ? ' sum' : ''), false); if (m.sender_type === 'customer') { d.dataset.mid = m.message_id; if (m.failed) d.classList.add('failed'); } });
    toBottom(true);
    const last = S.msgs[S.msgs.length - 1];
    if (aiMode()) {
      setInput('Type your message…');
      if (S.saved) setStatus(S.saved.ok ? 'Saved · our team can see this conversation' : 'Not saved yet · chat is kept on this device', !S.saved.ok);
      if (S.done) chips([{ label: 'Start a new enquiry', action: () => restart() }]);
      else if (last && last.failed) failure('Your last message was not sent.', () => aiTurn(last), true);
      else chips((S.chips || []).concat(custCount() >= 3 && (S.lead.email || S.lead.phone) ? [{ label: 'Finish and send to our team', primary: true, action: finalize }] : []));
    } else {
      const d = STEP[S.step] || STEP.consent; setInput(d.ph, d.mode, d.ac);
      chips(S.step === 'sent' && !CFG.leadEndpoint ? [{ label: 'Email it to our team', href: mailto(), primary: true }, 'Start a new enquiry'] : d.chips());
    }
    setBusy(false);
  }
  async function restart() {
    leaveBeacon();
    try { sessionStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    S = fresh(); log.innerHTML = ''; log.appendChild(empty); empty.hidden = false; chips([]); input.value = ''; autosize(); setBusy(false); setStatus('Online · Riddhix assistant'); setInput('Type your message…'); jump.hidden = true;
  }
  $('chat-reset').onclick = () => { if (busy) return; if (S.msgs.length && !S.done && !confirm('Start a new conversation? This chat will be cleared from this device.')) return; restart(); input.focus(); };

  /* leaving early: best-effort save of an unfinished AI conversation so the information isn't lost */
  function leaveBeacon() {
    if (!aiMode() || S.done || custCount() < 2 || S.beaconAt === S.msgs.length || !navigator.sendBeacon) return;
    try {
      const ok = navigator.sendBeacon(ENDPOINT_END(), new Blob([JSON.stringify({ action: 'finalize', conversation_id: S.cid, lead_id: S.leadId, lead: S.lead, history: history(), reason: 'left', token: CFG.clientToken || undefined, website: '' })], { type: 'text/plain;charset=utf-8' }));
      if (ok) { S.beaconAt = S.msgs.length; save(); }
    } catch (e) { /* best effort only */ }
  }
  addEventListener('pagehide', leaveBeacon);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leaveBeacon(); });

  /* ---------- open / close the full-screen dialog ---------- */
  let isOpen = false, opener = null, y0 = 0, maxH = 0;
  const outside = () => [...document.body.children].filter(n => n !== root && n.tagName !== 'SCRIPT');
  const usable = el => el && document.contains(el) && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const vv = window.visualViewport;
  function fit() {
    if (!isOpen) return;
    const h = vv ? vv.height : innerHeight; maxH = Math.max(maxH, h);
    if (vv) { root.style.setProperty('--vvh', h + 'px'); root.style.setProperty('--vvt', vv.offsetTop + 'px'); }
    const kb = maxH - h > 120; if (kb !== root.classList.contains('kb')) { root.classList.toggle('kb', kb); if (nearBottom() || kb) requestAnimationFrame(() => toBottom(true)); }
  }
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); }
  function open(from) {
    if (isOpen) return; isOpen = true; opener = from || document.activeElement; y0 = scrollY; maxH = 0;
    const b = document.body; b.style.top = -y0 + 'px'; b.style.position = 'fixed'; b.style.left = '0'; b.style.right = '0'; b.classList.add('chat-open');
    outside().forEach(n => n.setAttribute('inert', ''));
    root.hidden = false; void root.offsetWidth; root.classList.add('open'); fit();
    try { history.pushState({ rxChat: 1 }, ''); } catch (e) { /* ignore */ }
    if (S.msgs.length && !log.querySelector('.msg')) restore(); else if (S.msgs.length) toBottom(true);
    (matchMedia('(pointer:fine)').matches ? input : root).focus({ preventScroll: true });
  }
  function close() {
    if (!isOpen) return; isOpen = false; root.classList.remove('open', 'kb');
    const b = document.body; b.classList.remove('chat-open'); b.style.position = b.style.top = b.style.left = b.style.right = '';
    const de = document.documentElement; de.style.scrollBehavior = 'auto'; scrollTo(0, y0); requestAnimationFrame(() => { de.style.scrollBehavior = ''; });
    outside().forEach(n => n.removeAttribute('inert'));
    setTimeout(() => { if (!isOpen) root.hidden = true; }, reduce ? 0 : 300);
    const target = [opener, $('bm'), $('chat-fab'), document.querySelector('main')].find(usable); if (target) target.focus({ preventScroll: true });
  }
  const closeUI = () => { if (history.state && history.state.rxChat) history.back(); else close(); };
  addEventListener('popstate', () => { if (isOpen) close(); });
  $('chat-close').onclick = closeUI;
  root.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closeUI(); return; }
    if (e.key !== 'Tab') return;
    const f = [...root.querySelectorAll('button,a[href],textarea,[tabindex="0"]')].filter(el => !el.disabled && !el.hidden && el.getClientRects().length);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  document.addEventListener('click', e => { const t = e.target.closest('[data-chat-open]'); if (t) { e.preventDefault(); open(t); } });
  if (location.hash === '#chat') setTimeout(() => open(null), 600);
  window.RiddhixChat = { open: () => open(null), close: closeUI };
  setStatus('Online · Riddhix assistant');
})();
