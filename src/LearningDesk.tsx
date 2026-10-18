import {ArrowRight,ArrowUpRight,BookOpen,Calculator,Check,Compass,FileText,Layers,Leaf,PenLine,RefreshCw,Shuffle,Sparkles,Target} from 'lucide-react';
import type {Catalog,RecordItem} from './types';
import {today} from './types';
import {useDrill} from './DrillProgress';
import {isWrongRecord} from './drill-state.mjs';

type Navigate=(path:string,params?:Record<string,string>)=>void;
export function LearningDesk({catalog,navigate,onOpen}:{catalog:Catalog;navigate:Navigate;onOpen:(r:RecordItem)=>void}){
 const {progress}=useDrill();
 const questions=catalog.records.filter(r=>r.studyQuestion),wrongs=questions.filter(r=>isWrongRecord(r,progress)&&!progress.items[r.id]?.mastered);
 const due=catalog.records.filter(r=>r.nextReview&&r.nextReview<=today()&&['memory','knowledge','review','common'].includes(r.kind));
 const practiced=Object.values(progress.items).filter(r=>r.attempts>0).length;
 const mainBooks=['source-e54c6989c8057386a3fe80e9','source-9657660fd40d4a780c48fe10','source-27c9642d30115cd64d7902bc'].map(id=>catalog.sources.find(s=>s.id===id)).filter(Boolean);
 const actions=[
  {title:'开始刷题',hint:'随机一组，做完看解析',detail:'原题图片 · 情景题连着做',Icon:Shuffle,path:'drill',params:{},tone:'practice'},
  {title:'复习错题',hint:'把没弄懂的，逐个弄懂',detail:`${wrongs.length} 道待巩固 · 保留历史作答`,Icon:RefreshCw,path:'wrong',params:{},tone:'mistakes'},
  {title:'带我复盘',hint:'不知道怎么学，就从这里开始',detail:'大白话精讲 → 复述 → 换题',Icon:Target,path:'guided-review',params:{},tone:'guided'},
  {title:'查找资料',hint:'找教材原页、讲解和笔记',detail:'三份教材 · 原文随时核对',Icon:BookOpen,path:'library',params:{},tone:'library'}
 ];
 return <div className="learning-desk">
  <header className="desk-heading"><div><span className="section-kicker"><span/>学习工作台</span><h1>今天，学清楚一点。</h1><p>从一个问题开始，让每次练习都有收获。</p></div><div className="desk-date"><span>{today().replaceAll('-',' / ')}</span><strong>{new Intl.DateTimeFormat('zh-CN',{weekday:'long',timeZone:'Asia/Shanghai'}).format(new Date())}</strong></div></header>
  <section className="desk-actions" aria-label="学习快捷入口">{actions.map(({title,hint,detail,Icon,path,params,tone},i)=><button className={`desk-action ${tone}`} key={path} onClick={()=>navigate(path,params)}><span className="desk-action-top"><span className="action-icon"><Icon size={23}/></span><small>0{i+1}</small></span><h2>{title}<ArrowUpRight size={20}/></h2><p>{hint}</p><span className="desk-action-detail">{detail}</span></button>)}</section>
  <section className="desk-speed-entry"><span className="speed-icon"><Calculator size={24}/></span><div><h2>速算训练</h2><p>把公式练顺手 · 随机混练、逐步讲解、错题重练</p></div><button className="button outline" onClick={()=>navigate('speed-math')}>练一轮速算 <ArrowRight size={16}/></button></section>
  <div className="desk-lower"><section className="desk-route"><div className="desk-section-head"><div><span className="section-kicker">不必一次做很多</span><h2>留半小时，完成一小步。</h2></div><Compass size={26} strokeWidth={1.4}/></div><p>做错不是终点。看清差在哪，再用自己的话说一遍。</p><ol className="study-route"><li><span>1</span><div><strong>先做一道</strong><small>看原题，独立选择</small></div></li><li><span>2</span><div><strong>弄清为什么</strong><small>比选项，找条件和依据</small></div></li><li><span>3</span><div><strong>留下提醒</strong><small>记住下次要警觉的词</small></div></li></ol><button className="button primary" onClick={()=>navigate('guided-review')}>开始今日30分钟复盘 <ArrowRight size={17}/></button></section>
   <aside className="desk-today"><span className="section-kicker">我的练习记录</span><h2>慢慢积累，看得见。</h2><div className="desk-counts"><div><strong>{practiced}</strong><span>已练过的题</span></div><div><strong>{due.length}</strong><span>到期知识卡</span></div></div><p>先复习到期内容，再学新的。不用一次清空全部错题。</p><button className="text-link" onClick={()=>navigate('cards',due.length?{due:'1'}:{kind:'memory'})}>打开今天的记忆卡 <ArrowRight size={16}/></button></aside></div>
  <section className="desk-books"><div className="desk-section-head"><div><span className="section-kicker">随时回到原文</span><h2>你的公安教材</h2></div><button className="text-link" onClick={()=>navigate('library')}>全部资料 <ArrowRight size={16}/></button></div><div className="desk-book-grid">{mainBooks.map((source,i)=>source&&<button className="desk-book" key={source.id} onClick={()=>navigate(`source/${source.id}`)}><div className={'desk-book-cover book-'+i}><BookOpen size={25}/><span>{['基础','上册','下册'][i]}</span><small>{source.pageCount} PAGES</small></div><div><small>{['系统理解知识','章节练习与笔记','套卷练习与笔记'][i]}</small><h3>{['333页完整教材','小题狂刷 · 上册','小题狂刷 · 下册'][i]}</h3><span>打开教材 <ArrowUpRight size={14}/></span></div></button>)}</div></section>
  <section className="desk-spaces"><div className="desk-section-head"><div><span className="section-kicker">每份内容，都有自己的位置</span><h2>知识与成长</h2></div></div><div className="desk-space-grid">{[
   {title:'卡片与速记',text:'知识卡、记忆卡与随手记，按用途查看。',Icon:Layers,path:'cards'},
   {title:'三科复盘',text:'行测、申论、公安，查看记录与薄弱点。',Icon:FileText,path:'review'},
   {title:'向内生长',text:'每日复盘、计划、导师记录和成长工具。',Icon:Leaf,path:'growth'},
   {title:'申论与常识',text:'精读、表达和常识积累，学完留下理解。',Icon:PenLine,path:'library',params:{tab:'articles'}}
  ].map(({title,text,Icon,path,params})=><button key={title} onClick={()=>navigate(path,params)}><Icon size={22}/><div><h3>{title}</h3><p>{text}</p></div><ArrowRight size={17}/></button>)}</div></section>
 </div>;
}
