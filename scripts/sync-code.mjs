import fs from'node:fs';import path from'node:path';import crypto from'node:crypto';import{fileURLToPath}from'node:url';import{spawnSync}from'node:child_process';import{ROOT}from'../server/store.mjs';
export const REPO='PF11223333/growth-study-platform';
export function github(endpoint,method='GET',body){for(let attempt=0;;attempt++){const p=spawnSync('gh',['api',endpoint,...method!=='GET'?['--method',method]:[],...body?['--input','-']:[]],{cwd:ROOT,windowsHide:true,encoding:'utf8',input:body?JSON.stringify(body):undefined,maxBuffer:20*1024*1024});if(p.status===0)return p.stdout.trim()?JSON.parse(p.stdout):{};const message=p.stderr||p.stdout;if(attempt>=3||!/EOF|reset|timeout|TLS|502|503|504|connect/i.test(message))throw new Error(message);Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1500*(attempt+1));}}
export function gitBlobSha(bytes){return crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`,'utf8')).update(bytes).digest('hex');}
export function trackedTextFiles(root=ROOT){
 const listed=spawnSync('git',['ls-files','--stage','-z'],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024});
 if(listed.status!==0)throw new Error('无法读取待同步源码：'+(listed.stderr||listed.error?.message||''));
 return listed.stdout.split('\0').filter(Boolean).map(row=>{
  const match=row.match(/^(\d+) [a-f0-9]+ (\d)\t([\s\S]+)$/);if(!match||match[2]!=='0')throw new Error('源码存在未解决的合并状态');
  const [,mode,,file]=match,target=path.resolve(root,file);
  if(/^(?:data|dist|tmp|output|node_modules|\.playwright-cli)\//.test(file)||!target.startsWith(path.resolve(root)+path.sep))throw new Error('源码发布目录不合法：'+file);
  if(!['100644','100755'].includes(mode))throw new Error('源码同步仅允许普通文本文件：'+file);
  const bytes=fs.readFileSync(target),content=bytes.toString('utf8');if(!Buffer.from(content,'utf8').equals(bytes)||content.includes('\0'))throw new Error('源码同步仅允许 UTF-8 文本：'+file);
  return {path:file,mode,type:'blob',bytes,sha:gitBlobSha(bytes)};
 });
}
export function planCodeSync(files,current){
 if(current.truncated)throw new Error('GitHub 源码目录返回不完整，停止同步以保护远端文件');
 const remote=new Map((current.tree||[]).map(entry=>[entry.path,entry])),existingBlobs=new Set((current.tree||[]).filter(entry=>entry.type==='blob').map(entry=>entry.sha));
 const changes=files.filter(file=>{const old=remote.get(file.path);return !old||old.type!=='blob'||old.sha!==file.sha||old.mode!==file.mode;});
 return {changes,existingBlobs};
}
export function syncCode({request=github,root=ROOT,files}={}){
 const local=files||trackedTextFiles(root);
 let ref;try{ref=request(`repos/${REPO}/git/ref/heads/main`);}catch(e){if(!/404|409|empty/i.test(e.message))throw e;request(`repos/${REPO}/contents/README.md`,'PUT',{message:'Initialize study platform',content:fs.readFileSync(path.join(root,'README.md')).toString('base64'),branch:'main'});ref=request(`repos/${REPO}/git/ref/heads/main`);}
 const commit=request(`repos/${REPO}/git/commits/${ref.object.sha}`),current=request(`repos/${REPO}/git/trees/${commit.tree.sha}?recursive=1`),{changes,existingBlobs}=planCodeSync(local,current);
 if(!changes.length)return {changed:false,sha:ref.object.sha,changedFiles:0,uploadedBlobs:0};
 const entries=[];let uploadedBlobs=0;
 for(const file of changes){
  if(!existingBlobs.has(file.sha)){const blob=request(`repos/${REPO}/git/blobs`,'POST',{content:file.bytes.toString('base64'),encoding:'base64'});if(blob.sha!==file.sha)throw new Error('GitHub 源码内容校验失败：'+file.path);existingBlobs.add(blob.sha);uploadedBlobs++;}
  entries.push({path:file.path,mode:file.mode,type:'blob',sha:file.sha});
 }
 // Apply only changed paths to the remote tree; unknown remote files are retained.
 const tree=request(`repos/${REPO}/git/trees`,'POST',{base_tree:commit.tree.sha,tree:entries});
 if(tree.sha===commit.tree.sha)return {changed:false,sha:ref.object.sha,changedFiles:changes.length,uploadedBlobs};
 const next=request(`repos/${REPO}/git/commits`,'POST',{message:'Update integrated learning platform',tree:tree.sha,parents:[ref.object.sha]});
 request(`repos/${REPO}/git/refs/heads/main`,'PATCH',{sha:next.sha,force:false});
 return {changed:true,sha:next.sha,changedFiles:changes.length,uploadedBlobs};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(syncCode()));
