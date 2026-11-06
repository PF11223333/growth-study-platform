import {useEffect,useMemo,useState} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,Bookmark,CalendarDays,Check,Clock3,ExternalLink,Layers,LoaderCircle,PenLine,RefreshCw,Search,Sparkles,X} from 'lucide-react';
import type {Catalog,RecordItem} from './types';
import {getJSON} from './api';
import {SHENLUN_PERSONAL_KEY,SHENLUN_VIEW_KEY,readShenlunPersonal,readShenlunView,updateShenlunPersonal,shenlunExcerpt} from './shenlun-state.mjs';
import type {ShenlunView as ViewState} from './shenlun-state.mjs';
import './shenlun-desk.css';
type Manifest={latestDate:string;dayCount:number;articleCount:number;expressionCount:number;authorityCount:number;sourceDigest:string;features:string[]};
type Props={catalog:Catalog;params:URLSearchParams;navigate:(path:string,params?:Record<string,string>)=>void;onOpen:(record:RecordItem)=>void;onSync?:()=>Promise<void>};
const tabs=[['articles','精读好文'],['quotes','金句表达'],['authority','权威论述'],['daily','每日积累'],['favorites','我的收藏'],['complete','完整素材库'],['memory','背诵模式']];
const excludedTags=new Set(['精读','每日积累','原创表达','权威论述','开头句','分论点句','过渡句','对策句','结尾句']);
const label=(r:RecordItem)=>r.topic==='每日精读'?'每日积累':r.kind==='article'?'精读好文':r.tags.includes('权威论述')?'权威论述':'金句表达';
function safeView(view:string,params:URLSearchParams){try{return readShenlunView(sessionStorage.getItem(SHENLUN_VIEW_KEY),view,params)}catch{return readShenlunView(null,view,params)}}
function bootPersonal(){try{return{state:readShenlunPersonal(localStorage.getItem(SHENLUN_PERSONAL_KEY)),error:''}}catch{return{state:readShenlunPersonal(null),error:'收藏记录暂时无法读取，原记录未被覆盖。你仍可以阅读全部资料。'}}}
export function ShenlunDesk(props:Props){const view=tabs.some(([id])=>id===props.params.get('view'))?props.params.get('view')!:'articles';return <ShenlunView key={view+'?'+props.params.toString()} {...props} view={view}/>;}
function ShenlunView({catalog,params,navigate,onOpen,onSync,view}:Props&{view:string}){
 const [manifest,setManifest]=useState<Manifest|null>(null),[manifestError,setManifestError]=useState('');
 const [filters,setFilters]=useState(()=>safeView(view,params)),[personalBoot]=useState(bootPersonal),[personal,setPersonal]=useState(personalBoot.state),[personalError,setPersonalError]=useState(personalBoot.error);
 const {query,date,topic,police,limit}=filters;
 const [syncing,setSyncing]=useState(false),[syncMessage,setSyncMessage]=useState(''),[frameLoaded,setFrameLoaded]=useState(false),[frameAttempt,setFrameAttempt]=useState(0);
 useEffect(()=>{let active=true;getJSON('./shenlun/manifest.json').then(data=>{if(active){setManifest(data);setManifestError('')}}).catch(()=>{if(active)setManifestError('同步信息暂时未能读取，仍可查看已收录资料。')});return()=>{active=false}},[catalog.version]);
 useEffect(()=>{const change=(e:StorageEvent)=>{if(e.key===SHENLUN_PERSONAL_KEY){try{setPersonal(readShenlunPersonal(e.newValue));setPersonalError('')}catch{setPersonalError('另一个页面的收藏数据无法读取，当前显示保留。')}}};window.addEventListener('storage',change);return()=>window.removeEventListener('storage',change)},[]);
 const patch=(values:Partial<ViewState>)=>{const next={...filters,limit:18,...values};setFilters(next);try{let views;try{views=JSON.parse(sessionStorage.getItem(SHENLUN_VIEW_KEY)||'{}')}catch{views={}};sessionStorage.setItem(SHENLUN_VIEW_KEY,JSON.stringify({...views,[view]:{...next,route:params.toString()}}));}catch{}};
 const remember=(action:'favorite'|'read',id:string)=>{try{const next=updateShenlunPersonal(readShenlunPersonal(localStorage.getItem(SHENLUN_PERSONAL_KEY)),action,id);localStorage.setItem(SHENLUN_PERSONAL_KEY,JSON.stringify(next));setPersonal(next);setPersonalError('')}catch{setPersonalError('收藏或阅读位置未能保存到设备，原记录未覆盖。')}};
 const open=(r:RecordItem)=>{remember('read',r.id);patch({limit});onOpen(r)};
 const records=useMemo(()=>catalog.records.filter(r=>r.subject==='shenlun'&&['article','quote'].includes(r.kind)),[catalog.records]);
 const days=useMemo(()=>records.filter(r=>r.topic==='每日精读').sort((a,b)=>b.date.localeCompare(a.date)),[records]);
 const latest=days[0],latestDate=manifest?.latestDate||latest?.date||'';
 const recent=personal.recent.map(id=>records.find(r=>r.id===id)).filter(Boolean) as RecordItem[],favorites=new Set(personal.favorites);
 const allTopics=useMemo(()=>{const counts=new Map<string,number>();for(const r of records)for(const tag of r.tags||[])if(!excludedTags.has(tag)&&!(/^[GQ]\d+$/.test(tag))&&tag.length<24)counts.set(tag,(counts.get(tag)||0)+1);return [...counts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh-CN')).slice(0,100).map(([name])=>name)},[records]);
 const typeRows=records.filter(r=>view==='favorites'?favorites.has(r.id):view==='daily'?r.topic==='每日精读':view==='authority'?r.kind==='quote'&&r.tags.includes('权威论述'):view==='quotes'?r.kind==='quote'&&!r.tags.includes('权威论述'):r.kind==='article'&&r.topic!=='每日精读');
 const tokens=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
 const rows=typeRows.filter(r=>(!date||r.date===date)&&(!topic||r.tags.includes(topic))&&(!police||[r.title,...r.tags].join(' ').includes('公安'))&&tokens.every(token=>[r.title,r.excerpt,r.topic,...r.tags].join(' ').toLocaleLowerCase().includes(token))).sort((a,b)=>b.date.localeCompare(a.date)||a.title.localeCompare(b.title,'zh-CN'));
 const move=(next:string)=>{patch({limit});navigate('shenlun',{view:next})};
 const frame=view==='complete'?'index.html':'today.html',embedded=view==='complete'||view==='memory',hasFilters=!!(query||date||topic||police);
 const clear=()=>patch({query:'',date:'',topic:'',police:false});
 async function sync(){if(!onSync)return;setSyncing(true);setSyncMessage('');try{await onSync();setSyncMessage('已检查旧申论站，并同步最新可用内容。')}catch(error){setSyncMessage(error instanceof Error?error.message:'同步失败，请稍后重试。')}finally{setSyncing(false)}}
 return <div className="shenlun-desk">
  <header className="shenlun-heading"><div><span className="section-kicker">申论 · 阅读与表达</span><h1>把积累，写进答案里。</h1><p>读懂一篇，记牢一句，写好一段。</p></div><div className="shenlun-heading-meta"><span><i/>最近更新 <b>{latestDate||'尚未同步'}</b></span>{manifest&&<small>{manifest.dayCount}期积累 · 原文与练习相连</small>}{onSync&&<button className="text-link" onClick={sync} disabled={syncing}><RefreshCw size={13} className={syncing?'spin':''}/>{syncing?'正在同步':'检查更新'}</button>}</div></header>
  {(syncMessage||manifestError||personalError)&&<p role="status" className="shenlun-notice">{syncMessage||manifestError||personalError}</p>}
  <section className="shenlun-starts" aria-label="申论学习入口">
   <button className="shenlun-start featured" onClick={()=>recent[0]?open(recent[0]):latest?open(latest):move('daily')}><span className="shenlun-start-icon"><BookOpen size={22}/></span><span><small>{recent[0]?'接着上次读':'今日一篇'}</small><strong>{recent[0]?'继续阅读':'开始最新精读'}</strong><p>{recent[0]?.title||'原文、要点与迁移示范'}</p></span><ArrowUpRight size={18}/></button>
   <button className="shenlun-start" onClick={()=>move('memory')}><span className="shenlun-start-icon"><Bookmark size={22}/></span><span><small>先想再看</small><strong>遮住答案背诵</strong><p>表达、案例与权威论述</p></span><ArrowUpRight size={18}/></button>
   <button className="shenlun-start" onClick={()=>navigate('vocabulary')}><span className="shenlun-start-icon"><Sparkles size={22}/></span><span><small>连起语境</small><strong>词语搭配训练</strong><p>305条用法，打乱练熟</p></span><ArrowUpRight size={18}/></button>
   <button className="shenlun-start writing" onClick={()=>navigate('writing')}><span className="shenlun-start-icon"><PenLine size={22}/></span><span><small>从积累到落笔</small><strong>写一稿，改一稿</strong><p>材料 · 格纸 · 限时 · 复盘</p></span><ArrowUpRight size={18}/></button>
  </section>
  <div className="shenlun-shelf-heading"><div><span className="section-kicker">我的申论书架</span><h2>{tabs.find(([id])=>id===view)?.[1]}</h2></div><div className="shenlun-shelf-tools"><button className="text-link" onClick={()=>move('favorites')}><Bookmark size={14}/>{personal.favorites.filter(id=>records.some(r=>r.id===id)).length}条收藏</button>{recent.length>0&&<details className="shenlun-recent"><summary><Clock3 size={14}/>最近阅读</summary><div>{recent.slice(0,6).map(r=><button key={r.id} onClick={()=>open(r)}><small>{label(r)}</small><span>{r.title}</span><ArrowRight size={13}/></button>)}</div></details>}</div></div>
  <nav className="shenlun-tabs" aria-label="申论资料分类">{tabs.map(([key,name])=><button key={key} aria-current={view===key?'page':undefined} onClick={()=>move(key)}>{name}{key==='favorites'&&<Bookmark size={12}/>}</button>)}</nav>
  {embedded?<section className="shenlun-embedded">
   <div className="shenlun-frame-heading"><div><h2>{view==='complete'?'熟悉的完整素材库':'先回忆，再揭晓'}</h2><p>{view==='complete'?'全文搜索、四类索引、旧站收藏与笔记，都在这里。':'切换日期、背诵模式和完成标记，延续原站的学习方式。'}</p></div><a className="button primary" href={`./shenlun/${frame}`}><ExternalLink size={16}/>全屏学习</a></div>
   <p className="shenlun-device-note">书架收藏与旧站收藏分别保留在当前浏览器。旧站笔记可在完整素材库导入导出。</p>
   <div className="shenlun-frame-wrap">{!frameLoaded&&<div className="shenlun-frame-loading" role="status"><LoaderCircle className="spin" size={24}/><span>正在打开学习资料…<small>首次载入稍多，也可使用上方“全屏学习”。</small></span><button className="text-link" onClick={()=>setFrameAttempt(v=>v+1)}>重新加载</button></div>}<iframe key={frame+frameAttempt} title={view==='complete'?'申论完整素材库':'申论手机背诵'} src={`./shenlun/${frame}?v=${encodeURIComponent(manifest?.sourceDigest||String(catalog.version))}&retry=${frameAttempt}`} onLoad={()=>setFrameLoaded(true)}/></div>
  </section>:<>
   <div className="shenlun-filters"><label className="shenlun-search"><Search size={18}/><input type="search" value={query} aria-label="搜索申论标题主题和金句" placeholder="搜主题、金句或编号，如 基层治理、G1041" onChange={e=>patch({query:e.target.value})}/>{query&&<button className="icon-button" aria-label="清除申论搜索" onClick={()=>patch({query:''})}><X size={14}/></button>}</label><label><CalendarDays size={16}/><select aria-label="申论积累日期" value={date} onChange={e=>patch({date:e.target.value})}><option value="">全部日期</option>{days.map(r=><option key={r.id} value={r.date}>{r.date}</option>)}</select></label><label><Layers size={16}/><select aria-label="申论主题" value={topic} onChange={e=>patch({topic:e.target.value})}><option value="">全部主题</option>{allTopics.map(name=><option key={name}>{name}</option>)}</select></label></div>
   <div className="shenlun-results-meta"><span>找到 <b>{rows.length}</b> 条{hasFilters?' · 已筛选':' · 最近更新在前'}</span><label><input type="checkbox" checked={police} onChange={e=>patch({police:e.target.checked})}/>公安岗重点</label>{hasFilters&&<button className="text-link" onClick={clear}><X size={13}/>清除筛选</button>}<button className="text-link shenlun-full-search" onClick={()=>move('complete')}>全文检索 <ArrowRight size={13}/></button></div>
   {view==='favorites'&&<p className="shenlun-local-note">收藏保存在当前设备的浏览器；点卡片右上角书签即可添加或移除。</p>}
   <div className={'shenlun-results '+(view==='quotes'?'quote-view':'')}>{rows.slice(0,limit).map(r=><article key={r.id} className="shenlun-result"><div className="shenlun-result-top"><small>{r.date} <span>· {label(r)}</span></small><button className={'shenlun-save '+(favorites.has(r.id)?'is-saved':'')} aria-label={`${favorites.has(r.id)?'取消收藏':'收藏'}：${r.title}`} aria-pressed={favorites.has(r.id)} onClick={()=>remember('favorite',r.id)}><Bookmark size={17} fill={favorites.has(r.id)?'currentColor':'none'}/></button></div><button className="shenlun-result-open" onClick={()=>open(r)}><h3>{r.title}</h3><p>{shenlunExcerpt(r)}</p><footer><span className="shenlun-tags">{r.tags.filter(t=>!excludedTags.has(t)&&!(/^[GQ]\d+$/.test(t))).slice(0,2).map(tag=><span key={tag}>{tag}</span>)}</span><span className="shenlun-read-label">{personal.recent.includes(r.id)?<><Check size={12}/>读过</>:'阅读'}<ArrowRight size={15}/></span></footer></button></article>)}</div>
   {!rows.length&&<div className="empty"><Bookmark size={28}/><h3>{view==='favorites'&&!hasFilters?'把想用的表达，留在这里':'这组条件下没有资料'}</h3><p>{view==='favorites'&&!hasFilters?'阅读列表里点一下书签，下一次就能迅速找到。':'换一个关键词，或先看全部内容。'}</p><button className="button outline" onClick={hasFilters?clear:()=>move('articles')}>{hasFilters?'清除筛选':'去看精读好文'}</button></div>}
   {rows.length>limit&&<button className="button outline load-more" onClick={()=>patch({limit:limit+18})}>再看18条 <span>已显示{Math.min(limit,rows.length)} / {rows.length}</span></button>}
  </>}
 </div>;
}
export default ShenlunDesk;
