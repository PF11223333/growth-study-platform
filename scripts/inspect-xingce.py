"""Read original verbal tutorial pages and retain OCR coordinates for review."""
import json, pathlib, sys, time
root = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / 'tmp/pdf-ocr-env'))
from rapidocr_onnxruntime import RapidOCR
import rapidocr_onnxruntime.utils as ocr_utils
import onnxruntime as ort
import fitz
import numpy as np
from PIL import Image

def small_session():
    options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
    return options
ocr_utils.SessionOptions=small_session

def main():
    db = json.loads((root/'data/platform.json').read_text(encoding='utf-8'))
    out = root/'output/xingce/ocr';out.mkdir(parents=True, exist_ok=True)
    engine = RapidOCR()
    for source in db['sources']:
        if '郭熙' not in source['title']: continue
        document = fitz.open(root/'data/originals'/source['filename'])
        for index, page in enumerate(document):
            cleaned='--clean' in sys.argv
            if cleaned and source['pageCount']==27 and index<4:continue
            target = out/f"{source['id']}-{index+1}{'-clean' if cleaned else ''}.json"
            if target.exists(): continue
            if cleaned:
                im=Image.open(root/f"data/previews/{source['id']}/{index+1}-clean.webp").convert('RGB');a=np.asarray(im)
            else:
                pix = page.get_pixmap(matrix=fitz.Matrix(2,2), alpha=False)
                a=np.frombuffer(pix.samples,np.uint8).reshape(pix.height,pix.width,3)
            result,elapsed=engine(a)
            data={'sourceId':source['id'],'page':index+1,'width':a.shape[1],'height':a.shape[0],'lines':result or [],'text':'\n'.join(x[1] for x in result or [])}
            target.write_text(json.dumps(data,ensure_ascii=False),encoding='utf-8')
            print(json.dumps({'source':source['id'],'page':index+1,'lines':len(result or [])}),flush=True)

if __name__=='__main__':main()
