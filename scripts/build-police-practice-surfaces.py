"""Prepare independent question surfaces from text and question-bound OCR boxes.

The old crop, answer labels, and OCR confidence alone never determine a safe
surface. Read the clean print only when a numbered anchor and four distinct
option rows are present. Keep inconclusive cases in the audit for review.
"""
import argparse
from collections import Counter
from functools import lru_cache
import json
from pathlib import Path
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tmp/pdf-ocr-env"))
from PIL import Image
import numpy as np
UPPER = "source-9657660fd40d4a780c48fe10"
LOWER = "source-27c9642d30115cd64d7902bc"
LETTERS = "ABCD"
QUESTION = re.compile(r"^[、·•.('“\s]*([0-9]{1,3})(?:[.．、,/'“)\s]+|(?=[\u3400-\u9fff]))")
OPTION = re.compile(r"^([ABCD])(?:[.．、:：)）\s]+|(?=[\u3400-\u9fff]))\s*(\S.*)")
ANSWER = re.compile(r"^(?:[【\[（(]\s*)?(?:(?:参考|正确|标准|原书|书后|题册|本题)?答案|(?:试题|参考|本题)?解析|桐哥提示|勘误|订正)(?:[】\]）)\s：:]|$)|^[0-9]{1,3}[.．、]\s*[A-D]{1,4}\s*$", re.I)
VISUAL = re.compile(r"如下图|下图|上图|此图|图中|图示|见图|配图|地图|图例|标记点|下表|上表|如下表|表格|统计图|流程图|示意图|图[一二三四1-9]")
LAYOUT_HEADER = re.compile(r"^桐哥讲公专$|^小题狂刷(?:20\d\d)?[（(]|^\d{1,3}$")
SECTION_HEADER = re.compile(
    r"^(?:(?:[（(][一二三四五六七八九十\d]+[）)]|[一二三四五六七八九十]+[、.])\s*)?"
    r"(?:根据(?:以下|下列|所给|材料)|请根据|阅读(?:以下|下列)|情[境景]材料|"
    r"(?:单项|多项|不定项)选择题|判断题|材料[一二三四五六七八九十\d]+[：:])"
)
PLACEHOLDER = re.compile(r"请对照原页|请查看原页|选项未识别|选项见上方|识别失败|^待[核补确]")


def usable(text):
    return isinstance(text, str) and text.strip() and not PLACEHOLDER.search(text) and not any(
        ANSWER.search(line.strip()) for line in text.splitlines()
    )


def normalized(text):
    return re.sub(r"[^\w]", "", unicodedata.normalize("NFKC", text))


@lru_cache(maxsize=None)
def page_lines(source, number):
    refreshed = ROOT / f"tmp/police-clean-ocr-20261116/{source}-{number}.json"
    if source == UPPER:
        file = ROOT / f"tmp/question-notes/printed-ocr/{number}.json"
        if not file.is_file():
            file = ROOT / f"tmp/question-notes/ocr/source-cc8b3e9a5da3eedaf23b6476-{number}.json"
    elif source == LOWER:
        file = ROOT / f"tmp/pdfs/lower-book/{number}-ocr.json"
    else:
        return []
    if refreshed.is_file():
        file = refreshed
    if not file.is_file():
        return []
    data = json.loads(file.read_text(encoding="utf-8"))
    clean = ROOT / f"data/previews/{source}/{number}-clean.webp"
    if not clean.is_file():
        return []
    with Image.open(clean) as image:
        if abs((data["width"]/data["height"])/(image.width/image.height)-1)>.004:
            return []
    rows = []
    for entry in data.get("lines", data.get("text", [])):
        box, text = (entry["box"], entry["text"]) if isinstance(entry, dict) else entry[:2]
        text = unicodedata.normalize("NFKC", text).strip()
        if not text or LAYOUT_HEADER.search(text) or re.fullmatch(r"[A-Za-z✓√×]{1,4}",text):
            continue
        xs, ys = zip(*box)
        rows.append((text, min(xs)/data["width"], min(ys)/data["height"],
                     max(xs)/data["width"], max(ys)/data["height"]))
    return rows


def line_span(page, padding=.006):
    box = page.get("region")
    if not box:
        return []
    y, end = box["y"], box["y"] + box["h"]
    return [row for row in page_lines(page["sourceId"], page["page"])
            if y-padding <= (row[2]+row[4])/2 < end+padding]


def clip(page, rows):
    low = min(r[2] for r in rows)
    high = max(r[4] for r in rows)
    left = min(r[1] for r in rows)
    right = max(r[3] for r in rows)
    x, y = max(0, left-.006), max(0, low-.004)
    return {**{k: page[k] for k in ("sourceId","page","width","height")},
            "previewSuffix": "-clean",
            "region": dict(x=round(x,6), y=round(y,6), w=round(min(1,right+.006)-x,6),
                           h=round(min(1,high+.004)-y,6))}


def stem_clips(entries, figures=()):
    # OCR boxes for consecutive printed lines may overlap slightly at their
    # edges. A single continuous block per page avoids cutting or repeating
    # parts of those lines.
    blocks = []
    for page, row in entries:
        if (not blocks or blocks[-1][0]["page"]!=page["page"] or
                figures and row[2]-blocks[-1][1][-1][4]>.026):
            blocks.append((page,[]))
        blocks[-1][1].append(row)
    return [clip(page, rows) for page, rows in blocks]


def clean_page_exists(page):
    return (ROOT / "data/previews" / page["sourceId"] / f'{page["page"]}-clean.webp').is_file()


@lru_cache(maxsize=10)
def ink_map(source, number):
    with Image.open(ROOT / f"data/previews/{source}/{number}-clean.webp") as image:
        rgb=np.asarray(image.convert("RGB"), dtype=np.int16)
    r,g,b=rgb.transpose(2,0,1)
    return ((r-g>50)&(r-b>43))|((b-r>48)&(b-g>35))


def visible_ink(surface):
    clips=surface.get("stemClips",[])+surface.get("contextClips",[])+[
        p for o in surface["options"].values() for p in o.get("clips",[])
    ]
    for c in clips:
        ink=ink_map(c["sourceId"],c["page"])
        height,width=ink.shape
        b=c["region"]
        area=ink[round(b["y"]*height):round((b["y"]+b["h"])*height),
                 round(b["x"]*width):round((b["x"]+b["w"])*width)]
        if area.sum()>28:
            return True
    return False


def inside_figure(clip_page, row, images):
    for image in images:
        if (image["sourceId"],image["page"])!=(clip_page["sourceId"],clip_page["page"]):
            continue
        region=image["region"]
        baseline=(row[2]+row[4])/2
        if region["y"]+.003 <= baseline <= region["y"]+region["h"]-.003 and region["x"]-.01 <= (row[1]+row[3])/2 <= region["x"]+region["w"]+.01:
            return True
    return False


def single_question_scan(q, study, figures=(), context_figures=()):
    pages = q.get("originalPages") or []
    if not pages or len(pages)>3 or any(not clean_page_exists(p) for p in pages):
        return None, "缺少可核对的干净底图"
    rows = [(p, row) for p in pages for row in line_span(p,.015) if not inside_figure(p,row,figures)]
    rows.sort(key=lambda item: (item[0]["page"], item[1][2], item[1][1]))
    prefix = normalized(q.get("prompt") or "")[:9]
    number = str(study.get("originalNumber") or study.get("number") or "")
    indices = []
    for i, (p,row) in enumerate(rows):
        m = QUESTION.match(row[0])
        if not m or m[1]!=number or row[2]<p["region"]["y"]-.016 or row[2]>p["region"]["y"]+.055:
            continue
        start_text = normalized(row[0][m.end():]) + "".join(
            normalized(v[0]) for _,v in rows[i+1:i+3] if not (QUESTION.match(v[0]) or OPTION.match(v[0])))
        if prefix and prefix in start_text:
            indices.append(i)
    if len(indices)!=1:
        return None, "题号与原文起点待核"
    stem, options, current = [], {}, ""
    for p, row in rows[indices[0]:]:
        text = row[0]
        if ANSWER.match(text) or (QUESTION.match(text) and (stem or options)) or (options and SECTION_HEADER.match(text)):
            break
        match = OPTION.match(text)
        if match:
            current = match[1]
            if current in options:
                return None, "选项分栏或边界待核"
            options[current] = []
        elif current and (row[2]+row[4])/2 > p["region"]["y"]+p["region"]["h"]+.004:
            break
        (options[current] if current else stem).append((p,row))
    if set(options) != set(LETTERS) or not stem:
        return None, "未确认完整的 A–D 四个选项"
    first_options = {}
    for entries in options.values():
        for p,r in entries:
            first_options[p["page"]] = min(first_options.get(p["page"],1),r[2])
    stem = [(p,r) for p,r in stem if r[4]+.002<first_options.get(p["page"],1)]
    if not stem or any(not entries for entries in options.values()):
        return None, "题干与选项重叠，需核对印刷位置"
    all_text = " ".join(row[0] for _, row in stem+sum(options.values(),[]))
    if (not figures and VISUAL.search(all_text)) or re.search(r"(?:^|\s)[A-D][.．、:：]", " ".join(row[0] for _, row in options["D"][1:])):
        return None, "图表或版式需要独立核对"
    context, case_reason = stage_context(q,study,context_figures)
    if case_reason:
        return None, case_reason
    # Crop each option independently, including when several options share a row.
    return {"stemClips":stem_clips(stem,figures), **context,
            "options":{letter:{"clips":[clip(p,[r]) for p,r in options[letter]]} for letter in LETTERS}}, ""


def stage_context(q, study, figures=()):
    context = q.get("fullContextText") or q.get("contextText")
    if q.get("contextTextVerified") and usable(context) and (figures or not VISUAL.search(context)):
        return {"context":context}, ""
    if study.get("groupType")=="case" and not study.get("caseGroupId") and not q.get("contextPages"):
        return {}, "缺少可用的情景组定位"
    if not study.get("caseGroupId") and not q.get("contextPages"):
        return {}, ""
    source_pages = q.get("contextPages") or []
    found = []
    if not source_pages or any(not clean_page_exists(p) for p in source_pages):
        return {}, "共享情景题面待核"
    for p in source_pages:
        selected = [r for r in line_span(p,padding=0) if not (
            SECTION_HEADER.match(r[0]) and re.search(r"回答.{0,18}题",r[0])
        )]
        selected=[r for r in selected if not inside_figure(p,r,figures)]
        if not selected and any(c["page"]==p["page"] for c in figures):
            continue
        if not selected or any(QUESTION.search(r[0]) or OPTION.search(r[0]) or ANSWER.search(r[0]) or (not figures and VISUAL.search(r[0])) for r in selected):
            return {}, "共享材料与相邻小题或图表的边界待核"
        found.extend(stem_clips([(p,r) for r in selected],figures))
    return {"contextClips":found}, ""


def surface(q,study,figures=(),context_figures=()):
    opts = q.get("options") or {}
    prompt = q.get("prompt") or ""
    suspects = "\n".join([prompt,q.get("fullContextText") or q.get("contextText") or "",*(str(opts.get(k,"")) for k in LETTERS)])
    # Text-authoring pipelines already split one question. Nonetheless, require
    # real option text and reject unsplit numbering/explicit answer cues.
    if (q.get("verifiedText") or q.get("textVerified")) and usable(prompt) and all(usable(opts.get(k)) for k in LETTERS):
        if not (figures or context_figures) and (VISUAL.search(suspects) or re.search(r"(?:图|表)\s*[：:]",suspects)):
            return None, "原题图表需要独立裁片"
        context, reason = stage_context(q,study,context_figures)
        if not reason:
            return {"stem":prompt,"options":{k:{"text":opts[k]} for k in LETTERS},**context}, ""
    return single_question_scan(q,study,figures,context_figures)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    args=parser.parse_args()
    db=json.loads((ROOT/"data/platform.json").read_text(encoding="utf-8"))
    rows, counts = {}, {}
    for r in db["records"]:
        q=r.get("details",{}).get("question") or {}
        s=r.get("studyQuestion") or {}
        if r.get("archived") or r["kind"]!="practice" or r["subject"]!="gongan" or s.get("groupOnly") or not q.get("originalPages"):
            continue
        prepared,reason=surface(q,s)
        if prepared and visible_ink(prepared):
            prepared,reason=None,"干净底图仍有颜色笔迹，需核对"
        rows[r["id"]]={"revision":r["revision"], "surface":prepared, "reason":reason}
        counts.setdefault(s.get("bank"),Counter())["ready" if prepared else reason]+=1
    args.output.write_text(json.dumps({"version":db["version"],"rows":rows,"counts":counts},ensure_ascii=False),encoding="utf-8")
    print(json.dumps(counts,ensure_ascii=False))


if __name__=="__main__":
    main()
