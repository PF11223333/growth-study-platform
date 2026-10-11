import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {read,write,backup,atomic,DATA} from '../server/store.mjs';
const criminal='https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2025/art_890f1333b6284c3cbb225c3cd2647c4b.html';
const procedure='https://www.nia.gov.cn/News/files/c1460628/1506344.pdf';
const basis=(title,url,article,verification='官方条文已核对；选项结论为结合题干的学习推理')=>({title,url,article,verification});
const c=(article)=>basis('《刑法》相关条文',criminal,article);
const audited={
 'drill-20260917-admin-single-0-4':{
  category:'把违禁品误当成普通的无关财物',keyCondition:'自制步枪不能仅因本次举报涉及烟花爆竹就留在现场不管。先识别违禁品或武器，再依法控制、鉴定和处理；教材原题问“不正确”，答案B。',memory:'枪不是普通无关物；危物专库放，检查要双警，住所另看证。',legalBasis:[basis('《公安机关办理行政案件程序规定》（2020修正）','https://jtgl.beijing.gov.cn/jgj/jgxx/flfg/gabgz/744068792/index.html','第五十二、五十三、八十二、一百九十一条','已核对原题所涉程序规则；不是整部规章与2026年新法兼容性的结论'),basis('《治安管理处罚法》（2025修订，2026年施行）','https://jtgl.beijing.gov.cn/jgj/jgxx/flfg/fl/744006073/index.html','第一百零三条','现行住所检查规则与旧题口径须分别学习')],
  options:{A:'原题按当时《程序规定》第82条的紧急检查口径理解：群众举报正在住所自制爆竹，有立即危及安全的风险。但这不是“凡进住所出示警察证就够”。2026年施行的新治安法第103条另明确住所检查须出示检查证；本项不能直接当成现行法无条件正确结论。',B:'本项是教材原题要选的错误说法。普通合法的无关财物不应随意扣押，但自制步枪涉及武器、违禁品和公共安全，不能因举报的案由是爆竹就断言“不必扣押”。应依法控制、鉴定并按性质处理，涉嫌犯罪还须转入刑事程序。',C:'黑火药是易燃易爆危险物品，应按《程序规定》第191条的专门场所保管要求处理。扣押解决“先控制”，专门保管解决“控制后如何避免危险”，不能混为一个步骤。',D:'检查取证按《程序规定》第52、82条须有至少两名人民警察。实习生跟随学习不当然取得人民警察执法资格，不能简单把“一名民警＋一名实习生”凑成两名执法民警。'},tip:'本题教材参考答案B仅按原题历史口径练习；A涉及新旧规范与住所检查条件差异，现行单选题的适用性仍需复核。不要因背了B，就背成“住所检查永远不需要检查证”。'
 },
 'drill-20260917-admin-single-0-1':{
  category:'把特别不予处罚误当成从轻或减轻',keyCondition:'种植罂粟三百余株，不满500株，成熟前自行铲除，三个条件同时满足第83条特别不予处罚规则。',memory:'不满五百、成熟之前、自己铲除，三件齐全不处罚。',legalBasis:[basis('《治安管理处罚法》（2025年修订）','https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2025/art_8a1c722747214869b28c0ad7a0f8bb7a.html','第八十三条')],
  options:{A:'从宽是一般处理概念；本题已有第83条特别不予处罚的明确条件，不能用宽泛概念替代。',B:'从轻仍要实施处罚，题设三个条件齐全，依法是不予处罚，故从轻不是正确处理。',C:'减轻也是对处罚幅度的调整；不能把特殊不予处罚条件误记成普通减轻情节。',D:'数量不足500，且成熟前自行铲除，直接适用特别不予处罚规则。'},tip:'“因为怕查处”不使“成熟前自行铲除”失效；不要自行增加法律没有要求的动机条件。'
 },
 'drill-20260917-criminal-law-single-0-1':{
  category:'把故意撞人误判为过失交通事故',keyCondition:'表弟按教唆故意撞击他人，造成重伤。工具是车不改变故意伤害性质；科长教唆并参与犯意形成。',memory:'车是工具，伤是目的；定罪先看心，再看车。',legalBasis:[c('第十四、二十五、二十九、二百三十四条')],
  options:{A:'题干是私下故意伤害，未给出违法行使公职权力的构成条件；不能仅因科长身份、公车就选滥用职权。',B:'故意用车伤害并造成重伤，教唆者按其在犯罪中的作用承担责任，符合题干伤害犯意。',C:'交通肇事罪的通常核心是违反交通运输管理法规并过失造成事故；本题故意撞人，不能因用车而定交通肇事。',D:'题干可支持教训、伤害的犯意，未给出杀人故意或放任死亡的充分事实，不能仅因结果重伤上升为故意杀人。'},tip:'主观故意是决定性条件。重伤结果不等于有杀人故意。'
 },
 'drill-20260917-criminal-law-single-0-2':{
  category:'未分别核对责任年龄与事前犯意',keyCondition:'甲15周岁，盗窃不在该年龄段刑事责任的特定罪名内；乙17周岁在事前主动提议偷取特定电脑，按盗窃行为评价，不能当普通事后收赃。',memory:'先分年龄，再分事前事后；一事不重复贴罪名。',legalBasis:[c('第十七、二十九、二百六十四条')],
  options:{A:'甲仅15周岁，盗窃不属14至16周岁须负刑责的特定犯罪，不能说两人都负盗窃刑责。',B:'同时错在甲的责任年龄，以及把乙事前诱发盗窃、收购约定割裂成普通事后收赃。',C:'甲不负刑责这部分正确；但对乙同一事前参与盗窃及取得赃物行为重复评价为两罪，不符题干整体关系。',D:'分别评价甲的年龄与乙的事前参与：甲不负该盗窃的刑事责任，乙以盗窃评价。'},tip:'“甲不负刑责”并不推导出乙不负刑责；也不要把不负刑事责任理解为行为完全合法。'
 },
 'drill-20260917-criminal-law-single-0-3':{
  category:'混淆危险驾驶、交通肇事与妨害安全驾驶',keyCondition:'题干酒精含量180mg/100mL，且在道路上驾驶机动车。被追尾而停等信号灯，不消除此前醉驾；他人死亡不当然使黄某构成交通肇事。',memory:'醉驾看酒精与道路，事故看责任与因果，干扰公交才看妨害安全驾驶。',legalBasis:[c('第一百三十三条、第一百三十三条之一、第一百三十三条之二'),basis('两高两部关于办理醉酒危险驾驶刑事案件的意见','https://www.court.gov.cn/zixun/xiangqing/420872.html','第四条等')],
  options:{A:'没有造成交通事故责任不等于没有醉驾行为；180mg/100mL满足醉酒判断的数量条件。',B:'题干未说明黄某违反交通法规导致田某死亡并负相应事故责任；不能见到死亡结果就套交通肇事。',C:'在道路上醉酒驾驶机动车符合危险驾驶评价，等待红绿灯不使前面的醉驾合法。',D:'妨害安全驾驶针对公共交通工具驾驶秩序等法定情形；本题为自己醉驾轿车，并非干扰公交驾驶。'},tip:'现行醉驾意见另有情节显著轻微等处理规则，不能只背“所有80以上都必然判刑”；本题180按题设选C。'
 },
 'drill-20260917-criminal-law-single-0-4':{
  category:'把当然推论误当作目的解释',keyCondition:'原规则对较重的杀人情形出罪，以其逻辑理由推到较轻的折伤，更应出罪，是举重以明轻。',memory:'重者可免，轻者当然可免；这是推论，不是找立法目的。',legalBasis:[basis('江苏法院网：当然解释相关法理讨论','https://www.jsfy.gov.cn/article/26232.html','法理资料，非现行法条','法院网站学术讨论与原题教材答案相互核对')],
  options:{A:'文义解释关注字词通常含义；此题从既有规则推出未明文列出的较轻情形，超出单纯词义。',B:'古代文献作为题材，不等于用了历史解释。历史解释通常考察规则制定背景和沿革。',C:'题干未围绕立法目标来确定含义，而是按轻重关系做逻辑推论。',D:'由较重情形无需处罚推出较轻折伤更无需处罚，属于当然解释中的举重以明轻。'},tip:'这道题考法理方法，不能伪造某个现行法条来支持答案。'
 },
 'drill-20260917-criminal-procedure-single-0-2':{
  category:'把受托占有后的侵占当成盗窃',keyCondition:'车辆先由所有人自愿交给张某保管，张某再变卖并拒绝退还。侵占是告诉才处理，通常应告知向法院自诉。',memory:'先合法拿到后不还，想侵占；一开始窃取才想盗窃。',legalBasis:[c('第二百七十条'),basis('《公安机关办理刑事案件程序规定》',procedure,'第十四条第三项')],
  options:{A:'题干财物数额、变卖并拒还的事实指向侵占犯罪评价，不能直接以治安处罚替代。',B:'不能仅把已达到犯罪评价的受托侵占当普通轻微治安纠纷调解。',C:'张某取得车辆是受托保管，不是通过秘密窃取取得，直接按盗窃立案错在行为性质。',D:'侵占罪属于告诉才处理，法院自诉管辖；应告知向人民法院起诉。'},tip:'“保管→变卖→拒还”三步定性；不要把所有拿走财物的行为都当盗窃。'
 },
 'drill-20260917-criminal-procedure-single-0-6':{
  category:'漏掉持续犯罪的途经地管辖',keyCondition:'非法拘禁持续经过甲、乙、丙区，三处均属犯罪行为发生地。丁区只是抓获地，题干未给出其同时为犯罪地或居住地等依据。',memory:'拘禁不断，沿途都算；仅仅抓获，不当然管辖。',legalBasis:[basis('《公安机关办理刑事案件程序规定》',procedure,'第十五、十六条')],
  options:{A:'甲区是非法拘禁开始实施地，属于犯罪行为发生地，有管辖根据；本题问没有管辖权，不能选A。',B:'乙区途经时拘禁状态仍持续，连续、持续实施的地方属于犯罪行为发生地，因此乙也有根据。',C:'丙区宾馆继续拘禁，是持续犯罪实施地，有管辖根据。',D:'题干丁区仅为抓获地，没有给出犯罪地或居住地等连接事实，不能仅因抓到人认定其有本案管辖权。'},tip:'这是“不包括／没有”反向设问。若丁区另有居住地、指定管辖等事实，结论需重审，不能背绝对口号。'
 },
 'drill-20260917-police-basics-single-0-3':{
  category:'把设立警察节与首次过节混淆',keyCondition:'④2017年表彰大会讲话；①2020年7月公布设立警察节；②2020年8月26日警旗授旗；③2021年誓词公布。顺序④①②③。',memory:'先表彰，再设节，再授旗，最后新誓词。',legalBasis:[basis('表彰大会讲话（2017-05-19）','https://www.spp.gov.cn/tt/201706/t20170629_194335.shtml','2017年'),basis('中国人民警察节正式设立','https://www.nia.gov.cn/n897453/c1325742/content.html','2020年7月公布'),basis('中国政府网：人民警察队伍擎旗奋进','https://www.gov.cn/xinwen/2022-08/26/content_5706993.htm','2020-08-26授旗'),basis('公安机关人民警察誓词公布','https://www.huaihua.gov.cn/gaj/c110044/202111/3d19cbe865514bf79a60d75fe0b893e9.shtml','2021年公布')],
  options:{A:'④①②③与上述四个时间节点一致。',B:'把②授旗放到①设立节日之前。警察节自2021年开始庆祝，不等于2021年才作设立决定。',C:'把③2021年誓词公布提前到2017年讲话之前，时间不符。',D:'把④2017年讲话排在2020、2021年之后，时间倒置。'},tip:'这是历史时间题，用官方新闻与文件查日期，不硬套法律条号。'
 },
 'drill-20260917-police-basics-single-0-5':{
  category:'把抗日时期边警任务混同土地革命任务',keyCondition:'教材题设为1938年边警，处在抗日战争时期；题目问不包括，土地革命与保卫土改成果是不同阶段的任务表述。',memory:'三八边警在抗战，别把土改任务搬过来。',legalBasis:[],
  options:{A:'教材按抗日时期政治保卫任务理解“打击特务、间谍、汉奸”；属于课程支持的职责方向，外部职责任务文件待补核。',B:'把土地革命、保卫土改成果放到题设1938年边警职责任务中，阶段不符；教材答案B。',C:'题设边警承担维护延安地区治安秩序，按教材属于职责。',D:'当前选项D文字未完整识别，须打开原页核对，暂不编造解析。'},tip:'本题答案按题本和笔记一致收录；精确职责任务的官方史料仍待补核，不能标作现行法条核验。',status:'教材与笔记一致／官方史料待补核'
 },
 'drill-20260917-police-basics-single-0-6':{
  category:'把军委公安部与中央人民政府公安部混淆',keyCondition:'题干限定“人民政府公安机关的中央机关正式建立”。教材对应1949年11月中央人民政府公安部成立大会，而非此前军委系统机构。',memory:'先军委，后人民政府；看清机关全称再选月份。',legalBasis:[],
  options:{A:'进入北平是地点和组织活动的变化，不是人民政府中央公安机关正式成立的标志。',B:'军委公安部属于此前军委系统组织沿革，题干问的是人民政府中央机关，名称限定不同。',C:'全国公安会议是工作会议，不等于人民政府公安部成立大会。',D:'教材将中央人民政府公安部成立大会作为该设问的标志，蓝笔与教材均为D。'},tip:'这是组织沿革题，教材依据保留；具体成立大会日期的官方档案出处待补核。',status:'教材与笔记一致／官方史料待补核'
 }
};
export function enrichOptions(db){
 let changed=0;
 for(const r of db.records.filter(r=>r.studyQuestion&&!r.archived)){
  const q=r.details?.question;if(!q)continue;const before=JSON.stringify(q);
  if(r.id==='drill-20260917-admin-single-0-4'){
   q.options.C='小崔说：“对扣押的黑火药应当存放在符合危险物品存放条件的专门场所。”';
   q.recognitionCorrections=[{field:'options.C',sourceId:r.sourceRefs[0].sourceId,page:8,verifiedAt:'2026-10-11',method:'人工核对原页，补齐机器识别漏行；机器原稿保留在aiContent'}];
   q.answerScope='原题教材口径（2020年）';
   q.currentLawNote='原题教材选B。A按旧规章的紧急检查口径解释；2026年新治安法第103条另明确住所检查须出示检查证，现行单选适用性需复核。此题按历史参考答案记录成绩，不据此宣称A在现行法下一律正确。';
  }
  const specific=audited[r.id];
  if(specific){q.explanation={...q.explanation,...specific,options:undefined,status:undefined,tip:undefined,diagnosis:specific.keyCondition};q.optionExplanations=Object.fromEntries(Object.entries(specific.options).map(([letter,text])=>[letter,{text,status:specific.status||'已核对依据／题干推理',basis:q.explanation.legalBasis}]));q.attention=specific.tip;q.optionAuditStatus=specific.status||'已核对依据／题干推理';}
  else if(q.type!=='recall'){
   const labels=r.studyQuestion.bank==='police-drill-20260917'?['A','B','C','D']:Object.keys(q.options||{}).sort();
   const verified=r.studyQuestion.origin==='generated';
   q.optionExplanations=Object.fromEntries(labels.map(letter=>{
    const chosen=String(q.referenceAnswer||'').includes(letter),text=q.options?.[letter];
    return[letter,{text:!text?'选项文字未完整识别，打开原页核对。':verified?`${chosen?'本项符合':'本项不符合'}本题条件。${q.explanation.keyCondition}`:q.origin==='imported-quiz'?`${chosen?'原自测的答案项':'原自测的非答案项'}。${q.explanation?.keyCondition||'具体理由请查看关联知识卡。'}`:`教材答案${chosen?'包含':'不包含'}本项。${q.explanation?.keyCondition||'请核对原页。'} 本选项的独立法条与推理尚待核验，不能将教材标记当作法律核验结果。`,status:verified?'已核对规则／自编解析':q.origin==='imported-quiz'?'原自测解析':'教材参考／逐项依据待核验',basis:verified?q.explanation.legalBasis:[]}];
   }));q.optionAuditStatus=verified?'已核对规则／自编解析':q.origin==='imported-quiz'?'原自测解析':'逐项法规依据待核验';
  }
  if(r.studyQuestion.correctionAnswer&&r.studyQuestion.correctionAnswer!==q.referenceAnswer)q.answerConflict=`蓝笔为 ${r.studyQuestion.correctionAnswer}，教材／勘误参考答案为 ${q.referenceAnswer}，存在冲突；本次按教材／已录入勘误自测，法律结论待核验。`;
  if(JSON.stringify(q)!==before){r.revision++;changed++;}
  if(r.studyQuestion.bank==='police-drill-20260917'&&q.answerCardId){
   const card=db.records.find(x=>x.id===q.answerCardId);if(card){
    const marker='\n\n## 逐项选项解析';const base=(card.body||'').split(marker)[0];
    const body=base+marker+'\n\n'+Object.entries(q.optionExplanations||{}).map(([letter,value])=>`### ${letter} · ${String(q.referenceAnswer).includes(letter)?'教材答案项':'教材非答案项'}\n\n${value.text}\n\n核验状态：${value.status}`).join('\n\n')+(q.attention?'\n\n### 答后注意\n\n'+q.attention:'')+'\n\n### 核验出处\n\n'+(q.explanation?.legalBasis||[]).map(b=>`- [${b.title}${b.article?' · '+b.article:''}](${b.url})：${b.verification}`).join('\n');
    const tutorialMarker='\n\n## 教学讲解与资料教程',tutorial=(card.body||'').split(tutorialMarker)[1];
    const fullBody=body+(tutorial!==undefined?tutorialMarker+tutorial:'');
    if(card.body!==fullBody){card.body=fullBody;card.revision++;changed++;}
   }
  }
 }
 return {changed,optionAnnotated:db.records.filter(r=>!r.archived&&r.details?.question?.optionExplanations).length};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){const db=read();backup(db);const report=enrichOptions(db);if(report.changed)write(db);atomic(path.join(DATA,'option-audit-report.json'),report);console.log(JSON.stringify({...report,version:db.version}));}
