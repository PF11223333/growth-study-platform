import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {lowerPapers} from './lower-paper-keys.mjs';
import {sections} from '../data/batches/police-drill-20260917/sections.mjs';
import {summarizeLower,gradeLower} from './lower-results.mjs';

const ROOT=process.cwd(),DATA=path.join(ROOT,'data'),file=path.join(DATA,'platform.json');
const original=fs.readFileSync(file,'utf8'),db=JSON.parse(original),before=JSON.parse(original);
const scoreFile=path.join(DATA,'lower-study-report.json'),scoreOriginal=fs.readFileSync(scoreFile,'utf8'),scoreBefore=JSON.parse(scoreOriginal);
const UPPER='source-9657660fd40d4a780c48fe10',LOWER='source-27c9642d30115cd64d7902bc',ERRATA='source-5ecca0676af2818c475dc891';
const upper=id=>'drill-20260917-'+id,lower=id=>'lower-20261014-'+id;
const date='2026-10-17',version=1;
const get=id=>db.records.find(r=>r.id===id);
const upperRows=db.records.filter(r=>r.studyQuestion?.bank==='police-drill-20260917');
const lowerRows=db.records.filter(r=>r.studyQuestion?.bank==='police-lower-20261014');
const originals=[...upperRows,...lowerRows];
const verifiedAnchorIds=new Set(JSON.parse(fs.readFileSync(path.join(DATA,'guided-source-audit.json'),'utf8')).units.filter(u=>u.originalQuestion?.status==='verified').map(u=>u.originalQuestion.id));
const manifests=new Map();
function meta(sourceId,page){if(!manifests.has(sourceId))manifests.set(sourceId,JSON.parse(fs.readFileSync(path.join(DATA,'previews',sourceId,'manifest.json'))));const p=manifests.get(sourceId).pages.find(p=>p.page===page);assert(p,`Missing page ${sourceId}/${page}`);return p;}
const img=(sourceId,page,y=0.035,end=.925)=>({sourceId,page,width:meta(sourceId,page).width,height:meta(sourceId,page).height,region:{x:.055,y:+y.toFixed(6),w:.91,h:+(end-y).toFixed(6)}});
const imageRef=p=>({sourceId:p.sourceId,page:p.page,label:'原题图（保留题干、选项及图表）',regions:[p.region]});
const report={schemaVersion:1,checkedAt:date,versionBefore:db.version,scope:'全量结构、题组范围、附件与卷末字段一致性审计；定点原图人工核对，不代表全部题目或法规已逐项精校。',counts:{},groups:[],repairs:[],issues:[],visuallyReviewed:[{sourceId:UPPER,pages:[22,24,38,39,48,49,53,58,70,74,76,109,110,115]},{sourceId:LOWER,pages:[26,27,160,161,162,243]},{sourceId:ERRATA,pages:[2,3]}]};
const mark=(r,reason)=>{if(!report.repairs.some(x=>x.id===r.id&&x.reason===reason))report.repairs.push({id:r.id,reason});};
const issue=(r,kind,reason)=>report.issues.push({id:r.id,kind,reason});
const manual={
 [upper('admin-case-6-4')]:{pages:[[22,.605,.718]],prompt:'在派出所对此事调查期间，李某因害怕而跑到外地，下列陈述正确的有：（多选）',options:{A:'虽因李某逃跑造成案件超过法定办案期限，但公安机关仍应当继续进行调查取证',B:'只要李某违法行为事实清楚，证据确实、充分，依法应当予以行政处罚的，即使其在逃，公安机关也可以作出行政处罚决定',C:'如果李某逃跑后又被抓获，公安机关不得因违法嫌疑人李某申辩而加重对其处罚',D:'对违法嫌疑人李某作出行政处罚决定前，应当告知其拟作出行政处罚决定的事实、内容、理由、依据'}},
 [upper('criminal-procedure-single-0-12')]:{pages:[[38,.708,.883],[39,.044,.086]],prompt:'下图为市公安局执法监督部门对2013年至2015年由于不实证据导致错案发生的情况分析。根据上图，言词证据在错案中所占的比例是：（2017年公安联考）',options:{A:'0.93',B:'0.78',C:'0.69',D:'0.95'},contextText:'原表数据：视听资料、电子数据1%；勘验、检查、辨认、侦查实验笔录1%；书证2%；物证3%；被害人陈述9%；鉴定意见15%；犯罪嫌疑人、被告人供述34%；证人证言35%。'},
 [upper('criminal-procedure-case-4-3')]:{pages:[[48,.858,.887],[49,.044,.142]],prompt:'在本案的侦查中，侦查人员李某偶然发现赵某原来是自己30年前被拐卖的亲弟弟，下列说法正确的有：（多选）',options:{A:'李某应当自行回避，但在回避决定作出前，不停止对本案的侦查工作',B:'李某自行提出回避申请时，应当说明回避的理由',C:'李某未自行回避或被申请回避，该县公安局局长查明上述事实后，应责令其回避',D:'对李某的回避应当由该县人民法院院长决定'}},
 [upper('police-basics-single-0-24')]:{pages:[[58,.079,.236]],prompt:'为落实习近平总书记和党中央对公安工作的总要求，公安部会同工信部等相关部门联合行动，严厉打击人民群众深恶痛绝的电信网络诈骗犯罪，取得破获案件数上升30%以上的成绩，切实维护了社会秩序、保障了人民的利益。在这一专项任务中，公安机关及其人民警察依法办案，严格规范执法，严明组织纪律要求，严守工作机密，得到了人民群众的高度称赞。下列选项最能体现新时代建警治警总要求的是：（2022年多省联考）',options:{A:'政治建警、改革强警、科技兴警、从严治警',B:'科学立法、严格执法、公正司法、全民守法',C:'有法可依、有法必依、执法必严、违法必究',D:'对党忠诚、服务人民、执法公正、纪律严明'}},
 [upper('police-basics-multi-0-5')]:{pages:[[70,.319,.435]],prompt:'政治坚定、对党忠诚是公安机关的建警之魂，必须旗帜鲜明地把政治建设放在首位，确保公安工作始终保持坚定正确的政治方向。下列对坚持政治建警表述准确的有：（2020年公安联考）',options:{A:'在思想上政治上行动上同党中央保持高度一致',B:'要增强政治觉悟、强化政治担当',C:'始终恪守公平正义的价值追求',D:'要坚持不懈地用习近平新时代中国特色社会主义思想武装全警头脑'}},
 [upper('police-basics-case-1-2')]:{pages:[[74,.629,.69]],prompt:'按照干部管理权限，举行相应警察荣誉仪式的公安机关是：（单选）',options:{A:'公安机关派出机构',B:'县级以上公安机关',C:'设区的市级以上公安机关',D:'省级以上公安机关'}},
 [upper('police-law-case-1-1')]:{pages:[[110,.098,.195]],prompt:'关于民警使用冯某车辆的说法正确的有：（多选）',options:{A:'可以优先使用冯某的车辆',B:'Y市公安局应当赔偿冯某的车辆损失',C:'Y市公安局赔偿后，可以向民警王某追偿',D:'应当由民警郑某赔偿冯某的车辆损失费用'}},
 [lower('2026-guangdong-20')]:{sourceId:LOWER,pages:[[243,.419,.509]],prompt:'《民法典》第九条规定：“民事主体从事民事活动，应当有利于节约资源、保护生态环境。”下列表述体现了该项规定的有：',options:{A:'是《民法典》回应生态保护需求的创新原则',B:'要求民事主体节约资源、保护生态环境',C:'仅适用于环境污染相关的民事活动',D:'贯穿于物权、合同、侵权责任等各编'}}
};
for(const [id,patch]of Object.entries(manual)){
 const r=get(id);assert(r,id);const q=r.details.question,sid=patch.sourceId||UPPER;
 q.prompt=patch.prompt;q.options=patch.options;q.originalPages=patch.pages.map(([p,y,end])=>img(sid,p,y,end));
 q.textStatus='verified';q.verifiedText=true;q.textVerification={checkedAt:date,scope:'仅题干与选项逐字对照原图，答案沿用卷末，非全部法规核验'};
 if(patch.contextText){q.contextText=patch.contextText;q.contextTextStatus='verified-transcription';}
 r.body=q.prompt+'\n'+Object.entries(q.options).map(([k,v])=>k+'.'+v).join('\n');r.studyQuestion.promptPreview=q.prompt;
 r.sourceRefs=[...q.originalPages.map(imageRef),...r.sourceRefs.filter(x=>x.sourceId!==sid||x.label?.includes('答案'))];
 mark(r,'补齐空白题干与选项，修正原图裁切/续页');
}
// The printed 2022 scenario ranges overlap; actual question 97 belongs to the
// bus robbery scenario. The gambling diagram begins after 97 and serves 98–100.
{
 const r=get(lower('2022-academy-97')),q=r.details.question;
 q.originalPages=[img(LOWER,26,.723333,.851778)];
 q.contextRangeNote='原册情景标题“94—96”“97—100”范围印刷有误；按实际题干，94—97共用盗窃案材料，98—100共用网络赌博图。';
 r.sourceRefs=[...q.originalPages.map(imageRef),...r.sourceRefs.filter(x=>x.label?.includes('答案'))];
 mark(r,'修正原册情景范围错印：第97题属于前一组，第98题开始新材料');
}
// The original import used a 60 cutoff, but this paper starts scenarios at 71.
for(const r of lowerRows.filter(r=>r.studyQuestion.paperId==='2025-jiangsu'&&r.studyQuestion.number>=61&&r.studyQuestion.number<=70)){
 r.studyQuestion.groupType='multi';r.details.calibration.groupType='multi';
 r.tags=r.tags.map(t=>t==='情境题'?'多选区':t);
 mark(r,'按原页纠正情景分区：61—70属于多选区，情景从71题开始（单题题型保持原印刷提示）');
}
// The next question's first line was attached to the previous question by OCR.
{
 const r=get(lower('2026-guangdong-19')),q=r.details.question;
 r.body=r.body.replace(/\n《民法典》第九条[\s\S]*$/,'');q.prompt=q.prompt.replace(/\n《民法典》第九条[\s\S]*$/,'');
 q.originalPages=[img(LOWER,243,.292,.419)];r.sourceRefs=[...q.originalPages.map(imageRef),...r.sourceRefs.filter(x=>x.label?.includes('答案'))];
 mark(r,'移除被误并入的第20题首行，收紧第19题边界');
}
// Structured originals for every scanned question; OCR is a reference, never the default source.
for(const r of originals){
 const q=r.details.question,s=r.studyQuestion,sid=s.bank==='police-drill-20260917'?UPPER:LOWER;
 if(!q.originalPages?.length){
  q.originalPages=r.sourceRefs.filter(x=>x.sourceId===sid&&!x.label?.includes('答案')).flatMap(ref=>(ref.regions?.length?ref.regions:[{x:.055,y:.035,w:.91,h:.89}]).map(region=>({...img(sid,ref.page),region})));
  mark(r,'建立可直接展示的原题图（含跨页）');
 }
 if(verifiedAnchorIds.has(r.id)||manual[r.id]){q.textStatus='verified';q.verifiedText=true;}
 else {q.textStatus='ocr-reference';q.verifiedText=false;}
 const missing=['A','B','C','D'].filter(k=>typeof q.options?.[k]!=='string'||!q.options[k].trim());
 if(missing.length){q.options||={};for(const k of missing)q.options[k]=`${k}选项见上方原题图`;mark(r,'补全选择按钮；未识别文字保留原图，不猜写');}
 if(s.caseNumber){
  const explicit=/[（(]\s*单选/.test(q.prompt)?'single':/[（(]\s*多选/.test(q.prompt)?'multi':null;
  q.type=explicit||(q.referenceAnswer?.length===1?'single':'multi');s.groupType='case';s.type=q.type;
 }
 const answer=q.referenceAnswer||'';
 let expected;
 if(sid===UPPER){const sec=sections.find(x=>x.id===s.sectionId);expected=s.caseNumber?sec?.cases[s.caseNumber-1]?.[s.number-1]:sec?.[s.type]?.[s.number-1];
  if(s.sectionId==='police-basics'&&!s.caseNumber&&s.type==='multi'&&[7,8,9].includes(s.number))expected={7:'AB',8:'ACD',9:'ABC'}[s.number];
 }else expected=lowerPapers.find(p=>p.id===s.paperId)?.keys[s.number-1];
 const conflicts=[];
 if(expected&&expected!=='?'&&answer!==expected)conflicts.push(`现存答案${answer||'空'}与已转录卷末/勘误${expected}不一致`);
 if(s.referenceAnswer&&s.referenceAnswer!==answer)conflicts.push(`目录答案${s.referenceAnswer}与题目答案${answer}不一致`);
 if(s.type==='single'&&answer.length>1)conflicts.push('单选题的卷末答案列出多个选项');
 if(!/^[A-D]{1,4}$/.test(answer))conflicts.push('没有可用于判分的明确选项答案');
 if(conflicts.length){q.gradingExcluded=true;s.gradingExcluded=true;q.gradingExclusionReason=conflicts.join('；');q.answerVerificationStatus='conflict-pending';issue(r,'grading-excluded',q.gradingExclusionReason);}
 else if(!q.gradingExcluded){q.answerVerificationStatus=q.errata?'book-errata':'book-key';}
 if(q.gradingExcluded&&!q.gradingExclusionReason){q.gradingExclusionReason=q.answerConflict||'原题册已标记争议或无答案，暂不判分';issue(r,'grading-excluded',q.gradingExclusionReason);}
 if(q.gradingExcluded&&!report.issues.some(x=>x.id===r.id&&x.kind==='grading-excluded'))issue(r,'grading-excluded',q.gradingExclusionReason);
 q.answerSourceNote=q.errata?'保留原题历史口径，优先采用书附勘误；不等于全部现行法选项已逐项核准。':'保留题册卷末历史答案；手写笔记、OCR与法规版本如冲突，需分别核实。';
 if(q.errata?.note&&/第69页多选/.test(q.errata.note)){
  q.errata={...q.errata,page:3};if(!r.sourceRefs.some(x=>x.sourceId===ERRATA&&x.page===3))r.sourceRefs.push({sourceId:ERRATA,page:3,label:'正确答案勘误：7.AB 8.ACD 9.ABC',regions:[]});
  const card=get(q.answerCardId);if(card&&!card.sourceRefs.some(x=>x.sourceId===ERRATA&&x.page===3))card.sourceRefs.push({sourceId:ERRATA,page:3,label:'最终答案勘误',regions:[]});
 }
}

const lowerOCR=new Map(),upperOCR=new Map();
function readLines(sid,page){const cache=sid===LOWER?lowerOCR:upperOCR;if(cache.has(page))return cache.get(page);
 let f=sid===LOWER?path.join(ROOT,`tmp/pdfs/lower-book/${page}-ocr.json`):path.join(ROOT,`tmp/question-notes/printed-ocr/${page}.json`);
 if(sid===UPPER&&!fs.existsSync(f))f=path.join(ROOT,`tmp/question-notes/ocr/source-cc8b3e9a5da3eedaf23b6476-${page}.json`);
 if(!fs.existsSync(f)){cache.set(page,[]);return[];}const o=JSON.parse(fs.readFileSync(f));
 const rows=sid===LOWER?(o.text||[]).map(([box,text])=>({text,y:Math.min(...box.map(p=>p[1]))/o.height,end:Math.max(...box.map(p=>p[1]))/o.height,x:Math.min(...box.map(p=>p[0]))/o.width})):(o.lines||[]).map(l=>({text:l.text,y:Math.min(...l.box.map(p=>p[1]))/o.height,end:Math.max(...l.box.map(p=>p[1]))/o.height,x:Math.min(...l.box.map(p=>p[0]))/o.width}));
 cache.set(page,rows);return rows;
}
function span(sid,start,end){const pages=[];for(let p=start.page;p<=end.page;p++){const y=p===start.page?Math.max(.025,start.y):.035,stop=p===end.page?end.y:.925;if(stop>y+.008)pages.push(img(sid,p,y,Math.min(.94,stop)));}return pages;}
const pos=p=>p.page+p.region.y;
function attachGroup({id,title,rows,contextPages,evidence}){
 rows.sort((a,b)=>a.studyQuestion.number-b.studyQuestion.number);
 assert(rows.length>1,`Invalid group ${id}`);
 for(const [index,r]of rows.entries()){
  const s=r.studyQuestion,q=r.details.question;
  Object.assign(s,{caseGroupId:id,caseIndex:index+1,caseCount:rows.length,caseGroupOrder:s.number,caseTitle:title,groupType:'case'});
  q.contextPages=contextPages;
  // Some later questions refer to charts printed in a previous subquestion, not in the header.
  const needsPriorFigure=index>0&&/上图|上表|图中|图示|根据.{0,15}图|结合.{0,10}图|依据.{0,10}图|上述.*表/.test(q.prompt||'');
  if(needsPriorFigure)q.contextPages=[...contextPages,...rows.slice(0,index).flatMap(r=>r.details.question.originalPages||[])];
  q.contextStatus='source-scan';q.caseSourceRefs=[...new Set(rows.flatMap(r=>r.details.question.originalPages.map(p=>p.page)).concat(contextPages.map(p=>p.page)))].sort((a,b)=>a-b).map(page=>({sourceId:contextPages[0]?.sourceId||rows[0].sourceRefs[0].sourceId,page,label:title+' · 整组原页',regions:[]}));
  q.caseSourceAudit={version,checkedAt:date,scope:'共享材料标题、题号范围及原页位置；OCR文字仍需原图核对',evidence};
  if(!contextPages.length){q.gradingExcluded=true;s.gradingExcluded=true;q.gradingExclusionReason='情景共用材料定位未完成，请先对照整组原页，暂不判分';issue(r,'missing-context',q.gradingExclusionReason);}
 }
 report.groups.push({id,title,questionIds:rows.map(r=>r.id),contextPages,range:[rows[0].studyQuestion.number,rows.at(-1).studyQuestion.number],evidence});
}
// Lower volume explicitly prints the question range for every shared scenario.
for(const paper of lowerPapers){
 const headers=[];
 for(let page=paper.start;page<=paper.end;page++)for(const l of readLines(LOWER,page)){
  const range=l.text.match(/[（(][一二三四五六七八九十]+[）)].*?(\d{2,3})\s*[-~～—–－一至]\s*(\d{2,3})\s*题/);
  if(range&&/情[景境]/.test(l.text)){
   const h={page,y:l.y-.006,text:l.text,start:+range[1],end:+range[2]};
   if(paper.id==='2022-academy'&&h.start===94)h.end=97;
   if(paper.id==='2022-academy'&&h.start===97){h.start=98;h.text+='（原书范围错印，实际98—100）';}
   headers.push(h);
  }
 }
 for(const h of headers){
  const rows=lowerRows.filter(r=>r.studyQuestion.paperId===paper.id&&r.studyQuestion.number>=h.start&&r.studyQuestion.number<=h.end);
  assert.equal(rows.length,h.end-h.start+1,`Incomplete lower group ${paper.id}:${h.start}`);
  const first=rows.find(r=>r.studyQuestion.number===h.start).details.question.originalPages[0];
  let end={page:first.page,y:first.region.y};
  if(end.page+end.y<=h.page+h.y)issue(rows[0],'context-boundary','首题起点位于情景标题前，暂保留整页材料');
  let contextPages=span(LOWER,h,end);
  if(!contextPages.length)contextPages=[img(LOWER,h.page,h.y,.925)];
  attachGroup({id:`case-lower-${paper.id}-${h.start}-${h.end}`,title:`${paper.title} · 情景 ${h.start}—${h.end} 题`,rows,contextPages,evidence:h.text});
  // Stop the preceding question before this new scenario starts.
  const prev=lowerRows.find(r=>r.studyQuestion.paperId===paper.id&&r.studyQuestion.number===h.start-1);
  if(prev){const pq=prev.details.question;const overlaps=pq.originalPages.some(p=>p.page===h.page&&p.region.y<h.y&&p.region.y+p.region.h>h.y+.006);if(overlaps){pq.originalPages=pq.originalPages.filter(p=>p.page<h.page||p.page===h.page&&p.region.y<h.y).map(p=>p.page===h.page?{...p,region:{...p.region,h:+(h.y-p.region.y).toFixed(6)}}:p);mark(prev,'移除下一个情景的公共背景，背景改由题组共享');}}
 }
 const ungrouped=lowerRows.filter(r=>r.studyQuestion.paperId===paper.id&&r.studyQuestion.groupType==='case'&&!r.studyQuestion.caseGroupId);
 for(const r of ungrouped)issue(r,'ungrouped-case','本卷情景题标题范围未被可靠提取');
}
const chinese=['','一','二','三','四','五','六','七','八','九','十'];
for(const sec of sections)for(let c=1;c<=sec.cases.length;c++){
 const rows=upperRows.filter(r=>r.studyQuestion.sectionId===sec.id&&r.studyQuestion.caseNumber===c);
 assert.equal(rows.length,sec.cases[c-1].length,`Incomplete upper group ${sec.id}:${c}`);
 const first=rows.find(r=>r.studyQuestion.number===1).details.question.originalPages[0],firstPos=pos(first),candidates=[];
 for(let page=Math.max(sec.start+7,first.page-2);page<=first.page;page++)for(const l of readLines(UPPER,page)){
  const explicit=new RegExp(`^[（(]${chinese[c]}[）)]`).test(l.text.trim());
  const singleGroup=sec.cases.length===1&&/[三四]、\s*情[景境]/.test(l.text);
  if((explicit||singleGroup)&&page+l.y<firstPos)candidates.push({page,y:Math.max(.025,l.y-.006),text:l.text});
 }
 let start=candidates.sort((a,b)=>b.page+b.y-a.page-a.y)[0];
 if(!start){
  const text=rows[0].details.question.contextText||'';const fragment=text.split('\n').find(t=>t.length>15)?.slice(0,12);
  if(fragment)for(let page=Math.max(sec.start+7,first.page-1);page<=first.page;page++)for(const l of readLines(UPPER,page))if(l.text.includes(fragment)&&page+l.y<firstPos)start={page,y:Math.max(.025,l.y-.006),text:'按共用材料首行定位'};
 }
 const contextPages=start?span(UPPER,start,{page:first.page,y:first.region.y}):[];
 attachGroup({id:`case-upper-${sec.id}-${c}`,title:`${sec.name} · 情景第${c}组`,rows,contextPages,evidence:start?.text||'待核对共享材料定位'});
}
// Final group references are computed after all following-header crops have
// been removed, so running the repair twice produces exactly the same data.
for(const group of report.groups){
 const rows=group.questionIds.map(get),sourceId=group.contextPages[0]?.sourceId||rows[0].sourceRefs[0].sourceId;
 const pages=[...new Set(rows.flatMap(r=>r.details.question.originalPages.map(p=>p.page)).concat(group.contextPages.map(p=>p.page)))].sort((a,b)=>a-b);
 for(const r of rows)r.details.question.caseSourceRefs=pages.map(page=>({sourceId,page,label:group.title+' · 整组原页',regions:[]}));
}

// Audit every original image, complete original attachment and selection/answer contract.
for(const r of originals){
 const q=r.details.question,s=r.studyQuestion;
 const allPages=[...(q.originalPages||[]),...(q.contextPages||[])];
 for(const p of allPages){
  const a=p.region,valid=a&&['x','y','w','h'].every(k=>Number.isFinite(a[k]))&&a.x>=0&&a.y>=0&&a.w>0&&a.h>0&&a.x+a.w<=1.00001&&a.y+a.h<=1.00001;
  const exists=fs.existsSync(path.join(DATA,'previews',p.sourceId,`${p.page}-hd.webp`));
  if(!valid||!exists){const reason=!valid?'原题裁切坐标无效':'原题高清预览缺失';issue(r,'image-unavailable',`${reason}：${p.sourceId}/${p.page}`);q.gradingExcluded=true;s.gradingExcluded=true;q.gradingExclusionReason=reason;}
 }
 if(!q.originalPages?.length){issue(r,'no-image','原题图片没有入口');q.gradingExcluded=true;s.gradingExcluded=true;q.gradingExclusionReason='原题图片没有入口，暂不判分';}
 if(!q.prompt?.trim())issue(r,'blank-prompt','保留原题图；OCR题干尚未转录');
 q.sourceAudit={version,checkedAt:date,imageStatus:allPages.length?'available':'missing',textStatus:q.textStatus||'verified',scope:'结构检查与题组定位；仅明确标注的文字经过逐字核对'};
}
for(const source of db.sources){const p=path.join(DATA,'originals',source.filename);if(!fs.existsSync(p))report.issues.push({sourceId:source.id,kind:'missing-original',reason:source.missing?'原登记已缺失':'原登记文件不存在'});else if(fs.statSync(p).size!==source.size)report.issues.push({sourceId:source.id,kind:'original-size-mismatch',reason:'原附件大小与登记不同'});}

// Synchronize the cached type split while preserving every historical score.
const scoreQuestions=scoreBefore.questions.map(old=>{
 const r=lowerRows.find(r=>r.studyQuestion.paperId===old.paperId&&r.studyQuestion.number===old.number);
 assert(r);assert.equal(gradeLower(old),r.studyQuestion.calibration);
 return {...old,groupType:r.studyQuestion.groupType};
});
const scoreAnalysis=summarizeLower(scoreBefore.papers,scoreQuestions);
for(const key of ['correct','wrong','pending','excluded','total','eligible','known','coverage','lower','upper','averageLower','averageUpper','topics','multiErrors'])assert.deepEqual(scoreAnalysis[key],scoreBefore[key],`Preserve historical scores ${key}`);
const scorePapers=scoreAnalysis.papers.map(p=>p.id==='2025-jiangsu'?{...p,multi:70}:p);
const scoreAfter={...scoreBefore,questions:scoreQuestions,papers:scorePapers,types:scoreAnalysis.types};
const summary=get('lower-20261014-report');summary.details.lowerStudy.types=scoreAnalysis.types;summary.details.lowerStudy.papers=scorePapers;
report.typeCounts={before:Object.fromEntries(Object.entries(scoreBefore.types).map(([k,v])=>[k,v.total])),after:Object.fromEntries(Object.entries(scoreAnalysis.types).map(([k,v])=>[k,v.total]))};
// Generated textbook quizzes contain five recall prompts, not missing A–D questions.
report.otherBanks=Object.fromEntries([...new Set(db.records.filter(r=>r.studyQuestion&&!originals.includes(r)).map(r=>r.studyQuestion.bank))].map(bank=>{
 const rows=db.records.filter(r=>r.studyQuestion?.bank===bank);const invalid=rows.filter(r=>r.details.question.type!=='recall'&&(!/^[A-D]{1,4}$/.test(r.details.question.referenceAnswer||'')||Object.keys(r.details.question.options||{}).length<4));
 return [bank,{count:rows.length,recall:rows.filter(r=>r.details.question.type==='recall').length,invalidChoiceRecords:invalid.map(r=>r.id),scope:'仅结构检查；内容不冒充本轮逐项核验'}];
}));
// Answer cards must jump to the repaired question, not the former blank crop.
for(const id of Object.keys(manual)){
 const r=get(id),card=get(r.details.question.answerCardId);if(!card||card.studyQuestion)continue;
 const sid=manual[id].sourceId||UPPER,refs=r.details.question.originalPages.map(imageRef);
 card.sourceRefs=[...refs,...(card.sourceRefs||[]).filter(x=>x.sourceId!==sid||x.label?.includes('答案'))];
 if(card.details?.evidence?.originals)card.details.evidence.originals=[...refs.map(ref=>({...ref,sourceType:'original',rawText:r.body})),...card.details.evidence.originals.filter(x=>x.sourceId!==sid||x.label?.includes('答案'))];
}

const changed=db.records.filter(r=>JSON.stringify(r)!==JSON.stringify(before.records.find(x=>x.id===r.id)));
report.changedFields=changed.map(r=>{const old=before.records.find(x=>x.id===r.id);return{id:r.id,fields:Object.keys(r).filter(k=>JSON.stringify(r[k])!==JSON.stringify(old[k])),questionFields:Object.keys(r.details?.question||{}).filter(k=>JSON.stringify(r.details.question[k])!==JSON.stringify(old.details?.question?.[k]))};});
// Preserve personal history and all original attachments. Exclusion is a new grading guard only.
for(const old of before.records){const now=get(old.id);if(old.studyQuestion)for(const key of ['historicalAnswer','historicalWrong','historicalCorrect','correctionAnswer','redMark','blueMark','calibration'])assert.deepEqual(now.studyQuestion[key],old.studyQuestion[key],`${old.id} history ${key}`);if(old.details?.question)assert.equal(now.details.question.referenceAnswer,old.details.question.referenceAnswer,`${old.id} answer`);}
assert.deepEqual(db.sources,before.sources);
report.counts={originalQuestions:originals.length,upper:upperRows.length,lower:lowerRows.length,caseGroups:report.groups.length,caseQuestions:originals.filter(r=>r.studyQuestion.caseGroupId).length,changedRecords:changed.length,manualTextRepairs:Object.keys(manual).length,gradingExcluded:originals.filter(r=>r.details.question.gradingExcluded).length,verifiedText:originals.filter(r=>r.details.question.verifiedText).length,ocrReference:originals.filter(r=>r.details.question.textStatus==='ocr-reference').length,issues:report.issues.length};
if(process.argv.includes('--write')&&changed.length){
 const stamp=new Date().toISOString(),backupDir=path.join(DATA,'backups','question-source-repair-'+stamp.replace(/[:.]/g,'-'));fs.mkdirSync(backupDir,{recursive:true});fs.writeFileSync(path.join(backupDir,'platform.json'),original,'utf8');fs.writeFileSync(path.join(backupDir,'lower-study-report.json'),scoreOriginal,'utf8');
 if(fs.readFileSync(file,'utf8')!==original||fs.readFileSync(scoreFile,'utf8')!==scoreOriginal)throw new Error('platform/report changed concurrently; retry');
 for(const r of changed){r.revision=(r.revision||1)+1;r.updatedAt=stamp;}
 db.version++;db.updatedAt=stamp;const temp=file+'.source-audit-tmp',scoreTemp=scoreFile+'.source-audit-tmp';fs.writeFileSync(temp,JSON.stringify(db,null,2)+'\n','utf8');fs.writeFileSync(scoreTemp,JSON.stringify(scoreAfter,null,2)+'\n','utf8');
 try{fs.renameSync(temp,file);fs.renameSync(scoreTemp,scoreFile);}catch(error){fs.writeFileSync(file,original,'utf8');fs.writeFileSync(scoreFile,scoreOriginal,'utf8');throw error;}
 report.backupDir=backupDir;report.versionAfter=db.version;
 fs.writeFileSync(path.join(DATA,'question-source-repair-receipt.json'),JSON.stringify({versionBefore:before.version,versionAfter:db.version,backupDir,changedRecords:changed.length,createdAt:stamp},null,2)+'\n','utf8');
}else report.versionAfter=db.version;
report.sha256=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
fs.writeFileSync(path.join(DATA,'question-source-audit.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({write:process.argv.includes('--write'),version:report.versionAfter,...report.counts,issues:report.issues.filter(x=>x.kind!=='grading-excluded').slice(0,30)}));
