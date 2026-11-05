// Basis points and integer ratios keep the answer key independent of approximations.
export const appliedTechniques=[
 {id:'truncate-division',name:'截位直除与误差边界',group:'资料速算',rule:'一步除法先保留分子，只把分母凑整。用上下界确认：粗估的整个范围都落在同一选项附近，才可以停。',example:'12345÷45678≈12345÷46000；分母约在45500—46500之间，商约在26.55%—27.13%。',pitfall:'不是“选项差得大就永远截两位”；量级、小数点和两选项中点都要检查。',appliesTo:'分子、分母均为正；估算范围能排除其余选项。',counterexample:'27.0%与27.1%只差0.1个百分点，上面的粗估范围跨过中点，必须多保留数字。',sourceIds:['fenbi-speed','huatu-2026']},
 {id:'fraction-compare',name:'分数大小比较',group:'资料速算',rule:'分母都是正数时，比较a/b与c/d，只需要比较a×d与c×b。先看同分子、同分母，不能直接看数字大小。',example:'17/23与18/25：17×25＝425，18×23＝414，所以17/23更大。',pitfall:'分子分母都变大，分数不一定变大；负分母要先统一符号。',appliesTo:'正分母的比例、平均数、倍数比较；本训练全部为正分数。',counterexample:'3/4比2/3大，但4/7比3/4小，“分子大就大”不成立。',sourceIds:['huatu-fractions']},
 {id:'growth-parts',name:'百化分：增长 n＋1／下降 n－1',group:'资料速算',rule:'现期量为A，增长率恰好1/n，增长量＝A/(n＋1)；下降率恰好1/n，减少量＝A/(n－1)。只是接近1/n时必须检查误差。',example:'现期1200，增长25%＝1/4，增长量1200÷5＝240。',pitfall:'33%≠1/3，近似换分数后算出的增长量只能粗估；下降时n必须大于1。',appliesTo:'已知现期量与增长率，增长率接近熟悉的分数；精确题仍用原始增长率。',counterexample:'现期8000、增长33%：准确增长量约1984.96；套1/3得到2000，只是估算。',sourceIds:['fenbi-speed','huatu-2026']},
 {id:'base-current',name:'基期现期与小增长率近似',group:'资料速算',rule:'找以前：现期÷(1＋增长率)；找现在：基期×(1＋增长率)。增长率很小时可先估，再检查选项是否容得下误差。',example:'今年110，增长10%，去年＝110÷1.1＝100。',pitfall:'基期不能写成现期×(1－增长率)的等式；这是近似式。',appliesTo:'同口径的前后两期，增长率大于－100%；小率近似只用来粗筛选项。',counterexample:'2000÷1.05≈1904.76，而2000×0.95＝1900。后者相对准确值低0.25%。',sourceIds:['nbs-development','huatu-2026']},
 {id:'percent-points',name:'百分数与百分点',group:'资料速算',rule:'问多了几个百分点，两个百分数直接相减；问相对增长百分之几，用差值除以原来的百分数。',example:'从20%到25%：提高5个百分点；相对增长(25－20)÷20＝25%。',pitfall:'“下降到”与“下降了”不同；百分比变化和百分点变化单位不同。',appliesTo:'两个同口径百分数比较；计算相对变化时原值必须非零。',counterexample:'20%到25%不是“增长5%”；5是百分点，25%才是相对增幅。',sourceIds:['nbs-percent']},
 {id:'interval-growth',name:'两期复合增长',group:'资料速算',rule:'连续两期先把增长率各加1，再相乘，最后减1。也就是r₁＋r₂＋r₁r₂。',example:'先增长10%，再增长20%，总增幅＝1.1×1.2－1＝32%。',pitfall:'连续两期增长的基数变了，不能只把两个增长率相加。',appliesTo:'同一统计量、连续两期、统计口径一致，每期增长率大于－100%。',counterexample:'先涨10%再跌10%，100→110→99，总变化为－1%，不是0%。',sourceIds:['nbs-development','huatu-2026']},
 {id:'weighted-growth',name:'混合增长：权重要用基期',group:'资料速算',rule:'整体增长率介于各部分增长率之间；精算先还原各部分基期，再用整体增长量除以整体基期。',example:'现期110、390，两部分分别增长10%、30%；基期100、300，整体增长率＝100÷400＝25%。',pitfall:'用现期占比直接加权各部分增长率会算错；不能随便取算术平均数。',appliesTo:'两个互不重叠、合计为整体的正数量；先确认单位和统计时期一致。',counterexample:'上例不是(10%＋30%)÷2＝20%，也不是按110:390作为基期权重。',sourceIds:['huatu-2026']},
 {id:'average-growth',name:'平均数增长率',group:'资料速算',rule:'平均数＝总量÷数量。平均数增长率＝(总量增长率－数量增长率)÷(1＋数量增长率)。',example:'总额增长20%，人数增长10%，人均增长(20%－10%)÷1.1≈9.09%。',pitfall:'两个增长率的差只帮助判断方向；它一般不等于平均数增长率。',appliesTo:'总量和数量同口径，数量为正，增长率大于－100%。',counterexample:'总额涨20%、人数涨10%，人均不是涨10%；人数也扩大了分母。',sourceIds:['huatu-2026']},
 {id:'share-change',name:'两期比重：方向与幅度',group:'资料速算',rule:'部分比整体增长快，比重上升。要算几个百分点，先还原两期比重，再相减。',example:'本期部分60、整体200，分别涨20%、10%；本期30%，基期27.5%，上升2.5个百分点。',pitfall:'部分与整体增长率差10个百分点，并不表示比重也提高10个百分点。',appliesTo:'部分确实属于整体，两期统计口径相同；两期整体及基期均为正。',counterexample:'上例增长率差10个百分点，比重变化却只有2.5个百分点。',sourceIds:['nbs-percent','huatu-2026']}
];
const ids=new Map(appliedTechniques.map(t=>[t.id,t]));
export const isAppliedTechnique=id=>ids.has(id);
function integer(random,min,max){return min+Math.floor(random()*(max-min+1));}
function pick(values,random){return values[integer(random,0,values.length-1)];}
function shuffled(values,seed){let state=(seed>>>0)||1;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};const a=[...values];for(let i=a.length-1;i>0;i--){const j=integer(random,0,i);[a[i],a[j]]=[a[j],a[i]];}return a;}
function positive(value){if(!Number.isSafeInteger(value)||value<=0||value>100000000)throw new Error('题目数量须为有效正整数');return value;}
function rate(value){if(!Number.isInteger(value)||value<=-10000||value>100000)throw new Error('增长率超出支持范围');return value;}
function safeRatio(n,d){if(!Number.isSafeInteger(n)||!Number.isSafeInteger(d)||d<=0)throw new Error('题目数值精度超出范围');}
const rateText=r=>r<0?`（${r/100}%）`:`${r/100}%`;
export function divisionBounds(a,b,digits=2){
 positive(a);positive(b);if(![2,3,4].includes(digits))throw new Error('有效数字须为2至4位');
 const scale=10**Math.max(0,Math.floor(Math.log10(b))-digits+1),rounded=Math.round(b/scale)*scale;
 // Enclose rather than claim that a truncated decimal is the exact divisor.
 const lower=a*100/(rounded+scale/2),upper=a*100/(rounded-scale/2);
 return{rounded,scale,lower,upper,estimate:a*100/rounded};
}
export function safeNearestOption(bounds,options){
 const sorted=options.map(Number).sort((a,b)=>a-b);
 return sorted.find((value,i)=>bounds.lower>(i?(sorted[i-1]+value)/2:-Infinity)&&bounds.upper<(i+1<sorted.length?(value+sorted[i+1])/2:Infinity))??null;
}
export function appliedParameters(category,random,level){const advanced=level==='applied',a=integer(random,advanced?1000:100,advanced?9000:2000);
 switch(category){
 case'truncate-division':{const b=integer(random,20000,90000);return{a:Math.floor(b*integer(random,12,75)/100)+integer(random,1,99),b,close:random()<.5,seed:integer(random,1,2147483646)};}
 case'fraction-compare':{const pairs=[];while(pairs.length<4){const q={n:integer(random,11,advanced?150:70),d:integer(random,71,advanced?240:150)};if(!pairs.some(p=>p.n*q.d===q.n*p.d))pairs.push(q);}return{pairs};}
 case'growth-parts':{const reciprocal=pick([4,5,8,10,20,25],random);return{a,reciprocal,rateBps:10000/reciprocal+(advanced?pick([-30,-10,0,10,30],random):0),decline:random()<.35};}
 case'base-current':return{a,rateBps:pick([-2500,-1250,-500,250,500,800,1000,1250,2000,2500,3300],random),askBase:random()<.5};
 case'percent-points':{const first=integer(random,10,650),second=first+pick([-5,-3,-1,1,3,5],random)*integer(random,1,20);return{a:first,b:Math.max(1,second),relative:random()<.5};}
 case'interval-growth':case'average-growth':return{r1:integer(random,-20,40)*100,r2:integer(random,-15,35)*100};
 case'weighted-growth':return{a:integer(random,100,4500),b:integer(random,100,4500),r1:integer(random,-10,25)*100,r2:integer(random,26,45)*100};
 case'share-change':{const b=integer(random,200,5000);return{a:Math.floor(b*integer(random,10,55)/100),b,r1:integer(random,-10,40)*100,r2:integer(random,-10,30)*100};}
 default:throw new Error('Unknown applied technique');
 }
}
export function makeAppliedQuestion(category,p,round){
 const technique=ids.get(category);if(!technique)throw new Error('Unknown applied technique');
 let n=0,d=1,precision=1,rounding=true,unit='',prompt='',hint='',steps=[],note='',options;
 const fmt=(a,b=1,digits=2)=>round(a,b,digits),a=p.a,b=p.b;
 if(category==='truncate-division'){
  positive(a);positive(b);n=a*100;d=b;unit='%';const answer=fmt(n,d,1),ticks=Math.round(Number(answer)*10),gap=p.close?1:30;
  options=shuffled([0,-gap,gap,2*gap].map(delta=>({value:((ticks+delta)/10).toFixed(1)})),p.seed);
  const bounds=divisionBounds(a,b),canStop=safeNearestOption(bounds,options.map(o=>o.value));
  prompt=`${a} ÷ ${b} 化成百分数是多少？四舍五入保留1位小数。`;
  hint='先留住分子的原值，分母保留两位有效数字；如果估算范围跨过相邻选项的中点，再细算。';
  steps=[`分母先凑成${bounds.rounded}（两位有效数字，量级保留），估算约${bounds.estimate.toFixed(3)}%。`,`原分母在${bounds.rounded-bounds.scale/2}至${bounds.rounded+bounds.scale/2}的范围，商在${bounds.lower.toFixed(4)}%至${bounds.upper.toFixed(4)}%之间。`,canStop!==null?`这个范围整体落在同一选项的最近区域，可以确定选项；不是只看估算点。`:`粗估范围碰到了相邻选项的分界，暂不能确定；保留原始分母继续计算。`,`用原数核对：${a}÷${b}×100%≈${fmt(n,d,5)}%，按题目要求选${answer}%。`];
  note='区间端点展示到4位，选项判断使用未舍入的边界；本题最终判分用原始整数比值。';
 }else if(category==='fraction-compare'){
  if(!Array.isArray(p.pairs)||p.pairs.length!==4)throw new Error('比较题须有四个分数');p.pairs.forEach(x=>{positive(x.n);positive(x.d);});
  let winner=0;for(let i=1;i<4;i++){safeRatio(p.pairs[i].n*p.pairs[winner].d,1);safeRatio(p.pairs[winner].n*p.pairs[i].d,1);if(p.pairs[i].n*p.pairs[winner].d>p.pairs[winner].n*p.pairs[i].d)winner=i;}
  const w=p.pairs[winner];if(p.pairs.filter(x=>x.n*w.d===w.n*x.d).length!==1)throw new Error('最大分数不唯一');
  n=winner+1;rounding=false;precision=0;prompt='下面四个正分数，哪一个最大？';hint='分母都是正数，交叉相乘比较。先观察能否同分子、同分母直接判断。';
  options=p.pairs.map((x,i)=>({value:String(i+1),label:`${x.n} / ${x.d}`}));
  steps=['两个分母都为正，乘上它们不会改变大小方向。',...p.pairs.filter((_,i)=>i!==winner).map(x=>`${w.n}×${x.d}＝${w.n*x.d}，${x.n}×${w.d}＝${x.n*w.d}；前者更大，所以${w.n}/${w.d}＞${x.n}/${x.d}。`),`因此最大的是${'ABCD'[winner]}：${w.n}/${w.d}。`];
 }else if(category==='growth-parts'){
  positive(a);positive(p.reciprocal);rate(p.rateBps);if(p.rateBps<=0||p.rateBps>=10000||p.reciprocal<=1)throw new Error('增长份数条件不满足');
  const sign=p.decline?-1:1;n=a*p.rateBps;d=10000+sign*p.rateBps;precision=2;
  const parts=p.reciprocal+sign,estimate=a/parts,exact=n/d;
  prompt=`本期为${a}万元，比上期${p.decline?'下降':'增长'}${rateText(p.rateBps)}。${p.decline?'减少量（填正数）':'增长量'}是多少万元？保留2位小数。`;
  hint=`把${rateText(p.rateBps)}与1/${p.reciprocal}比较。恰好相等才能直接用现期÷${parts}当精确值。`;
  steps=[`先认清：给的是现期，${p.decline?'减少':'增长'}量＝现期×${rateText(p.rateBps)}÷(1${p.decline?'－':'＋'}${rateText(p.rateBps)})。`,`${rateText(p.rateBps)}${p.rateBps*p.reciprocal===10000?'＝':'≈'}1/${p.reciprocal}，份数法得${a}÷${parts}≈${estimate.toFixed(2)}。`,`带入原始增长率：${a}×${p.rateBps}÷${d}≈${fmt(n,d,5)}。`,`按要求保留2位：${fmt(n,d,2)}万元。份数粗估与准确值的绝对差约${Math.abs(estimate-exact).toFixed(4)}万元。`];
  note=p.rateBps*p.reciprocal===10000?'这次百分数恰好等于单位分数，份数公式是精确等式。':'这次只接近单位分数；不能用粗估结果替代保留2位小数的答案。';
 }else if(category==='base-current'){
  positive(a);rate(p.rateBps);n=p.askBase?a*10000:a*(10000+p.rateBps);d=p.askBase?10000+p.rateBps:10000;
  prompt=`${p.askBase?'现期':'基期'}为${a}万元，增长率为${rateText(p.rateBps)}，求${p.askBase?'基期':'现期'}多少万元（保留1位小数）。`;
  hint=p.askBase?'现在＝以前×(1＋增长率)，找以前就反过来除。':'现在＝以前×(1＋增长率)，负增长也照样带符号。';
  steps=[hint,`倍率1＋(${rateText(p.rateBps)})＝${fmt(10000+p.rateBps,10000,4)}。`,`${a}${p.askBase?'÷':'×'}${fmt(10000+p.rateBps,10000,4)}≈${fmt(n,d,5)}万元。`,`按要求保留1位小数：${fmt(n,d,1)}万元。`];
  if(p.askBase){const estimate=a*(1-p.rateBps/10000);note=`若粗估为${a}×(1－${rateText(p.rateBps)})＝${estimate.toFixed(3)}，相对准确基期低${(p.rateBps**2/1e6).toFixed(4)}%；这是r²的相对误差，选项接近时不能省略。`;}
 }else if(category==='percent-points'){
  positive(a);positive(b);if(a>1000||b>1000)throw new Error('本题百分数须在0至100%');
  n=p.relative?(b-a)*100:b-a;d=p.relative?a:10;unit=p.relative?'%':'个百分点';
  prompt=`合格率从${a/10}%变为${b/10}%。${p.relative?'合格率相对原来变化了百分之几':'变化了多少个百分点'}？下降填负数，保留1位小数。`;
  hint=p.relative?'问相对变化，先用差值除以原来的合格率。':'问百分点，两个百分数前面的数直接相减。';
  steps=[`先找变化：${b/10}－${a/10}＝${(b-a)/10}个百分点。`,p.relative?`再除以原来：(${b/10}－${a/10})÷${a/10}×100%。`:'本题问百分点，不需要除以原来的合格率。',`答案为${fmt(n,d,1)}${unit}；${b<a?'负号表示下降。':b>a?'正数表示上升。':'零表示不变。'}`];
 }else if(category==='interval-growth'){
  rate(p.r1);rate(p.r2);n=(10000+p.r1)*(10000+p.r2)-100000000;d=1000000;unit='%';
  prompt=`同一指标连续两期增长率分别为${rateText(p.r1)}、${rateText(p.r2)}。两期合计增长率是多少？保留1位小数，下降填负数。`;
  hint='假设最初100，第一期乘一次倍率，第二期再乘一次倍率。';
  steps=[`第一期倍率${fmt(10000+p.r1,10000,4)}，第二期倍率${fmt(10000+p.r2,10000,4)}。`,`合计增幅＝(1＋${rateText(p.r1)})×(1＋${rateText(p.r2)})－1。`,`也可以拆成${rateText(p.r1)}＋${rateText(p.r2)}＋两者乘积；交叉项为${fmt(p.r1*p.r2,1000000,2)}个百分点。`,`最终为${fmt(n,d,1)}%。`];
 }else if(category==='weighted-growth'){
  positive(a);positive(b);rate(p.r1);rate(p.r2);const baseDen=a*(10000+p.r2)+b*(10000+p.r1);
  n=100*((a+b)*(10000+p.r1)*(10000+p.r2)-10000*baseDen);d=10000*baseDen;unit='%';
  prompt=`甲、乙两部分本期分别为${a}、${b}万元，增长率分别为${rateText(p.r1)}、${rateText(p.r2)}。两部分合计增长率是多少？保留1位小数。`;
  hint='先各自还原基期，再合计。加权时真正的权重是基期规模。';
  steps=[`甲基期＝${a}÷(1＋${rateText(p.r1)})≈${fmt(a*10000,10000+p.r1,4)}。`,`乙基期＝${b}÷(1＋${rateText(p.r2)})≈${fmt(b*10000,10000+p.r2,4)}。`,`用“合计现期÷合计基期－1”计算，中间保留未舍入值。`,`合计增幅为${fmt(n,d,1)}%，应在${rateText(Math.min(p.r1,p.r2))}与${rateText(Math.max(p.r1,p.r2))}之间。`];
 }else if(category==='average-growth'){
  rate(p.r1);rate(p.r2);n=(p.r1-p.r2)*100;d=10000+p.r2;unit='%';
  prompt=`总收入增长率为${rateText(p.r1)}，人数增长率为${rateText(p.r2)}，人均收入增长率是多少？保留1位小数，下降填负数。`;
  hint='人均＝总收入÷人数，所以增长倍率也要相除。';
  steps=[`人均增长倍率＝(1＋${rateText(p.r1)})÷(1＋${rateText(p.r2)})。`,`减掉1，化简为(${rateText(p.r1)}－${rateText(p.r2)})÷(1＋${rateText(p.r2)})。`,`按原数计算并保留1位，得${fmt(n,d,1)}%。`,`总量增长率${p.r1>p.r2?'更高，人均提高':p.r1<p.r2?'更低，人均下降':'与人数相同，人均不变'}；方向与结果一致。`];
 }else if(category==='share-change'){
  positive(a);positive(b);rate(p.r1);rate(p.r2);if(a>b||a*(10000+p.r2)>b*(10000+p.r1))throw new Error('两期的部分不能超过整体');
  n=a*(p.r1-p.r2)*100;d=b*(10000+p.r1);unit='个百分点';
  prompt=`本期某部分为${a}万元、整体为${b}万元，增长率分别为${rateText(p.r1)}、${rateText(p.r2)}。该部分比重变化多少个百分点？下降填负数，保留1位小数。`;
  hint='先比较增长率判断升降，再计算本期比重减基期比重。';
  steps=[`本期比重＝${a}÷${b}×100%≈${fmt(a*100,b,4)}%。`,`基期比重＝本期比重×(1＋整体增长率)÷(1＋部分增长率)。`,`所以比重差＝(${a}÷${b})×(${rateText(p.r1)}－${rateText(p.r2)})÷(1＋${rateText(p.r1)})。`,`换成百分点并保留1位：${fmt(n,d,1)}个百分点。`];
 }
 safeRatio(n,d);const answer=round(n,d,rounding?precision:0),key=category+':'+JSON.stringify(p);
 return{id:key,key,category,params:p,kind:options?'choice':'numeric',prompt,answer,unit,precision,rounding,numerator:n,denominator:d,hint,steps,memory:technique.rule,pitfall:technique.pitfall,note,options};
}
