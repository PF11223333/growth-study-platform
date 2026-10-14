
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {read,write,backup,atomic,DATA,hash} from '../server/store.mjs';
import {parseLawText,enrichMemoryEvidence} from './memory-evidence.mjs';
const sources=[
 ['security','治安管理处罚法（2025修订）','https://jtgl.beijing.gov.cn/jgj/jgxx/flfg/fl/744006073/index.html','2026-01-01'],
 ['admin','公安机关办理行政案件程序规定（2020修正）','https://jtgl.beijing.gov.cn/jgj/jgxx/flfg/gabgz/744068792/index.html'],
 ['crime','刑法（所列相关条文）','https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/bgt/art/2025/art_890f1333b6284c3cbb225c3cd2647c4b.html'],
 ['police','人民警察法（2012修正）','https://www.beijing.gov.cn/zhengce/zhengcefagui/qtwj/201301/t20130101_1162187.html'],
 ['constitution','宪法（2018修正）','https://www.mofcom.gov.cn/xxgcxjpxsdzgtsshzysx/zywj/art/2018/art_45c1e16fe351469090d53e63178268c8.html'],
 ['force','行政强制法','https://www.stats.gov.cn/gk/tjfg/xgfxfg/202503/t20250306_1958900.html'],
 ['legislation','立法法（2023修正）','https://commerce.suzhou.gov.cn/szsswj/fgyjd/202311/3ed461f6adc740b8a8dcf0d18a9d7b6a.shtml']
];
sources.push(...[["procedure","公安机关办理刑事案件程序规定（2020修正）","https://jtgl.beijing.gov.cn/jgj/jgxx/flfg/gabgz/125090/index.html"],["continuation","公安机关适用继续盘问规定（2020修正）","https://jtgl.beijing.gov.cn/jgj/jgxx/flfg/gabgz/744068796/index.html"],["civil","民法典","https://www.cac.gov.cn/2020-06/01/c_1592561777268319.htm"],["penalty","行政处罚法（2021修订）","https://zjw.beijing.gov.cn/bjjs/xxgk/543346069/543346066/325730370/index.shtml"],["reconsideration","行政复议法（2023修订）","https://www.mee.gov.cn/ywgz/fgbz/fl/202312/t20231205_1058240.shtml"],["supervision","监察法（2024修正）","https://www.stats.gov.cn/gk/tjfg/xgfxfg/202503/t20250310_1958921.html"],["weapons","人民警察使用警械和武器条例","https://gaj.cq.gov.cn/zwgk/zfxxgkml/zcwj/xzfg/202402/t20240206_12912119.html"],["emergency","突发事件应对法（2024修订）","https://yjglj.sh.gov.cn/xxgk/xxgkml/zcfg/gjfl/20240805/b50983fa4be44583b190d50de11fb7fe.html"]]);
const file=path.join(DATA,'law-excerpts.json'),index=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{},failures=[];
for(const [key,title,url,effectiveDate] of sources){if(index[key]?.url===url&&index[key]?.verifiedAt==='2026-10-14')continue;try{
 const python='import urllib.request,sys,re,html; raw=urllib.request.urlopen(urllib.request.Request(sys.argv[1],headers={"User-Agent":"growth-source-reader"}),timeout=25).read(); s=raw.decode("utf-8"); s=re.sub(r"<(script|style)[\\s\\S]*?</\\1>","",s,flags=re.I); s=re.sub(r"</(?:p|div|li|tr)>|<br[^>]*>","\\n",s,flags=re.I); s=html.unescape(re.sub(r"<[^>]+>","",s)); sys.stdout.buffer.write(s.encode("utf-8"))';
 const result=spawnSync('python',['-I','-c',python,url],{windowsHide:true,maxBuffer:4*1024*1024,timeout:35000});if(result.status!==0)throw new Error(result.stderr?.toString().slice(-300)||'读取失败');const text=result.stdout.toString('utf8'),articles=parseLawText(text);if(Object.keys(articles).length<5)throw new Error('未提取到可靠条文');index[key]={title,url,effectiveDate,verifiedAt:'2026-10-14',sha256:hash(result.stdout),articles};console.log(title+'：'+Object.keys(articles).length+'条');atomic(path.join(DATA,'law-sources',key+'.txt'),text);
 }catch(e){failures.push({title,url,error:e.message});console.log('待补来源：'+title+' '+e.message);}
}
atomic(file,index);const db=read();backup(db);const report=enrichMemoryEvidence(db,index);if(report.changed)write(db);atomic(path.join(DATA,'memory-evidence-report.json'),{...report,failures,version:db.version});console.log(JSON.stringify({...report,failures,version:db.version}));
