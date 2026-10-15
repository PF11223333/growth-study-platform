import {createTransferBundle,emptyGuidedState,mergeGuidedState,validateGuidedDraft} from './guided-state.mjs';
import type {GuidedDraft,GuidedEvent,GuidedMergeResult,GuidedState,GuidedTransfer} from './guided-state.mjs';

const DB_NAME='growth-guided-review-v1',STORE='review';
let opening:Promise<IDBDatabase>|null=null,fallbackDevice='';
export function guidedDeviceId(){
 try{const existing=localStorage.getItem('growth-guided-device-v1');if(existing)return existing;const id='device-'+crypto.randomUUID();localStorage.setItem('growth-guided-device-v1',id);return id;}
 catch{return fallbackDevice||=( 'device-'+crypto.randomUUID());}
}
function database():Promise<IDBDatabase>{
 if(opening)return opening;
 opening=new Promise<IDBDatabase>((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(new Error('当前浏览器无法保存复盘记录，请允许网站使用本机存储后重试。'));return;}
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE);};
  request.onerror=()=>reject(new Error('无法打开本机复盘存储：'+(request.error?.message||'请检查浏览器设置')));
  request.onblocked=()=>reject(new Error('复盘存储升级被另一个页面阻止，请关闭旧页面后重试。'));
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();opening=null;};resolve(db);};
 }).catch(error=>{opening=null;throw error;});
 return opening!;
}
export async function readGuidedLocal():Promise<GuidedState>{
 const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).get('state');let value:GuidedState;
  request.onsuccess=()=>{value=request.result||emptyGuidedState();};
  tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(new Error('读取本机复盘记录失败'));tx.onabort=()=>reject(new Error('读取本机复盘记录已中断'));
 });
}
/** One IndexedDB read/write transaction prevents concurrent tabs from losing events. */
async function updateLocal<T>(change:(state:GuidedState)=>{state:GuidedState;value:T}):Promise<T>{
 const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),request=store.get('state');let value:T,failure:unknown;
  request.onsuccess=()=>{try{const changed=change(request.result||emptyGuidedState());value=changed.value;store.put(changed.state,'state');}catch(error){failure=error;tx.abort();}};
  tx.oncomplete=()=>{window.dispatchEvent(new Event('growth-guided-changed'));resolve(value);};
  tx.onerror=()=>reject(failure||new Error('保存失败，请检查浏览器存储空间；本次记录尚未保存。'));
  tx.onabort=()=>reject(failure||new Error('保存已中断；本次记录尚未保存。'));
 });
}
export async function mergeGuidedLocal(bundle:GuidedTransfer,knownIds:Iterable<string>):Promise<GuidedMergeResult>{
 const ids=[...knownIds];return updateLocal(state=>{const result=mergeGuidedState(state,bundle,ids);return {state:result.state,value:result};});
}
export function appendGuidedLocal(event:GuidedEvent,knownIds:Iterable<string>){return mergeGuidedLocal({schemaVersion:1,events:[event]},knownIds);}
export function saveGuidedDraft(knowledgeId:string,values:Record<string,any>):Promise<GuidedDraft>{
 const draft=validateGuidedDraft({draftId:'draft-'+crypto.randomUUID(),deviceId:guidedDeviceId(),knowledgeId,updatedAt:new Date().toISOString(),values});
 return updateLocal(state=>{
  const previous=state.drafts.filter(d=>d.knowledgeId===knowledgeId&&d.deviceId===draft.deviceId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
  if(previous&&JSON.stringify(previous.values)===JSON.stringify(draft.values))return {state,value:previous};
  const known=new Set([...state.events.map(e=>e.knowledgeId),...state.drafts.map(d=>d.knowledgeId),knowledgeId]);
  const result=mergeGuidedState(state,{schemaVersion:1,events:[],drafts:[draft]},known);
  return {state:result.state,value:draft};
 });
}
export async function exportGuidedLocal():Promise<GuidedTransfer>{return createTransferBundle(await readGuidedLocal(),guidedDeviceId());}
