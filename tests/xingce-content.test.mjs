import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {solveNumericTutorial} from '../scripts/xingce-numeric.mjs';
import {installLearningContent} from '../scripts/install-learning-content.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const candidate=JSON.parse(fs.readFileSync(path.join(root,'data/xingce-candidate.json'),'utf8'));
test('原教程题目保留来源且待核题不混入判分库',()=>{
 const rows=candidate.records;assert.equal(rows.length,549);assert.equal(new Set(rows.map(r=>r.id)).size,549);
 const ready=rows.filter(r=>!r.studyQuestion.gradingExcluded);assert.equal(ready.length,140);
 assert.equal(ready.filter(r=>r.studyQuestion.xingceSection==='verbal').length,90);
 for(const r of rows){const q=r.details.question;assert.equal(q.gradingExcluded,!q.referenceAnswer);assert.equal(r.studyQuestion.gradingExcluded,q.gradingExcluded);assert.ok(r.sourceRefs.length);assert.equal(r.studyQuestion.sectionId,`xingce-${r.studyQuestion.xingceSection}`);
  for(const p of q.originalPages){assert.ok(fs.existsSync(path.join(root,'data/previews',p.sourceId,`${p.page}${p.previewSuffix}.webp`)),`${r.id} 缺图 ${p.page}`);const b=p.region;for(const key of ['x','y','w','h'])assert.ok(Number.isFinite(b[key])&&b[key]>=0);assert.ok(b.x+b.w<=1.00001&&b.y+b.h<=1.00001);}
  if(!q.gradingExcluded&&r.studyQuestion.xingceSection!=='verbal'){assert.deepEqual(Object.keys(q.optionExplanations).sort(),['A','B','C','D']);assert.match(q.tutorial.authored.scope,/本题逐项/);for(const note of Object.values(q.optionExplanations))assert.match(note.status,/已逐项核对/);}
  if(r.studyQuestion.xingceSection==='verbal'){assert.equal(q.requiresImage,true);assert.equal(q.originalPages[0].previewSuffix,'-clean');assert.ok(q.answerEvidence.pages.length);assert.match(q.tutorial.authored.scope,/非逐项精讲/);}
 }
});
test('原教材数值公式计算，下降、单位与混合基期独立核算',()=>{
 const ask=(text)=>solveNumericTutorial(text);
 assert.equal(ask('现期 = 980，增长率 = -2%，求基期\nA.960\nB.1000\nC.1100\nD.1200').referenceAnswer,'B');
 assert.equal(ask('现期 = 3245697，增长率 = -2.0%，求基期\nA.331.2 万\nB.318.2 万\nC.33.12 万\nD.31.82 万').referenceAnswer,'A');
 assert.equal(ask('A = 550，a = 10%，B = 650，b = 30%，求（ A + B ）的增长率\nA.15%\nB.18%\nC.20%\nD.22%').referenceAnswer,'C');
 assert.equal(ask('资料不足，求增长率\nA.15%\nB.18%\nC.20%\nD.22%'),null);
 assert.equal(ask('现期 = 980，增长率 = -100%，求基期\nA.960\nB.1000\nC.1100\nD.1200'),null);
});
test('再次安装学习资料保持题号和记录数量，不增加重复内容',()=>{
 const report=installLearningContent();assert.equal(report.changed,false);assert.equal(report.vocabulary.added,0);assert.equal(report.xingce.added,0);assert.equal(report.xingce.updated,0);
});
