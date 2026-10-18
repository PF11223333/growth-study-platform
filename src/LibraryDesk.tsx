import {useEffect,useState} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,FileText,Layers,Search,Upload} from 'lucide-react';
import type {Catalog,RecordItem} from './types';
import {subjects} from './types';
const libraryViews=new Map<string,{query:string;limit:number}>();
const mainBooks=['source-e54c6989c8057386a3fe80e9','source-9657660fd40d4a780c48fe10','source-27c9642d30115cd64d7902bc'];

export function LibraryDesk({catalog,params,navigate,onOpen,local}:{catalog:Catalog;params:URLSearchParams;navigate:(p:string,params?:Record<string,string>)=>void;onOpen:(r:RecordItem)=>void;local:boolean}){
 const tab=params.get('tab')||({article:'articles',quote:'quotes',common:'common'} as Record<string,string>)[params.get('kind')||'']||'sources',subject=params.get('subject')||'';
 const viewKey=tab+'|'+subject;
 const [query,setQuery]=useState(params.get('q')||libraryViews.get(viewKey)?.query||''),[limit,setLimit]=useState(libraryViews.get(viewKey)?.limit||24);
 useEffect(()=>{libraryViews.set(viewKey,{query,limit});},[viewKey,query,limit]);
 const tabs=[['sources','原始教材'],['articles','精读资料'],['quotes','金句表达'],['common','常识积累']];
 const match=(text:string)=>query.trim().toLowerCase().split(/\s+/).every(q=>text.toLowerCase().includes(q));
 const sources=catalog.sources.filter(s=>(!subject||s.subject===subject)&&match([s.title,s.topic].join(' '))).sort((a,b)=>(mainBooks.includes(a.id)?mainBooks.indexOf(a.id):99)-(mainBooks.includes(b.id)?mainBooks.indexOf(b.id):99));
 const kind=({articles:'article',quotes:'quote',common:'common'} as Record<string,string>)[tab];
 const rows=catalog.records.filter(r=>r.kind===kind&&(!subject||r.subject===subject)&&match([r.title,r.topic,r.excerpt].join(' '))).sort((a,b)=>b.date.localeCompare(a.date));
 const patch=(value:Record<string,string>)=>navigate('library',{tab,subject,...value});
 return <div className="library-desk"><header className="desk-heading"><div><span className="section-kicker">资料与原文</span><h1>想查什么，从这里找。</h1><p>找题去刷题库；核对讲解和笔记，在这里打开原资料。</p></div>{local&&<button className="button outline" onClick={()=>navigate('upload')}><Upload size={16}/>上传资料</button>}</header>
  <div className="library-view-tabs" role="tablist" aria-label="资料分类">{tabs.map(([id,label])=><button role="tab" aria-selected={tab===id} key={id} onClick={()=>{setLimit(24);patch({tab:id});}}>{label}<small>{id==='sources'?catalog.sources.length:catalog.records.filter(r=>r.kind===({articles:'article',quotes:'quote',common:'common'} as Record<string,string>)[id]).length}</small></button>)}</div>
  <div className="library-find"><label><Search size={18}/><input aria-label="资料内搜索" placeholder="输入教材名、标题或主题" value={query} onChange={e=>{setQuery(e.target.value);setLimit(24);}}/></label><select aria-label="资料科目" value={subject} onChange={e=>patch({subject:e.target.value})}><option value="">全部科目</option>{Object.entries(subjects).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></div>
  {tab==='sources'?<><p className="library-result-count">{sources.length} 份原始资料 · 打开后可跳页、放大和查看关联卡片</p><div className="library-source-list">{sources.map((s,i)=><button key={s.id} onClick={()=>navigate('source/'+s.id)}><span className={'library-source-icon color-'+i%3}><BookOpen size={25}/></span><span className="library-source-copy"><small>{subjects[s.subject]||'综合'} · {s.kind==='pdf'?'PDF教材':'原图'}</small><strong>{s.title}</strong><span>{s.pageCount} 页 · {s.topic||'学习资料'}{s.missing?' · 原文件待重新关联':''}</span></span><ArrowUpRight size={20}/></button>)}</div></>:<><p className="library-result-count">{rows.length} 条内容 · 按最近日期排列</p><div className="library-reading-list">{rows.slice(0,limit).map(r=><button key={r.id} onClick={()=>onOpen(r)}><FileText size={20}/><div><small>{subjects[r.subject]} · {r.date}</small><h3>{r.title}</h3><p>{r.excerpt}</p></div><ArrowRight size={17}/></button>)}</div>{rows.length>limit&&<button className="button outline load-more" onClick={()=>setLimit(limit+24)}>再看24条</button>}</>}
  {(tab==='sources'?!sources.length:!rows.length)&&<div className="empty"><Search size={30}/><h3>没有找到符合条件的资料</h3><p>试试缩短关键词，或切换到全部科目。</p></div>}
  <div className="library-related"><span><Layers size={18}/>已经整理好的知识，去卡片中心找。</span><button className="text-link" onClick={()=>navigate('cards')}>卡片与速记 <ArrowRight size={16}/></button></div>
 </div>;
}
