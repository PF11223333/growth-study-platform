"""Build a self-contained mirror without changing the user's original site.

The original builders are read as source and run with OUTPUT pointing into this
platform. No import cache, data file, or existing generated HTML is changed.
"""
import argparse
import contextlib
import hashlib
import io
import json
import re
import sys
import types
from pathlib import Path

sys.dont_write_bytecode = True


def load_module(name, source):
    module = types.ModuleType(name)
    module.__file__ = str(source)
    sys.modules[name] = module
    # The old regex silently drops expressions beginning at G1000.
    code = source.read_text(encoding="utf-8").replace(r"G\d{3}", r"G\d+").replace(r"Q\d{3}", r"Q\d+")
    exec(compile(code, str(source), "exec"), module.__dict__)
    return module


def build(source, output):
    source, output = Path(source).resolve(), Path(output).resolve()
    if output == source or source in output.parents:
        raise ValueError("镜像输出须放在独立平台，不能覆盖旧申论站")
    output.mkdir(parents=True, exist_ok=True)
    library = load_module("build_material_library", source / "build_material_library.py")
    library.ROOT, library.OUTPUT = source, output / "index.html"
    original_inline = library.inline_md

    def inline_with_day_links(text):
        rendered = original_inline(text)
        return re.sub(r"\[([^\]]+)\]\((?:\./)?(\d{4}-\d{2}-\d{2})\.md(?:#[^)]*)?\)", lambda m: f'<a href="index.html?date={m.group(2)}" data-platform-date="{m.group(2)}">{m.group(1)}</a>', rendered)

    library.inline_md = inline_with_day_links
    original_search = library.build_search_records

    def compact_search(articles, daily, indexes):
        records = original_search(articles, daily, indexes)
        for record in records:
            if record["type"] == "文章":
                key = record["target"]
            elif record["type"] == "每日积累":
                key = record["target"]
            else:
                key = {"主题": "themes", "金句": "expressions", "权威论述": "authority"}[record["type"]] + "|" + record["target"]
            record["_textKey"] = key
            record.pop("text")
        return records

    library.build_search_records = compact_search
    # Full search uses references to the already-embedded article/section text,
    # avoiding a second multi-megabyte copy with identical content.
    search_setup = "const searchText=new Map([...articles.map(a=>[a.id,Object.values(a).map(v=>typeof v==='boolean'?(v?'True':'False'):String(v)).join(' ')]),...daily.flatMap(d=>d.sections.map(s=>[d.date+'|'+s.id,s.plain])),...Object.entries(indexes).flatMap(([k,d])=>d.sections.map(s=>[k+'|'+s.id,s.plain]))]);const searchRecords=__SEARCH__.map(r=>({...r,text:searchText.get(r._textKey)||''}));"
    if "const searchRecords=__SEARCH__;" not in library.PAGE_TEMPLATE:
        raise ValueError("旧站搜索模板已变化，请先适配同步器")
    library.PAGE_TEMPLATE = library.PAGE_TEMPLATE.replace("const searchRecords=__SEARCH__;", search_setup)
    original_parse = library.parse_markdown_document

    def parse_chinese_headings(text, prefix):
        numerals = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12, "十三": 13, "十四": 14, "十五": 15}
        original_titles = [library.plain_md(line[3:]) for line in text.splitlines() if line.startswith("## ")]
        normalized = re.sub(r"^## ([一二三四五六七八九十]+)、", lambda m: f"## {numerals.get(m.group(1), m.group(1))}. ", text, flags=re.M)
        document = original_parse(normalized, prefix)
        for section, title in zip(document["sections"], original_titles):
            section["title"] = title
        return document

    library.parse_markdown_document = parse_chinese_headings
    original_dashboard = library.build_dashboard

    def compatible_dashboard(day):
        # Section numbers changed between early and recent daily files. Match
        # their actual names so 今日必背 cannot accidentally display a study plan.
        normalized = {**day, "sections": []}
        combined = ""
        for section in day["sections"]:
            title = section["title"]
            number = (1 if "精读" in title else 10 if "今日必背" in title else 12 if "复习" in title else 11 if "学习" in title or "使用建议" in title else None)
            if "学习" in title and ("复盘" in title or "复习" in title):
                combined = section.get("_markdown", "")
            normalized["sections"].append({**section, "number": number})
        if combined:
            groups = library.split_h3(combined)[1]
            study = next(("\n".join(g["lines"]) for g in groups if "分钟" in g["title"] or "学习" in g["title"]), "")
            review = next(("\n".join(g["lines"]) for g in groups if "复习" in g["title"]), "")
            normalized["sections"].extend([{"number": 11, "_markdown": study}, {"number": 12, "_markdown": "### 今日到期\n" + review}])
        return original_dashboard(normalized)

    library.build_dashboard = compatible_dashboard
    mobile = load_module("build_mobile_memory", source / "build_mobile_memory.py")
    mobile.ROOT, mobile.DAILY_DIR, mobile.OUTPUT = source, source / "每日积累", output / "today.html"
    original_classics = mobile.parse_classics
    mobile.parse_classics = lambda section: original_classics(re.sub(r"^### (示范[一二三四五六七八九十\d].*)$", r"#### \1", section, flags=re.M))
    mobile.PAGE_TEMPLATE = mobile.PAGE_TEMPLATE.replace("公网更新：__BUILT_AT__", "资料更新：__BUILT_AT__").replace("每日积累完成后自动更新 · 内容均来自本地申论素材库", "资料随平台发布同步 · 学习记录保存在当前浏览器")
    with contextlib.redirect_stdout(io.StringIO()):
        library.build()
        mobile.build()
    latest_date = max(path.stem for path in mobile.DAILY_DIR.glob("20??-??-??.md"))
    return_link = '<a class="platform-return" href="../#/shenlun" target="_top">← 返回向内生长 · 申论</a>'
    return_css = '<style>.platform-return{display:block;background:#f5efe5;color:#754833;padding:9px 18px;font:14px/1.5 "Microsoft YaHei",sans-serif;border-bottom:1px solid #e4d9ca;text-decoration:none}.platform-return:focus-visible{outline:3px solid #a65039;outline-offset:-3px}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation:none!important;transition:none!important}}</style>'
    outputs = {}
    for filename in ("index.html", "today.html"):
        dest = output / filename
        content = dest.read_text(encoding="utf-8")
        if latest_date not in content or "\ufffd" in content:
            raise ValueError(f"{filename} 最新日期或编码校验失败")
        if re.search(r'file:/+|(?<![A-Za-z])[A-Za-z]:\\\\', content):
            raise ValueError(f"{filename} 包含本机文件路径，停止公开导出")
        if re.search(r'<(?:script|iframe)[^>]*src=["\'](?!data:)', content):
            raise ValueError(f"{filename} 含未打包脚本或嵌套网页")
        content = content.replace("</head>", return_css + "</head>", 1).replace("<body>", "<body>" + return_link, 1)
        if filename == "index.html":
            content = content.replace("</body>", '<script>document.addEventListener("click",event=>{const link=event.target.closest("a[data-platform-date]");if(link&&daily.some(d=>d.date===link.dataset.platformDate)){event.preventDefault();showFullDay(link.dataset.platformDate);}});const requestedDay=new URLSearchParams(location.search).get("date");if(requestedDay&&daily.some(d=>d.date===requestedDay))showFullDay(requestedDay);</script></body>', 1)
        dest.write_text(content, encoding="utf-8")
        outputs[filename] = {"bytes": dest.stat().st_size, "sha256": hashlib.sha256(dest.read_bytes()).hexdigest()}
    return {"latestDate": latest_date, "files": outputs, "fixes": ["四位及更长金句编号", "中文章节序号与精读解析", "按章节标题识别必背和复习任务", "古文示范三级标题解析", "站内返回与历史日刊链接", "搜索索引复用原文减小传输", "减少动效偏好"]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.source, args.output), ensure_ascii=True))
