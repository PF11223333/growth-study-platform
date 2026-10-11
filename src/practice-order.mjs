function shuffle(rows,random){const result=[...rows];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}return result;}
export function knowledgeKey(row){const q=row.studyQuestion||{};return q.knowledgeKey||q.parentId||`${row.subject}:${q.sectionId||row.topic||'general'}`;}
export function buildPracticeQueue(rows,{policy='related',progress={items:{}},startId='',previousId='',today='',random=Math.random}={}){
 const unique=[...new Map(rows.map(r=>[r.id,r])).values()];if(policy==='ordered')return unique.map(r=>r.id);
 const priority=r=>{const s=progress.items[r.id];return s?.nextReview&&s.nextReview<=today?0:s?.isWrong&&!s.mastered||r.studyQuestion?.historicalWrong&&!s?.mastered?1:!s?.attempts?2:s.mastered?4:3;};
 let pool=shuffle(unique,random).sort((a,b)=>priority(a)-priority(b));
 const start=pool.findIndex(r=>r.id===startId);if(start>=0)pool.unshift(...pool.splice(start,1));
 else if(pool.length>1&&pool[0].id===previousId){const next=pool.findIndex((r,i)=>i>0&&priority(r)===priority(pool[0]));if(next>0)[pool[0],pool[next]]=[pool[next],pool[0]];}
 if(policy==='random')return pool.map(r=>r.id);
 const result=[];let sameCount=0;
 while(pool.length){let index=0;if(result.length){const last=result.at(-1),key=knowledgeKey(last);if(sameCount<2){const related=pool.findIndex(r=>knowledgeKey(r)===key);if(related>=0)index=related;}else{const different=pool.findIndex(r=>knowledgeKey(r)!==key);if(different>=0)index=different;}}
  const [row]=pool.splice(index,1);sameCount=result.length&&knowledgeKey(result.at(-1))===knowledgeKey(row)?sameCount+1:0;result.push(row);
 }
 return result.map(r=>r.id);
}
