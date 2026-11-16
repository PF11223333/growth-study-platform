import assert from 'node:assert/strict';
import {backup,read,write} from '../server/store.mjs';

const book='https://www.lysrsks.cn/index.php/index/news/detail.html?id=2635';
const law='https://xzfg.moj.gov.cn/front/law/detail?LawID=1554';
const id='police-official-2027-organization-01';
const prompt='按《公安机关组织管理条例》划分，下列哪一项不属于公安机关人民警察的职务序列？';
const options={A:'警官职务序列',B:'警员职务序列',C:'警务技术职务序列',D:'辅警职务序列'};
const basis={title:'公安机关组织管理条例',article:'第十条至第十三条',url:law,effective:'国务院令第479号'};
const origin={title:'2027年度公安机关人民警察职位专业科目笔试考试大纲',article:'第四部分第一项单选示例',url:book};
const notes={
 A:'条例列明警官职务，履行警务指挥职责的人民警察实行这一序列。',
 B:'条例列明警员职务，履行警务执行职责的人民警察实行这一序列。',
 C:'条例列明警务技术职务，从事警务技术工作的人民警察实行这一序列。',
 D:'辅警承担相应警务辅助工作，辅警职务没有列入题问的人民警察三个职务序列，因此本题选择 D。',
};
const optionExplanations=Object.fromEntries(Object.entries(notes).map(([key,text])=>[key,{text,status:'已逐项核对',basis:[basis]}]));
const db=read();
assert.ok(!db.records.some(record=>record.id===id),'样题已经入库');
const keyCondition='题问人民警察的职务序列。记住三类与各自工作：警务指挥看警官、警务执行看警员、警务技术看技术职务。';
const question={origin:'official-sample',type:'single',prompt,options,verifiedText:true,referenceAnswer:'D',bookAnswer:'D',
 optionExplanations,explanation:{category:'公安组织管理',keyCondition,legalBasis:[basis]},
 tutorial:{authored:{title:'公安机关人民警察三个职务序列',origin:'2027国考官方大纲示例，题干简化，逐项解析为本站编写',scope:'本题逐项判断与规则应用',verifiedAt:'2026-11-16',body:`## 本题怎样判断\n\n${keyCondition}`,sources:[basis,origin]}}};
db.records.push({id,legacyId:id,kind:'practice',subject:'gongan',topic:'公安组织管理',title:'2027国考公安专业科目 · 大纲单选样题',body:prompt,date:'2026-11-16',origin:'official-sample',revision:1,links:[],tags:['公安官方样题'],sourceRefs:[{url:book,label:origin.title},{url:law,label:basis.title}],verificationStatus:'公开大纲样题 · 答案已核对',
 studyQuestion:{bank:'police-official-2027',origin:'official-sample',chapter:1,chapterName:'公安基础知识',sectionId:'organization',sectionName:'公安组织管理',number:1,type:'single',promptPreview:prompt,knowledgeKey:'police-organization-sequences'},details:{question}});
if(process.argv.includes('--write')){
 assert.equal(db.version,read().version);
 backup(db);
 write(db);
}
console.log(JSON.stringify({id,version:db.version}));
