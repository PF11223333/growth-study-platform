import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DATA,atomic,hash,now} from '../server/store.mjs';

export const GUIDED_IDS=['civil-capacity','guardian','limitation','constitution-change','state-organs','police-duty','illegal-order','supervision','inquiry-time','continue-time','nonexecution','fine','mediation','data-collision','charts'];
export const GUIDED_BOOKS=['source-e54c6989c8057386a3fe80e9','source-9657660fd40d4a780c48fe10','source-27c9642d30115cd64d7902bc'];
const TOPICS=['民法与宪法法理','警察职责与监督','行政执法与治安','刑事程序与证据','信息与情报分析'];
const copy=value=>JSON.parse(JSON.stringify(value));
const unique=values=>[...new Set(values)];
const uniqueRefs=refs=>[...new Map(refs.map(ref=>[JSON.stringify(ref),ref])).values()];
const required=(value,message)=>{if(!value)throw new Error(message);};
const text=value=>typeof value==='string'&&value.trim().length>0;
const placeholder=/选项未识别|未完整识别|请对照原页|本项不符合本题条件。|待补充解析|TODO|待编写|PLACEHOLDER/i;
function answerArray(value){return Array.isArray(value)?value:[...String(value||'').replace(/[^A-Z]/g,'')];}

export function normalizeGuidedQuestion(raw,lesson,original=false){
 required(raw&&raw.id,`${lesson.id} 缺少题目编号`);
 const perOption=lesson.originalExplanations?.[raw.id]||{};
 const options=(Array.isArray(raw.options)?raw.options:Object.entries(raw.options||{}).map(([key,text])=>({key,text}))).map(option=>({key:option.key,text:option.text,explanation:option.explanation||perOption[option.key]?.text||perOption[option.key]||raw.optionExplanations?.[option.key]?.text||raw.optionExplanations?.[option.key]||''}));
 const explanation=typeof raw.explanation==='string'?raw.explanation:original?lesson.originalExplanation||'':'';
 const answer=answerArray(raw.answer||raw.referenceAnswer);
 return {id:raw.id,stem:raw.stem||raw.prompt||'',type:raw.type||(answer.length>1?'multi':'single'),options,answer,explanation,...(original?{originalPages:raw.originalPages||[],sourceRefs:raw.sourceRefs||[],verificationStatus:raw.status,verifiedAt:raw.verifiedAt,lawNote:lesson.originalLawNote||'',fullContextText:raw.fullContextText||raw.contextText||''}:{origin:'generated',label:'原创巩固练习'})};
}

export function assembleGuidedBundle(authored,audit,db,report){
 required(authored?.schemaVersion===1&&Array.isArray(authored.lessons),'精讲内容版本无效');
 required(audit?.schemaVersion===1&&Array.isArray(audit.units),'来源核对文件版本无效');
 const units=new Map(audit.units.map(unit=>[unit.id,unit]));
 const lessons=authored.lessons.map(raw=>{
  const lesson=copy(raw),unit=units.get(lesson.id);required(unit,`${lesson.id} 缺少来源核对`);
  lesson.sourceRefs=uniqueRefs(unit.sourceRefs||[]);lesson.sourceExcerpts=copy(unit.sourceExcerpts||[]);
  lesson.textbookPage=lesson.sourceRefs.find(ref=>ref.sourceId===GUIDED_BOOKS[0])?.page;
  lesson.questionIds=[unit.originalQuestion.id];lesson.relatedQuestionIds=unique((unit.questionIds||[]).filter(id=>id!==unit.originalQuestion.id));lesson.auditNotes=unique([...(lesson.auditNotes||[]),...(unit.auditNotes||[])]);
  if(lesson.originalLawNote&&!lesson.auditNotes.includes(lesson.originalLawNote))lesson.auditNotes.push(lesson.originalLawNote);
  lesson.originalQuestion=normalizeGuidedQuestion(unit.originalQuestion,lesson,true);
  lesson.variants=(lesson.variants||[]).map(q=>normalizeGuidedQuestion(q,lesson));
  return lesson;
 });
 const baseline={label:'下册历史作答初步归类；仅计已识别且可判分题目，不作为个人错因诊断',verifiedAt:report.verifiedAt,topics:TOPICS.map(name=>{const topic=report.topics?.[name];required(topic,`下册报告缺少 ${name}`);return {name,correct:topic.correct,wrong:topic.wrong,pending:topic.pending,excluded:topic.excluded};}),total:{correct:report.correct,wrong:report.wrong,pending:report.pending,excluded:report.excluded}};
 const bundle={schemaVersion:1,updatedAt:authored.updatedAt,sourceVerifiedAt:audit.verifiedAt,verificationScope:audit.verificationScope,lessons,chapters:copy(audit.chapters||[]),baseline};
 validateGuidedBundle(bundle,db);return bundle;
}

export function validateGuidedBundle(bundle,db){
 required(bundle?.schemaVersion===1&&Array.isArray(bundle.lessons),'精讲数据格式无效');
 required(bundle.lessons.length===15,'首批精讲必须包含 15 个知识点');
 required(new Set(bundle.lessons.map(l=>l.id)).size===15&&GUIDED_IDS.every(id=>bundle.lessons.some(l=>l.id===id)),'精讲知识点编号有遗漏或重复');
 const sources=new Map(db.sources.map(s=>[s.id,s])),records=new Set(db.records.map(r=>r.id)),questionIds=new Set(),covered=new Set();
 const checkRef=(ref,label)=>{if(ref.sourceId){const source=sources.get(ref.sourceId);required(source,`${label} 原资料不存在：${ref.sourceId}`);required(Number.isInteger(ref.page)&&ref.page>=1&&ref.page<=source.pageCount,`${label} 来源页码超界`);for(const region of ref.regions||[])required(['x','y','w','h'].every(k=>Number.isFinite(region[k]))&&region.x>=0&&region.y>=0&&region.w>0&&region.h>0&&region.x+region.w<=1.00001&&region.y+region.h<=1.00001,`${label} 标注越界`);covered.add(ref.sourceId);}else required(/^https:\/\//.test(ref.url||''),`${label} 来源引用无效`);};
 const checkQuestion=(q,label)=>{
  required(text(q.id)&&text(q.stem)&&q.stem.length>8&&!placeholder.test(q.stem),`${label} 题干未完成`);
  required(!questionIds.has(q.id),`${label} 题目编号重复`);questionIds.add(q.id);
  required(Array.isArray(q.options)&&q.options.length===4,`${label} 必须保留完整的四个选项`);
  const keys=q.options.map(o=>o.key);required(new Set(keys).size===keys.length&&keys.every(k=>/^[A-D]$/.test(k)),`${label} 选项编号无效`);
  required(Array.isArray(q.answer)&&q.answer.length>0&&new Set(q.answer).size===q.answer.length&&q.answer.every(key=>keys.includes(key)),`${label} 答案不在选项中`);
  required(text(q.explanation)&&q.explanation.length>=12&&!placeholder.test(q.explanation),`${label} 缺少题目讲解`);
  for(const option of q.options)required(text(option.text)&&option.text.trim().length>1&&!placeholder.test(option.text)&&text(option.explanation)&&option.explanation.length>=8&&!placeholder.test(option.explanation),`${label} ${option.key} 选项或逐项解释未完成`);
  required(new Set(q.options.map(o=>o.explanation)).size===q.options.length,`${label} 逐项解释不能套用同一段文字`);
  for(const ref of q.sourceRefs||[])checkRef(ref,label);
  for(const page of q.originalPages||[]){checkRef({sourceId:page.sourceId,page:page.page,regions:[page.region]},label);required(Number.isFinite(page.width)&&page.width>0&&Number.isFinite(page.height)&&page.height>0,`${label} 原题图尺寸无效`);}
 };
 for(const lesson of bundle.lessons){
  required(records.has(lesson.cardId),`${lesson.id} 原知识卡不存在`);
  for(const field of ['title','category','plain','formal','example','counterexample','mnemonic'])required(text(lesson[field])&&!placeholder.test(lesson[field]),`${lesson.id} 缺少 ${field}`);
  for(const field of ['conditions','checklist','pitfalls'])required(Array.isArray(lesson[field])&&lesson[field].length>=2&&lesson[field].every(text),`${lesson.id} 缺少 ${field}`);
  required(Number.isInteger(lesson.order)&&lesson.order>0,`${lesson.id} 缺少顺序`);
  required(Array.isArray(lesson.sourceRefs)&&lesson.sourceRefs.some(ref=>ref.sourceId===GUIDED_BOOKS[0]&&ref.page===lesson.textbookPage),`${lesson.id} 缺少准确教材页`);
  lesson.sourceRefs.forEach(ref=>checkRef(ref,lesson.id));
  required(lesson.sourceExcerpts?.some(excerpt=>excerpt.sourceId===GUIDED_BOOKS[0]&&excerpt.status==='verified'&&text(excerpt.quote)),`${lesson.id} 缺少已核对教材原文`);
  for(const excerpt of lesson.sourceExcerpts){checkRef(excerpt,lesson.id);required(text(excerpt.quote),`${lesson.id} 原文摘录为空`);}
  required(lesson.originalQuestion?.verificationStatus==='verified',`${lesson.id} 原题尚未校准`);
  required(records.has(lesson.originalQuestion.id)&&lesson.questionIds.includes(lesson.originalQuestion.id),`${lesson.id} 原题关联不存在`);
  required(lesson.questionIds.every(id=>records.has(id)),`${lesson.id} 相关原题编号不存在`);
  const original=db.records.find(record=>record.id===lesson.originalQuestion.id);
  required(answerArray(original.details?.question?.referenceAnswer).sort().join('')===[...lesson.originalQuestion.answer].sort().join(''),`${lesson.id} 导学答案与原刷题记录不一致，请先完成来源校准`);
  checkQuestion(lesson.originalQuestion,`${lesson.id} 原题`);
  required(lesson.variants?.length===2,`${lesson.id} 必须有两道原创变式`);lesson.variants.forEach(q=>{required(q.id.startsWith('guided-'+lesson.id+'-'),`${lesson.id} 变式编号必须使用独立命名空间`);const existing=db.records.find(record=>record.id===q.id);required(!existing||existing.details?.guidedLessonId===lesson.id,`${lesson.id} 变式编号与旧记录冲突`);checkQuestion(q,`${lesson.id} 变式`);});
  const existingKnowledge=db.records.find(record=>record.id==='guided-lesson-'+lesson.id);required(!existingKnowledge||existingKnowledge.details?.guidedLessonId===lesson.id,`${lesson.id} 精讲卡编号与旧记录冲突`);
  required(Array.isArray(lesson.laws),`${lesson.id} 缺少依据字段`);
  if(['charts','data-collision'].includes(lesson.id))required(lesson.laws.length===0,`${lesson.id} 分析方法不应硬配法条`);
  else required(lesson.laws.length>0,`${lesson.id} 缺少法规依据`);
  for(const law of lesson.laws){let url;try{url=new URL(law.url);}catch{}required(url?.protocol==='https:'&&/(^|\.)gov\.cn$/.test(url.hostname),`${lesson.id} 法规须使用官方原文链接`);for(const key of ['title','articles','quote','effective','checkedAt'])required(text(law[key]),`${lesson.id} 法规缺少 ${key}`);required(/^\d{4}-\d{2}-\d{2}$/.test(law.checkedAt),`${lesson.id} 法规核验日期无效`);}
 }
 required(bundle.chapters?.length===3&&GUIDED_BOOKS.every(id=>bundle.chapters.some(book=>book.sourceId===id)),'必须提供三份教材的章节入口');
 for(const book of bundle.chapters){required(book.sections?.length>0,`${book.title} 缺少章节`);for(const section of book.sections){checkRef({sourceId:book.sourceId,page:section.page},book.title);required(text(section.title)&&Array.isArray(section.lessonIds)&&section.lessonIds.every(id=>GUIDED_IDS.includes(id)),`${book.title} 章节关联无效`);}}
 required(GUIDED_BOOKS.every(id=>covered.has(id)),'来源没有覆盖三份教材');
 return {lessons:15,variants:30,originals:15,sources:covered.size};
}

function lessonBody(lesson){
 const lines=[`## 换成大白话\n${lesson.plain}`,`## 正式概念\n${lesson.formal}`,`## 判断条件\n${lesson.conditions.map(s=>'- '+s).join('\n')}`,`## 用例子理解\n${lesson.example}`,`## 换个条件\n${lesson.counterexample}`,`## 给自己的提醒\n${lesson.mnemonic}`,`## 容易踩的坑\n${lesson.pitfalls.map(s=>'- '+s).join('\n')}`,`## 合上教材再复述\n${lesson.checklist.map(s=>'- '+s).join('\n')}`,`## 原资料摘录\n${lesson.sourceExcerpts.map(s=>`### ${s.label} · PDF第${s.page}页\n${s.quote}\n\n[定位原页](#/source/${s.sourceId}?page=${s.page})`).join('\n\n')}`];
 if(lesson.laws.length)lines.push(`## 法规与版本\n${lesson.laws.map(law=>`### ${law.title} · ${law.articles}\n${law.quote}\n\n[官方原文](${law.url}) · ${law.effective} · 核验 ${law.checkedAt}${law.note?'\n\n'+law.note:''}`).join('\n\n')}`);
 else lines.push('## 教学依据\n这是教材中的分析方法，依据上方原资料，不对应单一法条。');
 lines.push(`## 开始引导复盘\n[进入这个知识点](#/guided-review?lesson=${lesson.id})`);return lines.join('\n\n');
}
function legalBasis(lesson){return lesson.laws.map(l=>({title:l.title,url:l.url,article:l.articles,quote:l.quote,verification:`核验 ${l.checkedAt}；适用 ${l.effective}${l.note?'；'+l.note:''}`}));}
function questionTeaching(lesson,q){
 const basis=legalBasis(lesson),body=`## 本题怎样判断\n${q.explanation}\n\n${lesson.originalLawNote&&q.id===lesson.originalQuestion.id?lesson.originalLawNote+'\n\n':''}${lessonBody(lesson)}`;
 return {optionExplanations:Object.fromEntries(q.options.map(option=>[option.key,{text:option.explanation,status:'已逐项核对／平台编写',basis}])),optionAuditStatus:'已逐项核对／平台编写',tutorial:{version:1,authored:{key:lesson.id,title:lesson.title,origin:'依据定点教材原文与官方法规编写',scope:'本题逐项判断、知识点理解与跨情境练习',verifiedAt:lesson.checkedAt||'2026-10-15',body,sources:basis},materials:[{id:'guided-lesson-'+lesson.id,title:lesson.title,provenance:'带我复盘精讲资料',verificationStatus:'原页定点核对；原创解释分别标注',body:`${lesson.plain}\n\n${lesson.mnemonic}`,sourceRefs:lesson.sourceRefs}]} };
}

export function buildGuidedRecords(bundle,db){
 const created=[],anchors=[],date=(bundle.updatedAt||'2026-10-15').slice(0,10);
 for(const lesson of bundle.lessons){
  const knowledgeId='guided-lesson-'+lesson.id,body=lessonBody(lesson),common={subject:'gongan',topic:lesson.category,date,sourceRefs:lesson.sourceRefs,verificationStatus:'首批精讲：定点原文与逐项解释已核对'};
  created.push({...common,id:knowledgeId,kind:'knowledge',title:lesson.title,body,tags:['带我复盘','知识点精讲','大白话'],links:unique([lesson.cardId,...lesson.questionIds,...lesson.variants.map(q=>q.id)]),details:{guidedLessonId:lesson.id,authored:{plain:lesson.plain,conditions:lesson.conditions,example:lesson.example,counterexample:lesson.counterexample,mnemonic:lesson.mnemonic},sourceExcerpts:lesson.sourceExcerpts,laws:lesson.laws},aiContent:{type:'平台原创教学解释与例子',derivedFrom:lesson.cardId,verifiedAt:date}});
  lesson.variants.forEach((q,index)=>{
   const type=q.answer.length>1?'multi':'single',parent=db.records.find(r=>r.id===lesson.originalQuestion.id),teaching=questionTeaching(lesson,q);
   created.push({...common,id:q.id,kind:'practice',title:`原创巩固 · ${lesson.title} ${index+1}`,body:q.stem,tags:['刷题','自编巩固题','带我复盘'],links:[knowledgeId,lesson.cardId,lesson.originalQuestion.id],studyQuestion:{bank:'reinforcement',chapter:parent.studyQuestion?.chapter||0,chapterName:lesson.category,sectionId:parent.studyQuestion?.sectionId||lesson.id,sectionName:lesson.category,type,number:lesson.order*2-1+index,promptPreview:q.stem.slice(0,180),origin:'generated',parentId:lesson.originalQuestion.id,knowledgeKey:lesson.cardId},details:{guidedLessonId:lesson.id,question:{type,prompt:q.stem,options:Object.fromEntries(q.options.map(o=>[o.key,o.text])),referenceAnswer:q.answer.join(''),parentId:lesson.originalQuestion.id,answerCardId:knowledgeId,origin:'generated',explanation:{category:lesson.category,keyCondition:q.explanation,diagnosis:q.explanation,memory:lesson.mnemonic,legalBasis:legalBasis(lesson)},...teaching}},aiContent:{type:'自编巩固练习',derivedFrom:lesson.originalQuestion.id,verifiedAt:date}});
  });
  const original=db.records.find(r=>r.id===lesson.originalQuestion.id);
  anchors.push({id:original.id,content:{knowledgeKey:lesson.cardId,guidedKnowledgeId:knowledgeId,teaching:{explanation:{category:lesson.category,keyCondition:lesson.originalQuestion.explanation,diagnosis:lesson.originalQuestion.explanation,memory:lesson.mnemonic,legalBasis:legalBasis(lesson)},...questionTeaching(lesson,lesson.originalQuestion)}},lessonId:lesson.id});
 }
 return {created,anchors};
}

export function mergeGuidedRecords(db,bundle){
 const {created,anchors}=buildGuidedRecords(bundle,db),result={added:0,updated:0,anchors:0,conflicts:0,unchanged:0};
 db.conflicts||=[];db.archives||=[];
 function install(incoming,contentHash,anchor=false){
  const old=db.records.find(record=>record.id===incoming.id);
  if(old?.guidedContentHash===contentHash){result.unchanged++;return;}
  if(old?.edited){if(!db.conflicts.some(c=>c.recordId===old.id&&c.incoming?.guidedContentHash===contentHash)){db.conflicts.push({id:'guided-conflict-'+hash(old.id+contentHash).slice(0,24),recordId:old.id,at:now(),origin:'guided-review',incoming:{...incoming,guidedContentHash:contentHash}});result.conflicts++;}return;}
  const row={...incoming,guidedContentHash:contentHash,revision:(old?.revision||0)+1,createdAt:old?.createdAt||bundle.updatedAt,updatedAt:bundle.updatedAt};
  if(old){db.archives.push({recordId:old.id,at:now(),record:copy(old)});db.records[db.records.indexOf(old)]=row;result[anchor?'anchors':'updated']++;}else{db.records.push(row);result.added++;}
 }
 for(const record of created)install(record,hash(record));
 for(const anchor of anchors){const old=db.records.find(record=>record.id===anchor.id);install({...old,links:unique([...(old.links||[]),anchor.content.guidedKnowledgeId]),studyQuestion:{...old.studyQuestion,knowledgeKey:anchor.content.knowledgeKey},details:{...old.details,guidedLessonId:anchor.lessonId,question:{...old.details.question,...anchor.content.teaching}}},hash(anchor.content),true);}
 return result;
}

export function installGuided({dataDir=DATA,dryRun=false}={}){
 const readJSON=name=>JSON.parse(fs.readFileSync(path.join(dataDir,name),'utf8'));
 const platformPath=path.join(dataDir,'platform.json'),bundlePath=path.join(dataDir,'guided-lessons.json'),oldPlatform=fs.readFileSync(platformPath,'utf8'),oldBundle=fs.readFileSync(bundlePath,'utf8'),db=JSON.parse(oldPlatform);
 const bundle=assembleGuidedBundle(JSON.parse(oldBundle),readJSON('guided-source-audit.json'),db,readJSON('lower-study-report.json'));
 const result=mergeGuidedRecords(db,bundle),bundleChanged=hash(JSON.parse(oldBundle))!==hash(bundle),changed=!!(result.added+result.updated+result.anchors+result.conflicts)||bundleChanged;
 if(!changed||dryRun)return {...result,bundleChanged,changed,dryRun,version:db.version,lessons:15,variants:30};
 const backupName=`snapshot-${now().replace(/[:.]/g,'-')}-${db.version}-guided.json`;
 atomic(path.join(dataDir,'backups',backupName),oldPlatform);db.version++;db.updatedAt=now();
 try{atomic(platformPath,db);atomic(bundlePath,bundle);}catch(error){atomic(platformPath,oldPlatform);atomic(bundlePath,oldBundle);throw error;}
 return {...result,bundleChanged,changed,dryRun:false,version:db.version,backup:backupName,lessons:15,variants:30};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(installGuided({dryRun:process.argv.includes('--dry-run')||process.argv.includes('--check')})));
