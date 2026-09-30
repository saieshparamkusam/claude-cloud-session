# HORMUZ — source list

Every number or factual statement that appears on screen, with its source. Retrieved 30 Sep 2026.

| On screen | Value | Source |
|---|---|---|
| Strait width | "21 MI at its narrowest" | U.S. EIA, *Today in Energy* — "At its narrowest point, the Strait is 21 miles wide, but the width of the shipping lane in either direction is only two miles, separated by a two-mile buffer zone." https://www.eia.gov/todayinenergy/detail.php?id=4430 |
| Lane width | "Shipping lanes: 2 mi each way" | Same EIA article (id=4430). Lane geometry in the film (two 2-mi lanes, 2-mi buffer) is drawn to that spec. |
| Oil flow | "20,000,000 barrels of oil a day" | U.S. EIA, *Amid regional conflict, the Strait of Hormuz remains critical oil chokepoint* (16 Jun 2025): "In 2024, oil flow through the strait averaged 20 million barrels per day (b/d), or the equivalent of about 20% of global petroleum liquids consumption." https://www.eia.gov/todayinenergy/detail.php?id=65504 — consistent with IEA: "an average of 20 million barrels per day (mb/d) of crude oil and oil products were shipped in 2025." https://www.iea.org/about/oil-security-and-emergency-response/strait-of-hormuz |
| Share of oil | "20% of the world's oil consumption" | EIA (id=65504), quoted above. |
| LNG | "~one-fifth of global LNG trade" | IEA Strait of Hormuz page (updated Feb 2026): "the total volume of LNG transiting the Strait was just over 112 bcm in 2025, equating to almost 20% of global LNG trade." Also EIA id=65504 ("around one-fifth of global liquefied natural gas trade also transited the Strait of Hormuz in 2024"). |
| Disruption date + events | "28·02·2026 — U.S. and Israeli strikes on Iran begin. Iranian forces declare the strait closed. Cross-strait traffic largely halts." | Congressional Research Service, *The Strait of Hormuz: Security Developments and Impacts on Oil, Gas, and Other Commodities*, R45281 v8 (7 Aug 2026): "Days after U.S.-Israeli attacks on Iran began, Iranian forces declared the Strait closed and cross-Strait traffic largely halted, with hundreds of vessels and thousands of mariners effectively trapped in the Persian Gulf." Timeline entry "February 28–April 7, 2026". https://www.congress.gov/crs-product/R45281 |
| Ships held | "≈ 2,000 ships held inside the Gulf · ~20,000 seafarers on board" | UN News, *'No precedent' for seafarers caught in war zone* (Mar 2026): "The seafarers are working on some 2,000 ships…"; IMO: "more than 20,000 seafarers in the region, including those stranded on vessels unable to exit the Strait of Hormuz." https://news.un.org/en/story/2026/03/1167224 · https://www.imo.org/en/mediacentre/hottopics/pages/middle-east-strait-of-hormuz.aspx . The film draws exactly 2,000 circles (1 circle = 1 ship); their positions are an even lattice over Gulf waters, not vessel positions. |
| Oil price curve | Daily Brent spot, 1 Dec 2025 → 13 Mar 2026; "$71 → $103 in two weeks", "+45%" | U.S. EIA, *Europe Brent Spot Price FOB* (RBRTED), daily. 27 Feb 2026: $71.32; 13 Mar 2026: $103.23 (+44.7%). https://www.eia.gov/dnav/pet/hist/RBRTED.htm — raw values in `data/brent_eia.json`. The curve's pitch in the soundtrack also follows this data. |
| Status line | "As of 30 Sep 2026, passage through the strait remains restricted." | Reuters, *Oil prices slide about 2% as US, Iran explore path out of war* (25 Sep 2026) https://www.reuters.com/business/energy/oil-prices-fall-markets-look-iran-truce-remain-wary-attacks-oil-facilities-2026-09-25/ ; Anadolu Agency, *Iran says it seized US underwater drone in Strait of Hormuz* (27 Sep 2026) — IRGC declares the strait "closed to unauthorized access". https://www.aa.com.tr/en/middle-east/iran-says-it-seized-us-underwater-drone-in-strait-of-hormuz/4070817 |
| City distances | Rotterdam, Singapore, Shanghai, Tokyo (miles) | Computed, not sourced: great-circle distance from the strait (26.55°N, 56.35°E). The whole film uses an azimuthal-equidistant projection centred there, so each distance is the radius on the map. Rounded to the nearest 100 mi. |
| Ripple ring labels | Oil supply → energy prices → shipping → industry → global economy | Descriptive, not numeric. Supported by CRS R45281 (energy and commodity market effects) and IEA/EIA. The ring radii are a visual device and are not data. |

## Data and assets (not factual claims)

- Coastlines and borders: Natural Earth 1:10m / 1:50m (public domain). https://www.naturalearthdata.com
- Close-up coastline, terrain and bathymetry contours: AWS Terrain Tiles (Terrarium; SRTM, GEBCO, ETOPO1 and others). https://registry.opendata.aws/terrain-tiles/
- Shipping routes and particle traffic are **illustrative**, not AIS tracks. Port origins are real Gulf export terminals. Destination weights roughly follow IEA ("80% destined for Asia").
- Typefaces: Mona Sans and Geist Mono (SIL Open Font License, see `fonts/`).
- Soundtrack: fully synthesised in `audio/sound.py`, with no samples.

## Checked but not used on screen

- IEA record 400-million-barrel emergency stock release, 11 Mar 2026 (Reuters, 11 Mar 2026).
- Brent futures peak figures ($118–$126) reported in secondary sources. Not verified against a primary series, so left out.
