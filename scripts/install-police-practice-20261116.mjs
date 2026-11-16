import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, DATA, atomic, backup, hash, read, write} from '../server/store.mjs';
import {existingTeaching} from './police-existing-teaching-20261116.mjs';

const date='2026-11-16';
const bank='police-original-20261116';
const letters='ABCD';
const laws={
 police:['中华人民共和国人民警察法','https://public.xinmi.gov.cn/D0107Y/2512618.jhtml','2012年修正文本'],
 inspect:['公安机关督察条例','https://xzfg.moj.gov.cn/front/law/detail?LawID=483','2011年修订'],
 oversight:['行政执法监督条例','https://xzfg.moj.gov.cn/front/law/detail?LawID=1787','国务院令第825号，2026年2月1日起施行'],
 order:['中华人民共和国治安管理处罚法','https://gdb.beijing.gov.cn/rf_zwgk/2024zcwj/2024_qtwj/202603/t20260319_4561746.html','2025年修订，2026年1月1日起施行'],
 crime:['中华人民共和国刑法','https://www.audit.gov.cn/n7/n34/n58/c109675/content.html','刑法总则所列条款'],
 procedure:['中华人民共和国刑事诉讼法','https://wb.flk.npc.gov.cn/flfg/PDF/da00605597e54c3099cf628755a26e67.pdf','2018年修正公布文本，草案单独识别'],
 mediation:['中华人民共和国人民调解法','https://www.beijing.gov.cn/zhengce/zhengcefagui/qtwj/201101/t20110101_781290.html','2011年1月1日起施行'],
 privacy:['中华人民共和国个人信息保护法','https://www.miit.gov.cn/jgsj/zfs/fl/art/2022/art_515a4b20c12f430eab54bb4f56d89f56.html','2021年11月1日起施行'],
 equipment:['中华人民共和国人民警察使用警械和武器条例','https://xzfg.moj.gov.cn/front/law/detail?LawID=456','国务院令第191号'],
 emergency:['中华人民共和国突发事件应对法','https://www.beijing.gov.cn/zhengce/zhengcefagui/qtwj/202609/t20260904_4850732.html','2024年修订，2024年11月1日起施行'],
 math:['333页教材 · 信息分析','/source/source-e54c6989c8057386a3fe80e9?page=291','教材 PDF 第291页与题内数据'],
};
function parseTopics(){
 const chapters=[];
 for(const line of fs.readFileSync(path.join(ROOT,'scripts/police-original-20261116.txt'),'utf8').split(/\r?\n/)){
  if(!line.trim())continue;
  const [kind,...rest]=line;
  const fields=rest.join('').trim().split('|');
  const chapter=chapters.at(-1),lesson=chapter?.lessons.at(-1);
  if(kind==='@'){
   const [key,title,...cases]=fields;
   assert.equal(cases.length,2);
   chapters.push({key,title,cases,lessons:[]});
  }else if(kind==='!'){
   const [title,law,article,lead]=fields;
   assert.ok(laws[law]&&article&&lead,line);
   chapter.lessons.push({title,law,article,lead,pos:[],neg:[]});
  }else if(kind==='?'){
   assert.equal(fields.length,1);
   lesson.scenario=fields[0];
  }else{
   assert.ok(['+','-'].includes(kind),line);
   const [text,reason]=fields;
   assert.ok(text&&reason,line);
   lesson[kind==='+'?'pos':'neg'].push({text,reason,valid:kind==='+'});
  }
 }
 assert.equal(chapters.length,8);
 for(const t of chapters){
  assert.equal(t.lessons.length,5);
  for(const u of t.lessons){
   assert.ok(u.scenario);
   assert.equal(u.pos.length,3);
   assert.equal(u.neg.length,3);
   assert.equal(new Set([...u.pos,...u.neg].map(c=>c.text)).size,6);
  }
 }
 return chapters;
}

function makeRows(){
 return parseTopics().flatMap((chapter,ci)=>{
  const rows=[];
  const add=(lesson,li,wording,choices,{negative=false,type='single',group,position,context}={})=>{
   let n=rows.length+1;
   const id=`${bank}-${chapter.key}-${String(n).padStart(2,'0')}`;
   // Stable answer order protects old history when the candidate is rebuilt.
   const optionOrder=[...choices].sort((a,b)=>hash(id+a.text).localeCompare(hash(id+b.text)));
   const answer=optionOrder.map((option,i)=>option.valid!==negative?letters[i]:'').join('');
   assert.equal(answer.length,type==='single'?1:2,id);
   const [title,remote,effective]=laws[lesson.law];
   const isLaw=lesson.law!=='math';
   const url=isLaw?remote:'#'+remote;
   const basis={title,url,article:lesson.article,effective,verification:isLaw?'据所列条款校对案例；选项和解释为原创。':'按题面统计口径计算。'};
   const sourceRefs=isLaw?[{url,label:`${title} · ${lesson.article}`}]:[{sourceId:'source-e54c6989c8057386a3fe80e9',page:291,label:'图表分析方法'}];
   const prompt=context?wording:`${lesson.scenario}\n\n${wording}`;
   const options=Object.fromEntries(optionOrder.map((c,i)=>[letters[i],c.text]));
   const optionExplanations=Object.fromEntries(optionOrder.map((c,i)=>[letters[i],{text:c.reason,status:'原创；已依据所列来源核对',basis:[basis]}]));
   const shared=group?{caseGroupId:`${bank}-${chapter.key}-case-${group}`,caseCount:3,caseIndex:position,caseGroupOrder:position,caseTitle:chapter.cases[group-1],groupType:'case'}:{};
   const question={origin:'generated',type,prompt,options,referenceAnswer:answer,verifiedText:true,answerVerificationStatus:'verified-source-and-reasoning',
    ...(context?{contextTextVerified:true,fullContextText:context}:{}),optionExplanations,
    explanation:{category:chapter.title,keyCondition:lesson.lead,memory:lesson.lead,diagnosis:'对照决定答案的条件，记录这次实际漏看的要素。',legalBasis:isLaw?[basis]:[]},
    tutorial:{version:2,authored:{title:lesson.title,origin:'原创模拟 · GPT辅助编写，依据所列法规或教材核对',scope:'本题逐项判断与规则应用',verifiedAt:date,body:`## 本题怎样判断\n\n${lesson.lead}`,sources:[basis]}}};
   rows.push({id,legacyId:id,origin:bank,kind:'practice',subject:'gongan',topic:chapter.title,title:`${chapter.title} · 原创第 ${n} 题`,body:prompt,date,
    tags:['公安原创',chapter.title],sourceRefs,links:[],revision:1,verificationStatus:'原创模拟题 · 逐项解释',
    studyQuestion:{bank,origin:'generated',chapter:ci+1,chapterName:chapter.title,sectionId:`original-${chapter.key}`,sectionName:chapter.title,type,number:n,promptPreview:prompt.slice(0,160),knowledgeKey:`${bank}-${chapter.key}-${li+1}`,...shared},details:{question}});
  };
  chapter.lessons.forEach((l,i)=>{
   add(l,i,'关于这个情形，下列判断正确的是？',[l.pos[(i+ci)%3],...l.neg]);
   add(l,i,'复核这份处置记录时，以下哪项说法需要纠正？',[l.neg[(i+ci+1)%3],...l.pos],{negative:true});
  });
  chapter.lessons.slice(0,4).forEach((l,i)=>{
   add(l,i,'依题中给定条件，下列判断正确的有哪些？',
    [l.pos[i%3],l.pos[(i+1)%3],l.neg[(i+1)%3],l.neg[(i+2)%3]],{type:'multi'});
  });
  [[0,1,2],[2,3,4]].forEach((indexes,gi)=>{
   const parts=['甲','乙','丙'],context=indexes.map((i,j)=>`${parts[j]}项｜${chapter.lessons[i].scenario}`).join('\n\n');
   indexes.forEach((i,j)=>{
    const l=chapter.lessons[i];
    add(l,i,`根据共用材料的${parts[j]}项，下列处理或判断中不恰当的有哪些？`,
     [l.pos[(j+1)%3],l.pos[(j+2)%3],l.neg[j%3],l.neg[(j+1)%3]],
     {negative:true,type:'multi',group:gi+1,position:j+1,context});
   });
  });
  return rows;
 });
}

const args=process.argv.slice(2);
const refreshing=args.includes('--refresh-surfaces');
const file=args.find(a=>!a.startsWith('--'));
assert.ok(file,'Provide the rendered surface candidate path.');
const candidate=JSON.parse(fs.readFileSync(file,'utf8'));
const db=read();
assert.equal(db.version,candidate.version,'数据已变化，请重新生成题面候选。');
const rows=refreshing?[]:makeRows();
assert.equal(rows.length,refreshing?0:160);
assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
for(const topic of new Set(rows.map(r=>r.topic))){
 const chapter=rows.filter(r=>r.topic===topic);
 assert.equal(chapter.filter(r=>r.studyQuestion.type==='single').length,10);
 assert.equal(chapter.filter(r=>r.studyQuestion.type==='multi'&&!r.studyQuestion.caseGroupId).length,4);
 assert.equal(chapter.filter(r=>r.studyQuestion.caseGroupId).length,6);
}
let ready=0,pending=0,oldLessons=0;
const installed=new Set();
for(const record of db.records){
 const result=candidate.rows[record.id];
 if(!result)continue;
 assert.equal(record.revision,result.revision,record.id);
 const q=record.details.question,s=record.studyQuestion;
 const before=JSON.stringify([q,s]);
 installed.add(record.id);
 const lesson=existingTeaching[record.id];
 let practiceSurface=result.surface;
 if(lesson){
  assert.equal(lesson.answer,q.referenceAnswer,record.id);
  const opts=Object.fromEntries(lesson.options.map((text,i)=>[letters[i],text]));
  q.prompt=lesson.prompt;
  q.options=opts;
  q.verifiedText=true;
  q.verifiedAt=date;
  q.explanation={...q.explanation,keyCondition:lesson.lead,legalBasis:lesson.sources};
  q.optionExplanations=Object.fromEntries(lesson.notes.map((text,i)=>[letters[i],{text,status:'已逐项核对；解释为编写',basis:lesson.sources}]));
  q.tutorial={...q.tutorial,authored:{title:'原题逐项校准',origin:'对照原册和官方条文重新编写',scope:'本题逐项判断与规则应用',verifiedAt:date,body:`## 本题怎样判断\n\n${lesson.lead}`,sources:lesson.sources}};
  if(lesson.correction&&!s.correctionAnswer)s.correctionAnswer=lesson.correction;
  if(!s.caseGroupId||practiceSurface){
   const {context,contextClips}=practiceSurface||{};
   practiceSurface={stem:lesson.prompt,options:Object.fromEntries(Object.entries(opts).map(([k,text])=>[k,{text}])),...(context?{context}:{}),...(contextClips?{contextClips}:{})};
  }
  if(!refreshing)oldLessons++;
 }
 q.practiceSurfaceAudit={checkedAt:date,status:practiceSurface?'ready':'pending',reason:practiceSurface?'':result.reason,
  method:practiceSurface?.stem?'已校对文稿结构复查':'按卷内题号、四选项和干净版面定位'};
 assetsCheck(practiceSurface,record.id);
 if(practiceSurface){
  q.practiceSurface=practiceSurface;
  if(s.practiceSurfacePending){
   delete q.practiceSurfaceHold;
   delete s.practiceSurfacePending;
  }
  ready++;
 }else{
  delete q.practiceSurface;
  q.gradingExcluded=true;
  s.gradingExcluded=true;
  q.practiceSurfaceHold=result.reason;
  s.practiceSurfacePending=true;
  pending++;
 }
 if(!q.bookAnswer){
  const answerRef=record.sourceRefs.find(ref=>/答案表|卷末答案|最终答案勘误/.test(ref.label||''));
  if(answerRef&&/^[A-D]{1,4}$/.test(q.referenceAnswer||'')&&!q.errata&&!q.answerConflict)q.bookAnswer=q.referenceAnswer;
 }
 if(JSON.stringify([q,s])!==before)record.revision++;
}
assert.equal(installed.size,Object.keys(candidate.rows).length);
const oldIds=new Set(db.records.map(r=>r.id));
assert.ok(rows.every(r=>!oldIds.has(r.id)));
db.records.push(...rows);
const previousReport=path.join(ROOT,'output/reports/police-practice-20261116-install.json');
const earlier=refreshing?JSON.parse(fs.readFileSync(previousReport,'utf8')):{};
const result={ready,pending,oldLessons:oldLessons+(earlier.oldLessons||0),
 originalAdded:rows.length+(earlier.originalAdded||0),counts:candidate.counts};
if(args.includes('--write')){
 assert.equal(read().version,candidate.version,'平台数据已变化');
 const snapshot=backup();
 write(db);
 atomic(previousReport,{...result,version:db.version,snapshot});
}
console.log(JSON.stringify(result));

function assetsCheck(surface,id){
 if(!surface)return;
 assert.ok(surface.stem||surface.stemClips?.length,id);
 assert.deepEqual(Object.keys(surface.options).sort(),[...letters],id);
 assert.ok(Object.values(surface.options).every(o=>o.text||o.clips?.length),id);
 for(const clip of [
  ...surface.stemClips||[],...surface.contextClips||[],...Object.values(surface.options).flatMap(o=>o.clips||[]),
 ]){
  const {x,y,w,h}=clip.region;
  assert.ok(clip.previewSuffix==='-clean'&&/^[\w-]+$/.test(clip.sourceId)&&Number.isInteger(clip.page)&&
   [x,y,w,h].every(Number.isFinite)&&x>=0&&y>=0&&w>0&&h>0&&x+w<=1.00001&&y+h<=1.00001,id);
  assert.ok(fs.existsSync(path.join(DATA,'previews',clip.sourceId,`${clip.page}-clean.webp`)),id);
 }
}
