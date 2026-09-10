#!/usr/bin/env node
// Assembles index.html from src/. Run: node build.js
const fs=require('fs'),path=require('path');
const S=path.join(__dirname,'src');
const read=f=>fs.readFileSync(path.join(S,f),'utf8');
const bank=JSON.parse(read('questions.json')), bluf=JSON.parse(read('bluf.json')), cards=JSON.parse(read('flashcards.json'));
// validation
const counts={gov:0,risk:0,prog:0,inc:0}, stems=new Set(); let tells=0;
bank.forEach((q,i)=>{
  if(!counts.hasOwnProperty(q.d)) throw new Error('bad domain at '+i);
  if(!Array.isArray(q.o)||q.o.length!==4||!Array.isArray(q.r)||q.r.length!==4) throw new Error('item '+i+' needs 4 options and 4 rationales');
  if(typeof q.a!=='number'||q.a<0||q.a>3) throw new Error('bad answer index at '+i);
  const k=q.q.toLowerCase().trim(); if(stems.has(k)) throw new Error('duplicate stem: '+q.q); stems.add(k); counts[q.d]++;
  const l=q.o.map(o=>o.length), m=Math.max(...l), oth=l.filter((x,j)=>j!==q.a);
  if(l[q.a]===m && l[q.a]-Math.max(...oth)>=8){ tells++; console.warn('length tell: '+q.q.slice(0,60)); }
});
cards.forEach((c,i)=>{ if(!['qa','tf'].includes(c.k)||(c.k==='tf'&&!['True','False'].includes(c.a))) throw new Error('bad flashcard '+i); });
const ser=bank.map(q=>'{d:'+JSON.stringify(q.d)+',q:'+JSON.stringify(q.q)+',\no:'+JSON.stringify(q.o)+',a:'+q.a+',\ne:'+JSON.stringify(q.e)+',\nr:'+JSON.stringify(q.r)+'}').join(',\n\n');
let app=read('app.js')
  .replace('/*__BANK__*/','const BANK = [\n/* All items original. Every option rationalized. */\n'+ser+'\n];')
  .replace('/*__BLUF__*/','const BLUF='+JSON.stringify(bluf)+';'+String.fromCharCode(10))
  .replace('/*__CARDS__*/','const CARDS='+JSON.stringify(cards)+';'+String.fromCharCode(10));
let out=read('template.html').replace('/*__STYLES__*/',()=>read('styles.css')).replace('//__SCRIPT__\n',()=>app);
fs.writeFileSync(path.join(__dirname,'index.html'),out);
console.log('index.html built: '+bank.length+' questions '+JSON.stringify(counts)+', '+bluf.length+' BLUF cards, '+cards.length+' flashcards'+(tells?' — WARNING '+tells+' length tells':''));
