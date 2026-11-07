import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {ROOT, DATA, STORE, hash, write, validateRecord} from '../server/store.mjs';

const BATCH = 'thinking-calibration-20261107';
const SOURCE = 'source-adaa1c70c42f855e5cb0b163';
const BANK = 'police-thinking-20261105';
const EXPECTED = {
  '1-single': 12, '1-multi': 3, '1-case': 27,
  '2-single': 26, '2-multi': 14, '2-case': 20,
  '3-single': 31, '3-multi': 15, '3-case': 19,
  '4-single': 49, '4-multi': 12, '4-case': 31,
  '5-single': 15, '5-multi': 10, '5-case': 16,
  '6-single': 24, '6-multi': 9, '6-case': 5,
};
const LETTERS = ['A', 'B', 'C', 'D'];
const uniq = values => [...new Set(values)];
// Only import bookkeeping is excluded. Every field containing record content,
// user state, dates, links or explanations participates in this comparison.
const contentHash = row => {
  const copy = structuredClone(row);
  delete copy.revision;
  delete copy.importHash;
  return hash(copy);
};
const snapshot = file => fs.existsSync(file) ? {exists: true, bytes: fs.readFileSync(file)} : {exists: false};
const sameSnapshot = (file, before) => fs.existsSync(file) === before.exists && (!before.exists || hash(fs.readFileSync(file)) === hash(before.bytes));

function validateCandidate(candidate, db, dataDir) {
  assert.equal(candidate.schemaVersion, 1, '候选版本不支持');
  assert.equal(candidate.importId, BATCH, '不是本轮校准候选');
  assert.ok(Array.isArray(candidate.records));
  assert.equal(candidate.records.length, 356, '应为338道独立题及18个原页组');
  assert.equal(new Set(candidate.records.map(r => r.id)).size, 356, '候选ID重复');
  assert.equal(candidate.sources?.length || 0, 0, '本安装器不允许更改原资料');
  assert.equal(candidate.recordPatches?.length || 0, 0, '未支持的记录补丁类型');
  const independent = candidate.records.filter(r => r.details?.calibration?.independentOriginalQuestion);
  const groups = candidate.records.filter(r => r.studyQuestion?.groupOnly);
  assert.equal(independent.length, 338);
  assert.equal(groups.length, 18);
  const counts = {}, identities = new Set(), imageFiles = new Set(), scenarioGroups = new Map();
  let explanations = 0, excluded = 0;
  for (const row of independent) {
    const c = row.details.calibration, q = row.details.question, s = row.studyQuestion;
    assert.equal(c.batch, BATCH);
    assert.equal(s.bank, BANK);
    assert.equal(row.kind, 'practice');
    assert.equal(row.subject, 'gongan');
    const category = `${c.chapter}-${c.sectionType}`, identity = `${category}-${c.number}`;
    assert.ok(Object.hasOwn(EXPECTED, category), '未知题型 '+category);
    assert.ok(Number.isInteger(c.number) && c.number >= 1 && c.number <= EXPECTED[category]);
    assert.ok(!identities.has(identity), '同一原题重复 '+identity);
    identities.add(identity); counts[category] = (counts[category] || 0) + 1;
    assert.deepEqual(Object.keys(q.options).sort(), LETTERS, row.id+'缺少四选项');
    assert.deepEqual(Object.keys(q.optionExplanations).sort(), LETTERS, row.id+'缺少四项解释');
    assert.ok(q.prompt?.trim(), row.id+'缺少题干');
    assert.ok(Array.isArray(q.originalPages) && q.originalPages.length, row.id+'缺少原题图');
    for (const key of LETTERS) {
      assert.ok(q.options[key]?.trim(), row.id+'空选项'+key);
      const note = q.optionExplanations[key];
      assert.ok(note?.text?.trim().length >= 10 && note.basis?.length, row.id+'缺少具体解析或依据'+key);
      explanations++;
      for (const b of note.basis) {
        assert.ok(b.title && b.article && b.verifiedAt, row.id+'依据缺少名称、定位或日期');
        const internal = b.sourceId === SOURCE && Number.isInteger(b.page) && b.page >= 1 && b.page <= 171;
        assert.ok(b.url ? /^https:\/\//.test(b.url) || internal && b.url === `#/source/${SOURCE}?page=${b.page}` : internal, row.id+'依据定位无效');
      }
    }
    if (q.gradingExcluded) {
      excluded++;
      assert.equal(q.referenceAnswer, '', row.id+'待确认题不得设置计分答案');
      assert.ok(s.gradingExcluded && q.gradingExclusionReason, row.id+'缺少待确认排除说明');
    } else {
      assert.match(q.referenceAnswer, /^[A-D]{1,4}$/);
      assert.equal(new Set(q.referenceAnswer).size, q.referenceAnswer.length);
      assert.ok(['single', 'multi'].includes(q.type));
      if (q.type === 'single') assert.equal(q.referenceAnswer.length, 1, '单选只能有一个参考答案');
    }
    if (c.sectionType === 'case') {
      assert.ok(s.caseGroupId && q.fullContextText?.trim() && q.contextPages?.length, row.id+'共用情景缺失');
      if (!scenarioGroups.has(s.caseGroupId)) scenarioGroups.set(s.caseGroupId, []);
      scenarioGroups.get(s.caseGroupId).push(row);
    }
  }
  assert.deepEqual(counts, EXPECTED, '各章题型数量不符');
  assert.equal(explanations, 1352, '每题均须包含四项解析');
  assert.equal(excluded, 10, '争议题数量发生变化，需重新审查');
  assert.equal(scenarioGroups.size, 30);
  for (const [id, rows] of scenarioGroups) {
    assert.equal(new Set(rows.map(r => r.details.question.fullContextText)).size, 1, id+'共用材料不一致');
    assert.deepEqual(rows.map(r => r.studyQuestion.caseGroupOrder).sort((a,b) => a-b), rows.map((_,i) => i+1), id+'子题顺序不连续');
  }
  assert.equal(new Set(groups.map(r => r.id)).size, 18);
  for (const row of groups) {
    assert.ok(/^thinking-page-group-20261106-[1-6]-(single|multi|case)$/.test(row.id));
    assert.ok(db.records.some(r => r.id === row.id), '原页组不存在 '+row.id);
    assert.ok(row.details.question.gradingExcluded, '原页组不能重复计分');
  }
  for (const row of candidate.records) {
    const q = row.details.question;
    for (const p of [...(q.originalPages || []), ...(q.contextPages || [])]) {
      assert.equal(p.sourceId, SOURCE, '不能更换本批原题来源');
      assert.ok(Number.isInteger(p.page) && p.page >= 1 && p.page <= 171);
      assert.equal(p.previewSuffix, '-hd');
      assert.ok(p.width > 0 && p.height > 0);
      const r = p.region;
      assert.ok(r && ['x','y','w','h'].every(k => Number.isFinite(r[k])) && r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0 && r.x+r.w <= 1.00001 && r.y+r.h <= 1.00001, row.id+'图片区域越界');
      const file = path.join(dataDir, 'previews', SOURCE, `${p.page}-hd.webp`);
      if (!imageFiles.has(file)) {
        assert.ok(fs.existsSync(file) && fs.statSync(file).size > 512, '原题图片缺失或无内容 '+file);
        const fd = fs.openSync(file, 'r'), header = Buffer.alloc(12);
        try { assert.equal(fs.readSync(fd, header, 0, 12, 0), 12); } finally { fs.closeSync(fd); }
        assert.equal(header.toString('ascii', 0, 4), 'RIFF', '原图不是有效WebP');
        assert.equal(header.toString('ascii', 8, 12), 'WEBP', '原图不是有效WebP');
        imageFiles.add(file);
      }
    }
  }
  assert.equal(candidate.recordLinkPatches.length, 6, '应只追加六章链接');
  assert.equal(new Set(candidate.recordLinkPatches.map(p => p.recordId)).size, 6);
  const candidateIds = new Set(candidate.records.map(r => r.id));
  for (const patch of candidate.recordLinkPatches) {
    assert.ok(db.records.some(r => r.id === patch.recordId), '章节链接目标不存在 '+patch.recordId);
    assert.ok(!candidateIds.has(patch.recordId), '章节卡不能被题目覆盖');
    assert.ok(Array.isArray(patch.appendLinks) && patch.appendLinks.every(id => candidateIds.has(id)), '章节链接必须属于本批题目或原页组');
  }
  return {independent, groups, counts, explanations, excluded, imageFiles};
}

/** Pure merge: local edits remain intact, including edited chapter link lists. */
export function prepareThinkingCalibration(db, candidate, {dataDir = DATA} = {}) {
  const validation = validateCandidate(candidate, db, dataDir);
  const next = structuredClone(db), byId = new Map(next.records.map(r => [r.id, r]));
  assert.equal(byId.size, next.records.length, '平台已有重复ID');
  const at = new Date().toISOString();
  const stats = {addedQuestions: 0, updatedQuestions: 0, updatedPageGroups: 0, updatedChapterLinks: 0, conflicts: 0, unchanged: 0};
  const allowed = new Set([...candidate.records.map(r => r.id), ...candidate.recordLinkPatches.map(p => p.recordId)]);
  const protectedRecords = db.records.filter(r => !allowed.has(r.id));
  const editedBefore = new Map(db.records.filter(r => r.edited).map(r => [r.id, hash(r)]));
  const originals = new Map(db.records.map(r => [r.id, r]));
  const touched = new Set();
  const conflict = (old, incoming, reason) => {
    const incomingHash = contentHash(incoming);
    if (next.conflicts.some(c => c.recordId === old.id && (c.incomingHash === incomingHash || c.incoming?.importHash === incomingHash))) return;
    next.conflicts.push({id: `${BATCH}-conflict-${hash(old.id+'\n'+incomingHash).slice(0,24)}`, recordId: old.id, at, reason, batch: BATCH, baseRevision: old.revision, localHash: hash(old), incomingHash, incoming: {...structuredClone(incoming), importHash: incomingHash}});
    stats.conflicts++;
  };
  const merge = (incoming, category) => {
    const old = byId.get(incoming.id), incomingHash = contentHash(incoming);
    if (old && contentHash(old) === incomingHash) { stats.unchanged++; return; }
    if (old?.edited) { conflict(old, incoming, '本机已有人工编辑，保留双方内容，不覆盖原记录。'); return; }
    const row = {...structuredClone(incoming), revision: old ? old.revision+1 : 1, importHash: incomingHash};
    if (old) {
      next.archives.push({recordId: old.id, at, reason: BATCH, record: structuredClone(old)});
      next.records[next.records.indexOf(old)] = row;
    } else {
      assert.equal(category, 'updatedQuestions', '只能新增本批独立题');
      next.records.push(row);
    }
    byId.set(row.id, row); touched.add(row.id);
    stats[old ? category : 'addedQuestions']++;
  };
  for (const row of candidate.records) merge(row, row.studyQuestion?.groupOnly ? 'updatedPageGroups' : 'updatedQuestions');
  for (const patch of candidate.recordLinkPatches) {
    const old = byId.get(patch.recordId);
    const links = uniq([...(old.links || []), ...patch.appendLinks]);
    merge({...structuredClone(old), links}, 'updatedChapterLinks');
  }
  for (const row of candidate.records) validateRecord(row, next, originals.get(row.id) || row);
  for (const patch of candidate.recordLinkPatches) validateRecord(byId.get(patch.recordId), next, byId.get(patch.recordId));
  assert.equal(hash(protectedRecords), hash(next.records.filter(r => !allowed.has(r.id))), '未校准记录被改变');
  for (const [id, digest] of editedBefore) assert.equal(hash(byId.get(id)), digest, '人工编辑记录被覆盖 '+id);
  assert.equal(hash(next.archives.slice(0, db.archives.length)), hash(db.archives), '旧归档被改变');
  assert.equal(hash(next.conflicts.slice(0, db.conflicts.length)), hash(db.conflicts), '旧冲突被改变');
  for (const key of Object.keys(db).filter(k => !['records','archives','conflicts'].includes(k))) assert.equal(hash(next[key]), hash(db[key]), '越界修改平台字段 '+key);
  return {db: next, changed: hash(next) !== hash(db), report: {...stats, totalIndependentQuestions: 338, gradableCandidates: 328, pendingQuestions: 10, perTypeCounts: validation.counts, optionExplanations: validation.explanations, sourceImageFiles: validation.imageFiles.size, untouchedRecords: protectedRecords.length, editedRecordsPreserved: editedBefore.size, sourceMetadataUnchanged: true, oldArchivesUnchanged: true, touchedRecords: touched.size}};
}

export function installThinkingCalibration({apply = false, candidateFile = path.join(DATA, BATCH+'-candidate.json')} = {}) {
  const platformBefore = snapshot(STORE);
  assert.ok(platformBefore.exists, '平台数据不存在');
  const db = JSON.parse(platformBefore.bytes), candidateBefore = snapshot(candidateFile);
  assert.ok(candidateBefore.exists, '请先生成校准候选');
  const candidate = JSON.parse(candidateBefore.bytes);
  const candidateHash = hash(candidateBefore.bytes);
  assert.equal(candidate.basePlatform?.version, db.version, '平台版本已变化，请重新生成候选');
  assert.equal(candidate.basePlatform?.hash, hash(platformBefore.bytes), '平台内容哈希已变化，请重新生成候选');
  const selected = JSON.parse(fs.readFileSync(path.join(ROOT, 'output/materials-20261105/thinking-selected-records.json'), 'utf8'));
  assert.equal(selected.length, 13);
  const existingIds = new Set(db.records.map(r => r.id));
  const selectedIds = new Set(selected.map(r => r.id));
  const independent = candidate.records.filter(r => r.details?.calibration?.independentOriginalQuestion);
  assert.deepEqual(independent.filter(r => existingIds.has(r.id)).map(r => r.id).sort(), [...selectedIds].sort(), '原13题ID未保留或本批已安装；请核查候选基线');
  assert.equal(independent.filter(r => !existingIds.has(r.id)).length, 325, '本批应新增325题');
  const backupNames = uniq(['platform.json','drill-progress.json','guided-review.json','guided-progress.json','guided-review-progress.json','guided-state.json', ...fs.readdirSync(DATA).filter(n => /^(?:guided|导学).*(?:progress|review|state|进度|记录).*\.json$/i.test(n))]);
  const protectedFiles = new Map(backupNames.map(name => [path.join(DATA, name), snapshot(path.join(DATA, name))]));
  assert.ok(sameSnapshot(STORE, platformBefore), '读取准备阶段平台已变化');
  const prepared = prepareThinkingCalibration(db, candidate);
  const repeated = prepareThinkingCalibration(prepared.db, candidate);
  assert.equal(hash(repeated.db), hash(prepared.db), '重复合并不幂等；不得忽略记录内容');
  assert.equal(repeated.changed, false);
  const assertUnchanged = () => {
    assert.ok(sameSnapshot(candidateFile, candidateBefore), '安装期间候选文件已变化');
    assert.ok(sameSnapshot(STORE, platformBefore), '安装期间平台版本或内容已变化');
    for (const [file, before] of protectedFiles) assert.ok(sameSnapshot(file, before), '安装期间进度已变化：'+path.basename(file));
  };
  assertUnchanged();
  let backupFolder = null;
  if (apply && prepared.changed) {
    backupFolder = path.join(DATA, 'backups', BATCH+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomUUID());
    fs.mkdirSync(backupFolder, {recursive: true});
    const manifest = [];
    for (const [file, before] of protectedFiles) {
      const entry = {name: path.basename(file), exists: before.exists};
      if (before.exists) {
        const target = path.join(backupFolder, entry.name);
        fs.writeFileSync(target, before.bytes, {flag: 'wx'});
        entry.sha256 = hash(before.bytes);
        assert.equal(hash(fs.readFileSync(target)), entry.sha256, '备份回读哈希不符');
      }
      manifest.push(entry);
    }
    fs.writeFileSync(path.join(backupFolder, 'manifest.json'), JSON.stringify({batch:BATCH, candidateHash, basePlatform:candidate.basePlatform, files:manifest}, null, 2), {encoding:'utf8', flag:'wx'});
    // All expensive validation and backups are complete before this final byte check.
    assertUnchanged();
    write(prepared.db); // The sole production write; store.write uses atomic replacement.
    const installed = JSON.parse(fs.readFileSync(STORE, 'utf8'));
    assert.equal(hash(installed), hash(prepared.db), '安装后独立回读内容不符；请使用保留的备份核查');
    for (const [file, before] of protectedFiles) if (file !== STORE) assert.ok(sameSnapshot(file, before), '安装后进度发生变化：'+path.basename(file));
  }
  return {...prepared.report, candidateHash, baseVersion:db.version, resultingVersion:prepared.db.version, changed:prepared.changed, applied:apply && prepared.changed, dryRun:!apply, idempotent:true, strictBaseHashVerified:true, backupFolder};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const unknown = process.argv.slice(2).filter(arg => arg !== '--write');
  assert.equal(unknown.length, 0, '只支持显式 --write；默认只校验，不安装');
  console.log(JSON.stringify(installThinkingCalibration({apply:process.argv.includes('--write')}), null, 2));
}
