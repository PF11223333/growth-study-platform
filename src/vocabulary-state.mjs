import {scheduleReview,reviewDay} from './review-schedule.mjs';

export const VOCABULARY_KEY='growth-vocabulary-v1';
export const normalizeWord=s=>String(s||'').replace(/[\s，。、；：·（）()“”「」【】]/g,'');
export function seededRandom(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export function shuffle(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function overlappingMeaning(a,b){const x=normalizeWord(a),y=normalizeWord(b);if(x===y||x.includes(y)||y.includes(x))return true;const parts=x.match(/[\u3400-\u9fff]{2,}/g)||[];return parts.some(part=>Array.from({length:part.length-1},(_,i)=>part.slice(i,i+2)).some(pair=>y.includes(pair)));}
function distinct(a,b){const x=normalizeWord(a.clozeTarget||a.word),y=normalizeWord(b.clozeTarget||b.word);return a.id!==b.id&&x!==y&&!x.includes(y)&&!y.includes(x)&&!overlappingMeaning(a.meaning,b.meaning)&&(!a.duplicateGroup||a.duplicateGroup!==b.duplicateGroup)&&!(a.confusable||[]).includes(b.id)&&!(b.confusable||[]).includes(a.id);}
export function makeVocabularyRound(entries,{mode='mixed',size=10,seed=Date.now(),previousIds=[],onlyIds}={}){
 const random=seededRandom(seed),allowed=onlyIds?new Set(onlyIds):null;
 const all=entries.filter(e=>e.id&&e.word&&e.meaning),selected=shuffle(all.filter(e=>!allowed||allowed.has(e.id)),random);
 // A new round favors items absent from the previous round, while still allowing a full retry.
 const previous=new Set(previousIds),ordered=[...selected.filter(e=>!previous.has(e.id)),...selected.filter(e=>previous.has(e.id))];
 const questions=[];
 for(const entry of ordered){
  const requested=mode==='mixed'?(random()<.5?'meaning':'sentence'):mode;
  const target=entry.clozeTarget||entry.word;
  const sentence=requested==='sentence'&&entry.clozeEligible!==false&&entry.example?.includes(target)&&target.length>1;
  const kind=sentence?'sentence':'meaning',seen=new Set([normalizeWord(kind==='meaning'?entry.meaning:target)]);
  const alternatives=[];
  const pool=shuffle(all.filter(e=>distinct(entry,e)),random);if(kind==='sentence')pool.sort((a,b)=>Math.abs((a.clozeTarget||a.word).length-target.length)-Math.abs((b.clozeTarget||b.word).length-target.length));
  for(const other of pool){
   const text=kind==='meaning'?other.meaning:(other.clozeTarget||other.word),key=normalizeWord(text);
   if(seen.has(key))continue;seen.add(key);alternatives.push({id:other.id,text});if(alternatives.length===3)break;
  }
  if(alternatives.length<3)continue;
  const text=kind==='meaning'?entry.meaning:target;
  questions.push({id:`${entry.id}:${kind}:${seed}`,entryId:entry.id,mode:kind,prompt:kind==='meaning'?`「${entry.displayLabel||entry.label||entry.word}」结合它的搭配，最符合的含义是什么？`:entry.example.split(target).join('____'),options:shuffle([{id:entry.id,text},...alternatives],random),correctOptionId:entry.id});
  if(questions.length>=Math.max(1,Math.min(50,size)))break;
 }
 return questions;
}
export const emptyVocabularyWorkspace=()=>({schemaVersion:1,events:[],notes:{},session:null});
const validText=(s,max=20000)=>typeof s==='string'&&s.length<=max;
const validId=s=>validText(s,160)&&/^[a-zA-Z0-9][\w.:-]*$/.test(s);
const validAt=s=>validText(s,50)&&Number.isFinite(Date.parse(s));
function validateQuestion(q){return q&&validId(q.id)&&validId(q.entryId)&&['meaning','sentence'].includes(q.mode)&&validText(q.prompt)&&Array.isArray(q.options)&&q.options.length===4&&q.options.every(o=>validId(o.id)&&validText(o.text))&&new Set(q.options.map(o=>o.id)).size===4&&q.correctOptionId===q.entryId&&q.options.some(o=>o.id===q.correctOptionId);}
export function readVocabularyWorkspace(raw){
 if(!raw)return emptyVocabularyWorkspace();const v=typeof raw==='string'?JSON.parse(raw):raw;
 if(!v||v.schemaVersion!==1||!Array.isArray(v.events)||v.events.length>50000||!v.notes||typeof v.notes!=='object'||Array.isArray(v.notes))throw new Error('词语记录格式不正确，请保留原文件。');
 const ids=new Set();for(const e of v.events){if(!validId(e.id)||ids.has(e.id)||!validId(e.entryId)||!validAt(e.at)||!['meaning','sentence'].includes(e.mode)||typeof e.correct!=='boolean'||typeof e.hintUsed!=='boolean'||!['确定','犹豫','猜的'].includes(e.confidence)||!validText(e.selected,160))throw new Error('词语作答记录不完整或重复，未覆盖现有进度。');ids.add(e.id);}
 for(const [id,note] of Object.entries(v.notes)){if(!validId(id)||!note||!validText(note.text,5000)||!validAt(note.at))throw new Error('个人记忆句格式不正确。');if(note.history!==undefined&&(!Array.isArray(note.history)||note.history.length>1000||note.history.some(n=>!n||!validText(n.text,5000)||!validAt(n.at))))throw new Error('个人记忆句的历史格式不正确。');}
 if(v.session){const s=v.session;if(!validId(s.id)||!Array.isArray(s.questions)||!s.questions.length||s.questions.length>50||!s.questions.every(validateQuestion)||!Number.isInteger(s.index)||s.index<0||s.index>s.questions.length||!validText(s.selection,160)||typeof s.hintUsed!=='boolean'||!['确定','犹豫','猜的'].includes(s.confidence))throw new Error('未完成的词语训练格式不正确，请保留备份。');}
 return {schemaVersion:1,events:v.events,notes:v.notes,session:v.session||null};
}
export function vocabularyProgress(events){
 const progress={};
 for(const e of [...events].sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id))){const old=progress[e.entryId]||{attempts:0,correct:0,independent:0,reviewStage:0,lastAt:'',lastCorrect:false,nextReview:'',days:[]};const independent=e.correct&&!e.hintUsed&&e.confidence==='确定';
  const schedule=scheduleReview(!e.correct?'忘记':independent?'掌握':'模糊',old.reviewStage,new Date(e.at),old.lastAt);
  progress[e.entryId]={...old,...schedule,attempts:old.attempts+1,correct:old.correct+Number(e.correct),independent:old.independent+Number(independent),lastAt:e.at,lastCorrect:e.correct,days:[...new Set([...old.days,reviewDay(e.at)])]};
 }return progress;
}
export function mergeVocabularyWorkspace(current,incoming){
 const a=readVocabularyWorkspace(current),b=readVocabularyWorkspace(incoming),events=new Map(a.events.map(e=>[e.id,e])),notes={...a.notes};let added=0;
 for(const e of b.events){const old=events.get(e.id);if(old&&JSON.stringify(old)!==JSON.stringify(e))throw new Error('同一作答记录有不同内容，请保留两份文件，未覆盖已有记录。');if(!old){events.set(e.id,e);added++;}}
 for(const [id,note]of Object.entries(b.notes)){const old=notes[id];if(!old){notes[id]=note;continue;}const history=[...(old.history||[]),...(note.history||[]),...(old.text!==note.text?[{text:old.text,at:old.at},{text:note.text,at:note.at}]:[])];notes[id]={...(old.at>=note.at?old:note),...(history.length?{history:[...new Map(history.map(n=>[n.at+'|'+n.text,n])).values()]}:{})};}
 return {state:{...a,events:[...events.values()].sort((x,y)=>x.at.localeCompare(y.at)||x.id.localeCompare(y.id)),notes},added};
}
