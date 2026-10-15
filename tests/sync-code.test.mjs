import test from 'node:test';
import assert from 'node:assert/strict';
import {gitBlobSha,planCodeSync,syncCode,REPO} from '../scripts/sync-code.mjs';
const local=(name,content,mode='100644')=>{const bytes=Buffer.from(content,'utf8');return {path:name,mode,type:'blob',bytes,sha:gitBlobSha(bytes)};};
const remote=file=>({path:file.path,mode:file.mode,type:'blob',sha:file.sha});
function mockAPI(tree){const calls=[];return {calls,request(endpoint,method='GET',body){calls.push({endpoint,method,body});if(endpoint.endsWith('/git/ref/heads/main'))return {object:{sha:'head-one'}};if(endpoint.endsWith('/git/commits/head-one'))return {tree:{sha:'tree-one'}};if(endpoint.endsWith('/git/trees/tree-one?recursive=1'))return tree;if(endpoint.endsWith('/git/blobs'))return {sha:gitBlobSha(Buffer.from(body.content,'base64'))};if(endpoint.endsWith('/git/trees'))return {sha:'tree-two'};if(endpoint.endsWith('/git/commits'))return {sha:'head-two'};if(endpoint.endsWith('/git/refs/heads/main'))return {};throw new Error('Unexpected API request '+endpoint);}};}

test('Git blob SHA hashes the Git header and exact UTF-8 bytes',()=>{assert.equal(gitBlobSha(Buffer.from('hello\n')),'ce013625030ba8dba906f756967f9e9ca394464a');const file=local('中文.ts','汉字\r\n');assert.notEqual(file.sha,local('中文.ts','汉字\n').sha);});

test('unchanged tracked files perform no remote mutation and unknown files are preserved',()=>{const file=local('src/a.ts','same'),api=mockAPI({tree:[remote(file),remote(local('remote-only.txt','retain'))]});const result=syncCode({files:[file],request:api.request});assert.equal(result.changed,false);assert.ok(api.calls.every(call=>call.method==='GET'));});

test('changed Chinese text uploads base64 blobs and creates a small SHA-only tree against the existing tree',()=>{
 const unchanged=local('README.md','same'),old=local('src/a.ts','old'),changed=local('src/a.ts','新的说明\r\n'),second=local('src/b.ts','新的说明\r\n'),api=mockAPI({tree:[remote(unchanged),remote(old),remote(local('remote-only.txt','retain'))]});
 const result=syncCode({files:[unchanged,changed,second],request:api.request});assert.equal(result.changedFiles,2);assert.equal(result.uploadedBlobs,1);
 const blobs=api.calls.filter(call=>call.endpoint.endsWith('/git/blobs'));assert.equal(blobs.length,1);assert.equal(blobs[0].body.encoding,'base64');assert.deepEqual(Buffer.from(blobs[0].body.content,'base64'),changed.bytes);
 const tree=api.calls.find(call=>call.endpoint===`repos/${REPO}/git/trees`);assert.equal(tree.body.base_tree,'tree-one');assert.deepEqual(tree.body.tree.map(entry=>entry.path),['src/a.ts','src/b.ts']);assert.ok(tree.body.tree.every(entry=>!('content'in entry)&&entry.sha===changed.sha));
 const commit=api.calls.find(call=>call.endpoint.endsWith('/git/commits'));assert.deepEqual(commit.body.parents,['head-one']);assert.deepEqual(api.calls.at(-1).body,{sha:'head-two',force:false});
});

test('mode-only changes reuse existing blobs; incomplete remote inventory fails before writing',()=>{
 const old=local('script.sh','echo ready\n'),executable={...old,mode:'100755'},api=mockAPI({tree:[remote(old)]});const result=syncCode({files:[executable],request:api.request});assert.equal(result.uploadedBlobs,0);assert.equal(api.calls.find(call=>call.endpoint.endsWith('/git/trees')).body.tree[0].mode,'100755');
 assert.throws(()=>planCodeSync([old],{truncated:true,tree:[]}),/不完整/);
});

test('blob checksum mismatch and concurrent non-fast-forward errors never force an update',()=>{
 const file=local('a.txt','changed'),api=mockAPI({tree:[]});const mismatch=(endpoint,method,body)=>endpoint.endsWith('/git/blobs')?{sha:'wrong'}:api.request(endpoint,method,body);
 assert.throws(()=>syncCode({files:[file],request:mismatch}),/校验失败/);assert.equal(api.calls.some(call=>call.endpoint.endsWith('/git/trees')&&call.method==='POST'),false);
 const concurrent=mockAPI({tree:[]}),request=(endpoint,method,body)=>{const result=concurrent.request(endpoint,method,body);if(method==='PATCH')throw new Error('422 update is not a fast forward');return result;};
 assert.throws(()=>syncCode({files:[file],request}),/fast forward/);assert.equal(concurrent.calls.filter(call=>call.method==='PATCH').length,1);assert.equal(concurrent.calls.at(-1).body.force,false);
});
