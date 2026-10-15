import {reviewDay} from './review-schedule.mjs';
import {summarizeGuided} from './guided-state.mjs';

/** Resume an unfinished device draft; completed sessions supersede older drafts. */
export function chooseGuidedDraft(state,knowledgeId,deviceId,at=new Date()){
 const drafts=[...(state.drafts||[])].filter(d=>d.knowledgeId===knowledgeId).sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
 const byDevice=new Map();for(const draft of drafts)if(!byDevice.has(draft.deviceId))byDevice.set(draft.deviceId,draft);
 const completion=(state.events||[]).filter(e=>e.knowledgeId===knowledgeId&&e.type==='complete').sort((a,b)=>new Date(b.occurredAt)-new Date(a.occurredAt))[0];
 const completedAt=completion?new Date(completion.occurredAt).getTime():0;
 const unfinished=[...byDevice.values()].filter(d=>!d.values.done&&new Date(d.updatedAt).getTime()>completedAt);
 const active=unfinished.find(d=>d.deviceId===deviceId)||unfinished[0];
 if(active)return {values:structuredClone(active.values),draftId:active.draftId,reset:false};
 const nextReview=summarizeGuided(state,at)[knowledgeId]?.nextReview;
 if(nextReview&&nextReview<=reviewDay(at))return {values:{},reset:true};
 const latest=drafts[0];
 return {values:latest?{...structuredClone(latest.values),...(completion?{done:true}:{})}:completion?{done:true}:{},draftId:latest?.draftId,reset:false};
}
