import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import * as api from './api';
import type {Catalog,RecordItem} from './types';
import {applyEvent,emptyProgress,mergeProgress,type DrillProgress} from './drill-state.mjs';
const key='growth-drill-progress-v2';
function stored(){try{return JSON.parse(localStorage.getItem(key)||'null')||emptyProgress();}catch{return emptyProgress();}}
function oldWrongs(){try{return JSON.parse(localStorage.getItem('growth-wrong-questions-v1')||'[]');}catch{return [];}}
type Event={id:string;action:'attempt'|'confirm'|'dismiss';answer?:string;rating?:string;correct?:boolean|null;eventId?:string};
const Context=createContext<{progress:DrillProgress;busy:boolean;error:string;save:(e:Event)=>Promise<boolean>}|null>(null);
export function DrillProvider({catalog,children}:{catalog:Catalog;children:ReactNode}){
 const initial=mergeProgress(catalog.drillProgress||emptyProgress(),stored());
 for(const old of oldWrongs())if(!initial.items[old.id])initial.items[old.id]={attempts:1,wrongCount:1,streak:0,isWrong:true,origin:'旧版本本机错题',lastAt:old.at,lastAnswer:old.selected,history:[]};
 const [progress,setProgress]=useState<DrillProgress>(initial),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const live=useRef(progress),lock=useRef(false);
 const install=(p:DrillProgress)=>{live.current=p;setProgress(p);};
 useEffect(()=>{let disposed=false;
  if(api.isLocal()){lock.current=true;setBusy(true);api.getJSON('/api/drill-progress').then(async(p:DrillProgress)=>{
    for(const old of oldWrongs().filter((x:any)=>catalog.records.some(r=>r.id===x.id)))if(!p.items[old.id]?.isWrong)p=await api.post('drill-progress',{id:old.id,action:'confirm',eventId:'legacy-'+old.id,revision:p.revision});
    if(!disposed)install(p);
  }).catch(e=>setError('读取电脑刷题进度失败：'+e.message)).finally(()=>{lock.current=false;setBusy(false);});}
  const sync=(e:StorageEvent)=>{if(e.key===key&&!api.isLocal())install(mergeProgress(catalog.drillProgress||emptyProgress(),stored()));};window.addEventListener('storage',sync);
  return()=>{disposed=true;window.removeEventListener('storage',sync);};
 },[catalog.version]);
 const save=async(event:Event)=>{if(lock.current)return false;lock.current=true;setBusy(true);setError('');
  try{const input={...event,eventId:event.eventId||crypto.randomUUID(),at:new Date().toISOString(),revision:live.current.revision};
    const next=api.isLocal()?await api.post('drill-progress',input):applyEvent(mergeProgress(live.current,stored()),{...input,historicalWrong:!!catalog.records.find(r=>r.id===event.id)?.studyQuestion?.historicalWrong});
    if(!api.isLocal())localStorage.setItem(key,JSON.stringify(next));
    install(next);return true;
  }catch(e:any){setError('刷题进度未保存：'+e.message);if(api.isLocal())try{install(await api.getJSON('/api/drill-progress'));}catch{}return false;}
  finally{lock.current=false;setBusy(false);}
 };
 return <Context.Provider value={{progress,busy,error,save}}>{children}</Context.Provider>;
}
export function useDrill(){const value=useContext(Context);if(!value)throw new Error('刷题进度尚未初始化');return value;}
