import {read,write,backup,atomic,DATA,hash} from '../server/store.mjs';
import path from 'node:path';
import fs from 'node:fs';
import {enrichMemoryEvidence} from './memory-evidence.mjs';
import {fileURLToPath} from 'node:url';
import {enrichOptions} from './enrich-options.mjs';
import {enrichTeaching} from './enrich-teaching.mjs';
const lawUrl='https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2025/art_8a1c722747214869b28c0ad7a0f8bb7a.html';
const lawTitle='《治安管理处罚法》（2025年修订，2026年施行）';
export function prepareDrills(db){
 let added=0,updated=0;
 const existing=new Set(db.records.map(r=>r.id));
 const add=(parent,key,q,origin='imported-quiz')=>{
  const matching=origin==='generated'?db.records.find(r=>!r.archived&&r.studyQuestion?.origin==='generated'&&r.details.question.prompt===q.prompt):null;
  const id=matching?.id||'exercise-'+hash(parent.id+':'+key).slice(0,24);if(existing.has(id)){const old=db.records.find(r=>r.id===id);if(!old.edited&&Object.keys(q).some(k=>JSON.stringify(old.details.question[k])!==JSON.stringify(q[k]))){Object.assign(old.details.question,q);old.studyQuestion.type=q.type;old.revision++;updated++;}return;}
  db.records.push({id,kind:'practice',title:`${origin==='generated'?'巩固新题':'知识自测'} · ${parent.title}`.slice(0,240),body:q.prompt,subject:parent.subject,topic:parent.topic,date:'2026-10-07',tags:['刷题',origin==='generated'?'自编巩固题':'原资料自测'],sourceRefs:parent.sourceRefs||[],links:[parent.id],revision:1,studyQuestion:{bank:origin==='generated'?'reinforcement':'knowledge-quizzes',chapter:parent.studyQuestion?.chapter||0,chapterName:parent.studyQuestion?.chapterName||parent.topic,sectionId:parent.studyQuestion?.sectionId||parent.subject,sectionName:parent.studyQuestion?.sectionName||parent.topic,type:q.type,number:added+1,promptPreview:q.prompt.slice(0,180),origin,parentId:parent.id},details:{question:{...q,parentId:parent.id,answerCardId:parent.id,origin}},aiContent:{type:origin==='generated'?'自编巩固练习':'已有自测转为刷题',derivedFrom:parent.id,verifiedAt:origin==='generated'?'2026-10-07':undefined},createdAt:'2026-10-07T04:00:00.000Z'});existing.add(id);added++;
 };
 const originals=[...db.records];
 for(const r of originals){
  if(r.studyQuestion){
   if(r.studyQuestion.bank!=='police-drill-20260917')continue;
   const q=r.details.question,observed=q.observedAnswers||[],blue=observed.find(a=>a.color==='blue'),red=observed.find(a=>a.color==='red'&&!a.meaning);
   const historicalWrong=!!blue&&(!red||red.answer!==blue.answer);
   const candidate=!!r.studyQuestion.blueMark&&!historicalWrong;
   const classification={historicalWrong,wrongCandidate:candidate,historicalCorrect:!!r.studyQuestion.redMark&&!r.studyQuestion.blueMark,historicalAnswer:red?.answer||'',correctionAnswer:blue?.answer||'',inkRule:'用户确认：红笔作答，蓝笔纠正；无蓝笔的红笔题作答正确'};
   if(Object.entries(classification).some(([k,v])=>r.studyQuestion[k]!==v)){Object.assign(r.studyQuestion,classification);r.revision++;updated++;}
   continue;
  }
  const quizzes=[r.details?.miniQuiz,r.details?.quiz].flat().filter(x=>x?.question && (x.answer!==undefined&&x.answer!==''||x.correctAnswer!==undefined&&x.correctAnswer!==''));
  for(const [i,q]of quizzes.entries()){
   const choices=q.choices||q.options;const opts=Array.isArray(choices)?Object.fromEntries(choices.map((t,i)=>[String.fromCharCode(65+i),String(t).replace(/^[A-D][.、．：:]\s*/,'')])):choices;
   const rawAnswer=q.answer??q.correctAnswer;
   const answer=typeof rawAnswer==='number'&&opts&&Number.isInteger(rawAnswer)&&rawAnswer>=0&&rawAnswer<Object.keys(opts).length?String.fromCharCode(65+rawAnswer):String(rawAnswer);
   const multiple=/^[A-D]{1,4}$/.test(answer.trim());
   const type=opts&&multiple?(answer.length===1?'single':'multi'):'recall';
   add(r,'quiz-'+i,{type,prompt:q.question,options:opts||{},referenceAnswer:answer,explanation:{category:q.explanation||'知识点提取不完整',keyCondition:q.explanation||r.details?.rule||'对照原资料中决定答案的条件。',memory:r.details?.memory||r.details?.storyMemory||'先说规则，再用一个例子检验。',diagnosis:'结合参考答案核对遗漏的条件或关键词。',legalBasis:(r.sourceRefs||[]).filter(x=>x.url).map(x=>({title:x.label||'原资料来源',url:x.url,verification:'原自测的来源链接；非本次新增法律核验'}))}});
  }
 }
 const findLaw=(pattern)=>originals.find(r=>r.studyQuestion&&r.kind==='practice'&&pattern.test(r.details?.question?.prompt||''));
 const lawParent=findLaw(/罂粟/);
 const bases=(article)=>[{title:lawTitle,url:lawUrl,article,verification:'2026-10-07 对照官方现行文本编写'}];
 const makeLaw=(key,prompt,options,answer,reason,memory,article,parent=lawParent)=>{
  const precise=originals.find(r=>r.studyQuestion?.bank==='police-drill-20260917'&&r.details?.question?.explanation?.legalBasis?.some(b=>b.url===lawUrl&&b.article===article));
  if(parent)add(precise||parent,key,{type:answer.length>1?'multi':'single',prompt,options:Object.fromEntries(options.map((s,i)=>[String.fromCharCode(65+i),s])),referenceAnswer:answer,explanation:{category:'条件或法律性质混淆',keyCondition:reason,memory,diagnosis:reason,legalBasis:bases(article)}},'generated');
 };
 for(const [i,count]of[120,260,499].entries())makeLaw('poppy-'+i,`甲非法种植罂粟${count}株，在成熟前自行全部铲除。仅就该种植行为，依现行治安管理处罚法应如何处理？`,['从重处罚','只可从轻处罚','必须减轻处罚','不予处罚'],'D','本题同时满足不满500株、成熟前、自行铲除三个条件，适用特别不予处罚规则。','少于五百＋未成熟＋自己铲，三项齐才不处罚。','第八十三条');
 makeLaw('poppy-boundary','非法种植罂粟后自行铲除，下列哪一种情形满足第八十三条的特别不予处罚条件？',['499株，成熟前自行铲除','500株，成熟前自行铲除','499株，成熟后自行铲除','499株，成熟前由民警代为铲除'],'A','“不满500株”不包含500；成熟后或由民警代为铲除都不符合题设特别规则。','不满排等号，成熟看时点，自行看主体。','第八十三条');
 makeLaw('poppy-multi','罂粟种植行为适用第八十三条特别不予处罚规则，需要同时核对哪些条件？',['种植不满500株','在成熟前铲除','行为人自行铲除','必须由被害人谅解'],'ABC','数量、阶段、主动主体是本题条件；不需要另加被害人谅解。','株数、时点、主体一起查。','第八十三条');
 const admin=findLaw(/处罚/);
 makeLaw('penalty-types','下列哪项属于治安管理处罚的法定种类？',['刑事拘留','行政拘留','拘传','取保候审'],'B','行政拘留是治安处罚；刑事拘留、拘传和取保候审属于刑事强制措施。','先分处罚与强制，再辨行政与刑事。','第十条',admin);
 makeLaw('penalty-multi','下列属于治安管理处罚种类的是：',['警告','罚款','行政拘留','吊销公安机关发放的许可证件'],'ABCD','四项均列入第十条，不能把吊销公安机关发放的许可证件漏掉。','警、罚、拘、吊，四种记全。','第十条',admin);
 for(const age of[12,13])makeLaw('age-under-'+age,`乙${age}周岁，实施违反治安管理的行为。依第十二条，处罚适用规则是哪项？`,['正常处罚','只从轻处罚','不予处罚，责令监护人严加管教','只减轻处罚'],'C','不满14周岁适用不予处罚，并责令监护人严加管教。此题问处罚适用，不问矫治教育的其他措施。','未满十四不处罚，监护人须管教。','第十二条',admin);
 for(const age of[14,17])makeLaw('age-older-'+age,`丙${age}周岁，违反治安管理。仅就年龄对处罚适用的影响，哪项符合第十二条？`,['一律不予处罚','从轻或者减轻处罚','一律从重处罚','与年龄无关'],'B','已满14周岁不满18周岁适用从轻或者减轻；不要把处罚适用和行政拘留是否执行混为一谈。','十四到十八，从轻或减轻。','第十二条',admin);
 makeLaw('combined-detention','行为人有两种以上违反治安管理行为，行政拘留合并执行最长不超过多少日？',['15日','20日','30日','没有上限'],'B','分别决定、合并执行，行政拘留合并执行最长20日。','分别定，合并执，拘留顶线二十日。','第十六条',admin);
 makeLaw('lenient-merit','行为人违反治安管理，但有立功表现，第20条的规则是什么？',['必须从重处罚','从轻、减轻或者不予处罚','只能从轻','只能免于执行拘留'],'B','立功属于第20条的从轻、减轻或者不予处罚情形；不能缩成只从轻。','立功看二十，轻、减、不予三层记。','第二十条',admin);
 makeLaw('retaliation','对举报人因举报行为进行打击报复，作为违反治安管理行为的处罚情节，应如何适用？',['从重处罚','必须不予处罚','只从轻处罚','一律只作警告'],'A','对报案人、控告人、举报人、证人打击报复，属于第22条从重处罚情形。','打击报复，从重记。','第二十二条',admin);
 makeLaw('discovery-limit','违反治安管理行为在六个月以内未被公安机关发现，依第25条的一般规则如何处理？',['照常处罚','不再处罚','一律移送刑事立案','一律加倍罚款'],'B','超过法定发现期限适用不再处罚；不是题本标记的“答对”，也不是犯罪的追诉时效。','六个月未发现，治安不再罚。','第二十五条',admin);
 makeLaw('continuing-time','违反治安管理行为有连续或继续状态，六个月发现期限从何时开始计算？',['首次行为发生时','行为终了时','报案时','决定处罚时'],'B','连续或继续状态从行为终了之日起计算，不能一律从第一次发生算。','连续继续看终了。','第二十五条',admin);
 const crimeParent=originals.find(r=>r.subject==='gongan'&&/正当防卫/.test(r.title))||originals.find(r=>r.studyQuestion?.sectionId==='criminal-law');
 const crimeUrl='https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2025/art_890f1333b6284c3cbb225c3cd2647c4b.html';
 const extra=(parent,key,prompt,options,answer,reason,memory,title,url,article)=>{if(parent)add(parent,key,{type:answer.length>1?'multi':'single',prompt,options:Object.fromEntries(options.map((s,i)=>[String.fromCharCode(65+i),s])),referenceAnswer:answer,explanation:{category:'犯罪阶段或程序条件混淆',keyCondition:reason,memory,diagnosis:reason,legalBasis:[{title,url,article,verification:'2026-10-07 对照官方所列条文核对本题规则'}]}},'generated');};
 const crime=(key,prompt,opts,answer,reason,memory,article)=>extra(crimeParent,key,prompt,opts,answer,reason,memory,'《刑法》总则相关条文',crimeUrl,article);
 crime('prepare','为了实施盗窃，甲购买撬锁工具，尚未着手盗窃即被发现。仅判断犯罪阶段，最符合哪项？',['犯罪既遂','犯罪预备','犯罪未遂','当然无罪'],'B','尚未着手实行，只为犯罪准备工具，属于预备阶段。','备工具未着手，看预备。','第二十二条');
 crime('attempt','甲已着手盗窃，但因保安及时发现并制止而未得逞。仅判断犯罪阶段，属于：',['犯罪预备','犯罪既遂','犯罪未遂','犯罪中止'],'C','已经着手，由意志以外原因被阻止而未得逞，符合未遂。','已着手＋外力停，未遂。','第二十三条');
 crime('stop','甲在能够继续实施犯罪的情况下，自愿彻底放弃犯罪，且尚未造成损害。符合犯罪中止时，依法应如何处罚？',['必须从重','仅可以从轻','应当免除处罚','必须按既遂处罚'],'C','自动放弃构成中止，且没有造成损害，应当免除处罚。','能继续却自停，无损中止免处罚。','第二十四条');
 crime('stop-damage','犯罪中止并已造成损害，依第24条应如何处理？',['应当减轻处罚','一律免除处罚','仅可以从轻处罚','一律从重处罚'],'A','中止无损免除，有损应当减轻；注意“应当”与“可以”。','无损免，有损减。','第二十四条');
 crime('attempt-elements','判断犯罪未遂需要哪些条件？',['已经着手实行犯罪','未得逞','由于意志以外原因未得逞','仅仅产生犯罪想法'],'ABC','未遂要求着手、未得逞、意志以外原因，想法本身不是未遂。','着手、失败、外因，三要件。','第二十三条');
 crime('defense-over','正当防卫明显超过必要限度且造成重大损害，处罚规则是什么？',['一律不负责任','应当负刑事责任，但应当减轻或者免除处罚','必须从重','只能从轻'],'B','限度明显过大且损害重大，应负刑事责任，但法定要求减轻或免除。','明显超限＋重大损害，过当减或免。','第二十条');
 const procParent=originals.find(r=>r.subject==='gongan'&&/拘传时间/.test(r.title))||originals.find(r=>r.studyQuestion?.sectionId==='criminal-procedure');
 const procUrl='https://www.gov.cn/zhengce/2021-12/25/content_5712867.htm';
 const proc=(key,prompt,opts,answer,reason,memory)=>extra(procParent,key,prompt,opts,answer,reason,memory,'《公安机关办理刑事案件程序规定》',procUrl,'第八十条');
 proc('summon-normal','普通案件拘传持续时间，一般不得超过多少小时？',['8小时','12小时','24小时','48小时'],'B','普通拘传上限12小时，24小时是满足特定条件并经批准的例外。','普通十二，特大复杂批准二十四。');
 proc('summon-special','案情特别重大、复杂，需要拘留或逮捕，并经县级以上公安机关负责人批准，拘传最长可持续多少小时？',['6小时','12小时','24小时','36小时'],'C','特大复杂、需要拘留逮捕、负责人批准三个条件齐备，才能适用24小时上限。','重大复杂＋需拘捕＋批准，才到二十四。');
 proc('summon-consecutive','为了突破拘传时限，连续拘传同一犯罪嫌疑人，哪项判断正确？',['可以无条件进行','只要换办案人员即可','只要换地点即可','不得以连续拘传变相拘禁'],'D','不能用连续拘传绕过时限，换人或换地点不改变变相拘禁性质。','换人换地不续钟。');
 proc('summon-rest','拘传期限届满，尚未决定采取其他强制措施，应如何处理？',['立即结束拘传','继续拘传等待决定','换地点重新计时','换办案人后重新计时'],'A','期限届满且未作出其他强制措施决定，应立即结束拘传。','拘传到点，无新措施立即止。');
 const math=originals.find(r=>r.subject==='xingce'&&r.details?.miniQuiz?.question&&/增长率/.test(r.title));
 if(math)for(const [i,b]of[120,200,320,400,500,800,1000,1600].entries()){
  const rate=[.1,.2,.25,.5][i%4],current=b*(1+rate),increase=b*rate,correct=i%4;
  const numbers=[b,b+increase,b-increase,Math.round(current/(1-rate))];const options={};for(let j=0;j<4;j++)options[String.fromCharCode(65+j)]=String(numbers[(j-correct+4)%4]);
  add(math,'base-'+i,{type:'single',prompt:`某地区本年业务量为${current}，同比增长${rate*100}%。上年业务量是多少？`,options,referenceAnswer:String.fromCharCode(65+correct),explanation:{category:'分母或基期现期混淆',keyCondition:`基期量=现期量÷(1+增长率)=${current}÷${1+rate}=${b}。`,memory:'求基期，现期除以一加率。',diagnosis:'增长率的分母是基期量，不能用现期直接减去现期乘增长率。',legalBasis:[]}},'generated');
  add(math,'rate-'+i,{type:'single',prompt:`去年业务量${b}，今年${current}，同比增长率是多少？`,options:{A:`${Math.round(increase/current*10000)/100}%`,B:`${rate*100}%`,C:`${(1+rate)*100}%`,D:`${rate*1000}%`},referenceAnswer:'B',explanation:{category:'增长率分母用错',keyCondition:`增长率=(现期-基期)÷基期=(${current}-${b})÷${b}=${rate*100}%。`,memory:'增长量除基期，分母莫用现期。',diagnosis:'若用今年作分母，得到增长量占现期的比例，不是同比增长率。',legalBasis:[]}},'generated');
 }
 const generatedPrompts=new Set();for(const r of db.records)if(!r.archived&&r.studyQuestion?.origin==='generated'){const prompt=r.details.question.prompt;if(generatedPrompts.has(prompt)){r.archived=true;r.revision++;updated++;}else generatedPrompts.add(prompt);}
 updated+=enrichOptions(db).changed;
 updated+=enrichTeaching(db).changed;
 const lawFile=path.join(DATA,'law-excerpts.json');if(fs.existsSync(lawFile))updated+=enrichMemoryEvidence(db,JSON.parse(fs.readFileSync(lawFile,'utf8'))).changed;
 const audit={added,updated,questions:db.records.filter(r=>r.studyQuestion&&!r.archived).length,historicalWrong:db.records.filter(r=>r.studyQuestion?.historicalWrong&&!r.archived).length,wrongCandidates:db.records.filter(r=>r.studyQuestion?.wrongCandidate&&!r.archived).length,generated:db.records.filter(r=>r.studyQuestion?.origin==='generated'&&!r.archived).length};return audit;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const db=read();backup(db);const audit=prepareDrills(db);if(audit.added||audit.updated)write(db);atomic(path.join(DATA,'drill-migration-report.json'),audit);console.log(JSON.stringify({...audit,version:db.version}));
}
