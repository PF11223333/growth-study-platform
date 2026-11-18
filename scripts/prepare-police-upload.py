"""Extract a numbered police exam intake and page-addressable practice figures."""
import hashlib
from difflib import SequenceMatcher
import json
from pathlib import Path
import re
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tmp/pdf-ocr-env"))
import pymupdf
from PIL import Image, ImageOps

STAGING = ROOT / "tmp/police-1118"
QUESTION = re.compile(r"^(\d{1,3})\s*[.、)]\s*(\S.*)")
SECTION = re.compile(r"^(?:第[一二三四五六七八九十\d]+部分\s*|[一二三四五六七八九十]+、)?\s*(?:单项?选择题?|多项?选择题?|情[境景]题|单选题|多选题)(?:[（(\s]|$)")
CONTEXT = re.compile(r"^(?:(?:\d+[.、]|[一二三四五六七八九十]+、|\([一二三四五六七八九十]+\))\s*)?(?:根据|阅读)(?:以下|下列).{0,15}(?:回答|作答).*")
ORDINAL = re.compile(r"^\([一二三四五六七八九十]+\)$")
OPTIONS = re.compile(r"(?<![A-Za-z])([A-D])\s*[.、,，:：)]\s*")
ANSWER = re.compile(r"^(\d{1,3})\s*[.、]\s*(?:【答案】\s*)?([A-D]{1,4})\s*(?:【解析】(.*))?$")


def normalize(text):
    return re.sub(r"[ \t\u3000]+", " ", unicodedata.normalize("NFKC",text)).strip()


def extract_lines(doc):
    for page in doc:
        for block in page.get_text("dict", flags=pymupdf.TEXTFLAGS_DICT & ~pymupdf.TEXT_PRESERVE_IMAGES)["blocks"]:
            for line in block.get("lines", []):
                value=normalize("".join(s["text"] for s in line["spans"])).lstrip("•·● ")
                if not value or value.isdecimal() or value in {"桐哥讲公专","※※※"}:
                    continue
                yield dict(text=value,page=page.number+1,box=line["bbox"])


def join(entries):
    result=""
    for e in entries:
        line=e["text"]
        if result and re.search("[A-Za-z0-9]$",result) and re.match("[A-Za-z0-9]",line):
            result+=" "
        result+=line
    return result


def exam(doc, count, first_multi, start_page=1):
    lines=[e for e in extract_lines(doc) if e["page"]>=start_page]
    rows,groups={},[]
    previous,current,group=0,None,None
    blocking=False
    repeated_context=False
    for line in lines:
        txt=line["text"]
        if re.match(r"^(?:答案(?:与解析|[:：])|全部测验到此结束)",txt):
            break
        if SECTION.match(txt) or re.match(r"^第[一二三四五六七八九十]+部分$",txt):
            current=None
            blocking=True
            continue
        if previous>=70 and count==100 and (CONTEXT.match(txt) or ORDINAL.fullmatch(txt)):
            interval=re.search(r"(\d+)\s*[~～—–－-]\s*(\d+)",txt)
            start=int(interval[1]) if interval else previous+1
            if group and group["start"]==start:
                repeated_context=True
                continue
            if start!=previous+1:
                continue
            group=dict(start=start,header=line,entries=[])
            groups.append(group)
            current=None
            blocking=False
            repeated_context=False
            continue
        m=QUESTION.match(txt)
        if m and int(m[1])==previous+1 and int(m[1])<=count and not re.match(r"^(?:根据|阅读)(?:以下|下列)",m[2]):
            previous=int(m[1])
            current=dict(number=previous,anchor=line,entries=[{**line,"text":m[2]}],group=group)
            rows[previous]=current
            blocking=False
            repeated_context=False
        elif m and int(m[1])==previous and current and m[2]==current["entries"][0]["text"]:
            continue
        elif current and not blocking and not repeated_context:
            current["entries"].append(line)
        elif group and not blocking and not repeated_context and txt!=group["header"]["text"]:
            if not group["entries"] or txt!=group["entries"][-1]["text"]:
                group["entries"].append(line)
    output=[]
    for number,row in rows.items():
        entries=row["entries"]
        value="\n".join(x["text"] for x in entries).replace("\uf0b7","\n")
        value=re.sub(r"(?m)^([A-D])\s+(?=[\u3400-\u9fff])",r"\1. ",value)
        matches=list(OPTIONS.finditer(value))
        # Printed labels can be split into separate columns or appear inline.
        ordered=[]
        for m in matches:
            if len(ordered)<4 and m[1]=="ABCD"[len(ordered)]:
                ordered.append(m)
        prompt=value[:ordered[0].start()] if ordered else value
        options={}
        for i,m in enumerate(ordered):
            end=ordered[i+1].start() if i+1<len(ordered) else len(value)
            options[m[1]]=value[m.end():end].replace("\n","").strip()
        group=row["group"]
        multi=number>=first_multi and (number<=70 or count!=100)
        if count==100 and number>70:
            multi="多选" in re.sub(r"\s+","",prompt)
        output.append(dict(number=number,prompt=prompt.replace("\n","").strip(),options=options,
                           type="multi" if multi else "single",entry=row["anchor"],end=entries[-1],
                           group=group["start"] if group else None))
    for group in groups:
        group["text"]=join(group["entries"])
        group["lastEntry"]=group["entries"][-1] if group["entries"] else group["header"]
    return output,groups


def explained(doc):
    results={}
    current=None
    for line in extract_lines(doc):
        text=line["text"]
        if re.match(r"^(?:答案与解析|.*试卷解析)$",text):
            continue
        m=ANSWER.fullmatch(text)
        if m and int(m[1])==len(results)+1:
            current=dict(answer=m[2],page=line["page"],text=m[3] or "")
            results[int(m[1])]=current
        elif current:
            current["text"]+=text.removeprefix("【解析】")
    return results


def packed_key(doc):
    text=" ".join(normalize(p.get_text()) for p in doc).split("答案:",1)[-1]
    key={}
    for start,end,letters in re.findall(r"(\d+)\s*[~～-]\s*(\d+)\s*([A-D]+)",text):
        if int(end)-int(start)+1==len(letters):
            key.update({int(start)+i:k for i,k in enumerate(letters)})
    for n,a in re.findall(r"\b([5-9]\d|100)\s*([A-D]{1,4})\b",text):
        key[int(n)]=a
    return {n:dict(answer=a,page=len(doc),text="") for n,a in key.items()}


def source_for(num,doc,file):
    digest=hashlib.sha256(file.read_bytes()).hexdigest()
    return dict(id="source-"+digest[:24],sha256=digest,filename=digest+".pdf",
                title=file.stem,originalPath=str(file),size=file.stat().st_size,
                kind="pdf",subject="gongan",topic="公安原卷与时政",date="2026-11-18",
                origin="police-upload-20261118",pageCount=len(doc),localOnly=num==11,missing=False)


def image_regions(doc,page_index):
    page=doc[page_index-1]
    boxes=[]
    for image in page.get_image_info():
        rect=pymupdf.Rect(image["bbox"]) & page.rect
        if rect.is_empty or rect.width<35 or rect.height<23:
            continue
        if rect.get_area()<page.rect.get_area()*.55 and rect.y0>page.rect.height*.06:
            boxes.append(rect)
    return boxes


def clips(doc,source,begin,next_item,finish,collect):
    result=[]
    for pn in range(begin["page"],finish["page"]+1):
        page=doc[pn-1]
        upper=begin["box"][1] if pn==begin["page"] else page.rect.height*.035
        bottom=next_item["box"][1] if next_item and pn==next_item["page"] else page.rect.height*.955
        if not next_item or pn==finish["page"] and pn<next_item["page"]:
            bottom=min(bottom,finish["box"][3]+page.rect.height*.25)
        for rect in collect[pn]:
            if rect.y0>=upper-3 and rect.y1<=bottom+3:
                area=(rect+(-2,-2,2,2)) & page.rect
                x,y,w,h=(round(v,6) for v in (area.x0/page.rect.width,area.y0/page.rect.height,
                                               area.width/page.rect.width,area.height/page.rect.height))
                result.append(dict(sourceId=source["id"],page=pn,region=dict(x=x,y=y,w=w,h=h),
                                   previewSuffix="-hd"))
    return result


def main():
    docs, sources={},{}
    for n in range(1,12):
        file=Path(json.loads((STAGING/f"{n}.json").read_text(encoding="utf8"))["file"])
        docs[n]=pymupdf.open(file)
        sources[n]=source_for(n,docs[n],file)
    keys={2:explained(docs[4]),3:explained(docs[5]),6:packed_key(docs[6]),10:explained(docs[10])}
    bank_ids={1:"2026-national",2:"2025-provinces",3:"2025-national"}
    db=json.loads((ROOT/"data/platform.json").read_text(encoding="utf8"))
    old={(s.get("paperId"),s.get("number")):r for r in db["records"] if (s:=r.get("studyQuestion"))}
    result={}
    for n in (1,2,3,6,7,8,9,10):
        doc=docs[n]
        rows,groups=exam(doc,110 if n==10 else 100,66 if n==10 else 51,3 if n==9 else 1)
        group_map={g["start"]:g for g in groups}
        collect={p:image_regions(doc,p) for p in range(1,len(doc)+1)}
        for i,row in enumerate(rows):
            nxt=rows[i+1] if i+1<len(rows) else None
            group=group_map.get(row["group"])
            next_anchor=nxt["entry"] if nxt else None
            if nxt and nxt["group"]!=row["group"] and nxt["group"] in group_map:
                next_anchor=group_map[nxt["group"]]["header"]
            stop=row["end"]
            if nxt and n!=7 and row["group"]==nxt["group"] and stop["page"]<nxt["entry"]["page"]:
                # A diagram can sit on a text-free continuation page.
                stop={**stop,"page":nxt["entry"]["page"],"box":nxt["entry"]["box"]}
            row["figures"]=clips(doc,sources[n],row["entry"],next_anchor,stop,collect)
            existing=old.get((bank_ids.get(n,""),row["number"]))
            if existing:
                previous=existing["details"]["question"]
                scrub=lambda s:re.sub(r"[^\w\u3400-\u9fff]","",normalize(s)).removeprefix("单选").removeprefix("多选").replace("_","")
                ratio=SequenceMatcher(None,scrub(row["prompt"])[:170],scrub(previous["prompt"])[:170],autojunk=False).ratio()
                row["previous"]=dict(id=existing["id"],similarity=round(ratio,3),
                                     answer=previous.get("referenceAnswer") or previous.get("bookAnswer") or "")
            if group and group["start"]==row["number"]:
                group["figures"]=clips(doc,sources[n],group["header"],row["entry"],
                                       {**group["lastEntry"],"page":row["entry"]["page"]},collect)
        result[n]=dict(rows=rows,groups=groups,key=keys.get(n,{}),imagePages={p:len(a) for p,a in collect.items() if a})
        print(n,len(rows),"keys",len(keys.get(n,{})),"groups",[(g["start"],len(g["text"]),len(g["figures"])) for g in groups],
              "visual",sum(bool(r["figures"]) for r in rows),"missing choices",[r["number"] for r in rows if len(r["options"])!=4])
    (STAGING/"extracted.json").write_text(json.dumps(dict(sources=sources,papers=result),ensure_ascii=False),encoding="utf8")
    if "--previews" in sys.argv:
        render_previews(docs,sources)


def render_previews(docs,sources):
    for n,source in sources.items():
        target=STAGING/"previews"/source["id"]
        target.mkdir(parents=True,exist_ok=True)
        metadata=[]
        for page in docs[n]:
            no=page.number+1
            max_side=1260 if n not in (4,5,10,11) else 1100
            scale=max_side/max(page.rect.width,page.rect.height)
            pix=page.get_pixmap(matrix=pymupdf.Matrix(scale,scale),alpha=False)
            image=Image.frombytes("RGB",(pix.width,pix.height),pix.samples)
            metadata.append(dict(page=no,width=image.width,height=image.height,rotation=0))
            if not (target/f"{no}-hd.webp").is_file():
                image.save(target/f"{no}-hd.webp",quality=60,method=5)
            if not (target/f"{no}.webp").is_file():
                image.thumbnail((650,650),Image.Resampling.LANCZOS)
                image.save(target/f"{no}.webp",quality=56,method=5)
        (target/"manifest.json").write_text(json.dumps(dict(id=source["id"],pages=metadata)),encoding="utf8")
        print(n,sum(p.stat().st_size for p in target.iterdir()),flush=True)


if __name__=="__main__":
    main()
