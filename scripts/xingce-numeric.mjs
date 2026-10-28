const decimal='(-?\\d+(?:\\.\\d+)?)';
const round=n=>Number(n.toFixed(4)).toLocaleString('en-US',{useGrouping:false,maximumFractionDigits:4});
export function numericOptions(text){
 const parts=[...text.matchAll(/(?:^|\n)\s*([A-D])[.．、]\s*([^\n]+)/g)];
 if(parts.length!==4||new Set(parts.map(x=>x[1])).size!==4)return null;
 const options=Object.fromEntries(parts.map(x=>[x[1],x[2].trim().replace(/\u200b/g,'')]));
 const values=Object.fromEntries(parts.map(x=>{const value=x[2].trim().match(/^(-?\d+(?:\.\d+)?)\s*(万|亿)?\s*(%|％|倍)?$/);return [x[1],value?Number(value[1])*(value[2]==='万'?1e4:value[2]==='亿'?1e8:1):null];}));
 if(Object.values(values).some(v=>v===null))return null;
 return {options,values,start:parts[0].index};
}
export function solveNumericTutorial(text){
 const parsed=numericOptions(text);if(!parsed)return null;
 const prompt=text.slice(0,parsed.start).trim().replace(/\s+/g,' ');let result,formula,condition,memory,type;
 let m=prompt.match(new RegExp(`^现期\\s*=\\s*${decimal}，增长率\\s*=\\s*${decimal}%，求基期$`));
 if(m){const [a,r]=m.slice(1).map(Number);result=a/(1+r/100);formula=`${a} ÷ (1 ${r<0?'−':'+'} ${Math.abs(r)}%) = ${round(result)}`;condition='给现期量和增长率，回到基期要除以增长倍数。下降时增长率带负号。';memory='回到去年，除以一加增长率；下降则一减下降率。';type='基期量';}
 m=prompt.match(new RegExp(`^基期\\s*=\\s*${decimal}，增长率\\s*=\\s*${decimal}%。求现期$`));
 if(m){const [b,r]=m.slice(1).map(Number);result=b*(1+r/100);formula=`${b} × (1 ${r<0?'−':'+'} ${Math.abs(r)}%) = ${round(result)}`;condition='基期量是起点，现期量是基期加增长量，因此乘增长倍数。';memory='往后走，乘倍数；往前找，除倍数。';type='现期量';}
 m=prompt.match(new RegExp(`^现期\\s*=\\s*${decimal}，基期\\s*=\\s*${decimal}，求增长率$`));
 if(m){const [a,b]=m.slice(1).map(Number);result=(a-b)/b*100;formula=`(${a} − ${b}) ÷ ${b} × 100% = ${round(result)}%`;condition='增长率的分母是基期，不能用现期。先算多了多少，再与原来相比。';memory='多了多少除原来；分母始终是基期。';type='一般增长率';}
 m=prompt.match(new RegExp(`^现期\\s*=\\s*${decimal}，增长率\\s*=\\s*${decimal}%，求增长量$`));
 if(m){const [a,r]=m.slice(1).map(Number);result=a*r/(100+r);formula=`${a} × ${r}% ÷ (1 + ${r}%) = ${round(result)}`;condition='题目给的是现期，不是基期。先还原基期，再乘增长率。';memory='现期乘率，还得除一加率。';type='增长量';}
 m=prompt.match(new RegExp(`^A\\s*=\\s*${decimal}，a\\s*=\\s*${decimal}%，B\\s*=\\s*${decimal}，b\\s*=\\s*${decimal}%，求（ A ([+−-]) B ）的增长率$`));
 if(m){const [a,ra,b,rb]=m.slice(1,5).map(Number),sign=m[5]==='+'?1:-1,current=a+sign*b,base=a/(1+ra/100)+sign*b/(1+rb/100);result=(current/base-1)*100;formula=`基期 = ${a}÷(1+${ra}%) ${sign===1?'+':'−'} ${b}÷(1+${rb}%) = ${round(base)}；现期 = ${current}；增长率 = (${current}÷${round(base)} − 1)×100% ≈ ${round(result)}%`;condition='不能直接相加、相减两个增长率；先把两个主体的基期分别还原，再计算总量的增长率。';memory='量先合，率后算；两个增长率不能直接加减。';type='混合增长率';}
 if(!Number.isFinite(result))return null;
 const nearest=Object.entries(parsed.values).map(([letter,value])=>({letter,value,error:Math.abs(value-result)})).sort((a,b)=>a.error-b.error);
 if(nearest[0].error>Math.max(.11,Math.abs(result)*.012)||nearest[1].error<=nearest[0].error+1e-8)return null;
 const answer=nearest[0].letter,unit=/%|％/.test(parsed.options[answer])?'%':'';
 return {prompt,options:parsed.options,referenceAnswer:answer,result,formula,condition,memory,type,optionExplanations:Object.fromEntries(Object.entries(parsed.values).map(([letter,value])=>[letter,{status:'已逐项核对 · 公式独立验算',text:letter===answer?`按本题数据计算得 ${round(result)}${unit}，与本项 ${parsed.options[letter]} 最接近，符合题目的近似计算要求。`:`本项为 ${parsed.options[letter]}，与正确计算结果 ${round(result)}${unit} 相差 ${round(Math.abs(value-result))}${unit==='%'?' 个百分点':''}。请核对公式“${formula}”，不要仅凭数字相近选它。`,basis:[]}]))};
}
