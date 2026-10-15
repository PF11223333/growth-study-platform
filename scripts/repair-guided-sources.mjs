import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {gradeLower,summarizeLower} from './lower-results.mjs';

const root = process.cwd();
const file = path.join(root, 'data/platform.json');
const original = await fs.readFile(file, 'utf8');
const db = JSON.parse(original);
const MAIN = 'source-e54c6989c8057386a3fe80e9';
const UPPER = 'source-9657660fd40d4a780c48fe10';
const LOWER = 'source-27c9642d30115cd64d7902bc';
const ERRATA = 'source-5ecca0676af2818c475dc891';
const date = '2026-10-15';
const upper = key => `drill-20260917-${key}`;
const lower = key => `lower-20261014-${key}`;
const ref = (sourceId, page, label, regions = []) => ({sourceId, page, label, regions});
const excerpt = (sourceId, page, label, quote, kind = 'textbook-original', regions = []) => ({sourceId, page, label, quote, kind, status:'verified', verifiedAt:date, regions});
const definitions = [
  ['civil-capacity',245,upper('civil-law-single-0-6'),'不满八周岁的未成年人为无民事行为能力人，由其法定代理人代理实施民事法律行为。', [244,246]],
  ['guardian',246,upper('civil-law-single-0-4'),'无民事行为能力人、限制民事行为能力人的监护人是其法定代理人。',[245,253]],
  ['limitation',255,upper('civil-law-multi-0-7'),'普通诉讼时效：通常向法院提起诉讼的时效期间为3年。',[]],
  ['constitution-change',224,upper('constitution-single-0-2'),'提案：全国人大常委会或1/5以上的全国人大代表提起；通过：全国人大全体代表的2/3以上多数通过。',[]],
  ['state-organs',230,lower('2025-provinces-17'),'全国人大：修宪权和监督实施权。全国人大常委会：宪法解释和监督实施权。',[]],
  ['police-duty',185,lower('2024-national-24'),'人民警察在非工作时间，遇有其职责范围内的紧急情形，应当履行职责。',[259]],
  ['illegal-order',259,lower('2025-guangdong-6'),'人民警察对超越法律、法规规定的人民警察职责范围的指令有权拒绝执行并同时向上级机关报告。',[203]],
  ['supervision',197,lower('2025-provinces-63'),'监督主体与监督对象的隶属关系：外部监督、内部监督。实施监督的时间：事前监督、事中监督、事后监督。',[]],
  ['inquiry-time',29,upper('admin-single-0-8'),'询问查证的时间不得超过八小时；涉案人数众多、违反治安管理行为人身份不明的，询问查证的时间不得超过十二小时。',[28]],
  ['continue-time',26,lower('2026-guangdong-16'),'继续盘问的时限一般为十二小时（派出所批）。继续盘问时间起算起点为带至公安机关之时起。',[]],
  ['nonexecution',52,lower('2025-guangdong-29'),'依法应当给予行政拘留处罚的，应当作出处罚决定，但不送拘留所执行。',[50,51]],
  ['fine',44,lower('2026-provinces-30'),'被处二百元以下罚款，被处罚人对罚款无异议的。',[41,50]],
  ['mediation',54,lower('2025-provinces-25'),'调解达成协议并履行的，公安机关不再处罚。',[55]],
  ['data-collision',282,lower('2026-provinces-69'),'对多个案发时空点的数据进行批量对比，找出其中相同者，即可列为嫌疑人。',[283]],
  ['charts',291,lower('2024-national-94'),'拿分最重要的一点是要快速从题干中锁定有效信息来应对题目。',[]],
];
const corrections = {
  [lower('2025-provinces-63')]:{options:{A:'市公安局对交警支队民警在路面执法执勤的情况进行现场督察',B:'市电视台新闻自媒体号曝光了该市个别民警存在不文明执法行为',C:'市政协委员马某受邀视察市公安局新成立的执法办案管理中心并提出工作建议',D:'市人大常委会听取了市公安局关于执法规范化建设实施情况的报告并审议通过'}},
  [lower('2026-provinces-17')]: {
    prompt:'东桦公司与网红张某（14周岁）签订委托合同，委托张某为东桦公司销售价值30万元的文具用品。张某的父母知道后表示强烈反对，与东桦公司代表发生冲突并报警求助。民警老覃、小陆到达现场后，就委托合同和代理权授予的法律效力问题向双方说法释理。根据相关法律法规，下列说法正确的是：',
    options:{A:'委托与授权已完成，不因张某父母的反对而无效',B:'张某可视为完全行为能力人，委托与授权均有效',C:'委托合同属纯获益而有效，代理授权不符合张某的年龄与智力而无效',D:'委托合同因张某父母拒绝追认而无效，代理授权作为单方法律行为而有效'},
    region:{x:.06,y:.096,w:.89,h:.15}, page:273,
  },
  [lower('2024-national-94')]:{
    fullContextText:'电信网络诈骗是我国当前主要的犯罪类型，严重危害社会治安秩序和人民群众的财产安全，是公安机关预防与打击的主要犯罪之一。近年来，东山市电信网络诈骗刑事案件立案数和损失金额均大幅上升。为遏制电信网络诈骗案件的高发态势，提高反诈宣传的效果，市公安局反诈中心对有关犯罪形势进行分析研判。\n\n图表完整数据（2022年第三季度→2023年第三季度）：刷单返利135→215；虚假网络投资125→195；冒充电商物流30→48；虚假征信41→52；虚假购物28→39；杀猪盘37→41；冒充熟人15→13；冒充公检法20→10。',
    prompt:'根据刑事案件立案统计，东山市2023年第三季度共立电信网络诈骗案件613起。民警根据案件类型，绘制了“电信网络诈骗高发案件类型统计图（2022.7—9；2023.7—9）”。根据下列原图数据，2023年第三季度与2022年同期相比，增幅最大的电信网络诈骗案件类型是：（单选）\n\n类型｜2022年第三季度｜2023年第三季度\n刷单返利类｜135｜215\n虚假网络投资类｜125｜195\n冒充电商物流类｜30｜48\n虚假征信类｜41｜52\n虚假购物类｜28｜39\n杀猪盘类｜37｜41\n冒充熟人类｜15｜13\n冒充公检法类｜20｜10',
  },
  [lower('2026-provinces-69')]:{
    prompt:'澄湖区公安分局禁毒大队充分利用大数据碰撞分析，研判发现了涉嫌运输毒品犯罪的嫌疑人庞X，并分析了庞X的相关信息。根据图中反映的信息，下列关于庞X的推断合理的有：\n\n原图信息：①短期内频繁往返毒品犯罪高发地区；②每次停留时间较短且基本一致；③无经济来源但名下有3辆车、4套房；④多次与其表弟同往，单独返程。',
  },
  [lower('2026-provinces-30')]:{prompt:'罗X因在观看篮球比赛期间展示侮辱性标语、扰乱比赛活动秩序，被光浦县公安局依法作出罚款二百元的行政处罚决定。对该笔罚款的执行，下列说法正确的是：'},
  [lower('2026-guangdong-16')]:{page:242,region:{x:.06,y:.724,w:.89,h:.104}},
};
function question(id) {
  const r = db.records.find(x => x.id === id);
  if (!r?.details?.question) throw new Error(`Missing original ${id}`);
  const q = r.details.question;
  let prompt = q.prompt.replace(/\n/g,'').replace(/寻畔/g,'寻衅').replace(/^\s*[,，]/,'');
  const options = {...q.options};
  if (Object.values(options).some(x => /选项见/.test(x))) {
    for (const letter of ['A','B','C','D']) {
      const match = r.body.match(new RegExp(`(?:^|\\n)${letter}[.、．]?([^\\n]+)`));
      if (!match) throw new Error(`Missing option ${letter} of ${id}`);
      options[letter] = match[1].trim();
    }
  }
  const correction = corrections[id] || {};
  prompt = correction.prompt || prompt;
  const finalOptions = correction.options || options;
  let sourceRefs = structuredClone(r.sourceRefs);
  let originalPages = structuredClone(q.originalPages || []);
  if (!originalPages.length) originalPages = sourceRefs.filter(x=>x.sourceId===UPPER && !x.label?.includes('答案')).flatMap(x=>(x.regions||[]).map(region=>({sourceId:x.sourceId,page:x.page,width:1313,height:2000,region})));
  if (correction.region) {
    sourceRefs = sourceRefs.filter(x => !x.sourceId || x.label?.includes('答案') || x.page===correction.page).map(x => x.page===correction.page ? {...x,regions:[correction.region]} : x);
    originalPages = [{sourceId:LOWER,page:correction.page,width:1378,height:2100,region:correction.region}];
  }
  const answerSource=sourceRefs.find(x=>x.label?.includes('答案'));
  if(Object.keys(finalOptions).sort().join('')!=='ABCD'||Object.values(finalOptions).some(x=>typeof x!=='string'||x.trim().length<2||/选项见|未识别/.test(x)))throw new Error(`Incomplete options ${id}`);
  return {id,title:r.title,prompt,options:finalOptions,answer:q.referenceAnswer,type:q.type,sourceRefs,originalPages,...(correction.fullContextText?{fullContextText:correction.fullContextText}:{}),answerEvidence:{...answerSource,answer:q.referenceAnswer,status:'verified',method:'原图逐格核对题号和答案；保留卷末历史答案，不以红蓝笔推测替代',verifiedAt:date},status:'verified',verifiedAt:date,verificationScope:'题干、全部选项、图表数字及卷末答案已对照原图；法规适用与逐项解释另行核验。'};
}
const units = definitions.map(([id,page,qid,quote,extra]) => {
  const originalQuestion = question(qid);
  const sourceRefs = [ref(MAIN,page,`333页教材 · PDF ${page}页`),...extra.map(p => ref(MAIN,p,`333页教材 · 补充原文 PDF ${p}页`)),...originalQuestion.sourceRefs];
  const sourceExcerpts = [excerpt(MAIN,page,'教材原文（定点核对摘录，表格内容按行转写）',quote),excerpt(originalQuestion.sourceRefs[0].sourceId,originalQuestion.sourceRefs[0].page,['charts','data-collision'].includes(id)?'题干及图表文字转写（按原图核对）':'题本原题（原文）',originalQuestion.prompt,'question-original',originalQuestion.sourceRefs[0].regions)];
  const auditNotes = ['仅当前摘录与锚点题完成原图核对；未转录笔画仍保留原图，不猜写。','上下册作为知识来源；未找到精确对应的内容不强行添加关联。'];
  if(qid.startsWith('drill-')) auditNotes.push('已查看上册勘误全部3页；当前锚点不在列明的勘误题号内。');
  if(id==='civil-capacity') auditNotes.push('原卡PDF244为定义，年龄规则准确位置是245—246；本题跨97—98页，原页入口同时保留。');
  if(id==='guardian') {
    sourceExcerpts.push(excerpt(MAIN,245,'纯获利益原文','八周岁以上的未成年人为限制民事行为能力人，实施民事法律行为由其法定代理人代理或者经其法定代理人同意、追认，但是可以独立实施纯获利益的民事法律行为或者与其年龄、智力相适应的民事法律行为。'));
    auditNotes.push('原卡247是监护资格，不是交易规则；补正为245、246，253为行为效力概念补充。2026多省17补全原题，代理授权细分暂不作为本点核心锚题。');
  }
  if(id==='limitation') {
    sourceExcerpts.push(excerpt(UPPER,102,'你的蓝笔笔记（逐字核对）','三年','handwriting'));
    auditNotes.push('教材255页“丧失胜诉权”是教学简化，精讲须写明时效抗辩与法院不得主动适用。');
  }
  if(id==='police-duty') {
    sourceExcerpts.push(excerpt(MAIN,259,'教材原文 · 救助义务','人民警察遇到公民人身、财产安全受到侵犯或者处于其他危难情形，应当立即救助。'));
    sourceExcerpts.push(excerpt(MAIN,259,'你的手写记忆笔记（逐字核对）','救人是义务 抓人是职责','handwriting'));
    auditNotes.push('2024国考24原图红B、蓝C，卷末122页C，保留历史作答；应区分第十九条履职与第二十一条救助义务，不能只看“休息时间”改答案。');
  }
  if(id==='illegal-order') auditNotes.push('原卡188页为内部监督，命令专题补正为259页，203页为内务条令补充。');
  if(id==='nonexecution') auditNotes.push('2025原题保留旧法答案；2026起年龄不执行拘留的例外要另列，不将历史题答案直接当现行法结论。');
  if(id==='inquiry-time') sourceExcerpts.push(excerpt(UPPER,9,'你的手写记忆笔记（逐字核对）','放任动物恐吓他人','handwriting'));
  if(id==='supervision') sourceExcerpts.push(excerpt(LOWER,226,'红蓝选项辨认记录（原图核对）','红笔BC；蓝笔BCD。','handwriting-observation'));
  if(id==='data-collision') sourceExcerpts.push(excerpt(LOWER,285,'红蓝选项辨认记录（原图核对）','红笔ABC；蓝笔ABCD。','handwriting-observation'));
  if(id==='charts') auditNotes.push('与主教材291页例16为同一道2024国考题，不能计作两道独立掌握证据。原图8类数字已逐格核对。');
  return {id,sourceRefs,sourceExcerpts,questionIds:[qid],originalQuestion,auditNotes};
});
// Extra source links reflect actual matching passages, never fabricated coverage.
const additional = {
  'civil-capacity':[lower('2026-provinces-17')],
  'guardian':[lower('2026-provinces-17')],
  'police-duty':[upper('legal-theory-single-0-7'),lower('2026-national-17')],
  'continue-time':[lower('2024-provinces-23')],
  'nonexecution':[upper('admin-multi-0-13')],
  'mediation':[upper('admin-multi-0-11')],
};
for(const unit of units) for(const id of additional[unit.id] || []) {
  const r=db.records.find(x=>x.id===id);if(!r)continue;
  unit.questionIds.push(id);
  const refs=r.sourceRefs.filter(x=>x.sourceId && !x.label?.includes('答案'));
  unit.sourceRefs.push(...refs);
  unit.auditNotes.push(`关联原题 ${id} 保留原页；除已单独标为verified者外，正文和逐项依据待精校。`);
}
const mainSections=[['办理行政案件能力',16,['inquiry-time','continue-time','nonexecution','fine','mediation']],['刑法',88,[]],['办理刑事案件能力',116,[]],['公安基础知识',173,['police-duty','illegal-order','supervision']],['法律基础知识',214,['civil-capacity','guardian','limitation','constitution-change','state-organs']],['公安业务能力',272,['data-collision','charts']]].map(([title,page,lessonIds])=>({title,page,lessonIds,status:lessonIds.length?'部分知识点已精讲':'原文可读，待精校'}));
function sectionsFor(bank,sourceId,keyName) {
  const sections = new Map();
  for(const r of db.records.filter(x=>x.studyQuestion?.bank===bank)) {
    const q=r.studyQuestion;const key=q[keyName];
    const firstRef=r.sourceRefs.find(x=>x.sourceId===sourceId && !x.label?.includes('答案'));
    if(!firstRef) continue;
    if(!sections.has(key)) sections.set(key,{title:keyName==='paperId'?q.chapterName:q.sectionName,page:firstRef.page,lessonIds:[],status:'原文可读，待精校'});
    const section=sections.get(key); section.page=Math.min(section.page,firstRef.page);
    for(const u of units) if(u.questionIds.includes(r.id) && !section.lessonIds.includes(u.id)) section.lessonIds.push(u.id);
    if(section.lessonIds.length) section.status='部分知识点已精讲';
  }
  return [...sections.values()];
}
const audit = {schemaVersion:1,verifiedAt:date,verificationScope:'15个知识点的定点原页、15道锚点题题干选项；不代表三本全书或全部手写笔记已核验。',units,chapters:[{sourceId:MAIN,title:'333页完整教材',sections:mainSections},{sourceId:UPPER,title:'小题狂刷上册 · 章节练习与知识笔记',sections:sectionsFor('police-drill-20260917',UPPER,'sectionId'),errataSourceId:ERRATA,errataPages:[1,2,3]},{sourceId:LOWER,title:'小题狂刷下册 · 套卷与知识笔记',sections:sectionsFor('police-lower-20261014',LOWER,'paperId')}]};
await fs.writeFile(path.join(root,'data/guided-source-audit.json'),JSON.stringify(audit,null,2)+'\n','utf8');

if(process.argv.includes('--write')) {
  const reportFile=path.join(root,'data/lower-study-report.json');
  const originalReport=await fs.readFile(reportFile,'utf8');
  const report=JSON.parse(originalReport);
  const changed=[];
  function mutate(r,fn) {const before=JSON.stringify(r);fn(r);if(before!==JSON.stringify(r)){r.revision=(r.revision||1)+1;r.updatedAt=new Date().toISOString();changed.push(r.id);}}
  for(const u of units) {
    const r=db.records.find(x=>x.id===u.originalQuestion.id); const oq=u.originalQuestion;
    mutate(r,()=>{
      const q=r.details.question;const oldKey=r.studyQuestion.knowledgeKey;const key=`final-20260909-m-${u.id}`;
      r.body=oq.prompt+'\n'+Object.entries(oq.options).map(([k,v])=>`${k}.${v}`).join('\n');
      q.prompt=oq.prompt;q.options=oq.options;r.sourceRefs=oq.sourceRefs;if(oq.originalPages.length)q.originalPages=oq.originalPages;
      r.studyQuestion.promptPreview=oq.prompt;r.studyQuestion.knowledgeKey=key;q.answerCardId=key;
      r.links=[...new Set((r.links||[]).filter(x=>oldKey===key||x!==oldKey).concat(key))];
      if(r.id===lower('2024-national-24')) {
        r.topic='警察职责与监督';
        r.studyQuestion.sectionId='police-duty';
        r.studyQuestion.sectionName='警察职责与监督';
        r.links=[...new Set(r.links.map(id=>id==='lower-20261014-memory-rights-duties'?'lower-20261014-memory-police-duty':id))];
        if(r.details.calibration)r.details.calibration.topic=r.topic;
      }
      const card=db.records.find(x=>x.id===key);
      if(!r.details.guidedLessonId){
        q.explanation={category:card?.title||u.id,keyCondition:'详见本题逐项精讲；原题和相关教材均有独立原页入口。'};
        if(card) q.tutorial={version:2,materials:[{id:card.id,title:card.title,body:card.body,sourceRefs:u.sourceRefs.filter(x=>x.sourceId===MAIN),verificationStatus:'知识点对应原页已核对；法律解释见精讲',provenance:'原教材、个人笔记与编写讲解分层保存'}]};
      }
      r.details.guidedSourceAudit={version:1,verifiedAt:date,lessonId:u.id,scope:oq.verificationScope};
    });
  }
  const q17=db.records.find(x=>x.id===lower('2026-provinces-17'));
  const repaired=question(q17.id);
  mutate(q17,()=>{
    const q=q17.details.question;const old=q17.studyQuestion.knowledgeKey;
    q17.body=repaired.prompt+'\n'+Object.entries(repaired.options).map(([k,v])=>`${k}.${v}`).join('\n');
    q.prompt=repaired.prompt;q.options=repaired.options;q.originalPages=repaired.originalPages;q17.sourceRefs=repaired.sourceRefs;
    q17.studyQuestion.promptPreview=repaired.prompt;q17.studyQuestion.knowledgeKey='final-20260909-m-civil-capacity';q.answerCardId='final-20260909-m-civil-capacity';
    q17.links=[...new Set(q17.links.filter(x=>old==='final-20260909-m-civil-capacity'||x!==old).concat(['final-20260909-m-civil-capacity','final-20260909-m-guardian']))];
    q.explanation={category:'未成年人交易与代理',keyCondition:'分别审查委托合同与公司授予代理权的效力；不可只因“14岁”或“单方行为”一概认定。',diagnosis:'题册参考答案D已核对，原有法的适用冲突讲解关联错误，已移除。该题代理授权的逐项法理暂待专项核验，不将题册答案冒充现行法逐项精讲。'};
    q.tutorial={version:2,authored:null,materials:['civil-capacity','guardian'].map(id=>{const c=db.records.find(x=>x.id===`final-20260909-m-${id}`);return{id:c.id,title:c.title,body:c.body,sourceRefs:units.find(x=>x.id===id).sourceRefs.filter(x=>x.sourceId===MAIN),verificationStatus:'相关概念原文；本题代理细分适用待专项核验',provenance:'教材相关原文，不冒充本题全部选项核验'}})};
    q17.details.guidedSourceAudit={version:1,verifiedAt:date,lessonId:'guardian',note:'原题全部在PDF273页，首行误入第16题，已从原图补回。保留红C、卷末D及全部历史判分。'};
  });
  const q16=db.records.find(x=>x.id===lower('2026-provinces-16'));
  mutate(q16,()=>{
    q16.body=q16.body.replace(/\n7\.东桦公司[\s\S]*$/,'');
    const q=q16.details.question; q.prompt=q.prompt.replace(/\n7\.东桦公司[\s\S]*$/,'');
    q16.studyQuestion.promptPreview=q16.studyQuestion.promptPreview.replace(/\n7\.东桦公司[\s\S]*$/,'');
    const region={x:.06,y:.025,w:.89,h:.067};
    q16.sourceRefs=q16.sourceRefs.map(x=>x.page===273?{...x,regions:[region]}:x);
    q.originalPages=q.originalPages.map(x=>x.page===273?{...x,region}:x);
    q16.details.guidedSourceAudit={version:1,verifiedAt:date,note:'移除误并入本题末尾的第17题首行，缩短PDF273页续页裁切，保留历史答案。'};
  });
  // Correct the four legacy source pointers without discarding the rest of their provenance.
  for(const [key,page] of [['civil-capacity',245],['guardian',246],['illegal-order',259],['nonexecution',52]]) {
    const c=db.records.find(x=>x.id===`final-20260909-m-${key}`);if(!c)continue;
    mutate(c,()=>{
      const unit=units.find(x=>x.id===key),mainRefs=unit.sourceRefs.filter(x=>x.sourceId===MAIN);
      c.sourceRefs=[...mainRefs,...c.sourceRefs.filter(x=>x.sourceId!==MAIN)];
      if(c.details.evidence){
        const source=db.sources.find(x=>x.id===MAIN);
        c.details.evidence.originals=[...mainRefs.map(r=>({...r,sourceType:'textbook',rawText:source.pages.find(p=>p.pageNumber===r.page)?.rawText||'',verifiedExcerpt:unit.sourceExcerpts.filter(e=>e.sourceId===MAIN&&e.page===r.page).map(e=>e.quote).join('\n')})),...(c.details.evidence.originals||[]).filter(x=>x.sourceId!==MAIN)];
      }
      c.details={...c.details,guidedSourceAudit:{version:1,verifiedAt:date,lessonId:key,note:'精确原文页与证据正文均已重新定位，旧原文件及修复前备份保留。'}};
    });
  }
  // The score report is an import-time snapshot, while mistake insights use live topics.
  // Reclassify the snapshot by the calibrated original records without regrading answers.
  const lowerRows=db.records.filter(r=>r.studyQuestion?.bank==='police-lower-20261014');
  const byQuestion=new Map(lowerRows.map(r=>[`${r.studyQuestion.paperId}:${r.studyQuestion.number}`,r]));
  assert.equal(lowerRows.length,report.questions.length,'Lower report coverage changed; inspect before rewriting');
  const questions=report.questions.map(q=>{
    const r=byQuestion.get(`${q.paperId}:${q.number}`);
    assert(r,`Missing report question ${q.paperId}:${q.number}`);
    assert.equal(gradeLower(q),r.studyQuestion.calibration,`Historical grade mismatch ${r.id}`);
    return {...q,topic:r.topic};
  });
  const analysis=summarizeLower(report.papers,questions);
  for(const key of ['correct','wrong','pending','excluded','total','eligible','known','coverage','lower','upper','averageLower','averageUpper','types','multiErrors'])assert.deepEqual(analysis[key],report[key],`Topic correction must preserve ${key}`);
  assert.equal(JSON.stringify(analysis.papers),JSON.stringify(report.papers),'Topic correction must preserve paper scores');
  const nextReport={...report,topics:analysis.topics,questions};
  const reportChanged=JSON.stringify(nextReport)!==JSON.stringify(report);
  const reportRecord=db.records.find(r=>r.id==='lower-20261014-report');
  assert(reportRecord?.details?.lowerStudy,'Missing platform score report');
  mutate(reportRecord,()=>{
    reportRecord.details.lowerStudy={...reportRecord.details.lowerStudy,topics:analysis.topics};
    const ranked=Object.entries(analysis.topics).filter(([name,t])=>name!=='其他与综合题'&&t.known>=20).sort(([,a],[,b])=>a.correct/a.known-b.correct/b.known);
    const describe=([name,t])=>`${name}（${(100*t.correct/t.known).toFixed(1)}%，已核${t.known}题）`;
    const paragraph=`已核对样本中，优先关注${ranked.slice(0,3).map(describe).join('、')}。相对较好的为${ranked.slice(-2).reverse().map(describe).join('、')}；仍需按错题复习，不能据此认定已全面掌握。主题分类是按题干初步归类的学习线索，不是对实际失误原因的心理判断。`;
    const pattern=/已核对样本中，优先关注[^\n]+主题分类是按题干初步归类的学习线索，不是对实际失误原因的心理判断。/;
    assert(pattern.test(reportRecord.body),'Score report paragraph changed; inspect before rewriting');
    reportRecord.body=reportRecord.body.replace(pattern,paragraph);
  });
  for(const [key,topic] of [['rights-duties','民法与宪法法理'],['police-duty','警察职责与监督']]) {
    const card=db.records.find(r=>r.id===`lower-20261014-memory-${key}`);
    assert(card,'Missing topic memory card');
    const stats=analysis.topics[topic],pattern=/本板块收录\d+题，已确认错题\d+题。/;
    assert(pattern.test(card.body),'Memory count paragraph changed; inspect before rewriting');
    mutate(card,()=>{
      card.body=card.body.replace(pattern,`本板块收录${stats.total}题，已确认错题${stats.wrong}题。`);
      const target=lower('2024-national-24');
      card.links=key==='police-duty'?[...new Set([...card.links,target])]:card.links.filter(id=>id!==target);
    });
  }
  if(changed.length||reportChanged) {
    const backupDir=path.join(root,'data/backups',`guided-source-repair-${Date.now()}`);await fs.mkdir(backupDir,{recursive:true});await fs.writeFile(path.join(backupDir,'platform.json'),original,'utf8');await fs.writeFile(path.join(backupDir,'lower-study-report.json'),originalReport,'utf8');
    const current=await fs.readFile(file,'utf8');if(current!==original||await fs.readFile(reportFile,'utf8')!==originalReport)throw new Error('platform/report changed concurrently; retry from fresh snapshot');
    const temp=file+'.guided-tmp',reportTemp=reportFile+'.guided-tmp';
    await fs.writeFile(temp,JSON.stringify(db,null,2)+'\n','utf8');await fs.writeFile(reportTemp,JSON.stringify(nextReport,null,2)+'\n','utf8');
    try{await fs.rename(temp,file);await fs.rename(reportTemp,reportFile);}catch(error){await fs.writeFile(file,original,'utf8');await fs.writeFile(reportFile,originalReport,'utf8');throw error;}
    console.log(JSON.stringify({changed:changed.length,ids:changed,reportChanged,backupDir,sha256:crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex')}));
  } else console.log(JSON.stringify({changed:0,message:'already applied'}));
}
console.log(JSON.stringify({auditUnits:units.length,anchors:units.map(x=>({id:x.id,question:x.originalQuestion.id})),chapters:audit.chapters.map(x=>({title:x.title,sections:x.sections.length}))}));
