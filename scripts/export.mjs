import fs from 'node:fs';import path from 'node:path';import {fileURLToPath}from'node:url';
import {ROOT,DATA,read,atomic,catalog,publicClean,hash} from '../server/store.mjs';
import {readDrill} from '../server/drill.mjs';
import {readGuided} from '../server/guided.mjs';
export function exportSite(db=read(),out=path.join(ROOT,'dist')){
 const records=db.records.filter(r=>!r.archived);const catalogData=catalog(db);catalogData.drillProgress=publicClean(readDrill());for(const s of catalogData.sources)s.downloadUrl=`https://github.com/PF11223333/growth-study-platform/releases/download/materials/${s.filename}`;
 const dir=path.join(out,'data');fs.mkdirSync(dir,{recursive:true});for(const r of records)atomic(path.join(dir,'records',r.id+'.json'),publicClean(r));for(const s of db.sources)atomic(path.join(dir,'sources',s.id+'.json'),publicClean({id:s.id,pages:s.pages||[]}));
 const guided=path.join(DATA,'guided-lessons.json');if(fs.existsSync(guided))atomic(path.join(dir,'guided-lessons.json'),publicClean(JSON.parse(fs.readFileSync(guided,'utf8'))));atomic(path.join(dir,'guided-progress.json'),publicClean(readGuided()));
 atomic(path.join(dir,'catalog.json'),catalogData);atomic(path.join(dir,'search.json'),records.map(r=>({id:r.id,text:[r.title,r.body,r.topic,JSON.stringify(r.details?.pageOCR||[]),...r.tags||[]].join(' ').toLowerCase()})));atomic(path.join(dir,'growth.json'),publicClean(db.growth));
 if(fs.existsSync(path.join(DATA,'previews')))fs.cpSync(path.join(DATA,'previews'),path.join(out,'previews'),{recursive:true});
 atomic(path.join(out,'materials.json'),db.sources.filter(s=>!s.missing).map(({filename,sha256,size})=>({filename,sha256,size})));
 const version={appHash:hash(fs.readFileSync(path.join(out,'index.html'))),version:db.version,updatedAt:db.updatedAt,recordCount:records.length,sourceCount:db.sources.length,guidedHash:fs.existsSync(path.join(dir,'guided-lessons.json'))?hash(fs.readFileSync(path.join(dir,'guided-lessons.json'))):'',guidedProgressHash:hash(fs.readFileSync(path.join(dir,'guided-progress.json'))),catalogHash:hash(fs.readFileSync(path.join(dir,'catalog.json')))};atomic(path.join(out,'version.json'),version);atomic(path.join(out,'.nojekyll'),'');return version;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(exportSite()));
