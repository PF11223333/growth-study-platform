import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,Bookmark,CalendarDays,CheckCircle2,ExternalLink,Layers,LoaderCircle,RefreshCw,Search,Sparkles} from 'lucide-react';
import type {Catalog,RecordItem} from './types';
import {getJSON} from './api';
import './shenlun-desk.css';

type Manifest={latestDate:string;dayCount:number;articleCount:number;expressionCount:number;authorityCount:number;sourceDigest:string;features:string[]};
type Props={catalog:Catalog;params:URLSearchParams;navigate:(path:string,params?:Record<string,string>)=>void;onOpen:(record:RecordItem)=>void;onSync?:()=>Promise<void>};
const tabs=[['articles','精读好文'],['quotes','金句表达'],['authority','权威论述'],['daily','每日积累'],['complete','完整素材库'],['memory','背诵模式']];
const excludedTags=new Set(['精读','每日积累','原创表达','权威论述','开头句','分论点句','过渡句','对策句','结尾句']);
const savedViews=new Map<string,{query:string;date:string;topic:string;police:boolean;limit:number}>();

export function ShenlunDesk({catalog,params,navigate,onOpen,onSync}:Props){
 const view=tabs.some(([id])=>id===params.get('view'))?params.get('view')!:'articles';
 const [manifest,setManifest]=useState<Manifest|null>(null),[manifestError,setManifestError]=useState('');
 const saved=savedViews.get(view);
 const [query,setQuery]=useState(params.get('q')||saved?.query||''),[date,setDate]=useState(params.get('date')||saved?.date||''),[topic,setTopic]=useState(params.get('topic')||saved?.topic||''),[police,setPolice]=useState(saved?.police||false),[limit,setLimit]=useState(saved?.limit||18);
 const [syncing,setSyncing]=useState(false),[syncMessage,setSyncMessage]=useState(''),[frameLoaded,setFrameLoaded]=useState(false);
 useEffect(()=>{let active=true;getJSON('./shenlun/manifest.json').then(data=>{if(active)setManifest(data);}).catch(()=>{if(active)setManifestError('同步信息暂时未能读取，仍可查看已收录资料。');});return()=>{active=false;};},[catalog.version]);
 useEffect(()=>{const prior=savedViews.get(view);setQuery(params.get('q')||prior?.query||'');setDate(params.get('date')||prior?.date||'');setTopic(params.get('topic')||prior?.topic||'');setPolice(prior?.police||false);setLimit(prior?.limit||18);setFrameLoaded(false);},[params.toString()]);
 useEffect(()=>{savedViews.set(view,{query,date,topic,police,limit});},[view,query,date,topic,police,limit]);
 const records=useMemo(()=>catalog.records.filter(r=>r.subject==='shenlun'&&['article','quote'].includes(r.kind)),[catalog.records]);
 const days=useMemo(()=>records.filter(r=>r.topic==='每日精读').sort((a,b)=>b.date.localeCompare(a.date)),[records]);
 const latest=days[0],latestDate=manifest?.latestDate||latest?.date||'';
 const allTopics=useMemo(()=>{const counts=new Map<string,number>();for(const r of records)for(const tag of r.tags||[])if(!excludedTags.has(tag)&&!(/^[GQ]\d+$/.test(tag))&&tag.length<24)counts.set(tag,(counts.get(tag)||0)+1);return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh-CN')).slice(0,100).map(([name])=>name);},[records]);
 const typeRows=records.filter(r=>view==='daily'?r.topic==='每日精读':view==='authority'?r.kind==='quote'&&r.tags.includes('权威论述'):view==='quotes'?r.kind==='quote'&&!r.tags.includes('权威论述'):r.kind==='article'&&r.topic!=='每日精读');
 const tokens=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const rows=typeRows.filter(r=>(!date||r.date===date)&&(!topic||r.tags.includes(topic))&&(!police||[r.title,...r.tags].join(' ').includes('公安'))&&tokens.every(token=>[r.title,r.excerpt,r.topic,...r.tags].join(' ').toLocaleLowerCase().includes(token))).sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title,'zh-CN'));
 const move=(next:string)=>navigate('shenlun',{view:next,...(query?{q:query}:{}),...(date?{date}:{}),...(topic?{topic}:{})});
 const frame=view==='complete'?'index.html':'today.html',embedded=view==='complete'||view==='memory';
 const clear=()=>{setQuery('');setDate('');setTopic('');setPolice(false);setLimit(18);};
 async function sync(){if(!onSync)return;setSyncing(true);setSyncMessage('');try{await onSync();setSyncMessage('已检查旧申论站，并同步最新可用内容。');}catch(error){setSyncMessage(error instanceof Error?error.message:'同步失败，请稍后重试。');}finally{setSyncing(false);}}
 return <div className="shenlun-desk">
  <header className="shenlun-heading"><div><span className="section-kicker">申论 · 读、背、用</span><h1>读懂一篇，记牢一句，写出一段。</h1><p>从今日精读到可迁移表达，把积累真正用在答题里。</p></div>{onSync&&<button className="button outline" onClick={sync} disabled={syncing}><RefreshCw size={16} className={syncing?'spin':''}/>{syncing?'正在同步':'检查申论更新'}</button>}</header>
  <div className="shenlun-update"><span><CheckCircle2 size={16}/>最新资料 {latestDate||'尚未同步'}{manifest?` · 已收录 ${manifest.dayCount} 期`:''}</span><small>日期以旧站实际内容为准</small></div>
  {(syncMessage||manifestError)&&<p role="status" className="shenlun-notice">{syncMessage||manifestError}</p>}
  <section className="shenlun-starts" aria-label="申论学习入口">
   <button className="shenlun-start featured" onClick={()=>latest?onOpen(latest):move('daily')}><BookOpen size={24}/><span><small>01 · 读懂</small><strong>开始最新一期精读</strong><p>原文出处、要点、使用边界与迁移示范</p></span><ArrowUpRight size={21}/></button>
   <button className="shenlun-start" onClick={()=>move('memory')}><Bookmark size={24}/><span><small>02 · 记牢</small><strong>遮住答案，主动回忆</strong><p>标题、表达、古文、案例与权威论述</p></span><ArrowUpRight size={21}/></button>
   <button className="shenlun-start" onClick={()=>navigate('vocabulary')}><Sparkles size={24}/><span><small>03 · 会用</small><strong>305词与搭配训练</strong><p>原表标注300词 · 打乱练习，连起词语与语境</p></span><ArrowUpRight size={21}/></button>
  </section>
  <nav className="shenlun-tabs" aria-label="申论资料分类">{tabs.map(([key,label])=><button key={key} aria-current={view===key?'page':undefined} onClick={()=>move(key)}>{label}</button>)}</nav>
  {embedded?<section className="shenlun-embedded">
   <div className="shenlun-frame-heading"><div><h2>{view==='complete'?'熟悉的完整素材库':'今日背诵 · 先回忆，再揭晓'}</h2><p>{view==='complete'?'保留全文搜索、四类索引、收藏、学习笔记与记录导入导出。':'切换日期、背诵模式与完成标记，沿用原站的学习方式。'}</p></div><a className="button primary" href={`./shenlun/${frame}`}><ExternalLink size={16}/>全屏学习</a></div>
   <p className="shenlun-device-note">学习记录保存在当前浏览器。旧站的笔记与收藏可先导出，再到这里的“完整素材库”导入。</p>
   <div className="shenlun-frame-wrap">{!frameLoaded&&<div className="shenlun-frame-loading" role="status"><LoaderCircle className="spin" size={24}/><span>正在打开{view==='complete'?'完整素材库':'背诵资料'}…首次加载稍多，之后可继续学习。</span></div>}<iframe key={frame} title={view==='complete'?'申论完整素材库':'申论手机背诵'} src={`./shenlun/${frame}?v=${encodeURIComponent(manifest?.sourceDigest||String(catalog.version))}`} onLoad={()=>setFrameLoaded(true)}/></div>
  </section>:<>
   <div className="shenlun-filters"><label className="shenlun-search"><Search size={18}/><input type="search" value={query} aria-label="搜索申论标题主题和金句" placeholder="搜标题、主题、金句或编号，如 G1011" onChange={e=>{setQuery(e.target.value);setLimit(18);}}/></label><label><CalendarDays size={16}/><select aria-label="申论积累日期" value={date} onChange={e=>{setDate(e.target.value);setLimit(18);}}><option value="">所有日期</option>{days.map(r=><option key={r.id} value={r.date}>{r.date}</option>)}</select></label><label><Layers size={16}/><select aria-label="申论主题" value={topic} onChange={e=>{setTopic(e.target.value);setLimit(18);}}><option value="">所有主题</option>{allTopics.map(name=><option key={name}>{name}</option>)}</select></label></div>
   <div className="shenlun-results-meta"><span>{rows.length} 条内容 · 最近更新在前</span><label><input type="checkbox" checked={police} onChange={e=>{setPolice(e.target.checked);setLimit(18);}}/>公安岗重点</label><button className="text-link" onClick={()=>move('complete')}>需要全文检索？打开完整素材库 <ArrowRight size={15}/></button></div>
   <div className={'shenlun-results '+(view==='quotes'?'quote-view':'')}>{rows.slice(0,limit).map(r=><button key={r.id} className="shenlun-result" onClick={()=>onOpen(r)}><div className="shenlun-result-body"><small>{r.date} · {view==='authority'?'权威论述':view==='quotes'?'原创表达':view==='daily'?'每日积累':'精读好文'}</small><h3>{r.title}</h3><p>{r.excerpt?.replace(/\*\*/g,'')}</p><div className="shenlun-tags">{r.tags.filter(t=>!excludedTags.has(t)&&!(/^[GQ]\d+$/.test(t))).slice(0,3).map(tag=><span key={tag}>{tag}</span>)}{r.sourceRefs.length>0&&<span>{r.sourceRefs.length} 个来源入口</span>}</div></div><ArrowRight size={18}/></button>)}</div>
   {!rows.length&&<div className="empty"><Search size={28}/><h3>这组条件下没有资料</h3><p>换一个关键词，或先看全部内容。</p><button className="button outline" onClick={clear}>清除筛选</button></div>}
   {rows.length>limit&&<button className="button outline load-more" onClick={()=>setLimit(value=>value+18)}>再看 18 条</button>}
  </>}
 </div>;
}
export default ShenlunDesk;
