"""Read-only complete rendering including flattened coloured drawing layers."""
import pathlib,sys,json,hashlib,time
root=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'tmp/pdf-ocr-env'))
import fitz,numpy as np,cv2
from PIL import Image
source=pathlib.Path(sys.argv[1]);out=root/'tmp/pdfs/lower-book';out.mkdir(parents=True,exist_ok=True)
document=fitz.open(source);pages=[];started=time.time()
selected=[int(n) for n in sys.argv[2].split(',')] if len(sys.argv)>2 else range(1,len(document)+1)
for number in selected:
    page=document[number-1];target=out/f'{number}-render.jpg'
    scale=2100/max(page.rect.width,page.rect.height)
    pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False)
    image=Image.frombytes('RGB',[pix.width,pix.height],pix.samples);image.save(target,quality=92)
    a=np.asarray(image).astype(np.int16)
    red=((a[:,:,0]-a[:,:,1]>45)&(a[:,:,0]-a[:,:,2]>45)&(a[:,:,0]>75)).astype('uint8')
    blue=((a[:,:,2]-a[:,:,0]>28)&(a[:,:,2]-a[:,:,1]>12)&(a[:,:,2]>55)).astype('uint8')
    regions={}
    for name,mask in [('red',red),('blue',blue)]:
        merged=cv2.dilate(mask,cv2.getStructuringElement(cv2.MORPH_RECT,(8,5)))
        _,_,stats,_=cv2.connectedComponentsWithStats(merged,8)
        regions[name]=[{'x':int(x)/image.width,'y':int(y)/image.height,'w':int(w)/image.width,'h':int(h)/image.height,'area':int(area)} for x,y,w,h,area in stats[1:] if area>=24]
    pages.append({'page':number,'width':image.width,'height':image.height,'rotation':page.rotation,'redPixels':int(red.sum()),'bluePixels':int(blue.sum()),'regions':regions,'renderImage':target.name})
    if number%25==0 or len(selected)<20:print(json.dumps({'rendered':number,'seconds':round(time.time()-started,1)}),flush=True)
    image.close()
if len(selected)==len(document):
    with source.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
    result={'filename':source.name,'sha256':digest,'size':source.stat().st_size,'pageCount':len(document),'pages':pages,'inkRule':'红色为本人作答，蓝色为答案或笔记；仅检测颜色不能确定答案字母或对错。','extractionNote':'完整页面渲染，含主扫描图、全部绘图笔迹；不以单独底图判断作答。'}
    (out/'inspection.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'ok':True,'rendered':len(pages),'seconds':round(time.time()-started,1)}),flush=True)
