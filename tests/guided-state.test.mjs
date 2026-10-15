import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyGuidedState,mergeGuidedState,summarizeGuided,selectGuidedQueue,createTransferBundle,validateGuidedEvent,validateGuidedDraft} from '../src/guided-state.mjs';

const event=(id,type='complete',payload={rating:'掌握',independentRecall:true},at='2026-10-15T02:00:00Z',knowledgeId='police-duty')=>({eventId:id,deviceId:'phone-1',knowledgeId,occurredAt:at,type,payload});
const bundle=events=>({schemaVersion:1,events});
const add=(state,...events)=>mergeGuidedState(state,bundle(events),['police-duty','supervision','continue-time']).state;

test('导学记录按事件 ID 幂等，跨设备内容冲突保留双方，不重复计分',()=>{
 const original=event('one'),first=add(emptyGuidedState(),original);
 const duplicate=mergeGuidedState(first,bundle([original]),['police-duty']);
 assert.deepEqual(duplicate.state,first);assert.equal(duplicate.summary.duplicates,1);
 const changed={...original,payload:{rating:'忘记',independentRecall:false}};
 const conflict=mergeGuidedState(first,bundle([changed]),['police-duty']);
 assert.equal(conflict.state.events.length,1);assert.equal(conflict.state.conflicts.length,1);
 assert.equal(conflict.state.conflicts[0].existing.payload.rating,'掌握');assert.equal(conflict.state.conflicts[0].incoming.payload.rating,'忘记');
 assert.equal(summarizeGuided(conflict.state)['police-duty'].completionCount,1);
 assert.deepEqual(mergeGuidedState(conflict.state,bundle([changed]),['police-duty']).state,conflict.state);
});

test('不同设备的笔记和草稿均保留，未知知识点暂存后可重新匹配',()=>{
 const draft={draftId:'draft-1',deviceId:'phone-1',knowledgeId:'future-unit',updatedAt:'2026-10-15T02:00:00Z',values:{keyDifference:'保留我的原话'}};
 const incoming={schemaVersion:1,events:[event('one','note',{keyDifference:'手机上的理解'}),{...event('two','note',{keyDifference:'电脑上的理解'}),deviceId:'desktop-1'},event('unknown','note',{restatement:'尚未匹配'},undefined,'future-unit')],drafts:[draft]};
 const merged=mergeGuidedState(emptyGuidedState(),incoming,['police-duty']);
 assert.equal(merged.state.events.length,2);assert.equal(merged.state.quarantine.length,2);assert.equal(merged.summary.quarantined,2);
 const transfer=createTransferBundle(merged.state,'desktop-1','2026-10-15T03:00:00Z');
 const promoted=mergeGuidedState(emptyGuidedState(),transfer,['police-duty','future-unit']);
 assert.equal(promoted.state.events.length,3);assert.equal(promoted.state.drafts[0].values.keyDifference,'保留我的原话');assert.equal(promoted.state.quarantine.length,0);
 const localPromotion=mergeGuidedState(merged.state,bundle([]),['police-duty','future-unit']);
 assert.equal(localPromotion.summary.promoted,2);assert.equal(localPromotion.state.events.length,3);
});

test('只升级跨日独立回忆；提示后或忘记次日复习，采用北京时间日期',()=>{
 let state=add(emptyGuidedState(),event('one'),event('two',undefined,undefined,'2026-10-15T06:00:00Z'));
 let progress=summarizeGuided(state)['police-duty'];assert.equal(progress.reviewStage,1);assert.equal(progress.nextReview,'2026-10-16');assert.equal(progress.independentRecallDays.length,1);
 state=add(state,event('three',undefined,undefined,'2026-10-15T16:01:00Z'));
 progress=summarizeGuided(state)['police-duty'];assert.equal(progress.reviewStage,2);assert.equal(progress.nextReview,'2026-10-19');
 state=add(state,event('four',undefined,{rating:'掌握',independentRecall:false},'2026-10-16T01:00:00Z'));
 progress=summarizeGuided(state)['police-duty'];assert.equal(progress.lastRating,'模糊');assert.equal(progress.nextReview,'2026-10-17');assert.equal(progress.reviewStage,1);
 state=add(state,event('five',undefined,{rating:'忘记',independentRecall:false},'2026-10-16T02:00:00Z'));
 progress=summarizeGuided(state)['police-duty'];assert.equal(progress.reviewStage,0);assert.equal(progress.failedRecallStreak,2);assert.equal(progress.nextReview,'2026-10-17');
});

test('练习成功不会自动设置掌握；原题与变式统计分开，确认错因有样本量',()=>{
 const state=add(emptyGuidedState(),event('q1','attempt',{questionId:'question-one',answer:['A'],correct:true,variant:false}),event('q2','attempt',{questionId:'variant-one',answer:['B'],correct:false,variant:true}),event('finish','complete',{rating:'模糊',independentRecall:false,reason:'concept'}));
 const p=summarizeGuided(state)['police-duty'];assert.equal(p.attempts,2);assert.equal(p.correctAttempts,1);assert.equal(p.variantAttempts,1);assert.equal(p.variantCorrect,0);assert.equal(p.independentRecallCount,0);assert.equal(p.reasonCounts.concept,1);assert.equal('mastered'in p,false);
});

test('每日队列首日履职和监督、随后盘问；到期最多三项，积压减少新学',()=>{
 const lessons=['civil-capacity','supervision','police-duty','continue-time','fine'].map(id=>({id}));
 assert.deepEqual(selectGuidedQueue(lessons,emptyGuidedState(),'2026-10-15').learn.map(l=>l.id),['police-duty','supervision']);
 let state=add(emptyGuidedState(),event('one'),event('two',undefined,undefined,undefined,'supervision'));
 assert.equal(selectGuidedQueue(lessons,state,'2026-10-15').learn[0].id,'continue-time');
 state=add(state,event('three',undefined,undefined,undefined,'continue-time'));
 const queue=selectGuidedQueue(lessons,state,'2026-10-17');assert.equal(queue.due.length,3);assert.equal(queue.learn.length,1);
});

test('拒绝未知版本、无效评价、缺失判分、凭证字段和原型污染',()=>{
 assert.throws(()=>mergeGuidedState(emptyGuidedState(),{schemaVersion:2,events:[]},[]),/版本/);
 assert.throws(()=>validateGuidedEvent(event('bad','complete',{rating:'自信',independentRecall:true})),/评价/);
 assert.throws(()=>validateGuidedEvent(event('bad','attempt',{questionId:'question',answer:['A']})),/判分/);
 assert.throws(()=>validateGuidedEvent(event('bad','note',{apiKey:'not-allowed'})),/凭证/);
 assert.throws(()=>validateGuidedEvent(event('bad','note',JSON.parse('{"__proto__":{"polluted":true}}'))),/凭证/);
 assert.throws(()=>validateGuidedEvent({...event('bad'),occurredAt:'not-a-date'}),/格式/);
 assert.throws(()=>validateGuidedEvent(event('bad','note',{reason:'constructor'})),/错因/);
 const draft={draftId:'draft-one',deviceId:'phone-one',knowledgeId:'police-duty',updatedAt:'2026-10-15T02:00:00Z',values:{}};
 assert.throws(()=>validateGuidedDraft({...draft,values:{step:6}}),/步骤/);
 assert.throws(()=>validateGuidedDraft({...draft,values:{answers:{q:{answer:null,correct:true}}}}),/答题/);
});

test('公网快照与手机增量合并保留本机笔记和草稿，反向冲突不重复收录',()=>{
 const phoneEvent=event('phone','note',{keyDifference:'手机还未导入的理解'}),shared=event('shared');
 const phone=add(emptyGuidedState(),phoneEvent,shared),desktop=add(emptyGuidedState(),event('desktop','note',{keyDifference:'电脑新记录'}),{...shared,payload:{rating:'忘记',independentRecall:false}});
 const merged=mergeGuidedState(phone,createTransferBundle(desktop,'desktop-1'),['police-duty']);
 assert.equal(merged.state.events.length,3);assert.equal(merged.state.events.find(e=>e.eventId==='phone').payload.keyDifference,'手机还未导入的理解');assert.equal(merged.state.conflicts.length,1);
 const reverse=mergeGuidedState(desktop,createTransferBundle(phone,'phone-1'),['police-duty']);
 const roundtrip=mergeGuidedState(merged.state,createTransferBundle(reverse.state,'desktop-1'),['police-duty']);
 assert.equal(roundtrip.state.conflicts.length,1);assert.equal(roundtrip.state.events.length,3);
 const again=mergeGuidedState(roundtrip.state,createTransferBundle(reverse.state,'desktop-1'),['police-duty']);assert.deepEqual(again.state,roundtrip.state);
});
