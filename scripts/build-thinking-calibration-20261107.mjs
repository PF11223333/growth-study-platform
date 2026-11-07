import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {ROOT,DATA,hash,mergeImported,validateRecord,publicClean,atomic} from '../server/store.mjs';
import {gradeQuestion} from '../src/drill-state.mjs';

export const THINKING_DATE='2026-11-07';
export const THINKING_SOURCE='source-adaa1c70c42f855e5cb0b163';
export const THINKING_BANK='police-thinking-20261105';
export const INPUT_NAMES=['criminal-skills','public-emergency','information','patrol'];
const keys=['criminal','public','information','patrol','emergency','skills'];
const typeNames={single:'单选',multi:'多选',case:'情景'};
const letters=['A','B','C','D'];
const whole={x:0,y:0,w:1,h:1};
const origin='thinking-calibration-20261107';
const uniq=values=>[...new Set(values)];
const sourceRef=(page,label,regions=[])=>({sourceId:THINKING_SOURCE,page,label,regions});
const identity=q=>`${q.chapter}:${q.sectionType}:${q.number}`;
const cleanAnswer=value=>String(value??'').trim();
const isExcluded=q=>!!(q.gradingExcluded||q.gradingExcludedRecommendation||!q.answer);

function basisFor(source){
 const result=structuredClone(source);
 if(result.url&&!/^https?:\/\//i.test(result.url)){
  const match=result.url.match(/^#\/source\/([^?]+)\?page=(\d+)/);
  assert.ok(match,`无法识别的教材定位 ${result.url}`);
  result.sourceId||=match[1];result.page||=Number(match[2]);
 }
 if(result.sourceId&&!result.page)result.page=result.pages?.[0];
 return result;
}

function evidenceText(value){
 if(typeof value==='string')return value.trim();
 if(!value||typeof value!=='object')return '';
 if(Array.isArray(value))return uniq(value.map(evidenceText).filter(Boolean)).join('；');
 const parts=[value.reason,value.note,value.description,value.literalAnswer?`按题面推算：${value.literalAnswer}`:'',value.bookAnswer?`题册所列：${value.bookAnswer}`:''].map(evidenceText).filter(Boolean);
 return parts.length?uniq(parts).join('；'):JSON.stringify(value);
}

function images(pages,regions,manifest){
 return uniq(pages||[]).flatMap(page=>{
  const metadata=manifest.pages.find(item=>item.page===page);assert.ok(metadata,`缺少第${page}页预览元数据`);
  const matching=(regions||[]).filter(region=>region.page===page);
  return (matching.length?matching:[whole]).map(({x,y,w,h})=>{
   const region={x,y,w,h};assert.ok(Object.values(region).every(Number.isFinite)&&x>=0&&y>=0&&w>0&&h>0&&x+w<=1.00001&&y+h<=1.00001,`区域越界：${page}`);
   return {sourceId:THINKING_SOURCE,page,width:metadata.width,height:metadata.height,region,previewSuffix:'-hd'};
  });
 });
}

function validateInputs(questions,index){
 assert.equal(questions.length,338,'全册应有338道独立原题');
 assert.equal(new Set(questions.map(identity)).size,338,'出现重复原题标识');
 for(const [i,chapter]of index.entries())for(const section of chapter.sections){
  const rows=questions.filter(q=>q.chapter===i+1&&q.sectionType===section.type).sort((a,b)=>a.number-b.number);
  assert.equal(rows.length,section.questionCount,`${chapter.title}/${section.type} 数量不符`);
  assert.deepEqual(rows.map(q=>q.number),Array.from({length:section.questionCount},(_,n)=>n+1));
  for(const q of rows){
   assert.equal(q.answerPage,section.answerPage);assert.ok(q.pages.length>0);
   assert.ok(q.pages.every(p=>Number.isInteger(p)&&p>=section.startPage&&p<section.answerPage),`${identity(q)} 原页超出章节范围`);
   assert.deepEqual(Object.keys(q.options).sort(),letters);assert.deepEqual(Object.keys(q.optionExplanations).sort(),letters);
   assert.ok(q.prompt&&q.lead&&q.memory);assert.ok(q.basis.length);
   assert.match(cleanAnswer(q.bookAnswer),/^[A-D]{1,4}$/);
   if(!isExcluded(q))assert.match(cleanAnswer(q.answer),/^[A-D]{1,4}$/);
   if(q.answer&&q.answer!==q.bookAnswer)assert.ok(q.versionNote||q.answerConflict||q.uncertainties?.length,`${identity(q)} 答案差异没有说明`);
   for(const k of letters){assert.ok(q.options[k]?.trim());assert.ok(q.optionExplanations[k]?.trim().length>=10);assert.ok(q.optionBasis[k]?.length);for(const n of q.optionBasis[k])assert.ok(Number.isInteger(n)&&n>=0&&n<q.basis.length);}
  }
 }
 const groups=new Map();for(const q of questions.filter(q=>q.sectionType==='case')){const key=`${q.chapter}:${q.caseGroup}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(q);}
 for(const [key,group]of groups){assert.ok(group.every(q=>q.scenarioText&&q.scenarioPages?.length),`${key} 缺少共用材料`);assert.equal(new Set(group.map(q=>q.scenarioText)).size,1,`${key} 同组情景文字不一致`);assert.deepEqual(group.map(q=>q.caseOrder).sort((a,b)=>a-b),Array.from({length:group.length},(_,i)=>i+1));}
 return groups;
}

/** Build only a reviewable import candidate; never mutate the live platform or progress. */
export function buildThinkingCalibration({packets,index,existingRecords,selectedRecords,manifest,basePlatform}){
 const questions=packets.flatMap(packet=>packet.questions).sort((a,b)=>a.chapter-b.chapter||['single','multi','case'].indexOf(a.sectionType)-['single','multi','case'].indexOf(b.sectionType)||a.number-b.number);
 const groups=validateInputs(questions,index),existing=new Map(existingRecords.map(row=>[row.id,row]));
 const selectedMap=new Map(selectedRecords.map(row=>[`${row.studyQuestion.chapter}:single:${row.studyQuestion.number}`,row.id]));
 assert.equal(selectedMap.size,13,'应保留原13道题的ID');
 const records=questions.map(item=>{
  const section=keys[item.chapter-1],chapter=index[item.chapter-1],chapterId=chapter.recordId;
  const id=selectedMap.get(identity(item))||`nov-20261105-thinking-${section}-${item.sectionType[0]}${String(item.number).padStart(2,'0')}`;
  const previous=existing.get(id),excluded=isExcluded(item),caseKey=item.sectionType==='case'?`${item.chapter}:${item.caseGroup}`:'';
  const group=caseKey?groups.get(caseKey):[],caseId=caseKey?`thinking-${item.chapter}-case-${item.caseGroup}`:'';
  const type=item.sectionType!=='case'?item.sectionType:item.questionType||(/多选|多项选择/.test(item.prompt)?'multi':/单选|单项选择/.test(item.prompt)?'single':'');
  assert.ok(['single','multi'].includes(type),`${identity(item)} 缺少原题单多选依据，不能按答案字母数量猜题型`);
  if(!excluded&&type==='single')assert.equal(item.answer.length,1,`${identity(item)} 单选答案不符`);
  const normalizedBasis=item.basis.map(basisFor),external=normalizedBasis.filter(b=>/^https?:\/\//i.test(b.url||''));
  const questionPages=images(item.pages,item.regions,manifest);
  // Keep one shared set of context pages for every child, including a chart on a later page.
  const contextPageNumbers=uniq(group.flatMap(q=>q.scenarioPages||[])).sort((a,b)=>a-b);
  const contextRegions=group.flatMap(q=>q.scenarioRegions||[]).filter((r,i,all)=>all.findIndex(v=>JSON.stringify(v)===JSON.stringify(r))===i);
  const contextPages=images(contextPageNumbers,contextRegions,manifest);
  const sourceRefs=[...questionPages.map(p=>sourceRef(p.page,'原题与手写笔记',[p.region])),...contextPageNumbers.filter(p=>!item.pages.includes(p)).map(p=>sourceRef(p,'本组共用情景材料')),sourceRef(item.answerPage,'答后核对：题册答案表'),...external.map(b=>({url:b.url,label:b.title+(b.article?' · '+b.article:'')}))];
  const uncertainty=uniq([...(item.uncertainties||[]),...(item.answerConflict?[item.answerConflict]:[])].map(evidenceText).filter(Boolean)).join('\n\n');
  const genericExclusion='原题或教辅答案存在尚未解决的差异。请在查看核对说明后对照原文学习，本题不写入对错和掌握统计。';
  const afterAnswer=`题册答案：${item.bookAnswer}。${excluded?'校准结果：待确认，本题不判分。':`校准参考答案：${item.answer}。`}`;
  const originalLinks=item.pages.map(p=>`[原题 PDF 第 ${p} 页](#/source/${THINKING_SOURCE}?page=${p})`).join(' · ');
  const teachingBody=`## 本题怎样判断\n\n${item.lead}\n\n## 大白话记住\n\n${item.memory}\n\n## 题册答案与校准\n\n${afterAnswer}${uncertainty?'\n\n'+uncertainty:''}${item.versionNote?'\n\n## 适用版本与边界\n\n'+item.versionNote:''}\n\n## 回到教材原页\n\n${originalLinks} · [答案表 PDF 第 ${item.answerPage} 页](#/source/${THINKING_SOURCE}?page=${item.answerPage})\n\n红笔为原作答、蓝笔为订正。本轮没有把未确认的历史笔迹自动计入个人错题；逐项解析和记忆提示为依据原题与所列来源编写。`;
  const assisted=!!item.requiresImage||contextPages.length>0;
  const question={...(previous?.details?.question||{}),origin:'source-scan',type,prompt:item.prompt,options:item.options,referenceAnswer:excluded?'':item.answer,bookAnswer:item.bookAnswer,verifiedText:true,textVerified:true,textStatus:item.textStatus||item.transcriptionStatus||'已逐页核对原文',readingAvailability:'verified-text',requiresImage:!!item.requiresImage,hideOriginalUntilAnswer:!item.requiresImage,originalPages:questionPages,contextPages,contextTextVerified:!!caseKey,fullContextText:item.scenarioText||'',contextText:item.scenarioText||'',previewNote:'原题原图保留笔迹，可能看见过去的作答或订正；不作为无提示独立掌握证据',assistedSource:assisted,gradingExcluded:excluded,gradingExclusionReason:excluded?genericExclusion:'',answerVerificationStatus:excluded?'conflict-pending':'verified-source-and-reasoning',answerConflict:excluded?'本题有待确认差异，具体题册答案、争议与依据见答后核对说明。':'',answerConflictResolved:false,answerScope:item.answerSourceNote||`题册PDF第${item.answerPage}页答案表已核对；教辅答案并非考试机关官方发布答案。`,answerSourceNote:item.answerSourceNote||'以用户上传题册、题中图表与所列已核对来源校准；不冒充官方试题解析。',currentLawNote:[item.versionNote,assisted?'本题显示原资料图像，其中可能保留答案笔迹；本次是有原资料辅助的练习，不能仅据一次答对判断独立掌握。':''].filter(Boolean).join('\n'),attention:item.memory,optionExplanations:Object.fromEntries(letters.map(k=>[k,{text:item.optionExplanations[k],status:'已逐项核对；解释为编写',basis:item.optionBasis[k].map(n=>normalizedBasis[n])}])),explanation:{category:chapter.title,keyCondition:item.lead,memory:item.memory,diagnosis:'请对照所选项与解析，由本人确认实际错因；不能根据答案字母自动推断为粗心或记忆差。',legalBasis:external.filter(b=>b.kind==='law')},tutorial:{version:2,authored:{key:id,title:item.lead,origin:item.explanationOrigin||'依据原题、题册答案与所列资料编写',scope:'本题逐项判断与规则应用',verifiedAt:THINKING_DATE,body:teachingBody,sources:normalizedBasis},materials:[{id:chapterId,title:chapter.title+' · 原题与共用材料',provenance:'用户上传教材原页',verificationStatus:'原页位置已核对；解释与笔记分别保留',body:'本题原文、图表及共用材料见下方来源入口。章节卡保留原有知识点和学习记录。',sourceRefs:sourceRefs.filter(ref=>ref.sourceId&&ref.page!==item.answerPage)}]},answerEvidence:{sourceId:THINKING_SOURCE,pages:[item.answerPage],bookAnswer:item.bookAnswer,calibratedAnswer:excluded?'':item.answer,status:excluded?'待确认，不判分':'原题及题册答案逐项校准',uncertainties:item.uncertainties||[],conflictDetail:item.answerConflict||'',verifiedAt:THINKING_DATE},sourceAudit:{checkedAt:THINKING_DATE,imageStatus:'available',textStatus:item.textStatus||item.transcriptionStatus||'题干、选项与图表已逐页核对',scope:'本题及共用情景材料；原页笔迹保留，个人历史选择不自动推断'}};
  // Old lookup-only fields must not retain a stale answer or an unrelated lesson.
  delete question.answer;delete question.answerKey;
  const title=`${chapter.title} · ${typeNames[item.sectionType]}${item.sectionType==='case'?` ${item.caseGroup}-${item.caseOrder}`:`第${item.number}题`} · 原题与逐项讲解`;
  const row={...previous,id,legacyId:previous?.legacyId||id,origin,kind:'practice',subject:'gongan',topic:chapter.title,title,date:previous?.date||THINKING_DATE,tags:uniq([...(previous?.tags||[]),'公安思维提升','逐项讲解',typeNames[item.sectionType],...(excluded?['答案待确认']:[])]),body:item.prompt,sourceRefs,links:uniq([...(previous?.links||[]),chapterId,`thinking-page-group-20261106-${item.chapter}-${item.sectionType}`]),revision:previous?.revision||1,verificationStatus:excluded?'原题及逐项解释已核对；答案争议待确认':'原题、答案表及逐项解释已核对；解释为编写',studyQuestion:{...(previous?.studyQuestion||{}),bank:THINKING_BANK,chapter:item.chapter,chapterName:chapter.title,sectionId:section,sectionName:chapter.title,type,originalSectionType:item.sectionType,number:item.number,originalNumber:item.caseOrder||item.number,promptPreview:item.prompt.slice(0,180),gradingExcluded:excluded,gradingExclusionReason:excluded?genericExclusion:'',needsConfirmation:excluded,historicalWrong:previous?.studyQuestion?.historicalWrong||false,historicalCorrect:previous?.studyQuestion?.historicalCorrect||false,assistedSource:assisted,knowledgeKey:chapterId,...(caseKey?{caseGroupId:caseId,caseGroupOrder:item.caseOrder,caseNumber:item.caseGroup,caseIndex:item.caseOrder,caseCount:group.length,caseTitle:`${chapter.title} · 第${item.caseGroup}组情景`,groupType:'case'}:{})},details:{...(previous?.details||{}),question,calibration:{batch:origin,checkedAt:THINKING_DATE,chapter:item.chapter,sectionType:item.sectionType,number:item.number,bookAnswer:item.bookAnswer,uncertainties:item.uncertainties||[],independentOriginalQuestion:true},originalContent:{provenance:'原教材与笔迹保留；本题文字经过逐页核对',sourceId:THINKING_SOURCE,pages:item.pages,scenarioPages:contextPageNumbers,answerPage:item.answerPage},authoredContent:{provenance:'逐项解释与记忆提示为编写',body:teachingBody}}};
  delete row.importHash;delete row.studyQuestion.referenceAnswer;delete row.studyQuestion.sameSourceDuplicate;
  return row;
 });
 const questionRecords=[...records],recordLinkPatches=[];
 for(const [i,chapter]of index.entries()){
  const chapterRows=questionRecords.filter(row=>row.studyQuestion.chapter===i+1),pageIds=[];
  for(const section of chapter.sections){
   const id=`thinking-page-group-20261106-${i+1}-${section.type}`,old=existing.get(id);assert.ok(old,`缺少原页组 ${id}`);pageIds.push(id);
   const related=chapterRows.filter(row=>row.studyQuestion.originalSectionType===section.type),pending=related.filter(row=>row.studyQuestion.gradingExcluded).length;
   const row=structuredClone(old),note=`本组${related.length}道原题已全部建立独立题目和逐项讲解，${related.length-pending}道可判分${pending?`，${pending}道保留争议说明、暂不判分`:''}。这里保留连续原页入口，不再把原页组重复计为一道题。`;
   const links=related.map(r=>`[${typeNames[section.type]} ${r.studyQuestion.number}](#/record/${r.id})`).join(' · ');
   const body=`## 本题怎样判断\n\n${note}\n\n## 选择练习方式\n\n[进入本章随机刷题](#/drill?bank=${THINKING_BANK}&chapter=${i+1}&type=${section.type}&order=random&autostart=1) · [按章节查题](#/bank/${THINKING_BANK}?chapter=${i+1})\n\n情景题按组连续；含待确认小题的整组在计分队列中暂不启用，可在查题页逐题阅读。原页保留红蓝笔迹，只作阅读回忆；与独立题目是同一来源，不重复增加掌握证据。\n\n## 本组独立题目\n\n${links}\n\n## 原页与答案表\n\n${row.details.question.pageGroup.pages.map(page=>`[PDF 第${page}页](#/source/${THINKING_SOURCE}?page=${page})`).join(' · ')}\n\n[答后核对：PDF 第${section.answerPage}页答案表](#/source/${THINKING_SOURCE}?page=${section.answerPage})`;
   row.body=body;row.links=uniq([...row.links,...related.map(r=>r.id)]);row.verificationStatus='逐题校准入口已更新；原页阅读组继续不计分';row.studyQuestion.promptPreview=note;row.studyQuestion.needsConfirmation=pending>0;
   row.details.selectedQuestionIds=related.map(r=>r.id);row.details.calibration={batch:origin,independentQuestions:related.length,pendingQuestions:pending};
   row.details.question.prompt=note;row.details.question.hideOriginalUntilAnswer=false;row.details.question.gradingExclusionReason='原页组是连续阅读入口，不作为新的独立题计分。';row.details.question.sourceAudit={...row.details.question.sourceAudit,checkedAt:THINKING_DATE,textStatus:'本组独立题目与逐项讲解入口已建立；争议题保留待确认'};
   row.details.question.tutorial.authored={...row.details.question.tutorial.authored,verifiedAt:THINKING_DATE,body};row.details.authoredContent={provenance:'校准后阅读与练习指引',body};delete row.importHash;records.push(row);
  }
  recordLinkPatches.push({recordId:chapter.recordId,appendLinks:uniq([...pageIds,...chapterRows.map(r=>r.id)])});
 }
 const excluded=questionRecords.filter(r=>r.studyQuestion.gradingExcluded);
 return {schemaVersion:1,date:THINKING_DATE,importId:origin,...(basePlatform?{basePlatform}:{}),records,sources:[],recordLinkPatches,summary:{sourceQuestionsRepresented:338,independentQuestions:338,existingQuestionIdsPreserved:13,newIndependentQuestions:325,pageGroups:18,gradableQuestions:338-excluded.length,pendingQuestions:excluded.length,scenarioGroups:groups.size,scenarioQuestions:questions.filter(q=>q.sectionType==='case').length,excludedQuestionIds:excluded.map(r=>r.id),inputAudits:packets.map(p=>p.audit),newMediaBytes:0}};
}

export function loadThinkingCalibrationInputs(){
 const folder=path.join(ROOT,'output','thinking-calibration-20261107'),materials=path.join(ROOT,'output','materials-20261105');
 const packets=INPUT_NAMES.map(name=>JSON.parse(fs.readFileSync(path.join(folder,name+'.json'),'utf8')));
 const platformBytes=fs.readFileSync(path.join(DATA,'platform.json')),db=JSON.parse(platformBytes.toString('utf8'));
 return {db,basePlatform:{version:db.version,hash:hash(platformBytes)},packets,index:JSON.parse(fs.readFileSync(path.join(materials,'thinking-question-index.json'),'utf8')),existingRecords:db.records,selectedRecords:JSON.parse(fs.readFileSync(path.join(materials,'thinking-selected-records.json'),'utf8')),manifest:JSON.parse(fs.readFileSync(path.join(DATA,'previews',THINKING_SOURCE,'manifest.json'),'utf8'))};
}

export function applyThinkingCandidateToCopy(db,candidate){
 const copy=structuredClone(db),result=mergeImported(copy,structuredClone(candidate.records));
 for(const patch of candidate.recordLinkPatches){const row=copy.records.find(r=>r.id===patch.recordId);assert.ok(row,`缺少章节卡${patch.recordId}`);row.links=uniq([...(row.links||[]),...patch.appendLinks]);}
 return {db:copy,result};
}

export function generateThinkingCalibration(){
 const protectedFiles=['platform.json','drill-progress.json','guided-review.json'].map(name=>path.join(DATA,name)).filter(fs.existsSync);
 const before=new Map(protectedFiles.map(file=>[file,hash(fs.readFileSync(file))]));
 const inputs=loadThinkingCalibrationInputs(),candidate=buildThinkingCalibration(inputs),first=applyThinkingCandidateToCopy(inputs.db,candidate);
 for(const row of candidate.records){
  validateRecord(row,first.db,row);
  const q=row.details.question;if(q.gradingExcluded)assert.equal(gradeQuestion(q,'ABCD'),null);
  for(const p of [...q.originalPages,...(q.contextPages||[])])assert.ok(fs.existsSync(path.join(DATA,'previews',p.sourceId,`${p.page}${p.previewSuffix}.webp`)),`原图缺失 ${p.page}`);
 }
 const second=applyThinkingCandidateToCopy(first.db,candidate);assert.equal(second.result.added+second.result.updated+second.result.conflicts,0,'重复合并不得改变数据');assert.equal(hash(first.db),hash(second.db));
 assert.equal(JSON.stringify(publicClean(candidate)),JSON.stringify(candidate),'候选包含本机路径或敏感字段');
 for(const[file,digest]of before)assert.equal(hash(fs.readFileSync(file)),digest,'生产数据不得被候选生成器写入');
 const output=path.join(DATA,'thinking-calibration-20261107-candidate.json');atomic(output,candidate);
 return {output,candidateHash:hash(fs.readFileSync(output)),...candidate.summary,inputAudits:undefined,firstMerge:first.result,repeatMerge:second.result,productionUnchanged:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(generateThinkingCalibration(),null,2));
