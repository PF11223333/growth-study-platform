import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {ROOT} from '../server/store.mjs';
import {GUIDED_IDS,GUIDED_BOOKS,assembleGuidedBundle,validateGuidedBundle,buildGuidedRecords,mergeGuidedRecords,installGuided} from '../scripts/install-guided.mjs';

const copy=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const db={schemaVersion:1,version:4,updatedAt:'2026-10-14T02:00:00Z',records:[],sources:GUIDED_BOOKS.map((id,index)=>({id,pageCount:[333,119,298][index]})),archives:[],conflicts:[]};
 const authored={schemaVersion:1,updatedAt:'2026-10-15T12:00:00+08:00',lessons:[]},audit={schemaVersion:1,verifiedAt:'2026-10-15',verificationScope:'测试固定资料',units:[],chapters:GUIDED_BOOKS.map(sourceId=>({sourceId,title:'教材章节',sections:[{title:'已核对章节',page:1,lessonIds:[]}]}))};
 for(const [index,id]of GUIDED_IDS.entries()){
  const cardId='card-'+id,anchorId='anchor-'+id;db.records.push({id:cardId,kind:'memory',revision:1},{id:anchorId,kind:'practice',revision:1,links:[],details:{question:{referenceAnswer:'A',observedAnswers:[{color:'red',answer:'B'}],prompt:'保留原题原始文本'}},studyQuestion:{bank:'original',historicalWrong:true}});
  const options=['A','B','C','D'].map(key=>({key,text:'具体选项'+key,explanation:'这是'+key+'项的独立分析，先判断条件再比较情形。'}));
  authored.lessons.push({id,cardId,title:'理解'+id,category:'复盘知识点',order:index+1,textbookPage:1,plain:'先把适用条件找出来，再判断材料中的具体行为。',formal:'正式概念与适用边界。',conditions:['核对主体条件。','核对时间条件。'],example:'情形甲同时满足两个条件，所以适用规则。',counterexample:'情形乙缺少时间条件，所以不能直接照搬规则。',mnemonic:'先看条件是否齐全，再作结论。',checklist:['说出主体条件。','说出时间条件。'],pitfalls:['不要漏掉限制条件。','不要把两个概念混淆。'],laws:['charts','data-collision'].includes(id)?[]:[{title:'官方法条测试数据',articles:'第一条',quote:'单元测试固定条文内容。',url:'https://www.gov.cn/example',effective:'2026-01-01',checkedAt:'2026-10-15'}],variants:[1,2].map(n=>({id:'guided-'+id+'-'+n,stem:'为检验理解而编写的具体练习情境'+n,options:copy(options),answer:['A'],explanation:'这道练习同时要求主体与时间条件成立，故选择对应项。'})),originalExplanation:'原题需要区分适用条件是否齐全，逐项判断后再选择。',originalExplanations:{[anchorId]:Object.fromEntries(options.map(o=>[o.key,o.explanation]))}});
  const sourceRefs=[{sourceId:GUIDED_BOOKS[0],page:1},{sourceId:GUIDED_BOOKS[1+index%2],page:1}];
  audit.units.push({id,sourceRefs,sourceExcerpts:[{sourceId:GUIDED_BOOKS[0],page:1,quote:'这是单元测试中已经核对的教材摘录。',kind:'textbook-original',status:'verified',label:'教材原文'}],questionIds:[anchorId],originalQuestion:{id:anchorId,prompt:'原题要求根据具体情境判断下列选项。',options:Object.fromEntries(options.map(o=>[o.key,o.text])),answer:'A',sourceRefs:[sourceRefs[1]],originalPages:[],status:'verified',verifiedAt:'2026-10-15'},auditNotes:[]});
 }
 const report={verifiedAt:'2026-10-15',correct:10,wrong:8,pending:1,excluded:2,topics:Object.fromEntries(['民法与宪法法理','警察职责与监督','行政执法与治安','刑事程序与证据','信息与情报分析'].map(name=>[name,{correct:10,wrong:8,pending:1,excluded:2}]))};
 return {db,authored,audit,report};
}

test('首批真实内容必须有15个精讲、30个变式和15个逐项讲清的原题',()=>{
 const dataDir=path.join(ROOT,'data'),read=name=>JSON.parse(fs.readFileSync(path.join(dataDir,name),'utf8'));
 const bundle=assembleGuidedBundle(read('guided-lessons.json'),read('guided-source-audit.json'),read('platform.json'),read('lower-study-report.json'));
 assert.deepEqual(validateGuidedBundle(bundle,read('platform.json')),{lessons:15,variants:30,originals:15,sources:new Set(bundle.lessons.flatMap(l=>l.sourceRefs.map(s=>s.sourceId))).size});
 assert.equal(bundle.lessons.find(l=>l.id==='civil-capacity').textbookPage,245);
 assert.equal(bundle.lessons.find(l=>l.id==='illegal-order').textbookPage,259);
 assert.equal(bundle.lessons.find(l=>l.id==='nonexecution').textbookPage,52);
});

test('安装内容从审计取准确来源页，不把待核验关联宣称为精讲',()=>{
 const f=fixture();f.authored.lessons[0].textbookPage=7;const bundle=assembleGuidedBundle(f.authored,f.audit,f.db,f.report);
 assert.equal(bundle.lessons[0].textbookPage,1);assert.equal(bundle.lessons[0].originalQuestion.options[0].explanation,f.authored.lessons[0].originalExplanations['anchor-civil-capacity'].A);
 assert.equal(bundle.baseline.topics[0].correct,10);assert.equal(bundle.baseline.topics[0].pending,1);
 const missing=copy(f.audit);missing.units[0].originalQuestion.status='pending';assert.throws(()=>assembleGuidedBundle(f.authored,missing,f.db,f.report),/尚未校准/);
});

test('缺解释、假链接、越界页码和方法类伪法条阻止安装',()=>{
 const f=fixture();const base=assembleGuidedBundle(f.authored,f.audit,f.db,f.report);
 const noExplanation=copy(base);noExplanation.lessons[0].variants[0].options[1].explanation='';assert.throws(()=>validateGuidedBundle(noExplanation,f.db),/逐项解释/);
 const fake=copy(base);fake.lessons[0].laws[0].url='https://example.com/law';assert.throws(()=>validateGuidedBundle(fake,f.db),/官方/);
 const badPage=copy(base);badPage.lessons[0].sourceRefs[0].page=334;assert.throws(()=>validateGuidedBundle(badPage,f.db),/教材页|超界/);
 const fakeMethod=copy(base);fakeMethod.lessons.find(l=>l.id==='charts').laws=copy(base.lessons[0].laws);assert.throws(()=>validateGuidedBundle(fakeMethod,f.db),/硬配/);
 const ocr=copy(base);ocr.lessons[0].originalQuestion.options[1].text='L';assert.throws(()=>validateGuidedBundle(ocr,f.db),/选项或逐项/);
});

test('生成的45条记录可刷题、关联知识卡，下面提供逐项解释与完整教程',()=>{
 const f=fixture(),bundle=assembleGuidedBundle(f.authored,f.audit,f.db,f.report),records=buildGuidedRecords(bundle,f.db);
 assert.equal(records.created.filter(r=>r.kind==='knowledge').length,15);assert.equal(records.created.filter(r=>r.kind==='practice').length,30);assert.equal(records.anchors.length,15);
 const q=records.created.find(r=>r.kind==='practice');assert.equal(q.studyQuestion.bank,'reinforcement');assert.equal(q.studyQuestion.origin,'generated');assert.equal(q.studyQuestion.knowledgeKey,'card-civil-capacity');assert.equal(q.studyQuestion.parentId,'anchor-civil-capacity');assert.ok(q.details.question.tutorial.authored.body.includes('换成大白话'));assert.equal(Object.keys(q.details.question.optionExplanations).length,4);assert.equal(q.details.question.tutorial.materials[0].id,'guided-lesson-civil-capacity');
});

test('记录合并幂等，用户编辑保留并生成可查看冲突，不改历史答案',()=>{
 const f=fixture(),bundle=assembleGuidedBundle(f.authored,f.audit,f.db,f.report),first=mergeGuidedRecords(f.db,bundle);
 assert.equal(first.added,45);assert.equal(first.anchors,15);const anchor=f.db.records.find(r=>r.id==='anchor-civil-capacity');assert.equal(anchor.details.question.referenceAnswer,'A');assert.deepEqual(anchor.details.question.observedAnswers,[{color:'red',answer:'B'}]);
 const second=mergeGuidedRecords(f.db,bundle);assert.equal(second.added+second.updated+second.anchors+second.conflicts,0);assert.equal(second.unchanged,60);
 const own=f.db.records.find(r=>r.id==='guided-lesson-civil-capacity');own.edited=true;own.body='这是我自己写的理解';bundle.lessons[0].plain+=' 新增解释。';
 const changed=mergeGuidedRecords(f.db,bundle);assert.equal(changed.conflicts,1);assert.equal(f.db.records.find(r=>r.id===own.id).body,'这是我自己写的理解');assert.ok(f.db.conflicts[0].incoming.body.includes('新增解释'));
 assert.equal(mergeGuidedRecords(f.db,bundle).conflicts,0);
});

test('安装一次备份并仅升一个版本，重复安装无新增，干运行不写文件',()=>{
 const f=fixture(),dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'growth-guided-install-'));
 try{for(const [name,value]of Object.entries({'platform.json':f.db,'guided-lessons.json':f.authored,'guided-source-audit.json':f.audit,'lower-study-report.json':f.report}))fs.writeFileSync(path.join(dataDir,name),JSON.stringify(value));
  const before=fs.readFileSync(path.join(dataDir,'platform.json'),'utf8');const dry=installGuided({dataDir,dryRun:true});assert.equal(dry.added,45);assert.equal(fs.readFileSync(path.join(dataDir,'platform.json'),'utf8'),before);assert.equal(fs.existsSync(path.join(dataDir,'backups')),false);
  const result=installGuided({dataDir});assert.equal(result.version,5);assert.equal(result.added,45);assert.equal(fs.readdirSync(path.join(dataDir,'backups')).length,1);
  const repeated=installGuided({dataDir});assert.equal(repeated.changed,false);assert.equal(repeated.version,5);assert.equal(fs.readdirSync(path.join(dataDir,'backups')).length,1);
 }finally{fs.rmSync(dataDir,{recursive:true,force:true});}
});
