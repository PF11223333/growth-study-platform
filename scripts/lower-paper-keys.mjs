// Transcribed against complete rendered original answer pages, 2026-10-14.
const row=(text)=>text.trim().split(/\s+/);
export const lowerPapers=[
 {id:'2022-academy',title:'2022 公安院校联考',start:5,end:27,keyPage:28,single:50,multi:70,keys:row(`
 A B C D A A B B A B
 A C D C B D A B B D
 A B B B B C B B D A
 C C A B C D B B B B
 C C C D C D C D D B
 ABCD ACD ACD ABCD ABCD ABC AB ABC ACD BC
 ABCD AD AC AB BC CD AC ABD BCD BCD
 ABCD D ABCD D ABCD B A C B C
 ABD ABCD C ABC AB C ABC B C C
 A AD A ABCD B C A C A A`),notes:{},handwrittenScore:54,scorePage:5},
 {id:'2023-academy',title:'2023 公安院校联考',start:29,end:53,keyPage:54,single:50,multi:70,keys:row(`
 D A D A D A D B B C
 B D A A B A C D A D
 A ? D A C C A C C D
 C B D A B D C B C C
 D D A B C C A D C D
 ABD ABCD ABD ABCD AC BC ABCD BD BCD ABCD
 AD CD BC ACD ABC AB AC ACD BD AB
 ABCD D C ABCD B BCD B A BD BCD
 A B CD C ABCD C D ACD B B
 B AB AC C A B ABC ABC C A`),notes:{22:'卷末标注“无”，不强行判分。'}},
 {id:'2024-heilongjiang',title:'2024 黑龙江秋考（收录65题）',start:55,end:71,keyPage:72,single:40,multi:50,keys:row(`
 B C A D A A A D C C
 A B A D B A C D D A
 D B B A C B B D C C
 B C D B C D A C C A
 ABCD AB AC ABCD BCD BCD AB ABCD ABCD ABCD
 B AC ABD B D ABCD ABC B ABD C
 ABCD B D CD D`),notes:{},handwrittenScore:73,scorePage:72},
 {id:'2024-tianjin',title:'2024 天津',start:73,end:92,keyPage:93,single:50,multi:70,keys:row(`
 B B D D C B C D A D
 D A D A B B C D D C
 C C B C D D B D C D
 D C C C A C C B B C
 D C B B C C B D D C
 AC BC BCD ABC ABC ABD ABCD ABCD BC AD
 AC AD ABCD ABCD ABCD ACD ABC ABC AD AC
 B B AB ABCD AB AD A C A D
 ABCD B ABC B ABCD C BCD A B D
 C ABC ABD B B ABC B B ABC ABCD`),notes:{}},
 {id:'2024-national',title:'2024 国考',start:95,end:121,keyPage:122,single:50,multi:70,keys:row(`
 A B A D B C D A C B
 C D C A C C D A D C
 A A C C B D D A C D
 C D C B B D C A B C
 ? BD A A B A B B A B
 ABC ABD ABCD BC AD ABC ACD ABCD AB AB
 ACD CD AB AC CD ABC BCD BD AC BC
 B ABC D C A ABC A D A D
 D AD C B BC D B C AB D
 D ACD C B BC ABCD AB AB A D`),notes:{39:'卷末标注B【争议】。',41:'卷末明确“无答案”。',42:'单选区卷末印“BD”，题型与答案矛盾。'}},
 {id:'2024-provinces',title:'2024 多省',start:123,end:151,keyPage:152,single:50,multi:70,keys:row(`
 A B C A B A B C B D
 C C D A D C C D B D
 B C D A D C D A A B
 C B D C B A C A D C
 A A B D B C C A A D
 ABC BCD ABCD ACD ABCD BD AB CD ABC AD
 ACD CD ABD BC CD ABC AD ABCD ABC AC
 ABCD B B AD C CD D B BCD B
 D B D B ABD C AC C ACD D
 ABD B C ABC B D D C A ACD`),notes:{31:'卷末标注“争议题”。'},handwrittenScore:61,scorePage:152},
 {id:'2025-jiangsu',title:'2025 江苏',start:153,end:169,keyPage:170,single:40,multi:60,keys:row(`
 C C B B A B C C B D
 D D B C B D B B C A
 C B C A C D B C A A
 A B B C A A C B C D
 BD ABC ABCD ABCD ACD ABC ABD BC AD ABD
 ABCD ABCD CD ABD BC ACD ABC BC ABCD AC
 ACD ABCD ACD B AB BCD C ABC AC AC
 BC D B D C B BD B B AB
 ? D D AB A D BD ABD A ABCD
 A B AB C B A B D BD D`),notes:{81:'卷末标注“模糊”，题目或答案无法可靠还原。'},handwrittenScore:56,scorePage:170},
 {id:'2025-guangdong',title:'2025 广东（收录40题）',start:171,end:178,keyPage:179,single:16,multi:32,keys:row(`
 B C C C A A C A B A
 D C D A B C ABCD ABCD BC ABD
 ABCD ABCD ABD ABCD ABCD ABCD ABD ABC ABD BCD
 ABCD ABCD C B BC C ABCD C ABCD ABCD`),notes:{}},
 {id:'2025-national',title:'2025 国考',start:181,end:208,keyPage:209,single:50,multi:70,keys:row(`
 D A C B B C A C D B
 A B D B A A D C D B
 C C D D B D A C A C
 D A C D A B B C D A
 B C D C B D B D A D
 BC AC ACD ABD BD ABCD ABCD AC BCD BD
 CD AB ABC ABD AD AB ABCD ABCD BCD AD
 A ABC B A C D ABC B ABCD D
 ABD D C C AB C BCD C B D
 B ACD B ABCD BD C A A D A`),notes:{},handwrittenScore:61,scorePage:209},
 {id:'2025-provinces',title:'2025 多省',start:211,end:239,keyPage:240,single:50,multi:70,keys:row(`
 C B A B C A C A C C
 A A C A C D A D B C
 C A C D B A D D C D
 A D A C A D B C C B
 B D B D B C D D C D
 ACD ABC ACD ABCD ABCD AC BD ABC ABD ABCD
 ACD ABCD BCD CD ABC AC AC ACD BD ABD
 A A ABD B A A ABCD C ABC B
 AD B AB AB BC ACD B C B B
 A CD A D AD D AB B A AB`),notes:{}},
 {id:'2026-guangdong',title:'2026 广东（收录40题）',start:241,end:246,keyPage:247,single:16,multi:32,keys:row(`
 D D B C A C A B C C
 A C B D D C AB BCD ABCD ABD
 ABD CD AC AB AB BCD AC AD ABCD ABCD
 AC ABCD ABCD C BD A C A BCD ABC`),notes:{}},
 {id:'2026-national',title:'2026 国考',start:249,end:269,keyPage:270,single:50,multi:70,keys:row(`
 D A C A B A C A B A
 D B B A D C A D B D
 C D A C D A A D B D
 A C C B A D B A A D
 A C A A D C B C B B
 ACD ABD ABC AB AC AD ABD ABC AC ABCD
 BCD BD BCD ABCD AC CD ACD ABD ABD BC
 C B B ABC A C D ACD A C
 ACD B B BCD C C D ABD A B
 BCD BCD ABD C B CD D ABC B D`),notes:{36:'卷末印D（CD中D择优），保留教材择优口径，不把C单独当作毫无争议的错项。'},handwrittenScore:71,scorePage:270},
 {id:'2026-provinces',title:'2026 多省',start:271,end:293,keyPage:294,single:50,multi:70,keys:row(`
 B A B D A A B C A C
 D B D D D B D B D D
 A C A A B B A D C A
 B B D C B B A D C C
 C D A A B C C D C B
 ACD ABD ACD ACD CD AD CD ABCD BD ABD
 ABD AB ABC BCD BD ABD AD CD ABCD AC
 C AC A C A ABC D ABC A B
 ABCD B C ABC D C C BCD D D
 C AC D C A BCD AB B A BC`),notes:{}}
];
for(const p of lowerPapers){if(![40,65,100].includes(p.keys.length))throw new Error(`${p.id}: unexpected key count ${p.keys.length}`);p.count=p.keys.length;}
