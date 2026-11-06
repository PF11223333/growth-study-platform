import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {ROOT,DATA,hash,read,mergeImported,validateRecord,publicClean,atomic} from '../server/store.mjs';
import {gradeQuestion} from '../src/drill-state.mjs';

const DATE='2026-11-06',SID='source-adaa1c70c42f855e5cb0b163';
const labels={single:'单选原页组',multi:'多选原页组',case:'情景原页组'};
const ref=(page,label)=>({sourceId:SID,page,label,regions:[]});
export function buildThinkingPageGroups(index,selected,manifest){
 const records=[],recordLinkPatches=[];
 for(const [ci,chapter] of index.entries()){
  const ids=[];
  for(const [si,section] of chapter.sections.entries()){
   const next=chapter.sections[si+1];
   // Section starts share pages with the end of the preceding section.
   // E.g. PDF 73 contains the last single question AND the multi heading,
   // and PDF 74 completes the multi question before starting the cases.
   // Include the shared boundary page, then tell the reader where to stop.
   const start=section.startPage,end=next?next.startPage:section.answerPage-1;
   const id=`thinking-page-group-20261106-${ci+1}-${section.type}`;ids.push(id);
   const label=labels[section.type],pages=Array.from({length:end-start+1},(_,i)=>start+i);
   const selectedIds=selected.filter(r=>r.studyQuestion.chapter===ci+1&&r.studyQuestion.type===section.type).map(r=>r.id);
   const rangeNote=next?`本组从“${section.label}”标题开始，读到下一题型标题前停止。第${end}页与下一题型共用，保留它以免上一题的选项或图表被截掉。`:'本组保留连续情景材料和全部子题。按原书“（一）（二）……”整组阅读，不把不同情景的子题拆散。';
   const pageGroup={sourceId:SID,startPage:start,endPage:end,answerPage:section.answerPage,questionCount:section.questionCount,sectionType:section.type,label,rangeNote,pages};
   const instruction=`这是原页组练习，不是新增的${section.questionCount}道精校题。范围为PDF第${start}—${end}页；原书本题型共${section.questionCount}道${section.type==='case'?'子题':'题'}。${rangeNote} 原图保留红蓝笔迹，可能看见你原来的选择或订正；本轮只做阅读回忆，不计正确率。`;
   const pageLinks=pages.map(p=>`[PDF第${p}页](#/source/${SID}?page=${p})`).join(' · ');
   const answerLink=`[打开本章答案表：PDF第${section.answerPage}页](#/source/${SID}?page=${section.answerPage})`;
   const body=`## 怎样练这一组\n\n${instruction}\n\n1. 打开第一原页，先自己在纸上记“原题号＋选项＋一句理由”。\n2. 遇到跨页题，继续翻页看全图表与选项；情景题先读共用材料，再依次做子题。\n3. 做完后打开答案表，先核对本章、本题型、情景序号与题号，不能只按页码附近的字母配答案。\n4. 红笔作答、蓝笔订正和卷末答案若不一致，先留下疑问，不把颜色本身当作已校验结果。\n\n## 本组连续原页\n\n${pageLinks}\n\n## 做完再核对\n\n${answerLink}\n\n卷末答案是题册依据，未代表每道题已经完成文字、手写选择、现行法规与逐项解析核验。本组不写入作答次数、错题或掌握率。${selectedIds.length?`本组中已有${selectedIds.length}道另列的精校题；同源重复练习不是新的独立掌握证据。`:''}`;
   const first=manifest.pages.find(p=>p.page===start);assert.ok(first);
   const question={origin:'source-scan',type:'recall',prompt:instruction,options:{},referenceAnswer:'',verifiedText:false,requiresImage:true,previewNote:'原始页面含笔迹；本入口只预览起页，整组请逐页阅读',originalPages:[{sourceId:SID,page:start,width:first.width,height:first.height,region:{x:0,y:0,w:1,h:1},previewSuffix:'-hd'}],pageGroup,gradingExcluded:true,gradingExclusionReason:'这是按题型组织的原页组，尚未逐题校准，整组不判分。',answerScope:'请按本章、题型、情景序号和原题号核对答案表，不能把这一组当成一道题作答。',tutorial:{authored:{key:id,title:'原页组怎么练与核对',origin:'依原页目录与答案表编写的阅读指引',scope:'原页组练习说明；不是逐题解析',verifiedAt:DATE,body,sources:[]},materials:[]},sourceAudit:{checkedAt:DATE,imageStatus:'available',textStatus:'整组原页入口；逐题文字与答案待校准',scope:'起页、连续阅读范围及答案表位置已对照；不把未校准内容计成独立新题'}};
   records.push({id,legacyId:id,origin:'thinking-page-groups-20261106',kind:'practice',subject:'gongan',topic:chapter.title,title:`${chapter.title} · ${label} · PDF ${start}—${end}页`,date:DATE,tags:['公安思维提升','原页组','不计分',section.type==='case'?'情景整组':section.label],body,sourceRefs:[...pages.map(p=>ref(p,p===start?'整组阅读起页':p===end?'本组末页（保留跨页内容）':'本组连续原页')),ref(section.answerPage,'做完再核对：本章答案表')],links:[chapter.recordId,...selectedIds],revision:1,verificationStatus:'原页组入口已核对；逐题校准待完成',studyQuestion:{bank:'police-thinking-pages-20261106',chapter:ci+1,chapterName:chapter.title,sectionId:`thinking-pages-${section.type}`,sectionName:label,type:'recall',groupOnly:true,originalQuestionCount:section.questionCount,groupStartPage:start,groupEndPage:end,promptPreview:instruction.slice(0,180),gradingExcluded:true,gradingExclusionReason:'原页组不作为一道独立题，不计对错或掌握率。',needsConfirmation:true,historicalWrong:false,historicalCorrect:false,sameSourceDuplicate:true,knowledgeKey:chapter.recordId},details:{question,pageGroup,independentQuestion:false,selectedQuestionIds:selectedIds,originalContent:{provenance:'用户上传的完整原页，笔迹保留',sourceId:SID,pages,answerPage:section.answerPage},authoredContent:{provenance:'阅读与复盘指引为编写',body}}});
  }
  recordLinkPatches.push({recordId:chapter.recordId,appendLinks:ids});
 }
 return {schemaVersion:1,date:DATE,importId:'thinking-page-groups-20261106',records,sources:[],recordLinkPatches,summary:{pageGroups:records.length,sourceQuestionsRepresented:index.reduce((n,c)=>n+c.total,0),newIndependentQuestions:0,existingCalibratedQuestions:selected.length,remainingIndividualCalibration:index.reduce((n,c)=>n+c.total,0)-selected.length,maxInitialImages:1,newMediaBytes:0}};
}

export function generateThinkingPageGroups(){
 const artifact=path.join(ROOT,'output','materials-20261105');
 const index=JSON.parse(fs.readFileSync(path.join(artifact,'thinking-question-index.json'),'utf8')),selected=JSON.parse(fs.readFileSync(path.join(artifact,'thinking-selected-records.json'),'utf8')),manifest=JSON.parse(fs.readFileSync(path.join(artifact,'previews',SID,'manifest.json'),'utf8'));
 const candidate=buildThinkingPageGroups(index,selected,manifest),db=read(),before=hash(fs.readFileSync(path.join(DATA,'platform.json'))),copy=structuredClone(db);
 const first=mergeImported(copy,structuredClone(candidate.records));
 for(const row of candidate.records){validateRecord(row,copy,row);assert.equal(gradeQuestion(row.details.question,'A','掌握'),null);assert.equal(row.details.question.originalPages.length,1);assert.ok(!row.details.question.referenceAnswer);for(const ref of row.sourceRefs)for(const suffix of ['.webp','-hd.webp'])assert.ok(fs.existsSync(path.join(DATA,'previews',SID,ref.page+suffix)));}
 const second=mergeImported(copy,structuredClone(candidate.records));assert.equal(second.added+second.updated+second.conflicts,0);assert.equal(hash(fs.readFileSync(path.join(DATA,'platform.json'))),before);
 assert.ok(!/[A-Z]:\\/.test(JSON.stringify(publicClean(candidate.records))));
 const out=path.join(DATA,'thinking-page-groups-20261106-candidate.json');atomic(out,candidate);
 const report={status:'passed',...candidate.summary,candidateHash:hash(fs.readFileSync(out)),firstMerge:first,secondMerge:second,productionUnchanged:true,boundaryCorrection:'single/multi include the next section start page to retain shared-page question continuations',verifiedAnswerPages:[81,97,127,151,161,171]};
 atomic(path.join(ROOT,'output','reports','thinking-page-groups-20261106-validation.json'),report);
 return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(generateThinkingPageGroups(),null,2));
