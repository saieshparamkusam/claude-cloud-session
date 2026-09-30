# HORMUZ — source list

Every number and quotation that appears on screen is listed here with its source. Research was done on 30 Sep 2026.

| On screen | Value used | Source |
|---|---|---|
| Narrowest point | "39 KM" (21 nautical miles / 39 km) | IEA, *Strait of Hormuz* (oil security page, updated Feb 2026): "At its narrowest point, the Strait is only 21 nautical miles wide (39 km)". https://www.iea.org/about/oil-security-and-emergency-response/strait-of-hormuz. I also measured it from the elevation data: 38.4 km between Larak Island and Great Quoin Island, which is where the gauge is drawn. |
| Two-lane shipping scheme | Inbound and outbound lanes 2 miles wide, with a 2-mile buffer between them (drawn to scale) | IEA, same page. IMO: the Traffic Separation Scheme adopted in 1968 "remains the only recognized route through the Strait" (IMO briefing, 24 Apr 2026). |
| "20 MILLION BARRELS OF OIL, EVERY DAY" | ~20 mb/d, 2025 average (IEA table total: 19.87 mb/d) | IEA, same page: "an average of 20 million barrels per day (mb/d) of crude oil and oil products were shipped in 2025". EIA gives 20.9 mb/d for 1H 2025 and 20.7 mb/d for 2024. |
| "20% OF GLOBAL OIL CONSUMPTION" | ~20% of global petroleum liquids consumption | U.S. EIA, *Amid regional conflict, the Strait of Hormuz remains critical oil chokepoint* (Today in Energy, June 2025): flows "represent about 20% of global petroleum liquids consumption". https://www.eia.gov/todayinenergy/ |
| "+ ≈20% OF GLOBAL LNG TRADE" | ~19–20% of global LNG trade, 2025 | IEA, same page: the LNG volume through the Strait "equat[ed] to almost 20% of global LNG trade" in 2025 (also given as 19%). |
| Flow densities by origin | Relative ship counts per terminal are weighted by 2025 export volumes by country (Saudi Arabia 6.23, Iraq 3.63, UAE 3.24, Iran 2.41, Kuwait 2.37, Qatar 1.43 mb/d) | IEA table "Total Hormuz" (IEA analysis based on Kpler). |
| Destination split | About 76% of drawn flows go toward Asia or India | IEA: "20 mb/d … 80% destined for Asia". |
| Quote | "The largest supply disruption in the history of the global oil market." | IEA *Oil Market Report*, March 2026, as quoted by CNN Business, 12 Mar 2026: https://www.cnn.com/2026/03/12/energy/oil-jump-record-reserves-release-intl-hnk |
| "≈1,600 VESSELS · ≈20,000 SEAFARERS" | "Around 20,000 seafarers on around 1,600 vessels remain in the Gulf" | IMO Secretary-General briefing, 24 April 2026: https://www.imo.org/en/mediacentre/pressbriefings/pages/no-safe-transit-through-hormuz-imo-secretary-general.aspx. The wall is exactly 80 × 20 = 1,600 marks. |
| Brent price curve | Daily Brent spot price, 2 Jan to 22 Sep 2026 (183 observations), plotted as published. Labels: Feb 27 $71.32, Apr 7 $138.21, Sep 22 $114.89 | U.S. EIA, series RBRTE, retrieved via FRED (DCOILBRENTEU): https://fred.stlouisfed.org/series/DCOILBRENTEU. The raw values are in `data/brent.csv`. |
| City distances (Mumbai 1,168 mi, Rotterdam 3,192, Singapore 3,593, Shanghai 3,891, Seoul 4,105, Tokyo 4,819) | Great-circle distances from the Strait (56.43°E, 26.6°N) | Computed with the haversine formula (R = 6,371 km) in `main.js`. |
| Ripple rings | 1,000 / 2,000 / 3,000 / 4,000 / 5,000 miles | True geodesic circles centred on the Strait. They look like squircles because of the map projection. |
| Coordinates | 26°34′N 56°15′E | Standard reference coordinates for the Strait of Hormuz. |

## Geography and elevation
- Terrain and bathymetry come from the Mapzen/Tilezen **Terrarium** elevation tiles on AWS Open Data (`s3://elevation-tiles-prod`), which draw on SRTM, GMTED, ETOPO1 and other sources. I used three resolutions: world (zoom 4), region (zoom 7) and strait (zoom 10).
- The shipping lanes follow the approximate centreline of the IMO Traffic Separation Scheme. Terminal locations (Basra, Mina al-Ahmadi, Kharg, Ras Tanura, Ras Laffan, Ruwais, Jebel Ali) are approximate public coordinates. The lanes are stylised, not AIS tracks.

## Context (research only; kept off screen to stay neutral)
- Late Feb 2026: U.S.–Israeli strikes on Iran start the conflict (IMO: conflict began "with the US-Israeli bombing of Iran in late February").
- 2 Mar 2026: Iran's IRGC says the strait is closed to "unfriendly" shipping. Iran later said the strait was open to vessels not linked to the U.S. or Israel. These are claims by a government actor.
- 13 Apr 2026: the U.S. announces a naval blockade of Iranian ports. This is a U.S. government action; its effects are reported differently by the parties.
- Late Sep 2026: reports on current traffic disagree. Washington Times/Kpler (29 Sep) say traffic is near pre-war levels at about 10 mb/d; other trackers say the strait is still effectively closed. Because the sources conflict, the film makes **no claim about current status**.
