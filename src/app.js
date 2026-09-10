/* ============================================================
   QUESTION BANK — original CISM-style items (domain-tagged)
   domains: gov | risk | prog | inc
   ============================================================ */
const DOMAINS = {
  gov:  {name:"Information Security Governance", short:"Governance", weight:17},
  risk: {name:"Information Security Risk Management", short:"Risk Management", weight:20},
  prog: {name:"Information Security Program", short:"Security Program", weight:33},
  inc:  {name:"Incident Management", short:"Incident Management", weight:30}
};

/*__BANK__*/

/* ============================================================
   STATE
   ============================================================ */
let cfg = {set:"full", mode:"exam", drill:"prog"};
let state = null;
let SETS = null;
const SET_KEYS = ["A","B","C","D"];

function pickSet(btn,s){
  document.querySelectorAll('[data-set]').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  cfg.set=s;
  document.getElementById('drillRow').style.display = s==='drill' ? 'grid' : 'none';
}
function pickDrill(btn,d){
  document.querySelectorAll('[data-drill]').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  cfg.drill=d;
}
function pickMode(btn,m){document.querySelectorAll('[data-mode]').forEach(b=>b.classList.remove('on'));btn.classList.add('on');cfg.mode=m;}

function shuffle(arr){const a=arr.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* Concept-aware dealing: similar items are kept out of the same mock */
const STOP=new Set('the a an of to in for and or is are be which following most best first primary greatest should would with that this on by from into as at it its when what who information security manager organization enterprise'.split(' '));
function tokens(q){ return new Set((q.q+' '+q.o[q.a]).toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>3&&!STOP.has(w))); }
function similar(a,b){ const A=a._t||(a._t=tokens(a)), B=b._t||(b._t=tokens(b)); let inter=0; A.forEach(w=>{if(B.has(w))inter++;}); const union=A.size+B.size-inter; return union? inter/union>=0.45 : false; }
function buildSets(){
  if(SETS) return SETS;
  const byDom={};
  BANK.forEach(q=>{(byDom[q.d]=byDom[q.d]||[]).push(q);});
  const sets={}; SET_KEYS.forEach(k=>sets[k]=[]);
  Object.keys(byDom).forEach(d=>{
    byDom[d].forEach((q,i)=>{
      const order=SET_KEYS.map((_,j)=>SET_KEYS[(i+j)%SET_KEYS.length]);
      const k=order.find(k=>!sets[k].some(x=>x.d===d&&similar(x,q))) || order[0];
      sets[k].push(q);
    });
  });
  let guard=0;
  while(guard++<40){
    const sorted=SET_KEYS.slice().sort((a,b)=>sets[b].length-sets[a].length);
    const big=sorted[0], small=sorted[sorted.length-1];
    if(sets[big].length - sets[small].length <= 1) break;
    sets[small].push(sets[big].pop());
  }
  SETS=sets; return sets;
}
function weightedSample(n){
  const byDom={};
  BANK.forEach(q=>{(byDom[q.d]=byDom[q.d]||[]).push(q);});
  const order=["prog","inc","risk","gov"];
  const totalW=order.reduce((s,d)=>s+DOMAINS[d].weight,0);
  let picked=[], used=0;
  order.forEach((d,idx)=>{
    let take = idx===order.length-1 ? (n-used) : Math.round(n*DOMAINS[d].weight/totalW);
    take=Math.min(take, byDom[d].length);
    const pool=shuffle(byDom[d]); const chosen=[];
    for(const q of pool){ if(chosen.length>=take) break; if(!chosen.some(x=>similar(x,q))) chosen.push(q); }
    for(const q of pool){ if(chosen.length>=take) break; if(!chosen.includes(q)) chosen.push(q); }
    picked=picked.concat(chosen); used+=chosen.length;
  });
  return shuffle(picked).slice(0,n);
}
/* Shuffle each question's answer options so the correct letter varies every run */
function prep(q){
  const idx=shuffle([0,1,2,3]);
  return {d:q.d, q:q.q, o:idx.map(i=>q.o[i]), a:idx.indexOf(q.a), e:q.e, r:q.r?idx.map(i=>q.r[i]):null, id:q.id};
}

function buildSelection(){
  if(cfg.set==='full')  return weightedSample(150).map(prep);   // real exam: 150 items, blueprint-weighted
  if(cfg.set==='quick') return weightedSample(20).map(prep);
  if(cfg.set==='missed') return shuffle(BANK.filter(q=>WEAK[q.id]||LUCKY[q.id])).map(prep);
  if(cfg.set==='drill') return shuffle(BANK.filter(q=>q.d===cfg.drill)).map(prep);
  return shuffle(buildSets()[cfg.set]).map(prep);
}

/* Real exam pacing: 4 hours / 150 questions = 96 seconds per question (150 questions = 4:00:00) */
function examSeconds(n){ return n*96; }

function startExam(){
  const qs = buildSelection();
  if(!qs.length){ alert('No questions in this set yet.'); return; }
  state = {
    qs,
    idx:0,
    answers:new Array(qs.length).fill(null),
    flags:new Array(qs.length).fill(false),
    mode:cfg.mode,
    finished:false,
    timeLeft: cfg.mode==="exam" ? examSeconds(qs.length) : null, // 96s/question = real exam pace; full set = 4:00:00
    timer:null,
    startedAt:Date.now(),
    set:cfg.set, drill:cfg.drill,
    guess:[], times:[], lastIdx:null, lastAt:Date.now()
  };
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('examScreen').classList.remove('hidden');
  document.getElementById('actionbar').classList.remove('hidden');
  document.getElementById('barMeta').classList.remove('hidden');
  document.getElementById('mainNav').classList.add('hidden');
  if(state.mode==="exam"){ startTimer(); } else { document.getElementById('timer').classList.add('hidden'); }
  renderQuestion();
  window.scrollTo(0,0);
}

function startTimer(){
  updateTimer();
  state.timer=setInterval(()=>{
    state.timeLeft--;
    updateTimer();
    if(state.timeLeft%10===0) persistProgress();
    if(state.timeLeft<=0){clearInterval(state.timer);finish(true);}
  },1000);
}
function updateTimer(){
  const t=document.getElementById('timer');
  const m=Math.floor(state.timeLeft/60), s=state.timeLeft%60;
  t.textContent=`${m}:${String(s).padStart(2,'0')}`;
  t.classList.toggle('warn', state.timeLeft<=300);
}

function renderQuestion(){
  trackTime();
  const q=state.qs[state.idx];
  const total=state.qs.length;
  const gb=document.getElementById('guessBox'); if(gb) gb.checked=!!state.guess[state.idx];
  document.getElementById('counter').textContent=`Question ${state.idx+1} of ${total}`;
  document.getElementById('progbar').style.width=`${((state.idx+1)/total)*100}%`;
  document.getElementById('qtag').textContent=`Question ${state.idx+1}`;
  document.getElementById('qtext').textContent=q.q;

  const answered=state.answers[state.idx];
  const revealed = state.mode==="practice" && answered!==null;

  const box=document.getElementById('options');
  box.innerHTML='';
  q.o.forEach((opt,i)=>{
    const b=document.createElement('button');
    b.className='option';
    b.setAttribute('type','button');
    if(answered===i) b.classList.add('selected');
    if(revealed){
      b.classList.add('locked');
      if(i===q.a) b.classList.add('correct');
      else if(answered===i) b.classList.add('incorrect');
    }
    b.innerHTML=`<span class="key">${String.fromCharCode(65+i)}</span><span class="body">${opt}</span>`;
    b.onclick=()=>choose(i);
    box.appendChild(b);
  });

  // explanation (practice mode, after answering)
  const ex=document.getElementById('explain');
  if(revealed){
    const correct=answered===q.a;
    ex.classList.remove('hidden');
    ex.innerHTML=`<div class="verdict ${correct?'ok':'no'}">${correct?'Correct':'Not quite'}</div>
      <div>${q.e}</div>${rationaleHtml(q)}<div style="margin-top:10px">${flagBtn(q)}</div>
      <div class="dom">${DOMAINS[q.d].name}</div>`;
  } else {
    ex.classList.add('hidden');
  }

  // flag button
  const fb=document.getElementById('flagBtn');
  fb.classList.toggle('flagged', state.flags[state.idx]);
  fb.innerHTML=`<span class="flagdot"></span> ${state.flags[state.idx]?'Flagged':'Flag'}`;

  // prev/next
  document.getElementById('prevBtn').disabled = state.idx===0;
  document.getElementById('nextBtn').textContent = state.idx===total-1 ? (state.mode==='exam'?'Finish':'See results') : 'Next';
  window.scrollTo({top:0,behavior:'smooth'});
  persistProgress();
}

function choose(i){
  if(state.mode==="practice" && state.answers[state.idx]!==null) return; // locked
  state.answers[state.idx]=i;
  renderQuestion();
}

function nextQ(){
  if(state.idx===state.qs.length-1){
    if(state.mode==='exam'){ confirmFinish(); } else { finish(false); }
    return;
  }
  state.idx++;
  renderQuestion();
}
function prevQ(){ if(state.idx>0){state.idx--;renderQuestion();} }
function toggleFlag(){ state.flags[state.idx]=!state.flags[state.idx]; renderQuestion(); }

/* ---------- Navigator ---------- */
function openNav(){
  const answeredCount=state.answers.filter(a=>a!==null).length;
  const scrim=document.createElement('div');scrim.className='scrim';scrim.id='scrim';scrim.onclick=closeNav;
  const panel=document.createElement('div');panel.className='navpanel';
  panel.innerHTML=`
    <header><h3>Question navigator</h3><button class="icbtn" onclick="closeNav()">Close</button></header>
    <div class="navlegend">
      <span><i style="background:var(--accent-soft);border:1px solid #a9c0f0"></i>Answered</span>
      <span><i style="background:#fff;border:1px solid var(--line)"></i>Unanswered</span>
      <span><i style="background:var(--flag)"></i>Flagged</span>
    </div>
    <div class="grid" id="navGrid"></div>
    <div class="navfoot">
      <div style="font-size:.85rem;color:var(--muted);margin-bottom:10px">${answeredCount} of ${state.qs.length} answered${state.flags.filter(Boolean).length?` · ${state.flags.filter(Boolean).length} flagged`:''}</div>
      <button class="btn" style="width:100%" onclick="${state.mode==='exam'?'confirmFinish()':'finish(false)'}">${state.mode==='exam'?'End exam &amp; see score':'Finish &amp; see results'}</button>
    </div>`;
  document.body.appendChild(scrim);document.body.appendChild(panel);
  const g=panel.querySelector('#navGrid');
  state.qs.forEach((q,i)=>{
    const c=document.createElement('button');
    c.className='gcell'+(state.answers[i]!==null?' answered':'')+(state.flags[i]?' flag':'')+(i===state.idx?' current':'');
    c.textContent=i+1;
    c.onclick=()=>{state.idx=i;closeNav();renderQuestion();};
    g.appendChild(c);
  });
}
function closeNav(){document.getElementById('scrim')?.remove();document.querySelector('.navpanel')?.remove();}

function confirmFinish(){
  const un=state.answers.filter(a=>a===null).length;
  const msg = un>0
    ? `You have ${un} unanswered question${un>1?'s':''}. End the exam and see your score?`
    : `End the exam and see your score?`;
  if(confirm(msg)) finish(false);
}

/* ---------- Results ---------- */
function finish(auto){
  closeNav();
  if(state.timer) clearInterval(state.timer);
  trackTime();
  state.finished=true;
  state.elapsed = Math.round((Date.now()-state.startedAt)/1000);

  let correct=0;
  const dom={};
  Object.keys(DOMAINS).forEach(d=>dom[d]={c:0,t:0});
  state.qs.forEach((q,i)=>{
    dom[q.d].t++;
    if(state.answers[i]===q.a){correct++;dom[q.d].c++;}
  });
  state.correct=correct; state.dom=dom;
  state.elapsed = Math.round((Date.now()-state.startedAt)/1000);
  recordAttempt(auto);

  document.getElementById('examScreen').classList.add('hidden');
  document.getElementById('actionbar').classList.add('hidden');
  document.getElementById('barMeta').classList.add('hidden');
  document.getElementById('mainNav').classList.remove('hidden');
  setTab('exam');
  document.getElementById('resultsScreen').classList.remove('hidden');

  const pct=Math.round(correct/state.qs.length*100);
  document.getElementById('scorePct').textContent=pct+'%';
  document.getElementById('scoreFrac').textContent=`${correct} of ${state.qs.length} correct`;

  const pill=document.getElementById('verdictPill');
  let cls,label;
  if(pct>=70){cls='pass';label='On track — keep it here';}
  else if(pct>=60){cls='mid';label='Borderline — more reps needed';}
  else {cls='low';label='Below target — consider more prep time';}
  pill.innerHTML=`<span class="verdictpill ${cls}">${label}</span>`;

  // domain bars
  const wrap=document.getElementById('dombars');
  wrap.innerHTML='';
  ["gov","risk","prog","inc"].forEach(d=>{
    const {c,t}=dom[d];
    const p = t? Math.round(c/t*100):0;
    const band = p>=70?'g':(p>=60?'m':'l');
    const el=document.createElement('div');
    el.className='dombar';
    el.innerHTML=`
      <div class="dhead">
        <div class="nm">${DOMAINS[d].short}<span>${DOMAINS[d].weight}% of exam</span></div>
        <div class="val">${c}/${t} · ${p}% · <a href="#" class="lessonlink" onclick="showLessons(${LESSON_OF[d]},'results');return false">lesson</a></div>
      </div>
      <div class="track"><i class="${band}" style="width:${p}%"></i></div>`;
    wrap.appendChild(el);
  });

  const mm=Math.floor(state.elapsed/60), ss=state.elapsed%60;
  document.getElementById('metaLine').innerHTML=
    `<span>Time used: ${mm}m ${ss}s</span><span>Mode: ${state.mode==='exam'?'Exam (timed)':'Practice'}</span><span>v${APP_VERSION}</span>${auto?'<span style="color:var(--wrong)">Time expired</span>':''}<span>Avg ${state.pace?state.pace.avg:0}s/question · ${state.pace?state.pace.slow:0} over 2 min</span><span>Lucky guesses: ${state.luckyN||0}</span><span><a href="#" class="lessonlink" onclick="goTo('history');return false">Saved to history →</a></span>`;

  window.scrollTo(0,0);
}

/* ---------- Answer review ---------- */
let reviewFilter='all';
function showReview(f){
  reviewFilter=f||'all';
  document.getElementById('resultsScreen').classList.add('hidden');
  document.getElementById('reviewScreen').classList.remove('hidden');
  renderFilters();
  renderReviewList();
  window.scrollTo(0,0);
}
function backToResults(){
  document.getElementById('reviewScreen').classList.add('hidden');
  document.getElementById('resultsScreen').classList.remove('hidden');
  window.scrollTo(0,0);
}
function renderFilters(){
  const wrongN=state.qs.filter((q,i)=>state.answers[i]!==q.a).length;
  const flagN=state.flags.filter(Boolean).length;
  const defs=[["all",`All (${state.qs.length})`],["incorrect",`Incorrect (${wrongN})`],["flagged",`Flagged (${flagN})`]];
  const gN=state.qs.filter((q,i)=>state.guess&&state.guess[i]).length, sN=state.qs.filter((q,i)=>(state.times[i]||0)>120).length;
  if(gN) defs.push(["guessed","Guessed ("+gN+")"]); if(sN) defs.push(["slow","Slow >2m ("+sN+")"]);
  ["gov","risk","prog","inc"].forEach(d=>{const n=state.qs.filter(q=>q.d===d).length;if(n)defs.push(["d:"+d,DOMAINS[d].short+" ("+n+")"]);});
  const box=document.getElementById('filters');
  box.innerHTML='';
  defs.forEach(([k,lbl])=>{
    const b=document.createElement('button');
    b.className='chip'+(reviewFilter===k?' on':'');
    b.textContent=lbl;
    b.onclick=()=>{reviewFilter=k;renderFilters();renderReviewList();};
    box.appendChild(b);
  });
}
function renderReviewList(){
  const list=document.getElementById('reviewList');
  list.innerHTML='';
  let shown=0;
  state.qs.forEach((q,i)=>{
    const ans=state.answers[i];
    const isWrong=ans!==q.a;
    if(reviewFilter==='incorrect' && !isWrong) return;
    if(reviewFilter==='flagged' && !state.flags[i]) return;
    if(reviewFilter.indexOf('d:')===0 && q.d!==reviewFilter.slice(2)) return;
    if(reviewFilter==='guessed' && !(state.guess&&state.guess[i])) return;
    if(reviewFilter==='slow' && !((state.times[i]||0)>120)) return;
    shown++;
    const item=document.createElement('div');
    item.className='rev-item';
    let tags=`<span class="tg dom">${DOMAINS[q.d].short}</span><span class="tg dom">${Math.round(state.times[i]||0)}s</span>`;
    if(state.guess&&state.guess[i]) tags+=`<span class="tg skip">Guessed</span>`;
    if(ans===null) tags+=`<span class="tg skip">Skipped</span>`;
    else if(isWrong) tags+=`<span class="tg no">Your answer wrong</span>`;
    else tags+=`<span class="tg ok">Correct</span>`;
    if(state.flags[i]) tags+=`<span class="tg" style="background:var(--flag-soft);color:var(--flag)">Flagged</span>`;

    let opts='';
    q.o.forEach((o,oi)=>{
      let c='ro';
      if(oi===q.a) c+=' correct';
      else if(oi===ans && isWrong) c+=' chosen-wrong';
      const badge = oi===q.a ? ' ✓' : (oi===ans&&isWrong?' ✗':'');
      opts+=`<div class="${c}"><span class="k">${String.fromCharCode(65+oi)}</span><span>${o}${badge}</span></div>`;
    });

    item.innerHTML=`<div class="tags">${tags}</div>
      <p class="rq">Q${i+1}. ${q.q}</p>
      ${opts}
      <div class="rex">${q.e}${rationaleHtml(q)}</div><div style="margin-top:10px">${flagBtn(q)}</div>`;
    list.appendChild(item);
  });
  if(shown===0){
    list.innerHTML=`<p style="color:var(--muted);text-align:center;padding:24px">Nothing to show in this filter.</p>`;
  }
}

function restart(){
  document.getElementById('historyScreen').classList.add('hidden');
  document.getElementById('cardsScreen').classList.add('hidden');
  document.getElementById('lessonsScreen').classList.add('hidden');
  document.getElementById('resultsScreen').classList.add('hidden');
  document.getElementById('reviewScreen').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');
  document.getElementById('timer').classList.remove('hidden');
  state=null;
  setTab('exam');
  renderResumeBanner(); updateMissedCount();
  window.scrollTo(0,0);
}

/* ---------- Lessons ---------- */
const LESSON_OF={gov:1,risk:2,prog:3,inc:4};
let lessonsFrom='start';
function showLessons(i,from){
  lessonsFrom = from || 'start';
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('resultsScreen').classList.add('hidden');
  document.getElementById('cardsScreen').classList.add('hidden');
  document.getElementById('historyScreen').classList.add('hidden');
  document.getElementById('lessonsScreen').classList.remove('hidden');
  showLesson(i||0);
  setTab('lessons');
}
function showLesson(i){
  document.querySelectorAll('.lesson-page').forEach(p=>p.classList.remove('on'));
  document.getElementById('lesson-'+i).classList.add('on');
  document.querySelectorAll('.lchip').forEach(c=>c.classList.toggle('on', c.getAttribute('data-lesson')===String(i)));
  window.scrollTo(0,0);
}
function leaveLessons(){
  document.getElementById('lessonsScreen').classList.add('hidden');
  document.getElementById(lessonsFrom==='results'?'resultsScreen':'startScreen').classList.remove('hidden');
  setTab('exam');
  window.scrollTo(0,0);
}
function drillFromLesson(d){
  cfg.set='drill'; cfg.drill=d;
  document.querySelectorAll('[data-set]').forEach(b=>b.classList.toggle('on', b.getAttribute('data-set')==='drill'));
  document.getElementById('drillRow').style.display='grid';
  document.querySelectorAll('[data-drill]').forEach(b=>b.classList.toggle('on', b.getAttribute('data-drill')===d));
  lessonsFrom='start';
  leaveLessons();
}

/* ---------- Index card data ---------- */
/*__BLUF__*//*__CARDS__*/
/* ---------- Storage (safe: works with or without localStorage) ---------- */
const safeStore={
  mem:{},
  get(k){try{return localStorage.getItem(k);}catch(e){return this.mem[k]??null;}},
  set(k,v){try{localStorage.setItem(k,v);}catch(e){this.mem[k]=v;}}
};

/* ---------- Theme ---------- */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  const b=document.getElementById('themeBtn'); if(b) b.textContent = t==='dark' ? '☀' : '☾';
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.setAttribute('content', t==='dark'?'#0b1220':'#0f172a');
}
function toggleTheme(){
  const t=document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark';
  safeStore.set('cism.theme',t); applyTheme(t);
}
(function initTheme(){
  const saved=safeStore.get('cism.theme');
  const prefersDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved||(prefersDark?'dark':'light'));
})();

/* ---------- Section navigation ---------- */
const SCREENS=['startScreen','lessonsScreen','cardsScreen','historyScreen','resultsScreen','reviewScreen'];
function setTab(sec){document.querySelectorAll('#mainNav .tab').forEach(b=>b.classList.toggle('on',b.getAttribute('data-nav')===sec));}
function goTo(sec){
  if(state && !state.finished) return;               // never leave a live exam via nav
  SCREENS.forEach(id=>document.getElementById(id).classList.add('hidden'));
  const target = sec==='lessons' ? 'lessonsScreen' : sec==='cards' ? 'cardsScreen' : sec==='history' ? 'historyScreen' : (state&&state.finished ? 'resultsScreen' : 'startScreen');
  document.getElementById(target).classList.remove('hidden');
  if(sec==='cards') renderCards();
  if(sec==='history') renderHistory();
  if(sec==='exam') { renderResumeBanner(); updateMissedCount(); }
  if(sec==='lessons') lessonsFrom='start';
  setTab(sec); window.scrollTo(0,0);
}

/* ---------- Index cards: shared ---------- */
const CARD_DOMS={mind:"Mindset",gov:"Governance",risk:"Risk Management",prog:"Security Program",inc:"Incident Management"};
let cardMode='bluf', cardDom='all';
function setCardMode(m){
  cardMode=m;
  document.getElementById('tabBluf').classList.toggle('on',m==='bluf');
  document.getElementById('tabFlash').classList.toggle('on',m==='flash');
  document.getElementById('blufView').classList.toggle('hidden',m!=='bluf');
  document.getElementById('flashView').classList.toggle('hidden',m!=='flash');
  renderCards();
}
function renderCards(){
  const box=document.getElementById('cardDomains'); box.innerHTML='';
  [['all','All']].concat(Object.entries(CARD_DOMS)).forEach(([k,lbl])=>{
    const b=document.createElement('button'); b.className='chip'+(cardDom===k?' on':''); b.textContent=lbl;
    b.onclick=()=>{cardDom=k; renderCards();}; box.appendChild(b);
  });
  if(cardMode==='bluf') renderBluf(); else rebuildDeck();
}

/* ---------- BLUF cards ---------- */
let blufList=[], blufIdx=0;
function renderBluf(){
  blufList=BLUF.map((c,i)=>({...c,i})).filter(c=>cardDom==='all'||c.d===cardDom);
  const g=document.getElementById('blufGrid'); g.innerHTML='';
  blufList.forEach((c,pos)=>{
    const b=document.createElement('button'); b.className='bluf';
    b.innerHTML=`<span class="bd">${CARD_DOMS[c.d]}</span><span class="bt">${c.t}</span><span class="bh">${c.p.length} points · open</span>`;
    b.onclick=()=>openBluf(pos); g.appendChild(b);
  });
}
function openBluf(pos){
  blufIdx=pos; const c=blufList[pos];
  document.getElementById('mDom').textContent=CARD_DOMS[c.d];
  document.getElementById('mTitle').textContent=c.t;
  document.getElementById('mPoints').innerHTML=c.p.map(p=>'<li>'+p+'</li>').join('');
  document.getElementById('blufModal').classList.remove('hidden');
}
function stepBluf(n){ openBluf((blufIdx+n+blufList.length)%blufList.length); }
function closeBluf(){ document.getElementById('blufModal').classList.add('hidden'); }

/* ---------- Confidence, timing, flags ---------- */
let LUCKY={}, FLAGS={};
(function loadExtra(){ try{const l=safeStore.get('cism.lucky'); if(l) LUCKY=JSON.parse(l)||{};}catch(e){} try{const f=safeStore.get('cism.flags'); if(f) FLAGS=JSON.parse(f)||{};}catch(e){} })();
function saveExtra(){ safeStore.set('cism.lucky',JSON.stringify(LUCKY)); safeStore.set('cism.flags',JSON.stringify(FLAGS)); }
function setGuess(v){ if(!state) return; state.guess[state.idx]=!!v; persistProgress(); }
function trackTime(){
  if(!state) return; const now=Date.now();
  if(state.lastIdx!==undefined && state.lastIdx!==null) state.times[state.lastIdx]=(state.times[state.lastIdx]||0)+(now-state.lastAt)/1000;
  state.lastIdx=state.idx; state.lastAt=now;
}
function pacing(){
  const per={gov:[],risk:[],prog:[],inc:[]}; let all=[], slow=0;
  state.qs.forEach((q,i)=>{const t=state.times[i]||0; if(t>0){per[q.d].push(t); all.push(t);} if(t>120) slow++;});
  const avg=a=>a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):0;
  return {avg:avg(all),dom:{gov:avg(per.gov),risk:avg(per.risk),prog:avg(per.prog),inc:avg(per.inc)},slow};
}
function toggleFlagAuthor(id,stem){
  if(FLAGS[id]) delete FLAGS[id]; else FLAGS[id]={q:stem,ts:Date.now()};
  saveExtra(); document.querySelectorAll('[data-flagid="'+id+'"]').forEach(b=>{b.textContent=FLAGS[id]?'⚑ Flagged for review':'⚐ Flag this question'; b.classList.toggle('on',!!FLAGS[id]);});
  const c=document.getElementById('flagCount'); if(c) c.textContent=Object.keys(FLAGS).length;
}
function flagBtn(q){ return '<button type="button" class="chip flagbtn'+(FLAGS[q.id]?' on':'')+'" data-flagid="'+q.id+'" onclick="toggleFlagAuthor(\''+q.id+'\',this.getAttribute(\'data-stem\'))" data-stem="'+q.q.replace(/"/g,'&quot;')+'">'+(FLAGS[q.id]?'⚑ Flagged for review':'⚐ Flag this question')+'</button>'; }
function exportFlags(){
  const rows=Object.entries(FLAGS).map(([id,f])=>{const q=BANK.find(x=>x.id===id); return '- '+(q?q.q:f.q)+(q?'\n    credited: '+q.o[q.a]:'')+'\n';});
  if(!rows.length){ alert('No flagged questions yet.'); return; }
  const blob=new Blob(['Flagged questions — '+new Date().toISOString().slice(0,10)+'\n\n'+rows.join('\n')],{type:'text/plain'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='cism-flagged-questions.txt'; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
}
function shakyCount(){ return BANK.filter(q=>WEAK[q.id]||LUCKY[q.id]).length; }

/* ---------- Flashcards with spaced repetition ---------- */
const SR_DAYS=[1,3,7,14,30];
let deck=[], deckIdx=0, SR={};
(function loadSR(){
  try{ const s=safeStore.get('cism.sr'); if(s) SR=JSON.parse(s)||{}; }catch(e){}
  try{ const k=safeStore.get('cism.known'); if(k && !Object.keys(SR).length){ JSON.parse(k).forEach(i=>{SR[i]={b:1,due:Date.now()+86400000};}); saveSR(); } }catch(e){}
})();
function saveSR(){ safeStore.set('cism.sr',JSON.stringify(SR)); }
function cardStage(i){ const s=SR[i]; if(!s) return 'new'; return s.b>=3?'mastered':'learning'; }
function rebuildDeck(){
  const dueOnly=document.getElementById('hideKnown').checked; const now=Date.now();
  deck=CARDS.map((c,i)=>({...c,i})).filter(c=>(cardDom==='all'||c.d===cardDom)&&(!dueOnly||!SR[c.i]||SR[c.i].due<=now));
  deckIdx=0; showCard();
}
function showCard(){
  const empty=document.getElementById('deckEmpty'), fc=document.getElementById('flashCard');
  fc.classList.remove('flipped');
  const scope=CARDS.map((c,i)=>({...c,i})).filter(c=>cardDom==='all'||c.d===cardDom);
  const now=Date.now(); const due=scope.filter(c=>!SR[c.i]||SR[c.i].due<=now).length, mastered=scope.filter(c=>cardStage(c.i)==='mastered').length, learning=scope.filter(c=>cardStage(c.i)==='learning').length;
  document.getElementById('deckKnown').textContent=due+' due · '+learning+' learning · '+mastered+' mastered';
  if(!deck.length){ empty.classList.remove('hidden'); fc.classList.add('hidden'); document.getElementById('deckPos').textContent='0 / 0'; document.getElementById('deckDom').textContent=''; return; }
  empty.classList.add('hidden'); fc.classList.remove('hidden');
  const c=deck[deckIdx];
  document.getElementById('fType').textContent = c.k==='tf' ? 'True or false?' : 'Short answer';
  document.getElementById('fQ').textContent=c.q;
  const fa=document.getElementById('fA'); fa.textContent=c.a; fa.className='fa'+(c.k==='tf'?(c.a==='True'?' tf-true':' tf-false'):'');
  document.getElementById('fW').textContent=c.w||'';
  document.getElementById('deckPos').textContent=(deckIdx+1)+' / '+deck.length;
  const s=SR[c.i]; document.getElementById('deckDom').textContent=CARD_DOMS[c.d]+' · '+(s?('box '+s.b+(s.due>now?' · next '+new Date(s.due).toLocaleDateString():' · due')):'new');
}
function flipCard(){ document.getElementById('flashCard').classList.toggle('flipped'); }
function deckStep(n){ if(!deck.length) return; deckIdx=(deckIdx+n+deck.length)%deck.length; showCard(); }
function markCard(got){
  if(!deck.length) return;
  const c=deck[deckIdx]; const s=SR[c.i]||{b:0,due:0};
  if(got){ s.b=Math.min(s.b+1,SR_DAYS.length-1); s.due=Date.now()+SR_DAYS[s.b]*86400000; }
  else { s.b=0; s.due=Date.now(); }
  SR[c.i]=s; saveSR();
  if(document.getElementById('hideKnown').checked && got){ deck.splice(deckIdx,1); if(deckIdx>=deck.length) deckIdx=0; showCard(); }
  else deckStep(1);
}
function shuffleDeck(){ deck=shuffle(deck); deckIdx=0; showCard(); }
function resetKnown(){ if(confirm('Clear all flashcard progress?')){ SR={}; saveSR(); rebuildDeck(); } }

/* keyboard for cards */
document.addEventListener('keydown',e=>{
  if(!document.getElementById('blufModal').classList.contains('hidden')){
    if(e.key==='Escape') closeBluf(); if(e.key==='ArrowRight') stepBluf(1); if(e.key==='ArrowLeft') stepBluf(-1); return;
  }
  if(document.getElementById('cardsScreen').classList.contains('hidden') || cardMode!=='flash') return;
  if(e.key===' '){ e.preventDefault(); flipCard(); }
  if(e.key==='ArrowRight') deckStep(1);
  if(e.key==='ArrowLeft') deckStep(-1);
  if(e.key.toLowerCase()==='g') markCard(true);
  if(e.key.toLowerCase()==='a') markCard(false);
});

/* ---------- Progress: ids, autosave, history, weak set ---------- */
function hashId(s){let h=5381;for(let i=0;i<s.length;i++){h=((h<<5)+h+s.charCodeAt(i))|0;}return 'q'+(h>>>0).toString(36);}
BANK.forEach(q=>{q.id=hashId(q.q);});
safeStore.del=function(k){try{localStorage.removeItem(k);}catch(e){} delete this.mem[k];};

let HISTORY=[], WEAK={};
(function loadProgress(){
  try{const h=safeStore.get('cism.history'); if(h) HISTORY=JSON.parse(h)||[];}catch(e){HISTORY=[];}
  try{const w=safeStore.get('cism.weak'); if(w) WEAK=JSON.parse(w)||{};}catch(e){WEAK={};}
})();
function saveProgress(){ safeStore.set('cism.history',JSON.stringify(HISTORY)); safeStore.set('cism.weak',JSON.stringify(WEAK)); }
function setLabel(set,drill){
  if(set==='full') return 'Full simulation';
  if(set==='quick') return 'Quick 20';
  if(set==='missed') return 'Retry missed & guessed';
  if(set==='drill') return 'Drill: '+(DOMAINS[drill]?DOMAINS[drill].short:drill);
  return 'Mock '+set;
}
function fmtTime(s){const m=Math.floor(s/60),x=s%60;return m+':'+String(x).padStart(2,'0');}
function fmtDate(ts){const d=new Date(ts);return d.toLocaleDateString(undefined,{month:'short',day:'numeric'})+' '+d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});}

/* autosave */
function persistProgress(){
  if(!state||state.finished) return;
  try{
    safeStore.set('cism.inprogress',JSON.stringify({qs:state.qs,idx:state.idx,answers:state.answers,flags:state.flags,mode:state.mode,
      timeLeft:state.timeLeft,elapsed:Date.now()-state.startedAt,guess:state.guess,times:state.times,set:state.set,drill:state.drill,saved:Date.now()}));
  }catch(e){}
}
function renderResumeBanner(){
  const b=document.getElementById('resumeBanner'); const raw=safeStore.get('cism.inprogress');
  if(!raw){b.classList.add('hidden');return;}
  try{
    const s=JSON.parse(raw); const answered=s.answers.filter(a=>a!==null).length;
    document.getElementById('resumeTitle').textContent='Resume '+setLabel(s.set,s.drill);
    document.getElementById('resumeSub').textContent=answered+' of '+s.qs.length+' answered'+(s.mode==='exam'?' · '+fmtTime(s.timeLeft)+' left':' · practice mode')+' · saved '+fmtDate(s.saved);
    b.classList.remove('hidden');
  }catch(e){ b.classList.add('hidden'); }
}
function resumeExam(){
  const raw=safeStore.get('cism.inprogress'); if(!raw) return;
  let s; try{s=JSON.parse(raw);}catch(e){return;}
  state={qs:s.qs,idx:Math.min(s.idx,s.qs.length-1),answers:s.answers,flags:s.flags,mode:s.mode,finished:false,
    timeLeft:s.mode==='exam'?Math.max(1,s.timeLeft):null,timer:null,guess:s.guess||[],times:s.times||[],lastIdx:null,lastAt:Date.now(),startedAt:Date.now()-(s.elapsed||0),set:s.set,drill:s.drill};
  SCREENS.forEach(id=>document.getElementById(id).classList.add('hidden'));
  document.getElementById('examScreen').classList.remove('hidden');
  document.getElementById('actionbar').classList.remove('hidden');
  document.getElementById('barMeta').classList.remove('hidden');
  document.getElementById('mainNav').classList.add('hidden');
  const t=document.getElementById('timer');
  if(state.mode==='exam'){ t.classList.remove('hidden'); startTimer(); } else { t.classList.add('hidden'); }
  renderQuestion(); window.scrollTo(0,0);
}
function discardProgress(){ if(confirm('Discard the saved exam in progress?')){ safeStore.del('cism.inprogress'); renderResumeBanner(); } }

/* record a finished attempt */
function recordAttempt(auto){
  const missed=[], lucky=[];
  state.qs.forEach((q,i)=>{
    const correct=state.answers[i]===q.a, guessed=!!(state.guess&&state.guess[i]);
    if(!correct){ missed.push(q.id); WEAK[q.id]=(WEAK[q.id]||0)+1; }
    else if(guessed){ lucky.push(q.id); LUCKY[q.id]=(LUCKY[q.id]||0)+1; }
    else { if(WEAK[q.id]) delete WEAK[q.id]; if(LUCKY[q.id]) delete LUCKY[q.id]; }
  });
  const pace=pacing(); state.pace=pace; state.luckyN=lucky.length; saveExtra();
  HISTORY.push({ts:Date.now(),set:state.set,drill:state.drill,label:setLabel(state.set,state.drill),mode:state.mode,n:state.qs.length,
    correct:state.correct,pct:Math.round(state.correct/state.qs.length*100),dom:state.dom,missed,lucky,pace,elapsed:state.elapsed,expired:!!auto,v:APP_VERSION});
  if(HISTORY.length>300) HISTORY=HISTORY.slice(-300);
  saveProgress(); safeStore.del('cism.inprogress'); updateMissedCount();
}
function missedCount(){ return shakyCount(); }
function updateMissedCount(){
  const n=missedCount();
  document.querySelectorAll('[data-missedcount]').forEach(el=>el.textContent=n);
  const btn=document.getElementById('setMissed'); if(btn){ btn.disabled = n===0; if(n===0 && cfg.set==='missed'){ cfg.set='full'; document.querySelectorAll('[data-set]').forEach(b=>b.classList.toggle('on',b.getAttribute('data-set')==='full')); } }
  const fc=document.getElementById('flagCount'); if(fc) fc.textContent=Object.keys(FLAGS).length;
  const mb=document.getElementById('missedBtn'); if(mb){ mb.textContent='Retry missed & guessed ('+n+')'; mb.disabled = n===0; }
}
function startMissedDrill(){ if(!missedCount()) return; cfg.set='missed'; cfg.mode='practice'; document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.getAttribute('data-mode')==='practice')); document.querySelectorAll('[data-set]').forEach(b=>b.classList.toggle('on',b.getAttribute('data-set')==='missed')); goTo('exam'); startExam(); }

/* history screen */
let histMetric='all';
function renderHistory(){
  const mbox=document.getElementById('histMetric'); mbox.innerHTML='';
  [['all','Overall'],['gov','Gov'],['risk','Risk'],['prog','Program'],['inc','Incident']].forEach(([k,l])=>{
    const b=document.createElement('button'); b.className='chip'+(histMetric===k?' on':''); b.textContent=l; b.onclick=()=>{histMetric=k;renderHistory();}; mbox.appendChild(b);
  });
  const val=h=>histMetric==='all'?h.pct:(h.dom&&h.dom[histMetric]&&h.dom[histMetric].t?Math.round(h.dom[histMetric].c/h.dom[histMetric].t*100):null);
  const sum=document.getElementById('histSummary'), chart=document.getElementById('histChart'), list=document.getElementById('histList');
  if(!HISTORY.length){
    sum.innerHTML=''; chart.innerHTML='<div class="hist-empty">No attempts yet. Finish any mock, drill, or simulation and it will appear here.</div>'; list.innerHTML=''; updateMissedCount(); return;
  }
  const sims=HISTORY.filter(h=>h.set==='full'); const best=sims.length?Math.max(...sims.map(h=>h.pct)):null;
  const latest=HISTORY[HISTORY.length-1];
  sum.innerHTML=`<div class="fact"><b>${HISTORY.length}</b><span>Attempts</span></div>
    <div class="fact"><b>${latest.pct}%</b><span>Latest</span></div>
    <div class="fact"><b>${best===null?'—':best+'%'}</b><span>Best full sim</span></div>`;
  // chart
  const pts=HISTORY.map(h=>val(h)); const W=600,H=170,L=34,R=10,T=12,B=26;
  const n=pts.length; const x=i=>n===1?W/2:L+(W-L-R)*i/(n-1); const y=v=>T+(H-T-B)*(1-v/100);
  let svg=`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Score trend">`;
  [0,25,50,75,100].forEach(g=>{svg+=`<line x1="${L}" x2="${W-R}" y1="${y(g)}" y2="${y(g)}" stroke="currentColor" stroke-opacity=".12"/><text x="${L-6}" y="${y(g)+4}" font-size="10" text-anchor="end" fill="currentColor" fill-opacity=".55">${g}</text>`;});
  svg+=`<line x1="${L}" x2="${W-R}" y1="${y(70)}" y2="${y(70)}" stroke="#15803d" stroke-dasharray="4 4" stroke-opacity=".7"/><text x="${W-R}" y="${y(70)-4}" font-size="10" text-anchor="end" fill="#15803d">target 70%</text>`;
  const poly=pts.map((v,i)=>v===null?null:`${x(i)},${y(v)}`).filter(Boolean).join(' ');
  if(poly) svg+=`<polyline points="${poly}" fill="none" stroke="#1d4ed8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
  pts.forEach((v,i)=>{ if(v===null) return; const h=HISTORY[i]; svg+=`<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="${h.mode==='exam'?'#1d4ed8':'#f59e0b'}" stroke="white" stroke-width="1.5"><title>${h.label} · ${h.mode} · ${v}%</title></circle>`; });
  svg+='</svg>';
  chart.innerHTML=svg+`<div class="cap"><span>${fmtDate(HISTORY[0].ts)}</span><span>● exam mode &nbsp; ● practice mode</span><span>${fmtDate(latest.ts)}</span></div>`;
  chart.querySelector('.cap span:nth-child(2)').innerHTML='<span style="color:#1d4ed8">●</span> exam &nbsp; <span style="color:#f59e0b">●</span> practice';
  // list
  list.innerHTML='';
  HISTORY.slice().reverse().forEach(h=>{
    const band=h.pct>=70?'g':(h.pct>=60?'m':'l');
    const mini=['gov','risk','prog','inc'].map(d=>{const dd=h.dom&&h.dom[d];const p=dd&&dd.t?Math.round(dd.c/dd.t*100):0;return `<i title="${DOMAINS[d].short} ${p}%"><b style="width:${p}%"></b></i>`;}).join('');
    const row=document.createElement('div'); row.className='hist-row';
    row.innerHTML=`<div><div>${h.label} · ${h.mode==='exam'?'Exam':'Practice'}${h.expired?' · time expired':''}</div><span class="hl">${fmtDate(h.ts)} · ${h.correct}/${h.n} · missed ${h.missed?h.missed.length:0} · guessed-right ${h.lucky?h.lucky.length:0}${h.pace?' · '+h.pace.avg+'s/q':''}</span><div class="mini">${mini}</div></div><div class="hp ${band}">${h.pct}%</div>`;
    list.appendChild(row);
  });
  updateMissedCount();
}
function exportProgress(){
  const payload={app:'cism-practice',version:APP_VERSION,exported:new Date().toISOString(),history:HISTORY,weak:WEAK,lucky:LUCKY,flags:FLAGS,sr:SR,theme:document.documentElement.getAttribute('data-theme')};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='cism-progress-'+new Date().toISOString().slice(0,10)+'.json'; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},500);
}
function importProgress(input){
  const f=input.files&&input.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{
      const p=JSON.parse(rd.result); if(p.app!=='cism-practice') throw new Error('not a progress file');
      const seen=new Set(HISTORY.map(h=>h.ts)); let added=0;
      (p.history||[]).forEach(h=>{ if(!seen.has(h.ts)){HISTORY.push(h);added++;} });
      HISTORY.sort((a,b)=>a.ts-b.ts);
      Object.entries(p.weak||{}).forEach(([k,v])=>{WEAK[k]=Math.max(WEAK[k]||0,v);});
      Object.entries(p.lucky||{}).forEach(([k,v])=>{LUCKY[k]=Math.max(LUCKY[k]||0,v);});
      Object.assign(FLAGS,p.flags||{});
      Object.entries(p.sr||{}).forEach(([k,v])=>{ if(!SR[k]||v.b>SR[k].b) SR[k]=v; });
      (p.known||[]).forEach(i=>{ if(!SR[i]) SR[i]={b:1,due:Date.now()}; });
      saveSR(); saveExtra(); saveProgress(); renderHistory(); alert('Imported: '+added+' new attempts merged.');
    }catch(e){ alert('Could not import that file.'); }
    input.value='';
  };
  rd.readAsText(f);
}
function clearHistory(){ if(confirm('Delete all saved attempts and the retry list? Flashcard progress and flags are kept.')){ HISTORY=[]; WEAK={}; LUCKY={}; saveProgress(); saveExtra(); renderHistory(); } }

/* ---------- Per-option rationales ---------- */
function rationaleHtml(q){
  if(!q.r) return '';
  return '<div class="rat">'+q.o.map((o,i)=>'<div class="rl'+(i===q.a?' ok':'')+'"><b>'+String.fromCharCode(65+i)+'</b><span>'+q.r[i]+'</span></div>').join('')+'</div>';
}

/* ---------- Version ---------- */
const APP_VERSION="8.0", APP_BUILD="2026-09-09";
function initVersion(){
  const pages=document.querySelectorAll('.lesson-page').length;
  document.getElementById('verNum').textContent=APP_VERSION;
  document.getElementById('verDate').textContent=APP_BUILD;
  document.getElementById('verStats').textContent=BANK.length+' questions · '+pages+' lessons';
  document.getElementById('verBadge').textContent='v'+APP_VERSION;
  const sets=buildSets();
  document.querySelectorAll('[data-mocksize]').forEach(el=>el.textContent=sets.A.length);
  document.querySelectorAll('[data-banksize]').forEach(el=>el.textContent=BANK.length);
  document.querySelectorAll('[data-drillcount]').forEach(el=>{el.textContent=BANK.filter(q=>q.d===el.getAttribute('data-drillcount')).length;});
  renderResumeBanner(); updateMissedCount();
}
function toggleChangelog(){document.getElementById('changelog').classList.toggle('hidden');}
initVersion();

/* ---------- Keyboard shortcuts ---------- */
document.addEventListener('keydown',e=>{
  if(!state || state.finished) return;
  if(document.querySelector('.navpanel')){ if(e.key==='Escape') closeNav(); return; }
  if(['1','2','3','4'].includes(e.key)){ const i=+e.key-1; if(i<state.qs[state.idx].o.length) choose(i); }
  if(['a','b','c','d'].includes(e.key.toLowerCase())){ const i=e.key.toLowerCase().charCodeAt(0)-97; if(i<state.qs[state.idx].o.length) choose(i); }
  if(e.key==='ArrowRight') nextQ();
  if(e.key==='ArrowLeft') prevQ();
  if(e.key.toLowerCase()==='f') toggleFlag();
});

/* ---------- Test hook (read-only accessors; used by test.js) ---------- */
window.__cism={get BANK(){return BANK},get BLUF(){return BLUF},get CARDS(){return CARDS},get state(){return state},get cfg(){return cfg},
  get HISTORY(){return HISTORY},get WEAK(){return WEAK},get LUCKY(){return LUCKY},get FLAGS(){return FLAGS},get SR(){return SR},get deck(){return deck}};
