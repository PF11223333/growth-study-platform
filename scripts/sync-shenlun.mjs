import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {ROOT,DATA,read,write,backup,atomic,hash,idFor,mergeImported} from '../server/store.mjs';

export const SHENLUN_ROOT=path.join(path.dirname(ROOT),'申论素材库');
const plain=value=>String(value||'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*`★]/g,'').trim();
const refs=text=>[...text.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g)].map(m=>({url:m[2],label:m[1]}));
const unique=items=>[...new Set(items.filter(Boolean))];
function installMirrorFile(file,bytes){
 if(fs.existsSync(file)&&hash(fs.readFileSync(file))===hash(bytes))return;
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temporary=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temporary,bytes);
 try{for(let attempt=0;;attempt++){try{fs.renameSync(temporary,file);break;}catch(error){if(attempt>=4||!['EPERM','EBUSY'].includes(error.code))throw error;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,100*(attempt+1));}}}
 finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
}
const topicTags=text=>{
 const field=text.match(/^-\s*\*\*(?:可迁移方向|可用主题|适用主题)[：:]\*\*\s*(.+)$/m)?.[1]||'';
 return unique(plain(field).replace(/[。；;]$/,'').split(/[、，,；;]/).map(x=>x.trim()).filter(x=>x.length>1&&x.length<24));
};

// Keep legacy IDs so notes and links survive repeat imports. A G entry repeated
// in "今日必背" must not replace its original context or cause a duplicate ID.
export function parseShenlunDay(file,content){
 if(!/^\d{4}-\d{2}-\d{2}\.md$/.test(file))throw new Error('申论日期文件名无效');
 if(content.includes('\ufffd'))throw new Error(`${file} 包含损坏字符，停止同步`);
 const date=file.slice(0,10),dailyId=idFor('shenlun',file),rows=new Map();
 const make=(legacyId,fields)=>({id:idFor('shenlun',legacyId),legacyId,origin:'shenlun',subject:'shenlun',date,sourceRefs:[],links:[dailyId],tags:[],...fields});
 rows.set(dailyId,make(file,{kind:'article',title:`${date} · 申论每日精读`,body:content,topic:'每日精读',tags:['每日积累'],sourceRefs:refs(content),links:[]}));
 const lines=content.split('\n');let section='',subsection='';
 for(let i=0;i<lines.length;i++){
  const line=lines[i].replace(/\r$/,'');
  if(/^## /.test(line)){section=plain(line.slice(3));subsection='';}
  if(/^### /.test(line))subsection=plain(line.slice(4));
  if(/^### \d+[.、]/.test(line)&&/精读/.test(section)){
   let end=i+1;while(end<lines.length&&!/^#{1,3} /.test(lines[end]))end++;
   const body=lines.slice(i+1,end).join('\n').trim(),title=plain(line.replace(/^### \d+[.、]\s*/,''));
   const row=make(file+':article:'+i,{kind:'article',title,body,topic:'精读好文',tags:unique(['精读',...(title.includes('公安岗')?['公安岗重点']:[]),...topicTags(body)]),sourceRefs:refs(body)});
   rows.set(row.id,row);
  }
  const quote=line.match(/^\s*(?:-\s*|\d+[.、]\s*)?\*\*((?:G|Q)\d+)([^：:\n]*)[：:]\*\*\s*(.+)/);
  if(quote){
   const [,number,context,body]=quote,legacyId=file+':'+number,id=idFor('shenlun',legacyId);
   if(!rows.has(id))rows.set(id,make(legacyId,{kind:'quote',title:`${number} · ${plain(body).slice(0,60)}`,body,topic:section.replace(/^[一二三四五六七八九十]+、/,''),tags:unique([number,number.startsWith('G')?'原创表达':'权威论述',subsection,...plain(context).replace(/^[｜|]/,'').split(/[、，,]/)]),sourceRefs:refs(body)}));
  }
  const authority=line.match(/^###\s+\**(Q\d+)[｜|、.\s]+(.+?)\**\s*$/);
  if(authority){
   let end=i+1;while(end<lines.length&&!/^#{1,3} /.test(lines[end]))end++;
   const body=lines.slice(i+1,end).join('\n').trim(),number=authority[1],row=make(file+':'+number,{kind:'quote',title:`${number} · ${plain(authority[2])}`,body,topic:'权威论述',tags:[number,'权威论述',...topicTags(body)],sourceRefs:refs(body)});
   rows.set(row.id,row);
  }
 }
 return [...rows.values()];
}

export function collectShenlun(sourceRoot=SHENLUN_ROOT){
 const daily=path.join(sourceRoot,'每日积累');
 const files=fs.readdirSync(daily).filter(f=>/^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort();
 if(!files.length)throw new Error('旧申论站没有可同步的每日积累');
 const dailyBytes=new Map(files.map(file=>[file,fs.readFileSync(path.join(daily,file))]));
 const rows=files.flatMap(file=>parseShenlunDay(file,dailyBytes.get(file).toString('utf8')));
 const latest=files.at(-1),latestText=dailyBytes.get(latest).toString('utf8'),latestRows=rows.filter(r=>r.date===latest.slice(0,10));
 if(latestRows.filter(r=>r.tags.includes('精读')).length<5||latestRows.filter(r=>r.tags.includes('原创表达')).length<10||!latestRows.some(r=>r.tags.includes('权威论述'))||!/今日必背/.test(latestText)||!/复习/.test(latestText))throw new Error('旧申论站最新一期尚不完整，保留已同步版本，稍后再试');
 const inputs=[...files.map(file=>({name:'每日积累/'+file,sha256:hash(dailyBytes.get(file))})),...['文章来源索引.md','主题索引.md','金句与传统表达索引.md','权威论述索引.md','学习与复盘指南.md','build_material_library.py','build_mobile_memory.py'].map(name=>{
  const bytes=fs.readFileSync(path.join(sourceRoot,name)),text=bytes.toString('utf8');
  if(text.includes('\ufffd'))throw new Error(`${name} 编码损坏，停止同步`);
  if(name.endsWith('索引.md')&&!text.includes(latest.slice(0,10)))throw new Error(`${name} 尚未跟上最新一期，保留已同步版本`);
  return {name,sha256:hash(bytes)};
 })];
 const manifest={schemaVersion:1,latestDate:files.at(-1).slice(0,10),dates:files.map(f=>f.slice(0,10)).reverse(),dayCount:files.length,articleCount:rows.filter(r=>r.tags.includes('精读')).length,expressionCount:rows.filter(r=>r.tags.includes('原创表达')).length,authorityCount:rows.filter(r=>r.tags.includes('权威论述')).length,sourceDigest:hash(inputs),originalSite:'https://pf11223333.github.io/shenlun-material-library/',sourceLabel:'申论素材库 · 既有每日积累与四类索引',originalHtmlHash:fs.existsSync(path.join(sourceRoot,'申论素材库.html'))?hash(fs.readFileSync(path.join(sourceRoot,'申论素材库.html'))):'',features:['今日学习','全文搜索','来源索引','主题索引','金句表达','权威论述','收藏','学习笔记','完成记录','记录导入导出','手机背诵'],inputs};
 for(const input of inputs)if(hash(fs.readFileSync(path.join(sourceRoot,input.name)))!==input.sha256)throw new Error('申论源文件正在更新，暂缓同步以避免读取半成品');
 return {rows,manifest};
}

export function buildShenlunMirror(sourceRoot=SHENLUN_ROOT,out=path.join(ROOT,'public','shenlun')){
 const result=spawnSync(process.env.GROWTH_PYTHON||'python',['-B',path.join(ROOT,'scripts','build-shenlun-mirror.py'),'--source',sourceRoot,'--output',out],{encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});
 if(result.status!==0)throw new Error('申论完整功能页构建失败：'+(result.stderr||result.stdout||result.error?.message||'未知错误'));
 return JSON.parse(result.stdout.trim());
}

export function syncShenlun({sourceRoot=SHENLUN_ROOT,apply=false,mirror=false,db=read(),output=path.join(ROOT,'public','shenlun')}={}){
 const {rows,manifest}=collectShenlun(sourceRoot),candidate=structuredClone(db),report=mergeImported(candidate,rows);
 const changed=report.added+report.updated+report.conflicts>0;
 let mirrored=null;
 const stageRoot=path.join(ROOT,'tmp'),stage=path.join(stageRoot,'shenlun-mirror-'+crypto.randomUUID());
 try{
  if(mirror){mirrored=buildShenlunMirror(sourceRoot,stage);if(mirrored.latestDate!==manifest.latestDate)throw new Error('申论镜像与每日积累最新日期不一致');}
  const after=collectShenlun(sourceRoot).manifest;
  if(after.sourceDigest!==manifest.sourceDigest)throw new Error('旧申论站正在更新，源文件前后校验不一致；保留原同步版本');
  if(mirror){for(const name of ['index.html','today.html'])installMirrorFile(path.join(output,name),fs.readFileSync(path.join(stage,name)));installMirrorFile(path.join(output,'manifest.json'),Buffer.from(JSON.stringify({...manifest,mirror:mirrored},null,2)));}
 }finally{
  if(path.dirname(path.resolve(stage))===path.resolve(stageRoot)&&path.basename(stage).startsWith('shenlun-mirror-')&&fs.existsSync(stage))fs.rmSync(stage,{recursive:true,force:true});
 }
 if(apply&&changed){if(read().version!==db.version)throw new Error('平台数据在同步期间已变化，请重试；本次没有覆盖新的编辑');backup(db);write(candidate);}
 const result={...report,changed,applied:apply&&changed,latestDate:manifest.latestDate,dayCount:manifest.dayCount,articleCount:manifest.articleCount,expressionCount:manifest.expressionCount,authorityCount:manifest.authorityCount,sourceDigest:manifest.sourceDigest,mirror:mirrored};
 if(apply)atomic(path.join(DATA,'shenlun-sync-report.json'),result);
 return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(syncShenlun({apply:process.argv.includes('--write'),mirror:process.argv.includes('--mirror')}),null,2));
