import math, os, io, sys, numpy as np, urllib.request
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
def tx(lon,z): return (lon+180)/360*2**z
def ty(lat,z):
    r=math.radians(lat); return (1-math.log(math.tan(r)+1/math.cos(r))/math.pi)/2*2**z
def fetch(z,x,y):
    p=f'tiles/{z}_{x}_{y}.png'
    if not os.path.exists(p):
        u=f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
        for k in range(4):
            try:
                d=urllib.request.urlopen(u,timeout=30).read(); open(p,'wb').write(d); break
            except Exception as e: print('retry',u,e)
    a=np.asarray(Image.open(p).convert('RGB')).astype(np.float64)
    return a[...,0]*256+a[...,1]+a[...,2]/256-32768
def mosaic(name,z,lon0,lon1,lat0,lat1,W,H):
    x0,x1=int(tx(lon0,z)),int(tx(lon1,z)); y0,y1=int(ty(lat1,z)),int(ty(lat0,z))
    n=2**z
    jobs=[(z,x%n,y) for y in range(y0,y1+1) for x in range(x0,x1+1)]
    with ThreadPoolExecutor(16) as ex: res=list(ex.map(lambda j:fetch(*j),jobs))
    M=np.zeros(((y1-y0+1)*256,(x1-x0+1)*256))
    i=0
    for y in range(y0,y1+1):
        for x in range(x0,x1+1):
            M[(y-y0)*256:(y-y0+1)*256,(x-x0)*256:(x-x0+1)*256]=res[i]; i+=1
    # resample to equirect grid (lat descending rows)
    lons=np.linspace(lon0,lon1,W); lats=np.linspace(lat1,lat0,H)
    px=(np.array([tx(l,z) for l in lons])-x0)*256-0.5
    py=(np.array([ty(l,z) for l in lats])-y0)*256-0.5
    from scipy.ndimage import map_coordinates
    PY,PX=np.meshgrid(py,px,indexing='ij')
    E=map_coordinates(M,[PY,PX],order=1,mode='nearest')
    np.save(f'data/{name}.npy',E.astype(np.float32))
    print(name,E.shape,E.min(),E.max())
mosaic('world',4,-180,180,-80,80,4096,1820)
mosaic('region',7,40,72,12,34,2560,1760)
mosaic('strait',10,55.4,57.6,25.5,27.5,2048,1862)
