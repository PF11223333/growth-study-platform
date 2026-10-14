export const classifyTopic=(text='')=>{
 const rules=[['政治理论与时政',/习近平|二十大|党中央|党的|党组织|新时代|马克思主义|国家安全观|共产主义|中国式现代化|中国特色社会主义|政治制度|法治思想/],['职业道德与纪律',/职业道德|纪律|警察节|从警|廉洁|忠诚|执法为民|公安历史|从严治警|警察核心价值/],['信息与情报分析',/同比|环比|占比|统计|下图|下表|根据图|根据表|图表|图示|比对|图\s*1|表\s*1|数据|情报|视频|信息化|研判|互联网|网络|监控|轨迹/],['刑事程序与证据',/犯罪嫌疑人|侦查|讯问|取保|拘传|羁押|逮捕|刑事诉讼|搜查|辨认|鉴定|证据/],['刑法与犯罪认定',/刑法|犯罪|故意杀人|正当防卫|盗窃|抢劫|罪名|自首|共同犯罪/],['行政执法与治安',/行政|治安|处罚|拘留|传唤|扣押|盘问|复议|强制|调解/],['民法与宪法法理',/民法|宪法|立法|监护|合同|权利|赔偿|法律规则|国家机构|法律|人大|代表大会|法治|法制/],['警务实战与安全',/现场|警械|武器|枪|火灾|爆炸|突发|警情|疏散|救助|急救|巡逻|交通/],['群众工作与基层治理',/群众|社区|基层|派出所|宣传|户籍|居民|纠纷|沟通|矛盾/],['警察职责与监督',/人民警察|公安机关|监督|公安局|职权|职责|公安权力|公安职能|公安工作|检察院|监察/]];
 return rules.find(([,r])=>r.test(text))?.[0]||'其他与综合题';
};
export function gradeLower(row){
 if(row.keyNote||!row.referenceAnswer||row.referenceAnswer==='?'||(row.type==='single'&&row.referenceAnswer.length!==1))return 'excluded';
 if(row.confirmedWrong)return 'wrong';
 if(!row.originalAnswer)return 'pending';
 return [...new Set(row.originalAnswer)].sort().join('')===row.referenceAnswer?'correct':'wrong';
}
export function summarizeLower(papers,questions){
 const make=rows=>{const counts={correct:0,wrong:0,pending:0,excluded:0};for(const q of rows)counts[gradeLower(q)]++;const eligible=rows.length-counts.excluded;return {...counts,total:rows.length,eligible,known:counts.correct+counts.wrong,coverage:eligible?(counts.correct+counts.wrong)/eligible:0,lower:eligible?100*counts.correct/eligible:0,upper:eligible?100*(counts.correct+counts.pending)/eligible:0};};
 const results=papers.map(p=>({...p,keys:undefined,notes:undefined,...make(questions.filter(q=>q.paperId===p.id))}));
 const types=Object.fromEntries(['single','multi','case'].map(t=>[t,make(questions.filter(q=>(q.groupType||q.type)===t))]));
 const topics=Object.fromEntries([...new Set(questions.map(q=>q.topic))].map(t=>[t,make(questions.filter(q=>q.topic===t))]));
 let omissions=0,extras=0,both=0;for(const q of questions.filter(q=>q.originalAnswer&&gradeLower(q)==='wrong'&&q.referenceAnswer.length>1)){
  const missing=[...q.referenceAnswer].some(s=>!q.originalAnswer.includes(s)),extra=[...q.originalAnswer].some(s=>!q.referenceAnswer.includes(s));if(missing&&extra)both++;else if(missing)omissions++;else if(extra)extras++;
 }
 return {papers:results,...make(questions),averageLower:results.reduce((sum,p)=>sum+p.lower,0)/results.length,averageUpper:results.reduce((sum,p)=>sum+p.upper,0)/results.length,types,topics,multiErrors:{omissions,extras,both},method:'逐套等权平均；每套以非争议收录题为分母、每题等权折算100分。多选严格全匹配，漏选或多选不得分。待确认不判错，用分数上下界表示；争议及无答案题剔除。此为本书练习口径，不冒充原考试官方计分。'};
}
