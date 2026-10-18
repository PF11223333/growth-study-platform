import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPracticeQueue,expandPracticeGroups,eligiblePracticeRows,matchesPracticeQuery,matchesPracticeType,practiceSessionKey,practiceResumeTarget,practiceNavigationParams,practiceAttemptId,restorePracticeSession,reconcilePracticeSession,recordPracticeResult,advancePracticeSession} from '../src/practice-order.mjs';
import {applyEvent,emptyProgress} from '../src/drill-state.mjs';

const row=(id,number,group='')=>({id,subject:'gongan',title:`2024国考 第${number}题`,studyQuestion:{bank:'lower',number,type:'single',chapterName:'2024国考',promptPreview:'某派出所依法调查',...(group?{caseGroupId:group,caseGroupOrder:number,caseIndex:number-90,caseCount:3}:{})}});
const rows=[row('one',1),row('last',100),row('case93',93,'scene'),row('case91',91,'scene'),row('case92',92,'scene'),row('two',2)];
const session=()=>({schemaVersion:2,ids:['one','two'],index:0,round:'round-a',answers:{},skipped:[],policy:'random',requestedSize:20,createdAt:'2026-10-17T02:00:00Z'});

test('随机按整组抽取，组内按原题号连续，指定量不截断情景组',()=>{
 const ids=buildPracticeQueue(rows,{random:()=>.3,limit:2,startId:'case92'});
 assert.deepEqual(ids,['case91','case92','case93']);
 const all=buildPracticeQueue(rows,{random:()=>.5});const at=all.indexOf('case91');assert.deepEqual(all.slice(at,at+3),['case91','case92','case93']);assert.equal(new Set(all).size,rows.length);
 assert.deepEqual(expandPracticeGroups([rows[2]],rows).map(r=>r.id),['case93','case91','case92']);
});
test('默认真随机不按掌握优先级排序，下一轮避免相同首组',()=>{
 const priority={items:Object.fromEntries(rows.map(r=>[r.id,{attempts:2,nextReview:'2026-01-01'}]))};
 const first=buildPracticeQueue(rows,{random:()=>.2});assert.deepEqual(first,buildPracticeQueue(rows,{progress:priority,today:'2026-10-17',random:()=>.2}));
 assert.notDeepEqual(first,buildPracticeQueue(rows,{random:()=>.8}));
 const second=buildPracticeQueue(rows,{random:()=>.2,previousId:first[0]});assert.notEqual(first[0],second[0]);
});
test('有一题仍待校准的情景组整体留在资料库，不抽成缺题的半组',()=>{
 const input=structuredClone(rows);input.find(r=>r.id==='case92').studyQuestion.gradingExcluded='缺失原题';
 assert.deepEqual(eligiblePracticeRows(input).map(r=>r.id),['one','last','two']);
 assert.equal(eligiblePracticeRows(rows).length,rows.length);
});
test('按知识小节命中跨小节的情景题，仍扩为全组并检查全组可判分',()=>{
 const input=structuredClone(rows);for(const r of input)r.studyQuestion.sectionId=r.id==='case92'?'civil':'administrative';
 const scoped=input.filter(r=>r.studyQuestion.sectionId==='civil');const eligible=eligiblePracticeRows(expandPracticeGroups(scoped,input));
 assert.deepEqual(buildPracticeQueue(expandPracticeGroups(scoped,eligible),{limit:1}),['case91','case92','case93']);
 input.find(r=>r.id==='case91').studyQuestion.gradingExcluded=true;
 assert.deepEqual(eligiblePracticeRows(expandPracticeGroups(scoped,input)),[]);
});
test('显式原册模式遵循原顺序；已到最后一题不绕回第一题',()=>{
 assert.deepEqual(buildPracticeQueue(rows,{policy:'ordered'}),['one','last','case91','case92','case93','two']);
 assert.deepEqual(buildPracticeQueue(rows,{policy:'ordered',afterId:'two'}),[]);
 assert.deepEqual(buildPracticeQueue(rows,{policy:'ordered',afterId:'case91'}),['case92','case93','two']);
});
test('卷名、题号、题干可组合检索，题型情景识别不依赖答案数量',()=>{
 assert.equal(matchesPracticeQuery(rows[2],'2024国考 第９３题 派出所'),true);
 assert.equal(matchesPracticeQuery(rows[2],'2025国考'),false);
 assert.equal(matchesPracticeType(rows[2],'case'),true);assert.equal(matchesPracticeType(rows[2],'single'),true);assert.equal(matchesPracticeType(rows[0],'case'),false);
});
test('未提交不可直接下一题，提交/暂跳/重复下一题不丢不重',()=>{
 const s=session();assert.equal(advancePracticeSession(s,'one'),s);
 const answered=recordPracticeResult(s,'one',{answer:'B',correct:false});assert.equal(recordPracticeResult(answered,'one',{answer:'A',correct:true}),answered);
 const next=advancePracticeSession(answered,'one');assert.equal(next.index,1);assert.deepEqual(next.answers.one,{answer:'B',correct:false});
 assert.equal(advancePracticeSession(next,'one'),next);
 const done=advancePracticeSession(next,'two',{skip:true});assert.equal(done.index,2);assert.deepEqual(done.skipped,['two']);assert.equal(advancePracticeSession(done,'two',{skip:true}),done);
});
test('中断恢复顺序、位置与已答状态；删除旧题只调整位置不重新洗牌',()=>{
 const s={...session(),ids:['gone','one','two'],index:2,answers:{one:{answer:'B',correct:false}},skipped:['gone']};
 const restored=restorePracticeSession(JSON.parse(JSON.stringify(s)),['one','two']);assert.deepEqual(restored.ids,['one','two']);assert.equal(restored.index,1);assert.deepEqual(restored.answers,s.answers);assert.deepEqual(restored.skipped,[]);
 assert.equal(restorePracticeSession({...s,ids:['one','one']},['one']),null);assert.equal(restorePracticeSession({...s,index:100},['one']),null);assert.equal(restorePracticeSession({...session(),schemaVersion:9},['one','two']),null);
});
test('提交落盘后关闭页面可恢复原答案，同轮重试不会重复计分',()=>{
 const s=session(),event={id:'one',eventId:practiceAttemptId(s,'one'),action:'attempt',answer:'B',correct:false,at:'2026-10-17T02:00:00Z'};
 const progress=applyEvent(emptyProgress(),event),again=applyEvent(progress,event);assert.equal(again.items.one.attempts,1);
 const recovered=reconcilePracticeSession(s,progress);assert.deepEqual(recovered.answers.one,{answer:'B',correct:false,rating:undefined});assert.equal(reconcilePracticeSession(recovered,progress),recovered);
 const otherRound={...s,round:'round-b'};assert.equal(reconcilePracticeSession(otherRound,progress),otherRound);assert.notEqual(practiceAttemptId(s,'one'),practiceAttemptId(otherRound,'one'));
});
test('开始、退出、继续与浏览器返回 URL 保留筛选，各轮有独立快照键',()=>{
 const filters={mode:'wrong',subject:'gongan',bank:'lower',chapter:'2',section:'civil',status:'active',q:'第 93 题',type:'single'};
 const start=practiceNavigationParams(filters,{run:'round-a',start:'',after:''});assert.equal(start.q,filters.q);assert.equal(start.type,'single');assert.equal(start.run,'round-a');assert.ok(!('start'in start));
 const exit=practiceNavigationParams(start,{run:'',autostart:'',order:''});assert.deepEqual(exit,filters);assert.equal(practiceSessionKey(exit),practiceSessionKey(filters));
 const resumed=practiceNavigationParams(exit,{run:'round-a'});assert.deepEqual(resumed,start);
 assert.notEqual(practiceSessionKey({...filters,q:''}),practiceSessionKey(filters));assert.notEqual(practiceSessionKey({...filters,type:'case'}),practiceSessionKey(filters));
});
test('首页准备页可继续最近章节轮，显式筛选则只恢复自己的轮',()=>{
 const filters={mode:'all',subject:'',bank:'',chapter:'',section:'',status:'active',q:'',type:''};
 const recent={session:{...session(),index:1},filters:{...filters,bank:'lower',chapter:'2',section:'civil',q:'派出所'}};
 assert.equal(practiceResumeTarget(filters,null,recent),recent);
 assert.deepEqual(practiceNavigationParams(recent.filters,{run:recent.session.round}),{mode:'all',bank:'lower',chapter:'2',section:'civil',status:'active',q:'派出所',run:'round-a'});
 assert.equal(practiceResumeTarget({...filters,chapter:'3'},null,recent),null);
 assert.equal(practiceResumeTarget({...filters,mode:'wrong'},null,recent),null);
 assert.equal(practiceResumeTarget(filters,null,{...recent,session:{...recent.session,index:2}}),null);
 const matching=practiceResumeTarget({...filters,chapter:'3'},session(),recent);assert.equal(matching.filters.chapter,'3');assert.equal(matching.session.index,0);
});
