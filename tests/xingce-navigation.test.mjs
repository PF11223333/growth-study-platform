import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {matchesPracticeSection} from '../src/practice-scope.mjs';
import {xingceSection,xingceSections} from '../src/xingce-sections.mjs';
import {buildPracticeQueue,eligiblePracticeRows} from '../src/practice-order.mjs';

test('旧行测题与未来手动题可从五分类入口进入，公安同名知识不串科',()=>{
 const old={id:'old',subject:'xingce',title:'基期增长率计算',studyQuestion:{sectionId:'xingce',bank:'legacy'}};
 const manual={id:'manual',subject:'xingce',topic:'图形推理',studyQuestion:{sectionId:'xingce',origin:'manual'}};
 assert.equal(matchesPracticeSection(old,'xingce-data'),true);
 assert.equal(matchesPracticeSection(old,'xingce-figure'),false);
 assert.equal(matchesPracticeSection(manual,'xingce-figure'),true);
 assert.equal(matchesPracticeSection({...old,subject:'gongan'},'xingce-data'),false);
 assert.equal(matchesPracticeSection(old,'xingce-invalid'),false);
 assert.equal(matchesPracticeSection(old,''),true);
});
test('明确标注的分类优先于题干词汇，普通公安小节匹配不变',()=>{
 const record={subject:'xingce',title:'政治理论中的统计资料分析',studyQuestion:{xingceSection:'data',sectionId:'xingce-data'}};
 assert.equal(matchesPracticeSection(record,'xingce-data'),true);
 assert.equal(matchesPracticeSection(record,'xingce-politics'),false);
 const police={subject:'gongan',studyQuestion:{sectionId:'chapter-one'}};
 assert.equal(matchesPracticeSection(police,'chapter-one'),true);
 assert.equal(matchesPracticeSection(police,'chapter-two'),false);
});
test('实际资料中五板块展示题与刷题筛选一致，非空板块都能生成一轮',()=>{
 const db=JSON.parse(fs.readFileSync(new URL('../data/platform.json',import.meta.url),'utf8'));
 const records=db.records.filter(r=>r.subject==='xingce'&&r.studyQuestion&&!r.archived);
 for(const section of xingceSections){
  const displayed=records.filter(r=>xingceSection(r)===section.id);
  const filtered=records.filter(r=>matchesPracticeSection(r,'xingce-'+section.id));
  assert.deepEqual(filtered.map(r=>r.id),displayed.map(r=>r.id),section.label);
  const eligible=eligiblePracticeRows(filtered);
  if(eligible.length)assert.ok(buildPracticeQueue(eligible,{policy:'random',limit:10}).length>0,section.label+'应能开始刷题');
 }
});
