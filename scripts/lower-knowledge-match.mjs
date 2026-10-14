// Choose an existing textbook-linked memory topic before a broad chapter fallback.
const pairs=[
 ['source-layers',/识别稿|OCR/],['four-plus-two',/治安处罚.*种类|治安管理处罚.*种类|限期出境|驱逐出境/],
 ['continue-special',/继续盘问.*(?:孕|婴|16|70)|(?:孕|婴|16|70).*继续盘问/],['continue-time',/继续盘问|候问室/],
 ['inquiry-time',/询问查证|传唤.*(?:小时|时间|时限)/],['summons-person',/证人.*传唤|强制传唤/],
 ['bail',/取保候审|监视居住|保证人|保证金/],['recusal',/回避/],['supplement-investigation',/补充侦查/],
 ['detain-arrest',/批准逮捕|提请批准|刑事拘留|先行拘留/],['custody-time',/侦查羁押|羁押期限/],
 ['evidence',/证据|辨认|鉴定/],['questioning',/讯问|询问证人/],['search-inspection',/搜查|勘验|检查.*住所/],
 ['crime-stages',/犯罪预备|未遂|中止/],['joint-crime',/共同犯罪|主犯|从犯|胁从|教唆/],
 ['criminal-age',/刑事责任.*年龄|刑事责任.*周岁/],['defense',/正当防卫|防卫过当/],['necessity',/紧急避险/],
 ['confession',/自首|坦白/],['theft-fraud',/盗窃|抢劫|抢夺|诈骗罪|侵占/],['objective-fault',/间接故意|过失|过于自信/],
 ['limitation',/诉讼时效/],['civil-capacity',/民事行为能力/],['guardian',/监护|未成年.*合同/],
 ['reconsideration',/复议|救济途径/],['first-offense',/首违|初次违法|不予处罚/],['nonexecution',/不执行.*拘留|拘留.*不执行/],
 ['fine',/当场.*罚款|罚款.*当场|派出所.*罚款/],['hearing',/听证/],['case-deadline',/办案期限/],
 ['single-officer',/一人执法|一名.*警察.*简易/],['mediation',/调解/],['property',/扣押|收缴|追缴/],
 ['jurisdiction',/管辖/],['legal-effect',/法律效力|新法|旧法|法律冲突/],['constitution-change',/修宪|修改宪法/],
 ['state-organs',/人大|代表大会|国家机构/],['rights-duties',/宪法.*权利|受教育|劳动权/],['norms',/法律规则|授权性|义务性|权义复合/],
 ['ethics',/职业道德|忠诚|廉洁/],['discipline',/纪律|辞退|警服|处分/],['illegal-order',/违法命令|非法命令/],
 ['weapons-boundary',/武器|枪|警械/],['emergency',/火灾|爆炸|燃气|应急|疏散|危险品/],
 ['charts',/占比|同比|环比|百分|统计|下图|下表|根据图|根据表|图表|表1|图1/],['data-collision',/碰撞|研判|比对|信息.*核实/]
];
export function matchLowerKnowledge(prompt,fallback){return pairs.find(([,pattern])=>pattern.test(prompt))?.[0]||fallback;}
