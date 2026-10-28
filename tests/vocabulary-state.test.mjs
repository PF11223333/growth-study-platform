import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyVocabularyWorkspace,makeVocabularyRound,readVocabularyWorkspace,vocabularyProgress,mergeVocabularyWorkspace} from '../src/vocabulary-state.mjs';
const entries=Array.from({length:16},(_,i)=>({id:`word-${i}`,word:`表达${i}项`,label:`表达${i}项（搭配）`,meaning:`definition-${i}-end`,example:`这一工作需要表达${i}项。`,clozeTarget:`表达${i}项`}));
test('word rounds shuffle both question order and answer positions, retain one correct choice',()=>{
 const positions=new Set(),orders=new Set();for(let seed=1;seed<=20;seed++){
  const qs=makeVocabularyRound(entries,{seed,size:10});assert.equal(qs.length,10);assert.equal(new Set(qs.map(q=>q.entryId)).size,10);orders.add(qs.map(q=>q.entryId).join(','));
  for(const q of qs){assert.equal(q.options.length,4);assert.equal(q.options.filter(o=>o.id===q.correctOptionId).length,1);positions.add(q.options.findIndex(o=>o.id===q.correctOptionId));}
 }assert.equal(positions.size,4);assert.ok(orders.size>15);
});
test('cloze practice uses an exact source target and excludes same-word and confusable distractors',()=>{
 const all=[...entries,{...entries[0],id:'duplicate'}, {...entries[1],confusable:['word-0']}];
 const [q]=makeVocabularyRound(all,{mode:'sentence',seed:7,onlyIds:['word-0']});assert.equal(q.prompt,'这一工作需要____。');assert.ok(!q.options.some(o=>['duplicate','word-1'].includes(o.id)));
 const [fallback]=makeVocabularyRound([{...entries[0],example:'这里没有目标表达。'},...entries.slice(1)],{mode:'sentence',onlyIds:['word-0'],seed:8});assert.equal(fallback.mode,'meaning');
});
test('new rounds favor unseen words and return only available items for tiny weak sets',()=>{
 const previous=entries.slice(0,8).map(e=>e.id);const q=makeVocabularyRound(entries,{size:8,seed:2,previousIds:previous});assert.ok(q.every(e=>!previous.includes(e.entryId)));
 assert.equal(makeVocabularyRound(entries,{onlyIds:['word-0'],size:20}).length,1);assert.equal(makeVocabularyRound(entries,{onlyIds:[]}).length,0);
});
const event=(id,at,extra={})=>({id,entryId:'word-0',mode:'meaning',correct:true,hintUsed:false,confidence:'确定',selected:'word-0',at,...extra});
test('same-day repetition does not advance review stage and uncertain or wrong answers return tomorrow',()=>{
 const events=[event('one','2026-10-28T01:00:00Z'),event('two','2026-10-28T02:00:00Z')];let p=vocabularyProgress(events)['word-0'];assert.equal(p.reviewStage,1);assert.equal(p.nextReview,'2026-10-29');assert.equal(p.days.length,1);
 p=vocabularyProgress([...events,event('three','2026-10-29T01:00:00Z')])['word-0'];assert.equal(p.reviewStage,2);assert.equal(p.nextReview,'2026-11-01');
 p=vocabularyProgress([...events,event('three','2026-10-29T01:00:00Z',{hintUsed:true})])['word-0'];assert.equal(p.nextReview,'2026-10-30');assert.equal(p.independent,2);
 p=vocabularyProgress([...events,event('three','2026-10-29T01:00:00Z',{correct:false})])['word-0'];assert.equal(p.reviewStage,0);assert.equal(p.lastCorrect,false);
});
test('refresh restores shuffled options, selection, and answered state; imports deduplicate and keep note variants',()=>{
 const state={...emptyVocabularyWorkspace(),events:[event('one','2026-10-28T01:00:00Z')],session:{id:'round-1',questions:makeVocabularyRound(entries,{seed:4}),index:2,selection:'word-4',hintUsed:true,confidence:'犹豫'},notes:{'word-0':{text:'我的例句',at:'2026-10-28T01:00:00Z'}}};
 assert.deepEqual(readVocabularyWorkspace(JSON.stringify(state)),state);assert.equal(mergeVocabularyWorkspace(state,state).added,0);
 const incoming={...emptyVocabularyWorkspace(),notes:{'word-0':{text:'手机例句',at:'2026-10-28T02:00:00Z'}}};const merged=mergeVocabularyWorkspace(state,incoming);assert.equal(merged.state.notes['word-0'].history.length,2);assert.deepEqual(merged.state.session,state.session);
 assert.throws(()=>mergeVocabularyWorkspace(state,{...state,events:[{...state.events[0],correct:false}]}),/不同内容/);
 assert.throws(()=>readVocabularyWorkspace({...state,session:{...state.session,index:999}}),/训练格式/);
 assert.throws(()=>readVocabularyWorkspace({...state,notes:{'word-0':{text:'A',at:'2026-10-28T01:00:00Z',history:'损坏历史'}}}),/历史格式/);
 const withHistory={...state,notes:{'word-0':{text:'A',at:'2026-10-28T01:00:00Z',history:[{text:'B',at:'2026-10-27T01:00:00Z'}]}}};const newer={...state,notes:{'word-0':{text:'A',at:'2026-10-28T02:00:00Z'}}};assert.equal(mergeVocabularyWorkspace(withHistory,newer).state.notes['word-0'].history[0].text,'B');
});
