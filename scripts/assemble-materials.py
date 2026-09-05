"""GitHub runner: reconstruct exact originals from resumable small uploads."""
import hashlib,json,pathlib,subprocess,os
repo=os.environ['GH_REPO']
def run(args):
    return subprocess.run(args,check=True,stdout=subprocess.PIPE,text=True).stdout
manifest=json.loads(pathlib.Path('site/materials.json').read_text(encoding='utf-8'))
assets=json.loads(run(['gh','api',f'repos/{repo}/releases/tags/materials']))['assets']
ready={a['name']:a for a in assets if a['state']=='uploaded'}
dest=pathlib.Path('assembled');dest.mkdir(exist_ok=True)
for source in manifest:
    name=source['filename']
    if name in ready and ready[name]['size']==source['size']:
        print('Original already available:',name,flush=True);continue
    parts=dest/(name+'-parts');parts.mkdir(exist_ok=True)
    run(['gh','release','download','materials','--repo',repo,'--pattern',name+'.part*','--dir',str(parts)])
    files=sorted(parts.glob(name+'.part*'))
    target=dest/name
    digest=hashlib.sha256();size=0
    with target.open('wb') as out:
        for part in files:
            with part.open('rb') as f:
                while block:=f.read(1024*1024):
                    out.write(block);digest.update(block);size+=len(block)
    if size!=source['size'] or digest.hexdigest()!=source['sha256']:
        raise RuntimeError('Original checksum mismatch: '+name)
    run(['gh','release','upload','materials',str(target),'--repo',repo,'--clobber'])
    print('Original reassembled and verified:',name,flush=True)
