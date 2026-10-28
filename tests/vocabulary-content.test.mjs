import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateVocabulary} from '../scripts/validate-vocabulary.mjs';

const candidate = new URL('../data/vocabulary-candidate.json', import.meta.url);
const published = new URL('../data/vocabulary.json', import.meta.url);
const read = () => JSON.parse(fs.readFileSync(fs.existsSync(candidate) ? candidate : published, 'utf8'));

test('表达表保留305个原编号、296个核心表达及12页定位', () => {
  assert.deepEqual(validateVocabulary(read()), {entries:305, uniqueExpressions:296, sourcePages:12, clozeEligible:305});
});

test('跨行表格不串列、不吞掉组合表达，原例句与编写例句分开', () => {
  const b=read(), entry=n=>b.entries[n-1];
  assert.equal(entry(247).source.originalMeaning, '以文化塑造旅游、以旅游彰显文化');
  assert.equal(entry(268).word, '在发展中固安全、在安全中谋发展');
  assert.equal(entry(269).source.page, 11);
  assert.equal(entry(296).word, '幼有所育、学有所教、劳有所得、病有所医、老有所养、住有所居、弱有所扶');
  assert.equal(entry(301).word, '以治病为中心向以健康为中心转变');
  assert.equal(b.entries.filter(e=>e.exampleOrigin==='source').length,259);
  assert.equal(b.entries.filter(e=>e.exampleOrigin==='authored').length,46);
});

test('原文被改写、引用误标、挖空目标丢失或长行缺失时拒绝发布', () => {
  let b=read();b.entries[0].example+='改写';assert.throws(()=>validateVocabulary(b),/不得静默修改/);
  b=read();b.entries[149].verification.officialAttributionVerified=true;assert.throws(()=>validateVocabulary(b),/不能冒充/);
  b=read();b.entries[267].clozeTarget='不存在的词';assert.throws(()=>validateVocabulary(b),/精确挖空/);
  b=read();b.entries.splice(295,1);assert.throws(()=>validateVocabulary(b),/全部305条/);
});

test('同词不同搭配保留原编号但共享重复组，易混词仅用于排除歧义干扰', () => {
  const b=read(), row=n=>b.entries[n-1];
  assert.equal(row(35).duplicateGroup,row(36).duplicateGroup);
  assert.notEqual(row(35).id,row(36).id);
  assert.notEqual(row(35).label,row(36).label);
  assert.ok(row(19).confusable.includes(row(20).id));
  assert.ok(row(45).confusable.includes(row(98).id));
  assert.ok(row(193).confusable.includes(row(135).id));
  assert.ok(row(194).confusable.includes(row(158).id));
  assert.ok(row(193).meaning.includes('碳排放'));
  assert.ok(row(194).meaning.includes('山、水、林、田、湖、草、沙'));
});

test('质与量校正后主学习标题使用正确表达，错误标题只留在原文', () => {
  const b=read(),e=b.entries[265];
  assert.equal(e.displayLabel,'质的有效提升、量的合理增长');
  assert.equal(e.source.originalLabel,'量的有效提升+质的合理增长');
  e.displayLabel=e.label;assert.throws(()=>validateVocabulary(b),/学习标题/);
});

test('过简释义补成具体教学含义，不用词名重复解释词名或泄露填词答案', () => {
  const b=read(),row=n=>b.entries[n-1];
  assert.equal(b.entries.filter(e=>e.meaningOrigin==='authored').length,92);
  assert.match(row(186).meaning,/教育、医疗、养老/);
  for(const e of b.entries)assert.ok(!e.meaning.includes(e.clozeTarget),`第${e.number}条释义泄露答案`);
  assert.equal(row(254).source.originalMeaning,"浙江'千万工程'");
  assert.match(row(254).meaning,/村庄示范.*环境整治/);
  for(const n of [168,212,216,251,253,254,259])assert.ok(row(n).correctionReferences.length,`第${n}条补充专业释义需依据`);
  for(const [a,c] of [[19,20],[19,21],[2,24],[295,298],[212,254]])assert.ok(row(a).confusable.includes(row(c).id),`第${a}/${c}条近义应排除`);
});
