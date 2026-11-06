import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {ROOT,mergeImported,validateRecord,publicClean} from '../server/store.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const candidateFile=path.join(ROOT,'data/materials-20261105-candidate.json');
const c=JSON.parse(fs.readFileSync(candidateFile,'utf8'));
const dbFile=path.join(ROOT,'data/platform.json'),before=sha(fs.readFileSync(dbFile));
const current=JSON.parse(fs.readFileSync(dbFile,'utf8'));const db=structuredClone(current);
const artifact=path.join(ROOT,c.artifactRoot);let previewBytes=0,pages=0;
const sourceStats=[];
for(const source of c.sources){
 const original=path.join(artifact,'originals',source.filename);assert.equal(sha(fs.readFileSync(original)),source.sha256,source.title);
 assert.equal(fs.statSync(original).size,source.size);
 const folder=path.join(artifact,'previews',source.id),manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
 assert.equal(manifest.pages.length,source.pageCount);
 let bytes=0;
 for(let page=1;page<=source.pageCount;page++){
  assert.equal(manifest.pages[page-1].page,page);
  for(const suffix of ['.webp','-hd.webp']){
   const file=path.join(folder,page+suffix);assert(fs.existsSync(file),file);assert(fs.statSync(file).size>100);bytes+=fs.statSync(file).size;
  }
  assert(source.pages.some(p=>p.pageNumber===page));pages++;
 }
 previewBytes+=bytes;sourceStats.push({id:source.id,title:source.title,pages:source.pageCount,previewBytes:bytes});
}
assert.equal(pages,634);assert(previewBytes<170*1024*1024);
const first=mergeImported(db,structuredClone(c.records),structuredClone(c.sources));
const second=mergeImported(db,structuredClone(c.records),structuredClone(c.sources));
assert.deepEqual({added:second.added,updated:second.updated,conflicts:second.conflicts},{added:0,updated:0,conflicts:0});
for(const r of c.records){
 validateRecord(r,db,db.records.find(x=>x.id===r.id));
 const q=r.details?.question;if(!q)continue;
 assert(q.prompt.length>10,r.id);assert.deepEqual(Object.keys(q.options).sort(),['A','B','C','D']);
 assert(Object.values(q.options).every(x=>typeof x==='string'&&x.trim().length>0),r.id);
 assert(/^[A-D]{1,4}$/.test(q.referenceAnswer),r.id);
 assert.equal(new Set(q.referenceAnswer).size,q.referenceAnswer.length);
 assert('ABCD'.split('').every(k=>q.optionExplanations[k]?.text?.length>8),r.id);
 assert(q.tutorial.authored.body.includes('##'),r.id);
 assert.equal(!!q.gradingExcluded,!!r.studyQuestion.gradingExcluded,r.id);
 for(const p of q.originalPages)assert(fs.existsSync(path.join(artifact,'previews',p.sourceId,p.page+(p.previewSuffix||'')+'.webp')),r.id);
}
let patchCount=0;
const patchSources=()=>{let changes=0;for(const p of c.recordSourcePatches){const r=db.records.find(r=>r.id===p.id);assert(r,p.id);if(!r.sourceRefs.some(ref=>ref.sourceId===p.sourceRef.sourceId&&ref.page===p.sourceRef.page)){r.sourceRefs.push(p.sourceRef);changes++;}}return changes;};
patchCount=patchSources();assert.equal(patchSources(),0);
const vocabulary=JSON.parse(fs.readFileSync(path.join(ROOT,'data/vocabulary.json'),'utf8'));
const patchWords=()=>{let changes=0;for(const p of c.vocabularySourcePatches){const e=vocabulary.entries.find(e=>e.id===p.id);assert(e);e.alternateSources ||= [];if(!e.alternateSources.some(s=>s.id===p.alternateSource.id&&s.page===p.alternateSource.page)){e.alternateSources.push(p.alternateSource);changes++;}}return changes;};
const vocabularyPatchCount=patchWords();assert.equal(patchWords(),0);
const clean=JSON.stringify(publicClean({records:c.records,sources:c.sources}));assert(!/(?:^|["\s])[A-Za-z]:[\\/]/.test(clean));assert(!clean.includes('\uFFFD'));
assert.equal(sha(fs.readFileSync(dbFile)),before,'Validation must not write production');
const report={status:'passed',checkedAt:new Date().toISOString(),candidateSha256:sha(fs.readFileSync(candidateFile)),sourceStats,sourcePages:pages,previewBytes,previewMiB:Number((previewBytes/1024/1024).toFixed(2)),records:c.records.length,practice:c.records.filter(r=>r.studyQuestion).length,gradable:c.records.filter(r=>r.studyQuestion&&!r.studyQuestion.gradingExcluded).length,held:c.records.filter(r=>r.studyQuestion?.gradingExcluded).map(r=>r.id),firstMerge:first,secondMerge:second,recordPatches:patchCount,vocabularyPatches:vocabularyPatchCount,productionUntouched:true};
fs.mkdirSync(path.join(ROOT,'output/reports'),{recursive:true});fs.writeFileSync(path.join(ROOT,'output/reports/materials-20261105-validation.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify(report,null,2));
