import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawn}from'node:child_process';
import {ROOT,DATA,read,write,backup,atomic,hash,idFor,uid,now,dateCN,catalog,saveRecord,publicClean,reviewDate}from'./store.mjs';
import {importLegacy}from'../scripts/import.mjs';import {previews}from'../scripts/previews.mjs';
const port=Number(process.env.PORT||4186),token=crypto.randomBytes(24).toString('hex');let busy=false,publishProcess=null;const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.pdf':'application/pdf','.woff2':'font/woff2'};
const reply=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
async function body(req){const chunks=[];let n=0;for await(const b of req){n+=b.length;if(n>190*1024*1024){const e=new Error('文件超过 140 MB 上传限制');e.status=413;throw e;}chunks.push(b);}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}
function sendFile(req,res,file){if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end('Not found');}const size=fs.statSync(file).size;const headers={'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':(/\.(json|html)$/.test(file))?'no-cache':'public, max-age=600','Accept-Ranges':'bytes'};const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);if(range){const start=Number(range[1]),end=Math.min(Number(range[2]||size-1),size-1);if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}res.writeHead(206,{...headers,'Content-Length':end-start+1,'Content-Range':`bytes ${start}-${end}/${size}`});fs.createReadStream(file,{start,end}).pipe(res);}else{res.writeHead(200,{...headers,'Content-Length':size});fs.createReadStream(file).pipe(res);}}
function checkedPath(root,relative){const target=path.resolve(root,relative);if(!target.startsWith(root+path.sep))throw new Error('路径无效');return target;}
async function handler(req,res){try{
 const url=new URL(req.url,`http://127.0.0.1:${port}`),p=decodeURIComponent(url.pathname);const origin=req.headers.origin;const allowed=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`,'http://127.0.0.1:5173']);
 if(origin&&!allowed.has(origin))return reply(res,{error:'来源不允许'},403);
 if(!['127.0.0.1','localhost'].includes((req.headers.host||'').split(':')[0]))return reply(res,{error:'仅支持本机访问'},403);
 if(!['GET','HEAD'].includes(req.method)&&req.headers['x-growth-token']!==token)return reply(res,{error:'编辑凭证失效，请刷新页面'},403);
 if(p==='/api/health')return reply(res,{ok:true,mode:'local'});
 if(p==='/api/bootstrap'&&req.method==='GET')return reply(res,{...catalog(read()),mode:'local',token});
 if(p==='/api/search'&&req.method==='GET')return reply(res,read().records.filter(r=>!r.archived).map(r=>({id:r.id,text:[r.title,r.body,r.topic,JSON.stringify(r.details?.pageOCR||[]),...r.tags||[]].join(' ').toLowerCase()})));
 if(p==='/api/growth'&&req.method==='GET')return reply(res,{growth:read().growth,version:read().version});
 if(p==='/api/status'&&req.method==='GET'){const db=read();const statusFile=path.join(DATA,'publish-status.json');return reply(res,{publication:fs.existsSync(statusFile)?JSON.parse(fs.readFileSync(statusFile,'utf8')):db.publication,conflicts:db.conflicts,backups:fs.existsSync(path.join(DATA,'backups'))?fs.readdirSync(path.join(DATA,'backups')).filter(f=>f.endsWith('.json')).sort().reverse().slice(0,30):[],migration:db.legacyEvidence?.counts});}
 if(p.startsWith('/api/records/')&&req.method==='GET'){const r=read().records.find(r=>r.id===p.split('/').pop());return reply(res,r||{error:'记录不存在'},r?200:404);}
 if(p.startsWith('/api/sources/')&&req.method==='GET'){const s=read().sources.find(s=>s.id===p.split('/').pop());return reply(res,s?publicClean({id:s.id,pages:s.pages||[]}):{error:'资料不存在'},s?200:404);}
 if(p.startsWith('/files/')&&req.method==='GET'){const s=read().sources.find(s=>s.id===p.split('/')[2]);if(!s)return reply(res,{error:'资料不存在'},404);return sendFile(req,res,path.join(DATA,'originals',s.filename));}
 if(p.startsWith('/previews/')&&req.method==='GET')return sendFile(req,res,checkedPath(path.join(DATA,'previews'),p.slice(10)));
 if(p.startsWith('/api/')&&req.method==='POST'){
  if(busy)return reply(res,{error:'另一项保存或导入正在进行，请稍后重试。'},409);const input=await body(req);if(busy)return reply(res,{error:'另一项任务正在进行'},409);busy=true;
  try{
   let db=read();if(p==='/api/records'){const row=saveRecord(db,input.record,input.revision);write(db);return reply(res,row);}
   if(p==='/api/review'){const r=db.records.find(r=>r.id===input.id);if(!r)throw new Error('卡片不存在');if(!['忘记','模糊','掌握'].includes(input.rating))throw new Error('复习评价无效');const row=saveRecord(db,{...r,...reviewDate(input.rating,r.reviewStage||0),activationStatus:'已激活',reviewHistory:[...(r.reviewHistory||[]),{at:now(),rating:input.rating}]},input.revision);write(db);return reply(res,row);}
   if(p==='/api/growth'){if(input.version!==db.version)return reply(res,{error:'计划已更新，请刷新后重试'},409);backup(db);db.growth={...db.growth,...input.growth};write(db);return reply(res,{version:db.version});}
   if(p==='/api/backup')return reply(res,{name:backup(db)});
   if(p==='/api/restore'){if(!/^snapshot-[\w.-]+\.json$/.test(input.name||''))throw new Error('备份名称无效');const restored=JSON.parse(fs.readFileSync(path.join(DATA,'backups',input.name),'utf8'));if(restored.schemaVersion!==1||!Array.isArray(restored.records)||!Array.isArray(restored.sources))throw new Error('备份格式无效');backup(db);restored.version=db.version;write(restored);return reply(res,{ok:true});}
   if(p==='/api/import')return reply(res,await importLegacy());
   if(p==='/api/conflict'){const c=db.conflicts.find(c=>c.id===input.id);if(!c)throw new Error('冲突不存在');if(!['local','incoming'].includes(input.choice))throw new Error('请选择保留版本');backup(db);if(input.choice==='incoming'){const old=db.records.find(r=>r.id===c.recordId);db.archives.push({recordId:old.id,at:now(),record:old});db.records[db.records.indexOf(old)]={...c.incoming,revision:old.revision+1};}else{db.records.find(r=>r.id===c.recordId).importHash=c.incoming.importHash;}db.conflicts=db.conflicts.filter(x=>x.id!==c.id);write(db);return reply(res,{ok:true});}
   if(p==='/api/upload'){
    const filename=String(input.filename||'');const ext=path.extname(filename).toLowerCase();if(!['.pdf','.png','.jpg','.jpeg','.webp'].includes(ext))throw new Error('支持 PDF、PNG、JPG 和 WebP');const bytes=Buffer.from(String(input.base64||''),'base64');if(!bytes.length||bytes.length>140*1024*1024)throw new Error('文件为空或超过 140 MB');
    const valid=ext==='.pdf'?bytes.subarray(0,5).toString()==='%PDF-':ext==='.png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):['.jpg','.jpeg'].includes(ext)?bytes[0]===255&&bytes[1]===216:bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';if(!valid)throw new Error('文件内容与扩展名不符');
    const digest=hash(bytes),existing=db.sources.find(s=>s.sha256===digest);if(existing)return reply(res,{source:existing,duplicate:true});const s={id:idFor('source',digest),title:filename.slice(0,240),filename:digest+ext,sha256:digest,size:bytes.length,kind:ext==='.pdf'?'pdf':'image',subject:input.subject||'xingce',topic:input.topic||'',date:dateCN(),pageCount:1,pages:[],missing:false};atomic(path.join(DATA,'originals',s.filename),bytes);db.sources.push(s);write(db);
    try{await previews(s.id);const m=JSON.parse(fs.readFileSync(path.join(DATA,'previews',s.id,'manifest.json'),'utf8'));db=read();Object.assign(db.sources.find(x=>x.id===s.id),{pageCount:m.pages.length,previewReady:true});write(db);return reply(res,{source:db.sources.find(x=>x.id===s.id)});}catch(e){db=read();db.sources.find(x=>x.id===s.id).previewError=e.message;write(db);return reply(res,{error:'原文件已保存，预览生成失败：'+e.message,source:s},422);}
   }
   if(p==='/api/publish'){
    if(publishProcess)return reply(res,{error:'发布正在进行'},409);atomic(path.join(DATA,'publish-status.json'),{state:'发布中',step:'准备快照',startedAt:now()});publishProcess=spawn(process.execPath,[path.join(ROOT,'scripts','publish.mjs')],{cwd:ROOT,windowsHide:true,stdio:['ignore','pipe','pipe']});const logfile=fs.createWriteStream(path.join(DATA,'publish.log'),{flags:'w'});publishProcess.stdout.pipe(logfile);publishProcess.stderr.pipe(logfile);publishProcess.on('error',e=>{atomic(path.join(DATA,'publish-status.json'),{state:'发布失败',error:e.message});publishProcess=null;});publishProcess.on('close',code=>{if(code){const f=path.join(DATA,'publish-status.json');const st=JSON.parse(fs.readFileSync(f,'utf8'));if(st.state==='发布中')atomic(f,{state:'发布失败',error:`进程退出 ${code}，详见本地 publish.log`});}publishProcess=null;logfile.end();});return reply(res,{state:'发布中'});
   }
   return reply(res,{error:'接口不存在'},404);
  }finally{busy=false;}
 }
 if(p.startsWith('/api/'))return reply(res,{error:'接口不存在'},404);
 const relative=p==='/'?'index.html':p.replace(/^\//,'');return sendFile(req,res,checkedPath(path.join(ROOT,'dist'),relative));
}catch(e){if(!res.headersSent)reply(res,{error:e.message},e.status||400);else res.end();}}
http.createServer(handler).listen(port,'127.0.0.1',()=>console.log(`向内生长管理版 http://127.0.0.1:${port}`));
