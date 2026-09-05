import type {Catalog,RecordItem} from './types';
let local=false,token='';
const detailCache=new Map<string,RecordItem>();
export async function getJSON(url:string){const res=await fetch(url,{cache:'no-cache'});if(!res.ok)throw new Error(`读取失败（${res.status}），请重试。`);return res.json();}
export async function bootstrap():Promise<Catalog>{if(['127.0.0.1','localhost'].includes(location.hostname)){try{const d=await getJSON('/api/bootstrap');if(d.mode==='local'){local=true;token=d.token;return d;}}catch{}}local=false;return getJSON('./data/catalog.json');}
export function isLocal(){return local;}
export async function post(endpoint:string,data:any={}){if(!local)throw new Error('请在电脑本地管理版编辑');const res=await fetch(`/api/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json','X-Growth-Token':token},body:JSON.stringify(data)});const result=await res.json();if(!res.ok)throw new Error(result.error||'保存失败');detailCache.clear();return result;}
export async function record(id:string):Promise<RecordItem>{if(!detailCache.has(id))detailCache.set(id,await getJSON(local?`/api/records/${id}`:`./data/records/${id}.json`));return detailCache.get(id)!;}
export const sourcePages=(id:string)=>getJSON(local?`/api/sources/${id}`:`./data/sources/${id}.json`);
export const searchIndex=()=>getJSON(local?'/api/search':'./data/search.json');
export const growth=async()=>{const d=await getJSON(local?'/api/growth':'./data/growth.json');return local?d.growth:d;};
export const invalidate=()=>detailCache.clear();
