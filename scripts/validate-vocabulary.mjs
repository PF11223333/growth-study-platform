import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Reject incomplete teaching data rather than silently dropping original rows. */
export function validateVocabulary(bundle) {
  if (bundle?.schemaVersion !== 1 || !Array.isArray(bundle.entries)) throw new Error('词语数据格式不正确');
  if (bundle.entries.length !== 305) throw new Error('须保留原表全部305条');
  if (!bundle.source?.sha256?.match(/^[a-f0-9]{64}$/) || bundle.source?.pageCount !== 12) throw new Error('原资料哈希或页数缺失');
  const ids = new Set(), words = new Set();
  for (const [index, e] of bundle.entries.entries()) {
    if (e.number !== index + 1 || e.id !== `vocabulary-${String(index + 1).padStart(3, '0')}` || ids.has(e.id)) throw new Error('原编号必须连续且唯一');
    ids.add(e.id); words.add(e.word);
    for (const key of ['word', 'label', 'displayLabel', 'meaning', 'usage', 'example', 'explanation']) {
      if (typeof e[key] !== 'string' || !e[key].trim() || e[key].includes('\uFFFD')) throw new Error(`第${e.number}条${key}缺失或乱码`);
    }
    if (e.source?.id !== bundle.sourceId || !Number.isInteger(e.source?.page) || e.source.page < 1 || e.source.page > 12) throw new Error('原页定位不正确');
    for (const key of ['originalLabel', 'originalMeaning', 'originalExample', 'documentLabel', 'text']) {
      if (typeof e.source[key] !== 'string' || !e.source[key].trim()) throw new Error(`第${e.number}条原文未完整保留`);
    }
    if (!['source', 'authored'].includes(e.exampleOrigin)) throw new Error('例句须区分原文和编写');
    if (e.exampleOrigin === 'source' && e.example !== e.source.originalExample) throw new Error('原文例句不得静默修改');
    if (e.clozeEligible && (!e.clozeTarget || !e.example.includes(e.clozeTarget))) throw new Error(`第${e.number}条不能精确挖空`);
    const region = e.source.region;
    if (!region || [region.x, region.y, region.width, region.height].some(n => !Number.isFinite(n) || n < 0 || n > 1) || region.x + region.width > 1 || region.y + region.height > 1) throw new Error('原文标注越界');
    if (e.verification?.officialAttributionVerified !== false || !e.verification?.notes?.length) throw new Error('原表简称不能冒充官方原文核验');
    for (const ref of e.correctionReferences || []) {
      if (!ref.title || !ref.checkedAt || !ref.excerpt || !ref.supports || !/^https:\/\/(dict\.concised\.moe\.edu\.tw|www\.ndrc\.gov\.cn|www\.samr\.gov\.cn|ntjss\.moa\.gov\.cn|zys\.moa\.gov\.cn|www\.mohurd\.gov\.cn)\//.test(ref.url)) throw new Error('校正或补充释义依据不完整');
    }
  }
  for (const e of bundle.entries) for (const id of e.confusable || []) if (!ids.has(id) || id === e.id) throw new Error('易混关联无效');
  const row = n => bundle.entries[n - 1];
  if (row(150).meaning === row(150).source.originalMeaning || !row(150).correctionReferences.length) throw new Error('软硬兼施须保留原文并校正');
  if (row(266).word !== '质的有效提升、量的合理增长' || !row(266).source.originalLabel.startsWith('量的有效提升')) throw new Error('质与量校正或原文丢失');
  if (row(266).displayLabel !== row(266).word) throw new Error('校正后的学习标题不得回流原表错误');
  if (row(270).exampleOrigin !== 'authored' || !row(270).source.originalExample.includes('联通')) throw new Error('五通与三联通不可混作原句');
  if (row(208).example.includes('10.5') || !row(208).source.originalExample.includes('10.5')) throw new Error('未注明年份数值须仅保留在原文对照');
  return {entries: ids.size, uniqueExpressions: words.size, sourcePages: bundle.source.pageCount, clozeEligible: bundle.entries.filter(e=>e.clozeEligible).length};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2] || new URL('../data/vocabulary-candidate.json', import.meta.url);
  console.log(JSON.stringify(validateVocabulary(JSON.parse(fs.readFileSync(target, 'utf8')))));
}
