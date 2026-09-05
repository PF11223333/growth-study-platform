import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {ROOT,DATA,read,write,backup,hash,idFor,mergeImported,atomic,now,publicClean} from '../server/store.mjs';
const parent=path.dirname(ROOT),police=path.join(parent,'公安专业复盘网站','data'),garden=path.join(parent,'个人复盘网站','data'),shenlun=path.join(parent,'申论素材库');
const json=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const arr=v=>Array.isArray(v)?v:[];
const text=v=>typeof v==='string'?v:Array.isArray(v)?v.map(text).join('\n'):v&&typeof v==='object'?Object.entries(v).map(([k,val])=>`${k}：${text(val)}`).join('\n'):v==null?'':String(v);
const label={rule:'核心知识',method:'解题方法',exception:'例外边界',memory:'记忆提示',pitfalls:'易混点',easyExample:'例子',storyMemory:'记忆场景',keyPoints:'学习要点',actions:'下一步行动',uncertainties:'待确认',summary:'摘要',story:'当天记录',learning:'学习收获',emotionInsight:'情绪觉察',mentorNotes:'导师记录',ifThen:'行动约定',wins:'今天做成',feelings:'感受',thoughts:'想法',checklist:'行动清单',notes:'笔记',reason:'原因',correction:'纠正方法',answer:'答案',explanation:'解析'};
function bodyOf(o){return Object.entries(label).filter(([k])=>o[k]!==undefined&&text(o[k])).map(([k,l])=>`## ${l}\n\n${text(o[k])}`).join('\n\n')||text(o.content||o.message||o.text||'');}
function readWindow(f){const c={window:{}};vm.runInNewContext(fs.readFileSync(f,'utf8'),c,{timeout:1500});return Object.values(c.window)[0];}
export async function importLegacy(){
 const db=read();if(db.records.length)backup(db);const rows=[],sources=[],sourceIds=new Map();
 const exam=json(path.join(police,'exam-review.v4.json'));
 const attachmentUploads=arr(exam.captures).flatMap(c=>arr(c.attachments).map(a=>({...a,subject:c.subject,topic:c.topic,sourceDate:c.date,pageCount:1})));
 for(const upload of [...arr(exam.uploads),...attachmentUploads]){
  const id=idFor('source',upload.id),rel=String(upload.storedPath||upload.url||'').replace(/^\//,'');let original=path.resolve(police,rel);if(!original.startsWith(police+path.sep))throw new Error('原资料路径越界');
  const ext=path.extname(upload.originalName||original).toLowerCase();const present=fs.existsSync(original);const digest=present?hash(fs.readFileSync(original)):upload.sha256||hash(upload.id);const filename=digest+ext;
  if(present){fs.mkdirSync(path.join(DATA,'originals'),{recursive:true});const dest=path.join(DATA,'originals',filename);if(!fs.existsSync(dest))fs.copyFileSync(original,dest);}
  const manifestFile=path.join(police,'pdf-pages',upload.id+'.json');const manifest=fs.existsSync(manifestFile)?json(manifestFile):null;
  const s={id,legacyId:upload.id,origin:'police',title:upload.originalName||'原资料',filename,sha256:digest,size:present?fs.statSync(original).size:upload.size||0,kind:ext==='.pdf'?'pdf':'image',subject:upload.subject||'xingce',topic:upload.topic||upload.module||'',date:(upload.sourceDate||upload.createdAt||'').slice(0,10),pageCount:upload.pageCount||1,missing:!present,pages:manifest?.pages||[],originalDetails:publicClean(upload)};
  sourceIds.set(upload.id,id);sources.push(s);
 }
 const ref=(r)=>({sourceId:sourceIds.get(r.uploadId),page:Number(r.pageNumber)||1,label:r.label||'',quote:r.quote||'',regions:[],...(r.url?{url:r.url}:{})});
 for(const [key,kind]of Object.entries({knowledgeCards:'knowledge',captures:'review',errors:'error',practiceSessions:'practice',weeklyReports:'weekly'}))for(const o of arr(exam[key])){
  const refs=arr(o.sourceRefs).map(ref).filter(r=>r.sourceId);for(const uploadId of arr(o.uploadIds))if(sourceIds.has(uploadId)&&!refs.some(r=>r.sourceId===sourceIds.get(uploadId)))refs.push({sourceId:sourceIds.get(uploadId),page:1,label:o.source||'',regions:[]});
  for(const a of arr(o.attachments))if(sourceIds.has(a.id))refs.push({sourceId:sourceIds.get(a.id),page:1,label:a.originalName,regions:[]});
  if(o.captureId&&!refs.some(r=>r.sourceId)){const parentCapture=arr(exam.captures).find(c=>c.id===o.captureId);for(const a of arr(parentCapture?.attachments))if(sourceIds.has(a.id))refs.push({sourceId:sourceIds.get(a.id),page:1,label:a.originalName,regions:[]});}
  if(o.sourceUrl&&/^https?:/.test(o.sourceUrl))refs.push({url:o.sourceUrl,label:o.source||'原始发布页'});
  rows.push({id:idFor('police',o.id),legacyId:o.id,origin:'police',kind,title:o.title||o.summary||`${o.module||''} · ${o.topic||kind}`,body:bodyOf(o),subject:o.subject||'',topic:o.topic||o.module||'',date:(o.date||o.createdAt||'').slice(0,10),tags:[o.module,o.recordType].filter(Boolean),sourceRefs:refs,links:o.captureId?[idFor('police',o.captureId)]:[],details:publicClean(o),nextReview:o.nextReview||'',reviewStage:o.reviewStage||0,activationStatus:o.activationStatus||'缓冲中',verificationStatus:o.verificationStatus||o.status||'待确认',createdAt:o.createdAt,updatedAt:o.updatedAt});
 }
 const growth=json(path.join(garden,'user-state.v2.json'));
 for(const [key,kind]of Object.entries({reviews:'growth',letters:'letter',weeklyReports:'weekly',successes:'growth',failureReviews:'growth',mentorAnalyses:'growth'}))for(const [i,o]of arr(growth[key]).entries())rows.push({id:idFor('garden',`${key}:${o.id||i}`),legacyId:o.id||`${key}:${i}`,origin:'garden',kind,title:o.title||(kind==='letter'?'写给明天的我':key==='successes'?'微小的进步':key==='mentorAnalyses'?'导师分析':'成长记录'),body:bodyOf(o)||text(o),subject:'growth',topic:key,date:o.date||o.createdDate||o.weekEnding||(o.createdAt||'').slice(0,10),tags:o.tags||[],sourceRefs:[],links:[],details:o,createdAt:o.createdAt,updatedAt:o.updatedAt});
 const files=fs.readdirSync(path.join(shenlun,'每日积累')).filter(f=>/^\d{4}-\d{2}-\d{2}\.md$/.test(f));
 for(const file of files){const date=file.slice(0,10),content=fs.readFileSync(path.join(shenlun,'每日积累',file),'utf8');const dailyId=idFor('shenlun',file);const urls=[...content.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)].map(m=>({url:m[2],label:m[1]}));rows.push({id:dailyId,legacyId:file,origin:'shenlun',kind:'article',title:`${date} · 申论每日精读`,body:content,subject:'shenlun',topic:'每日精读',date,tags:['每日积累'],sourceRefs:urls,links:[]});
  let section='';const lines=content.split('\n');for(let i=0;i<lines.length;i++){if(/^## /.test(lines[i]))section=lines[i].replace(/^## /,'');if(/^### \d+[.、]/.test(lines[i])&&/精读/.test(section)){let end=i+1;while(end<lines.length&&!/^#{1,3} /.test(lines[end]))end++;const block=lines.slice(i+1,end).join('\n').trim();const title=lines[i].replace(/^### \d+[.、]\s*/,'').replace(/★|\*\*/g,'').trim();rows.push({id:idFor('shenlun',file+':article:'+i),legacyId:file+':'+i,origin:'shenlun',kind:'article',title,body:block,subject:'shenlun',topic:'精读好文',date,tags:['精读'],sourceRefs:[...block.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)].map(m=>({url:m[2],label:m[1]})),links:[dailyId]});}
   const match=lines[i].match(/^\s*(?:-\s*|\d+[.、]\s*)?\*\*(G\d+|Q\d+)[^：:\n]*[：:]\*\*\s*(.+)/);if(match)rows.push({id:idFor('shenlun',file+':'+match[1]),legacyId:file+':'+match[1],origin:'shenlun',kind:'quote',title:`${match[1]} · ${match[2].slice(0,36)}`,body:match[2],subject:'shenlun',topic:section.replace(/^[一二三四五六七八九十]+、/,''),date,tags:[match[1],match[1].startsWith('G')?'原创表达':'权威论述'],sourceRefs:[],links:[dailyId]});}
 }
 // Import all dated card archives, then current, deduplicated by date.
 const commonFiles=[];for(const dir of ['common-sense','archive']){const p=path.join(garden,dir);if(fs.existsSync(p))for(const f of fs.readdirSync(p))if(/(?:common-sense|^\d{4}-\d{2}-\d{2}\.js$)/.test(f)&&f.endsWith('.js'))commonFiles.push(path.join(p,f));}commonFiles.push(path.join(garden,'common-sense-current.js'));
 const commonDays=new Map();for(const f of commonFiles)try{const d=readWindow(f);if(d?.packages)commonDays.set(d.date,d);}catch{}
 for(const d of commonDays.values())for(const [i,p]of arr(d.packages).entries())rows.push({id:idFor('common',`${d.date}:${i}`),legacyId:`${d.date}:${i}`,origin:'common',kind:'common',title:p.title||'常识学习包',body:[p.subtitle,...arr(p.nodes),text(p.quiz||p.question||''),text(p.explanation||'')].filter(Boolean).join('\n\n'),subject:'xingce',topic:'常识判断',date:d.date,tags:['常识积累'],sourceRefs:arr(d.sources).map(s=>typeof s==='string'?{url:s,label:'来源'}:{url:s.url,label:s.title||s.name}).filter(s=>/^https?:/.test(s.url||'')),links:[],details:p});
 for(const name of ['fortune-current.js']){const f=path.join(garden,name);if(fs.existsSync(f)){const d=readWindow(f);rows.push({id:idFor('fortune',d.date||name),legacyId:d.date||name,origin:'fortune',kind:'fortune',title:d.title||'今日灵感与娱乐参考',body:text(d.summary||d.overview||d.preview),subject:'growth',topic:'娱乐参考',date:d.date,tags:['娱乐与自我观察'],sourceRefs:[],links:[],details:publicClean(d)});}}
 const rowIds=new Set([...rows.map(r=>r.id),...db.records.map(r=>r.id)]);for(const r of rows)r.links=(r.links||[]).filter(id=>rowIds.has(id));
 for(const old of db.records)if(old.origin==='shenlun'&&old.kind==='quote'&&/^[GQ]\d+$/.test(old.legacyId||'')&&!old.edited)old.archived=true;
 const report=mergeImported(db,rows,sources);if(!db.growthImported){db.growth=publicClean(growth);db.growthImported=true;}db.reviewSettings=exam.reviewSettings||db.reviewSettings;
 db.legacyEvidence={police:{knowledgeCardArchives:exam.knowledgeCardArchives,reviewEvents:exam.reviewEvents,extractionQueue:publicClean(exam.extractionQueue),examProfile:exam.examProfile},counts:{knowledgeCards:arr(exam.knowledgeCards).length,captures:arr(exam.captures).length,growthReviews:arr(growth.reviews).length,uploads:arr(exam.uploads).length,shenlunDays:files.length}};
 db.imports.push({at:now(),...report});write(db);atomic(path.join(DATA,'migration-report.json'),{at:now(),...report,legacyCounts:db.legacyEvidence.counts,missing:sources.filter(s=>s.missing).map(s=>s.title)});return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await importLegacy()));
