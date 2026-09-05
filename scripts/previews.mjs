import {spawn} from 'node:child_process';
import {ROOT} from '../server/store.mjs';
import path from 'node:path';
export function previews(sourceId){return new Promise((resolve,reject)=>{const p=spawn(process.env.GROWTH_PYTHON||'C:/Users/xiong/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-I',path.join(ROOT,'scripts','render.py'),...(sourceId?[sourceId]:[])],{cwd:ROOT,windowsHide:true,stdio:'inherit'});p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error(`资料预览失败：${c}`)));});}
if(process.argv[1]?.endsWith('previews.mjs'))await previews(process.argv[2]);
