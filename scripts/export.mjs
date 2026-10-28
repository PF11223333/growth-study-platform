import fs from 'node:fs';import path from 'node:path';import {fileURLToPath}from'node:url';
import {ROOT,DATA,read,atomic,catalog,publicClean,hash} from '../server/store.mjs';
import {readDrill} from '../server/drill.mjs';
import {readGuided} from '../server/guided.mjs';
export function exportSite(db=read(),out=path.join(ROOT,'dist')){
 const records=db.records.filter(r=>!r.archived);const catalogData=catalog(db);catalogData.drillProgress=publicClean(readDrill());for(const s of catalogData.sources)s.downloadUrl=`https://github.com/PF11223333/growth-study-platform/releases/download/materials/${s.filename}`;
 const dir=path.join(out,'data');fs.mkdirSync(dir,{recursive:true});for(const r of records)atomic(path.join(dir,'records',r.id+'.json'),publicClean(r));for(const s of db.sources)atomic(path.join(dir,'sources',s.id+'.json'),publicClean({id:s.id,pages:s.pages||[]}));
 const vocabulary=path.join(DATA,'vocabulary.json');if(fs.existsSync(vocabulary))atomic(path.join(dir,'vocabulary.json'),publicClean(JSON.parse(fs.readFileSync(vocabulary,'utf8'))));
 const guided=path.join(DATA,'guided-lessons.json');if(fs.existsSync(guided))atomic(path.join(dir,'guided-lessons.json'),publicClean(JSON.parse(fs.readFileSync(guided,'utf8'))));atomic(path.join(dir,'guided-progress.json'),publicClean(readGuided()));
 // Compact transport keeps every field while avoiding megabytes of indentation on mobile.
 atomic(path.join(dir,'catalog.json'),JSON.stringify(catalogData));atomic(path.join(dir,'search.json'),JSON.stringify(records.map(r=>({id:r.id,text:[r.title,r.body,r.topic,JSON.stringify(r.details?.pageOCR||[]),...r.tags||[]].join(' ').toLowerCase()}))));atomic(path.join(dir,'growth.json'),publicClean(db.growth));
 if(fs.existsSync(path.join(DATA,'previews')))fs.cpSync(path.join(DATA,'previews'),path.join(out,'previews'),{recursive:true});
 // Keep the previous public release's immutable chunks for tabs open during this update.
 const compatibility=path.join(DATA,'compat-assets');if(fs.existsSync(compatibility))for(const file of fs.readdirSync(compatibility)){if(!/^[\w.-]+\.(?:js|mjs|css)$/.test(file))continue;const bytes=fs.readFileSync(path.join(compatibility,file)),target=path.join(out,'assets',file);if(bytes.length>3000000)throw new Error('兼容文件超过预期大小');if(fs.existsSync(target)){if(hash(fs.readFileSync(target))!==hash(bytes))throw new Error('同名页面文件内容不一致');}else atomic(target,bytes);}
 atomic(path.join(out,'materials.json'),db.sources.filter(s=>!s.missing).map(({filename,sha256,size})=>({filename,sha256,size})));
 const version={vocabularyHash:fs.existsSync(path.join(dir,'vocabulary.json'))?hash(fs.readFileSync(path.join(dir,'vocabulary.json'))):'',shenlunHash:fs.existsSync(path.join(out,'shenlun','manifest.json'))?hash(fs.readFileSync(path.join(out,'shenlun','manifest.json'))):'',appHash:hash(fs.readFileSync(path.join(out,'index.html'))),version:db.version,updatedAt:db.updatedAt,recordCount:records.length,sourceCount:db.sources.length,guidedHash:fs.existsSync(path.join(dir,'guided-lessons.json'))?hash(fs.readFileSync(path.join(dir,'guided-lessons.json'))):'',guidedProgressHash:hash(fs.readFileSync(path.join(dir,'guided-progress.json'))),catalogHash:hash(fs.readFileSync(path.join(dir,'catalog.json')))};atomic(path.join(out,'version.json'),version);atomic(path.join(out,'.nojekyll'),'');return version;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(exportSite()));
