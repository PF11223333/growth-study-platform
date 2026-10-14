// Original teaching prose; quotations and official sources checked 2026-10-14.
export const politicalReadings=[
 {title:'两个结合：魂脉与根脉',url:'https://www.samr.gov.cn/zt/ndzt/2023n/ztjy/zyjs/art/2023/art_95b6766eae4645b891aea1a6eefb08aa.html',quote:'马克思主义这个魂脉；中华优秀传统文化这个根脉。',verifiedAt:'2026-10-14',scope:'两个短语分别摘录自官方文章；中间分号为整理分隔。'},
 {title:'中共中央关于进一步全面深化改革、推进中国式现代化的决定',url:'https://www.miit.gov.cn/ztzl/rdzt/qhjs/art/2024/art_481a376a25b940afa47d24de0343a77e.html',quote:'以促进社会公平正义、增进人民福祉为出发点和落脚点',verifiedAt:'2026-10-14',scope:'2024年二十届三中全会决定的对应表述。'},
 {title:'新警务理念：全国公安厅局长座谈会精神',url:'https://gat.fujian.gov.cn/jwdt/gayw/202410/t20241020_6550532.htm',quote:'创新、主动、规范、协同、精细、务实',verifiedAt:'2026-10-14',scope:'福建省公安厅2024年10月传达会议精神的官方报道。'}
];
export const politicalTutorial={key:'lower-political-pairs',title:'政治术语配对：魂与根、改革出发点、新警务理念',origin:'根据官方政治文件与公安机关报道补写',scope:'政治知识教程，无单一对应法条；本题逐项判断以专门解析为准',verifiedAt:'2026-10-14',edited:true,sources:politicalReadings.map(s=>({...s,article:'官方文献'})),body:`### 先配对，再背关键词
“魂脉”对应马克思主义，“根脉”对应中华优秀传统文化。魂指思想指导，根指文化来源。不要把中国特色社会主义理论体系放到“根脉”位置。

### 题目为什么容易选错
几个选项可能都包含正确政治名词，但题目问的是特定文件里的固定对应关系。看见熟悉名词就选，会把同一体系、不同层次的词混在一起。

### 三组必须分开的表述
- 魂脉／根脉：马克思主义／中华优秀传统文化。
- 改革出发点与落脚点：促进社会公平正义、增进人民福祉。
- 新警务理念：创新、主动、规范、协同、精细、务实。

### 记忆与自测（编写）
口诀：“马魂中根；公平福祉；创主规、协精务。”口诀只帮助回忆，正式作答要还原完整表述。
先遮住答案，分别说出魂与根，再从另一套卷中找同类题；不要只记选项字母。`};
export function specificLowerLesson(paper,number){
 if(paper==='2025-national'&&number===1)return {...politicalTutorial,key:'lower-soul-root',title:'魂脉与根脉：为什么应选D',scope:'本题A—D逐项解释',body:politicalTutorial.body+`\n\n### 本题逐项辨析\nA：两个名称都属于思想理论范畴，后半并非“中华优秀传统文化”，配对错误。\nB：远大理想与共同理想是理想目标的区分，不是魂脉与根脉。\nC：全人类共同价值与社会主义核心价值观属于价值表述，不是本题两个概念。\nD：马克思主义与中华优秀传统文化，分别对应魂脉和根脉。\n\n### 这次怎样纠正\n你的红笔原选项A换成D。错误发生在“术语配对”这一知识点；是否因未记住原文、看快了或其他原因，需要你在错因栏确认。`};
 if(paper==='2025-national'&&number===4)return {...politicalTutorial,key:'lower-police-six',title:'六大新警务理念：排除近义词替换',scope:'本题A—D逐项解释',body:`### 本题的决定条件\n官方表述是“创新、主动、规范、协同、精细、务实”，应选B。\n\n### 逐项为什么对或错\nA将“创新、精细”替换为“改革、实战”，不是所问的固定表述。\nB六个关键词完整对应官方表述。\nC含“联动、专业、智能、共享、综合”等相近警务术语，但不是这一组概念。\nD也替换了若干关键词，不能凭“听起来积极”判对。\n\n### 例子与口诀（编写）\n数据研判先发现风险再部署警力，可帮助理解“主动”；跨部门共同处置可帮助理解“协同”。这些例子帮助理解，不构成独立法律依据。\n口诀“创主规，协精务”，背完要还原六个完整词。\n\n### 下次如何避坑\n你原选C，容易混的是相近政策词组。先确认题干问哪次会议、哪一组表述，再判断选项。`};
 return null;
}
