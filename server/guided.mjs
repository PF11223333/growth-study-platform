import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {DATA,atomic} from './store.mjs';
import {emptyGuidedState,mergeGuidedState} from '../src/guided-state.mjs';

const STORE='guided-review.json';
const FILES=['platform.json','drill-progress.json',STORE];
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function readGuided({dataDir=DATA}={}){const file=path.join(dataDir,STORE);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):emptyGuidedState();}
export function readGuidedLessons({dataDir=DATA}={}){
 const file=path.join(dataDir,'guided-lessons.json');
 if(!fs.existsSync(file))throw new Error('精讲知识点尚未安装，请先生成学习资料');
 const catalog=JSON.parse(fs.readFileSync(file,'utf8'));
 if(catalog.schemaVersion!==1||!Array.isArray(catalog.lessons))throw new Error('精讲知识点目录格式无效');
 return catalog;
}
export function backupGuided({dataDir=DATA}={}){
 const name='guided-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID()+'.json';
 const snapshots=FILES.map(name=>{const file=path.join(dataDir,name);if(!fs.existsSync(file))return {name,exists:false};const bytes=fs.readFileSync(file);return {name,exists:true,sha256:digest(bytes),content:bytes.toString('utf8')};});
 atomic(path.join(dataDir,'backups',name),{schemaVersion:1,kind:'guided-review-backup',createdAt:new Date().toISOString(),files:snapshots});
 return name;
}
function checkRevision(input,state){if(input.revision!==undefined&&input.revision!==state.revision){const error=new Error('复盘记录已被其他窗口更新，请重新读取后再保存');error.status=409;throw error;}}
function prepared(input,dataDir){
 if(!input||typeof input!=='object'||!input.bundle)throw new Error('请提供复盘导出文件');
 const current=readGuided({dataDir});checkRevision(input,current);
 const ids=readGuidedLessons({dataDir}).lessons.map(l=>l.id);
 return {current,result:mergeGuidedState(current,input.bundle,ids)};
}
export function saveGuided(input,{dataDir=DATA}={}){
 const {current,result}=prepared(input,dataDir);
 if(result.state.revision!==current.revision)atomic(path.join(dataDir,STORE),result.state);
 return result;
}
export function importGuided(input,{dataDir=DATA}={}){
 // Validate before backing up or replacing anything. Only the event store changes.
 const {current,result}=prepared(input,dataDir);
 if(result.state.revision===current.revision)return {...result,backup:null};
 const backup=backupGuided({dataDir});
 atomic(path.join(dataDir,STORE),result.state);
 return {...result,backup};
}
/** Roll back the guide import only: platform and drill snapshots are retained for audit. */
export function restoreGuidedBackup(name,{dataDir=DATA}={}){
 if(typeof name!=='string'||!/^guided-[\w.-]+\.json$/.test(name))throw new Error('复盘备份名称无效');
 const backup=JSON.parse(fs.readFileSync(path.join(dataDir,'backups',name),'utf8'));
 if(backup.schemaVersion!==1||backup.kind!=='guided-review-backup'||!Array.isArray(backup.files)||backup.files.length!==FILES.length)throw new Error('复盘备份格式无效');
 for(const expected of FILES){
  const row=backup.files.find(f=>f.name===expected);if(!row||typeof row.exists!=='boolean')throw new Error('复盘备份缺少必要文件');
  if(row.exists&&(typeof row.content!=='string'||digest(Buffer.from(row.content,'utf8'))!==row.sha256))throw new Error('复盘备份校验失败');
 }
 const row=backup.files.find(f=>f.name===STORE);
 const restored=row.exists?JSON.parse(row.content):emptyGuidedState();
 if(restored.schemaVersion!==1||!Array.isArray(restored.events)||!Array.isArray(restored.drafts))throw new Error('备份中的复盘记录格式无效');
 const safeguard=backupGuided({dataDir});atomic(path.join(dataDir,STORE),row.exists?row.content:restored);
 return {state:readGuided({dataDir}),backup:safeguard};
}
