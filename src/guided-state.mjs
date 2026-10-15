import {scheduleReview,reviewDay} from './review-schedule.mjs';

export const GUIDED_SCHEMA_VERSION=1;
export const guidedReasonLabels={concept:'概念没分清',condition:'条件漏看',number:'期限或数字混淆',procedure:'程序顺序',version:'法条版本',reading:'审题',recall:'记不起来'};
const types=new Set(['attempt','recall','complete','note']);
const reasonValues=new Set([...Object.keys(guidedReasonLabels),...Object.values(guidedReasonLabels),'']);
const forbiddenKeys=/^(?:__proto__|prototype|constructor|token|accessToken|apiKey|secret|password|localPath|sourcePath|originalPath|storedPath|base64)$/i;
const clone=value=>JSON.parse(JSON.stringify(value));
const sortJSON=value=>Array.isArray(value)?value.map(sortJSON):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sortJSON(value[key])])):value;
const identity=value=>JSON.stringify(sortJSON(value));
const isObject=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const validId=value=>typeof value==='string'&&value.length>0&&value.length<=180&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]*$/.test(value);
const validAt=value=>typeof value==='string'&&value.length<=40&&/T.*(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(new Date(value).getTime());
function jsonValue(value,depth=0){
 if(depth>12)throw new Error('复盘数据嵌套过深');
 if(value===null||typeof value==='boolean'||typeof value==='string'&&value.length<=100000||typeof value==='number'&&Number.isFinite(value))return;
 if(Array.isArray(value)){if(value.length>10000)throw new Error('复盘数据列表过长');value.forEach(item=>jsonValue(item,depth+1));return;}
 if(isObject(value)){for(const [key,item]of Object.entries(value)){if(forbiddenKeys.test(key))throw new Error('复盘文件包含不允许的凭证或本机路径字段');jsonValue(item,depth+1);}return;}
 throw new Error('复盘数据必须是有效 JSON');
}
export function validateGuidedEvent(event){
 if(!isObject(event)||!validId(event.eventId)||!validId(event.deviceId)||!validId(event.knowledgeId)||!validAt(event.occurredAt)||!types.has(event.type)||!isObject(event.payload))throw new Error('复盘事件格式无效');
 jsonValue(event.payload);
 if(event.payload.reason!==undefined&&!reasonValues.has(event.payload.reason))throw new Error('错因标签无效，请选择已有的错因');
 if(event.type==='attempt'&&(!validId(event.payload.questionId)||typeof event.payload.correct!=='boolean'||typeof event.payload.variant!=='boolean'||!(typeof event.payload.answer==='string'&&event.payload.answer.length>0&&event.payload.answer.length<=100||Array.isArray(event.payload.answer)&&event.payload.answer.length>0&&event.payload.answer.length<=20&&event.payload.answer.every(a=>typeof a==='string'&&a.length>0&&a.length<=20))))throw new Error('练习记录缺少题目、答案或判分');
 if(event.type==='complete'&&(!['掌握','模糊','忘记'].includes(event.payload.rating)||typeof event.payload.independentRecall!=='boolean'))throw new Error('请选择有效的回忆评价');
 return clone({eventId:event.eventId,deviceId:event.deviceId,knowledgeId:event.knowledgeId,occurredAt:event.occurredAt,type:event.type,payload:event.payload});
}
export function validateGuidedDraft(draft){
 if(!isObject(draft)||!validId(draft.draftId)||!validId(draft.deviceId)||!validId(draft.knowledgeId)||!validAt(draft.updatedAt)||!isObject(draft.values))throw new Error('复盘草稿格式无效');
 jsonValue(draft.values);
 const v=draft.values;
 if(v.step!==undefined&&(!Number.isInteger(v.step)||v.step<0||v.step>5))throw new Error('草稿步骤无效');
 for(const field of ['restatement','originalThought','keyDifference','warningCue'])if(v[field]!==undefined&&typeof v[field]!=='string')throw new Error('草稿文字格式无效');
 if(v.confidence!==undefined&&!['','确定','犹豫','猜的'].includes(v.confidence)||v.recall!==undefined&&!['','independent','cued','forgot'].includes(v.recall)||v.reason!==undefined&&!reasonValues.has(v.reason)||v.done!==undefined&&typeof v.done!=='boolean')throw new Error('草稿自评格式无效');
 if(v.checked!==undefined&&(!Array.isArray(v.checked)||v.checked.length>200||!v.checked.every(n=>Number.isInteger(n)&&n>=0&&n<=200)))throw new Error('草稿核对清单格式无效');
 if(v.answers!==undefined){if(!isObject(v.answers))throw new Error('草稿答题记录格式无效');for(const [id,answer] of Object.entries(v.answers))if(!validId(id)||!isObject(answer)||!Array.isArray(answer.answer)||!answer.answer.length||!answer.answer.every(a=>typeof a==='string'&&a.length>0&&a.length<=20)||typeof answer.correct!=='boolean')throw new Error('草稿答题记录格式无效');}
 return clone({draftId:draft.draftId,deviceId:draft.deviceId,knowledgeId:draft.knowledgeId,updatedAt:draft.updatedAt,values:draft.values});
}
export function emptyGuidedState(){return {schemaVersion:1,revision:0,events:[],drafts:[],quarantine:[],conflicts:[]};}
function validateLists(bundle){
 if(!isObject(bundle)||bundle.schemaVersion!==1)throw new Error('复盘文件版本不支持，请使用版本 1 的导出文件');
 for(const key of ['events','drafts','quarantine','conflicts'])if(bundle[key]!==undefined&&(!Array.isArray(bundle[key])||bundle[key].length>100000))throw new Error('复盘文件列表格式无效');
 if(!Array.isArray(bundle.events))throw new Error('复盘文件缺少事件列表');
}
function checkedConflict(conflict){
 if(!isObject(conflict)||!['event','draft'].includes(conflict.kind))throw new Error('冲突记录格式无效');
 const validator=conflict.kind==='event'?validateGuidedEvent:validateGuidedDraft;
 const existing=validator(conflict.existing),incoming=validator(conflict.incoming),key=conflict.kind==='event'?'eventId':'draftId';
 if(existing[key]!==incoming[key]||identity(existing)===identity(incoming))throw new Error('冲突记录编号或内容无效');
 return {kind:conflict.kind,id:existing[key],existing,incoming};
}
/** Immutable event merge: conflicting event IDs never overwrite accepted evidence. */
export function mergeGuidedState(state,bundle,knownIds){
 validateLists(state);validateLists(bundle);
 const known=new Set(knownIds),result=emptyGuidedState();result.revision=Number.isInteger(state.revision)?state.revision:0;
 const summary={addedEvents:0,addedDrafts:0,duplicates:0,conflicts:0,quarantined:0,promoted:0};
 const maps={event:new Map(),draft:new Map()},held=new Map(),conflicts=new Set();
 function keepConflict(raw,isIncoming){const value=checkedConflict(raw),key=identity({kind:value.kind,id:value.id,versions:[identity(value.existing),identity(value.incoming)].sort()});if(!conflicts.has(key)){conflicts.add(key);result.conflicts.push(value);if(isIncoming)summary.conflicts++;}}
 function accept(kind,raw,incoming=false,wasHeld=false){
  const entry=(kind==='event'?validateGuidedEvent:validateGuidedDraft)(raw),key=kind==='event'?'eventId':'draftId',id=entry[key];
  const existing=maps[kind].get(id)||held.get(kind+':'+id)?.entry;
  if(existing){if(identity(existing)===identity(entry)){if(incoming)summary.duplicates++;return;}keepConflict({kind,existing,incoming:entry},incoming);return;}
  if(!known.has(entry.knowledgeId)){held.set(kind+':'+id,{kind,reason:'unknown-knowledge',entry});if(incoming)summary.quarantined++;return;}
  maps[kind].set(id,entry);if(incoming)summary[kind==='event'?'addedEvents':'addedDrafts']++;if(wasHeld)summary.promoted++;
 }
 for(const item of state.events)accept('event',item);
 for(const item of state.drafts||[])accept('draft',item);
 for(const item of state.quarantine||[]){if(!['event','draft'].includes(item.kind))throw new Error('待匹配记录格式无效');accept(item.kind,item.entry,false,true);}
 for(const item of state.conflicts||[])keepConflict(item,false);
 for(const item of bundle.events)accept('event',item,true);
 for(const item of bundle.drafts||[])accept('draft',item,true);
 for(const item of bundle.quarantine||[]){if(!['event','draft'].includes(item.kind))throw new Error('待匹配记录格式无效');accept(item.kind,item.entry,true,true);}
 for(const item of bundle.conflicts||[])keepConflict(item,true);
 result.events=[...maps.event.values()].sort((a,b)=>a.occurredAt.localeCompare(b.occurredAt)||a.eventId.localeCompare(b.eventId));
 result.drafts=[...maps.draft.values()].sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)||a.draftId.localeCompare(b.draftId));
 result.quarantine=[...held.values()];
 const before=identity({...state,revision:0}),after=identity({...result,revision:0});
 if(before!==after)result.revision++;
 return {state:result,summary};
}
export function createGuidedEvent(knowledgeId,type,payload,deviceId,at=new Date().toISOString()){
 return validateGuidedEvent({eventId:'guided-'+globalThis.crypto.randomUUID(),deviceId,knowledgeId,occurredAt:at,type,payload});
}
export function createTransferBundle(state,deviceId,at=new Date().toISOString()){
 if(!validId(deviceId)||!validAt(at))throw new Error('导出设备或时间格式无效');validateLists(state);
 return clone({schemaVersion:1,exportedAt:at,deviceId,events:state.events.map(validateGuidedEvent),drafts:(state.drafts||[]).map(validateGuidedDraft),quarantine:(state.quarantine||[]).map(item=>{if(!['event','draft'].includes(item.kind))throw new Error('待匹配记录格式无效');return {kind:item.kind,reason:'unknown-knowledge',entry:(item.kind==='event'?validateGuidedEvent:validateGuidedDraft)(item.entry)};}),conflicts:(state.conflicts||[]).map(checkedConflict)});
}
/** Completion self-evaluation schedules recall; it never declares semantic mastery. */
export function summarizeGuided(state,at=new Date()){
 const today=reviewDay(at),items=Object.create(null);
 for(const event of [...state.events].sort((a,b)=>new Date(a.occurredAt)-new Date(b.occurredAt)||a.eventId.localeCompare(b.eventId))){
  const item=items[event.knowledgeId]||={knowledgeId:event.knowledgeId,attempts:0,correctAttempts:0,variantAttempts:0,variantCorrect:0,independentRecallCount:0,independentRecallDays:[],completionCount:0,failedRecallStreak:0,reviewStage:0,nextReview:'',lastAt:'',lastRating:'',lastCompleteAt:'',reasonCounts:Object.create(null),lastNote:null,due:false};
  const p=event.payload;item.lastAt=event.occurredAt;
  if(event.type==='attempt'){item.attempts++;if(p.correct)item.correctAttempts++;if(p.variant){item.variantAttempts++;if(p.correct)item.variantCorrect++;}}
  if(event.type==='note')item.lastNote=clone(p);
  if(event.type==='complete'){
   item.completionCount++;
   const independent=p.independentRecall&&p.rating==='掌握';
   if(independent){item.independentRecallCount++;const day=reviewDay(event.occurredAt);if(!item.independentRecallDays.includes(day))item.independentRecallDays.push(day);item.failedRecallStreak=0;}else item.failedRecallStreak++;
   const rating=p.rating==='掌握'&&!p.independentRecall?'模糊':p.rating;
   Object.assign(item,scheduleReview(rating,item.reviewStage,new Date(event.occurredAt),item.lastCompleteAt));
   item.lastCompleteAt=event.occurredAt;item.lastRating=rating;
   if(p.reason){item.reasonCounts[p.reason]=(item.reasonCounts[p.reason]||0)+1;}
  }
 }
 for(const item of Object.values(items))item.due=!!item.nextReview&&item.nextReview<=today;
 return items;
}
export function selectGuidedQueue(lessons,state,at=new Date()){
 const items=summarizeGuided(state,at),priority=['police-duty','supervision','continue-time'];
 const order=[...lessons].sort((a,b)=>{const ai=priority.indexOf(a.id),bi=priority.indexOf(b.id);return (ai<0?100:ai)-(bi<0?100:bi);});
 const due=order.filter(l=>items[l.id]?.due).sort((a,b)=>items[a.id].nextReview.localeCompare(items[b.id].nextReview)).slice(0,3);
 const newCount=due.length>=3?1:2;
 const learn=order.filter(l=>!items[l.id]?.completionCount&&!due.some(d=>d.id===l.id)).slice(0,newCount);
 return {due,learn,items,minutes:30};
}
