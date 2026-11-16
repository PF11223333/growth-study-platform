"""OCR selected existing clean previews in their actual printed coordinates."""
import json
import pathlib
import sys

root=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/"tmp/pdf-ocr-env"))
from PIL import Image
import numpy as np
import onnxruntime as ort
import rapidocr_onnxruntime.utils as utils
from rapidocr_onnxruntime import RapidOCR

options=ort.SessionOptions
def thread_options():
    opts=options()
    opts.intra_op_num_threads=3
    opts.inter_op_num_threads=1
    return opts
utils.SessionOptions=thread_options
ocr=RapidOCR()
ocr.use_angle_cls=False
for op in ocr.text_detector.preprocess_op:
    if hasattr(op,"limit_side_len"):
        op.limit_side_len=1500
        op.limit_type="max"
sid=sys.argv[1]
out=root/"tmp/police-clean-ocr-20261116"
out.mkdir(exist_ok=True)
for number in map(int,sys.argv[2:]):
    with Image.open(root/f"data/previews/{sid}/{number}-clean.webp") as source:
        image=np.asarray(source.convert("RGB"))
    result,_=ocr(image,use_cls=False)
    report={"width":int(image.shape[1]),"height":int(image.shape[0]),"text":result or []}
    (out/f"{sid}-{number}.json").write_text(json.dumps(report,ensure_ascii=False),encoding="utf8")
    print(number,len(report["text"]),flush=True)
