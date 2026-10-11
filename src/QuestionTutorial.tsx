import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {BookOpen,ArrowUpRight} from 'lucide-react';
import type {RecordItem,SourceRef} from './types';
function Text({body}:{body:string}){return <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({children,href})=><a href={href} target="_blank" rel="noreferrer">{children}</a>}}>{body}</ReactMarkdown></div>;}
export function QuestionTutorial({record,onNavigate,onReference}:{record:RecordItem;onNavigate:(p:string)=>void;onReference?:(ref:SourceRef)=>void}){
 const q=record.details?.question,t=q?.tutorial;if(!t)return null;
 const realOptions=Object.entries(q.optionExplanations||{}).filter(([,n]:any)=>!n.status?.includes('待核验')&&!n.text?.includes('未完整识别')&&!n.text?.includes('本项不符合本题条件。'));
 return <section className="question-tutorial" aria-label="教学讲解与资料教程">
  <header><BookOpen size={22}/><div><span className="eyebrow">READ / UNDERSTAND / APPLY</span><h3>教学讲解与资料教程</h3></div></header>
  {t.authored&&<article className="tutorial-lesson"><h4>{t.authored.title}</h4><p className="tutorial-provenance">{t.authored.origin} · {t.authored.scope}{t.authored.verifiedAt?` · 核对于 ${t.authored.verifiedAt}`:''}</p><Text body={t.authored.body}/></article>}
  {realOptions.length>0&&<section className="tutorial-options"><h4>逐项讲清楚</h4>{realOptions.map(([letter,n]:any)=><article key={letter}><strong>{letter} · {q.options?.[letter]||'原选项'}</strong><p>{n.text}</p><small>{n.status}</small></article>)}</section>}
  {t.authored?.sources?.length>0&&<section className="tutorial-sources"><h4>法条与教学依据</h4>{t.authored.sources.map((s:any,i:number)=><a key={i} href={s.url} target="_blank" rel="noreferrer"><strong>{s.title} · {s.article||'来源'}</strong><small>{s.verification}</small><ArrowUpRight size={14}/></a>)}</section>}
  {t.materials?.map((m:any)=><article className="tutorial-material" key={m.id}><div className="tutorial-material-heading"><h4>已有资料教程 · {m.title}</h4><button className="text-link" onClick={()=>onNavigate(`record/${m.id}`)}>打开完整卡片 <ArrowUpRight size={14}/></button></div><p className="tutorial-provenance">{m.provenance} · {m.verificationStatus}。保留资料原核验状态和日期，未作本次全文重新核验；编写示例、人工笔记和扫描原文按原标注区分。</p><Text body={m.body}/><div className="tutorial-originals">{m.sourceRefs.filter((s:SourceRef)=>s.sourceId).map((s:SourceRef,i:number)=><button className="chip" key={i} onClick={()=>onReference?onReference(s):onNavigate(`source/${s.sourceId}?page=${s.page||1}`)}><BookOpen size={14}/>{s.label||'原资料'} · PDF第{s.page||1}页</button>)}</div></article>)}
  {!t.authored&&!t.materials?.length&&<p className="muted">这道题尚未找到可核实的教学资料，暂不提供编造的解析。</p>}
 </section>;
}
