"""Locate figures on printed question pages and assemble a reviewable candidate."""
import argparse
from collections import Counter, defaultdict
from functools import lru_cache
from importlib import import_module
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tmp/pdf-ocr-env"))
import cv2
import numpy as np
from PIL import Image

THINKING = "source-adaa1c70c42f855e5cb0b163"
LOWER = "source-27c9642d30115cd64d7902bc"
UPPER_LOWER = {"police-drill-20260917", "police-lower-20261014"}
VISUAL_CUE = re.compile(
    r"下[图表]|上[图表]|原[图表]|此图|图中|图示|图表|见[图表]|如下[图表]|"
    r"图例|示意图|统计图|流程图|图[一二三四1-9]|表[一二三四1-9]|"
    r"(?:以下|结合|依据|根据|阅读).{0,12}(?:张图|幅图|地形图|路线图|图形)"
)


def refs(q):
    return q.get("originalPages", []) + q.get("contextPages", [])


def image_file(source, page):
    return ROOT / "data/previews" / source / f"{page}-clean.webp"


@lru_cache(maxsize=None)
def image_size(source, page):
    with Image.open(image_file(source, page)) as image:
        return image.size


def clip(source, page, box, suffix="-clean", dimensions=None):
    x, y, right, bottom = box
    width, height = dimensions or image_size(source,page)
    assert 0 <= x < right <= 1 and 0 <= y < bottom <= 1
    return dict(sourceId=source,page=page,width=width,height=height,previewSuffix=suffix,
                region=dict(x=round(x,6),y=round(y,6),w=round(right-x,6),h=round(bottom-y,6)))


def manual_thinking():
    mappings={}
    file=Path(__file__).with_name("thinking-practice-figures.txt")
    for line in file.read_text(encoding="utf8").splitlines():
        if not line or line.startswith("#"):
            continue
        key,*specs=line.split()
        assert key not in mappings
        figures=[]
        for spec in specs:
            page, box=spec.split(":")
            figures.append(clip(THINKING,int(page),tuple(float(v)/100 for v in box.split(","))))
        mappings[key]=figures
    return mappings


@lru_cache(maxsize=None)
def printed_regions(source,page):
    path=image_file(source,page)
    if not path.is_file():
        return ()
    w,h=850,1250
    with Image.open(path) as image:
        grey=np.asarray(image.convert("L").resize((w,h),Image.Resampling.LANCZOS))
    ink=np.uint8(grey<142)
    count,_,stats,_=cv2.connectedComponentsWithStats(ink,8)
    boxes=[]
    for x,y,iw,ih,a in stats[1:count]:
        if x<w*.045 or x+iw>w*.955 or y<h*.033 or y+ih>h*.968:
            continue
        # Text glyphs are short; reserve long connected edges and large icons
        # for review. A candidate still needs a separately checked question.
        if (iw>=w*.086 and ih>=h*.025 and a>=85) or (iw>=w*.032 and ih>=h*.043 and a>=95):
            boxes.append((x/w,y/h,(x+iw)/w,(y+ih)/h))
    return tuple(boxes)


def geometric_candidates(images):
    candidates=[]
    for ref in images:
        source,page=ref["sourceId"],ref["page"]
        region=ref.get("region",{})
        x,y=region.get("x",0),region.get("y",0)
        right,bottom=x+region.get("w",1),y+region.get("h",1)
        boxes=[b for b in printed_regions(source,page)
               if b[0]>=x-.02 and b[2]<=right+.02 and b[1]>=y-.009 and b[3]<=bottom+.012]
        bands=[]
        for left,top,end,stop in sorted(boxes,key=lambda row:row[1]):
            if bands and top<=bands[-1][3]+.022:
                v=bands[-1]
                bands[-1]=(min(v[0],left),v[1],max(v[2],end),max(v[3],stop))
            else:
                bands.append((left,top,end,stop))
        for l,t,r,b in bands:
            if r-l<.12 or b-t<.026:
                continue
            candidates.append(clip(source,page,(max(x-.012,l-.038),max(y-.004,t-.014),
                                                min(right+.012,r+.038),min(bottom+.005,b+.016))))
    return candidates


def viewable_bands(candidates,pages):
    # Recover detached legends, A–D labels and thin rule ends beside detected
    # geometry. Only take the paper column through the graphic's height.
    result=[]
    for candidate in candidates:
        page=next(p for p in pages if p["page"]==candidate["page"] and p["sourceId"]==candidate["sourceId"]
                  and p["region"]["y"]-.006<=candidate["region"]["y"]<
                      p["region"]["y"]+p["region"]["h"])
        c=candidate["region"]
        area=page["region"]
        trim=(max(.02,area["x"]-.004),c["y"],min(.98,area["x"]+area["w"]+.004),c["y"]+c["h"])
        width,height=image_size(candidate["sourceId"],candidate["page"])
        # Trim mostly blank horizontal margins for mobile while keeping any
        # printed legend or choice labels in the same visual band.
        l,t,r,b=(round(trim[0]*width),round(trim[1]*height),round(trim[2]*width),round(trim[3]*height))
        with Image.open(image_file(candidate["sourceId"],candidate["page"])) as image:
            inset=np.asarray(image.crop((l,t,r,b)).convert("L"))
        used=np.flatnonzero((inset<170).sum(axis=0) >= max(2,round(.008*inset.shape[0])))
        if len(used):
            l,r=max(l,l+int(used[0])-12),min(r,l+int(used[-1])+13)
        result.append(clip(candidate["sourceId"],candidate["page"],(l/width,t/height,r/width,b/height)))
    return result


def overlaps(a,b):
    if (a["sourceId"],a["page"])!=(b["sourceId"],b["page"]):
        return False
    a,b=a["region"],b["region"]
    shared=max(0,min(a["y"]+a["h"],b["y"]+b["h"])-max(a["y"],b["y"]))
    return shared>=.82*min(a["h"],b["h"])


def unique(candidates):
    result=[]
    for candidate in candidates:
        if candidate not in result:
            result.append(candidate)
    return result


def cue(q):
    fields=[q.get(k) or "" for k in ("prompt","contextText","fullContextText")]
    fields += [v for v in q.get("options",{}).values() if isinstance(v,str)]
    text="\n".join(fields)
    text=re.sub(r"以上表(?:述|达)|《[^》]*示意图[^》]*》","",text)
    matched=VISUAL_CUE.search(text)
    return matched.group() if matched else ""


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--output",required=True,type=Path)
    ap.add_argument("--bank")
    args=ap.parse_args()
    db=json.loads((ROOT/"data/platform.json").read_text(encoding="utf8"))
    thinking=manual_thinking()
    surface_builder=import_module("build-police-practice-surfaces")
    assignments={
        "lower-20261014-2022-academy-46":[clip(LOWER,14,(.14,.047,.86,.23))],
        "lower-20261014-2025-jiangsu-76":[clip(LOWER,163,(.13,.19,.83,.624))],
    }
    nonvisual={"lower-20261014-2025-jiangsu-15","lower-20261014-2025-jiangsu-97",
               "lower-20261014-2025-national-36"}
    counts=defaultdict(Counter)
    review=[]
    items={}
    for r in db["records"]:
        q=r.get("details",{}).get("question")
        s=r.get("studyQuestion") or {}
        if r.get("archived") or not isinstance(q,dict) or not refs(q) or s.get("groupOnly"):
            continue
        id=r["id"]
        bank=s.get("bank") or r["subject"]
        if args.bank and bank!=args.bank:
            continue
        counts[bank]["scanned"]+=1
        question,context=[],[]
        signal=cue(q)
        if bank=="police-thinking-20261105":
            key=id.removeprefix("nov-20261105-thinking-")
            question=thinking.get(key,[])
            context=thinking.get("group:"+(s.get("caseGroupId") or ""),[])
        elif bank in UPPER_LOWER:
            geometric=geometric_candidates(q.get("originalPages", []))
            context_geometric=geometric_candidates(q.get("contextPages", [])) if signal or s.get("caseGroupId") else []
            if signal or geometric or context_geometric:
                review.append(dict(id=id,bank=bank,number=s.get("number"), group=s.get("caseGroupId"),
                                   signal=signal,question=geometric,context=context_geometric,
                                   pages=q.get("originalPages", []),contextPages=q.get("contextPages", []),
                                   prompt=q.get("prompt","")[:120]))
                counts[bank]["candidate"]+=1
            question=assignments.get(id) or viewable_bands(geometric,q.get("originalPages",[]))
            context=viewable_bands(context_geometric,q.get("contextPages",[]))
            question=unique([figure for figure in question if not any(overlaps(figure,c) for c in context)])
            context=unique(context)
            if signal and not question and not context and id not in nonvisual:
                items[id]=dict(question=[],context=[],pending=True,cue=signal)
                counts[bank]["unresolved"]+=1
        elif bank=="xingce-tutorial" and q.get("requiresImage") and not q.get("hideOriginalUntilAnswer"):
            counts[bank]["alreadyInline"]+=1
        if question or context:
            counts[bank]["matched"]+=1
            row=dict(question=question,context=context)
            if not q.get("practiceSurface"):
                surface, reason=surface_builder.surface(q,s,question,context)
                if surface and not surface_builder.visible_ink(surface):
                    row["surface"]=surface
                    counts[bank]["surfaceRepaired"]+=1
                else:
                    counts[bank]["surfaceNeedsReview"]+=1
                    row["surfaceNote"]=reason or "已定位原图，题干或选项的干净底图待核"
            items[id]=row
        elif q.get("requiresImage") and bank=="police-thinking-20261105":
            counts[bank]["missingFlagged"]+=1
            items[id]=dict(question=[],context=[],pending=True,cue="原题标记需图")
            review.append(dict(id=id,bank=bank,signal="题目标记需图",question=[],context=[],
                               pages=q.get("originalPages", []),contextPages=q.get("contextPages", []),
                               prompt=q.get("prompt","")[:120]))
        elif bank=="police-thinking-20261105" and signal:
            counts[bank]["unclearCue"]+=1
    args.output.write_text(json.dumps(dict(version=db["version"], counts=counts, items=items,
                                          review=review),ensure_ascii=False),encoding="utf8")
    print(json.dumps(counts,ensure_ascii=False))


if __name__=="__main__":
    main()
