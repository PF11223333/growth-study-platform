import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {buildThinkingCalibration,loadThinkingCalibrationInputs,applyThinkingCandidateToCopy,THINKING_BANK,THINKING_SOURCE} from '../scripts/build-thinking-calibration-20261107.mjs';
import {DATA,hash,publicClean} from '../server/store.mjs';
import {gradeQuestion,applyEvent,emptyProgress} from '../src/drill-state.mjs';
import {buildPracticeQueue,caseGroupKey,eligiblePracticeRows,matchesPracticeType,expandPracticeGroups} from '../src/practice-order.mjs';

const input=loadThinkingCalibrationInputs(),candidate=buildThinkingCalibration(input);
const questions=candidate.records.filter(row=>row.studyQuestion.bank===THINKING_BANK);
const groups=candidate.records.filter(row=>row.studyQuestion.groupOnly);
const originalRows=input.packets.flatMap(packet=>packet.questions);
const rawFor=row=>originalRows.find(q=>q.chapter===row.studyQuestion.chapter&&q.sectionType===row.studyQuestion.originalSectionType&&q.number===row.studyQuestion.number);
const before=hash(fs.readFileSync(path.join(DATA,'platform.json')));

test('338个独立原题：保留13个既有ID，新增325；18个原页组仍是原ID',()=>{
 assert.equal(questions.length,338);assert.equal(groups.length,18);assert.equal(new Set(candidate.records.map(r=>r.id)).size,356);
 for(const old of input.selectedRecords){assert.ok(questions.some(r=>r.id===old.id));}
 assert.equal(questions.filter(row=>!input.selectedRecords.some(old=>old.id===row.id)).length,325);
 for(const group of groups){assert.ok(input.existingRecords.some(row=>row.id===group.id));assert.equal(group.details.independentQuestion,false);assert.equal(gradeQuestion(group.details.question,'AB','掌握'),null);}
 assert.deepEqual(questions.reduce((counts,row)=>{counts[row.studyQuestion.chapter]=(counts[row.studyQuestion.chapter]||0)+1;return counts;},{}),{1:42,2:60,3:65,4:92,5:41,6:38});
 assert.equal(candidate.basePlatform.hash,before);assert.equal(candidate.basePlatform.version,input.db.version);
});

test('每题真实单多选、1352条独立解释和可渲染教学完整',()=>{
 let count=0;
 for(const row of questions){const q=row.details.question,raw=rawFor(row);
  assert.ok(['single','multi'].includes(q.type));assert.equal(row.studyQuestion.type,q.type);
  if(!q.gradingExcluded){if(q.type==='single')assert.equal(q.referenceAnswer.length,1);assert.equal(gradeQuestion(q,q.referenceAnswer),true);}
  assert.equal(q.prompt,raw.prompt);assert.deepEqual(q.options,raw.options);assert.match(q.tutorial.authored.body,/^## 本题怎样判断\n/);assert.match(q.tutorial.authored.scope,/本题逐项/);
  assert.match(row.title,/原题与逐项讲解$/);assert.doesNotMatch(q.tutorial.authored.body,/\[object Object\]/);
  assert.equal(q.verifiedText,true);assert.equal(q.textVerified,true);assert.equal(q.readingAvailability,'verified-text');
  assert.equal(row.studyQuestion.referenceAnswer,undefined,'目录摘要不携带答案');
  for(const letter of ['A','B','C','D']){const explanation=q.optionExplanations[letter];count++;assert.equal(explanation.text,raw.optionExplanations[letter]);assert.equal(explanation.status,'已逐项核对；解释为编写');assert.ok(explanation.basis.length);for(const basis of explanation.basis){assert.ok(basis.title&&basis.effective&&basis.verifiedAt);assert.ok(basis.url?.startsWith('http')||basis.sourceId);}}
 }
 assert.equal(count,1352);
});

test('题目、跨页图表与情景图都能定位；依赖图片的题不会等待被隐藏的图片',()=>{
 for(const row of questions){const q=row.details.question,raw=rawFor(row);
  assert.deepEqual([...new Set(q.originalPages.map(p=>p.page))],raw.pages);
  assert.ok(row.sourceRefs.some(ref=>ref.sourceId===THINKING_SOURCE&&ref.page===raw.answerPage));
  if(q.requiresImage){assert.equal(q.hideOriginalUntilAnswer,false);assert.ok(q.originalPages.length);assert.equal(q.assistedSource,true);assert.equal(row.studyQuestion.sameSourceDuplicate,undefined);}
  for(const p of [...q.originalPages,...q.contextPages]){assert.ok(fs.existsSync(path.join(DATA,'previews',p.sourceId,`${p.page}${p.previewSuffix}.webp`)));const {x,y,w,h}=p.region;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1.00001&&y+h<=1.00001);}
  for(const ref of row.sourceRefs){if(ref.url)assert.match(ref.url,/^https?:\/\//);else assert.ok(ref.sourceId&&ref.page);}
 }
 const map=questions.find(row=>row.studyQuestion.chapter===5&&row.studyQuestion.caseGroupOrder===1);
 assert.equal(map.details.question.contextPages[0].page,157);assert.deepEqual(map.details.question.contextPages[0].region,{x:.13,y:.13,w:.73,h:.51});
 assert.ok(questions.some(row=>row.details.question.originalPages.length>1),'跨页题必须保留后续原页');
});

test('待确认题书答只在答后证据与教学展示，不参与对错和掌握统计',()=>{
 const pending=questions.filter(row=>row.studyQuestion.gradingExcluded);assert.equal(pending.length,candidate.summary.pendingQuestions);assert.equal(pending.length,10);
 for(const row of pending){const q=row.details.question;assert.equal(q.gradingExcluded,true);assert.equal(q.referenceAnswer,'');assert.ok(q.answerEvidence.bookAnswer);assert.match(q.tutorial.authored.body,/题册答案/);assert.match(q.tutorial.authored.body,/不判分/);assert.doesNotMatch(q.answerConflict,/[A-D]/);assert.doesNotMatch(q.gradingExclusionReason,/[A-D]/);
  for(const answer of ['A','B','C','D','ABCD'])assert.equal(gradeQuestion(q,answer),null);
  const progress=applyEvent(emptyProgress(),{id:row.id,eventId:'pending',action:'attempt',answer:'A',correct:gradeQuestion(q,'A')});assert.equal(progress.items[row.id].attempts,0);assert.equal(progress.items[row.id].wrongCount,0);assert.ok(!progress.items[row.id].mastered);
 }
 const eligible=eligiblePracticeRows(questions);for(const row of pending){assert.ok(!eligible.some(r=>r.id===row.id));if(caseGroupKey(row))assert.ok(!eligible.some(r=>caseGroupKey(r)===caseGroupKey(row)),'当前规则将待确认同组隔离');}
});

test('30组118道情景共享完整材料，随机整组排列保持子题顺序',()=>{
 const cases=questions.filter(row=>matchesPracticeType(row,'case'));assert.equal(cases.length,118);
 const buckets=Map.groupBy(cases,caseGroupKey);assert.equal(buckets.size,30);
 const queue=buildPracticeQueue(questions,{policy:'random',random:()=>.381});assert.equal(queue.length,338);assert.equal(new Set(queue).size,338);
 for(const[key,rows]of buckets){assert.ok(key);const sorted=rows.toSorted((a,b)=>a.studyQuestion.caseGroupOrder-b.studyQuestion.caseGroupOrder);assert.deepEqual(sorted.map(r=>r.studyQuestion.caseGroupOrder),Array.from({length:rows.length},(_,i)=>i+1));
  assert.equal(new Set(rows.map(r=>r.details.question.fullContextText)).size,1);assert.equal(new Set(rows.map(r=>JSON.stringify(r.details.question.contextPages))).size,1);
  for(const row of rows){assert.equal(row.details.question.contextTextVerified,true);assert.ok(row.details.question.fullContextText);assert.ok(row.details.question.contextPages.length);assert.equal(row.studyQuestion.caseCount,rows.length);}
  const at=queue.indexOf(sorted[0].id);assert.deepEqual(queue.slice(at,at+rows.length),sorted.map(r=>r.id));
  assert.deepEqual(expandPracticeGroups([rows[0]],questions).map(r=>r.id).sort(),rows.map(r=>r.id).sort());
 }
 assert.notEqual(queue[0],questions[0].id);
});

test('原页组链接全部独立题；章节正文和旧学习记录保持不动',()=>{
 const merged=applyThinkingCandidateToCopy(input.db,candidate).db;
 for(const row of groups){const related=questions.filter(q=>q.studyQuestion.chapter===row.studyQuestion.chapter&&'thinking-pages-'+q.studyQuestion.originalSectionType===row.studyQuestion.sectionId);assert.deepEqual(row.details.selectedQuestionIds,related.map(r=>r.id));for(const q of related)assert.ok(row.links.includes(q.id));assert.match(row.body,/已全部建立独立题目和逐项讲解/);assert.doesNotMatch(row.details.question.prompt,/尚未逐题校准/);}
 for(const patch of candidate.recordLinkPatches){const old=input.db.records.find(r=>r.id===patch.recordId),row=merged.records.find(r=>r.id===patch.recordId);assert.equal(row.body,old.body);assert.equal(row.revision,old.revision);for(const id of patch.appendLinks)assert.ok(row.links.includes(id));}
 assert.deepEqual(merged.growth,input.db.growth);assert.deepEqual(merged.reviewSettings,input.db.reviewSettings);
});

test('重复合并幂等，不增加重复题；已编辑原题产生冲突且保留用户版本',()=>{
 const first=applyThinkingCandidateToCopy(input.db,candidate),second=applyThinkingCandidateToCopy(first.db,candidate);
 assert.equal(first.result.added,candidate.records.filter(r=>!input.db.records.some(old=>old.id===r.id)).length);assert.equal(first.result.conflicts,0);assert.equal(second.result.added+second.result.updated+second.result.conflicts,0);assert.equal(hash(first.db),hash(second.db));
 const small={records:[structuredClone(input.selectedRecords[0])],sources:[],conflicts:[]};small.records[0].edited=true;small.records[0].body='用户新增的重要理解';
 const incoming=candidate.records.find(r=>r.id===small.records[0].id),one={records:[incoming],recordLinkPatches:[]};const conflict=applyThinkingCandidateToCopy(small,one);assert.equal(conflict.result.conflicts,1);assert.equal(conflict.db.records[0].body,'用户新增的重要理解');assert.equal(conflict.db.conflicts[0].incoming.details.question.optionExplanations.A.status,'已逐项核对；解释为编写');
 assert.equal(applyThinkingCandidateToCopy(conflict.db,one).db.conflicts.length,1);
});

test('缺题、重复题和越界来源失败关闭，候选不带本机路径',()=>{
 const bad=structuredClone(input.packets);bad[0].questions.pop();assert.throws(()=>buildThinkingCalibration({...input,packets:bad}),/338/);
 const repeated=structuredClone(input.packets);repeated[0].questions[1]=structuredClone(repeated[0].questions[0]);assert.throws(()=>buildThinkingCalibration({...input,packets:repeated}),/重复/);
 const badPage=structuredClone(input.packets);badPage[0].questions[0].pages=[1];assert.throws(()=>buildThinkingCalibration({...input,packets:badPage}),/原页超出/);
 assert.deepEqual(publicClean(candidate),candidate);assert.equal(hash(fs.readFileSync(path.join(DATA,'platform.json'))),before);
});

test('多选题即使只有一个正确选项，仍按原题型保留多选交互',()=>{
 const packets=structuredClone(input.packets),raw=packets[0].questions.find(q=>q.sectionType==='multi');raw.answer='A';raw.bookAnswer='A';
 const changed=buildThinkingCalibration({...input,packets}).records.find(r=>r.studyQuestion.chapter===raw.chapter&&r.studyQuestion.originalSectionType==='multi'&&r.studyQuestion.number===raw.number);
 assert.equal(changed.details.question.type,'multi');assert.equal(changed.studyQuestion.type,'multi');assert.equal(gradeQuestion(changed.details.question,'A'),true);
});
