#!/usr/bin/env node
// Headless browser test for index.html. Run: npm install && npm test
const fs=require('fs'), path=require('path');
const {JSDOM, VirtualConsole}=require('jsdom');
const HTML=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const URL_='https://example.test/cism-practice/';

let passed=0, failed=0;
function check(name, cond, detail){ if(cond){passed++; console.log('  ✓ '+name);} else {failed++; console.log('  ✗ '+name+(detail?' — '+detail:''));} }
function errorsOf(vc){ const errs=[]; vc.on('jsdomError',e=>errs.push(String(e.message||e))); vc.on('error',(...a)=>errs.push(a.join(' '))); return errs; }

function boot(seedStorage){
  const vc=new VirtualConsole(); const errs=errorsOf(vc);
  const dom=new JSDOM(HTML,{url:URL_,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,
    beforeParse(w){
      if(seedStorage) Object.entries(seedStorage).forEach(([k,v])=>w.localStorage.setItem(k,v));
      w.confirm=()=>true; w.alert=()=>{}; w.scrollTo=()=>{};
      w.URL.createObjectURL=b=>{ w.__lastBlob=b; return 'blob:test'; }; w.URL.revokeObjectURL=()=>{};
      const origClick=w.HTMLElement.prototype.click; w.HTMLElement.prototype.click=function(){ if(this.tagName==='A'&&this.download){ w.__download=this.download; return; } return origClick.call(this); };
    }});
  return {dom, w:dom.window, d:dom.window.document, errs};
}
const visible=(d,id)=>!d.getElementById(id).classList.contains('hidden');
const dumpStorage=w=>{const o={}; for(let i=0;i<w.localStorage.length;i++){const k=w.localStorage.key(i); o[k]=w.localStorage.getItem(k);} return o;};

(async()=>{
console.log('\n[1] Boot, data integrity, theme');
let {w,d,errs}=boot();
check('no script errors on load', errs.length===0, errs[0]);
check('bank loaded', w.__cism.BANK.length>300, String(w.__cism.BANK.length));
check('every item has 4 options and 4 rationales', w.__cism.BANK.every(q=>q.o.length===4&&q.r.length===4));
check('every item has a stable id', w.__cism.BANK.every(q=>typeof q.id==='string'&&q.id.length>2));
check('mock sets are equal and disjoint', (()=>{const s=w.buildSets(); const sizes=Object.values(s).map(x=>x.length); const ids=new Set(); let dup=false; Object.values(s).forEach(x=>x.forEach(q=>{if(ids.has(q.id))dup=true; ids.add(q.id);})); return Math.max(...sizes)-Math.min(...sizes)<=1 && !dup;})());
check('mocks avoid near-duplicate concepts', (()=>{const s=w.buildSets(); let clashes=0; Object.values(s).forEach(set=>{for(let i=0;i<set.length;i++)for(let j=i+1;j<set.length;j++) if(set[i].d===set[j].d&&w.similar(set[i],set[j])) clashes++;}); return clashes===0;})());
check('full simulation draws 150 weighted items', w.weightedSample(150).length===150);
check('version badge present', /v\d+\.\d+/.test(d.getElementById('verBadge').textContent));
const t0=d.documentElement.getAttribute('data-theme'); w.toggleTheme();
check('theme toggles and persists', d.documentElement.getAttribute('data-theme')!==t0 && w.localStorage.getItem('cism.theme')!==null);

console.log('\n[2] Start a mock in exam mode, answer, flag, guess, interrupt');
w.goTo('exam');
d.querySelector('[data-set="A"]').click(); check('Mock A selected', w.__cism.cfg.set==='A');
w.startExam();
check('exam screen visible, nav hidden', visible(d,'examScreen') && d.getElementById('mainNav').classList.contains('hidden'));
const n=w.__cism.state.qs.length; check('mock has ~90 questions', n>=85&&n<=95, String(n));
const chosen=[];
for(let i=0;i<8;i++){ const q=w.__cism.state.qs[i]; const pick=(i%3===0)?q.a:(q.a+1)%4; chosen.push(pick===q.a); w.choose(pick); if(i===1) w.setGuess(true); if(i===2) w.toggleFlag(); w.nextQ(); }
check('8 answers recorded', w.__cism.state.answers.filter(a=>a!==null).length===8);
check('guess recorded', w.__cism.state.guess[1]===true);
check('flag recorded', w.__cism.state.flags[2]===true);
check('timing accumulates', w.__cism.state.times.filter(t=>t>0).length>=1);
const saved=w.localStorage.getItem('cism.inprogress'); check('autosave written', !!saved);
const snapshot=JSON.parse(saved); check('autosave holds answers, guess, times, clock', snapshot.answers.filter(a=>a!==null).length===8 && snapshot.guess[1]===true && Array.isArray(snapshot.times) && snapshot.timeLeft>0);
w.clearInterval(w.__cism.state.timer);
const storage1=dumpStorage(w);

console.log('\n[3] Reload and resume');
({w,d,errs}=boot(storage1));
check('no script errors after reload', errs.length===0, errs[0]);
check('resume banner shown', visible(d,'resumeBanner'));
check('banner names the set and progress', /Mock A/.test(d.getElementById('resumeTitle').textContent) && /8 of/.test(d.getElementById('resumeSub').textContent));
w.resumeExam();
check('exam resumed at saved position', visible(d,'examScreen') && w.__cism.state.idx===8 && w.__cism.state.answers.filter(a=>a!==null).length===8);
check('resumed guess/flag intact', w.__cism.state.guess[1]===true && w.__cism.state.flags[2]===true);
// answer the rest quickly, then finish
for(let i=8;i<w.__cism.state.qs.length;i++){ w.__cism.state.idx=i; w.choose(w.__cism.state.qs[i].a); }
w.finish(false);
check('results screen shown', visible(d,'resultsScreen'));
check('score computed', /\d+%/.test(d.getElementById('scorePct').textContent));
check('in-progress cleared after finish', w.localStorage.getItem('cism.inprogress')===null);
check('attempt logged to history', w.__cism.HISTORY.length===1 && w.__cism.HISTORY[0].set==='A');
const wrongCount=chosen.filter(c=>!c).length; check('missed ids recorded', w.__cism.HISTORY[0].missed.length===wrongCount, w.__cism.HISTORY[0].missed.length+' vs '+wrongCount);
check('pacing recorded', w.__cism.HISTORY[0].pace && typeof w.__cism.HISTORY[0].pace.avg==='number');
check('retry set count equals missed+lucky', w.missedCount()===w.__cism.HISTORY[0].missed.length+w.__cism.HISTORY[0].lucky.length);
check('results meta shows pacing and lucky guesses', /s\/question/.test(d.getElementById('metaLine').textContent) && /Lucky guesses/.test(d.getElementById('metaLine').textContent));

console.log('\n[4] Review filters and flag-for-author');
w.showReview('incorrect'); check('review shows incorrect items', d.querySelectorAll('#reviewList .rev-item').length===wrongCount);
w.showReview('guessed'); check('guessed filter works', d.querySelectorAll('#reviewList .rev-item').length===1);
const fb=d.querySelector('#reviewList .flagbtn'); const fid=fb.getAttribute('data-flagid'); fb.click();
check('flag for author saved', !!w.__cism.FLAGS[fid] && JSON.parse(w.localStorage.getItem('cism.flags'))[fid]);

console.log('\n[5] History screen, export, clear, import');
w.goTo('history');
check('history screen renders rows', visible(d,'historyScreen') && d.querySelectorAll('.hist-row').length===1);
check('trend chart drawn', d.querySelector('#histChart svg')!==null);
w.exportProgress(); const blob=w.__lastBlob; check('export produced a JSON download', !!blob && /cism-progress-/.test(w.__download));
const exported=await new Promise(res=>{const r=new w.FileReader(); r.onload=()=>res(r.result); r.readAsText(blob);}); const payload=JSON.parse(exported);
check('export contains history, weak, lucky, flags, sr', payload.history.length===1 && payload.weak && payload.lucky && payload.flags && payload.sr);
w.clearHistory(); check('clear history empties attempts and retry list', w.__cism.HISTORY.length===0 && w.missedCount()===0);
const file=new w.File([exported],'p.json',{type:'application/json'});
await new Promise(res=>{ w.alert=()=>res(); w.importProgress({files:[file],value:''}); });
check('import restores attempts', w.__cism.HISTORY.length===1);
check('import restores retry list', w.missedCount()>0);

console.log('\n[6] Retry set, practice mode with rationales');
w.startMissedDrill();
check('retry drill started in practice mode', visible(d,'examScreen') && w.__cism.state.mode==='practice' && w.__cism.state.set==='missed');
w.choose(w.__cism.state.qs[0].a);
check('practice mode reveals rationales for all four options', d.querySelectorAll('#explain .rl').length===4);
check('practice explanation offers flag button', d.querySelector('#explain .flagbtn')!==null);
w.finish(false);
check('second attempt logged', w.__cism.HISTORY.length===2);

console.log('\n[7] Cards: BLUF modal and spaced-repetition flashcards');
w.goTo('cards');
check('BLUF grid renders', d.querySelectorAll('#blufGrid .bluf').length===w.__cism.BLUF.length);
d.querySelector('#blufGrid .bluf').click(); check('BLUF modal opens with points', visible(d,'blufModal') && d.querySelectorAll('#mPoints li').length>=2);
w.stepBluf(1); w.closeBluf(); check('BLUF modal closes', !visible(d,'blufModal'));
w.setCardMode('flash');
const total=w.__cism.deck.length; check('flash deck built (due-only default)', total>0);
const firstId=w.__cism.deck[0].i; w.flipCard(); check('card flips', d.getElementById('flashCard').classList.contains('flipped'));
w.markCard(true); check('got-it schedules the card (box 1, due tomorrow)', w.__cism.SR[firstId] && w.__cism.SR[firstId].b===1 && w.__cism.SR[firstId].due>Date.now());
check('got-it removes card from due deck', w.__cism.deck.length===total-1);
check('SR persisted', !!w.localStorage.getItem('cism.sr'));
const secondId=w.__cism.deck[0].i; w.markCard(false); check('again resets to box 0, due now', w.__cism.SR[secondId].b===0 && w.__cism.SR[secondId].due<=Date.now());
w.goTo('lessons'); check('lessons screen shows', visible(d,'lessonsScreen')); w.showLesson(6); check('lesson 6 selectable', d.getElementById('lesson-6').classList.contains('on'));
check('no script errors during flows', errs.length===0, errs[0]);

console.log('\n[8] v8.1: start bar, tab bar, save & exit, review collapse, practice marks, lesson footer');
w.restart(); w.goTo('exam');
check('start bar visible on exam setup', visible(d,'startBar'));
d.querySelector('[data-set="full"]').click();
check('start summary reflects selection', /Full simulation/.test(d.getElementById('startSumSet').textContent));
d.querySelector('[data-set="B"]').click(); check('mock chip updates summary', /Mock B/.test(d.getElementById('startSumSet').textContent));
d.querySelector('[data-mode="practice"]').click(); check('mode updates summary', /Practice/.test(d.getElementById('startSumMode').textContent));
w.startExam();
check('during exam: start bar, tab bar, nav hidden; exit visible', !visible(d,'startBar') && d.getElementById('tabBar').classList.contains('hidden') && d.getElementById('mainNav').classList.contains('hidden') && visible(d,'exitBtn'));
w.choose(w.__cism.state.qs[0].a);
check('practice mode shows ✓ mark on correct option', d.querySelector('#options .option.correct .mark')!==null);
w.nextQ(); w.choose((w.__cism.state.qs[1].a+1)%4);
check('practice mode shows ✗ on wrong pick', d.querySelector('#options .option.incorrect .mark')!==null);
w.exitExam();
check('save & exit returns to start with progress kept', visible(d,'startScreen') && w.__cism.state===null && !!w.localStorage.getItem('cism.inprogress') && visible(d,'resumeBanner'));
check('after exit: tab bar and start bar back, exit hidden', !d.getElementById('tabBar').classList.contains('hidden') && visible(d,'startBar') && !visible(d,'exitBtn'));
w.resumeExam(); check('resume after exit restores 2 answers', w.__cism.state.answers.filter(a=>a!==null).length===2);
for(let i=2;i<w.__cism.state.qs.length;i++){ w.__cism.state.idx=i; w.choose(w.__cism.state.qs[i].a); }
w.finish(false); w.showReview('all');
const items=[...d.querySelectorAll('#reviewList .rev-item')];
check('review collapses correct items by default', items.some(x=>x.classList.contains('collapsed')) && items.filter(x=>!x.classList.contains('collapsed')).length>=1);
items.find(x=>x.classList.contains('collapsed')).querySelector('.rq').click();
check('tapping a collapsed stem expands it', items.some(x=>!x.classList.contains('collapsed')&&x.querySelector('.rq')));
w.goTo('lessons'); w.showLesson(0); check('lesson footer: prev disabled on first', d.getElementById('lfPrev').disabled===true);
w.stepLesson(1); check('lesson footer: next moves to lesson 1', d.getElementById('lesson-1').classList.contains('on'));
w.showLesson(6); check('lesson footer: next disabled on last', d.getElementById('lfNext').disabled===true);
w.goTo('history'); check('history show-all hidden under 20 attempts', d.getElementById('histMore').classList.contains('hidden'));
check('tab bar highlights current section', d.querySelector('#tabBar [data-nav="history"]').classList.contains('on'));
check('no script errors in v8.1 flows', errs.length===0, errs[0]);

console.log('\n'+passed+' passed, '+failed+' failed');
process.exit(failed?1:0);
})().catch(e=>{ console.error('TEST CRASH', e); process.exit(2); });
