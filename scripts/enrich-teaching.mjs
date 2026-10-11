import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {read,write,backup,atomic,DATA} from '../server/store.mjs';
import {lessonFor,inspectionTutorial} from './teaching-lessons.mjs';
import {chapterLessons} from './chapter-lessons.mjs';
function materialsFor(record,byId,seen=new Set(),depth=0){
 if(depth>2||seen.has(record.id))return [];seen.add(record.id);
 const result=[];for(const id of record.links||[]){const row=byId.get(id);if(!row||row.archived)continue;
  if(['knowledge','article','common'].includes(row.kind)&&row.body?.trim()&&!id.startsWith('drill-20260917-method-'))result.push({id:row.id,title:row.title,body:row.body,sourceRefs:row.sourceRefs||[],verificationStatus:row.verificationStatus||'原有资料内容，非本次逐条法条核验',provenance:row.details?.aiContent||row.aiContent?'已有资料卡／人工笔记与整理说明':'已有学习资料'});
  else if(row.studyQuestion)result.push(...materialsFor(row,byId,seen,depth+1));
 }
 return [...new Map(result.map(r=>[r.id,r])).values()].slice(0,2);
}
export function enrichTeaching(db){const byId=new Map(db.records.map(r=>[r.id,r]));let changed=0,withMaterials=0,withWritten=0,missing=0;
 for(const r of db.records.filter(r=>r.studyQuestion&&!r.archived)){
  const q=r.details?.question;if(!q)continue;const before=JSON.stringify({tutorial:q.tutorial,knowledgeKey:r.studyQuestion.knowledgeKey});
  const materials=materialsFor(r,byId),lesson=lessonFor(r);let authored;
  if(r.id==='drill-20260917-admin-single-0-4')authored=inspectionTutorial;
  else if(lesson)authored={...lesson,pattern:undefined,subjects:undefined,origin:lesson.sources.length?'根据官方法规补写的知识教程':'公式与教学示例（编写）',scope:'相关知识教程；本题逐项结论另以核验状态为准',verifiedAt:'2026-10-11'};
  else if(q.origin==='generated'||q.optionAuditStatus?.startsWith('已核对依据'))authored={key:q.parentId||r.id,title:q.explanation.category,origin:'依据已核对知识编写的题目讲解',scope:'题干推理与规则应用',body:`### 本题的决定条件\n${q.explanation.keyCondition}\n\n### 怎样避免选错\n${q.attention||q.explanation.diagnosis}\n\n### 记忆方法\n${q.explanation.memory}`,sources:q.explanation.legalBasis||[]};
  if(!authored&&!materials.length)authored=chapterLessons[r.studyQuestion.sectionId];
  const tutorial={version:1,authored:authored||null,materials};
  if(!q.tutorial?.edited)q.tutorial=tutorial;
  r.studyQuestion.knowledgeKey=authored?.key||(materials[0]?.id)||q.parentId||`${r.subject}:${r.studyQuestion.sectionId}`;
  if(JSON.stringify({tutorial:q.tutorial,knowledgeKey:r.studyQuestion.knowledgeKey})!==before){r.revision++;changed++;}
  if(materials.length)withMaterials++;if(authored)withWritten++;if(!materials.length&&!authored)missing++;
  const card=byId.get(q.answerCardId);if(card&&card.id!==r.id&&card.kind==='memory'&&r.studyQuestion.bank==='police-drill-20260917'){
   const marker='\n\n## 教学讲解与资料教程';const base=(card.body||'').split(marker)[0];
   const body=base+marker+'\n\n'+[authored?`### ${authored.title}\n\n来源类型：${authored.origin}；范围：${authored.scope}\n\n${authored.body}\n\n`+(authored.sources||[]).map(s=>`- [${s.title} · ${s.article||'来源'}](${s.url})`).join('\n'):'',...materials.map(m=>`### 已有资料：${m.title}\n\n${m.body}`)].filter(Boolean).join('\n\n');
   if(card.body!==body){card.body=body;card.revision++;changed++;}
  }
 }
 return {changed,withMaterials,withWritten,missing};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){const db=read();backup(db);const report=enrichTeaching(db);if(report.changed)write(db);atomic(path.join(DATA,'teaching-report.json'),report);console.log(JSON.stringify({...report,version:db.version}));}
