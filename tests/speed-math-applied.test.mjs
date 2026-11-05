import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMathRound,makeMathQuestion,gradeMathAnswer,divisionBounds,safeNearestOption,mathReviewSchedule,loadMathWorkspace,emptyMathWorkspace} from '../src/speed-math.mjs';
import {appliedTechniques} from '../src/speed-math-applied.mjs';
import {speedMathSources,sourcesForTechnique} from '../src/speed-math-sources.mjs';

// Reconstruct from the story operands, without using the production numerator/denominator.
function independentlySolve(q){const p=q.params,r1=p.r1/10000,r2=p.r2/10000,r=p.rateBps/10000;
 switch(q.category){
 case'truncate-division':return p.a/p.b*100;
 case'fraction-compare':return p.pairs.reduce((best,x,i,all)=>x.n*all[best].d>all[best].n*x.d?i:best,0)+1;
 case'growth-parts':{const base=p.a/(1+(p.decline?-r:r));return Math.abs(p.a-base);}
 case'base-current':return p.askBase?p.a/(1+r):p.a*(1+r);
 case'percent-points':return p.relative?(p.b/p.a-1)*100:(p.b-p.a)/10;
 case'interval-growth':{const initial=100,first=initial*(1+r1),second=first*(1+r2);return(second-initial)/initial*100;}
 case'weighted-growth':{const base=p.a/(1+r1)+p.b/(1+r2);return(p.a+p.b-base)/base*100;}
 case'average-growth':{const oldAmount=100,oldCount=20,currentAmount=oldAmount*(1+r1),currentCount=oldCount*(1+r2);return((currentAmount/currentCount)/(oldAmount/oldCount)-1)*100;}
 case'share-change':return(p.a/p.b-(p.a/(1+r1))/(p.b/(1+r2)))*100;
 default:throw new Error(q.category);
 }
}
test('9类应用按题意独立重算，包含负增长、近似、唯一选项和两种难度',()=>{
 for(const t of appliedTechniques)for(let seed=1;seed<=180;seed++)for(const q of buildMathRound({categories:[t.id],size:20,seed,level:seed%2?'foundation':'applied'})){
  const exact=independentlySolve(q);assert.ok(Math.abs(Number(q.answer)-exact)<=.5*10**-q.precision+1e-8,q.key);
  assert.equal(gradeMathAnswer(q,q.answer).correct,true);assert.ok(q.steps.every(s=>!s.includes('NaN')&&!s.includes('undefined')));
  if(q.category==='weighted-growth')assert.ok(exact>=Math.min(q.params.r1,q.params.r2)/100-1e-8&&exact<=Math.max(q.params.r1,q.params.r2)/100+1e-8);
  if(q.category==='share-change')assert.equal(Math.abs(exact)<1e-8?0:Math.sign(exact),Math.sign(q.params.r1-q.params.r2));
  if(q.options){assert.equal(q.options.filter(o=>gradeMathAnswer(q,o.value).correct).length,1);if(q.category==='fraction-compare')assert.ok(q.options.every(o=>o.label));}
 }
});
test('粗估商的区间包住精确值，跨过选项中点时禁止仅凭两位估算定答案',()=>{
 let accepted=0,rejected=0;
 for(let seed=1;seed<=160;seed++)for(const q of buildMathRound({categories:['truncate-division'],size:20,seed})){
  const {a,b}=q.params,range=divisionBounds(a,b),exact=a/b*100;
  assert.ok(range.lower<=exact&&exact<=range.upper,q.key);
  const chosen=safeNearestOption(range,q.options.map(o=>o.value));
  if(chosen===null)rejected++;else{accepted++;assert.equal(chosen,Number(q.answer));}
 }
 assert.ok(accepted>100&&rejected>100);
 const range=divisionBounds(12345,45678);assert.equal(range.rounded,46000);
 assert.equal(safeNearestOption(range,['26.9','27.0','27.1','27.2']),null);
 assert.equal(safeNearestOption(range,['21','24','27','30']),27);
});
test('容易误学的等号与单位有明确反例，边界条件被拒绝',()=>{
 assert.equal(makeMathQuestion('growth-parts',{a:8000,reciprocal:3,rateBps:3300,decline:false}).answer,'1984.96');
 assert.equal(makeMathQuestion('growth-parts',{a:1200,reciprocal:4,rateBps:2500,decline:true}).answer,'400.00');
 assert.equal(makeMathQuestion('base-current',{a:2000,rateBps:500,askBase:true}).answer,'1904.8');
 assert.equal(makeMathQuestion('percent-points',{a:200,b:250,relative:false}).answer,'5.0');
 assert.equal(makeMathQuestion('percent-points',{a:200,b:250,relative:true}).answer,'25.0');
 assert.equal(makeMathQuestion('interval-growth',{r1:1000,r2:-1000}).answer,'-1.0');
 assert.equal(makeMathQuestion('weighted-growth',{a:110,b:390,r1:1000,r2:3000}).answer,'25.0');
 assert.equal(makeMathQuestion('average-growth',{r1:2000,r2:1000}).answer,'9.1');
 assert.equal(makeMathQuestion('share-change',{a:60,b:200,r1:2000,r2:1000}).answer,'2.5');
 assert.throws(()=>makeMathQuestion('base-current',{a:100,rateBps:-10000,askBase:true}));
 assert.throws(()=>makeMathQuestion('share-change',{a:90,b:100,r1:-5000,r2:0}));
 assert.throws(()=>makeMathQuestion('fraction-compare',{pairs:[{n:1,d:2},{n:2,d:4},{n:1,d:4},{n:1,d:5}]}));
 assert.throws(()=>divisionBounds(100,0));
 const q=makeMathQuestion('percent-points',{a:200,b:250,relative:false});assert.equal(gradeMathAnswer(q,'5%').valid,false);
});
const question=makeMathQuestion('divide-shortcut',{a:375,b:25});
function event(id,day,outcome='correct',hintUsed=false){return{id,sessionId:'r',question,answer:outcome==='correct'?'15':outcome==='wrong'?'1':'',outcome,hintUsed,elapsedMs:1000,at:day+'T01:00:00Z'};}
test('回访按上海日历，重复当天不能升级，提前做对不推后到期，遗忘回到次日',()=>{
 const rows=[event('1','2026-11-05'),event('2','2026-11-05')];
 let review=mathReviewSchedule(rows,'2026-11-05T10:00:00Z')[0];assert.equal(review.stage,0);assert.equal(review.dueDate,'2026-11-06');assert.equal(review.independentDays,1);assert.equal(review.due,false);
 rows.push(event('3','2026-11-06'));review=mathReviewSchedule(rows,'2026-11-06T10:00:00Z')[0];assert.equal(review.stage,1);assert.equal(review.dueDate,'2026-11-09');
 rows.push(event('4','2026-11-07'));review=mathReviewSchedule(rows,'2026-11-08T16:01:00Z')[0];assert.equal(review.dueDate,'2026-11-09');assert.equal(review.stage,1);assert.equal(review.due,true);
 rows.push(event('5','2026-11-09','wrong'),event('6','2026-11-09'));review=mathReviewSchedule(rows,'2026-11-09T10:00:00Z')[0];assert.equal(review.dueDate,'2026-11-10');assert.equal(review.stage,0);
 const hint=mathReviewSchedule([event('1','2026-11-05','correct',true)],'2026-11-06T10:00:00Z')[0];assert.equal(hint.due,true);assert.equal(hint.independentDays,0);
 assert.deepEqual(mathReviewSchedule([event('1','2026-11-05','skipped')]),[]);
});
test('旧版schema、题目ID与记录不被升级覆盖，新旧记录可混合导入',()=>{
 const old=event('old','2026-10-18'),newQuestion=makeMathQuestion('average-growth',{r1:2000,r2:1000});
 const fresh={...event('new','2026-11-05'),question:newQuestion,answer:newQuestion.answer};
 const w=loadMathWorkspace({...emptyMathWorkspace(),events:[old,fresh]});assert.equal(w.schemaVersion,1);assert.deepEqual(w.events.map(e=>e.id),['old','new']);assert.equal(w.events[0].question.key,old.question.key);assert.equal(w.events[0].question.answer,'15');
 assert.deepEqual(loadMathWorkspace(JSON.stringify(w)),w);
});
test('每类新方法有适用条件、反例与可追溯来源，未标日期不伪造成最新',()=>{
 for(const technique of appliedTechniques){assert.ok(technique.appliesTo&&technique.counterexample);assert.ok(sourcesForTechnique(technique).length>0);}
 for(const source of speedMathSources){assert.ok(/^https:\/\//.test(source.url));assert.equal(source.checkedAt,'2026-11-05');}
 assert.equal(speedMathSources.find(s=>s.id==='fenbi-speed').publishedAt,null);
});
