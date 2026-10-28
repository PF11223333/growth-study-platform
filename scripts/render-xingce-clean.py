"""Render grayscale printed vector paths separately from coloured handwriting.

Only the two monochrome verbal handouts are eligible. Originals and their
annotated previews remain untouched. No classifier treats pen colour as an answer.
"""
import pathlib,json,sys,hashlib,re
root=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tmp/pdf-ocr-env'))
import pymupdf as fitz
from PIL import Image

def gray(color):
    return color is None or max(color)-min(color)<.06

def clean_page(page):
    images=page.get_images();assert all(image[1] for image in images), 'Opaque scan requires a different audited renderer'
    overlay_names={('/'+image[7]).encode() for image in images}
    # Preserve the exact original path operators, winding direction and compound
    # glyph contours. Only suppress colour painting, never reconstruct glyphs.
    tokens=page.read_contents().split();stack=[];fill=True;stroke=True;kept=0;excluded=0
    for i,token in enumerate(tokens):
        if token==b'q':stack.append((fill,stroke))
        elif token==b'Q':fill,stroke=stack.pop()
        elif token in [b'rg',b'RG']:
            values=[float(x) for x in tokens[i-3:i]];isgray=max(values)-min(values)<.06
            if token==b'rg':fill=isgray
            else:stroke=isgray
        elif token==b'g':fill=True
        elif token==b'G':stroke=True
        elif token in [b'k',b'K',b'sc',b'SC',b'scn',b'SCN']:
            values=[float(x) for x in tokens[i-4:i]];isgray=max(values[:3])-min(values[:3])<.06
            if token in [b'k',b'sc',b'scn']:fill=isgray
            else:stroke=isgray
        elif token==b'Do':
            assert tokens[i-1] in overlay_names, 'Unidentified form must not be discarded'
            tokens[i-1]=b'';tokens[i]=b'';excluded+=1
        elif token in [b'BI',b'BT']:
            raise ValueError('Unsupported colour/image/text operator; preserve original page')
        elif token in [b'f',b'F',b'f*',b'S',b's',b'B',b'B*',b'b',b'b*']:
            wanted=fill if token in [b'f',b'F',b'f*'] else stroke if token in [b'S',b's'] else fill and stroke
            if wanted:kept+=1
            else:tokens[i]=b'n';excluded+=1
    assert not stack
    d=fitz.open();d.insert_pdf(page.parent,from_page=page.number,to_page=page.number)
    out=d[0];out.clean_contents();xref=out.get_contents()[0];d.update_stream(xref,b' '.join(tokens))
    return d,kept,excluded

if __name__=='__main__':
    db=json.loads((root/'data/platform.json').read_text(encoding='utf8'));report=[]
    for source in db['sources']:
        if '郭熙' not in source['title']:continue
        sourcefile=root/'data/originals'/source['filename'];before=hashlib.sha256(sourcefile.read_bytes()).hexdigest();doc=fitz.open(sourcefile)
        for index,page in enumerate(doc):
            if source['pageCount']==27 and index<4:continue
            target=root/f"data/previews/{source['id']}/{index+1}-clean.webp"
            clean,kept,excluded=clean_page(page);pix=clean[0].get_pixmap(matrix=fitz.Matrix(2000/page.rect.height,2000/page.rect.height),alpha=False)
            image=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);image.save(target,quality=91)
            report.append({'sourceId':source['id'],'page':index+1,'kept':kept,'excluded':excluded,'width':pix.width,'height':pix.height})
            clean.close()
        assert before==hashlib.sha256(sourcefile.read_bytes()).hexdigest()
    out=root/'output/xingce';out.mkdir(exist_ok=True,parents=True)
    (out/'clean-render-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'pages':len(report),'excludedPaths':sum(x['excluded'] for x in report)}))
