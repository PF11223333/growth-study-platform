import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT,DATA,STORE,read,write,backup,atomic,hash,mergeImported,validateRecord} from '../server/store.mjs';

import {validateVocabulary} from './validate-vocabulary.mjs';

export function installLearningContent({vocabulary=true,xingce=true,apply=false}={}){
 const db=read(),beforeHash=hash(db),candidate=structuredClone(db),reports={};
 let bundle=null,source=null;
 if(vocabulary&&fs.existsSync(path.join(DATA,'vocabulary-candidate.json'))){
  bundle=JSON.parse(fs.readFileSync(path.join(DATA,'vocabulary-candidate.json'),'utf8'));
  validateVocabulary(bundle);
  if(bundle.entries.length!==305||new Set(bundle.entries.map(e=>e.id)).size!==305||bundle.entries.some((e,i)=>e.number!==i+1||!e.meaning||!e.example||!e.source.text||e.source.page<1||e.source.page>bundle.source.pageCount))throw new Error('词语资料不完整，停止安装。');
  source=JSON.parse(fs.readFileSync(path.join(ROOT,'output','vocabulary-source','source-record.json'),'utf8'));
  const rows=bundle.entries.map(e=>({id:e.id,kind:'knowledge',origin:'vocabulary',legacyId:String(e.number),subject:'shenlun',title:e.displayLabel||e.label||e.word,topic:'词语用法',date:bundle.checkedAt,tags:['词语用法','表达训练',e.word],body:`## ${e.meaningOrigin==='authored'?'大白话释义（编写）':'资料含义'}\n\n${e.meaning}\n\n## 用法\n\n${e.usage}\n\n## ${e.exampleOrigin==='authored'?'编写例句':'资料例句'}\n\n${e.example}\n\n${e.explanation||''}\n\n## 教材原文\n\n${e.source.text}`,sourceRefs:[{sourceId:source.id,page:e.source.page,label:`表达表原编号${e.number}`,quote:e.source.text,...(e.source.region?{regions:[{x:e.source.region.x,y:e.source.region.y,w:e.source.region.width,h:e.source.region.height}]}:{})}],links:[],details:{vocabularyEntryId:e.id,exampleOrigin:e.exampleOrigin,meaningOrigin:e.meaningOrigin,verification:e.verification,correctionReferences:e.correctionReferences},verificationStatus:e.verification.status}));
  reports.vocabulary=mergeImported(candidate,rows,[source]);
 }
 if(xingce&&fs.existsSync(path.join(DATA,'xingce-candidate.json'))){
  const incoming=JSON.parse(fs.readFileSync(path.join(DATA,'xingce-candidate.json'),'utf8'));
  if(!Array.isArray(incoming.records))throw new Error('行测候选格式不正确');
  reports.xingce=mergeImported(candidate,incoming.records,incoming.sources||[]);
  let patches=0;for(const patch of incoming.recordPatches||[]){const row=candidate.records.find(r=>r.id===patch.id);if(!row?.studyQuestion)continue;const fields=patch.studyQuestion||patch;if(!fields.sectionId||!fields.sectionName)throw new Error('行测分类补丁缺少分类');if(row.studyQuestion.sectionId!==fields.sectionId||row.studyQuestion.sectionName!==fields.sectionName){row.studyQuestion={...row.studyQuestion,sectionId:fields.sectionId,sectionName:fields.sectionName};patches++;}}
  reports.xingce.patches=patches;
 }
 for(const r of candidate.records.filter(r=>r.origin==='vocabulary'||r.origin==='xingce-tutorial'))validateRecord(r,candidate,r);
 const changed=hash(candidate)!==beforeHash;
 if(apply){
  const snapshot=backup(db),backupRoot=path.join(DATA,'backups',snapshot.replace(/\.json$/,''));
  for(const name of ['drill-progress.json','guided-review.json','vocabulary.json']){const file=path.join(DATA,name);if(fs.existsSync(file))atomic(path.join(backupRoot,name),fs.readFileSync(file));}
  if(bundle&&source){
   const original=path.join(ROOT,'output','vocabulary-source',source.filename);if(hash(fs.readFileSync(original))!==source.sha256)throw new Error('词语PDF哈希不符');
   atomic(path.join(DATA,'originals',source.filename),fs.readFileSync(original));fs.cpSync(path.join(ROOT,'output','vocabulary-source','previews',source.id),path.join(DATA,'previews',source.id),{recursive:true});
   atomic(path.join(DATA,'vocabulary.json'),bundle);
  }
  if(hash(read())!==beforeHash)throw new Error('安装期间平台已有其他修改，未覆盖平台记录，请重试。');
  if(changed)write(candidate);
 }
 const report={applied:apply,changed,...reports};if(apply)atomic(path.join(DATA,'learning-content-report.json'),report);return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(installLearningContent({apply:process.argv.includes('--write'),xingce:!process.argv.includes('--vocabulary-only')}),null,2));
