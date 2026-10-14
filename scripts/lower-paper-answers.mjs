// Red original choices visually transcribed from complete renders, never inferred from the key.
const row=text=>text.trim().split(/\s+/).map(s=>s==='?'?'': [...new Set(s)].sort().join(''));
export const lowerRedAnswers={
 '2022-academy':row(`
 A B C D A B B B B D
 A C D C C D A B D C
 A B D B A C B B D A
 C C A B D A B C D B
 B B C D B D C D D B
 ACD ACD ACD ABCD AB AC AB AB AC BCD
 ABCD AD CD AB BD CD ABCD AB BD D
 ABD D ACD B ACD B B C B C
 ABC BC D ABCD AB A ABCD C D C
 A AD A ABCD B C A D B C`),
 '2023-academy':row(`
 B ? D A D C D C B C
 C C A A B ? C D ? B
 A ? D D C D ? C C D
 ? B D A C D C B A A
 D D A ? D C A D C B
 ABD ABD AC BCD ? BC C ABD CD AB
 AC ACD ABC BCD ABD ? BD ACD ABCD ABCD
 ACD D C ABC B ? A A B BCD
 A B CD A ABCD ? ? A ? ?
 ? ABC AC B D B BD ABD C A`),
 '2024-tianjin':row(`
 B A D D C D C D A ?
 D A D A B B C ? D C
 C C B C ? D A D C D
 ? D B B A B C ? B C
 C A B D C B ? D D C
 C CD ACD ABC ? ? BD BCD BC BCD
 ACD AD ? BC ABCD ACD ABC BCD AD ABC
 C B AD BCD ABC AD A C D D
 CD B ? BD ABCD C BD A B A
 ABC ABC ? B B ? B B ABC ABCD`),
 '2024-heilongjiang':row(`
 A D B A D A B A C C
 D ? A D B A B ? B D
 A B B D C B B C D D
 ? B A ? ? D A A C C
 ? ? ? ABCD BCD BD B ? D ABCD
 ABCD ? BCD B D ABCD B A ABD C
 ? ? D CD D`),
 '2024-national':row(`
 A C A D B C D A C B
 ? D C C B C ? A C C
 D A C B A D D C C D
 C D C D B D C A B C
 B BD D B B A B ? ? A
 ABCD ABD BCD ABC AD ABC ACD ACD AB AC
 AB CD ABC AC C AB ABC BD ? AC
 B ABCD D C ? ABC C D A D
 D ACD C A BC D B C AB D
 C ACD B A B ABD CD BD A D`),
 '2024-provinces':row(`
 B B D A B A B C B D
 C C B A D C C ? B D
 B C B A D C D A A D
 C D D B C D C ? D C
 C A B B B ? ? A A B
 ABCD ABCD ABC AC ABCD BD AB AB ABD AD
 AC ? ABD BC BD AC ABD BC ABCD BC
 ABD A B BC C ABC A B ABCD C
 C D D B ABD D ? C ABCD D
 ABD B D ABD C D D C A ACD`),
 '2025-jiangsu':row(`
 C C B C B A C C B D
 D D B C A D B B A A
 C A A B C C B A C A
 A D B ? A D D B D C
 BD ABC AB ABC ACD ABC ABCD AC ACD ABCD
 ABCD ABCD CD ABD BC CD A CD ABCD ABC
 ACD ABC CD ? BD BD D AB AB CD
 ABC A D ? D B ABC C ? AB
 D D B ABC AD ? BD AB ? ABC
 B ABD ? C B A B B ABC D`),
 '2025-guangdong':row(`
 A A C C A A C A B A
 A C D A B C ABC ABCD BC BCD
 ABD BCD BD ABCD ABC ABC ABD ABD ? CD
 ABCD ABCD B B CD C ABCD C ABCD ABCD`),
 '2025-national':row(`
 A D B C B C A C D A
 ? D D C A A D C D B
 D C ? A B D A C A C
 D A C D A A B C D ?
 B A D D B D B D A B
 ACD ABC ABCD ABD BD ? AB ABCD CD BCD
 CD AB ABC ABD BD AB ABCD ABCD CD ABCD
 A ABCD B C A C ABCD D ACD D
 ABD C C C ABC ? BCD C D D
 A ABC A ABCD AB ABCD A A D A`),
 '2025-provinces':row(`
 D B A A C B C C B C
 A C A C B D A D C A
 C A C D D A D D C ?
 A C D D A ? B C C D
 B A D ? B C A C D C
 ABCD ABC ACD ABC ? ? BD ABC BD ABCD
 ACD ABD BC CD AB ABC ? AD ? ABCD
 C A A ? A A D ? ABC B
 CD B AB ABD CD ABCD ? C B B
 A C A A BC D ABC ? A ABC`),
 '2026-guangdong':row(`
 C D B B D C A B A A
 C C A D A C AB BCD ABCD BD
 BCD ACD AC AB ACD BC AC ABCD ABCD ACD
 AC ABCD ABCD D BD C C A BCD ABC`),
 '2026-national':row(`
 D A C A C A D A B A
 D B ? A D C A D B A
 A D A C A ? D D B A
 ? C C B A D B A C D
 C B ? C D ? B C B C
 ABCD D ? AD AC AD ABD ABC AB ABCD
 ACD ? ACD ABD CD CD ACD BD AC ?
 ? B B ABC ? ? D ACD A C
 ABCD ? B ? C B D ABD ? ?
 D D ABD C C CD ? ABC B D`),
 '2026-provinces':row(`
 A A B D A A B A A D
 D C D C A C C C D D
 D ? B B B D A D C A
 B B D C B B A D C B
 A ? ? ? A C C A B A
 ABD ABCD ABCD ACD CD ABD ? ABC BD ABD
 BD AB ABC BCD BD ABD AD BCD ABC AC
 C ? A C A ABC C BC A C
 ABCD BC A ABC A C C CD ? A
 B ABC D C A BCD ABCD B A BC`),
};
export const lowerAnswerNotes={
 '2022-academy':{55:'蓝笔ABC与卷末ABCD不一致；红笔AB在两种口径下均漏选。',54:'已对照完整原页，红笔是ABCD；不能把裁切漏掉的A当作漏选。'}
};
const corrections={
 '2023-academy':{2:'A',16:'A',19:'A',27:'A',31:'A',44:'B',55:'AC',66:'ABC',76:'ABD',86:'C',87:'A',89:'B',90:'A',91:'C',98:'ABC'},
 '2024-heilongjiang':{12:'B',18:'D',31:'B',34:'A',35:'B',41:'ABCD',42:'AB',43:'ACD',52:'ABC',61:'ABCD',62:'B'},
 '2024-tianjin':{10:'A',18:'D',25:'D',31:'D',38:'B',47:'B',55:'ABC',63:'AB',83:'ABC',93:'ABD',96:'ABCD'},
 '2024-national':{11:'C',17:'B',34:'',48:'A',49:'A',69:'AB',75:'A'},
 '2024-provinces':{18:'D',38:'A',46:'C',47:'C',62:'AD',87:'A'},
 '2025-jiangsu':{34:'C',64:'B',74:'D',79:'C',86:'D',89:'A',90:'ACD',91:'',92:'B',93:'ABD',98:'B',99:'ABC'},
 '2025-guangdong':{28:'ABC',29:'ABD'},
 '2025-national':{11:'B',23:'D',40:'C',56:'ABCD',86:'C'},
 '2025-provinces':{30:'D',36:'D',44:'D',55:'ABC',56:'BC',67:'AC',74:'D',87:'B'},
 '2026-national':{13:'B',26:'A',31:'C',43:'A',46:'C',52:'ABD',53:'ABC',62:'ABD',70:'BCD',71:'C',75:'A',76:'C',82:'C',84:'BCD',89:'A',90:'B',97:'C'},
 '2026-provinces':{22:'C',42:'D',43:'D',44:'A',57:'BC',72:'AC',89:'C'}
};
for(const [paper,rows] of Object.entries(corrections))for(const [number,value] of Object.entries(rows))lowerRedAnswers[paper][Number(number)-1]=[...new Set(value)].sort().join('');
// Manually inspected circled question number PLUS a separate blue correction matching the printed key.
// The original red choice remains unknown. Colour presence alone is never sufficient.
export const lowerConfirmedWrong={
 '2024-heilongjiang':{48:{page:65,answer:'ABCD',evidence:'完整原页第48题蓝色圈题号及独立ABCD订正，与卷末一致；红笔原选项未辨清。'}},
 '2025-provinces':{
  69:{page:228,answer:'BD',evidence:'完整原页第69题蓝圈与BD订正一致卷末；红色计算笔记与原选项不能分清。'},
  78:{page:233,answer:'C',evidence:'完整原页蓝圈78及C订正一致卷末；红笔原选项未辨清。'},
  98:{page:239,answer:'B',evidence:'完整原页蓝圈98及B订正一致卷末；红色划线不能可靠确定原选项。'}
 }
};
