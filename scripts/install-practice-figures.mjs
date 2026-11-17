import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT,DATA,atomic,backup,read,write} from '../server/store.mjs';

const args=process.argv.slice(2);
const [candidateFile,baselineFile]=args.filter(arg=>!arg.startsWith('--'));
assert.ok(candidateFile&&baselineFile,'Provide the audited figure candidate and the pre-surface backup.');
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const candidate=json(candidateFile), baseline=json(baselineFile), db=read();
assert.equal(candidate.version,db.version,'题库已变化，请重跑图表核对');
assert.ok(baseline.version<candidate.version);
const old=new Map(baseline.records.map(record=>[record.id,record]));
const sourceMap=new Map(db.sources.map(source=>[source.id,source]));
const counts={attached:0,pending:0,restoredSurface:0,restoredGrading:0,needsSurface:0};
const ids=[];

function validateClip(clip,record){
 const source=sourceMap.get(clip.sourceId),{x,y,w,h}=clip.region;
 assert.ok(source&&clip.page>0&&clip.page<=source.pageCount&&Number.isInteger(clip.page),record.id);
 assert.ok([x,y,w,h,clip.width,clip.height].every(Number.isFinite)
  &&x>=0&&y>=0&&w>0&&h>0&&x+w<=1.00001&&y+h<=1.00001&&clip.width>0&&clip.height>0,record.id);
 assert.equal(clip.previewSuffix,'-clean',record.id);
 assert.ok(fs.statSync(path.join(DATA,'previews',clip.sourceId,`${clip.page}-clean.webp`)).size>0,record.id);
}

for(const record of db.records){
 const change=candidate.items[record.id];
 if(!change)continue;
 assert.equal(record.kind,'practice',record.id);
 assert.equal(record.subject,'gongan',record.id);
 const q=record.details.question,s=record.studyQuestion;
 const before=JSON.stringify([q,s]);
 const clips=[...change.question,...change.context];
 assert.ok((clips.length>0)!==!!change.pending,record.id);
 clips.forEach(clip=>validateClip(clip,record));
 q.practiceVisuals={status:change.pending?'pending':'ready',question:change.question,context:change.context};
 q.requiresImage=true;
 if(change.pending){
  q.gradingExcluded=true;
  s.gradingExcluded=true;
  s.practiceVisualPending=true;
  counts.pending++;
 }else{
  delete s.practiceVisualPending;
  counts.attached++;
 }
 if(change.surface&&!q.practiceSurface){
  const wasHeld=s.practiceSurfacePending;
  q.practiceSurface=change.surface;
  q.practiceSurfaceAudit={status:'ready',reason:'',method:'独立题面与印刷原图分开核对'};
  delete q.practiceSurfaceHold;
  delete s.practiceSurfacePending;
  counts.restoredSurface++;
  const previous=old.get(record.id),prior=previous?.details?.question;
  if(wasHeld&&prior&&!prior.gradingExcluded&&!previous.studyQuestion?.gradingExcluded&&!change.pending
    &&q.referenceAnswer&&q.referenceAnswer===prior.referenceAnswer&&!q.gradingExclusionReason
    &&!s.gradingExclusionReason&&(!q.answerConflict||q.answerConflictResolved)){
   q.gradingExcluded=false;
   s.gradingExcluded=false;
   counts.restoredGrading++;
  }
 }
 if(!q.practiceSurface&&!change.pending){
  assert.ok(q.gradingExcluded&&s.gradingExcluded,record.id);
  counts.needsSurface++;
 }
 if(JSON.stringify([q,s])!==before){
  record.revision++;
  ids.push(record.id);
 }
}
assert.equal(counts.attached+counts.pending,Object.keys(candidate.items).length);
const report={...counts,scanned:candidate.counts,changed:ids.length,ids};
if(args.includes('--write')){
 assert.equal(read().version,candidate.version,'写入前平台版本已变化');
 const snapshot=backup();
 write(db);
 atomic(path.join(ROOT,'output/reports/practice-figures-install.json'),{...report,version:db.version,snapshot});
}
console.log(JSON.stringify({...report,ids:undefined}));
