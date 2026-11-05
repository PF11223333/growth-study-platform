const closing=new Set(Array.from('，。！？；：、）》】〕〉」』”’％%.,;:!?)]}'));
const opening=new Set(Array.from('（《【〔〈「『“‘([{'));
export const WRITING_STORAGE_KEY='growth-writing-v1';
export function graphemes(text=''){return Array.from(new Intl.Segmenter('zh-CN',{granularity:'grapheme'}).segment(String(text))).map(x=>x.segment);}
export function writingCounts(draft){const all=[draft.title,draft.salutation,draft.body,draft.signature,draft.dateLine].filter(Boolean).join('\n');return {body:graphemes(draft.body||'').filter(x=>!/^\s+$/u.test(x)).length,total:graphemes(all).filter(x=>!/^\s+$/u.test(x)).length,paragraphs:(draft.body||'').split(/\r?\n/).filter(x=>x.trim()).length};}
function tokens(text,halfWidth){const chars=graphemes(text),items=[];for(let i=0;i<chars.length;i++){const c=chars[i];if((c==='—'||c==='…')&&chars[i+1]===c){items.push({text:c+c,width:2,kind:'double'});i++;}else if(halfWidth&&/[A-Za-z0-9]/.test(c)&&c.length===1){let run=c;while(i+1<chars.length&&(/^[A-Za-z0-9]$/.test(chars[i+1])||/^[.,:/+-]$/.test(chars[i+1])&&/^\d$/.test(chars[i])&&/^\d$/.test(chars[i+2]||'')))run+=chars[++i];items.push({text:run,width:Math.ceil(run.length/2),kind:'ascii'});}else items.push({text:c,width:1,kind:opening.has(c)?'opening':closing.has(c)?'closing':'normal'});}return items;}
export function layoutWriting(draft,config={}){
 const columns=Math.max(10,Math.min(30,Math.round(Number(config.columns)||20))),indent=[0,2].includes(config.indent)?config.indent:2,halfWidth=config.halfWidth!==false;
 const rows=[],warnings=[];let row=[],rowKind='body';
 const pad=()=>{while(row.length<columns)row.push({text:'',kind:'blank'});};
 const flush=()=>{pad();rows.push({kind:rowKind,cells:row});row=[];};
 const blank=n=>{for(let i=0;i<n;i++)row.push({text:'',kind:'indent'});};
 function placeLine(raw,{kind='body',align='left',prefix=0}={}){
  rowKind=kind;const text=raw.replace(/^\s+/u,''),parts=tokens(text,halfWidth),width=parts.reduce((sum,p)=>sum+p.width,0);
  blank(align==='center'?Math.max(0,Math.floor((columns-width)/2)):align==='right'?Math.max(0,columns-width):prefix);
  for(const [pi,t] of parts.entries()){
   if(t.kind==='closing'&&row.length===columns&&row.some(c=>c.text)){row.at(-1).text+=t.text;row.at(-1).squeezed=true;continue;}
   if(row.length===columns)flush();
   if(t.kind==='opening'){let needed=1,look=pi+1;while(parts[look]?.kind==='opening'){needed++;look++;}needed+=Math.min(parts[look]?.width||1,Math.max(1,columns-needed));if(row.some(c=>c.text)&&columns-row.length<needed)flush();}
   if(t.width>1&&t.width<=columns&&columns-row.length<t.width&&row.at(-1)?.kind!=='opening')flush();
   if(t.kind==='double'){row.push({text:t.text[0],kind:'double-start'},{text:t.text[1],kind:'double-end'});}
   else if(t.kind==='ascii'){for(let n=0;n<t.text.length;n+=2){if(row.length===columns)flush();row.push({text:t.text.slice(n,n+2),kind:'ascii'});}}
   else row.push({text:t.text,kind:t.kind});
  }
  flush();
 }
 if(draft.title?.trim())placeLine(draft.title,{kind:'title',align:'center'});
 if(draft.salutation?.trim())placeLine(draft.salutation,{kind:'salutation'});
 for(const line of String(draft.body||'').replace(/\r\n?/g,'\n').split('\n'))placeLine(line,{prefix:line.trim()?indent:0});
 if(draft.signature?.trim())placeLine(draft.signature,{kind:'signature',align:'right'});
 if(draft.dateLine?.trim())placeLine(draft.dateLine,{kind:'signature',align:'right'});
 const counts=writingCounts(draft),limit=Number(config.max)||0;
 if(limit&&counts.total>limit)warnings.push({id:'over-limit',text:`全文（含标点、不含空白）为${counts.total}个字符，超过本题${limit}字练习上限；真实计数方式以题目和答题卡要求为准。`});
 if(/(^|[^…])…([^…]|$)/u.test(draft.body||'')||/\.{3,}/.test(draft.body||''))warnings.push({id:'ellipsis',text:'检查省略号：中文常用六点“……”，占两字位置。'});
 if(/--/.test(draft.body||''))warnings.push({id:'dash',text:'检查破折号：中文常用“——”，占两字位置。'});
 if(/[,:;!?]/.test(draft.body||''))warnings.push({id:'punctuation',text:'检查半角标点是否处于中文句子中；数字、外语和网址需结合语境，不自动替换。'});
 const body=String(draft.body||'');for(const [left,right] of [['“','”'],['（','）'],['《','》']])if(Array.from(body).filter(x=>x===left).length!==Array.from(body).filter(x=>x===right).length)warnings.push({id:'pair-'+left,text:`检查${left}${right}是否成对；这是数量提示，不能代替句意判断。`});
 if(/\n\s*\n/.test(body))warnings.push({id:'blank-line',text:'稿件含空行，会额外占用答题区域；核对是否确有需要。'});
 if(/^[\t \u3000]*[，。！？；：、）》】〕〉」』”’]/mu.test(body))warnings.push({id:'paragraph-punctuation',text:'有段落以点号或后引号、后括号开头。请核对段落和成对标点；预览保留原稿，不把它移入上一段。'});
 return {columns,rows,counts,warnings,occupiedCells:rows.reduce((n,r)=>n+r.cells.filter(c=>c.text||c.kind==='indent').length,0),squeezedCount:rows.reduce((n,r)=>n+r.cells.filter(c=>c.squeezed).length,0)};
}
export function emptyWritingWorkspace(){return {schemaVersion:1,drafts:[],versions:[],activeDraftId:''};}
const contentKeys=['title','salutation','body','signature','dateLine','notes'];
const payload=d=>JSON.stringify(Object.fromEntries(['taskId','profileId',...contentKeys,'selfCheck','grid','taskSnapshot','status','elapsedMs'].map(k=>[k,d[k]])));
const digest=text=>{let a=2166136261,b=2246822507;for(const c of text){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b^c.charCodeAt(0),3266489909);}return (a>>>0).toString(16)+(b>>>0).toString(16);};
const plain=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const finiteTime=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
function optionalText(value,label,max=5000){if(value!==undefined&&(typeof value!=='string'||value.length>max))throw new Error(label+'格式无效');}
function strings(value,label){if(value!==undefined&&(!Array.isArray(value)||value.length>1000||value.some(x=>typeof x!=='string'||x.length>5000)))throw new Error(label+'须为文字列表');}
function gridConfig(grid,allowMissing=false){
 if(grid===undefined&&allowMissing)return{columns:20,indent:2,halfWidth:true};
 if(!plain(grid))throw new Error('格纸设置须为对象');
 const columns=grid.columns??20,indent=grid.indent??2,halfWidth=grid.halfWidth??true;
 if(grid.columns===null||!Number.isInteger(columns)||columns<10||columns>30||grid.indent===null||![0,2].includes(indent)||grid.halfWidth===null||typeof halfWidth!=='boolean')throw new Error('格纸设置无效：格数10至30，段首0或2格，数字排格须为开关');
 return{...grid,columns,indent,halfWidth};
}
function taskSnapshot(value){
 if(value===undefined)return value; // Older records can still resolve their known task from the guide.
 if(!plain(value))throw new Error('题目快照须为对象');
 for(const key of ['id','title','genre','provenance','sampleAnswerLabel','difficulty'])optionalText(value[key],'题目'+key);
 if(value.durationMinutes!==undefined&&(!finiteTime(value.durationMinutes)||value.durationMinutes>1440))throw new Error('题目时长无效');
 if(value.wordLimit!==undefined){const limit=value.wordLimit;if(!plain(limit)||['min','max'].some(k=>limit[k]!==undefined&&(!Number.isInteger(limit[k])||limit[k]<0||limit[k]>30000))||limit.min!==undefined&&limit.max!==undefined&&limit.min>limit.max)throw new Error('题目字数范围无效');}
 if(value.grid!==undefined)gridConfig(value.grid);
 strings(value.sourceIds,'题目来源');strings(value.profileIds,'考试类型');
 if(value.requirements!==undefined&&(!Array.isArray(value.requirements)||value.requirements.length>1000))throw new Error('题目要求须为列表');
 if(value.selfCheck!==undefined){if(!Array.isArray(value.selfCheck)||value.selfCheck.length>1000)throw new Error('题目自查项须为列表');for(const item of value.selfCheck){if(typeof item==='string')continue;if(!plain(item))throw new Error('题目自查项格式无效');for(const k of ['id','text','label'])optionalText(item[k],'题目自查项');}}
 if(value.materials!==undefined){if(!Array.isArray(value.materials)||value.materials.length>1000)throw new Error('题目材料须为列表');for(const material of value.materials){if(!plain(material))throw new Error('题目材料格式无效');for(const k of ['id','title','provenance'])optionalText(material[k],'材料'+k);strings(material.sourceIds,'材料来源');}}
 if(value.sourceRefs!==undefined){if(!Array.isArray(value.sourceRefs)||value.sourceRefs.length>1000)throw new Error('教材定位须为列表');for(const ref of value.sourceRefs){if(!plain(ref)||typeof ref.sourceId!=='string'||!Number.isInteger(ref.page)||ref.page<1||ref.page>100000)throw new Error('教材页码定位无效');optionalText(ref.label,'教材定位名称');}}
 return value;
}
function validateDraft(d){
 if(!plain(d)||typeof d.id!=='string'||!d.id||d.id.length>200||typeof d.taskId!=='string'||typeof d.profileId!=='string'||typeof d.updatedAt!=='string'||!Number.isFinite(Date.parse(d.updatedAt)))throw new Error('写作记录编号、任务或日期无效');
 if(d.createdAt!==undefined&&(typeof d.createdAt!=='string'||!Number.isFinite(Date.parse(d.createdAt))))throw new Error('稿件创建日期无效');
 for(const key of contentKeys)if(typeof d[key]!=='string'||d[key].length>(key==='body'?30000:5000))throw new Error('写作记录内容无效或过长');
 if(!Array.isArray(d.selfCheck)||d.selfCheck.length>1000||d.selfCheck.some(k=>typeof k!=='string'))throw new Error('自查记录无效');
 if(d.elapsedMs!==undefined&&!finiteTime(d.elapsedMs)||d.runningSince!==undefined&&d.runningSince!==null&&!finiteTime(d.runningSince))throw new Error('计时数据无效');
 optionalText(d.status,'稿件状态',100);optionalText(d.importConflictOf,'冲突来源',200);
 return{...d,grid:gridConfig(d.grid,true),taskSnapshot:taskSnapshot(d.taskSnapshot),elapsedMs:d.elapsedMs??0,runningSince:d.runningSince??null,status:d.status??'draft'};
}
export function readWritingWorkspace(raw){
 if(raw===null||raw===undefined||raw==='')return emptyWritingWorkspace();
 const w=typeof raw==='string'?JSON.parse(raw):structuredClone(raw);
 if(!plain(w)||w.schemaVersion!==1||!Array.isArray(w.drafts)||!Array.isArray(w.versions)||w.drafts.length>1000||w.versions.length>10000)throw new Error('写作记录格式、版本或数量不支持（最多1000稿、10000个版本）');
 const ids=new Set(),drafts=w.drafts.map(validateDraft);for(const d of drafts){if(ids.has(d.id))throw new Error('写作记录编号重复');ids.add(d.id);}
 const seenVersions=new Set(),versions=w.versions.map(v=>{if(!plain(v)||typeof v.id!=='string'||!v.id||v.id.length>500||typeof v.draftId!=='string'||!v.draftId||v.draftId.length>200||!v.draft)throw new Error('历史稿件格式无效');const draft=validateDraft(v.draft);if(draft.id!==v.draftId)throw new Error('历史稿件与所属稿件编号不一致');if(typeof v.at!=='string'||!Number.isFinite(Date.parse(v.at)))throw new Error('历史稿件日期无效');optionalText(v.label,'历史稿件名称');if(seenVersions.has(v.id))throw new Error('历史稿件编号重复');seenVersions.add(v.id);return{...v,draft};});
 return{...w,drafts,versions,activeDraftId:typeof w.activeDraftId==='string'?w.activeDraftId:''};
}
const importId=(original,content)=>original.slice(0,150)+':import:'+digest(content);
export function mergeWritingWorkspace(current,incoming){
 const base=readWritingWorkspace(current),other=readWritingWorkspace(incoming),result=structuredClone(base),remap=new Map();let added=0,conflicts=0;
 for(const d of other.drafts){const same=result.drafts.find(x=>x.id===d.id);let resolved=d.id;
  if(!same){result.drafts.push({...d,runningSince:null});added++;}
  else if(payload(same)!==payload(d)){const initial=importId(d.id,payload(d));let id=initial,existing=result.drafts.find(x=>x.id===id),suffix=0;while(existing&&payload(existing)!==payload(d)){id=initial+':'+(++suffix);existing=result.drafts.find(x=>x.id===id);}resolved=id;if(!existing){result.drafts.push({...d,id,importConflictOf:d.id,runningSince:null});added++;conflicts++;}}
  remap.set(d.id,resolved);
 }
 const versions=new Map(result.versions.map(v=>[v.id,v]));
 const preserveVersion=(v,countConflict=true)=>{const same=versions.get(v.id);if(!same){versions.set(v.id,v);return;}if(JSON.stringify(same)===JSON.stringify(v))return;const initial=importId(v.id,JSON.stringify(v));let id=initial,suffix=0;while(versions.has(id)&&JSON.stringify({...versions.get(id),id:v.id})!==JSON.stringify(v))id=initial+':'+(++suffix);if(!versions.has(id)){versions.set(id,{...v,id});if(countConflict)conflicts++;}};
 for(const v of other.versions){const draftId=remap.get(v.draftId)||v.draftId;preserveVersion({...v,draftId,draft:{...v.draft,id:draftId}});}
 // Pause imported clocks, but retain their original timestamp as an inspectable version.
 for(const d of other.drafts)if(d.runningSince!==null){const draftId=remap.get(d.id)||d.id;preserveVersion({id:importId(d.id,'clock:'+JSON.stringify(d)),draftId,at:d.updatedAt,label:'导入时保留的计时原记录',draft:{...d,id:draftId}},false);}
 result.versions=[...versions.values()];
 // Validate the combined size and generated IDs before the caller can persist anything.
 return{workspace:readWritingWorkspace(result),added,conflicts};
}
export function snapshotWriting(workspace,draft,label='保存版本',at=new Date().toISOString()){const next=readWritingWorkspace(workspace),valid=validateDraft(draft),id=valid.id+':'+digest(payload(valid));if(!next.versions.some(v=>v.id===id))next.versions.push({id,draftId:valid.id,at,label,draft:structuredClone({...valid,runningSince:null})});return readWritingWorkspace(next);}
