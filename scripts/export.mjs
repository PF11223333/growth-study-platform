import fs from 'node:fs';import path from 'node:path';import {fileURLToPath}from'node:url';
import {ROOT,DATA,read,atomic,catalog,publicClean,hash} from '../server/store.mjs';
export function exportSite(db=read(),out=path.join(ROOT,'dist')){
 const records=db.records.filter(r=>!r.archived);const catalogData=catalog(db);for(const s of catalogData.sources)s.downloadUrl=`https://github.com/PF11223333/growth-study-platform/releases/download/materials/${s.filename}`;
 const dir=path.join(out,'data');fs.mkdirSync(dir,{recursive:true});for(const r of records)atomic(path.join(dir,'records',r.id+'.json'),publicClean(r));for(const s of db.sources)atomic(path.join(dir,'sources',s.id+'.json'),publicClean({id:s.id,pages:s.pages||[]}));
 atomic(path.join(dir,'catalog.json'),catalogData);atomic(path.join(dir,'search.json'),records.map(r=>({id:r.id,text:[r.title,r.body,r.topic,...r.tags||[]].join(' ').toLowerCase()})));atomic(path.join(dir,'growth.json'),publicClean(db.growth));
 if(fs.existsSync(path.join(DATA,'previews')))fs.cpSync(path.join(DATA,'previews'),path.join(out,'previews'),{recursive:true});
 const version={version:db.version,updatedAt:db.updatedAt,recordCount:records.length,sourceCount:db.sources.length,catalogHash:hash(fs.readFileSync(path.join(dir,'catalog.json')))};atomic(path.join(out,'version.json'),version);atomic(path.join(out,'.nojekyll'),'');return version;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(exportSite()));
