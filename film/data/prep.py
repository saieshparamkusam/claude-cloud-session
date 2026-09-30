import numpy as np, json, math
from scipy import ndimage
meta={}
boxes={'world':(-180,180,-80,80),'region':(40,72,12,34),'strait':(55.4,57.6,25.5,27.5)}
for n,(l0,l1,a0,a1) in boxes.items():
    E=np.load(f'data/{n}.npy')
    E=ndimage.gaussian_filter(E,{'world':1.1,'region':1.9,'strait':2.0}[n])
    Cc=ndimage.gaussian_filter(np.clip(np.load(f'data/{n}.npy'),-80,80),{'world':1.6,'region':2.2,'strait':2.6}[n])
    np.stack([E,Cc],-1).astype(np.float16).tofile(f'data/{n}.f16')
    meta[n]=dict(lon0=l0,lon1=l1,lat0=a0,lat1=a1,w=E.shape[1],h=E.shape[0])
json.dump(meta,open('data/meta.json','w'))
# narrowest gap in strait
E=np.load('data/strait.npy'); l0,l1,a0,a1=boxes['strait']; H,W=E.shape
land=E>0.5
lab,nl=ndimage.label(land)
lon=np.linspace(l0,l1,W); lat=np.linspace(a1,a0,H)
def ll(i,j): return lon[j],lat[i]
# Iran mainland = component at (57.2E,27.3N); Oman musandam = (56.2E,26.0N)
def comp(lo,la): return lab[int((a1-la)/(a1-a0)*(H-1)), int((lo-l0)/(l1-l0)*(W-1))]
ci=comp(57.3,27.3); co=comp(56.15,26.0)
print('components',nl,ci,co)
def edge(mask):
    e=mask & ~ndimage.binary_erosion(mask); ii,jj=np.nonzero(e); return np.c_[lon[jj],lat[ii]]
def mind(A,B):
    from scipy.spatial import cKDTree
    k=math.cos(math.radians(26.5))
    t=cKDTree(B*[k,1]); d,ix=t.query(A*[k,1]); m=d.argmin(); return d[m]*111.2,A[m],B[ix[m]]
# islands: Iranian side = components north of 26.75 ; Omani = south / quoin
sizes=ndimage.sum(land,lab,range(1,nl+1))
ir=lab==ci; om=lab==co
print('mainland gap km',mind(edge(ir),edge(om)))
for k in range(1,nl+1):
    if sizes[k-1]<30: continue
    ii,jj=np.nonzero(lab==k); print(k,int(sizes[k-1]),round(lon[jj].mean(),3),round(lat[ii].mean(),3))
