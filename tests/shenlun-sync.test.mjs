import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseShenlunDay,collectShenlun,syncShenlun} from '../scripts/sync-shenlun.mjs';
import {empty,idFor,mergeImported} from '../server/store.mjs';

const fixture=`# 2026-10-24 今日申论
## 一、今日精读好文
### 1. 公安岗重点 精准服务
- **原文：** [官方来源](https://example.gov.cn/a)
- **可迁移方向：** 基层治理、公安群众工作。
## 三、原创金句
### 开头句
1. **G1011｜基层治理：** 【原创】服务要真正抵达需要的人。
## 五、权威论述
### Q275｜有据可查
- **权威表述：** 引用原文。
- **官方链接：** [原始文献](https://example.gov.cn/b)
- **使用边界：** 保留适用条件。
## 九、今日必背
1. **G1011：** 服务要真正抵达需要的人。
`;

test('申论同步保留四位编号原始语境，权威论述含完整出处与边界',()=>{
 const rows=parseShenlunDay('2026-10-24.md',fixture);
 assert.equal(rows.length,4);
 assert.equal(new Set(rows.map(r=>r.id)).size,4);
 const gold=rows.find(r=>r.tags.includes('G1011'));
 assert.match(gold.body,/【原创】/);assert.ok(gold.tags.includes('基层治理'));assert.ok(gold.tags.includes('开头句'));
 const authority=rows.find(r=>r.tags.includes('Q275'));
 assert.match(authority.body,/使用边界/);assert.equal(authority.sourceRefs[0].url,'https://example.gov.cn/b');
 const article=rows.find(r=>r.tags.includes('精读'));assert.ok(article.tags.includes('公安群众工作'));assert.equal(article.id,idFor('shenlun','2026-10-24.md:article:2'));
});
test('同步重复导入不增量，人工改动保留且相同冲突不重复',()=>{
 const db=empty();let rows=parseShenlunDay('2026-10-24.md',fixture);mergeImported(db,rows);
 assert.deepEqual(mergeImported(db,parseShenlunDay('2026-10-24.md',fixture)),{added:0,updated:0,conflicts:0,total:4});
 const old=db.records.find(r=>r.tags.includes('G1011'));old.body='我的改写';old.edited=true;
 const modified=fixture.replace('【原创】服务要真正抵达需要的人。','【原创】新版本表达。');
 const first=mergeImported(db,parseShenlunDay('2026-10-24.md',modified));assert.equal(first.conflicts,1);assert.equal(old.body,'我的改写');
 const second=mergeImported(db,parseShenlunDay('2026-10-24.md',modified));assert.equal(second.conflicts,0);assert.equal(db.conflicts.length,1);
});
test('坏编码不会进入发布数据',()=>{assert.throws(()=>parseShenlunDay('2026-10-24.md','# 损坏\ufffd'),/损坏字符/);assert.throws(()=>parseShenlunDay('../fake.md','text'),/日期文件名/);});
test('现有申论内容全部ID唯一，最新一期和四类索引均参与同步指纹',()=>{
 const {rows,manifest}=collectShenlun();
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);
 assert.ok(manifest.dayCount>0);assert.equal(manifest.latestDate,[...new Set(rows.map(r=>r.date))].sort().at(-1));
 assert.ok(manifest.inputs.some(x=>x.name==='主题索引.md'));assert.ok(manifest.inputs.some(x=>x.name==='权威论述索引.md'));
 for(const row of rows)for(const link of row.links)assert.ok(rows.some(x=>x.id===link));
});
test('源站正在写入的半成品不能覆盖已有镜像',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'shenlun-sync-test-')),source=path.join(root,'source'),output=path.join(root,'mirror');
 try{
  fs.mkdirSync(path.join(source,'每日积累'),{recursive:true});fs.mkdirSync(output);
  fs.writeFileSync(path.join(source,'每日积累','2026-10-24.md'),'# 尚在写入\n## 一、今日精读');
  fs.writeFileSync(path.join(output,'index.html'),'existing published content');
  assert.throws(()=>syncShenlun({sourceRoot:source,mirror:true,output,db:empty()}),/尚不完整/);
  assert.equal(fs.readFileSync(path.join(output,'index.html'),'utf8'),'existing published content');
 }finally{if(path.dirname(root)===os.tmpdir()&&path.basename(root).startsWith('shenlun-sync-test-'))fs.rmSync(root,{recursive:true,force:true});}
});
