function shuffle(rows,random){const result=[...rows];for(let i=result.length-1;i>0;i--){const sample=Math.max(0,Math.min(.999999999999,random()));const j=Math.floor(sample*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function knowledgeKey(row){const q=row.studyQuestion||{};return q.knowledgeKey||q.parentId||`${row.subject}:${q.sectionId||row.topic||'general'}`;}
export function caseGroupKey(row){const q=row.studyQuestion||{};return q.caseGroupId?`${q.bank||row.subject||''}:${q.caseGroupId}`:'';}
function groups(rows){
 const result=[],byKey=new Map();
 for(const row of [...new Map(rows.map(r=>[r.id,r])).values()]){const key=caseGroupKey(row)||'question:'+row.id;let group=byKey.get(key);if(!group){group={key,rows:[],first:result.length};byKey.set(key,group);result.push(group);}group.rows.push(row);}
 for(const group of result)if(group.rows.length>1)group.rows.sort((a,b)=>Number(a.studyQuestion?.caseGroupOrder??a.studyQuestion?.number??a.studyQuestion?.caseIndex??0)-Number(b.studyQuestion?.caseGroupOrder??b.studyQuestion?.number??b.studyQuestion?.caseIndex??0));
 return result;
}
export function expandPracticeGroups(rows,allRows){const ids=new Set(rows.map(r=>r.id)),keys=new Set(rows.map(caseGroupKey).filter(Boolean));return allRows.filter(r=>ids.has(r.id)||keys.has(caseGroupKey(r)));}
export function eligiblePracticeRows(rows){const excludedGroups=new Set(rows.filter(r=>r.studyQuestion?.gradingExcluded).map(caseGroupKey).filter(Boolean));return rows.filter(r=>r.studyQuestion&&!r.studyQuestion.gradingExcluded&&!excludedGroups.has(caseGroupKey(r)));}
export function buildPracticeQueue(rows,{policy='random',progress={items:{}},startId='',afterId='',previousId='',today='',random=Math.random,limit=0}={}){
 let units=groups(rows);if(!units.length)return [];
 let anchor=units.find(group=>group.rows.some(r=>r.id===startId));
 if(afterId){const previous=units.find(group=>group.rows.some(r=>r.id===afterId));if(previous){const at=previous.rows.findIndex(r=>r.id===afterId);previous.rows=previous.rows.slice(at+1);if(previous.rows.length)anchor=previous;else{const originalIndex=units.indexOf(previous);if(policy==='ordered'){anchor=units[originalIndex+1];if(!anchor)return [];}units=units.filter(group=>group!==previous);}}}
 const priority=row=>{const s=progress.items?.[row.id];return s?.nextReview&&s.nextReview<=today?0:s?.isWrong&&!s.mastered||row.studyQuestion?.historicalWrong&&!s?.mastered?1:!s?.attempts?2:s.mastered?4:3;};
 if(policy==='ordered'){if(anchor)units=units.slice(units.indexOf(anchor));}
 else{
  units=shuffle(units,random);if(policy==='related')units.sort((a,b)=>Math.min(...a.rows.map(priority))-Math.min(...b.rows.map(priority)));
  const start=anchor?units.indexOf(anchor):-1;if(start>=0)units.unshift(...units.splice(start,1));
  else if(units.length>1&&units[0].rows.some(r=>r.id===previousId)){const swap=1+Math.floor(Math.max(0,Math.min(.999999999999,random()))*(units.length-1));[units[0],units[swap]]=[units[swap],units[0]];}
  if(policy==='related'){
   const ordered=[];let sameCount=0;
   while(units.length){let index=0;if(ordered.length){const key=knowledgeKey(ordered.at(-1).rows[0]);if(sameCount<2){const found=units.findIndex(group=>knowledgeKey(group.rows[0])===key);if(found>=0)index=found;}else{const found=units.findIndex(group=>knowledgeKey(group.rows[0])!==key);if(found>=0)index=found;}}
    const [unit]=units.splice(index,1);sameCount=ordered.length&&knowledgeKey(ordered.at(-1).rows[0])===knowledgeKey(unit.rows[0])?sameCount+1:0;ordered.push(unit);
   }units=ordered;
  }
 }
 const result=[];for(const unit of units){result.push(...unit.rows.map(r=>r.id));if(limit>0&&result.length>=limit)break;}return result;
}
export function matchesPracticeQuery(row,query){const q=row.studyQuestion||{},normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/第\s*(\d+)\s*题/g,'$1').replace(/\s+/g,' ').trim();const haystack=normalize([row.id,row.title,row.excerpt,row.topic,q.number,q.promptPreview,q.paperName,q.paperTitle,q.chapterName,q.sectionName,q.caseTitle].join(' '));return normalize(query).split(' ').filter(Boolean).every(term=>haystack.includes(term));}
export function matchesPracticeType(row,type){const q=row.studyQuestion||{};if(!type)return true;return type==='case'?!!q.caseGroupId||q.groupType==='case'||q.type==='case':q.type===type;}
export function practiceNavigationParams(filters,changes={}){return Object.fromEntries(Object.entries({...filters,...changes}).filter(([key,value])=>['mode','subject','bank','chapter','section','status','q','type','run','start','after','autostart','order'].includes(key)&&typeof value==='string'&&value.trim()).map(([key,value])=>[key,value.trim()]));}
export function practiceSessionKey(filters){return 'growth-drill-session-v2:'+['mode','subject','bank','chapter','section','status','q','type'].map(key=>String(filters[key]||'').trim()).join('|');}
export function practiceResumeTarget(filters,current,recent){const unfinished=s=>s&&s.index<s.ids.length;const unfiltered=!['subject','bank','chapter','section','q','type'].some(key=>String(filters[key]||'').trim());if(unfiltered&&recent?.filters?.mode===filters.mode&&recent.filters.status===filters.status&&unfinished(recent.session))return recent;return unfinished(current)?{session:current,filters}:null;}
export function practiceAttemptId(session,id){return `round-${session.round}-${id}`;}
export function restorePracticeSession(value,validIds){
 if(!value||value.schemaVersion!==2||!Array.isArray(value.ids)||!value.ids.length||new Set(value.ids).size!==value.ids.length||typeof value.round!=='string'||!Number.isInteger(value.index)||value.index<0||value.index>value.ids.length)return null;
 const valid=new Set(validIds),ids=value.ids.filter(id=>typeof id==='string'&&valid.has(id));if(!ids.length)return null;
 const index=value.ids.slice(0,value.index).filter(id=>valid.has(id)).length,answers={};for(const [id,answer]of Object.entries(value.answers||{}))if(ids.includes(id)&&answer&&typeof answer.answer==='string'&&[true,false,null].includes(answer.correct))answers[id]=answer;
 return {...value,ids,index,answers,skipped:(Array.isArray(value.skipped)?value.skipped:[]).filter(id=>ids.includes(id)&&!answers[id]),policy:['random','related','ordered'].includes(value.policy)?value.policy:'random'};
}
// Recover a committed grade after the browser closed before the session callback ran.
export function reconcilePracticeSession(session,progress){if(!session)return session;let result=session;for(const id of session.ids){if(session.answers[id])continue;const event=progress.items?.[id]?.history?.find(item=>item.eventId===practiceAttemptId(session,id)&&item.action==='attempt');if(event&&[true,false,null].includes(event.correct)){if(result===session)result={...session,answers:{...session.answers},skipped:[...(session.skipped||[])]};result.answers[id]={answer:event.answer||'',correct:event.correct,rating:event.rating};result.skipped=result.skipped.filter(skipped=>skipped!==id);}}return result;}
export function advancePracticeSession(session,expectedId,{skip=false}={}){if(!session||session.ids[session.index]!==expectedId||!skip&&!session.answers[expectedId])return session;return {...session,index:session.index+1,skipped:skip&&!session.answers[expectedId]?[...new Set([...(session.skipped||[]),expectedId])]:session.skipped||[]};}
export function recordPracticeResult(session,expectedId,attempt){if(!session||session.ids[session.index]!==expectedId||session.answers[expectedId])return session;return {...session,answers:{...session.answers,[expectedId]:attempt},skipped:(session.skipped||[]).filter(id=>id!==expectedId)};}
