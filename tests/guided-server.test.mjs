import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';
import {ROOT,empty} from '../server/store.mjs';
import {readGuided,saveGuided,importGuided,restoreGuidedBackup} from '../server/guided.mjs';

const event={eventId:'event-one',deviceId:'phone-one',knowledgeId:'police-duty',occurredAt:'2026-10-15T02:00:00Z',type:'note',payload:{keyDifference:'不值班也有依法履职的情形'}};
const input={bundle:{schemaVersion:1,events:[event]}};
function fixture(){const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'growth-guided-test-'));fs.writeFileSync(path.join(dataDir,'platform.json'),JSON.stringify(empty()));fs.writeFileSync(path.join(dataDir,'drill-progress.json'),JSON.stringify({revision:1,items:{}}));fs.writeFileSync(path.join(dataDir,'guided-lessons.json'),JSON.stringify({schemaVersion:1,lessons:[{id:'police-duty'}]}));return {dataDir};}

test('导入备份三份状态、重复导入零新增、版本冲突不覆盖',()=>{
 const options=fixture();try{
  const originalPlatform=fs.readFileSync(path.join(options.dataDir,'platform.json'),'utf8'),originalDrill=fs.readFileSync(path.join(options.dataDir,'drill-progress.json'),'utf8');
  const result=importGuided(input,options);assert.equal(result.summary.addedEvents,1);
  const backup=JSON.parse(fs.readFileSync(path.join(options.dataDir,'backups',result.backup),'utf8'));
  assert.deepEqual(backup.files.map(f=>f.name),['platform.json','drill-progress.json','guided-review.json']);assert.equal(backup.files[2].exists,false);
  assert.equal(fs.readFileSync(path.join(options.dataDir,'platform.json'),'utf8'),originalPlatform);assert.equal(fs.readFileSync(path.join(options.dataDir,'drill-progress.json'),'utf8'),originalDrill);
  const repeated=importGuided(input,options);assert.equal(repeated.summary.addedEvents,0);assert.equal(repeated.summary.duplicates,1);assert.equal(repeated.backup,null);
  assert.throws(()=>saveGuided({...input,revision:0},options),error=>error.status===409);
  restoreGuidedBackup(result.backup,options);assert.equal(readGuided(options).events.length,0);
 }finally{fs.rmSync(options.dataDir,{recursive:true,force:true});}
});

test('恢复演练保留已有记录，拒绝损坏备份且不改写状态',()=>{
 const options=fixture();try{
  saveGuided(input,options);const before=fs.readFileSync(path.join(options.dataDir,'guided-review.json'),'utf8');
  const added=importGuided({bundle:{schemaVersion:1,events:[{...event,eventId:'second',payload:{keyDifference:'第二条独立笔记'}}]}},options);
  restoreGuidedBackup(added.backup,options);assert.equal(fs.readFileSync(path.join(options.dataDir,'guided-review.json'),'utf8'),before);
  const backupFile=path.join(options.dataDir,'backups',added.backup),bad=JSON.parse(fs.readFileSync(backupFile,'utf8'));bad.files[0].content+='x';fs.writeFileSync(backupFile,JSON.stringify(bad));
  assert.throws(()=>restoreGuidedBackup(added.backup,options),/校验失败/);assert.equal(fs.readFileSync(path.join(options.dataDir,'guided-review.json'),'utf8'),before);
  assert.throws(()=>restoreGuidedBackup('../platform.json',options),/名称/);
 }finally{fs.rmSync(options.dataDir,{recursive:true,force:true});}
});

test('导入校验或原子替换失败时，旧状态保持不变',()=>{
 const options=fixture();const rename=fs.renameSync;try{
  saveGuided(input,options);const file=path.join(options.dataDir,'guided-review.json'),before=fs.readFileSync(file,'utf8');
  assert.throws(()=>importGuided({bundle:{schemaVersion:7,events:[]}},options),/版本/);assert.equal(fs.readFileSync(file,'utf8'),before);
  fs.renameSync=(from,to)=>{if(to===file)throw new Error('simulated disk write failure');return rename(from,to);};
  assert.throws(()=>importGuided({bundle:{schemaVersion:1,events:[{...event,eventId:'second'}]}},options),/simulated/);
  assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal(readGuided(options).events.length,1);
 }finally{fs.renameSync=rename;fs.rmSync(options.dataDir,{recursive:true,force:true});}
});

test('本地导学接口沿用本机与令牌保护；导入保留未知知识点',async()=>{
 const options=fixture(),port=24000+Math.floor(Math.random()*8000);
 const child=spawn(process.execPath,['server/index.mjs'],{cwd:ROOT,env:{...process.env,GROWTH_DATA_DIR:options.dataDir,PORT:String(port)},windowsHide:true,stdio:'pipe'});
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('test server startup timed out')),10000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('exit',code=>{clearTimeout(timer);reject(new Error('test server exited '+code));});});
  const base='http://127.0.0.1:'+port,bootstrap=await(await fetch(base+'/api/bootstrap')).json();
  assert.equal((await fetch(base+'/api/guided-review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})).status,403);
  assert.equal((await fetch(base+'/api/guided-review',{headers:{Origin:'https://untrusted.example'}})).status,403);
  const post=async(endpoint,data)=>fetch(base+'/api/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Growth-Token':bootstrap.token},body:JSON.stringify(data)});
  const saved=await post('guided-review',input);assert.equal(saved.status,200);assert.equal((await saved.json()).state.events.length,1);
  const imported=await post('guided-review/import',{bundle:{schemaVersion:1,events:[{...event,eventId:'unknown',knowledgeId:'not-in-catalog'}]}});assert.equal(imported.status,200);assert.equal((await imported.json()).state.quarantine.length,1);
  assert.equal((await(await fetch(base+'/api/guided-review')).json()).events.length,1);assert.equal((await(await fetch(base+'/api/guided-lessons')).json()).lessons[0].id,'police-duty');
  assert.equal((await post('guided-review',{...input,revision:0})).status,409);
 }finally{child.kill();await new Promise(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',resolve);});fs.rmSync(options.dataDir,{recursive:true,force:true});}
});
