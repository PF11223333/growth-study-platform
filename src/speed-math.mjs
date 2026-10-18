// All answers are computed from integer ratios. Teaching text is generated
// from the same operands, never from an independent handwritten answer key.
export const SPEED_MATH_VERSION=1;
export const FORMULA_PHOTO='./references/speed-math-formula.jpg';
export const techniques=[
 {id:'multiply-shortcut',name:'乘 1.5／1.1／0.9',group:'巧算',rule:'乘1.5＝原数加一半；乘1.1＝原数加十分之一；乘0.9＝原数减十分之一。',example:'240×1.5＝240＋120＝360',pitfall:'“错位相加”要按数位对齐，不是把数字接在后面。'},
 {id:'divide-shortcut',name:'除 5／25／125',group:'巧算',rule:'除5先乘2再除10；除25先乘4再除100；除125先乘8再除1000。',example:'375÷25＝1500÷100＝15',pitfall:'乘完以后，小数点依次左移1、2、3位。'},
 {id:'fraction-percent',name:'分数 → 百分数',group:'记忆',rule:'先算1÷分母，再乘100%。大多数便记值是近似值，要看题目要求保留几位。',example:'1/8＝12.5%；1/3≈33.3%',pitfall:'1/3不是精确的33.3%；1/2.4约为42%只适合粗估。'},
 {id:'percent-fraction',name:'百分数 → 分母',group:'记忆',rule:'把百分数和常见单位分数配对，看到12.5%能反应到1/8。',example:'6.25%＝1/16；约14.3%≈1/7',pitfall:'这里填分母，不填小数形式；百分数前的数还要除以100。'},
 {id:'squares',name:'11—30 平方数',group:'记忆',rule:'记住整十数，用邻数平方或(a＋b)²拆开算。',example:'19²＝(20－1)²＝400－40＋1＝361',pitfall:'(a－1)²不是a²－1，中间还要减2a。'},
 {id:'powers',name:'三次方与四次方',group:'估算',rule:'先算平方，三次方再乘一次原数，四次方把平方再平方。',example:'1.2⁴＝1.44²＝2.0736≈2.1（保留1位）',pitfall:'原表的2.0是便记粗估，不能当作保留1位小数的答案；“每项加0.9”不是普遍规律。'},
 {id:'addition',name:'高位叠加',group:'巧算',rule:'先加百位，再加十位和个位。把一个大加法拆成几步小加法。',example:'368＋257：368＋200＝568，再加50、7，得625。',pitfall:'进位要带上；高位叠加并不是忽略低位。'},
 {id:'subtraction',name:'减法凑整',group:'巧算',rule:'减去接近整百的数，先减整百，再把多减的补回来。',example:'642－198＝642－200＋2＝444',pitfall:'多减要加回；如果减数比整百大，就还要再减。'},
 {id:'multiply-split',name:'化乘为加',group:'巧算',rule:'把一个因数拆成整十数和个位，分别乘完再相加。',example:'24×17＝24×10＋24×7＝240＋168＝408',pitfall:'拆开的每一部分都要乘，不能漏掉个位的乘积。'},
 {id:'percent-product',name:'百分数乘法',group:'应用',rule:'先看能不能换成熟悉的分数，比如12.5%＝1/8，25%＝1/4。',example:'640×12.5%＝640÷8＝80',pitfall:'25%是0.25，不是25；最后按题目精度处理。'},
 {id:'estimate-choice',name:'看选项定精度',group:'应用',rule:'选项差得远可以先估；差得近要保留更多数字，并检查舍入方向。',example:'27%与37%很好区分；27.1%与27.2%就要细算。',pitfall:'“差得远”要看具体差距，粗估值靠近两个选项中间时仍需提高精度。'}
];
export const fractionTable=[2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5,8,8.5,9,9.5,10,10.5,11,12,13,14,15,16,17,18,19,20,2.7,2.4].map(d=>({denominator:d,precision:d===16?2:[2,2.5,4,5,10,20,2.7,2.4].includes(d)?0:1,coarse:d===2.7||d===2.4}));
const byId=new Map(techniques.map(t=>[t.id,t]));
export function seededRandom(seed){let state=Number(seed)>>>0;return()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function shuffle(items,random){const rows=[...items];for(let i=rows.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]];}return rows;}
function integer(random,min,max){return min+Math.floor(random()*(max-min+1));}
function pick(rows,random){return rows[Math.floor(random()*rows.length)];}
export function roundedRatio(n,d,places=0){
 let a=BigInt(n),b=BigInt(d);if(b<=0n||!Number.isInteger(places)||places<0||places>6)throw new Error('Invalid ratio');
 const negative=a<0n;if(negative)a=-a;const scale=10n**BigInt(places),scaled=a*scale;let value=scaled/b;if((scaled%b)*2n>=b)value++;
 let result=value.toString().padStart(places+1,'0');if(places)result=result.slice(0,-places)+'.'+result.slice(-places);return(negative&&value?'-':'')+result;
}
const compact=s=>s.includes('.')?s.replace(/0+$/,'').replace(/\.$/,''):s;
function exactRatio(n,d){return compact(roundedRatio(n,d,6));}
function pctFact(entry){const n=1000,d=Math.round(entry.denominator*10);return roundedRatio(n,d,entry.precision);}
function decimal(value){const s=String(value).normalize('NFKC').trim().replace(/%$/,'').trim();if(!/^[+-]?(?:\d{1,12}(?:\.\d{0,8})?|\.\d{1,8})$/.test(s))return null;const negative=s.startsWith('-'),[whole,part='']=s.replace(/^[+-]/,'').split('.');return{n:BigInt((whole||'0')+part)*(negative?-1n:1n),d:10n**BigInt(part.length)};}
export function normalizeMathInput(value){let s=String(value??'').normalize('NFKC').trim();if(/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?%?$/.test(s))s=s.replaceAll(',','');return s;}
export function gradeMathAnswer(question,value){const normalized=normalizeMathInput(value);if(normalized.endsWith('%')&&question.unit!=='%')return{valid:false,correct:false,message:'本题填普通数值，不加百分号。'};const a=decimal(normalized),b=decimal(question.answer);if(!a||!b)return{valid:false,correct:false,message:'请输入数字，例如 12.5。百分数题可填12.5或12.5%。'};const correct=question.rounding?roundedRatio(a.n,a.d,question.precision)===question.answer:a.n*b.d===b.n*a.d;return{valid:true,correct,message:correct?'与要求的精度一致。':`参考答案：${question.answer}${question.unit||''}`};}

export function makeMathQuestion(category,p){
 if(!byId.has(category))throw new Error('Unknown technique');
 let prompt='',n=0,d=1,precision=0,rounding=false,unit='',hint='',steps=[],memory='',note='',options;
 const technique=byId.get(category),a=p.a,b=p.b;
 if(category==='multiply-shortcut'){
  const multiplier=p.factor,den=multiplier===15?2:10,num=multiplier===15?3:multiplier;n=a*num;d=den;
  prompt=`${a} × ${multiplier/10} ＝ ?`;const piece=exactRatio(a,multiplier===15?2:10),add=multiplier!==9;
  hint=multiplier===15?'把1.5拆成1＋0.5。':`把${multiplier/10}拆成1${add?'＋':'－'}0.1。`;
  steps=[hint,`原数的${multiplier===15?'一半':'十分之一'}是 ${piece}。`,`${a} ${add?'＋':'－'} ${piece} ＝ ${exactRatio(n,d)}。`];memory=technique.rule;
 }else if(category==='divide-shortcut'){
  const factor={5:2,25:4,125:8}[b],zeros={5:10,25:100,125:1000}[b];n=a;d=b;prompt=`${a} ÷ ${b} ＝ ?`;hint=`先把${a}乘${factor}，再除以${zeros}。`;
  steps=[`因为 ${b}×${factor}＝${zeros}，把除数凑成整十、整百或整千。`,`${a}×${factor}＝${a*factor}。`,`${a*factor}÷${zeros}＝${exactRatio(n,d)}。`];memory=technique.rule;
 }else if(category==='fraction-percent'||category==='percent-fraction'){
  const entry=fractionTable[p.index];if(!entry)throw new Error('Invalid fraction');const percent=pctFact(entry),den=entry.denominator;
  if(category==='fraction-percent'){n=1000;d=Math.round(den*10);precision=entry.precision;rounding=true;unit='%';prompt=`1 / ${den} 化成百分数是多少？${precision?`保留${precision}位小数`:'四舍五入到整数百分数'}。`;hint='先算1÷分母，再乘100%，填百分号前面的数。';}
  else{n=Math.round(den*10);d=10;prompt=`${percent}% ${entry.coarse?'粗略对应':'对应或近似对应'} 1 / □，□ 应填多少？`;hint='想一想：百分号前的数 × 分母，应当接近100。';}
  const exact=100/den;
  steps=[`单位分数转百分数：1÷${den}×100%。`,`算得约 ${exact.toFixed(6).replace(/0+$/,'').replace(/\.$/,'')}%，按本题要求记作 ${percent}%。`,`所以 ${percent}% ${Number(percent)===exact?'＝':'≈'} 1/${den}。`];
  memory=den===17||den===18||den===19?'17、18、19的倒数约为5.9%、5.6%、5.3%；把分母和百分数一对一记。':`把“${den}”和“${percent}%”配成一对。`;
  if(entry.coarse)note=`${percent}%是原表用于粗估的便记值；更细一点，1/${den}≈${exact.toFixed(1)}%。选项接近时要提高精度。`;
 }else if(category==='squares'){
  n=p.reverse?a:a*a;prompt=p.reverse?`哪个正整数的平方是 ${a*a}？`:`${a}² ＝ ?`;const anchor=Math.round(a/10)*10,delta=a-anchor;
  hint=`把${a}看成${anchor}${delta<0?'减':'加'}${Math.abs(delta)}，用平方展开。`;
  steps=delta===0?[`${a}²＝${a}×${a}。`,`先算 ${a/10}×${a/10}＝${a*a/100}。`,`两个因数各有一个0，积后面补两个0，得到 ${a*a}。`]:[`${a}²＝(${anchor}${delta<0?'－':'＋'}${Math.abs(delta)})²。`,`${anchor}² ${delta<0?'－':'＋'} 2×${anchor}×${Math.abs(delta)} ＋ ${delta*delta}。`,`＝${anchor*anchor} ${delta<0?'－':'＋'} ${2*anchor*Math.abs(delta)} ＋ ${delta*delta}＝${a*a}。`];if(p.reverse)steps.push(`因此要填的正整数是 ${a}。`);memory=technique.rule;
 }else if(category==='powers'){
  n=a**p.exponent;d=10**p.exponent;precision=1;rounding=true;prompt=`${a/10}${p.exponent===3?'³':'⁴'} 约等于多少？四舍五入保留1位小数。`;hint=p.exponent===4?'先算平方，再把平方乘自己。':'先算平方，再乘一次原数。';
  const square=exactRatio(a*a,100);steps=[`${a/10}²＝${square}。`,p.exponent===4?`${a/10}⁴＝${square}×${square}＝${exactRatio(n,d)}。`:`${a/10}³＝${square}×${a/10}＝${exactRatio(n,d)}。`,`保留1位小数，得到 ${roundedRatio(n,d,1)}。`];memory=technique.rule;
  if(a===12&&p.exponent===4)note='原表约2.0属于较粗的便记值；精确值2.0736按保留1位小数应写2.1。本训练统一按题目精度判分。';
 }else if(category==='addition'){
  n=a+b;prompt=`${a} ＋ ${b} ＝ ?`;const hundreds=Math.floor(b/100)*100,tens=Math.floor(b%100/10)*10,ones=b%10;
  hint='把第二个数按数位拆开，从高位开始加。';steps=hundreds?[`${b}＝${hundreds}＋${tens}＋${ones}。`,`${a}＋${hundreds}＝${a+hundreds}。`,`${a+hundreds}＋${tens}＝${a+hundreds+tens}，再加${ones}，得 ${n}。`]:[`${b}＝${tens}＋${ones}。`,`先加十位：${a}＋${tens}＝${a+tens}。`,`再加个位：${a+tens}＋${ones}＝${n}。`];memory=technique.rule;
 }else if(category==='subtraction'){
  n=a-b;const anchor=Math.round(b/100)*100,correction=anchor-b;prompt=`${a} － ${b} ＝ ?`;hint=`${b}靠近${anchor}，先减去${anchor}。`;
  steps=[`先算 ${a}－${anchor}＝${a-anchor}。`,correction>=0?`刚才多减了${correction}，要加回来。`:`刚才少减了${-correction}，还要减掉。`,`${a-anchor}${correction>=0?'＋':'－'}${Math.abs(correction)}＝${n}。`];memory=technique.rule;
 }else if(category==='multiply-split'){
  n=a*b;const tens=Math.floor(b/10)*10,ones=b%10;prompt=`${a} × ${b} ＝ ?`;hint=b<10?`把${a}拆成整十数和个位，分别乘${b}。`:`把${b}拆成${tens}＋${ones}。`;
  const base=b<10?Math.floor(a/10)*10:tens,rest=b<10?a%10:ones,factor=b<10?b:a;
  steps=[hint,`${factor}×${base}＝${factor*base}；${factor}×${rest}＝${factor*rest}。`,`两部分加起来：${factor*base}＋${factor*rest}＝${n}。`];memory=technique.rule;
 }else if(category==='percent-product'){
  const ratio=[{n:1,d:8,label:'12.5%'},{n:1,d:4,label:'25%'},{n:1,d:5,label:'20%'},{n:1,d:2,label:'50%'},{n:1,d:16,label:'6.25%'},{n:3,d:20,label:'15%'},{n:3,d:10,label:'30%'}][p.index];if(!ratio)throw new Error('Invalid percentage');n=a*ratio.n;d=ratio.d;precision=2;rounding=true;
  prompt=`${a} × ${ratio.label} ＝ ? 保留2位小数。`;hint=`${ratio.label}＝${ratio.n}/${ratio.d}，先除${ratio.d}${ratio.n>1?`再乘${ratio.n}`:''}。`;
  steps=[hint,`${a}÷${ratio.d}＝${exactRatio(a,ratio.d)}。`,...(ratio.n>1?[`再乘${ratio.n}，得到 ${exactRatio(n,d)}。`]:[]),`按要求保留2位小数：${roundedRatio(n,d,2)}。`];memory=technique.rule;
 }else if(category==='estimate-choice'){
  n=a*100;d=b;precision=p.close?1:0;rounding=true;unit='%';const answer=roundedRatio(n,d,precision),offset=p.close?1:100,answerTenths=Math.round(Number(answer)*10),random=seededRandom(p.seed);
  options=shuffle([0,-offset,offset,2*offset].map(delta=>({value:((answerTenths+delta)/10).toFixed(precision)})),random);
  prompt=`${a} ÷ ${b} 约为多少？${precision?'四舍五入保留1位小数':'四舍五入到整数百分数'}。`;hint=p.close?'选项只差0.1个百分点，保留足够数字，先找整数百分数再细分。':'选项差10个百分点，可以先用容易心算的数定位。';
  const whole=Math.floor(a*100/b),low=(whole*b/100).toFixed(2);
  steps=[hint,`${b}的${whole}%是${low}，先把结果定位在${whole}%与${whole+1}%之间。`,`${a}÷${b}×100%≈${(a*100/b).toFixed(5)}%。`,`按题目精度选择 ${answer}%。`];memory=technique.rule;
 }
 const answer=rounding?roundedRatio(n,d,precision):exactRatio(n,d),key=category+':'+JSON.stringify(p);
 return {id:key,key,category,params:p,kind:options?'choice':'numeric',prompt,answer,unit,precision,rounding,numerator:n,denominator:d,hint,steps,memory,pitfall:technique.pitfall,note,options};
}
function parameters(category,random,level){const applied=level==='applied';switch(category){
 case'multiply-shortcut':return{a:integer(random,applied?101:20,applied?9999:500),factor:pick([15,11,9],random)};
 case'divide-shortcut':return{a:integer(random,applied?101:10,applied?9999:1500),b:pick([5,25,125],random)};
 case'fraction-percent':case'percent-fraction':return{index:integer(random,0,fractionTable.length-1)};
 case'squares':return{a:integer(random,11,30),reverse:random()<.25};
 case'powers':return{a:pick([12,13,14],random),exponent:pick([3,4],random)};
 case'addition':return{a:integer(random,applied?100:10,applied?999:99),b:integer(random,applied?100:10,applied?999:99)};
 case'subtraction':{const base=pick(applied?[200,300,500,1000]:[100,200,300],random),b=base+pick([-9,-8,-3,-2,-1,1,2,3,8,9],random);return{a:b+integer(random,20,applied?999:300),b};}
 case'multiply-split':return{a:integer(random,12,89),b:applied?integer(random,12,49):integer(random,3,9)};
 case'percent-product':return{a:integer(random,applied?1000:20,applied?9999:1000),index:integer(random,0,6)};
 case'estimate-choice':{const b=integer(random,20000,90000),a=Math.floor(b*integer(random,12,75)/100)+integer(random,1,99);return{a,b,close:random()<.5,seed:integer(random,0,2147483646)};}
 default:throw new Error('Unknown technique');}}
export function buildMathRound({categories=techniques.map(t=>t.id),size=10,seed=Date.now(),level='foundation',previousKeys=[],reviewQuestions=[]}={}){
 const random=seededRandom(seed),ids=[...new Set(categories)].filter(id=>byId.has(id));if(!ids.length)throw new Error('至少选择一种技巧');if(![10,20].includes(size))throw new Error('题量须为10或20');
 if(reviewQuestions.length)return shuffle([...new Map(reviewQuestions.map(q=>[q.key,q])).values()],random).slice(0,size).map(q=>makeMathQuestion(q.category,q.params));
 const rows=[],keys=new Set(),previous=new Set(previousKeys);let bag=[];
 while(rows.length<size){const available=ids.filter(id=>id!=='powers'||rows.filter(q=>q.category===id).length<6);if(!available.length)break;bag=bag.filter(id=>available.includes(id));if(!bag.length)bag=shuffle(available,random);if(available.length>1&&bag[0]===rows.at(-1)?.category){const i=bag.findIndex(id=>id!==bag[0]);if(i>0)[bag[0],bag[i]]=[bag[i],bag[0]];else bag=shuffle(available.filter(id=>id!==bag[0]),random);}
  const category=bag.shift();let q;for(let attempt=0;attempt<150;attempt++){q=makeMathQuestion(category,parameters(category,random,level));if(!keys.has(q.key)&&(!previous.has(q.key)||attempt>=100))break;}
  if(keys.has(q.key))continue;keys.add(q.key);rows.push(q);
 }return rows;
}

export function emptyMathWorkspace(){return{schemaVersion:1,events:[],session:null};}
export function mathMistakes(events){const latest=new Map();for(const event of events)if(event.outcome!=='skipped')latest.set(event.question.key,event);return [...latest.values()].filter(e=>e.outcome==='wrong'||e.outcome==='viewed'||e.hintUsed).reverse();}
export function mathStatistics(events){return techniques.map(technique=>{const rows=events.filter(e=>e.question.category===technique.id),independent=rows.filter(e=>!e.hintUsed&&['correct','wrong'].includes(e.outcome)),correct=independent.filter(e=>e.outcome==='correct').length;return{...technique,seen:rows.length,attempts:independent.length,correct,rate:independent.length?correct/independent.length:null,averageMs:independent.length?Math.round(independent.reduce((s,e)=>s+e.elapsedMs,0)/independent.length):null,needsWork:rows.filter(e=>e.outcome==='wrong'||e.outcome==='viewed'||e.hintUsed).length};});}
export function recordMathEvent(workspace,event){if(workspace.events.some(e=>e.id===event.id))return workspace;return{...workspace,events:[...workspace.events,event].slice(-1000)};}
function validQuestion(q){try{return!!q&&byId.has(q.category)&&q.params&&makeMathQuestion(q.category,q.params).answer===q.answer&&makeMathQuestion(q.category,q.params).key===q.key;}catch{return false;}}
function canonicalEvent(e){
 if(!e||typeof e.id!=='string'||!e.id||e.id.length>400||typeof e.sessionId!=='string'||typeof e.answer!=='string'||e.answer.length>100||typeof e.hintUsed!=='boolean'||typeof e.at!=='string'||!Number.isFinite(Date.parse(e.at))||!['correct','wrong','viewed','skipped'].includes(e.outcome)||!Number.isFinite(e.elapsedMs)||e.elapsedMs<0||e.elapsedMs>1e12||!validQuestion(e.question))throw new Error('速算记录损坏，未覆盖已有进度');
 const q=makeMathQuestion(e.question.category,e.question.params),grade=gradeMathAnswer(q,e.answer);
 if(['correct','wrong'].includes(e.outcome)&&(!grade.valid||grade.correct!==(e.outcome==='correct')))throw new Error('作答与判分不一致，未覆盖已有进度');
 return{id:e.id,sessionId:e.sessionId,question:q,answer:e.answer,outcome:e.outcome,elapsedMs:e.elapsedMs,hintUsed:e.hintUsed,at:e.at};
}
export function loadMathWorkspace(raw){
 const w=typeof raw==='string'?JSON.parse(raw):raw;if(!w||w.schemaVersion!==1||!Array.isArray(w.events)||w.events.length>1000)throw new Error('速算记录格式或版本不支持');
 const events=w.events.map(canonicalEvent);
 if(new Set(events.map(e=>e.id)).size!==events.length)throw new Error('存在重复事件');
 let session=w.session;if(session){if(typeof session.id!=='string'||!session.id||!Array.isArray(session.questions)||session.questions.length>20||!session.questions.length||!session.questions.every(validQuestion)||!Number.isInteger(session.index)||session.index<0||session.index>session.questions.length||!Array.isArray(session.answers)||session.answers.length>session.questions.length||!Number.isFinite(session.elapsedMs)||session.elapsedMs<0||typeof session.draft!=='string'||session.draft.length>100||typeof session.hintUsed!=='boolean')throw new Error('训练轮次损坏，未覆盖已有进度');const answers=session.answers.map(canonicalEvent);if(new Set(answers.map(e=>e.id)).size!==answers.length||answers.some(e=>{const i=Number(e.id.slice(session.id.length+1));return e.sessionId!==session.id||e.id!==`${session.id}:${i}`||!Number.isInteger(i)||i>session.index||e.question.key!==session.questions[i]?.key;}))throw new Error('训练结果与题目不一致，未覆盖已有进度');session={...session,answers,questions:session.questions.map(q=>makeMathQuestion(q.category,q.params)),paused:true};}
 return{schemaVersion:1,events,session};
}
