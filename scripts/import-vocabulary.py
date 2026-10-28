"""Extract the supplied expression table by its actual PDF cell boundaries.

Read-only toward the source PDF and platform.json. Writes a reproducible candidate,
a source record candidate, and page previews for a separate validated installer.
Requires Poppler on PATH and Python with pypdf/Pillow (the bundled runtime has both).
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET

from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_PDF = pathlib.Path(r"E:\weixinline\xwechat_files\wxid_t2ngylfr9wsu22_f9d1\temp\RWTemp\2026-10\9e20f478899dc29eb19741386f9343c8\1a1579cbebd8acb(1).pdf")
VERIFIED_DATE = "2026-10-28"
NS = {"x": "http://www.w3.org/1999/xhtml"}

REFERENCES = {
    "villages": {
        "title": "国家发展改革委：推广浙江“千万工程”经验的指导意见",
        "url": "https://www.ndrc.gov.cn/fzggw/jgsj/ghs/sjdt/202307/t20230705_1358163.html",
        "excerpt": "千村示范、万村整治",
        "checkedAt": VERIFIED_DATE,
        "supports": "补充简称所指的乡村示范整治实践；学习释义为据此编写，不冒充逐字引文。",
    },
    "prosperity": {
        "title": "国家发展改革委：共同富裕及其实践议程",
        "url": "https://www.ndrc.gov.cn/fggz/jyysr/jysrsbxf/202109/t20210924_1297388.html",
        "excerpt": "不是整齐划一的平均主义",
        "checkedAt": VERIFIED_DATE,
        "supports": "全体人民的物质和精神生活都更加富足，不等于人人收入一模一样。",
    },
    "farmland": {
        "title": "农业农村部：高标准农田建设质量管理办法",
        "url": "https://ntjss.moa.gov.cn/zcfb/202511/t20251119_6479037.htm",
        "excerpt": "田块平整",
        "checkedAt": VERIFIED_DATE,
        "supports": "第十六条明确田块平整、通水通路及提升地力产量效益，支持本条通俗释义；本练习不考具体建设标准。",
    },
    "seeds": {
        "title": "农业农村部：种业振兴行动取得阶段性成效",
        "url": "https://zys.moa.gov.cn/gzdt/202312/t20231221_6443251.htm",
        "excerpt": "全面推进种质资源保护利用",
        "checkedAt": VERIFIED_DATE,
        "supports": "通过资源保护、创新攻关、企业和基地建设等提高育种供种能力，不只是把名称重复一遍。",
    },
    "community": {
        "title": "住房和城乡建设部：完整居住社区建设指南发布通知",
        "url": "https://www.mohurd.gov.cn/gongkai/zc/wjk/art/2022/art_17339_764055.html",
        "excerpt": "安全健康、设施完善、管理有序",
        "checkedAt": VERIFIED_DATE,
        "supports": "补充社区设施、服务和管理的整体要求，学习释义为通俗编写。",
    },
    "dictionary": {
        "title": "台湾教育主管部门《国语辞典简编本》：软硬兼施",
        "url": "https://dict.concised.moe.edu.tw/dictView.jsp?ID=36538&la=0&powerMode=0",
        "excerpt": "委婉和強硬的手段一起使用。",
        "checkedAt": VERIFIED_DATE,
        "supports": "常见义是温和与强硬手段同时使用，不能直接解释成软件和硬件建设。",
    },
    "quality": {
        "title": "国家发展改革委：辩证看待中国经济高质量发展阶段的量和质",
        "url": "https://www.ndrc.gov.cn/xwdt/ztzl/NEW_srxxgcjjpjjsx/yjcg/zw/202308/t20230824_1363386.html",
        "excerpt": "量的合理增长与质的有效提升相互促进",
        "checkedAt": VERIFIED_DATE,
        "supports": "质量搭配有效提升，数量搭配合理增长；原表第266条标题写反。",
    },
    "connectivity": {
        "title": "市场监管总局：质量认证国际合作成果专题新闻发布会实录",
        "url": "https://www.samr.gov.cn/hd/zxft/art/2026/art_dd5fb02047b0436dacb5c9193d6545d4.html",
        "excerpt": "政策沟通、设施联通、贸易畅通、资金融通、民心相通",
        "checkedAt": VERIFIED_DATE,
        "supports": "五通是五个方面；硬联通、软联通、心联通是另一个观察角度，不是五通的逐项原句。",
    },
}

# Corrections are deliberately separate from the unchanged source cells. The
# imported document only provides short source labels, not verified citations.
CORRECTIONS = {
    150: {
        "meaning": "温和的办法和强硬的手段一起使用",
        "usage": "常用于描述交涉或施压的手段。说设施与服务一起改善，应直接写“软硬件建设并重”，不要把成语的常见义记错。",
        "example": "他劝说时先讲道理，又提出强硬要求，可谓软硬兼施。",
        "note": "原表将“软硬兼施”解释为“软件硬件并举”，不是该成语的常见义；训练使用校正含义，原文保留供对照。",
        "references": ["dictionary"],
    },
    266: {
        "word": "质的有效提升、量的合理增长",
        "meaning": "发展既要提高质量和效益，也要保持合理的数量增长",
        "usage": "质量对应“有效提升”，数量对应“合理增长”。不要把“质”和“量”调换。",
        "note": "原表第266条“用词·搭配”写成“量的有效提升+质的合理增长”，与本行原例句矛盾；已依据官方表述校正。",
        "references": ["quality"],
    },
    270: {
        "meaning": "共建“一带一路”的五个互联互通方面：政策、设施、贸易、资金、民心",
        "usage": "五通按五个方面记：政策沟通、设施联通、贸易畅通、资金融通、民心相通。硬、软、心联通是另一种概括。",
        "example": "共建合作需要推进政策沟通、设施联通、贸易畅通、资金融通、民心相通。",
        "note": "原表用“三联通”作为“五通”的例句，相关但不是同一组术语；训练改用明确列出五通的编写例句。",
        "references": ["connectivity"],
    },
    208: {
        "example": "发展数字经济核心产业，要夯实技术基础，推动产品和服务创新。",
        "note": "原表例句中的10.5%未标注统计年份和口径。本练习只学词语用法，改用无数值的编写例句，不把该数字作为当前事实。",
    },
}

MEANING_CLARIFICATIONS = {
    186: "让教育、医疗、养老等政策和公共服务真正改善普通人的日常生活",
    9: "使规模、实力或队伍不断发展扩大",
    45: "积极努力把事情做好，同时考虑实际能力和承受条件",
    56: "积累条件和力量，为后续行动作准备",
    79: "帮助解决困难，使人或组织摆脱困境",
    97: "保持总体稳定，同时积极推进改进和发展",
    120: "先有长期深厚的积累，再适时集中发挥力量",
    158: "把相互关联的部分作为一个整体来解决问题",
    168: "让全体人民的物质和精神生活都更富足，而非人人收入完全相同",
    193: "把降低碳排放、减少污染、增加绿色空间与经济增长协同推进",
    194: "把山、水、林、田、湖、草、沙看作相互联系的整体，进行系统保护和治理",
    198: "中等收入群体较大，高收入和低收入群体较小的分配结构",
    208: "以数字技术、数字产品或相关服务为核心的产业领域",
    212: "以村庄示范和环境整治改善乡村面貌，并持续推进乡村建设的实践经验",
    216: "生活设施与服务较齐全，安全健康、管理有序的居住单元",
    217: "让居民在日常步行约十五分钟的范围内获得便民服务",
    219: "围绕老年人的生活与服务需求形成的经济活动",
    220: "围绕新品首次发布、门店首次落地等形成的经济活动",
    222: "围绕冰雪运动、旅游及相关产品服务形成的经济活动",
    223: "更多家庭能够方便获得、费用较可承受的婴幼儿照护服务",
    224: "把治病、康复等医疗需要与老年生活照护相衔接",
    225: "县域内医疗卫生机构通过紧密合作共同提供服务的组织形式",
    226: "在发展安排中把保障人民健康放在优先考虑的位置",
    227: "从不同服务方面、人生不同阶段持续满足健康需要",
    229: "统筹办学、科研与人才培养，让三方面相互衔接促进",
    233: "先保障保护目标，只作确有必要的改变，避免过度干预",
    236: "判断一个人在生活自理等方面受限的程度",
    237: "筹集资金时考虑相关主体各自的承受能力",
    238: "让人民在决策、管理、监督等不同环节有序参与的民主实践",
    239: "围绕群众要办成的事项衔接相关流程，提高办理效率和效果",
    240: "把一件事涉及的办理环节整合，减少分头申请和反复跑动",
    242: "借助统一平台协调城市运行中的监测、处置和管理",
    243: "通过交回或回收旧产品等方式，购置替代的新产品",
    244: "由数字化等新技术和新模式带动的消费活动",
    245: "体育竞赛带动交通、餐饮、住宿等相关消费和产业活动",
    246: "把文化资源与旅游活动相结合，丰富旅游内容和文化体验",
    248: "把一个地区的旅游资源、相关产业和服务作为整体来发展",
    249: "把数字技术用于农村生产、生活和治理等领域",
    250: "运用智能设备、数据等技术改进农业生产和管理",
    251: "田块平整、水路等配套完善，有利于提高地力和粮食产能的耕地",
    252: "维护相关耕地的土壤质量与生产能力，避免珍贵土壤资源退化",
    253: "通过资源保护、育种创新和企业基地建设等提升良种选育供应能力",
    254: "从村庄示范和环境整治入手，持续改善农村生产生活生态环境的实践",
    256: "通过改造卫生设施和改善管理，解决如厕环境与卫生问题",
    257: "将雨水与生活等污水分开收集输送，减少混排问题",
    258: "让城市更好地吸纳、储存、调节和利用雨水的建设理念",
    259: "生活设施与服务较齐全，安全健康、管理有序的居住单元",
    260: "利用较小空间建设、方便居民就近使用的公园绿地",
    261: "从局部小范围入手逐渐改善空间与生活环境",
    262: "分阶段、按步骤逐步实施改造，不一次性全部推倒重来",
    263: "针对具体痛点采用精准的小切口改造",
    264: "同一公共设施兼顾日常使用和应急时的需要",
    265: "把数字技术和互联设备用于居家生活与服务",
    267: "把新增资源做得优质，同时让已有资源得到更好利用",
    269: "需求变化引导新的产品服务，新的供给又带出新的需求",
    271: "既吸引外部投资和资源，也主动拓展对外发展与合作",
    272: "给予发展活动充分空间，同时把必要的监管做好",
    273: "发挥优势企业带动作用、补全产业环节并推动企业集聚",
    274: "稳住基本支撑、发扬已有长处，并补足不足和薄弱环节",
    275: "坚守必要边界、抓住工作重点，同时争取更高水平",
    276: "既提高质量和保持合理数量增长，也积累后续发展力量",
    277: "采取实在可行的办法，并追求能够看得见的实际效果",
    278: "补足不足，同时提高质量与效率或效益",
    279: "依据当地自然条件和资源特点选择适合的发展方式",
    280: "各方一起参与建设和治理，并一起享有成果",
    281: "用发展改善生活，又从满足生活需要中获得新的发展机会",
    282: "让符合条件的人得到应有保障，困难时获得必要的基本支持",
    283: "积极努力把事情做好，同时考虑实际能力和承受条件",
    284: "围绕基层医疗卫生机构改善服务与基础能力的工作安排",
    285: "通过县、乡、村之间的管理聘用安排，让合适人才服务基层",
    286: "尽早发现健康风险或疾病迹象，并及时采取适当措施",
    287: "让疾病诊疗与预防工作相互衔接、配合开展",
    288: "把全国健康建设与农村健康服务改善相衔接",
    289: "拓宽思想政治教育场景，并把育人要求融入各类课程",
    290: "塑造价值追求、发展智慧并滋养心灵的育人要求",
    291: "德育、智育、体育、美育、劳动教育一起推进",
    293: "把不同培养阶段和育人环节连接起来，形成连贯的培养过程",
    294: "发挥已有优势、弥补明显不足，并稳固基本支撑",
    295: "保障基本生活需要、接住困难群体，并促进机会和服务公平",
    296: "从幼儿养育、教育就业到医疗养老、住房和困难帮扶的七方面民生保障",
    297: "通过不同保障层次和多种支撑方式，扩大社会保障的覆盖范围",
    298: "让更多人受益、保障基本需要，并为困难情形提供必要支持的民生要求",
    299: "从覆盖范围、人生阶段和不同人群三个角度完善服务",
    300: "把减少疾病发生放在前面，同时做好预防与治疗的衔接",
    301: "从主要在患病后治疗，转向同时重视维护健康和预防疾病",
    302: "把减少污染与减少碳排放协同起来，提高治理的整体效果",
    303: "在问题产生前减少排放，在进行中控制，并在最后环节处理",
    304: "依法严格执行、持续加强监督，同时优化办事和公共服务",
    305: "把群众表达的需要转化为及时回应和实际行动",
}

MEANING_REFERENCES = {168: ["prosperity"], 212: ["villages"], 216: ["community"], 251: ["farmland"], 253: ["seeds"], 254: ["villages"], 259: ["community"]}

# Expressions absent from their original sample need explicit authored examples.
# All original examples remain available alongside these learning examples.
AUTHORED_EXAMPLES = {
    26: "及时回应企业关切、稳定政策预期，才能稳住发展大盘。",
    34: "在补齐短板的同时，继续锻造产业长板。",
    65: "通过技术创新培育新动能、构筑新优势。",
    67: "这家企业立足制造基础，锻长板扬优势，提升产品竞争力。",
    84: "通过组团帮扶，让医疗和教育领域的专业团队共同支持当地发展。",
    90: "地方建设创新平台，聚才引智、招才引智，为企业引来专业人才。",
    103: "服务中心增加办理窗口并优化流程，推动服务扩容提质。",
    113: "从基础设施到人才培养持续投入，为产业发展筑牢根基。",
    114: "为创新创业提供便利，让制度改革进一步激发活力。",
    115: "完善应急预案和保障设施，让城市在面对冲击时增强韧性。",
    118: "既增加服务供给，又改善服务质量，坚持量质并举。",
    119: "企业改进生产流程，推动产品质量和经营效率同步实现质效提升。",
    126: "团队围绕关键技术持续研究，在反复试验中攻坚克难。",
    163: "针对不同污染源分别施策，才能做到精准治污。",
    164: "把监管措施落实在法律规定范围内，坚持依法治污。",
    165: "先分析污染成因，再选择合适的治理方案，落实科学治污。",
    181: "持续培养人才、积累技术，为区域发展厚植优势。",
    193: "把降碳减污扩绿增长统筹起来，协同推进绿色转型。",
    200: "通过提高效率、改善质量和减少资源浪费，推动高质量发展。",
    206: "科研团队瞄准产业瓶颈，开展关键核心技术攻关。",
    212: "改善乡村环境，要学习运用千万工程经验，因地制宜推进建设。",
    213: "通过保护耕地、改善种植技术落实藏粮于地、藏粮于技。",
    214: "提高粮食生产和储备保障能力，守牢粮食安全底线。",
    215: "完善排水、应急和基础设施保障，建设韧性安全城市。",
    218: "开展城市体检、县城体检，先查出问题，再有针对性地更新改造。",
    227: "从日常预防到疾病治疗、康复照护，提供全方位全周期健康服务。",
    229: "统筹学校、科研机构和企业资源，促进教育科技人才一体发展。",
    230: "落实双减政策，同时提高学校教育教学质量。",
    233: "修缮历史建筑应坚持保护第一、最小干预，保留其真实风貌。",
    237: "筹资方案考虑不同群体的承受能力，探索量能筹资机制。",
    238: "让群众在决策、管理和监督等环节有序参与，发展全过程人民民主。",
    254: "学习运用千万工程经验，持续改善乡村人居环境。",
    262: "保留街区原有风貌，分期解决具体问题，采用渐进式改造。",
    263: "从一条小巷、一个节点入手，开展针灸式改造。",
    271: "统筹引进来、走出去，促进双向投资合作。",
    275: "在改革工作中守住底线、把握主线、追求高线。",
    276: "兼顾质的有效提升、量的合理增长、势的积蓄壮大，持续增强发展后劲。",
    284: "结合优质服务基层行和医疗卫生强基工程，改善基层就医条件。",
    285: "通过县管乡用、乡聘村用，让适宜的人才服务基层。",
    288: "在健康中国建设中推进健康乡村建设，提升农村健康服务水平。",
    289: "把大思政课建设与课程思政贯通起来，拓展育人场景。",
    291: "坚持五育并举，促进学生德智体美劳全面发展。",
    296: "围绕幼有所育、学有所教、劳有所得、病有所医、老有所养、住有所居、弱有所扶，完善民生服务。",
}

# Plain-language memory notes are authored teaching, not additional quotations.
PLAIN_NOTES = {
    1: "把目标当成船锚固定住：方向已经明确，就围绕这个目标持续用力。",
    2: "像把墙加厚、把地基打牢，强调让防线或根基更可靠。",
    3: "先把地基打实再建房。这里强调把基础工作做扎实，后面的发展才有支撑。",
    4: "原来有资源但不活跃，现在想办法让它动起来、发挥作用。",
    5: "潜力本来就在，把限制打开，让它表现出来；不是凭空创造一份潜力。",
    6: "像点燃发动机，让原本潜藏的动力被带动起来。",
    7: "把技术、知识或工具交给某个行业，让它具备更强的办事能力。",
    8: "像育苗，重在培养和成长过程；通常说培育产业、人才或发展动能。",
    9: "已经有了一定基础，再把规模或力量发展得更大。",
    10: "重点是竞争力变强；不要只把做强理解成规模变大。",
    11: "重点是新增部分更优质，常和“盘活存量”一起出现。",
    12: "仓库闲着也是资源，把它重新用起来就是盘活；关键是已有但没用好。",
    13: "像让道路通畅，减少循环和渠道里的阻碍，使人、物、信息等流动顺畅。",
    14: "先找到挡路的障碍，再把它扫除；重点在去掉阻碍。",
    15: "原来断开或堵住的环节，把它接通、疏通；重点在前后贯通。",
    16: "像木桶补上最短的一块板，先解决缺少或落后的部分。",
    19: "看有没有缺项、有没有漏洞，补全之后让机制或体系更完整。",
    20: "让制度或体系更完整、更好用；和健全很接近，要结合原句记搭配。",
    23: "把几件相互关联的事情放在一起安排，不能只顾其中一头。",
    24: "已经取得成果，再把成果守稳；常接成果、基础、地位。",
    27: "像安全网接住最需要帮助的人，强调基本民生有保障。",
    28: "网眼太大可能漏人，织得更密就是减少保障漏洞。",
    32: "事情还没出大问题，提前识别风险、作好应对准备。",
    33: "把已经存在的风险或矛盾逐步消除，和事先防范的侧重点不同。",
    37: "走在前面带方向；不是只跟着别人走，也不只是提供一般帮助。",
    38: "凭借现有的平台、资源或优势开展工作，先找清楚“靠什么”。",
    39: "在条件推动下，新事物被促成、产生；常接新产业、新模式。",
    44: "不同地方情况不同，办法也要跟着调整，不是一套方案到处照搬。",
    45: "一边努力把事情做好，一边看实际能力是否撑得住；努力和能力两头都要顾。",
    46: "先让新办法、新支撑立得住，再退出旧办法，记住先后顺序。",
    47: "该破的要破、该立的要立，两方面一起推进；不等于不分先后乱来。",
    48: "前面挡住风险，已经出现的问题也要处理：防范和化解是两步。",
    50: "已有成果先守住，再把覆盖面、受益面等扩大。",
    51: "该坚持的方向和原则要守住，同时改进方法、创造新办法。",
    63: "强链是让链条更强，补链是补缺环，延链是向上下游延伸；三件事不要混成一个词。",
    64: "先看懂变化，再作出应对，还要主动寻找改变的机会。",
    66: "短板是明显不足的地方，弱项是能力较弱的环节，都是有针对性地补强。",
    67: "不是只盯短处，也要把已有长处做得更突出。",
    69: "像把石头往山上推，前进很费力，更需要持续用劲。",
    71: "“提质”是质量更好，“增效”是效率或效益更高，两部分连着记。",
    72: "一是增加服务容量，二是把优质资源送向基层等需要的地方。",
    76: "提速解决“快不快”，扩面解决“覆盖够不够”。",
    77: "一头减少成本，一头提高效率或效益，不能只记节省开支。",
    78: "把农民与产业、经营主体联系起来，让农民从中获得发展机会和收益。",
    79: "企业遇到难处，帮它疏通困难、缓解压力。",
    82: "不是只分享成果，也要一起参与建设；建设和享有是两头。",
    85: "先帮助企业稳住经营，再帮助稳住劳动者的岗位。",
    86: "把工程建设和帮扶结合起来，通过参加劳动等方式获得收入；记住“工”和“赈”两层意思。",
    88: "借助已经落地的企业带动新企业投资，突出以现有商业联系引来项目。",
    89: "先把平台和环境建好，再吸引人才、项目等来到这里。",
    92: "借助已有渠道或外部力量进入海外市场，重点在“借助”。",
    94: "多家企业或机构一起进入海外市场，重点在“合作成团”。",
    95: "围绕产业链已有环节和缺少环节招商，不是漫无目标地找项目。",
    96: "像把散落的珠子串起来，让分散资源成为相互衔接的整体。",
    97: "在保持总体稳定的基础上积极进取；“稳”和“进”都要有。",
    103: "扩容是增加容量，提质是改善质量；数量增加不自动等于质量提高。",
    106: "先走得稳，才能走得远，强调发展的稳定性和持续性。",
    108: "纸面上的政策要真正实施，还要能看见效果。",
    109: "先看具体问题在哪里，再让措施对准问题。",
    110: "先分清类型，再给不同类型安排不同办法。",
    115: "像有弹性的材料，遇到冲击能承受、能调整、能恢复，重点在抗风险能力。",
    118: "数量和质量一起抓，既看够不够，也看好不好。",
    120: "先有长期、深厚的积累，再把力量发挥出来；不要只记后半句的发力。",
    123: "原来的增长动力逐渐变化，同时培育和接续新的增长动力。",
    131: "大家一起想办法、一起出力，既有智慧也有行动。",
    136: "安排事情要看全局，同时照顾有关方面，不能顾此失彼。",
    139: "很多事情不是一次用力就完成，需要长时间坚持。",
    144: "眼前表现出来的问题要解决，背后的根本原因也要处理。",
    145: "顺着问题往前找原因，在最开始的环节采取措施。",
    148: "该引导的引导，该阻断的阻断，两种办法配合使用。",
    151: "数量和质量都要顾到，不能只图数量增长而忽视质量。",
    157: "把碳固定下来，同时增加吸收和储存碳的能力，两个动作配合理解。",
    160: "从问题发生的前端加以控制；和过程监管、末端治理可以连成一条链记忆。",
    161: "事情进行到哪一步，监督就跟到哪一步，重点在进行中的环节。",
    162: "在链条最后的环节处理问题；它不能替代前端预防和中间监管。",
    169: "把所有权、承包权、经营权这三个概念分清楚，不把不同权利混为一谈。",
    172: "该放的权力放到位，必要的监管也跟上；放与管一起考虑。",
    177: "把权利归属和是非边界讲清，帮助终结争议；这里的“定分”不是考试打分。",
    179: "对方正缺这份帮助时及时送到，重点在解急难。",
    180: "原本已经不错，再让它更好；和雪中送炭的紧迫程度不同。",
    193: "减少碳排放、减少污染、增加绿色空间，同时推动发展；不能只做其中一项。",
    194: "这些自然要素彼此相连，保护时要把它们看成一个系统。",
    195: "承担什么责任、行使什么权力、享有什么利益，要相互匹配。",
    196: "放是简政放权，管是加强监管，服是优化服务；三部分一起记。",
    197: "把各地区、各方面放在全国整体中协调，避免各自为战。",
    198: "借橄榄的形状记忆：中间部分大，两端部分小，重点在分配结构。",
    199: "记住创新这个关键词，用新的技术和组织方式等带来更先进的生产能力；这里是学习提示，不替代完整正式定义。",
    201: "把国内循环和国际循环的关系一起考虑，记住相互促进这个关键词。",
    213: "“地”对应耕地等生产基础，“技”对应农业技术；不是把粮食字面上藏进地里。",
    217: "把常用便民服务放到居民较近的日常生活范围里，记住便利可达。",
    218: "像人体体检先找毛病，城市更新也先查问题，再安排改造。",
    224: "医疗服务和养老服务相互衔接，不能只顾治病而不顾日常照护。",
    227: "从不同服务方面、不同人生阶段照顾健康需要，记住“全方位”和“全周期”两个角度。",
    232: "一方面让传统文化适应今天的表达，一方面在此基础上创新发展；不是原样复制。",
    233: "先保护，再判断确有必要做哪些改变；避免为了改造而过度改造。",
    234: "在保护前提下合理利用，让利用反过来支持保护，不是为了使用而破坏。",
    239: "从群众要办成的事情出发，把相关环节衔接好，重点在办成和高效。",
    240: "围绕一件事整合办理步骤，减少群众来回跑；记住办事体验。",
    241: "跨省通办解决跨地域办事，一网通办强调网上统一办理；是不同的便利化角度。",
    242: "把城市运行相关信息和处置工作接到一个管理平台上，重点在管理协同。",
    247: "让文化丰富旅游内容，让旅游展示文化特色，两者相互促进。",
    255: "四个好按动作记：建好、管好、护好、运营好。",
    257: "雨水和污水分别收集、输送，不把两条处理路径混在一起。",
    260: "像放进口袋的小空间，指贴近居民的小型公园绿地。",
    261: "从小范围、小动作改善环境，不是一上来就大拆大建。",
    262: "按步骤逐渐推进改造，一次处理一部分问题。",
    263: "像针灸找准穴位，选小切口，解决具体痛点。",
    264: "同一设施考虑平时和应急两种需要，记住两种使用情形。",
    267: "新增的部分要做得优质，原来已有的部分也要重新用好。",
    268: "发展时考虑安全，安全有保障后又能促进发展，两者相互支撑。",
    269: "需求变化引导新供给，新的产品和服务又能带出新需求，是双向关系。",
    272: "给市场主体发展空间，同时把必要监管做好，两头都不能丢。",
    273: "龙头带动、链条衔接、企业集聚，三个动作合起来看产业发展。",
    274: "基础要稳、优势要扬、短处要补、弱处要强，分别照顾四类问题。",
    275: "底线是必须守住的边界，主线是工作重点，高线是更高追求；分别理解。",
    276: "看质量是否提高、数量是否合理增长，也看发展后劲是否积累起来。",
    277: "办法要实在，还要看实际效果；不能只有说法没有行动。",
    278: "先补不足，同时改善质量、提高效率或效益。",
    279: "看当地适合什么，再发展什么；记住具体条件决定具体办法。",
    280: "一起建设、一起治理、一起享有成果，三个环节缺一不可。",
    281: "发展是为了改善民生，满足民生需求也会带来新的发展机会。",
    282: "符合保障条件的要覆盖到，需要兜底的要接住；“尽”强调避免遗漏。",
    283: "尽力是积极作为，量力是考虑承受能力，不能只记其中一半。",
    290: "既塑造价值观，也开启智慧、滋养心灵，都是育人的要求。",
    291: "把五育按顺序说完整：德、智、体、美、劳。",
    292: "教育同产业相结合，也同科学研究相互融通，记住两组连接关系。",
    293: "把人才培养的不同阶段和育人环节衔接起来，避免各管一段。",
    294: "长板代表优势，短板代表不足，底板代表基本支撑；分别强、补、固。",
    295: "先保障基本需要、接住困难群体，同时让机会和服务更加公平。",
    296: "把人生和生活需求串起来记：幼、学、劳、病、老、住、弱，共七项。",
    297: "层次、支柱、覆盖面是看社会保障体系的三个角度，不是三个相同说法。",
    298: "普惠看更多人能否受益，基础看基本需要，兜底看困难时有没有保障。",
    299: "覆盖范围、人生阶段、服务人群是三个检查角度，分别想一遍。",
    300: "尽量把疾病防在前面，同时把预防和治疗结合起来。",
    301: "不仅等生病后再治，还要把保持健康、预防疾病放进工作重点。",
    302: "减少污染和减少碳排放一起考虑，让两类工作相互配合、提高效果。",
    303: "问题产生前尽量减少，进行中加强控制，最后再处理剩余问题，是全过程。",
    304: "依法严格执行、持续监督管理、优化服务，三个方面相互配合。",
    305: "群众有需求、有呼声，工作就要及时回应，把需要和行动接起来。",
}


def write_json(path: pathlib.Path, value: object):
    path.parent.mkdir(parents=True, exist_ok=True)
    candidate = path.with_suffix(path.suffix + ".tmp")
    candidate.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    candidate.replace(path)


def extract(pdf: pathlib.Path, folder: pathlib.Path):
    bbox = folder / "source-bbox.html"
    result = subprocess.run(["pdftotext", "-bbox-layout", str(pdf), str(bbox)], capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode("utf-8", errors="replace"))
    xml_pages = ET.parse(bbox).getroot().findall(".//x:page", NS)
    reader = PdfReader(str(pdf))
    records = []
    page_texts = []
    for pnum, (xml_page, pdf_page) in enumerate(zip(xml_pages, reader.pages), 1):
        # The exported spreadsheet draws full-width horizontal rules in top-down
        # PDF coordinates. Their true boundaries retain multi-line cells intact.
        horizontal = set()
        for operands, op in ContentStream(pdf_page.get_contents(), reader).operations:
            if op == b"re" and len(operands) == 4:
                x, y, width, height = map(float, operands)
                if 50 < x < 56 and 725 < width < 740 and 0 < height < 2:
                    horizontal.add(round(y, 2))
        boundaries = sorted(horizontal)
        words = [{"text": w.text or "", **{k: float(v) for k, v in w.attrib.items()}}
                 for w in xml_page.findall(".//x:word", NS)]
        page_lines = []
        for top, bottom in zip(boundaries, boundaries[1:]):
            in_row = [w for w in words if top <= (w["yMin"] + w["yMax"]) / 2 < bottom]
            in_row.sort(key=lambda w: (round(w["yMin"], 1), w["xMin"]))
            columns = [[] for _ in range(5)]
            for w in in_row:
                middle = (w["xMin"] + w["xMax"]) / 2
                column = next((i for i, end in enumerate([102.1, 243.1, 388.7, 676.2]) if middle < end), 4)
                columns[column].append(w["text"])
            cells = ["".join(c).strip() for c in columns]
            if not cells[0].isdigit():
                continue
            if any(not c for c in cells):
                raise ValueError(f"Incomplete cell on page {pnum}: {cells}")
            number = int(cells[0])
            if not 1 <= number <= 305:
                raise ValueError(f"Unexpected row number {number}")
            record = dict(number=number, label=cells[1], meaning=cells[2], example=cells[3], documentLabel=cells[4], page=pnum,
                          region={"x": round(53.52 / 841.85, 6), "y": round(top / 595.25, 6), "width": round(732 / 841.85, 6), "height": round((bottom-top)/595.25, 6)})
            records.append(record)
            page_lines.append("｜".join(cells))
        page_texts.append("\n".join(page_lines))
    if [r["number"] for r in records] != list(range(1, 306)):
        raise ValueError("The source must contain each original row 1–305 exactly once.")
    return records, page_texts, result.stderr.decode("utf-8", errors="replace")


def core(label: str):
    return re.sub(r"（.*?）", "", label).replace("+", "、")


def make_entries(records, source_id):
    result = []
    for r in records:
        n = r["number"]
        correction = CORRECTIONS.get(n, {})
        word = correction.get("word", core(r["label"]))
        meaning = correction.get("meaning", MEANING_CLARIFICATIONS.get(n, r["meaning"]))
        examples = correction.get("example", AUTHORED_EXAMPLES.get(n, r["example"]))
        origin = "authored" if "example" in correction or n in AUTHORED_EXAMPLES else "source"
        bracket = re.search(r"（(.+?)）", r["label"])
        usage = correction.get("usage") or (f"常见搭配：{r['label']}。括号内是它经常连接的对象，不能只记动作不看对象。" if bracket else
                   f"整组表达连起来记：{word}。用来表达“{meaning}”，不要随意交换其中的词序。" if "、" in word else
                   f"结合例句记“{word}”的使用场景；这条表达强调“{meaning}”。")
        parts = [w for w in re.split(r"[、，/]", word) if len(w) >= 2]
        pieces = parts + [word] if len(word) > 16 else [word] + parts
        target = next((w for w in pieces if w in examples), "")
        notes = ["已按上传PDF表格核对；表中来源为简写，未据此声称例句已核验到官方原始文件。"]
        if n in MEANING_CLARIFICATIONS:
            notes.append("学习释义为依据本条表达编写的大白话说明，补足原表过于简略的解释；不替代正式完整定义，原释义另行保留。")
        if correction.get("note"):
            notes.append(correction["note"])
        if origin == "authored":
            notes.append("学习例句为编写，用于连接词义和场景，不是官方引文；原表例句保留在原文对照中。")
        if not target:
            notes.append("原例句未含可精确挖空的完整目标表达，仅用于词义练习和对照阅读。")
        result.append({
            "id": f"vocabulary-{n:03d}", "number": n, "word": word, "label": r["label"], "displayLabel": word if n == 266 else r["label"],
            "meaning": meaning, "usage": usage, "example": examples, "exampleOrigin": origin,
            "meaningOrigin": "authored" if "meaning" in correction or n in MEANING_CLARIFICATIONS else "source",
            "clozeTarget": target, "clozeEligible": bool(target),
            "explanation": correction.get("note", PLAIN_NOTES.get(n, f"先把“{word}”和“{meaning}”连起来，再用例句记住它放在什么场景里。")),
            "explanationOrigin": "authored",
            "source": {"id": source_id, "page": r["page"], "text": "｜".join(str(r[k]) for k in ["number", "label", "meaning", "example", "documentLabel"]),
                       "documentLabel": r["documentLabel"], "originalLabel": r["label"], "originalMeaning": r["meaning"], "originalExample": r["example"], "region": r["region"]},
            "verification": {"status": "corrected" if correction else "source-checked", "checkedAt": VERIFIED_DATE, "officialAttributionVerified": False, "notes": notes},
            "correctionReferences": [REFERENCES[k] for k in correction.get("references", []) + MEANING_REFERENCES.get(n, [])],
            "duplicateGroup": word,
            "confusable": [],
        })
    # Deliberately broad groups to prevent near-synonyms becoming misleading
    # single-choice distractors. These are exclusion groups, not synonym claims.
    clusters = [
        [2,3,73,74,112,113,124], [4,5,6,39,114], [7,182,183], [8,9,10,11,21,117],
        [12,116,267], [13,14,15,175,178], [16,55,66,67,294], [17,18,49,50], [19,20,22],
        [23,136,137,138,197], [24,25,27,52,80,81,186,187,214,282,295],
        [28,53,54], [29,30,31,71,102,103,115,118,119,151,266,276], [32,33,48,145,160,188],
        [34,35,36,55,67,181], [40,41,42,43,76,107,135], [44,109,110,111,279],
        [45,98,283], [46,47,51,121,122], [56,57,58,120,125,182,183],
        [59,60,61,62,68,69,70,126,127,130,141,142,143], [63,65,95,273],
        [72,78,79,81,83,84,85,86,87,179], [82,104,105,131,132,133,134,280],
        [88,89,90,91,92,93,94], [96,246,247,248], [97,106,108,139,140,184],
        [99,144,146,147,148,149,150,158,159], [100,101,228,229,289,290,291,293],
        [128,129], [152,153,154], [155,156,157,163,164,165,193,302,303],
        [166,167], [169,170,171,195], [172,173,174,196,272], [176,177,178],
        [193,42,43,135,138], [194,137,158,159],
        [2,3,24,25,74,112,113,124], [8,9,55,181], [58,59,111,125,126],
        [14,15,33,61,75,175,178], [63,95,96,273], [139,141,130,142,143],
        [27,52,79,80,81,179,186,187,282,295], [11,20,21,29,180,191],
        [19,20,21,22,170], [44,109,110,111,279], [161,304], [212,254],
        [194,158,159,193,302,303], [295,298,297,299,296],
        [239,240,241,242,304], [216,259,192,215], [193,194,155,156,157,163,164,165,302,303],
        [185,199,204,205,206,207], [189,190,191,200,201,202,203,208,209,210],
        [192,215,216,218,257,258,259,261,262,263,264,265], [211,212,249,250,251,252,253,254,255,256],
        [217,219,220,221,222,223,224,225,226,227,235,236,237,244,245],
        [230,231,232,233,234], [238,239,240,241,242], [268,269,270,271,274,275],
        [284,285,286,287,288,297,298,299,300,301],
    ]
    by_number = {e["number"]: e for e in result}
    for cluster in clusters:
        for n in cluster:
            by_number[n]["confusable"] = sorted(set(by_number[n]["confusable"]) | {f"vocabulary-{k:03d}" for k in cluster if k != n})
    return result


def render_previews(pdf, folder, source_id):
    out = folder / "previews" / source_id
    out.mkdir(parents=True, exist_ok=True)
    subprocess.run(["pdftoppm", "-jpeg", "-jpegopt", "quality=88", "-scale-to", "2200", str(pdf), str(out / "render")], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    pages = []
    for jpg in sorted(out.glob("render-*.jpg"), key=lambda p: int(p.stem.split("-")[-1])):
        pnum = int(jpg.stem.split("-")[-1])
        with Image.open(jpg) as source:
            image = source.convert("RGB")
            width, height = image.size
            image.save(out / f"{pnum}-hd.webp", quality=90)
            image.thumbnail((1400, 1400))
            image.save(out / f"{pnum}.webp", quality=86)
        pages.append({"page": pnum, "width": width, "height": height, "rotation": 0})
        jpg.unlink()
    write_json(out / "manifest.json", {"id": source_id, "pages": pages})
    return pages


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=pathlib.Path, default=DEFAULT_PDF)
    parser.add_argument("--skip-previews", action="store_true")
    args = parser.parse_args()
    pdf = args.input.resolve()
    folder = ROOT / "output" / "vocabulary-source"
    folder.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
    source_id = f"source-vocabulary-{digest[:16]}"
    records, pages_text, warnings = extract(pdf, folder)
    entries = make_entries(records, source_id)
    duplicate_groups = collections.defaultdict(list)
    for e in entries:
        duplicate_groups[e["word"]].append(e["number"])
    audit = {
        "sourceRowCount": len(entries), "expectedSequence": "1-305", "pdfPageCount": len(pages_text),
        "uniqueCoreExpressions": len(duplicate_groups),
        "duplicatesPreserved": [{"word": k, "numbers": v} for k, v in duplicate_groups.items() if len(v) > 1],
        "correctedRows": list(CORRECTIONS), "authoredExampleCount": sum(e["exampleOrigin"] == "authored" for e in entries),
        "authoredMeaningCount": sum(e["meaningOrigin"] == "authored" for e in entries),
        "clozeEligibleCount": sum(e["clozeEligible"] for e in entries),
        "clozeUnavailable": [e["number"] for e in entries if not e["clozeEligible"]],
        "extractionMethod": "Poppler bbox text layer assigned to pypdf vector table-cell boundaries; no OCR guesses",
        "rendererWarnings": sorted(set(warnings.splitlines())),
        "notes": ["用户称300词，实际原表连续编号1至305；全部保留。", "重复表达保留其原编号、原搭配和原例句；不计作独立掌握证据。", "来源文件列仅为原表简写，不代表已核验其官方出处。"],
    }
    title = "申论词语与搭配 · 305条"
    source = {"id": source_id, "title": title, "sha256": digest, "pageCount": len(pages_text), "filename": f"{digest}.pdf",
              "attributionNote": "用户上传表达表，原表来源为简写；除明确列出的校正依据外，未逐句核验到官方原文。"}
    candidate = {"schemaVersion": 1, "title": title, "sourceId": source_id, "checkedAt": VERIFIED_DATE, "source": source, "entries": entries, "audit": audit}
    write_json(ROOT / "data" / "vocabulary-candidate.json", candidate)
    # Only data candidates; the parent installer owns platform.json transactions.
    source_record = {**source, "origin": "vocabulary", "size": pdf.stat().st_size, "kind": "pdf", "subject": "shenlun", "topic": "申论词语与搭配", "date": "2026-10-20", "missing": False,
                     "pages": [{"pageNumber": i, "rawText": t, "sourceContent": {"materialText": t, "originalPdfPage": i, "visualMarksPreserved": True},
                                "textLayerConfidence": 1, "manualReviewRequired": False, "visualInspectionStatus": "原表文本层与表格单元核对", "previewUrl": ""} for i, t in enumerate(pages_text, 1)]}
    write_json(folder / "source-record.json", source_record)
    shutil.copy2(pdf, folder / source["filename"])
    if not args.skip_previews:
        render_previews(pdf, folder, source_id)
    write_json(folder / "audit.json", audit)
    print(json.dumps({"candidate": str(ROOT / "data" / "vocabulary-candidate.json"), "sourceId": source_id, **audit}, ensure_ascii=False))


if __name__ == "__main__":
    main()
