// Definitions and institutional teaching are deliberately distinguished.
// Exercises and derivations are original; publication dates are not verification dates.
export const SPEED_MATH_CHECKED_AT='2026-11-05';
export const speedMathSources=[
 {id:'nbs-percent',institution:'国家统计局',kind:'统计概念',title:'“百分数”与“百分点”',publishedAt:'2023-01-01',checkedAt:SPEED_MATH_CHECKED_AT,url:'https://www.stats.gov.cn/zs/tjws/tjbk/202301/t20230101_1912934.html',scope:'百分数描述相对关系，百分点描述两个百分数的差。'},
 {id:'nbs-development',institution:'国家统计局',kind:'统计概念',title:'发展速度',publishedAt:'2023-06-15',checkedAt:SPEED_MATH_CHECKED_AT,url:'https://www.stats.gov.cn/zs/tjll/sjxl/202306/t20230615_1940681.html',scope:'发展速度的基期、报告期与连乘关系。'},
 {id:'huatu-2026',institution:'华图教育',kind:'机构方法',title:'行测资料分析高频考点公式与速算汇总',publishedAt:'2026-09-11',checkedAt:SPEED_MATH_CHECKED_AT,url:'https://m.ha.huatu.com/2026/0911/6821134.html',scope:'基期、增长、比重与平均数的方法目录；本平台另行推导和检验公式。'},
 {id:'huatu-fractions',institution:'华图教育',kind:'机构方法',title:'2026国考：提高资料分析速度妙计',publishedAt:'2025-11-20',checkedAt:SPEED_MATH_CHECKED_AT,url:'https://ah.huatu.com/2025/1120/3150810.html',scope:'分数比较与估算的使用思路。'},
 {id:'fenbi-speed',institution:'粉笔教育',kind:'机构方法',title:'资料分析速算技巧',publishedAt:null,checkedAt:SPEED_MATH_CHECKED_AT,url:'https://www.fenbi.com/page/exam-preparation-material-detail/58/415735405629440',scope:'截位直除、百化分等方法。原页未明确发布日期；保留历史例题，不标为2026新题。'}
];
export function sourcesForTechnique(technique){return speedMathSources.filter(s=>technique?.sourceIds?.includes(s.id));}
