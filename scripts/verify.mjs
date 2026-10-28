import {validateGuidedBundle} from './install-guided.mjs';
import {validateVocabulary} from './validate-vocabulary.mjs';
import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{ROOT,DATA,read,hash,validateRecord}from'../server/store.mjs';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
export function verify(db=read(),out=path.join(ROOT,'dist')){
 const problems=[],ids=new Set(),sources=new Map(db.sources.map(s=>[s.id,s]));let pages=0,bytes=0;
 for(const r of db.records){if(ids.has(r.id))problems.push(`重复 ID ${r.id}`);ids.add(r.id);if(!r.archived)try{validateRecord(r,db,r);}catch(e){problems.push(`${r.title}：${e.message}`);}for(const ref of r.sourceRefs||[])if(ref.sourceId&&!sources.has(ref.sourceId))problems.push(`来源缺失 ${r.id}`);}
 for(const s of db.sources){const f=path.join(DATA,'originals',s.filename);if(!fs.existsSync(f)){if(!s.missing)problems.push(`原文件缺失 ${s.title}`);continue;}if(hash(fs.readFileSync(f))!==s.sha256)problems.push(`原文件哈希不匹配 ${s.title}`);const m=path.join(DATA,'previews',s.id,'manifest.json');if(!fs.existsSync(m)){problems.push(`未生成预览 ${s.title}`);continue;}const manifest=JSON.parse(fs.readFileSync(m,'utf8'));if(manifest.pages.length!==s.pageCount)problems.push(`页数不一致 ${s.title}`);for(const p of manifest.pages){pages++;for(const suffix of ['.webp','-hd.webp'])if(!fs.existsSync(path.join(out,'previews',s.id,p.page+suffix)))problems.push(`公开预览缺失 ${s.id}/${p.page}${suffix}`);}}
 // The quiz UI reads clean scans directly. Having only an HD original must not
 // allow publishing a question that will render as a missing image.
 const practicePreviews=new Set();
 for(const r of db.records.filter(r=>!r.archived)){
  const q=r.details?.question;if(!q)continue;
  for(const p of [...(q.originalPages||[]),...(q.contextPages||[])]){
   const key=`${p.sourceId}/${p.page}${p.previewSuffix??'-clean'}`;if(practicePreviews.has(key))continue;practicePreviews.add(key);
   if(!sources.has(p.sourceId))problems.push(`刷题图片来源缺失 ${r.id} ${key}`);
   for(const base of [DATA,out])if(!fs.existsSync(path.join(base,'previews',p.sourceId,`${p.page}${['','-hd','-clean'].includes(p.previewSuffix)?p.previewSuffix:'-clean'}.webp`)))problems.push(`${base===DATA?'本地':'公开'}刷题原页图缺失 ${key} (${r.id})`);
  }
 }
 const forbidden=/(?:"(?:token|apiKey|password|secret|storedPath|localPath|sourcePath)"\s*:|[A-Z]:\\\\(?:Users|xiong|codex)|gh[opusr]_[A-Za-z0-9]{20,})/i;
 for(const f of walk(out)){bytes+=fs.statSync(f).size;if(f.endsWith('.json')){const contents=fs.readFileSync(f,'utf8');if(forbidden.test(contents))problems.push(`公开数据含本机路径或凭证字段 ${path.relative(out,f)}`);try{JSON.parse(contents);}catch{problems.push(`JSON 无效 ${f}`);}}}
 const exported=JSON.parse(fs.readFileSync(path.join(out,'data','catalog.json'),'utf8'));const expected=db.records.filter(r=>!r.archived);if(exported.records.length!==expected.length)problems.push('公开记录数不一致');for(const r of expected){if(!fs.existsSync(path.join(out,'data','records',r.id+'.json')))problems.push('公开详情缺失 '+r.id);}
 const guided=path.join(DATA,'guided-lessons.json');if(fs.existsSync(guided)){try{validateGuidedBundle(JSON.parse(fs.readFileSync(guided,'utf8')),db);const published=path.join(out,'data','guided-lessons.json');if(!fs.existsSync(published)||hash(JSON.parse(fs.readFileSync(published,'utf8')))!==hash(JSON.parse(fs.readFileSync(guided,'utf8'))))problems.push('公开精讲内容与本地不一致');}catch(e){problems.push('导学内容校验失败：'+e.message);}}
 const vocabulary=path.join(DATA,'vocabulary.json');if(fs.existsSync(vocabulary)){try{const bundle=JSON.parse(fs.readFileSync(vocabulary,'utf8'));validateVocabulary(bundle);const source=sources.get(bundle.source.id);if(!source||source.sha256!==bundle.source.sha256)throw new Error('词语来源PDF不一致');const published=path.join(out,'data','vocabulary.json');if(!fs.existsSync(published)||hash(JSON.parse(fs.readFileSync(published,'utf8')))!==hash(bundle))throw new Error('公开词语资料与本地不一致');}catch(e){problems.push('词语训练校验失败：'+e.message);}}
 if(bytes>1024**3)problems.push('站点超过 GitHub Pages 1 GB 限额');
 const result={ok:problems.length===0,records:expected.length,sources:db.sources.length,pages,practicePreviews:practicePreviews.size,siteMB:Math.round(bytes/1024**2*100)/100,problems};if(problems.length)throw new Error(JSON.stringify(result,null,2));return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(verify(),null,2));
