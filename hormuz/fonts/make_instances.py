"""Instance Mona Sans (wdth 75-125 step 5, 4 weights) and Geist Mono (3 weights) into
static TTFs in fonts/inst/. Canvas2D cannot drive variable-font axes directly; the film
interpolates between these instances to animate type width smoothly."""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(HERE, 'inst'), exist_ok=True)
for wg in [300, 450, 700, 850]:
    for wd in range(75, 126, 5):
        f = instantiateVariableFont(TTFont(os.path.join(HERE, 'MonaSans.ttf')), {'wdth': wd, 'wght': wg})
        f.save(os.path.join(HERE, 'inst', f'Mona_{wd}_{wg}.ttf'))
for wg in [300, 400, 500]:
    f = instantiateVariableFont(TTFont(os.path.join(HERE, 'GeistMono.ttf')), {'wght': wg})
    f.save(os.path.join(HERE, 'inst', f'Geist_{wg}.ttf'))
