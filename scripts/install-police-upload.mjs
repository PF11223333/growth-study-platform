import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,DATA,atomic,backup,hash,mergeImported,read,validateRecord,write} from '../server/store.mjs';
import {policeUploadMemory} from './police-upload-memory.mjs';

const stage=path.join(ROOT,'tmp/police-1118');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const input=json(path.join(stage,'extracted.json'));
const db=read(), originalVersion=db.version;
const date='2026-11-18';
const letters=['A','B','C','D'];
const names={
 1:['2026-national','2026 国考回忆卷 · 新上传版'],
 2:['2025-provinces','2025 多省联考回忆卷 · 附解析'],
 3:['2025-national','2025 国考回忆卷 · 附解析'],
 6:['2027-muzhiwen-1','2027 母志文公安联考一模'],
 7:['2027-muzhiwen-2','2027 母志文公安联考二模'],
 9:['2027-baining-1','2027 白宁公安联考一模'],
 10:['current-affairs','公安时政专题 110 题'],
};
const ref=(sourceId,page,label)=>({sourceId,page,label});
const officialJuly='https://gat.fujian.gov.cn/jwdt/gayw/202607/t20260721_7190360.htm';
const officialPlan='https://www.moe.gov.cn/jyb_xwfb/s6052/moe_838/202510/t20251028_1418317.html';
const currentLaw='https://gaj.wuhan.gov.cn/zwgk_12/zcfg/flfg/202610/t20261009_2858138.html';
const legislatedNotes={
 '6:95':'现行《治安管理处罚法》第9条要求调解遵循自愿原则。关于赔偿等民事争议，可以依法提起民事诉讼。',
 '6:100':'现行《治安管理处罚法》第126条中，申请暂缓执行须有法定情形并经公安机关考量社会危险，保证金按行政拘留每日200元计算。题册答案另供对照。',
};
const previousById=new Map(db.records.map(row=>[row.id,row]));
const sources=Object.values(input.sources);
const manifests=new Map(sources.map(s=>[s.id,json(path.join(stage,'previews',s.id,'manifest.json'))]));
const sourceClip=(sourceId,page,region={x:0,y:0,w:1,h:1})=>{
 const m=manifests.get(sourceId).pages[page-1];
 assert.equal(m.page,page);
 return {sourceId,page,width:m.width,height:m.height,region,previewSuffix:'-hd'};
};
const makeClip=clip=>sourceClip(clip.sourceId,clip.page,clip.region);
const trimmed=text=>text?.normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu,'')||'';
const rows=[], legacyLinks=new Map(), report={papers:{},conflicts:[],incomplete:[],verifiedOfficial:[]};

for(const [no,[key,name]] of Object.entries(names)){
 const n=Number(no), paper=input.papers[n], source=input.sources[n];
 const stats={questions:0,scored:0,standaloneScored:0,explanations:0,figureQuestions:0,linkedLegacy:0};
 const bank='police-upload-'+key;
 report.papers[key]=stats;
 assert.equal(paper.rows.length,n===10?110:100);
 const groups=new Map(paper.groups.map(group=>[group.start,group]));
 const resolveGroup=q=>q.group===94&&n===6&&q.number>=98?null:groups.get(q.group);
 for(const q of paper.rows){
  const number=q.number,id=`${bank}-${number}`,group=resolveGroup(q);
  const groupRows=group?paper.rows.filter(row=>resolveGroup(row)===group):[];
  const choiceType=q.type;
  const questionFigures=q.figures.map(makeClip), contextFigures=(group?.figures||[]).map(makeClip);
  const hasVisual=!!(questionFigures.length||contextFigures.length);
  const incompleteChoices=letters.filter(key=>!q.options[key]?.trim());
  const hasGraphChoices=incompleteChoices.length===4&&questionFigures.length>0;
  const incomplete=incompleteChoices.length>0&&!hasGraphChoices;
  const old=previousById.get(q.previous?.id);
  const oldQuestion=old?.details?.question;
  const explanationSource=input.sources[n===2?4:n===3?5:n];
  let answer=paper.key[number]?.answer||'', evidence=paper.key[number], note='';
  let official;
  if(n===1&&number===1&&/事前预防/.test(q.options.D||'')){
   official={label:'“十五五”规划建议 · 公共安全治理',url:officialPlan};
   answer='D';note='规划建议明确推动公共安全治理模式向事前预防转型，所以本版选 D。';
  }
  if(n===7&&number===1&&/精确防范.*精细管控.*精准打击/.test(q.options.B||'')){
   official={label:'福建省公安厅 · 全国公安厅局长座谈会',url:officialJuly};
   answer='B';note='座谈会要求精确防范、精细管控、精准打击，按本版选项顺序选 B。';
  }
  if(official)report.verifiedOfficial.push(id);
  if(n===1&&!answer&&oldQuestion&&!oldQuestion.gradingExcluded&&!oldQuestion.answerConflict&&q.previous.similarity>=.85
    &&letters.every(k=>trimmed(q.options[k]).length>=4&&trimmed(q.options[k])===trimmed(oldQuestion.practiceSurface?.options?.[k]?.text||oldQuestion.options?.[k]))){
   answer=oldQuestion.referenceAnswer;
   note='已与题库对应版本的题干、选项文字和顺序比对。';
  }
  const conflict=!!(evidence&&q.previous?.answer&&q.previous.similarity>=.6&&answer!==q.previous.answer);
  const incompatible=!!answer&&((choiceType==='single')!==(answer.length===1));
  const explicitVisual=/(?:见|结合|根据|如|参照)(?:上图|下图|以下图|下表|图[一二三四①②③④1-9]|表[1-9一二三四])|四幅图|下列图示/.test(q.prompt);
  const missingFigure=!!(explicitVisual&&!hasVisual);
  const pending=[!answer&&'上传原卷未附可核实的答案，可先自测。',conflict&&`本版配套解析列 ${answer}，已有题库版本为 ${q.previous.answer}。两版题面或答案存在差异，暂缓计分。`,incompatible&&'题型和答案字母数量不一致。',incomplete&&'上传原卷的选项不完整。',missingFigure&&'题干引用的图表尚未在本版定位。'].filter(Boolean);
  const gradingExcluded=!!pending.length;
  const options=Object.fromEntries(letters.map(k=>[k,q.options[k]||(hasGraphChoices?`见上方原图的 ${k} 项`:'本版选项待核对')]));
  const pages=Array.from({length:q.end.page-q.entry.page+1},(_,i)=>sourceClip(source.id,q.entry.page+i));
  const references=pages.map(p=>ref(source.id,p.page,'新上传原卷'));
  if(group&&!references.some(r=>r.page===group.header.page))references.push(ref(source.id,group.header.page,'本组共用情景材料'));
  if(n===6){
   const alternate=input.papers[8].rows[number-1];
   assert.equal(alternate.number,number);
   references.push(ref(input.sources[8].id,alternate.entry.page,'同卷文字版'));
  }
  if(evidence)references.push(ref(explanationSource.id,evidence.page,evidence.text?'配套答案与解析':'卷末参考答案'));
  if(official)references.push(official);
  const lawNote=legislatedNotes[`${n}:${number}`];
  if(lawNote)references.push({label:'现行治安管理处罚法',url:currentLaw});
  const resolvedGroup=group?{caseGroupId:`${bank}-case-${group.start}`,caseIndex:number-group.start+1,caseCount:groupRows.length,caseTitle:`共用情景 · 第 ${group.start}–${groupRows.at(-1).number} 题`,groupType:'case'}:{};
  const sectionName=n===10?(number<=65?'时政单选':'时政多选'):group?'情景题':choiceType==='multi'?'多项选择':'单项选择';
  const question={
   origin:'source-scan',type:choiceType,prompt:q.prompt,options,referenceAnswer:answer,bookAnswer:evidence?.answer||'',
   answerVerificationStatus:gradingExcluded?'pending':official?'verified-source-and-reasoning':'verified-book-key',
   gradingExcluded,gradingExclusionReason:pending.join(' '),answerConflict:conflict?pending.find(x=>x.startsWith('本版')):'',
   answerEvidence:evidence?{bookAnswer:evidence.answer,sourceId:explanationSource.id,pages:[evidence.page]}:undefined,
   verifiedText:!incomplete&&!hasGraphChoices,originalPages:pages,hideOriginalUntilAnswer:true,
   practiceSurface:{stem:q.prompt,options:Object.fromEntries(letters.map(k=>[k,{text:options[k]}])),...(group?{context:group.text}:{})},
   requiresImage:hasVisual||missingFigure,
   ...(hasVisual||missingFigure?{practiceVisuals:{status:hasVisual?'ready':'pending',question:questionFigures,context:contextFigures}}:{}),
   answerScope:official?'按所列公开原文核对。':evidence?(n===2||n===3?'配套教辅解析。回忆题按本版题面核对，做现行法练习时留意新旧法。':'以上传资料的参考答案为依据。'):'上传原卷未附可核实答案。',
   currentLawNote:lawNote||((n===2||n===3)&&/治安管理处罚法/.test(q.prompt+(evidence?.text||''))?'请按试卷的考试时点理解解析。现行修订版自 2026 年 1 月 1 日起施行。':''),
   ...(evidence?.text||note||lawNote?{tutorial:{authored:{title:evidence?.text?'配套解析':'答案依据',origin:evidence?.text?'上传解析原文':'核对原文',scope:'本题作答依据',body:[evidence?.text,note,lawNote].filter(Boolean).join('\n\n'),sources:official?[{title:official.label,url:official.url}]:lawNote?[{title:'现行治安管理处罚法',url:currentLaw}]:[]}}}:{}),
  };
  const row={id,kind:'practice',origin:'police-upload-20261118',subject:'gongan',title:`${name} · 第 ${number} 题`,topic:n===10?'公安时政':name,body:q.prompt,date,tags:['公安新上传',sectionName],sourceRefs:references,
   links:old&&q.previous.similarity>=.7?[old.id]:[],studyQuestion:{bank,bankName:name,bankType:n<=3?'exam':n===10?'current-affairs':'mock',chapter:1,chapterName:name,sectionId:sectionName,sectionName,number,type:choiceType,promptPreview:q.prompt.slice(0,180),gradingExcluded,gradingExclusionReason:question.gradingExclusionReason,...resolvedGroup},details:{question}};
  rows.push(row);stats.questions++;
  if(!gradingExcluded)stats.scored++;
  if(evidence?.text)stats.explanations++;
  if(hasVisual)stats.figureQuestions++;
  if(incomplete||missingFigure)report.incomplete.push({id,missingFigure,incompleteChoices});
  if(conflict)report.conflicts.push({id,answer,other:q.previous.answer,previous:old.id});
  if(row.links.length){
   legacyLinks.set(old.id,{id,refs:references.filter(r=>r.sourceId&&r.sourceId!==input.sources[8].id),conflict});
   stats.linkedLegacy++;
  }
 }
 const bankRows=rows.filter(row=>row.studyQuestion.bank===bank);
 const blocked=new Set(bankRows.filter(r=>r.studyQuestion.gradingExcluded).map(r=>r.studyQuestion.caseGroupId).filter(Boolean));
 stats.standaloneScored=bankRows.filter(r=>!r.studyQuestion.gradingExcluded&&!blocked.has(r.studyQuestion.caseGroupId)).length;
}

for(const [key,title,prompt,answer,hint,url] of policeUploadMemory){
 rows.push({id:'police-upload-memory-'+key,kind:'memory',origin:'police-upload-20261118',subject:'gongan',title,topic:'公安时政与现行法',body:`### 回忆题\n\n${prompt}\n\n### 答案\n\n${answer}\n\n### 提醒\n\n${hint}`,date,tags:['公安新上传','速记'],sourceRefs:[{url,label:'公开权威原文'}],links:[]});
}
rows.push({id:'police-upload-handout-20261118',kind:'knowledge',origin:'police-upload-20261118',localOnly:true,subject:'gongan',title:'2027 公安时政讲义',topic:'公安时政',body:'从原讲义复习答题技巧、公安会议、基层警务和时政专题。',date,tags:['公安新上传','本地原资料'],sourceRefs:[ref(input.sources[11].id,3,'技巧目录'),ref(input.sources[11].id,10,'时政专题'),ref(input.sources[11].id,23,'时政练习')],links:[]});
assert.equal(rows.filter(r=>r.kind==='practice').length,710);
assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
const merged=mergeImported(db,rows,sources);
let linkedLegacy=0;
for(const [id,cross] of legacyLinks){
 const old=previousById.get(id);
 if(old.links?.includes(cross.id))continue;
 old.links=[...new Set([...(old.links||[]),cross.id])];
 old.sourceRefs=[...(old.sourceRefs||[]),...cross.refs.filter(ref=>!old.sourceRefs?.some(prev=>prev.sourceId===ref.sourceId&&prev.page===ref.page))];
 if(cross.conflict)old.details.question.currentLawNote=[old.details.question.currentLawNote,'新上传回忆卷的配套答案与此版本不同，查阅新版本及解析时请以对应题面为准。'].filter(Boolean).join('\n');
 old.revision++;linkedLegacy++;
}
for(const row of rows)validateRecord(row,db,db.records.find(r=>r.id===row.id));
for(const source of sources){
 const existing=path.join(DATA,'originals',source.filename);
 const manifest=manifests.get(source.id);
 assert.equal(manifest.pages.length,source.pageCount);
 assert.equal(hash(fs.readFileSync(source.originalPath)),source.sha256);
 if(fs.existsSync(existing))assert.equal(hash(fs.readFileSync(existing)),source.sha256);
}
Object.assign(report,{merged,linkedLegacy,sources:sources.length,cards:policeUploadMemory.length});
if(process.argv.includes('--write')){
 assert.equal(read().version,originalVersion);
 report.snapshot=backup();
 for(const source of sources){
  const existing=path.join(DATA,'originals',source.filename);
  if(!fs.existsSync(existing))fs.copyFileSync(source.originalPath,existing,fs.constants.COPYFILE_EXCL);
  fs.cpSync(path.join(stage,'previews',source.id),path.join(DATA,'previews',source.id),{recursive:true});
 }
 write(db);
 report.version=db.version;
 atomic(path.join(ROOT,'output/reports/police-upload-20261118.json'),report);
}
console.log(JSON.stringify({...report,incomplete:report.incomplete.length,conflicts:report.conflicts.length},null,2));
