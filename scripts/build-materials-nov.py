"""Build a repeatable, non-installing import candidate for the five user PDFs."""
import pathlib,json,re,sys,hashlib
sys.stdout.reconfigure(encoding='utf-8')
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'output/materials-20261105';DATE='2026-11-05'
def read(p):return json.loads(pathlib.Path(p).read_text(encoding='utf8'))
def save(p,v):pathlib.Path(p).parent.mkdir(parents=True,exist_ok=True);pathlib.Path(p).write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
inventory=read(OUT/'inventory.json');bykey={s['key']:s for s in inventory};sources=[];records=[];chapter_index=[]
def sid(key):return 'source-'+bykey[key]['sha256'][:24]
def ref(key,page,label='',quote=''):return dict(sourceId=sid(key),page=page,label=label,quote=quote,regions=[])
def record(id,kind,title,subject,topic,body,refs,links=None,**extra):
 return dict(id=id,kind=kind,origin='materials-20261105',legacyId=id,title=title,subject=subject,topic=topic,date=DATE,tags=['2027新资料',topic],body=body,sourceRefs=refs,links=links or [],revision=1,**extra)
for s in inventory:
 key=s['key'];subject='shenlun' if key=='shenlun-yuandong' else ('xingce' if key=='verbal-collocations' else 'gongan');pages=[]
 for p in read(OUT/(key+'.json')):
  of=OUT/'ocr'/key/f"{p['page']}.json";o=read(of) if of.exists() else None
  pages.append(dict(pageNumber=p['page'],rawText=p['text'],sourceContent=dict(materialText=p['text'],teacherHighlights='',userHandwriting='',originalPdfPage=p['page'],visualMarksPreserved=True,machineText=o['text'] if o else '',recognitionStatus='OCR参考，未逐字精校' if o else ('PDF文字层提取' if p['text'] else '原图阅读')),aiContent=dict(summary='',knowledgePoints=[],examples=[],uncertainties=['原页笔迹完整保留，未据颜色自动认定历史错题。']),textLayerConfidence=1 if p['text'] else 0,handwritingConfidence=None,manualReviewRequired=not bool(p['text']),visualInspectionStatus='目录与抽样原页已查看',updatedAt=DATE))
 sources.append(dict(id=sid(key),origin='materials-20261105',title=s['name'].removesuffix('.pdf'),filename=s['sha256']+'.pdf',sha256=s['sha256'],size=s['size'],kind='pdf',subject=subject,topic={'community':'社区警务','mindmap':'公安知识框架','police-thinking':'公安思维与实战','shenlun-yuandong':'申论方法实战','verbal-collocations':'规范词语搭配'}[key],date=DATE,pageCount=s['pages'],missing=False,pages=pages,attributionNote='用户上传的课程资料。课程观点、题册答案与官方法规分开标识；原始笔迹只在原页保留。'))

boundary='判分依据是本次上传题册的“正确答案”和解析，不代表已逐条取得公安部《社区警务工作规范（试行）》官方全文核验。题册引用条号按原文保留；制度版本、未列举范围及强制性措辞存在疑问时暂不计对错。'
community=read(OUT/'community-parsed.json');content=read(ROOT/'scripts/community-nov-content.json');groups=content['groups'];qgroup={n:g for g in groups for n in g['numbers']}
assert set(qgroup)==set(range(1,61))
canonical={};duplicates=[]
for q in community:
 signature=json.dumps({k:q[k] for k in ['prompt','options','answer','explanation']},ensure_ascii=False,sort_keys=True)
 if signature in canonical:
  base=canonical[signature];base['originalNumbers'].append(q['number']);base['allPages']+=q['pages']+q.get('duplicatePages',[]);duplicates.append({'number':q['number'],'canonicalNumber':base['number'],'pages':q['pages']})
 else:
  q['originalNumbers']=[q['number']];q['allPages']=q['pages']+q.get('duplicatePages',[]);canonical[signature]=q
unique=list(canonical.values());assert len(unique)==60
for q in unique:
 n=q['number'];g=qgroup[n];qid=f'nov-20261105-community-q{n:03d}';gid='nov-20261105-community-'+g['key'];reason=content['excluded'].get(str(n),'')
 refs=[ref('community',p,f"原题号 {' / '.join(map(str,q['originalNumbers']))} · 题册答案与解析",q['explanation'] if i==0 else '') for i,p in enumerate(sorted(set(q['allPages'])))]
 article='、'.join(dict.fromkeys(re.findall(r'第[一二三四五六七八九十百零〇\d]+条(?:第[一二三四五六七八九十]+款)?',q['explanation'])))
 correct='、'.join(q['options'][k] for k in q['answer']);reminder=content['singleReminders'].get(str(n),g['memory'])
 options={}
 for k,v in q['options'].items():
  detail=content['multiTraps'].get(str(n),{}).get(k)
  if not detail:
   detail=(f'本项“{v}”符合题册对本题的列举或标准。' if k in q['answer'] else f'本题问的是“{q["prompt"]}”，题册对应要求为“{correct}”；“{v}”不匹配该口径。')+' '+reminder
  options[k]=dict(text=detail,status='题册答案对照；法规全文未独立核验',basis=[])
 body=f"## 这道题抓什么\n\n{g['plain']}\n\n## 做题提醒\n\n{reminder}\n\n## 题册解析原文\n\n{q['explanation']}\n\n## 不要背过头\n\n{g['trap']}\n\n## 依据范围\n\n{boundary}"
 if reason:body+='\n\n## 本题暂不计对错\n\n'+reason
 tutorial=dict(version=1,authored=dict(key=qid,title=g['title'],origin='依据上传题册编写的大白话说明',scope='本题逐项',verifiedAt=DATE,body=body,sources=[]),materials=[dict(id=gid,title=g['title'],provenance='题册原文与编写说明分别展示',verificationStatus='题册依据',body=q['explanation'],sourceRefs=refs)])
 question=dict(origin='source-scan',type=q['type'],prompt=q['prompt'],options=q['options'],referenceAnswer=q['answer'],verifiedText=True,requiresImage=False,hideOriginalUntilAnswer=True,optionExplanations=options,optionAuditStatus='题册对照；非官方法规逐条核验',answerVerificationStatus='source-conflict' if reason else 'book-key',answerSourceNote=boundary,textStatus='pdf-text-checked',attention=reason or g['trap'],explanation=dict(version=1,category=g['title'],keyCondition=reminder,diagnosis=g['trap'],memory=g['memory'],legalBasis=[]),tutorial=tutorial,originalPages=[dict(sourceId=sid('community'),page=p,width=1273,height=1800,region=dict(x=0,y=0,w=1,h=1),previewSuffix='-hd') for p in q['pages']],sourceAudit=dict(checkedAt=DATE,imageStatus='available',textStatus='PDF文字层已按题号和答案解析校验',scope='保留原题与重复题号；手写答案未自动判定'),gradingExcluded=bool(reason),answerDispute=reason)
 records.append(record(qid,'practice',f"社区警务 · 第{n}题 · {g['title'].split('：')[0]}",'gongan','社区警务',q['prompt'],refs,[gid,gid+'-memory'],studyQuestion=dict(bank='community-20261105',origin='source-scan',chapter=groups.index(g)+1,chapterName=g['title'],sectionId='community-'+g['key'],sectionName=g['title'],type=q['type'],number=n,referenceAnswer=q['answer'],promptPreview=q['prompt'],gradingExcluded=bool(reason),needsConfirmation=bool(reason),historicalWrong=False,historicalCorrect=False,originalNumbers=q['originalNumbers'],sameSourceDuplicate=True if len(q['originalNumbers'])>1 else False,knowledgeKey=gid),verificationStatus='题册存在争议，暂不判分' if reason else '按题册答案练习',details=dict(question=question,originalNumbers=q['originalNumbers'],authoredText=body,sourceVerification=dict(status='book-key-only',article=article,version='用户上传2027课程题册所引试行规范；官方全文版本未核实',checkedAt=DATE,officialFullTextVerified=False))))
for g in groups:
 gid='nov-20261105-community-'+g['key'];qs=[q for q in unique if q['number'] in g['numbers']];refs=[ref('community',q['pages'][0],f"第{q['number']}题及解析",q['explanation']) for q in qs]
 original='\n\n'.join(f"第{q['number']}题：{q['explanation']}" for q in qs)
 body=f"## 大白话讲清楚\n\n{g['plain']}\n\n## 好记但不能丢条件\n\n{g['memory']}\n\n## 这几个地方别踩坑\n\n{g['trap']}\n\n## 题册原文与依据\n\n{original}\n\n## 核验边界\n\n{boundary}\n\n## 合上后说一遍\n\n先说对象和场景，再说数字或步骤，最后补上原则、例外和权限。用自己的话写出最容易混淆的两项。"
 links=[f"nov-20261105-community-q{q['number']:03d}" for q in qs]
 records.append(record(gid,'knowledge',g['title'],'gongan','社区警务',body,refs,links+[gid+'-memory'],verificationStatus='题册原文已关联；法规全文待核',details=dict(sourceText=original,authoredText=g['plain'],legalVerification='题册引文，不冒充官方法规全文',checkedAt=DATE)))
 records.append(record(gid+'-memory','memory','回忆：'+g['title'],'gongan','社区警务',body,refs,[gid]+links,verificationStatus='题册依据；含原文与适用边界',details=dict(sourceText=original,authoredText=g['memory'],legalVerification='题册引文；官方全文待核',reviewPrompt='不看答案，说出对象、条件、数字或步骤，再用一个反例说明边界。')))

# Verified table-of-contents page ranges. These are chapter guides, not claims of full legal calibration.
mind=[('公安机关办理行政案件能力',3,27,'先把管辖、调查、强制措施、处理决定和执行放在一条流程线上，再单独记各环节的主体、时限和例外。','管辖 / 回避 / 简易程序 / 调查取证 / 强制措施 / 处理执行'),('公安机关办理刑事案件能力',28,69,'把立案、侦查、强制措施、证据和移送拆成不同阶段。每遇到数字先问起算点，每遇到权力先问由谁决定。','刑事管辖 / 回避 / 证据 / 强制措施 / 侦查程序'),('公安基础知识',70,85,'按性质宗旨、职责职权、组织纪律和监督分类归纳。职责是做什么，权限是能采取什么手段，监督是由谁怎样检查。','公安机关 / 人民警察 / 职责职权 / 纪律监督'),('法律基础知识',86,113,'把宪法、刑法、民法等分开看；先找行为主体、行为、结果和条件，再与相似制度比较。不要只记结论。','宪法法理 / 刑法 / 民法等基础概念')]
thinking=[('公安思维类题目答题思路',6,29,'区分“说得对”与“最符合题干”。圈出问题、限定条件和所问任务，逐项比较针对性；课程关于命题心理和比例的说法属于老师观点。','题眼 / 择优 / 情景 / 图表'),('执法细则上：主体、行为、装备、场所',30,48,'用主体资格、职权、条件、程序四列整理。涉及新旧规定的地方先看施行日期，不能把2027年才施行的材料直接当作2026年现行依据。','主体 / 证件 / 着装 / 执法行为 / 装备 / 场所 / 盘问'),('现场执法基本规定',49,52,'先判断现场风险、人员安全和需要解决的问题，再看合法权限、协同和措施是否适度。原则不是可以绕过法定条件的口号。','规范 / 及时 / 协作 / 安全 / 控制 / 适度'),('常见警情与特殊人员处置',53,63,'把常见警情分开复述：先要保护什么、怎样请求协同、什么证据要固定、哪些做法会扩大风险。具体措施应回原文核准。','阻碍执法 / 伤害斗殴 / 家暴 / 溺水 / 失踪 / 特殊对象'),('执法视频知识点积累区',64,64,'本页是配套视频知识积累区。记录视频标题、观看日期、对应教材页、你自己的一个误区；未取得的视频不视为已导入。','原页笔记 / 视频配套'),('警务技能知识点积累区',65,65,'先在原页确认老师示意与笔记，把适用条件、安全要求和容易混淆的概念写成对照。课程提示不能代替现场专业训练。','安全 / 装备 / 动作名称辨析'),('社区警务那些事',66,67,'结合已导入的社区警务60道去重题学习。特别区分原则、范围与硬性数值，不把题册简化说明当法律全文。','社区主防 / 群众工作 / 规范学习'),('办理刑事案件能力题组',68,81,'按单选、多选、情景成组阅读。先区分已知事实和推测，再选择下一步最能排查或验证线索的措施。','单选 / 多选 / 情景 / 卷末答案'),('群众工作能力题组',82,97,'先看题目问组织、宣传、沟通还是处置顺序；好措施不一定符合本题任务。群众参与还要自愿、适当且不越权。','组织动员 / 宣传教育 / 沟通 / 矛盾化解'),('公安情报信息能力题组',98,127,'核对时间、地点、口径和异常；图表先找分母再算比例，线索先验证再作结论。相关不等于因果。','信息核实 / 逻辑研判 / 图表 / 线索'),('公安勤务能力题组',128,151,'把风险发生的位置和时间画出来，再选巡防方式与部署。回原图核对线路、方向与范围，不凭记忆补图。','巡逻 / 部署 / 路线 / 重点防范'),('应急处突能力题组',152,161,'先确认当前危险是否仍在，再比较可执行且不增加伤害的处置。题目问首先、最优、后续时答案顺序不同。','风险评估 / 大型活动 / 先期处置 / 安全'),('警务技能题组',162,171,'结合原图辨认条件与处置名称，区分警械和武器的条件、限度与保护要求。不要只背字母或手写圈选。','技能辨析 / 安全条件 / 原题答案'),('重大案例剖析',172,174,'按事实、风险、权限、处置、复盘五格写案例。将资料明确陈述的事实和你推断的原因分开，缺少的事实不补编。','事实 / 处置 / 复盘')]
for key,chapters,prefix,toc in [('mindmap',mind,'mindmap',2),('police-thinking',thinking,'thinking',4)]:
 for i,(title,start,end,guide,topics) in enumerate(chapters,1):
  id=f'nov-20261105-{prefix}-chapter-{i:02d}';rs=[ref(key,start,'章节起页'),ref(key,end,'章节末页'),ref(key,toc,'原始目录')]
  text=f"## 本章怎样学\n\n{guide}\n\n## 内容范围\n\n{topics}。PDF 第{start}—{end}页。\n\n[打开本章原页](#/source/{sid(key)}?page={start})\n\n## 复盘时留下这三句\n\n1. 我原来把什么和什么混在一起？\n2. 原文实际要求的对象、条件、程序是什么？\n3. 题目换一个条件时，结论会怎样变？\n\n## 内容核验进度\n\n目录和章节起止已按原页核对，全文图像均保留。识别文字仅作查找参考，图表与手写笔记须对照原页；本章节导读不冒充全章法律精校或全部题目解析。具体法条使用前仍需核对适用版本。"
  records.append(record(id,'knowledge',title+' · 章节导读','gongan','公安知识框架' if key=='mindmap' else '公安思维与实战',text,rs,verificationStatus='章节定位已核对；正文精校分批进行',details=dict(chapter=dict(sourceId=sid(key),startPage=start,endPage=end,topics=topics),authoredText=guide,contentStatus='chapter-guide',isFullyCalibrated=False)))
  chapter_index.append(dict(id=id,sourceId=sid(key),title=title,startPage=start,endPage=end,contentStatus='chapter-guide'))

yu=[('概括对策1',3),('概括对策2',8),('概括对策3',13),('概括问题',18),('概括原因',22),('概括作用',27),('概括综合1',32),('概括综合2',37),('词句理解1',44),('词句理解2',49),('启示分析',53),('变化分析',58),('复合对策1',63),('复合对策2',68),('复合对策3',74),('公文：措施内容',80),('公文：案例摘要',86),('公文：推荐材料',92),('公文：汇报提纲',97),('公文：简报',102),('公文：发布词',106),('公文：宣传稿',111),('经济话题范文',116),('政治话题范文',168),('文化话题范文',210),('社会话题范文',244),('生态话题范文',278)]
yp=read(OUT/'shenlun-yuandong.json')
for i,(title,start) in enumerate(yu,1):
 end=yu[i][1]-1 if i<len(yu) else 300;id=f'nov-20261105-yuandong-chapter-{i:02d}';actual=start+1 if start+1<=end else start
 raw=yp[actual-1]['text'];raw=re.sub(r'初心小助手微信[^\n]*','',raw).strip()
 if i<=8:guide='先标任务词和材料范围，把同类要点归并；每一点使用概括词加材料细节，不额外发挥材料没有的对策。'
 elif i<=12:guide='先用一句话解释所问概念或变化，再分层说明材料中的表现、原因或启示。词句理解要回到上下文，不只按字面释义。'
 elif i<=15:guide='把问题与对策一一配对，写清谁来做、做什么、怎样落实；已做措施、现存问题与自拟建议分开，避免空泛口号。'
 elif i<=22:guide='先确认身份、读者、目的与文种，再安排标题和主体。是否需要称谓、落款、日期以题干要求与文种为准，不能给所有应用文套同一格式。'
 else:guide='读范文时只拆结构：总论点、分论点、例证和分析怎样相接。摘句后改写成自己的话，再换一个材料例子检验能否迁移；范文不是官方评分标准。'
 body=f"## 这一章练什么\n\n{title}，PDF 第{start}—{end}页，印刷页第{start-2}—{end-2}页。\n\n## 练习方法（编写）\n\n{guide}\n\n## 本章首个内容页原文\n\n{raw}\n\n## 回到完整材料\n\n[从本章起页阅读](#/source/{sid('shenlun-yuandong')}?page={start})。题目、给定资料、课堂讲解与范文均保留在原书，不把教学示例当作官方参考答案。\n\n## 写完自查\n\n我有没有回应任务词？要点能否在材料中找到？格式是否符合题干？字数是否合规？例子后是否说清它证明了什么？"
 refs=[ref('shenlun-yuandong',actual,'本章题目/内容起页',raw),ref('shenlun-yuandong',start,'章节封页'),ref('shenlun-yuandong',end,'章节末页')]
 records.append(record(id,'knowledge',title+' · 袁东方法实战','shenlun','申论方法实战',body,refs,verificationStatus='教材文字层与章节已接入；教学材料非官方答案',details=dict(chapter=dict(sourceId=sid('shenlun-yuandong'),startPage=start,endPage=end),sourceText=raw,authoredText=guide,contentStatus='source-reading')))
 chapter_index.append(dict(id=id,sourceId=sid('shenlun-yuandong'),title=title,startPage=start,endPage=end,contentStatus='source-reading'))

# Add the new PDF as alternate provenance; never overwrite prior word corrections or progress.
rows=read(OUT/'new-vocabulary-rows.json');diff=read(OUT/'vocabulary-diff.json');assert diff['sameNormalizedContent']
record_patches=[];vocabulary_patches=[]
for v in rows:
 id=f"vocabulary-{v['number']:03d}";r=ref('verbal-collocations',v['page'],f"2026年11月重新上传 · 原编号{v['number']}",'｜'.join([str(v['number']),v['label'],v['meaning'],v['example'],v['documentLabel']]))
 reg=v['region'];r['regions']=[dict(x=reg['x'],y=reg['y'],w=reg['width'],h=reg['height'])]
 record_patches.append(dict(id=id,operation='append-source-reference-if-missing',sourceRef=r,keepExistingContent=True))
 vocabulary_patches.append(dict(id=id,alternateSource=dict(id=sid('verbal-collocations'),page=v['page'],text=r['quote'],region=reg,documentLabel=v['documentLabel'],originalLabel=v['label'],originalMeaning=v['meaning'],originalExample=v['example']),sameContent=True))
for page in range(1,13):
 selected=[r for r in rows if r['page']==page];title=f"规范搭配 · 第{selected[0]['number']}—{selected[-1]['number']}词";text='\n\n'.join(f"{v['number']}. {v['label']}：{v['meaning']}\n\n例句：{v['example']}" for v in selected)
 records.append(record(f'nov-20261105-verbal-page-{page:02d}','article',title,'xingce','言语规范搭配',f"本次新文件与旧文件305条原始内容相同；沿用已有词条及纠错，不重复计掌握。来源简称没有逐条核验到官方原文。\n\n[进入随机词语练习](#/vocabulary)\n\n{text}",[ref('verbal-collocations',page,'规范搭配原表')],[f"vocabulary-{v['number']:03d}" for v in selected],verificationStatus='逐行比对一致；保留旧词条校正'))

extra=OUT/'thinking-selected-records.json'
if extra.exists():records.extend(read(extra))
thinkingSections=[
 (8,'办理刑事案件能力',68,73,74,81,[12,3,27]),
 (9,'群众工作能力',82,87,91,97,[26,14,20]),
 (10,'公安情报信息工作能力',98,113,121,127,[31,15,19]),
 (11,'公安勤务能力',128,138,141,151,[49,12,31]),
 (12,'应急处突能力',152,155,157,161,[15,10,16]),
 (13,'警务技能',162,168,169,171,[24,9,5])]
questionIndex=[]
for index,title,single,multi,case,answer,counts in thinkingSections:
 row=next(r for r in records if r['id']==f'nov-20261105-thinking-chapter-{index:02d}')
 entries=[]
 for type,label,start,end,count in [('single','单项选择题',single,multi-1,counts[0]),('multi','多项选择题',multi,case-1,counts[1]),('case','情景题（保留整组上下文）',case,answer-1,counts[2])]:
  entries.append(dict(type=type,label=label,startPage=start,endPage=end,questionCount=count,answerPage=answer,sourceId=sid('police-thinking'),status='原题与答案索引；未全部逐题精校'))
  row['body']+=f"\n\n[{label} · {count}题 · PDF第{start}—{end}页](#/source/{sid('police-thinking')}?page={start})"
 row['body']+=f"\n\n[本节答案表 · PDF第{answer}页](#/source/{sid('police-thinking')}?page={answer})。数量按原书答案表统计；情景题统计子题数，不把重复练习当作新的掌握证据。"
 row['details']['questionIndex']=entries;row['sourceRefs'].extend([ref('police-thinking',p,l) for p,l in [(multi,'多选起页'),(case,'情景题起页'),(answer,'答案表')]])
 questionIndex.append(dict(title=title,recordId=row['id'],sections=entries,total=sum(counts)))
official=read(ROOT/'scripts/nov-material-official-evidence.json')
context=next(r for r in records if r['id']=='nov-20261105-community-position')
context['body']+='\n\n## 官方实践延伸阅读\n\n'+'\n\n'.join('['+x['title']+']('+x['url']+')（'+x['publishedAt']+'）。'+x['scope'] for x in official['communityContext'])
context['sourceRefs'].extend(dict(url=x['url'],label=x['title']) for x in official['communityContext'])
assert len({r['id'] for r in records})==len(records)
summary=dict(sources=len(sources),sourcePages=sum(s['pageCount'] for s in sources),records=len(records),community=dict(originalQuestionNumbers=100,uniqueQuestions=60,duplicateQuestionNumbers=40,duplicatePdfPage=35,bookKeyGraded=55,heldForClarification=[int(n) for n in content['excluded']]),vocabulary=dict(rawRows=305,newIndependentEntries=0,sourceRefPatches=305),chapters=len(chapter_index),scannedThinkingIndexedQuestions=sum(x['total'] for x in questionIndex),scannedThinkingCalibratedQuestions=len(read(extra)) if extra.exists() else 0,scannedFullTextCalibrated=False)
candidate=dict(schemaVersion=1,importId='materials-20261105',date=DATE,summary=summary,sources=sources,records=records,recordSourcePatches=record_patches,vocabularySourcePatches=vocabulary_patches,chapterIndex=chapter_index,communityDuplicates=duplicates,artifactRoot='output/materials-20261105',installNotes=['先备份 platform.json 与 vocabulary.json；本候选不包含生产库写入。','复制 originals/<sha>.pdf 到 data/originals；复制 previews/<sourceId> 到 data/previews。','使用 mergeImported 合并记录和来源；用户编辑的记录保留冲突双方。','来源补丁只追加不存在的 sourceId/page/region，词条正文、纠错、进度不覆盖。','公开版只发布预览与净化数据，原PDF交由Releases；校验总体积小于1GB。'])
candidate['thinkingQuestionIndex']=questionIndex
save(ROOT/'data/materials-20261105-candidate.json',candidate);save(OUT/'chapter-index.json',chapter_index);save(OUT/'content-summary.json',summary);save(OUT/'thinking-question-index.json',questionIndex)
print(json.dumps(summary,ensure_ascii=False,indent=2))
