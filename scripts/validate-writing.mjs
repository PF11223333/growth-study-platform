import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT,read} from '../server/store.mjs';
export function validateWritingGuide(g,db){
 const fail=message=>{throw new Error('写作资料：'+message);};
 if(g.schemaVersion!==1||!Array.isArray(g.profiles)||!Array.isArray(g.tasks)||!Array.isArray(g.lessons)||!Array.isArray(g.sources))fail('格式无效');
 const unique=(rows,name)=>{const ids=new Set();for(const r of rows){if(!r.id||ids.has(r.id))fail(name+'编号为空或重复');ids.add(r.id);}return ids;};
 const profiles=unique(g.profiles,'考试'),sources=unique(g.sources,'依据'),tasks=unique(g.tasks,'题目');unique(g.lessons,'方法');
 const refs=ids=>{for(const id of ids||[])if(!sources.has(id))fail('引用缺失 '+id);};
 for(const s of g.sources){if(!/^(?:https?:\/\/|\.\/references\/writing\/[\w-]+\.(?:pdf|docx)$)/.test(s.url)||!s.publisher||!s.checkedAt)fail('来源不完整 '+s.id);if(s.url.startsWith('./')&&!fs.existsSync(path.join(ROOT,'public',s.url)))fail('下载附件缺失 '+s.id);}
 for(const p of g.profiles){if(!p.label||!p.scope)fail('考试说明缺失');refs(p.sourceIds);for(const id of p.taskIds||[])if(!tasks.has(id))fail('考试题目缺失 '+id);}
 for(const t of g.tasks){if(!t.title||!t.prompt||!t.materials?.length||!t.requirements?.length||!t.selfCheck?.length||!t.outline||!t.sampleAnswer)fail('题目内容缺失 '+t.id);if(!t.profileIds?.length||t.profileIds.some(id=>!profiles.has(id)))fail('考试关联缺失 '+t.id);if(!(t.wordLimit?.max>0)||t.wordLimit.min>t.wordLimit.max)fail('字数范围无效');refs(t.sourceIds);for(const m of t.materials){if(!m.text||!m.provenance)fail('材料正文或来源标识缺失 '+t.id);refs(m.sourceIds);}for(const r of t.sourceRefs||[]){const s=db?.sources.find(s=>s.id===r.sourceId);if(db&&(!s||!Number.isInteger(r.page)||r.page<1||r.page>s.pageCount))fail('原页定位无效 '+t.id);}}
 for(const l of g.lessons){if(!l.title||!l.summary||!l.steps||!l.example||!l.counterExample||!l.provenance)fail('方法讲解不完整 '+l.id);refs(l.sourceIds);}
 return {profiles:g.profiles.length,tasks:g.tasks.length,lessons:g.lessons.length,sources:g.sources.length};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(validateWritingGuide(JSON.parse(fs.readFileSync(path.join(ROOT,'public','writing-guide.json'),'utf8')),read())));
