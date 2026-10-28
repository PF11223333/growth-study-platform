import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowUpRight,BookOpen,ChevronLeft,Search,Check,AlertCircle,RotateCcw,ZoomIn,ZoomOut} from 'lucide-react';
import {reasonLabels,suggestReason} from './error-insights.mjs';
import {QuestionTutorial,navigateStudy,questionTeaching,readableOption} from './QuestionTutorial';
import type {StudyNavigate} from './QuestionTutorial';
import type {Catalog,RecordItem,SourceRef} from './types';
import {useDrill} from './DrillProgress';
import {gradeQuestion,normalizeAnswer,isWrongRecord} from './drill-state.mjs';
import * as api from './api';
import {GuidedContextEntry} from './GuidedReview';
import './question-study.css';
const typeNames:Record<string,string>={single:'单项选择',multi:'多项选择',case:'情境题'};
type ImageStatus='loaded'|'loading'|'failed';
function ScanPage({page,scale,label,imageKey,onStatus,onReference}:{page:any;scale:number;label:string;imageKey:string;onStatus:(key:string,status:ImageStatus)=>void;onReference:(ref:SourceRef)=>void}){
 const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0),[loaded,setLoaded]=useState(false);
 const region=page.region||{x:0,y:0,w:1,h:1};
 const w=Math.max(.01,Number(region.w)||1),h=Math.max(.01,Number(region.h)||1),x=Number(region.x)||0,y=Number(region.y)||0;
 const width=Number(page.width)||1000,height=Number(page.height)||1414;
 const src=`./previews/${page.sourceId}/${page.page}${['','-hd','-clean'].includes(page.previewSuffix)?page.previewSuffix:'-clean'}.webp${attempt?`?retry=${attempt}`:''}`;
 const open=()=>onReference({sourceId:page.sourceId,page:page.page,regions:[{x,y,w,h}],label});
 const retry=()=>{setFailed(false);setLoaded(false);setAttempt(value=>value+1);onStatus(imageKey,'loading');};
 return <figure className="study-scan-page">
  {failed?<div className="study-scan-error" role="alert"><AlertCircle size={22}/><strong>PDF 第 {page.page} 页原题图未能加载</strong><p>请重试，或打开原页核对题干、图表和选项。</p><div className="button-row"><button className="button outline" onClick={retry}><RotateCcw size={15}/>重新加载图片</button><button className="text-link" onClick={open}>打开这一原页 <ArrowUpRight size={14}/></button></div></div>:<div className="source-scan-viewport" tabIndex={scale>1?0:undefined} aria-label={`${label}，放大后可以横向滚动`}>
   <div className={`question-source-crop ${loaded?'is-loaded':''}`} style={{width:`${scale*100}%`,aspectRatio:`${width*w} / ${height*h}`}}>
    {!loaded&&<span className="study-scan-loading" role="status">正在载入原题…</span>}
    <img key={attempt} loading="eager" src={src} style={{width:`${100/w}%`,left:`${-x/w*100}%`,transform:`translateY(${-y*100}%)`}} alt={`${label}，PDF第${page.page}页`} onLoad={()=>{setLoaded(true);onStatus(imageKey,'loaded');}} onError={()=>{setFailed(true);onStatus(imageKey,'failed');}}/>
   </div>
  </div>}
  <figcaption><span>PDF 第 {page.page} 页</span><button className="text-link" onClick={open}>查看完整原页 <ArrowUpRight size={13}/></button></figcaption>
 </figure>;
}
function OriginalScan({pages,number,kind='question',previewNote,onStatus,onReference}:{pages:any[];number?:number;kind?:'question'|'context';previewNote?:string;onStatus:(key:string,status:ImageStatus)=>void;onReference:(ref:SourceRef)=>void}){
 const [scale,setScale]=useState(1),label=kind==='context'?'本组情景材料':`第 ${number||''} 题原文`;
 return <section className="study-original" aria-label={label}><div className="study-scan-toolbar"><div><strong>{kind==='context'?'共享情景材料':`原题正文${number?` · 第 ${number} 题`:''}`}</strong><small>{pages.length>1?`${pages.length} 段原页，请接着往下读`:'原页图像'} · {previewNote||'已隐藏红蓝笔迹'}</small></div><div className="study-zoom"><button className="icon-button" aria-label={`缩小${label}`} disabled={scale===1} onClick={()=>setScale(Math.max(1,scale-.5))}><ZoomOut size={18}/></button><span>{Math.round(scale*100)}%</span><button className="icon-button" aria-label={`放大${label}`} disabled={scale===3} onClick={()=>setScale(Math.min(3,scale+.5))}><ZoomIn size={18}/></button></div></div><button className="chip study-mobile-zoom" onClick={()=>setScale(scale===1?3:1)}>{scale===1?<ZoomIn size={16}/>:<ZoomOut size={16}/>} {scale===1?'字小？一键放大阅读':'恢复完整题目概览'}</button>{scale>1&&<p className="study-content-note">可左右滑动查看放大后的内容。<button className="text-link" onClick={()=>setScale(1)}>恢复适合屏幕</button></p>}{pages.map((page:any,i:number)=><ScanPage key={`${kind}:${page.sourceId}:${page.page}:${i}`} page={page} scale={scale} label={label} imageKey={`${kind}:${i}`} onStatus={onStatus} onReference={onReference}/>)}</section>;
}
export function QuestionBank({catalog,bank,params,onNavigate,onOpen}:{catalog:Catalog;bank:string;params:URLSearchParams;onNavigate:(p:string,params?:Record<string,string>)=>void;onOpen:(r:RecordItem)=>void}){
 const [query,setQuery]=useState(''),[limit,setLimit]=useState(36);
 const rows=catalog.records.filter(r=>r.kind==='practice'&&r.studyQuestion?.bank===bank);
 const lower=bank==='police-lower-20261014';
 const chapter=params.get('chapter')||'',section=params.get('section')||'',type=params.get('type')||'',marks=params.get('marks')||'';
 const {progress}=useDrill();const wrongIds=new Set(catalog.records.filter(r=>isWrongRecord(r,progress)).map(r=>r.id));
 const chapters=[...new Map(rows.map(r=>[r.studyQuestion.chapter,r.studyQuestion.chapterName])).entries()];
 const sections=[...new Map(rows.filter(r=>!chapter||String(r.studyQuestion.chapter)===chapter).map(r=>[r.studyQuestion.sectionId,r.studyQuestion.sectionName])).entries()];
 const change=(patch:Record<string,string>)=>{const next={chapter,section,type,marks,...patch};setLimit(36);onNavigate(`bank/${bank}`,Object.fromEntries(Object.entries(next).filter(([,v])=>v)));};
 const filtered=rows.filter(r=>{const q=r.studyQuestion;return (!chapter||String(q.chapter)===chapter)&&(!section||q.sectionId===section)&&(!type||(lower&&type==='case'?q.groupType==='case':q.type===type))&&(!marks||marks==='blue'&&q.blueMark||marks==='red'&&q.redMark||marks==='pending'&&q.needsConfirmation||marks==='annotated'&&(q.blueMark||q.redMark)||marks==='wrong'&&wrongIds.has(r.id))&&(!query||[r.title,r.excerpt,q.number].join(' ').includes(query));});
 const start=()=>onNavigate('drill',Object.fromEntries(Object.entries({bank,chapter,section,mode:marks==='wrong'?'wrong':'all',order:'random',autostart:'1',type,q:query}).filter(([,value])=>value)));
 return <><div className="bank-heading"><span className="eyebrow">POLICE STUDY / CHAPTER BY CHAPTER</span><h1>{lower?'一套一套，把薄弱点补上。':'一章一章，把题读懂。'}</h1><p>桐哥讲公专小题狂刷（{lower?'下':'上'}） · 原题、手写批注、教材参考答案与复盘</p>{lower&&<button className="button outline" onClick={()=>onNavigate('record/lower-20261014-report')}>查看13套校准、平均分与薄弱点</button>}</div><div className="bank-chapters"><button className={!chapter?'bank-chapter active':'bank-chapter'} onClick={()=>change({chapter:'',section:''})}><small>整本题册</small><strong>{lower?'全部套卷':'全部章节'}</strong><span>{rows.length} 道题</span></button>{chapters.map(([n,name])=><button key={n} className={chapter===String(n)?'bank-chapter active':'bank-chapter'} onClick={()=>change({chapter:String(n),section:''})}><small>{lower?'PAPER':'CHAPTER'} {String(n).padStart(2,'0')}</small><strong>{name}</strong><span>{rows.filter(r=>r.studyQuestion.chapter===n).length} 道题</span></button>)}</div>
 <section className="bank-controls" aria-label="题目筛选"><label>章节细分<select aria-label="章节细分" value={section} onChange={e=>change({section:e.target.value})}><option value="">全部小节</option>{sections.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>题型<select aria-label="题型" value={type} onChange={e=>change({type:e.target.value})}><option value="">全部题型</option>{Object.entries(typeNames).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>笔迹<select aria-label="笔迹筛选" value={marks} onChange={e=>change({marks:e.target.value})}><option value="">全部题目</option><option value="annotated">有红蓝笔迹</option><option value="blue">有蓝色标记</option><option value="red">有红色批注</option><option value="pending">识别待确认</option><option value="wrong">本机错题</option></select></label><label className="bank-search"><span>题目检索</span><div><Search size={16}/><input aria-label="题目检索" value={query} onChange={e=>{setQuery(e.target.value);setLimit(36);}} placeholder="题号或题干关键词"/></div></label></section>
 <div className="study-bank-start"><div><strong>把题打散，练真正的记忆。</strong><p>按当前章节、题型和搜索范围连续作答，情景材料按组保留。{marks&&marks!=='wrong'?'笔迹筛选仅用于下方查题。':''}</p></div><button className="button primary" disabled={!filtered.length} onClick={start}>随机开始刷题 <ArrowUpRight size={16}/></button></div>
 <div className="bank-caption"><span>{filtered.length} 道题 · 按原册查题</span><button className="text-link" onClick={()=>onNavigate('record/drill-20260917-guide')}>笔迹识别说明 <ArrowUpRight size={14}/></button></div>
 <div className="bank-question-list">{filtered.slice(0,limit).map(r=>{const q=r.studyQuestion;return <button key={r.id} className="bank-question" onClick={()=>onOpen(r)}><span className="bank-number">{q.caseNumber?`${q.caseNumber}–`:''}{q.number}</span><span className="bank-question-copy"><small>{q.sectionName} · {typeNames[q.type]} · 原册 {q.printedPage} 页</small><strong>{q.promptPreview||r.title}</strong><span className="bank-badges">{q.blueMark&&<em className="blue">蓝色标记</em>}{q.redMark&&<em className="red">红色批注</em>}{q.needsConfirmation&&<em>识别待确认</em>}</span></span><ArrowUpRight size={18}/></button>;})}</div>{!filtered.length&&<p className="muted">没有符合条件的题目，可调整筛选。</p>}{filtered.length>limit&&<button className="button load-more" onClick={()=>setLimit(limit+36)}>再看 36 道题</button>}</>;
}
export function QuestionStudy({record,onOriginal,onNavigate,onNext,onResult,initialAttempt,onTeachingReference,attemptEventId,readOnlyStudy=false}:{readOnlyStudy?:boolean;record:RecordItem;onTeachingReference?:(ref:SourceRef)=>void;onOriginal:()=>void;onNavigate:StudyNavigate;onNext?:()=>void;onResult?:(answer:string,correct:boolean|null,rating?:string)=>void;initialAttempt?:{answer:string;correct:boolean|null;rating?:string};attemptEventId?:string}){
 const q=record.details?.question||{},study=record.studyQuestion||{}, {busy,error,save,progress}=useDrill();
 const [selected,setSelected]=useState<string[]>(initialAttempt?.answer?.split('')||[]),[reveal,setReveal]=useState(!!initialAttempt),[saved,setSaved]=useState(!!initialAttempt&&initialAttempt.correct!==null),[rating,setRating]=useState(initialAttempt?.rating||''),[mask,setMask]=useState(false),[studyOnly,setStudyOnly]=useState(!!initialAttempt&&initialAttempt.correct===null),[showText,setShowText]=useState(false);
 const [imageStates,setImageStates]=useState<Record<string,ImageStatus>>({});
 const eventId=useRef(attemptEventId||crypto.randomUUID()),submitting=useRef(false),answerPanel=useRef<HTMLDivElement>(null),restoredAttempt=useRef(!!initialAttempt);
 useEffect(()=>{if(initialAttempt&&!restoredAttempt.current){restoredAttempt.current=true;setSelected(initialAttempt.answer.split(''));setReveal(true);setSaved(initialAttempt.correct!==null);setStudyOnly(initialAttempt.correct===null);setRating(initialAttempt.rating||'');}},[initialAttempt]);
 const navigate:StudyNavigate=(path,params)=>navigateStudy(onNavigate,path,params);
 const openReference=(ref:SourceRef)=>onTeachingReference?onTeachingReference(ref):navigate(`source/${ref.sourceId}`,{page:String(ref.page||1)});
 const onImageStatus=useCallback((key:string,status:ImageStatus)=>setImageStates(current=>current[key]===status?current:{...current,[key]:status}),[]);
 const scanned=q.origin==='source-scan'||String(study.bank||'').startsWith('police-');
 const pages=Array.isArray(q.originalPages)?q.originalPages:[],contextPages=Array.isArray(q.contextPages)?q.contextPages:[];
 const letters=q.type==='recall'?[]:[...new Set(['A','B','C','D',...Object.keys(q.options||{}).filter(key=>/^[A-D]$/.test(key))])].sort();
 const verifiedText=q.verifiedText===true||q.textVerified===true||q.readingAvailability==='verified-text'||['generated','manual','imported-quiz'].includes(q.origin);
 const completeQuestionText=verifiedText&&readableOption(q.prompt)&&(q.type==='recall'||letters.every(letter=>readableOption(q.options?.[letter])));
 const completeText=completeQuestionText&&(!contextPages.length||q.contextTextVerified===true&&readableOption(q.fullContextText||q.contextText));
 const neededImages=[...pages.map((_:any,i:number)=>`question:${i}`),...contextPages.map((_:any,i:number)=>`context:${i}`)];
 const imageFailed=neededImages.some(key=>imageStates[key]==='failed'),imagesLoaded=pages.length>0&&neededImages.every(key=>imageStates[key]==='loaded');
 const readingReady=q.requiresImage?imagesLoaded:(!scanned||completeText||imagesLoaded);
 const conflict=!!q.answerConflict&&!q.answerConflictResolved;
 const exclusion=readOnlyStudy||q.gradingExcluded||study.gradingExcluded||conflict;
 const exclusionReason=(readOnlyStudy?'本轮为原页自测，只核对教材与讲解，不写入对错统计。':'')||q.gradingExclusionReason||q.gradingExcludedReason||study.gradingExclusionReason||(conflict?'本题存在答案差异，需先核对依据。':'这道题的题目或参考答案尚未核对完整。');
 const canGrade=!exclusion&&readingReady&&!studyOnly;
 const chosen=selected.join(''),correct=canGrade?gradeQuestion(q,chosen,rating):null;
 const expected=normalizeAnswer(q.referenceAnswer).split(''),missing=expected.filter(letter=>!selected.includes(letter)),extra=selected.filter(letter=>!expected.includes(letter));
 const hasAnswer=q.type==='recall'?!!q.referenceAnswer:expected.length>0;
 const teaching=questionTeaching(record),typeLabel=q.type==='single'?'单项选择 · 选 1 项':q.type==='multi'?'多项选择 · 选出所有符合项':q.type==='recall'?'开放自测 · 回忆后自评':'情景选择 · 依原题要求，可选多项';
 const displayText=completeQuestionText&&(!pages.length||q.hideOriginalUntilAnswer||showText||imageFailed),ungraded=reveal&&(!canGrade||!hasAnswer);
 const choose=(letter:string)=>{if(reveal||busy)return;setSelected(current=>q.type==='single'?[letter]:current.includes(letter)?current.filter(value=>value!==letter):[...current,letter].sort());};
 const focusFeedback=()=>requestAnimationFrame(()=>answerPanel.current?.focus({preventScroll:true}));
 const submit=async(nextRating?:string)=>{
  const nextGrade=canGrade?gradeQuestion(q,chosen,nextRating||rating):null;
  if(nextGrade===null||saved||busy||submitting.current)return;
  submitting.current=true;setReveal(true);if(nextRating)setRating(nextRating);focusFeedback();
  try{const ok=await save({id:record.id,action:'attempt',answer:chosen,rating:nextRating||rating,correct:nextGrade,eventId:eventId.current});
   if(ok){setSaved(true);onResult?.(chosen,nextGrade,nextRating||rating);}
  }finally{submitting.current=false;}
 };
 const revealUngraded=()=>{setStudyOnly(true);setReveal(true);focusFeedback();};
 const retry=()=>{setSelected([]);setReveal(false);setSaved(false);setMask(false);setStudyOnly(false);setRating('');eventId.current=crypto.randomUUID();};
 const continuePractice=()=>navigate('drill',Object.fromEntries(Object.entries({bank:study.bank||'',chapter:String(study.chapter||''),section:study.sectionId||'',after:record.id,order:'random',autostart:'1'}).filter(([,value])=>value)));
 const next=()=>{if(busy||submitting.current)return;if(onNext){if(!saved)onResult?.('',null);onNext();}else continuePractice();};
 return <section className="question-study study-surface">
  <div className="question-study-tools">{!onNext&&<button className="text-link" onClick={()=>study.bank==='xingce-tutorial'?navigate('xingce',{section:study.xingceSection||String(study.sectionId||'').replace(/^xingce-/, '')||'data'}):study.bank?navigate(`bank/${study.bank}`,{chapter:String(study.chapter||''),section:study.sectionId||''}):navigate('drill')}><ChevronLeft size={16}/>按原册查题</button>}{record.sourceRefs?.some(ref=>ref.sourceId)&&<button className="chip" onClick={onOriginal}><BookOpen size={15}/>原页与我的笔迹</button>}</div>
  <div className="study-question-heading"><strong>{typeLabel}</strong>{q.origin==='generated'?<span>原创巩固题</span>:study.number?<span>原册第 {study.number} 题</span>:null}</div>
  {(exclusion||!hasAnswer)&&<aside className="study-grade-notice" role="status"><AlertCircle size={19}/><div><strong>待核对，本题暂不判分</strong><p>{!hasAnswer?'尚无可用的参考答案。':exclusionReason}</p>{q.answerConflict&&<p>{q.answerConflict}</p>}<span>查看资料或跳过，不会增加作答次数与错题。</span></div></aside>}
  {(contextPages.length>0||q.contextText||q.fullContextText)&&<details className="study-case-context" open><summary><span>{study.caseTitle||'本组共用的情景材料'}</span>{study.caseCount>1&&<small>第 {study.caseIndex||1} / {study.caseCount} 小题</small>}</summary>{contextPages.length>0&&<OriginalScan pages={contextPages} kind="context" previewNote={q.previewNote} onStatus={onImageStatus} onReference={openReference}/>} {(q.fullContextText||q.contextText)&&(!scanned||verifiedText)&&<div className="study-context-text preserve">{q.fullContextText||q.contextText}</div>}</details>}
  {pages.length>0&&(!q.hideOriginalUntilAnswer||reveal)&&<OriginalScan pages={pages} number={study.number} previewNote={q.previewNote} onStatus={onImageStatus} onReference={openReference}/>}
  {scanned&&!pages.length&&!completeText&&<div className="study-scan-error" role="status"><AlertCircle size={22}/><strong>本题原图尚未准备好</strong><p>题干或选项的识别文字不完整，请打开原页阅读。本题暂不计分。</p><button className="button outline" onClick={onOriginal}>打开原题与笔迹 <ArrowUpRight size={15}/></button></div>}
  {pages.length>0&&completeQuestionText&&<button className="text-link study-text-toggle" onClick={()=>setShowText(!showText)}>{showText?'收起文字版':contextPages.length?'查看已核对的小问文字':'查看已核对文字版'}</button>}
  {imageFailed&&completeText&&<p className="study-content-note">{q.requiresImage?'本题需要图形信息，原图加载完整后才可判分。':'原图暂时无法加载，以下为已核对的完整文字版，可据此作答。'}</p>}
  {(displayText||!scanned)&&<p className="question-prompt preserve">{q.prompt||'题干尚未完整录入。'}</p>}
  {q.type==='recall'?<p className="study-content-note">先自己说出答案和理由，再展开核对；开放题通过自评安排复习。</p>:<fieldset className="study-choice-fieldset"><legend>{q.type==='single'?'请选择一个答案':'请选择答案，可选多项'}</legend><div className="question-options">{letters.map(letter=>{
   const selectedHere=selected.includes(letter),showGrade=reveal&&canGrade&&hasAnswer,expectedHere=expected.includes(letter);
   const optionText=(verifiedText||!scanned)&&readableOption(q.options?.[letter])?q.options[letter]:`选择 ${letter}`;
   return <button type="button" key={letter} aria-pressed={selectedHere} disabled={reveal||busy} className={`question-option ${selectedHere?'selected':''} ${showGrade&&expectedHere?'correct-option':''} ${showGrade&&selectedHere&&!expectedHere?'wrong-option':''}`} onClick={()=>choose(letter)}><b>{letter}</b><span>{optionText}</span>{showGrade?<em>{expectedHere?selectedHere?'选对':'漏选':selectedHere?'误选':'排除'}</em>:selectedHere?<Check size={20} aria-label="已选择"/>:null}</button>;
  })}</div>{scanned&&!verifiedText&&<p className="study-content-note">选项内容见上方原题，点击字母作答。</p>}</fieldset>}
  {!reveal&&<div className="study-submit-area"><div className="study-selection" role="status">{q.type!=='recall'&&(chosen?<>已选 <strong>{selected.join('、')}</strong>{q.type!=='single'&&' · 检查是否还有符合项'}</>:'尚未选择')}</div><div className="button-row">{exclusion||!hasAnswer?<button className="button primary" onClick={revealUngraded}>查看核对说明</button>:q.type==='recall'?<button className="button primary" disabled={!readingReady} onClick={()=>{setReveal(true);focusFeedback();}}>揭晓答案并自评</button>:<button className="button primary" disabled={busy||!chosen||!readingReady} onClick={()=>submit()}>{busy?'正在保存…':'提交答案'}</button>}<button className="text-link" disabled={busy} onClick={revealUngraded}>直接看讲解（不计分）</button></div>{scanned&&!readingReady&&pages.length>0&&<p className="study-content-note">{imageFailed?'原图未能完整加载，暂不能判分；可重试或打开原页。':'原题和情景图片加载完成后即可提交。'}</p>}</div>}
  {reveal&&<div className="question-answer study-feedback" ref={answerPanel} tabIndex={-1} aria-label="本题答案与讲解">
   <header className="study-feedback-heading"><strong>{ungraded?'本题未计分':correct===true?'答对了，继续检查理由':correct===false?'找到差异，再弄懂原因':'核对答案，回忆理由'}</strong><button className="chip" onClick={()=>setMask(!mask)}>{mask?'显示答案与讲解':'遮住答案回想'}</button></header>
   {!mask&&<>
    <div className="study-answer-pair"><div><span>你的答案</span><strong>{q.type==='recall'?(rating||'待自评'):chosen||'未作答'}</strong></div><div><span>{exclusion?'题册所列答案（待核对）':q.origin==='generated'?'原创题参考答案':'参考答案'}</span><strong>{q.referenceAnswer||'待核对'}</strong></div></div>
    {q.answerScope&&<p className="study-content-note">{q.answerScope}</p>}
    {correct!==null&&q.type!=='recall'&&<div className="study-answer-difference">{correct?<p><Check size={16}/>本次所选与参考答案一致。能说清条件，才算把这一点练扎实。</p>:<><p>{missing.length>0&&<span>漏选 <b>{missing.join('、')}</b></span>}{extra.length>0&&<span>误选 <b>{extra.join('、')}</b></span>}</p><p>先看下面这些选项的理由，再由你确认实际错因。</p></>}</div>}
    {ungraded&&<p className="study-content-note">{studyOnly&&!exclusion?'本次先看讲解，不记录一次作答结果。':'本题暂不写入对错统计。'}</p>}
    {q.currentLawNote&&<aside className="study-version-note"><strong>旧题与现行规则，要分开记</strong><p>{q.currentLawNote}</p></aside>}
    {q.errata&&<aside className="study-version-note"><strong>题册勘误</strong><p>{q.errata.note}</p>{q.errata.mnemonic&&<p>{q.errata.mnemonic}</p>}</aside>}
    <QuestionTutorial record={record} onNavigate={navigate} onReference={openReference} selectedAnswer={chosen} showJudgment={canGrade&&q.type!=='recall'}/>
    {teaching.precise&&q.attention&&!/先完成一道，再看讲解|实际错因.*自己确认/.test(q.attention)&&<aside className="drill-attention"><strong>下次看到这里要留意</strong><p>{q.attention}</p></aside>}
    <GuidedContextEntry recordId={record.id} knowledgeId={record.details?.guidedLessonId||record.details?.guidedSourceAudit?.lessonId} navigate={navigate}/>
    {(correct===false||study.historicalWrong||progress.items[record.id]?.isWrong)&&<ReasonPicker record={record}/>}
    {(study.historicalWrong||study.historicalCorrect||study.wrongCandidate||q.confirmedNotes?.length>0)&&<details className="study-related-reading"><summary>我的原册作答与笔记</summary><p>红笔作答：{study.historicalAnswer||'待辨认'} · 蓝笔订正：{study.correctionAnswer||'未辨清／未见明确订正'}</p><p className="study-content-note">{study.inkRule||'红笔为你的作答，蓝笔为订正；颜色区域不等于已确认答案字母。'}</p>{q.confirmedNotes?.map((note:any,i:number)=><p key={i}><strong>{note.color==='blue'?'蓝色笔记':'红色笔记'}：</strong>{note.text}</p>)}<button className="text-link" onClick={onOriginal}>核对原页笔迹 <ArrowUpRight size={14}/></button></details>}
   </>}
   {q.type==='recall'&&!saved&&canGrade&&hasAnswer&&<div className="rating-buttons">{['忘记','模糊','掌握'].map(value=><button disabled={busy} key={value} onClick={()=>submit(value)}>{value}</button>)}</div>}
   {saved&&<p className="study-save-state" role="status"><Check size={15}/>{api.isLocal()?'本次作答已保存到电脑':'本次作答已保存到当前浏览器'}{correct===false?'，已记入错题集。':'。'}</p>}
   {busy&&!saved&&<p className="study-content-note" role="status">正在保存本次作答…</p>}
   {error&&<p className="error-message" role="alert">{error}</p>}
   {!saved&&canGrade&&hasAnswer&&q.type!=='recall'&&<button className="button outline" disabled={busy} onClick={()=>submit()}>{busy?'保存中…':'重试保存本次作答'}</button>}
   {q.answerCardId&&<button className="text-link study-card-link" onClick={()=>navigate(`record/${q.answerCardId}`)}>打开关联答题卡 <ArrowUpRight size={14}/></button>}
   {(saved||ungraded)&&<div className="drill-bottom-actions study-bottom-actions">{!onNext&&<button className="button outline" disabled={busy} onClick={retry}>重新作答</button>}<button className="button primary" disabled={busy} onClick={next}>{onNext?(saved?'下一题':'不计分，继续下一题'):'继续随机刷题'} <ArrowUpRight size={17}/></button></div>}
  </div>}
 </section>;
}

function ReasonPicker({record}:{record:RecordItem}){
 const {progress,busy,save}=useDrill(),[value,setValue]=useState(progress.items[record.id]?.errorReason||''),[message,setMessage]=useState('');
 const proposed=suggestReason(record.details?.question?.explanation?.category||'');
 return <section className="reason-picker study-reason" aria-label="实际错因记录"><label htmlFor={`reason-${record.id}`}>由我确认：这次卡在了哪里？</label><p>这是你对本次思路的记录，只有你确认后才纳入错因统计。</p>{proposed!=='unknown'&&<div className="study-system-suggestion"><small>系统参考线索，尚未确认</small><span>{reasonLabels[proposed]}</span><p>按知识点类型推测，不代表已经知道你为什么做错。</p></div>}<select id={`reason-${record.id}`} value={value} onChange={event=>{setValue(event.target.value);setMessage('');}}><option value="">选择最符合本次情况的一项</option>{Object.entries(reasonLabels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><button className="button outline" disabled={!value||busy} onClick={async()=>{if(await save({id:record.id,action:'reason',reason:value}))setMessage('实际错因已保存，统计已更新。');}}>确认并保存错因</button><p className="study-save-state" role="status">{message}</p></section>;
}
