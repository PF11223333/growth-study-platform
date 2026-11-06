const labels={
 'police-lower-20261014':'公安小题狂刷（下）·13套',
 'police-drill-20260917':'公安小题狂刷（上）',
 'community-20261105':'社区警务练习题',
 'police-thinking-20261105':'桐哥公专 · 思维提升',
 'police-thinking-pages-20261106':'思维提升 · 原页自测组',
 'xingce-tutorial':'行测原上传教程',
 'knowledge-quizzes':'已有知识自测',
 reinforcement:'自编巩固新题',uploaded:'手动录入题目',
};
export function practiceBanks(records,subject=''){
 const banks=new Map();
 for(const row of records){const q=row.studyQuestion;if(!q?.bank||subject&&row.subject!==subject)continue;const existing=banks.get(q.bank);if(existing){existing.count++;existing.groupCount+=q.groupOnly?1:0;}else banks.set(q.bank,{id:q.bank,label:labels[q.bank]||q.bankName||'其他题库 · '+q.bank,count:1,groupCount:q.groupOnly?1:0});}
 for(const bank of banks.values())bank.countLabel=bank.groupCount===bank.count?bank.count+'组':bank.groupCount?`${bank.count-bank.groupCount}题 / ${bank.groupCount}组`:bank.count+'题';
 return [...banks.values()].sort((a,b)=>{const order=Object.keys(labels),ai=order.indexOf(a.id),bi=order.indexOf(b.id);return (ai<0?99:ai)-(bi<0?99:bi)||a.label.localeCompare(b.label,'zh-CN');});
}
export function practiceCountLabel(records){const groups=records.filter(row=>row.studyQuestion?.groupOnly).length,questions=records.length-groups;return groups?(questions?`${questions}题 / ${groups}组`:`${groups}组`):`${questions}题`;}
