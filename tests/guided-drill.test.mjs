import test from 'node:test';import assert from 'node:assert/strict';
import {emptyProgress,applyEvent} from '../src/drill-state.mjs';
import {projectGuidedDrill} from '../src/guided-drill.mjs';
const records=[{id:'q1',studyQuestion:{}}];
const guide={events:[{eventId:'g1',type:'attempt',occurredAt:'2026-10-10T01:00:00Z',payload:{questionId:'q1',answer:['B'],correct:false}}]};
test('phone exported wrong attempt appears once in the shared wrong set without changing base or revision',()=>{const raw=emptyProgress();const a=projectGuidedDrill(raw,guide,records),b=projectGuidedDrill(raw,guide,records);assert.equal(a.items.q1.isWrong,true);assert.equal(a.items.q1.attempts,1);assert.equal(a.revision,raw.revision);assert.deepEqual(a,b);assert.deepEqual(raw,emptyProgress());assert.deepEqual(projectGuidedDrill(a,guide,records),a);});
test('older imported mistakes do not replace newer answers; retained totals survive history truncation',()=>{let raw=emptyProgress();for(let i=0;i<75;i++)raw=applyEvent(raw,{id:'q1',action:'attempt',eventId:'raw'+i,at:`2026-10-${i<30?'11':'12'}T01:${String(i%60).padStart(2,'0')}:00Z`,answer:'A',correct:true});const projected=projectGuidedDrill(raw,guide,records);assert.equal(projected.items.q1.attempts,76);assert.equal(projected.items.q1.wrongCount,1);assert.equal(projected.items.q1.lastAnswer,'A');assert.equal(projected.items.q1.lastCorrect,true);assert.equal(projected.items.q1.mastered,true);assert.equal(raw.items.q1.attempts,75);});
test('unknown question and non-attempt events do not leak into drill statistics',()=>{const p=projectGuidedDrill(emptyProgress(),{events:[{...guide.events[0],payload:{...guide.events[0].payload,questionId:'missing'}},{...guide.events[0],type:'note'}]},records);assert.deepEqual(p,emptyProgress());});

test('newer guided attempts preserve cumulative streak and prior correct days outside the retained history',()=>{
 let raw=emptyProgress();for(let i=0;i<75;i++)raw=applyEvent(raw,{id:'q1',action:'attempt',eventId:'r'+i,at:i<15?'2026-10-11T01:00:00Z':'2026-10-12T01:00:00Z',answer:'A',correct:true,historicalWrong:true});
 assert.equal(raw.items.q1.history.length,60);assert.equal(raw.items.q1.streak,75);assert.equal(raw.items.q1.correctDays.length,2);
 const next={events:[{...guide.events[0],eventId:'new',occurredAt:'2026-10-12T02:00:00Z',payload:{...guide.events[0].payload,answer:['A'],correct:true}}]};
 const p=projectGuidedDrill(raw,next,records);assert.equal(p.items.q1.streak,76);assert.equal(p.items.q1.correctDays.length,2);assert.equal(p.items.q1.mastered,true);assert.equal(p.items.q1.nextReview,'2026-10-15');
});

test('projection remains idempotent after old guided event falls outside sixty-event history',()=>{
 let raw=emptyProgress();for(let i=0;i<75;i++)raw=applyEvent(raw,{id:'q1',action:'attempt',eventId:'r'+i,at:'2026-10-12T01:00:00Z',answer:'A',correct:true});
 const first=projectGuidedDrill(raw,guide,records);assert.equal(first.items.q1.history.some(e=>e.eventId==='g1'),false);
 const repeated=projectGuidedDrill(first,guide,records);assert.deepEqual(repeated,first);assert.equal(repeated.items.q1.attempts,76);
});

test('timestamps with explicit offsets are ordered by instant and duplicate guide IDs count once',()=>{
 const raw=applyEvent(emptyProgress(),{id:'q1',action:'attempt',eventId:'r1',at:'2026-10-15T01:00:00Z',answer:'A',correct:true});
 const older={...guide.events[0],occurredAt:'2026-10-15T08:30:00+08:00'};
 const p=projectGuidedDrill(raw,{events:[older,older]},records);assert.equal(p.items.q1.lastAnswer,'A');assert.equal(p.items.q1.lastCorrect,true);assert.equal(p.items.q1.attempts,2);assert.equal(p.items.q1.wrongCount,1);
});
