import test from 'node:test';
import assert from 'node:assert/strict';
import {techniques,fractionTable,buildMathRound,makeMathQuestion,gradeMathAnswer,roundedRatio,emptyMathWorkspace,loadMathWorkspace,recordMathEvent,mathStatistics,mathMistakes} from '../src/speed-math.mjs';

test('所有技巧随机题的答案与独立数值计算一致，选项有且只有一个正确值',()=>{
 for(const t of techniques)for(let seed=1;seed<=120;seed++){
  const rows=buildMathRound({categories:[t.id],size:20,seed,level:seed%2?'foundation':'applied'});
  assert.equal(rows.length,t.id==='powers'?6:20);assert.equal(new Set(rows.map(q=>q.key)).size,rows.length);
  for(const q of rows){const exact=q.numerator/q.denominator;assert.ok(Number.isFinite(exact));assert.ok(Math.abs(Number(q.answer)-exact)<=(q.rounding?.5*10**-q.precision:1e-8)+1e-8,q.key);assert.equal(gradeMathAnswer(q,q.answer).correct,true);assert.equal(gradeMathAnswer(q,Number(q.answer)+10).correct,false);assert.ok(q.steps.length>=3);assert.ok(q.hint&&q.memory&&q.pitfall);if(q.options){assert.equal(q.options.length,4);assert.equal(new Set(q.options.map(o=>o.value)).size,4);assert.equal(q.options.filter(o=>gradeMathAnswer(q,o.value).correct).length,1);}}
 }
});
test('混合轮覆盖多类、顺序会变、同轮不重，上一轮题目尽量避开',()=>{
 const a=buildMathRound({seed:12,size:20}),b=buildMathRound({seed:13,size:20,previousKeys:a.map(q=>q.key)});
 assert.notDeepEqual(a.map(q=>q.key),b.map(q=>q.key));assert.equal(new Set(a.map(q=>q.category)).size,11);assert.equal(new Set(b.map(q=>q.key)).size,20);assert.ok(b.every(q=>!a.some(old=>old.key===q.key)));
 for(let i=1;i<a.length;i++)assert.notEqual(a[i].category,a[i-1].category);
 assert.throws(()=>buildMathRound({categories:[]}));
});
test('原表近似值统一精度，1.2四次方校准为2.1；十进制半值舍入不受浮点影响',()=>{
 const q=makeMathQuestion('powers',{a:12,exponent:4});assert.equal(q.answer,'2.1');assert.match(q.note,/2.0736/);assert.equal(gradeMathAnswer(q,'2.0').correct,false);assert.equal(gradeMathAnswer(q,'2.0736').correct,true);
 assert.equal(roundedRatio(1005,1000,2),'1.01');assert.equal(roundedRatio(173375,1000,2),'173.38');
 assert.equal(makeMathQuestion('fraction-percent',{index:fractionTable.findIndex(e=>e.denominator===16)}).answer,'6.25');
 assert.equal(makeMathQuestion('fraction-percent',{index:fractionTable.findIndex(e=>e.denominator===2.4)}).answer,'42');
});
test('输入区分百分数与普通数字，支持全角和千位，不接受表达式或乱码',()=>{
 const q=makeMathQuestion('fraction-percent',{index:0});assert.equal(gradeMathAnswer(q,'５０％').correct,true);assert.equal(gradeMathAnswer(q,'0.5').correct,false);assert.equal(gradeMathAnswer(q,'1/2').valid,false);
 const n=makeMathQuestion('addition',{a:900,b:600});assert.equal(gradeMathAnswer(n,'1,500').correct,true);assert.equal(gradeMathAnswer(n,'1500%').valid,false);assert.equal(gradeMathAnswer(n,'1,50').valid,false);assert.equal(gradeMathAnswer(n,'').valid,false);
});
const event=(id,outcome='wrong',hintUsed=false)=>({id,sessionId:'r',question:makeMathQuestion('divide-shortcut',{a:375,b:25}),answer:outcome==='correct'?'15':'10',outcome,hintUsed,elapsedMs:1000,at:'2026-10-18T01:00:00Z'});
test('重复提交不重复计数，提示后答对不进入独立正确率，独立重练正确后移出待巩固',()=>{
 let w=recordMathEvent(emptyMathWorkspace(),event('1'));assert.equal(recordMathEvent(w,event('1')),w);assert.equal(mathMistakes(w.events).length,1);
 w=recordMathEvent(w,event('2','correct',true));let stat=mathStatistics(w.events).find(t=>t.id==='divide-shortcut');assert.equal(stat.attempts,1);assert.equal(stat.correct,0);assert.equal(mathMistakes(w.events).length,1);
 w=recordMathEvent(w,event('3','correct'));stat=mathStatistics(w.events).find(t=>t.id==='divide-shortcut');assert.equal(stat.attempts,2);assert.equal(stat.rate,.5);assert.equal(mathMistakes(w.events).length,0);
});
test('恢复保留题目顺序和草稿并暂停计时，损坏或未知版本被拒绝',()=>{
 const questions=buildMathRound({size:10,seed:90}),session={id:'r',mode:'mixed',createdAt:'2026-10-18T01:00:00Z',questions,index:1,answers:[],elapsedMs:2500,paused:false,draft:'12.5',hintUsed:true};
 const w=loadMathWorkspace(JSON.stringify({...emptyMathWorkspace(),session}));assert.equal(w.session.paused,true);assert.equal(w.session.elapsedMs,2500);assert.equal(w.session.draft,'12.5');assert.deepEqual(w.session.questions.map(q=>q.key),questions.map(q=>q.key));
 assert.throws(()=>loadMathWorkspace({schemaVersion:2,events:[]}));assert.throws(()=>loadMathWorkspace({...w,session:{...session,index:100}}));assert.throws(()=>loadMathWorkspace({...w,events:[{...event('x'),question:{...event('x').question,answer:'999'}}]}));
 assert.throws(()=>loadMathWorkspace({...emptyMathWorkspace(),events:[{...event('x'),outcome:'correct'}]}));
});
