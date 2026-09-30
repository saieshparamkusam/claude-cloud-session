# ATTENTION STUDY — Portugal / Wales

A 32.5-second, 100% motion-graphics design film about a football match that turns into a huge online event.
**The match is the subject. Attention is the story.**

▶ `out/portugal-wales-attention-study.mp4` (master) · `out/portugal-wales-attention-study_preview.mp4` (20 MB preview)
   (1920×1080, 60 fps, H.264 + 48 kHz stereo AAC)
🖼 `out/storyboard.jpg` (16-frame contact sheet)

Everything is generated in code: no footage, images, templates, samples or music loops.
Every frame is drawn in a 2D canvas with a small custom 3D camera. The whole sound design is synthesised in numpy.
Sound cues come from the same event list the animation uses, so they land on the exact frame.

## Honesty about data
The brief gives no verified search volumes, rankings, dates or scores, so **the film shows no statistics.**
Search interest appears as a concept: the words say RELATIVE · CONCEPTUAL, and the end card reads
*"Search interest shown as a concept — no figures, not to scale."* The only numbers on screen are verifiable:
- Lisbon and Cardiff coordinates
- a map scale bar computed from the projection
- real pitch proportions (105 × 68 m, with standard markings)
- Ronaldo's shirt number, 7

## Structure (one continuous transformation)
| Time | Chapter | What transforms into what |
|---|---|---|
| 0–4.2 | 01 Origin | a single point → curved line that suddenly accelerates → data trajectory with nodes. PORTUGAL / *Wales* appear through motion. The line is the real Lisbon→Cardiff route on a rotated editorial map. |
| 4.2–9.2 | 02 Two systems | country outlines fill in as two contrasting systems: Portugal is a structured dot grid, Wales is flowing lines. The camera tilts, the route lifts into a ball trajectory, the outlines morph into two pitch halves that slide together and **collide** at the halfway line. |
| 9.2–15.2 | 03 The name | the collision's particles (typography, grid dots, flow lines and pitch markings) enter orbit → `ronaldo` is typed → flips to RONALDO → multiplies 1→2→4→…→32 through a network → a built numeral 7 → RONALDO fills the frame → everything collapses into one point |
| 15.2–22.6 | 04 Search interest | point → quiet data line → bends upward → 3D twisting ribbon → a tower with SEARCH INTEREST wrapped around it and SPIKE revealed by the rising line → expands → compresses |
| 22.6–28.3 | 05 Momentum | compressed floor plates → concentric rings → orbital sphere → spherical football geometry (truncated icosahedron). Attention streams in, words fly through space, MOMENTUM crosses the frame. Peak, freeze, collapse. |
| 28.3–32.5 | 06 The story | the point opens as an iris into warm cream: *The match is the subject.* **ATTENTION** *is the story* ●, with the opening route returning as a small line |

Palette: controlled black `#030806`, deep green `#05160F`, dark emerald `#0B2F24`, warm cream `#EDE5D0`, acid lime `#CDF23A`, subtle white.
Type (all SIL OFL, in `fonts/`): Archivo (variable width/weight), Instrument Serif Italic, JetBrains Mono.

## Sound
Synthesised voices:
- clicks, data ticks, key ticks, node pops and sonar pings
- low pulses, sub impacts with metallic partials, band-swept whooshes and doppler fly-bys
- risers, reverse "suck" swells, glitch bursts and granular textures
- a very subtle crowd-like murmur inside the climax stream
- a low D drone with bass movement under the build-ups, and a warm open chord for the resolution

The film uses deliberate silences: the collapse before chapter 04, and the freeze at the peak.

## Rebuild
```bash
pip install numpy scipy imageio-ffmpeg     # ffmpeg binary comes with imageio-ffmpeg
cd film && ./build.sh                      # renders the frames, synthesises the audio, then muxes
```
To preview in a browser, open `film/index.html` (`?t=12` starts at 12 s).
- `film/stills.mjs <dir> t1 t2 …` renders single frames.
- `film/core.js` holds the maths, camera and type helpers.
- `film/s1_map.js` … `s6_end.js` hold the scenes.
- `film/main.js` handles the camera choreography, HUD and sound-event registry.
- `film/audio.py` is the synthesiser.
