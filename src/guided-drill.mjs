import {emptyProgress,applyEvent} from './drill-state.mjs';
import {reviewDay} from './review-schedule.mjs';

/** Read-only projection: guided attempts stay in their immutable transfer log. */
export function projectGuidedDrill(base,guided,records=[]){
 const result=structuredClone(base||emptyProgress()),known=new Map(records.filter(r=>r.studyQuestion&&!r.archived).map(r=>[r.id,r]));
 const grouped=new Map();
 for(const e of guided?.events||[]){if(e.type!=='attempt'||!known.has(e.payload?.questionId)||typeof e.payload.correct!=='boolean'||!Number.isFinite(new Date(e.occurredAt).getTime()))continue;const list=grouped.get(e.payload.questionId)||new Map();if(!list.has(e.eventId))list.set(e.eventId,{id:e.payload.questionId,eventId:e.eventId,action:'attempt',answer:Array.isArray(e.payload.answer)?e.payload.answer.join(''):e.payload.answer,correct:e.payload.correct,at:e.occurredAt,historicalWrong:!!known.get(e.payload.questionId).studyQuestion?.historicalWrong,origin:'带我复盘'});grouped.set(e.payload.questionId,list);}
 const chronological=(a,b)=>new Date(a.at)-new Date(b.at)||String(a.eventId).localeCompare(String(b.eventId));
 for(const [id,eventMap] of grouped){
  const events=[...eventMap.values()],old=result.items[id],history=old?.history||[],seen=new Set([...history.map(h=>h.eventId),...(old?.guidedProjectionIds||[])]),added=events.filter(e=>!seen.has(e.eventId)).sort(chronological);
  if(!added.length)continue;
  const latestExisting=Math.max(0,...history.map(e=>new Date(e.at).getTime()),new Date(old?.lastAt||0).getTime());
  const appendOnly=added.every(e=>new Date(e.at).getTime()>=latestExisting);
  const all=appendOnly?added:[...history,...added].sort(chronological);
  let replay=appendOnly&&old?{revision:0,items:{[id]:structuredClone(old)}}:emptyProgress();for(const event of all)replay=applyEvent(replay,event);
  const row=replay.items[id];
  row.attempts=(old?.attempts||0)+added.length;row.wrongCount=(old?.wrongCount||0)+added.filter(e=>!e.correct).length;
  if(!appendOnly&&row.lastCorrect){
   // A retained 60-event window must not erase known correct days outside it.
   const latestWrong=[...history,...added].filter(e=>e.action==='attempt'&&e.correct===false).sort(chronological).at(-1),wrongDay=latestWrong?reviewDay(latestWrong.at):'';
   row.correctDays=[...new Set([...(row.correctDays||[]),...(old?.correctDays||[]).filter(day=>!wrongDay||day>=wrongDay)])].sort().slice(-10);
   if(added.every(e=>e.correct))row.streak=Math.max(row.streak,old?.streak||0);
   const due=new Date(reviewDay(row.lastAt)+'T12:00:00+08:00');due.setUTCDate(due.getUTCDate()+[1,3,7,14,30][Math.min(Math.max(row.correctDays.length-1,0),4)]);row.nextReview=reviewDay(due);
  }
  row.isWrong=!!old?.isWrong||!!row.isWrong;row.mastered=!!row.isWrong&&row.streak>=3&&(row.correctDays?.length||0)>=2;row.origin=old?.origin||row.origin||'带我复盘';
  row.guidedProjectionIds=[...new Set([...(old?.guidedProjectionIds||[]),...events.map(e=>e.eventId)])];
  if(old?.errorReason&&!row.errorReason){row.errorReason=old.errorReason;row.reasonAt=old.reasonAt;}
  result.items[id]={...old,...row};
 }
 result.revision=base?.revision||0;return result;
}
