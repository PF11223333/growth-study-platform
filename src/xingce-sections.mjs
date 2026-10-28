export const xingceSections = [
 {id:'data',label:'资料分析',line:'先找数据，再找关系。',description:'基期、现期、增长量与增长率，把每一步算明白。'},
 {id:'figure',label:'图形推理',line:'看清图形，找到变化。',description:'位置、样式、属性与面，保留原图和课堂讲解。'},
 {id:'verbal',label:'言语',line:'回到原句，读懂用法。',description:'中心理解、细节判断、语句与填空，按原教程练习。'},
 {id:'common',label:'常识',line:'让知识有来处。',description:'历史、科技、法律与生活常识，做题后回到资料卡。'},
 {id:'politics',label:'政治理论',line:'分清概念，联系实际。',description:'理论、政策和时政资料单独积累，不与其他常识混排。'},
];
export function xingceSection(item){
 const explicit=item?.studyQuestion?.xingceSection||item?.details?.xingceSection;
 if(xingceSections.some(s=>s.id===explicit))return explicit;
 const section=String(item?.studyQuestion?.sectionId||'').replace(/^xingce-/,'');
 if(xingceSections.some(s=>s.id===section))return section;
 const text=[item?.title,item?.topic,...item?.tags||[],item?.details?.module,item?.details?.canonicalModule].filter(Boolean).join(' ');
 if(/政治理论|习近平|马克思|毛泽东|邓小平|三个代表|科学发展观|新发展理念|中国式现代化|党的|党史|党建|时政|中央|共同富裕|全过程人民民主|高质量发展|新质生产力/.test(text))return 'politics';
 if(/图形|图推|位置规律|样式规律|对称|黑白块|面数量|六面体/.test(text))return 'figure';
 if(/言语|逻辑填空|中心理解|语句|细节判断|词语|成语|语境|标题填入|接语|下文推断/.test(text))return 'verbal';
 if(/资料分析|增长|基期|现期|比重|ABRX|百分|平均数|份数|统计图|速算/.test(text))return 'data';
 return 'common';
}
