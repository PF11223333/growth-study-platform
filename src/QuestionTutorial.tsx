import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {BookOpen,ArrowUpRight} from 'lucide-react';
import type {RecordItem,SourceRef} from './types';

export type StudyNavigate=(path:string,params?:Record<string,string>)=>void;

export function navigateStudy(navigate:StudyNavigate,path:string,params?:Record<string,string>){
 const [route,search]=path.replace(/^#\/?/,'').split('?');
 navigate(route,{...Object.fromEntries(new URLSearchParams(search||'')),...params});
}

export function readableOption(value:unknown):value is string{
 return typeof value==='string'&&!!value.trim()&&!/选项未识别|未完整识别|文字待识别|请对照原页|请查看原页|识别失败|^待[核补确]/.test(value);
}

export function questionTeaching(record:RecordItem){
 const q=record.details?.question||{},authored=q.tutorial?.authored;
 const options=Object.entries(q.optionExplanations||{}).filter(([,note]:any)=>{
  return note&&typeof note.text==='string'&&note.text.trim()&&!/待核|待确认|未核/.test(note.status||'')&&
   !/未完整识别|教材答案[不]*包含本项|本项不符合本题条件。|独立法条与推理尚待/.test(note.text)&&
   /已核对|已逐项核对|已核验|人工核验|原创/.test(note.status||'');
 }) as [string,{text:string;status?:string;basis?:any[]}][];
 const specific=!!authored&&!/不是本题|本题逐项结论另|章节基础/.test(authored.scope||'')&&
  /本题逐项|原题逐项|题干推理与规则应用|逐项判断/.test(authored.scope||'');
 return {options,authored,precise:specific||options.length>0,specific};
}

function Text({body,onNavigate,onReference}:{body:string;onNavigate:StudyNavigate;onReference?:(ref:SourceRef)=>void}){
 return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({children,href})=>{
  if(href?.startsWith('#/'))return <a href={href} onClick={event=>{
   event.preventDefault();const [path,query]=href.slice(2).split('?'),params=new URLSearchParams(query||'');
   if(path.startsWith('source/')&&onReference)onReference({sourceId:path.slice(7),page:Number(params.get('page'))||1});
   else navigateStudy(onNavigate,path,Object.fromEntries(params));
  }}>{children}</a>;
  return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
 }}}>{body||''}</ReactMarkdown></div>;
}

export function QuestionTutorial({record,onNavigate,onReference,selectedAnswer='',showJudgment=false}:{record:RecordItem;onNavigate:StudyNavigate;onReference?:(ref:SourceRef)=>void;selectedAnswer?:string;showJudgment?:boolean}){
 const q=record.details?.question||{},t=q.tutorial||{};
 const {options,authored,precise,specific}=questionTeaching(record);
 const reference=String(q.referenceAnswer||'').replace(/[^A-D]/g,'');
 const sources=[...new Map([...(authored?.sources||[]),...options.flatMap(([,note])=>note.basis||[])].filter(s=>s?.url).map(s=>[`${s.url}|${s.article||s.articles||''}`,s])).values()];
 const originals=[...new Map((t.materials||[]).flatMap((material:any)=>material.sourceRefs||[]).filter((ref:SourceRef)=>ref.sourceId).map((ref:SourceRef)=>[`${ref.sourceId}:${ref.page}`,ref])).values()] as SourceRef[];
 const knowledgeId=record.details?.guidedLessonId||record.details?.guidedSourceAudit?.lessonId;
 const text=(body:string)=><Text body={body} onNavigate={onNavigate} onReference={onReference}/>;
 const fullBody=String(authored?.body||'');
 const leadMatch=specific?fullBody.match(/^\s*##?\s*本题怎样判断\s*\n([\s\S]*?)(?=\n##?\s|$)/):null;
 const remainder=leadMatch?fullBody.slice(leadMatch[0].length).trim():fullBody;
 return <section className="question-tutorial study-teaching" aria-label="这题怎么判断">
  <header><BookOpen size={21}/><div><span className="eyebrow">理解，再记住</span><h3>这题怎么判断</h3></div></header>
  {!precise&&<div className="study-teaching-pending"><strong>这道题的逐项讲解还未核验完成</strong><p>目前只能对照题册参考答案查看选项差异，不能据此断定你是粗心、没记住，或某条法规没掌握。</p>{knowledgeId&&<button className="button outline" onClick={()=>navigateStudy(onNavigate,'guided-review',{lesson:knowledgeId})}>学习已核对的对应知识点 <ArrowUpRight size={15}/></button>}</div>}
  {leadMatch&&<article className="study-decision">{text(leadMatch[1])}</article>}
  {!leadMatch&&precise&&q.explanation?.keyCondition&&<article className="study-decision"><strong>先抓住这个条件</strong><p>{q.explanation.keyCondition}</p></article>}
  {options.length>0&&<section className="tutorial-options study-option-explanations" aria-label="逐项解析"><h4>逐项看，为什么选、为什么不选</h4>{options.map(([letter,note])=>{
   const expected=reference.includes(letter),chosen=selectedAnswer.includes(letter);
   const label=showJudgment?expected?(chosen?'选对了':'应选，未选'):(chosen?'选了，应排除':'应排除'):'';
   return <article key={letter} className={showJudgment&&chosen!==expected?'study-option-gap':''}><div className="study-explanation-title"><b>{letter}</b><strong>{readableOption(q.options?.[letter])?q.options[letter]:`原题 ${letter} 选项`}</strong>{label&&<span>{label}</span>}</div><p>{note.text}</p>{!!note.basis?.length&&<div className="study-option-basis">{note.basis!.map((basis:any,i:number)=>basis.url?<a key={i} href={basis.url} target="_blank" rel="noreferrer">{basis.title}{basis.article?` · ${basis.article}`:''}<ArrowUpRight size={12}/></a>:<span key={i}>{basis.title}{basis.article?` · ${basis.article}`:''}</span>)}</div>}</article>;
  })}</section>}
  {options.length>0&&options.length<Object.keys(q.options||{}).length&&<p className="study-content-note">其余选项的独立推理尚未核验，暂不补写通用结论。</p>}
  {specific&&remainder&&<details className="study-deep-lesson"><summary>再讲明白一点：大白话、例子与教材原文</summary><article className="tutorial-lesson"><h4>{authored.title}</h4><p className="tutorial-provenance">{authored.origin}{authored.verifiedAt?` · 核验日期 ${authored.verifiedAt}`:''}</p>{text(remainder)}</article></details>}
  {precise&&sources.length>0&&<section className="tutorial-sources study-law-sources"><h4>对应法规与出处</h4>{sources.map((source:any,i:number)=><article key={i}><a href={source.url} target="_blank" rel="noreferrer"><strong>{source.title}{source.article||source.articles?` · ${source.article||source.articles}`:''}</strong><ArrowUpRight size={14}/></a>{source.quote&&<blockquote>{source.quote}</blockquote>}<p>{source.verification||source.note||''}{source.effective?` · 适用版本：${source.effective}`:''}</p></article>)}</section>}
  {precise&&originals.length>0&&<div className="study-original-links"><h4>教材与题本原页</h4><div className="tutorial-originals">{originals.slice(0,3).map((ref,i)=><button className="chip" key={i} onClick={()=>onReference?onReference(ref):navigateStudy(onNavigate,`source/${ref.sourceId}`,{page:String(ref.page||1)})}><BookOpen size={14}/>{ref.label||'原资料'} · PDF 第 {ref.page||1} 页</button>)}</div></div>}
  {!specific&&authored&&<details className="study-related-reading"><summary>{precise?'补充知识讲解':'关联资料，供补学时参考'} · {authored.title}</summary><p className="tutorial-provenance">{authored.origin} · {authored.scope}{authored.verifiedAt?` · 资料核验日期 ${authored.verifiedAt}`:''}</p>{text(fullBody)}{!precise&&sources.length>0&&<div className="study-option-basis">{sources.map((source:any,i:number)=><a key={i} href={source.url} target="_blank" rel="noreferrer">{source.title} · {source.article||'来源'}<ArrowUpRight size={12}/></a>)}</div>}</details>}
  {(t.materials||[]).map((material:any)=><details className="study-related-reading" key={material.id}><summary>资料卡 · {material.title}</summary><p className="tutorial-provenance">{material.provenance} · {material.verificationStatus}。沿用资料标注的核验日期。</p>{text(material.body)}<div className="tutorial-originals">{(material.sourceRefs||[]).filter((ref:SourceRef)=>ref.sourceId).map((ref:SourceRef,i:number)=><button className="chip" key={i} onClick={()=>onReference?onReference(ref):navigateStudy(onNavigate,`source/${ref.sourceId}`,{page:String(ref.page||1)})}><BookOpen size={14}/>{ref.label||'原资料'} · PDF 第 {ref.page||1} 页</button>)}</div><button className="text-link" onClick={()=>navigateStudy(onNavigate,`record/${material.id}`)}>打开完整资料卡 <ArrowUpRight size={14}/></button></details>)}
 </section>;
}
