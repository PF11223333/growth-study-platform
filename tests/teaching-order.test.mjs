import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPracticeQueue} from '../src/practice-order.mjs';
import {enrichOptions} from '../scripts/enrich-options.mjs';
import {enrichTeaching} from '../scripts/enrich-teaching.mjs';
const rows=[{id:'a',studyQuestion:{knowledgeKey:'inspection'}},{id:'b',studyQuestion:{knowledgeKey:'inspection'}},{id:'c',studyQuestion:{knowledgeKey:'inspection'}},{id:'d',studyQuestion:{knowledgeKey:'growth'}},{id:'e',studyQuestion:{knowledgeKey:'growth'}}];
test('相关出题紧跟同知识点，适时切换，整轮不重复且能从指定题开始',()=>{
 const ids=buildPracticeQueue(rows,{policy:'related',startId:'a',random:()=>.5});assert.equal(ids[0],'a');assert.ok(['b','c'].includes(ids[1]));assert.ok(['b','c'].includes(ids[2]));assert.ok(['d','e'].includes(ids[3]));assert.equal(new Set(ids).size,rows.length);
 assert.deepEqual(buildPracticeQueue(rows,{policy:'ordered'}),rows.map(r=>r.id));
});
test('新一轮避免重复起题，相关模式优先到期题',()=>{
 const first=buildPracticeQueue(rows,{policy:'random',random:()=>.2})[0];const second=buildPracticeQueue(rows,{policy:'random',previousId:first,random:()=>.2})[0];assert.notEqual(first,second);
 const progress={items:Object.fromEntries(rows.map(r=>[r.id,{attempts:1}]))};progress.items.d.nextReview='2026-10-10';assert.equal(buildPracticeQueue(rows,{policy:'related',progress,today:'2026-10-11',random:()=>.5})[0],'d');
});
test('截图题保留原机器稿、补齐C，教程区分历史答案与现行住所规则，重复生成不改数据',()=>{
 const original='机器原稿，缺C';const row={id:'drill-20260917-admin-single-0-4',revision:1,kind:'practice',subject:'gongan',links:['material'],sourceRefs:[{sourceId:'original',page:8}],aiContent:{text:original},studyQuestion:{bank:'police-drill-20260917',sectionId:'admin'},details:{question:{prompt:'新华派出所检查黑火药',options:{A:'A',B:'B',D:'D'},referenceAnswer:'B',explanation:{}}}};
 const db={records:[row,{id:'material',kind:'knowledge',title:'已有教程',body:'扣押是暂时控制，不等于最后没收。',sourceRefs:[{sourceId:'notes',page:57}]}]};enrichOptions(db);enrichTeaching(db);
 assert.match(row.details.question.options.C,/黑火药/);assert.match(row.details.question.currentLawNote,/2026年/);assert.match(row.details.question.tutorial.authored.body,/2026年/);assert.equal(row.details.question.referenceAnswer,'B');assert.equal(row.aiContent.text,original);assert.equal(row.details.question.tutorial.materials[0].body,db.records[1].body);
 const snapshot=JSON.stringify(db);enrichOptions(db);enrichTeaching(db);assert.equal(JSON.stringify(db),snapshot);
});
