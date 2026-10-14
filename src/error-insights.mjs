
export const reasonLabels={reading:'审题漏条件',concept:'概念或罪名混淆',rule:'法条条件与例外',procedure:'程序步骤与管辖',numbers:'期限、年龄与数字',memory:'知识点没记牢',selection:'漏选或误选',time:'时间不足或猜答',unknown:'尚未归因'};
export function suggestReason(text=''){if(/漏选|多选|误选/.test(text))return 'selection';if(/固定表述记忆|设立警察节|首次过节|抗日|土地革命|军委公安部|中央人民政府公安部|时序|年代/.test(text))return 'memory';if(/年龄|期限|数字|时限/.test(text))return 'numbers';if(/管辖|程序|步骤/.test(text))return 'procedure';if(/例外|法条条件/.test(text))return 'rule';if(/概念|混淆|误判|推论|解释|侵占|故意|过失/.test(text))return 'concept';return 'unknown';}
export function summarizeErrors(records,progress={items:{}},subject=''){
 const rows=records.filter(r=>!r.archived&&(!subject||r.subject===subject)&&(r.kind==='error'||r.studyQuestion?.historicalWrong||progress.items?.[r.id]?.isWrong));
 const confirmed={},suggested={},topics={};let attempts=0,wrongAttempts=0,mastered=0,confirmedCount=0;
 for(const r of rows){const p=progress.items?.[r.id]||{},reason=p.errorReason||r.errorReason,proposal=r.errorAnalysis?.reason||suggestReason(r.errorAnalysis?.category||'');if(reason&&reason!=='unknown'){confirmed[reason]=(confirmed[reason]||0)+1;confirmedCount++;}else suggested[proposal]=(suggested[proposal]||0)+1;const topic=r.studyQuestion?.sectionName||r.topic||'待归类';topics[topic]=(topics[topic]||0)+1;attempts+=p.attempts||0;wrongAttempts+=p.wrongCount||0;if(p.mastered)mastered++;}
 return {rows,total:rows.length,active:rows.length-mastered,mastered,historical:rows.filter(r=>r.studyQuestion?.historicalWrong).length,confirmedCount,confirmed,suggested,topics,attempts,wrongAttempts,pending:records.filter(r=>(!subject||r.subject===subject)&&r.studyQuestion?.wrongCandidate&&!progress.items?.[r.id]?.isWrong&&!progress.items?.[r.id]?.dismissed).length};
}
