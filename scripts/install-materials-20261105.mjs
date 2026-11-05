import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {ROOT,DATA,read,write,backup,atomic,hash,mergeImported,validateRecord,now} from '../server/store.mjs';
import {validateWritingGuide} from './validate-writing.mjs';
export function prepareMaterials(db,candidate,vocabulary,guide){
 const next=structuredClone(db),vocab=structuredClone(vocabulary);const sources=candidate.sources;
 const report=mergeImported(next,structuredClone(candidate.records),structuredClone(sources));let references=0;
 for(const p of candidate.recordSourcePatches){const r=next.records.find(r=>r.id===p.id);if(!r)throw new Error('旧词卡不存在 '+p.id);if(!r.sourceRefs.some(s=>s.sourceId===p.sourceRef.sourceId&&s.page===p.sourceRef.page)){r.sourceRefs.push(p.sourceRef);r.revision++;references++;}}
 for(const p of candidate.vocabularySourcePatches){const e=vocab.entries.find(e=>e.id===p.id);if(!e)throw new Error('旧词条不存在 '+p.id);e.alternateSources??=[];if(!e.alternateSources.some(s=>s.id===p.alternateSource.id&&s.page===p.alternateSource.page))e.alternateSources.push(p.alternateSource);}
 const refLinks=ids=>(ids||[]).map(id=>guide.sources.find(s=>s.id===id)).filter(s=>s&&s.url.startsWith('https://')).map(s=>({url:s.url,label:s.title}));
 const common={origin:'writing-20261105',subject:'shenlun',date:'2026-11-05',revision:1,links:[],tags:['写作实战','材料与表达'],verificationStatus:'来源与原创训练分别标识'};
 const rows=[...guide.lessons.map(l=>({...common,id:'writing-lesson-'+l.id,legacyId:l.id,kind:'knowledge',title:l.title,topic:l.category,body:[l.summary,'## 怎样做',Array.isArray(l.steps)?l.steps.join('\n\n'):l.steps,'## 这样用',l.example,'## 容易用错',l.counterExample,'## 来源说明',l.provenance].join('\n\n'),sourceRefs:refLinks(l.sourceIds),details:{writingLessonId:l.id}})),...guide.tasks.map(t=>({...common,id:'writing-task-'+t.id,legacyId:t.id,kind:'practice',title:'写作实战 · '+t.title,topic:'申论与岗位写作',body:[t.prompt,'## 作答要求',t.requirements.join('\n\n'),'请点击上方按钮打开完整材料、计时和方格答题纸。'].join('\n\n'),sourceRefs:[...(t.sourceRefs||[]),...refLinks(t.sourceIds)],details:{writingTaskId:t.id,writingProfileId:t.profileIds[0],provenance:t.provenance}}))];
 const writing=mergeImported(next,rows);validateWritingGuide(guide,next);
 for(const r of next.records.filter(r=>r.origin==='materials-20261105'||r.origin==='writing-20261105'))validateRecord(r,next,r);
 const changed=hash({...next,version:0,updatedAt:''})!==hash({...db,version:0,updatedAt:''})||hash(vocab)!==hash(vocabulary);
 return {db:next,vocabulary:vocab,changed,report:{...report,writing,references,sources:sources.length,newPages:sources.reduce((n,s)=>n+s.pageCount,0)}};
}
export function installMaterials({apply=false}={}){
 const candidate=JSON.parse(fs.readFileSync(path.join(DATA,'materials-20261105-candidate.json'),'utf8')),db=read(),vocabFile=path.join(DATA,'vocabulary.json'),vocabulary=JSON.parse(fs.readFileSync(vocabFile,'utf8')),guide=JSON.parse(fs.readFileSync(path.join(ROOT,'public','writing-guide.json'),'utf8'));
 const artifact=path.join(ROOT,'output','materials-20261105');
 for(const s of candidate.sources){const file=path.join(artifact,'originals',s.filename);if(hash(fs.readFileSync(file))!==s.sha256)throw new Error('原文件哈希不匹配 '+s.title);const manifest=JSON.parse(fs.readFileSync(path.join(artifact,'previews',s.id,'manifest.json'),'utf8'));if(manifest.pages.length!==s.pageCount)throw new Error('预览页数不符 '+s.id);for(let page=1;page<=s.pageCount;page++)for(const suffix of ['.webp','-hd.webp'])if(!fs.existsSync(path.join(artifact,'previews',s.id,page+suffix)))throw new Error('缺少原页 '+s.id+'/'+page+suffix);}
 const prepared=prepareMaterials(db,candidate,vocabulary,guide),again=prepareMaterials(prepared.db,candidate,prepared.vocabulary,guide);if(again.changed)throw new Error('重复导入不幂等');
 if(apply&&prepared.changed){const folder=path.join(DATA,'backups','materials-20261105-'+Date.now());fs.mkdirSync(folder,{recursive:true});for(const name of ['platform.json','vocabulary.json','drill-progress.json','guided-review.json','guided-progress.json']){const f=path.join(DATA,name);if(fs.existsSync(f))fs.copyFileSync(f,path.join(folder,name));}backup(db);
  for(const s of candidate.sources){fs.mkdirSync(path.join(DATA,'originals'),{recursive:true});const target=path.join(DATA,'originals',s.filename);if(!fs.existsSync(target))fs.copyFileSync(path.join(artifact,'originals',s.filename),target);fs.cpSync(path.join(artifact,'previews',s.id),path.join(DATA,'previews',s.id),{recursive:true});}
  if(read().version!==db.version)throw new Error('安装期间平台发生修改，请重新执行');
  try{atomic(vocabFile,prepared.vocabulary);write(prepared.db);}catch(e){atomic(vocabFile,vocabulary);atomic(path.join(DATA,'platform.json'),db);throw e;}
  atomic(path.join(DATA,'materials-20261105-install.json'),{...prepared.report,backup:folder,at:now(),version:prepared.db.version});
 }
 return {...prepared.report,changed:prepared.changed,applied:apply&&prepared.changed,idempotent:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(installMaterials({apply:process.argv.includes('--write')}),null,2));
