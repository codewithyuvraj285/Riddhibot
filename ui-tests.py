"""Browser tests (Playwright + headless Chromium). Usage: python3 tests/ui-tests.py
three.js and Google Fonts load from CDNs and are blocked here, so the 3D scene is NOT exercised (SVG fallback shows)."""
import json, subprocess, sys, time, os, re
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
URL = 'http://127.0.0.1:8765/index.html'
EP = 'http://127.0.0.1:8799/api'
res = []
def check(name, cond, extra=''):
    res.append((name, bool(cond))); print(('  PASS ' if cond else '  FAIL ') + name + (('  -> ' + str(extra)) if (extra and not cond) else ''))

def block(route):
    u = route.request.url
    if u.startswith('http://127.0.0.1') : return route.continue_()
    return route.abort()

AI_CFG = open(os.path.join(ROOT, 'js/config.js')).read().replace("chatEndpoint: ''", "chatEndpoint: '%s'" % EP).replace("leadEndpoint: ''", "leadEndpoint: '%s'" % EP).replace("clientToken: ''", "clientToken: 'tok123'")

def new_page(b, w=1440, h=900, mobile=False, ai=False, reduced=False, backend=None):
    ctx = b.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1, reduced_motion='reduce' if reduced else 'no-preference')
    p = ctx.new_page(); p.errors = []
    p.on('pageerror', lambda e: p.errors.append(str(e)))
    p.on('console', lambda m: m.type == 'error' and 'ERR_FAILED' not in m.text and 'Failed to load resource' not in m.text and p.errors.append(m.text))
    p.route('**/*', block)
    if ai: p.route('**/js/config.js', lambda r: r.fulfill(body=AI_CFG, content_type='application/javascript'))
    if backend: p.route(EP, backend)
    p.goto(URL); p.wait_for_function("document.body.classList.contains('ready')", timeout=8000)
    return p

def opened(p): return p.evaluate("(()=>{const c=document.getElementById('chat');return !c.hidden && c.classList.contains('open')})()")
def n_msgs(p): return p.evaluate("document.querySelectorAll('#chat-log .msg').length")
def texts(p): return p.evaluate("[...document.querySelectorAll('#chat-log .msg')].map(m=>m.className+'|'+m.innerText)")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    print('Layout / no overflow / no JS errors')
    for (w, h) in [(1440, 900), (1024, 768), (768, 1024), (390, 844), (320, 640)]:
        p = new_page(b, w, h, mobile=w < 800)
        ov = p.evaluate("document.documentElement.scrollWidth - innerWidth")
        check('no horizontal overflow at %dpx' % w, ov <= 0, ov)
        check('no JS errors at %dpx' % w, not p.errors, p.errors)
        p.screenshot(path='/tmp/shots/hero-%d.png' % w)
        p.close()

    print('Process section')
    for (w, h) in [(1440, 900), (1024, 768), (768, 1024), (390, 844), (320, 640)]:
        p = new_page(b, w, h, mobile=w < 800)
        p.evaluate("document.querySelector('.steps').scrollIntoView({block:'center'})"); p.wait_for_timeout(500)
        g = p.evaluate("""()=>[...document.querySelectorAll('.steps li')].map(li=>{const n=li.querySelector('b').getBoundingClientRect(),d=li.querySelector('div').getBoundingClientRect(),t=li.querySelector('h3').getBoundingClientRect(),pl=document.querySelector('.pl').getBoundingClientRect();return{gap:Math.round(d.left-n.right),overlapX:n.right>d.left,lineInside:pl.left+1>=n.left&&pl.left+1<=n.right,hOver:t.right>innerWidth,nw:Math.round(n.width),nh:Math.round(n.height)}})""")
        check('process: 4 steps at %dpx' % w, len(g) == 4)
        check('process: number never overlaps text at %dpx (gaps %s)' % (w, [x['gap'] for x in g]), all(x['gap'] >= 18 and not x['overlapX'] for x in g))
        check('process: line passes through the number nodes at %dpx' % w, all(x['lineInside'] for x in g))
        check('process: numbers are round nodes, text not clipped at %dpx' % w, all(x['nw'] == x['nh'] and not x['hOver'] for x in g))
        el = p.query_selector('#process'); el.screenshot(path='/tmp/shots/process-%d.png' % w)
        p.close()

    print('Chat: desktop, guided mode')
    p = new_page(b, 1440, 900)
    check('nav shows "Chat with AI"', p.is_visible('#nv .nv-chat') and 'Chat with AI' in p.inner_text('#nv .nv-chat'))
    p.mouse.wheel(0, 1200); p.wait_for_timeout(400); sy = p.evaluate('scrollY')
    p.evaluate("document.querySelector('#hd').classList.remove('hide')")
    p.click('#nv .nv-chat'); p.wait_for_timeout(500)
    check('nav button opens full-screen chat', opened(p))
    r = p.evaluate("(()=>{const r=document.getElementById('chat').getBoundingClientRect();return[r.left,r.top,r.width,r.height,innerWidth,innerHeight]})()")
    check('chat covers the whole viewport', r[0] == 0 and r[1] == 0 and r[2] == r[4] and abs(r[3] - r[5]) <= 1, r)
    check('focus moves into the chat input (desktop)', p.evaluate("document.activeElement.id") == 'chat-input')
    check('background is inert while open', p.evaluate("document.querySelector('main').hasAttribute('inert') && document.querySelector('header').hasAttribute('inert')"))
    p.mouse.move(700, 400); p.mouse.wheel(0, 800); p.wait_for_timeout(300)
    check('page behind does not scroll while chat is open', p.evaluate("Math.abs(parseInt(document.body.style.top||'0'))") == sy)
    check('empty state with suggestions', p.is_visible('#cx-empty') and p.locator('.cx-sug .qb').count() == 6)
    p.screenshot(path='/tmp/shots/chat-desktop-empty.png')
    p.click('.cx-sug .qb >> nth=5'); p.wait_for_timeout(2200)
    t = texts(p); check('suggestion sends a user message and gets a reply', any(x.startswith('msg me|') for x in t) and any(x.startswith('msg bot|') for x in t), t)
    check('empty state hidden after first message', not p.is_visible('#cx-empty'))
    before = n_msgs(p)
    p.fill('#chat-input', 'line one'); p.keyboard.press('Shift+Enter'); p.keyboard.type('line two')
    check('Shift+Enter inserts a newline and does not send', p.input_value('#chat-input') == 'line one\nline two' and n_msgs(p) == before)
    p.keyboard.press('Enter'); p.wait_for_timeout(300)
    check('Enter sends the message', p.input_value('#chat-input') == '' and n_msgs(p) > before)
    p.wait_for_timeout(2000); p.screenshot(path='/tmp/shots/chat-desktop-convo.png')
    count = n_msgs(p)
    p.keyboard.press('Tab'); p.keyboard.press('Tab')
    check('Tab focus stays inside the dialog', p.evaluate("document.getElementById('chat').contains(document.activeElement)"))
    p.keyboard.press('Escape'); p.wait_for_timeout(600)
    check('Escape closes the chat', not p.evaluate("document.body.classList.contains('chat-open')") and p.evaluate("document.getElementById('chat').hidden"))
    check('scroll position restored after close', abs(p.evaluate('scrollY') - sy) <= 2, (p.evaluate('scrollY'), sy))
    check('background no longer inert', not p.evaluate("document.querySelector('main').hasAttribute('inert')"))
    check('focus returns to the opener', p.evaluate("document.activeElement.classList.contains('nv-chat')"))
    p.evaluate("document.querySelector('#hd').classList.remove('hide')"); p.click('#nv .nv-chat'); p.wait_for_timeout(500)
    check('reopen preserves the conversation (same container, no duplicates)', n_msgs(p) == count, (n_msgs(p), count))
    p.reload(); p.wait_for_function("document.body.classList.contains('ready')")
    p.evaluate("document.querySelector('.chat-fab').click()"); p.wait_for_timeout(600)
    check('conversation survives a page reload (same tab)', n_msgs(p) == count, (n_msgs(p), count))
    check('single chat instance', p.evaluate("document.querySelectorAll('#chat').length") == 1)
    check('no JS errors in chat', not p.errors, p.errors)
    p.close()

    print('Chat: mobile')
    p = new_page(b, 390, 844, mobile=True)
    p.click('#bm'); p.wait_for_timeout(700)
    check('mobile menu opens with aria-expanded', p.get_attribute('#bm', 'aria-expanded') == 'true' and p.is_visible('#nv .nv-chat'))
    p.screenshot(path='/tmp/shots/menu-mobile.png')
    p.click('#nv .nv-chat'); p.wait_for_timeout(700)
    check('mobile menu closes and chat still opens', opened(p) and not p.evaluate("document.getElementById('nv').classList.contains('open')"))
    r = p.evaluate("(()=>{const r=document.getElementById('chat').getBoundingClientRect();return[r.left,r.top,r.width,r.height,innerWidth,innerHeight]})()")
    check('mobile chat fills the screen', r[0] == 0 and r[2] == r[4] and abs(r[3] - r[5]) <= 1, r)
    check('no horizontal overflow inside chat', p.evaluate("(()=>{const l=document.getElementById('chat-log');return l.scrollWidth<=l.clientWidth})()"))
    check('input font >=16px (prevents iOS zoom)', p.evaluate("parseFloat(getComputedStyle(document.getElementById('chat-input')).fontSize)") >= 16)
    p.screenshot(path='/tmp/shots/chat-mobile-empty.png')
    p.click('.cx-sug .qb >> nth=0'); p.wait_for_timeout(2500)
    p.screenshot(path='/tmp/shots/chat-mobile-convo.png')
    p.set_viewport_size({'width': 390, 'height': 430}); p.wait_for_timeout(600)
    g = p.evaluate("(()=>{const f=document.getElementById('chat-form').getBoundingClientRect(),c=document.getElementById('chat').getBoundingClientRect();return{formBottom:f.bottom,vh:innerHeight,chatH:c.height,kb:document.getElementById('chat').classList.contains('kb')}})()")
    check('with keyboard-sized viewport the input stays visible and layout shrinks', g['formBottom'] <= g['vh'] + 1 and abs(g['chatH'] - g['vh']) <= 1 and g['kb'], g)
    p.screenshot(path='/tmp/shots/chat-mobile-keyboard.png')
    p.set_viewport_size({'width': 390, 'height': 844}); p.click('#chat-close'); p.wait_for_timeout(600)
    check('close button works on mobile', p.evaluate("document.getElementById('chat').hidden"))
    p.close()

    print('Chat: reduced motion')
    p = new_page(b, 1280, 800, reduced=True)
    p.click('#nv .nv-chat'); p.wait_for_timeout(300); ok1 = opened(p)
    p.fill('#chat-input', 'what services do you offer?'); p.keyboard.press('Enter'); p.wait_for_timeout(1000); 
    check('works with prefers-reduced-motion', ok1 and n_msgs(p) >= 2 and not p.errors, p.errors)
    p.close()

    print('Chat: AI mode with mocked Apps Script endpoint')
    state = {'reqs': [], 'mode': 'ok', 'saved': True}
    def backend(route):
        body = json.loads(route.request.post_data); state['reqs'].append(body)
        hdr = {'access-control-allow-origin': '*'}
        if state['mode'] == 'down': return route.abort('failed')
        if body['action'] == 'finalize':
            if state['mode'] == 'finalize_fail': return route.fulfill(headers=hdr, content_type='application/json', body=json.dumps({'ok': False, 'error': {'code': 'sheet_unavailable', 'message': 'x'}}))
            return route.fulfill(headers=hdr, content_type='application/json', body=json.dumps({'ok': True, 'saved': {'ok': True}}))
        n = len([1 for r in state['reqs'] if r['action'] == 'chat'])
        lead = {'name': 'Asha', 'email': 'asha@example.com'} if n >= 2 else {}
        return route.fulfill(headers=hdr, content_type='application/json', body=json.dumps({'ok': True, 'reply': 'Reply %d\n\n- point **one**\n- point two' % n, 'quick_replies': ['Web', 'Mobile'], 'lead_update': lead, 'ready': False,
            'ids': {'assistant_message_id': 'MSG-AAAAAAAAAA%02d' % n}, 'saved': {'ok': state['saved']}}))
    p = new_page(b, 1280, 800, ai=True, backend=backend)
    p.click('#nv .nv-chat'); p.wait_for_timeout(400)
    p.fill('#chat-input', 'I need a billing system'); p.keyboard.press('Enter'); p.wait_for_timeout(800)
    r0 = state['reqs'][0]
    check('AI request has action, ids, token, history and honeypot', r0['action'] == 'chat' and r0['conversation_id'] and r0['message_id'] and r0['token'] == 'tok123' and r0['website'] == '' and r0['message'] == 'I need a billing system', r0)
    check('assistant reply rendered with markdown list + bold, no raw markup', p.evaluate("(()=>{const m=document.querySelector('.msg.bot');return m.querySelectorAll('li').length===2&&m.querySelector('strong')&&!m.innerText.includes('**')})()"))
    check('quick-reply chips appear', p.locator('#chat-qr .qb').count() >= 2)
    check('status says Saved only because backend confirmed', 'Saved' in p.inner_text('#cx-status'))
    p.click('#chat-qr .qb >> nth=0'); p.wait_for_timeout(800)
    check('quick reply is sent as a message', state['reqs'][1]['message'] == 'Web' and state['reqs'][1]['content_type'] == 'quick_reply')
    check('second request carries history from the first turn', len(state['reqs'][1]['history']) == 2, state['reqs'][1]['history'])
    p.fill('#chat-input', 'third message'); p.keyboard.press('Enter'); p.wait_for_timeout(800)
    check('"Finish and send to our team" appears once contact + 3 messages exist', p.locator('#chat-qr .qb', has_text='Finish and send').count() == 1)
    state['mode'] = 'finalize_fail'; p.click('#chat-qr .qb >> text=Finish and send'); p.wait_for_timeout(800)
    txt = ' '.join(texts(p))
    check('failed finalize is reported honestly (no thank-you shown)', 'couldn’t record' in txt and 'Thank you' not in txt and p.locator('.msg.sys .qb', has_text='Retry').count() == 1, txt[-300:])
    state['mode'] = 'ok'; p.click('.msg.sys .qb >> text=Retry'); p.wait_for_timeout(1800)
    fin = [r for r in state['reqs'] if r['action'] == 'finalize']
    check('retry sends finalize again; thank-you only after backend confirms', len(fin) == 2 and 'Thank you' in ' '.join(texts(p)) and fin[-1]['reason'] == 'completed')
    p.close()

    state = {'reqs': [], 'mode': 'down', 'saved': True}
    p = new_page(b, 1280, 800, ai=True, backend=backend)
    p.click('#nv .nv-chat'); p.fill('#chat-input', 'hello there'); p.keyboard.press('Enter'); p.wait_for_timeout(1000)
    check('network failure shows a Retry option and an honest message', p.locator('.msg.sys .qb', has_text='Retry').count() == 1 and 'not sent' in ' '.join(texts(p)))
    check('failed message is visibly marked', p.evaluate("document.querySelector('.msg.me').classList.contains('failed')"))
    state['mode'] = 'ok'; p.click('.msg.sys .qb >> text=Retry'); p.wait_for_timeout(1000)
    ids = [r['message_id'] for r in state['reqs'] if r['action'] == 'chat']
    check('retry re-sends the SAME message_id (backend de-duplicates)', len(ids) == 2 and ids[0] == ids[1], ids)
    check('after retry the reply appears and the failure notice is gone', p.locator('.msg.sys').count() == 0 and p.locator('.msg.bot').count() == 1)
    p.close()

    state = {'reqs': [], 'mode': 'ok', 'saved': False}
    p = new_page(b, 1280, 800, ai=True, backend=backend)
    p.click('#nv .nv-chat'); p.fill('#chat-input', 'hello'); p.keyboard.press('Enter'); p.wait_for_timeout(1000)
    check('when the sheet write failed the UI does NOT claim it saved', 'Not saved' in p.inner_text('#cx-status') and 'couldn’t save' in ' '.join(texts(p)))
    check('offers email fallback when unsaved', p.locator('#chat-qr a', has_text='Email us').count() == 1)
    p.close()

    state = {'reqs': [], 'mode': 'ok', 'saved': True}
    cids = []
    for _ in range(2):
        p = new_page(b, 1280, 800, ai=True, backend=backend)
        p.click('#nv .nv-chat'); p.fill('#chat-input', 'hi'); p.keyboard.press('Enter'); p.wait_for_timeout(600); cids.append(state['reqs'][-1]['conversation_id']); p.close()
    check('two visitors get different conversation and message ids', cids[0] != cids[1])
    b.close()
srv.terminate()
f = [n for n, ok in res if not ok]
print('\n%d passed, %d failed' % (len(res) - len(f), len(f)))
sys.exit(1 if f else 0)
