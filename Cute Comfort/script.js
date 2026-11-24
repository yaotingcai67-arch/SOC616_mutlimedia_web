/* ============================================================
   script.js — all behaviour for the site.
   Loaded by: <script src="script.js" defer></script> in index.html
   No libraries, no build step, no network requests.

   CONFIG FIRST: to make Nailoong actually SEND your own stickers
   inside the live chat, put files in assets/ and fill in the paths
   below. Leave a value as '' to fall back to the CSS-drawn dragon.
   ============================================================ */

const STICKER_ASSETS = {
  exam:    'assets/failed-exam.png',   // e.g. 'assets/failed-exam.png'
  tired:   'assets/wiped-out.png',   // e.g. 'assets/wiped-out.png'
  read:    'assets/there-there.png',   // e.g. 'assets/there-there.png'
  fine:    'assets/there-there.png',   // e.g. 'assets/there-there.png'
  comfort: 'assets/there-there.png'    // e.g. 'assets/there-there.png'
};

const STORE_KEY = 'nailoong2046:v2';

(function(){
  'use strict';

  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));

  /* ---------- tiny helpers ---------- */
  let toastTimer;
  function toast(msg){
    const t = $('#toast');
    if(!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function load(){
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; }
    catch(e){ return null; }
  }
  function save(){
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch(e){ /* private mode: still works in memory */ }
  }

  /* ---------- state ---------- */
  const blank = () => ({
    turns: 0,
    counts: {L1:0, L2:0, L3:0},
    tags: [],
    uses: [true,true,true,true],
    choiceHistory: {free:0, paid:0},
    messages: [],
    trail: []
  });
  let state = load() || blank();
  // normalise old / partial saves
  state = Object.assign(blank(), state);
  state.counts = Object.assign({L1:0,L2:0,L3:0}, state.counts);
  state.choiceHistory = Object.assign({free:0,paid:0}, state.choiceHistory);

  /* ---------- scroll progress + active nav ---------- */
  const progress = $('#progress');
  const navLinks = $$('.nav-links a');
  const sections = navLinks.map(a => $(a.getAttribute('href'))).filter(Boolean);

  function onScroll(){
    const h = document.documentElement;
    const pct = h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight);
    if(progress) progress.style.width = (pct*100).toFixed(2) + '%';

    let active = -1;
    sections.forEach((sec, i) => {
      if(sec.getBoundingClientRect().top <= 140) active = i;
    });
    navLinks.forEach((a, i) => a.classList.toggle('active', i === active));
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- reveal on scroll ---------- */
  const rvItems = $$('.rv');
  if('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.12, rootMargin:'0px 0px -40px 0px'});
    rvItems.forEach(el => io.observe(el));
  } else {
    rvItems.forEach(el => el.classList.add('in'));
  }

  /* ============================================================
     LIVE DEMO
     ============================================================ */
  const REPLIES = {
    exam:   {text:'oh no. that exam can go sit in a corner. 🐲', sticker:'exam',    infer:'exam-related distress detected'},
    tired:  {text:'no talking required. just exist for a bit.',  sticker:'tired',   infer:'evening fatigue pattern confirmed'},
    read:   {text:'their loss. i am still here, look at me.',     sticker:'read',    infer:'sensitivity to response latency'},
    fine:   {text:'sure. i will leave the door open anyway.',     sticker:'fine',    infer:'self-report conflicts with behavioural signal'},
    free:   {text:'i heard you. want a silly sticker or a quiet one?', sticker:'comfort', infer:'accepts reassurance-style content'}
  };
  const MOOD_TEXT = {
    exam:'The exam went badly', tired:"I'm wiped out",
    read:'They left me on read', fine:"I'm fine, actually"
  };
  const TAG_POOL = [
    'prefers reassurance', 'night-time user', 'stress: elevated',
    'low resilience (model estimate)', 'reachable 21:00-23:00',
    'avoidant self-report', 'high comfort engagement'
  ];

  const chatLog = $('#chat-log');
  const trail   = $('#trail');

  function stickerHTML(key){
    const src = STICKER_ASSETS[key] || STICKER_ASSETS.comfort;
    if(src) return '<img class="sticker-in-chat" src="'+esc(src)+'" alt="Nailoong sticker">';
    return '<span class="chat-sticker" aria-hidden="true"><span class="blob"></span></span>';
  }
  function addMsg(side, html, store){
    if(!chatLog) return;
    const wrap = document.createElement('div');
    wrap.className = 'msg ' + side;
    wrap.innerHTML = (side === 'them' ? '<span class="avatar" aria-hidden="true"></span>' : '') +
                     '<span class="bubble">' + html + '</span>';
    chatLog.appendChild(wrap);
    chatLog.scrollTop = chatLog.scrollHeight;
    if(store) state.messages.push({side, html});
  }
  function addTrail(lv, text, store){
    const empty = $('#trail-empty');
    if(empty) empty.remove();
    if(!trail) return;
    const item = document.createElement('div');
    item.className = 'trail-item';
    item.innerHTML = '<span class="lv">'+lv+'</span><span>'+esc(text)+'</span>';
    trail.prepend(item);
    state.counts[lv]++;
    if(store) state.trail.push({lv, text});
    renderCounts();
  }
  function renderCounts(){
    const total = state.counts.L1 + state.counts.L2 + state.counts.L3;
    ['L1','L2','L3'].forEach(k => {
      const el = $('#c-'+k.toLowerCase());
      if(el) el.textContent = state.counts[k];
    });
    const pc = $('#point-count');
    if(pc) pc.textContent = total + (total === 1 ? ' data point' : ' data points');
    const ac = $('#arrival-count');
    if(ac) ac.textContent = total + (total === 1 ? ' data point' : ' data points');
    const al = $('#arrival-line');
    if(al) al.innerHTML = 'You arrive here with <b>'+total+' data points</b> already generated in the demo above. Now choose a service.';
    const fs = $('#foot-session');
    if(fs) fs.textContent = 'Session: ' + total + (total === 1 ? ' data point' : ' data points');

    const pct = Math.min(100, state.turns * 17);
    const stress = Math.min(100, pct + (state.counts.L3 > 2 ? 12 : 0));
    const reassure = Math.min(100, Math.round(pct * 1.15));
    const windowPct = Math.min(100, Math.round(pct * .8));
    [['bar-stress','val-stress',stress],['bar-reassure','val-reassure',reassure],['bar-window','val-window',windowPct]]
      .forEach(([b,v,n]) => {
        const bar = $('#'+b), val = $('#'+v);
        if(bar) bar.style.width = n + '%';
        if(val) val.textContent = n + '%';
      });
  }
  function renderTags(){
    const box = $('#profile-tags');
    if(!box) return;
    box.innerHTML = state.tags.length
      ? state.tags.map(t => '<span class="tag-pill">'+esc(t)+'</span>').join('')
      : '<span class="tag-pill muted-pill">none yet</span>';
  }
  function renderUses(){
    $$('.switch').forEach(sw => {
      const on = state.uses[Number(sw.dataset.use)];
      sw.classList.toggle('on', on);
      sw.setAttribute('aria-pressed', String(on));
    });
    const n = state.uses.filter(Boolean).length;
    const el = $('#use-state');
    if(el) el.textContent = n === 0
      ? 'All secondary uses switched off. This is what "limit secondary uses" would actually feel like.'
      : n + ' of 4 uses active · you cannot see or correct any of them here.';
  }

  function typing(on){
    const old = document.getElementById('typing');
    if(old) old.remove();
    if(!on || !chatLog) return;
    const d = document.createElement('div');
    d.className = 'msg them';
    d.id = 'typing';
    d.innerHTML = '<span class="avatar" aria-hidden="true"></span><span class="bubble typing"><i></i><i></i><i></i></span>';
    chatLog.appendChild(d);
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function send(text, mood){
    if(!text.trim()) return;
    const key = mood || 'free';
    const reply = REPLIES[key];

    addMsg('me', esc(text), true);
    addTrail('L1', 'message: "' + text.slice(0,48) + '"', true);
    state.turns++;

    typing(true);
    setTimeout(() => {
      typing(false);
      addMsg('them', esc(reply.text) + stickerHTML(reply.sticker), true);
      addTrail('L2', '21:47 · turn ' + state.turns + ' · stayed after reply', true);
      addTrail('L3', reply.infer, true);

      if(state.turns === 1) state.tags.push(TAG_POOL[0]);
      if(state.turns === 2) state.tags.push(TAG_POOL[1]);
      if(state.turns === 3) state.tags.push(TAG_POOL[2]);
      if(state.turns === 4) state.tags.push(TAG_POOL[3]);
      if(state.turns === 5) state.tags.push(TAG_POOL[4]);
      state.tags = state.tags.filter((v,i,a) => a.indexOf(v) === i);
      renderTags();
      save();
      if(state.turns === 3) toast('A profile is forming. Check the "Inferred profile" tab →');
    }, 620);
  }

  // restore a saved session into the DOM
  // Replay in the original push order: addTrail() prepends, so feeding the
  // array forwards reproduces exactly the "newest on top" order from before.
  // Counts are zeroed first because addTrail() increments them as it replays.
  function restore(){
    if(!chatLog) return;
    state.messages.forEach(m => addMsg(m.side, m.html, false));
    state.counts = {L1:0, L2:0, L3:0};
    state.trail.forEach(t => addTrail(t.lv, t.text, false));
    renderTags();
    renderUses();
    renderCounts();
    renderChoiceRecord();
    const sid = $('#session-id');
    if(sid && state.turns > 0){
      sid.textContent = 'session ' + String(state.turns).padStart(2,'0') + ' · resumed';
    }
  }

  $$('.chip').forEach(chip => {
    chip.addEventListener('click', () => send(MOOD_TEXT[chip.dataset.mood], chip.dataset.mood));
  });
  const composer = $('#composer');
  if(composer){
    composer.addEventListener('submit', e => {
      e.preventDefault();
      const input = $('#composer-input');
      send(input.value.trim(), null);
      input.value = '';
      input.focus();
    });
  }

  // tabs
  $$('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.tab').forEach(t => {
        const on = t === tab;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
      });
      $$('.panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab.dataset.tab));
    });
  });

  // downstream switches
  $$('.switch').forEach(sw => {
    sw.addEventListener('click', () => {
      const i = Number(sw.dataset.use);
      state.uses[i] = !state.uses[i];
      renderUses();
      save();
      if(!state.uses[i]) toast('Use switched off — in this demo, that is all it would take.');
    });
  });

  function resetSession(){
    const keep = {choiceHistory: state.choiceHistory};
    state = Object.assign(blank(), keep);
    save();
    if(chatLog){
      $$('.msg, .sys', chatLog).forEach(n => n.remove());
      const sys = document.createElement('div');
      sys.className = 'sys';
      sys.textContent = 'SESSION RESET · 21:47 HKT · FREE TIER WITH PERSONALISED TRACKING';
      chatLog.appendChild(sys);
      addMsg('them', 'hey. rough one?', false);
    }
    if(trail){
      trail.innerHTML = '<div class="trail-empty" id="trail-empty">Nothing logged yet. Send a message and watch this column fill.</div>';
    }
    renderTags(); renderUses(); renderCounts(); renderChoiceRecord();
    const sid = $('#session-id');
    if(sid) sid.textContent = 'session —';
    toast('Session reset. Your choice history is kept.');
  }
  const rs = $('#reset-session');
  if(rs) rs.addEventListener('click', resetSession);

  /* ============================================================
     STICKY LAYER NARRATIVE
     ============================================================ */
  const LAYER_COPY = [
    ['L1 · What you handed over', 'Words, images, voice notes, that "I\'m fine". The layer most easily mistaken for "all the data there is".'],
    ['L2 · What you left behind', 'Timing, repetition, hesitation. You never said any of it; all of it was logged.'],
    ['L3 · What was inferred', 'A judgement produced by a model — able to shape what you see, even when it is wrong.']
  ];
  const layerEls = $$('.scroll-layer');
  if('IntersectionObserver' in window && layerEls.length){
    const lio = new IntersectionObserver(es => {
      es.forEach(e => {
        if(!e.isIntersecting) return;
        const i = Number(e.target.dataset.layer);
        const ind = $('#layer-indicator'), hint = $('#layer-hint');
        if(ind) ind.textContent = LAYER_COPY[i][0];
        if(hint) hint.textContent = LAYER_COPY[i][1];
        $$('.sticky-dots i').forEach((d,j) => d.classList.toggle('on', j === i));
        layerEls.forEach((l,j) => l.classList.toggle('active', j === i));
      });
    }, {threshold:.55, rootMargin:'-15% 0px -25% 0px'});
    layerEls.forEach(el => lio.observe(el));
  }

  /* ============================================================
     THE CHOICE
     ============================================================ */
  const choices = $$('.choice');
  const reveal  = $('#reveal');
  const verdict = $('#verdict');
  const title   = $('[data-reveal-title]');
  const line    = $('[data-reveal-line]');
  const feedback= $('#feedback');
  const answers = $$('.ans');

  const copy = {
    free: ["You chose Free comfort · with personalised tracking",
           "The comfort is free. The cost is that when you're vulnerable, and what soothes you best, become something predictable and priceable."],
    paid: ["You chose Private comfort · monthly fee",
           "You bought comfort without tracking — provided you can afford the monthly fee, and afford the fact that other people don't have that option."]
  };
  const replies = {
    a: "But the three layers only appeared after you chose. If information always arrives afterwards, consent stays a little suspended.",
    b: "That's exactly the worry: when the options are unequal, formal freedom isn't the same as realistic control (digital resignation).",
    c: "That's the point — meaningful ownership hinges on whether you can access and correct that inferred judgement."
  };
  function renderChoiceRecord(){
    const el = $('#choice-record');
    if(!el) return;
    const f = state.choiceHistory.free, p = state.choiceHistory.paid;
    el.textContent = (f + p) === 0
      ? 'Your choice history: none yet'
      : 'Your choice history: ' + f + '× free · ' + p + '× private (remembered in this browser)';
  }

  choices.forEach(btn => {
    btn.addEventListener('click', () => {
      choices.forEach(b => b.classList.remove('is-picked'));
      btn.classList.add('is-picked');
      const k = btn.dataset.choice;
      state.choiceHistory[k]++;
      save();
      renderChoiceRecord();
      title.textContent = copy[k][0];
      line.textContent  = copy[k][1];
      feedback.textContent = '';
      answers.forEach(a => a.classList.remove('sel'));
      reveal.hidden = false;
      verdict.hidden = false;
      requestAnimationFrame(() => reveal.scrollIntoView({behavior:'smooth', block:'center'}));
    });
  });
  answers.forEach(a => {
    a.addEventListener('click', () => {
      answers.forEach(x => x.classList.remove('sel'));
      a.classList.add('sel');
      feedback.textContent = replies[a.dataset.ans];
    });
  });
  const resetChoice = $('#reset');
  if(resetChoice){
    resetChoice.addEventListener('click', () => {
      reveal.hidden = true;
      verdict.hidden = true;
      choices.forEach(b => b.classList.remove('is-picked'));
      answers.forEach(a => a.classList.remove('sel'));
      feedback.textContent = '';
      $('#choice').scrollIntoView({behavior:'smooth', block:'start'});
    });
  }

  /* ---------- ownership checklist ---------- */
  $$('.check').forEach(c => {
    c.addEventListener('click', () => {
      c.setAttribute('aria-checked', c.getAttribute('aria-checked') === 'true' ? 'false' : 'true');
    });
  });

  /* ---------- footer: clear everything ---------- */
  const clearAll = $('#clear-all');
  if(clearAll){
    clearAll.addEventListener('click', () => {
      try { localStorage.removeItem(STORE_KEY); } catch(e){}
      state = blank();
      resetSession();
      renderChoiceRecord();
      toast('All locally saved data cleared.');
    });
  }

  restore();
})();
