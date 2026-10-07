import test from 'node:test';
import assert from 'node:assert/strict';
import {gradeQuestion,emptyProgress,applyEvent,mergeProgress,isWrongRecord,isPending} from '../src/drill-state.mjs';
import {prepareDrills} from '../scripts/prepare-drills.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,empty} from '../server/store.mjs';
test('多选忽略顺序并完整匹配，开放题不做伪自动判分',()=>{
 assert.equal(gradeQuestion({type:'multi',referenceAnswer:'AC'},'CA'),true);
 assert.equal(gradeQuestion({type:'multi',referenceAnswer:'AC'},'A'),false);
 assert.equal(gradeQuestion({type:'single',referenceAnswer:''},'A'),null);
 assert.equal(gradeQuestion({type:'recall'},'','忘记'),false);
 assert.equal(gradeQuestion({type:'recall'},'','掌握'),true);
});
test('历史错题保留、事件去重、跨天掌握、再次答错恢复待巩固',()=>{
 let state=emptyProgress();const event=(eventId,correct,at)=>({id:'q',action:'attempt',eventId,correct,answer:correct?'A':'B',at,historicalWrong:true});
 state=applyEvent(state,event('a',false,'2026-10-07T04:00:00Z'));
 const once=applyEvent(state,event('a',false,'2026-10-07T04:00:00Z'));assert.deepEqual(once,state);
 for(const n of[1,2,3])state=applyEvent(state,event('c'+n,true,'2026-10-07T05:00:00Z'));
 assert.equal(state.items.q.mastered,false);state=applyEvent(state,event('d',true,'2026-10-08T05:00:00Z'));assert.equal(state.items.q.mastered,true);
 state=applyEvent(state,event('e',false,'2026-10-09T05:00:00Z'));assert.equal(state.items.q.mastered,false);assert.equal(state.items.q.streak,0);assert.equal(state.items.q.wrongCount,2);assert.equal(state.items.q.nextReview,'2026-10-10');
 assert.equal(isWrongRecord({id:'q'},state),true);assert.equal(isPending({id:'q',studyQuestion:{wrongCandidate:true}},state),false);
 const old={revision:0,items:{q:{lastAt:'2026-10-01T00:00:00Z'}}};assert.deepEqual(mergeProgress(state,old).items.q,state.items.q);
});
test('自测导入识别零索引答案且重复导入不增题，红蓝历史规则分层',()=>{
 const db={records:[{id:'base',title:'常识',subject:'xingce',topic:'常识',sourceRefs:[],details:{quiz:{question:'哪个是？',choices:['甲','乙','丙','丁'],answer:0}}},{id:'ink',kind:'practice',revision:1,studyQuestion:{bank:'police-drill-20260917',blueMark:true,redMark:true},details:{question:{referenceAnswer:'A',observedAnswers:[{color:'red',answer:'C'},{color:'blue',answer:'A'}]}}},{id:'pending',kind:'practice',revision:1,studyQuestion:{bank:'police-drill-20260917',blueMark:true},details:{question:{referenceAnswer:'A'}}}]};
 prepareDrills(db);const q=db.records.find(r=>r.id.startsWith('exercise-'));assert.equal(q.details.question.referenceAnswer,'A');assert.equal(q.details.question.type,'single');assert.equal(db.records.find(r=>r.id==='ink').studyQuestion.historicalWrong,true);assert.equal(db.records.find(r=>r.id==='pending').studyQuestion.wrongCandidate,true);
 const length=db.records.length;const again=prepareDrills(db);assert.equal(db.records.length,length);assert.equal(again.added,0);assert.equal(again.updated,0);
});
test('刷题 API 由服务端判分，拒绝过期覆盖，去重重试，保护写入权限',async()=>{
 const data=path.join(ROOT,'tmp','drill-api-'+Date.now());fs.mkdirSync(data,{recursive:true});const db=empty();db.records=[{id:'q',kind:'practice',studyQuestion:{bank:'test'},details:{question:{type:'multi',referenceAnswer:'AC'}}}];fs.writeFileSync(path.join(data,'platform.json'),JSON.stringify(db));
 const proc=spawn(process.execPath,['server/index.mjs'],{cwd:ROOT,env:{...process.env,GROWTH_DATA_DIR:data,PORT:'14187'},windowsHide:true,stdio:'pipe'});let started=false;proc.stdout.on('data',()=>{started=true;});
 try{for(let i=0;i<50&&!started;i++)await new Promise(r=>setTimeout(r,100));const base='http://127.0.0.1:14187';const bootstrap=await(await fetch(base+'/api/bootstrap')).json();
 const submit=async(input,token=bootstrap.token)=>{const res=await fetch(base+'/api/drill-progress',{method:'POST',headers:{'Content-Type':'application/json','X-Growth-Token':token},body:JSON.stringify(input)});return{status:res.status,body:await res.json()};};
 assert.equal((await submit({id:'q',action:'attempt',eventId:'0',revision:0,answer:'A'},'')).status,403);
 const first=await submit({id:'q',action:'attempt',eventId:'1',revision:0,answer:'A',correct:true});assert.equal(first.status,200);assert.equal(first.body.items.q.lastCorrect,false);assert.equal(first.body.items.q.isWrong,true);
 const repeated=await submit({id:'q',action:'attempt',eventId:'1',revision:0,answer:'A'});assert.equal(repeated.status,200);assert.equal(repeated.body.items.q.attempts,1);
 assert.equal((await submit({id:'q',action:'attempt',eventId:'2',revision:0,answer:'AC'})).status,409);
 const second=await submit({id:'q',action:'attempt',eventId:'2',revision:1,answer:'CA'});assert.equal(second.body.items.q.lastCorrect,true);assert.equal(second.body.items.q.attempts,2);
 assert.equal((await submit({id:'q',action:'attempt',eventId:'3',revision:2,answer:''})).status,400);
 assert.equal(JSON.parse(fs.readFileSync(path.join(data,'platform.json'))).version,0);
 }finally{proc.kill();}
});
