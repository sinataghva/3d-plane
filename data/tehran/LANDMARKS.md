# Tehran landmarks and distant scenery

These are original procedural, stylized game models, not surveyed replicas.
No third-party model, photograph or texture is bundled. The existing OpenStreetMap
ODbL credits continue to cover cached footprints and placement data.

## Landmark selection and placement

All eight landmark models lie within the current **35.53–35.85 N / 51.10–51.66 E**
region, approximately **50.6 × 35.6 km**. It includes the whole mapped Saadabad
estate and Darband / Sarband Square. The White Palace model represents only
one building within the estate.

| Landmark | Placement/reference | Treatment |
| --- | --- | --- |
| Azadi Tower | Approx. 35.69974 N, 51.33803 E | Four splayed piers with unequal crossing arches, marble courses and ribs on all sides, turquoise accents, upper windows; detailed square paths, paving and fountain basins follow cached geographic data |
| Milad Tower | Approx. 35.74484 N, 51.37530 E | Tapered shaft, observation head, horizontal rings and antenna |
| Golestan Palace | Cached way 312398800 | Main palace facade, window bays, tile-color bands and portico; surrounding cached buildings retained |
| Tabiat Bridge | Cached relation 6695059 | Stylized two-deck truss with branched supports and planted approaches joining the surrounding landscape |
| Saadabad | Cached way 375114161 | White Palace centerpiece; not a reconstruction of every building in the complex |
| Niavaran | Cached way 330356348 | Main palace with projecting roof, windows and portico |
| University of Tehran gate | Approx. 35.7012 N, 51.3958 E | Four mirrored concrete leaves forming two open-book pairs, front/rear arches, fence and planted entrance setting |
| Azadi Stadium | Cached relation 1640944 | Open oval seating bowl, marked pitch and light pylons |

Architectural references:

- [Azadi Tower, architectural description and dimensions](https://www.caoi.ir/en/projects/item/142-azadi-tower-shahyad-tower-hossein-amanat): reference for its 45 m height, 63 m span and elliptical plaza. The procedural marble joints and garden geometry are interpretations, not copied survey drawings.
- [Hossein Amanat interview hosted by his practice](https://amanatarchitect.com/wp-content/uploads/2024/05/Bidoun-Interview-2013-1.pdf): reference context for the tapered form and ribbed arch.
- [Milad Tower engineering project, NCK](https://nck.ca/en/projects/milad-tower/): 435 m overall-height reference.
- [Tabiat Bridge, Diba Tensile Architecture project description](https://www.archdaily.com/566387/tabiat-pedestrian-bridge-diba-tensile-architecture): structural/deck reference. The model follows the cached footprint center but simplifies its curves and circulation.
- [University gate architectural reference](https://www.caoi.ir/index.php/en/projects/item/210-main-entrance-gate-of-tehran-university) and [geotagged reference view](https://commons.wikimedia.org/wiki/File:Tehran_University_Main_Gate_,2007_Winter_-_panoramio.jpg): approximate placement and silhouette; no image was copied into the game.

Landmarks are batched into one colored mesh each, plus two planted approach meshes at Tabiat. Azadi Square adds four batched
surface meshes and one bounded instanced shrub batch.
They retain frustum culling and scene fog; small facade parts do not create
individual draw calls. Selected cached building extrusions are replaced rather
than drawn twice. Collision envelopes are simplified but leave Azadi's central
arch, bridge clearance and stadium interior open. Tower collision height is not
limited by the generic building-height cap. The full map and radar show gold landmark markers;
the full map labels all eight with decluttering, while radar labels nearby ones.

The scenario-selection artwork is captured from the actual F-4/Azadi flyover
scene (`?mission=tehran&visual=card`). Dedicated landmark and horizon fixtures
remain available for repeatable visual checks.

Azadi's broad elevations face east/west along the main approach, with a smaller
north/south arch crossing the main passage. Four tapered corner piers and
intersecting vault surfaces form the openings. The 63 m long footprint dimension
is north/south; the short east/west dimension is 24 m in this stylized model.
The pointed main entrance rises to 31.5 m and blends into a rounded 23.5 m
vault at mid-depth; the secondary arch rises to 13 m. These are game
approximations, not surveyed dimensions. `azadiTower.js` shares the curved shell
profiles with collision. A raised diamond lattice and original geometric
mosaic details line the vault. Thin turquoise bands, staggered marble seams,
pointed crown windows, a four-sided indented crown with re-entrant corners,
a matching roof terrace/parapet and a shallow blue skylight on an octagonal curb
are merged into the tower’s single vertex-colored mesh, with no image textures.
The paved center accommodates the footprint.
`azadi-view=east|west|north|south` on the `azadi-detail` fixture provides
repeatable compass views; ray tests verify that both passages remain clear.
The separate stylized Azadi garden overlay has been removed. The square's
landscaping follows the cached perimeter footway and interlocking path network.
A terrain-conforming lawn surface, crisp two-metre mapped walks and a scalloped
paved central apron replace the blurred ground treatment within that boundary.
The paved approaches follow paired cached walks; short joins connect them to the
central apron. Sixteen mapped fountain parts have horizontal water surfaces,
stone coping and skirts meeting the sloped ground. At most 24 decorative low
shrubs sit near the perimeter, clear of mapped footpaths. This is a bounded
interpretation of surface materials, not a survey of individual plants or curb
heights. Surrounding road geometry and collision terrain remain unchanged.
`azadi-view=surfaces` provides an overhead square/road-junction inspection view.

The university gate has four separate thin, warped concrete pages forming two
mirrored open-book pairs, with quarter-elliptical transitions into solid front
piers, high free edges, slender rear supports and a simple iron fence. The
paired leaves remain separated. Each page has an opposing rear arch descending
to a short rear pier. `gate-view=rear` on the university visual fixture exposes
that saddle shape for regression screenshots.

The university entrance includes bounded decorative broadleaf planting
(at most 36 trees, two instanced batches), planted beds and a central approach
path behind the gate. Tree placement avoids mapped buildings; the garden layout
is stylized rather than a surveyed reconstruction. Enghelab's divided alignment
and central bus corridor come from the existing source cache, not new downloads.
Enghelab receives denser car seeds and up to 40% of the existing local spawn
budget; active traffic limits, visibility filtering and one-way handling remain
in place. France retains its original spacing. Landmark screenshot fixtures
load road detail around their camera, instead of around the remote aircraft.
Use `gate-view=street` for the avenue/context view.
The photographs themselves are not bundled.
Tabiat has planted approach banks and pedestrian paths joining both upper
deck ends to the surrounding ground. These are stylized landscape connections,
not surveyed park circulation. Approach collision uses the same surface profile
as the meshes (treated as obstacles, not a landable runway); the central highway
clearance remains open.

## Alborz / Damavand horizon

A single low-poly mesh extends the northern/northeastern silhouette outside the
playable map. It uses approximate ridges and a snow-topped Damavand cone placed
on the [Smithsonian GVP reference bearing](https://volcano.si.edu/volcano.cfm?vnum=0302-01-)
(35.951 N, 52.109 E). Nearby ridge shapes and snow lines are artistic approximations,
not newly acquired DEM data. Heights are relative to the Mehrabad datum.
Tehran's camera far plane permits viewing this distant mesh; ordinary terrain
fog and the configured building-distance budgets also apply. Lighting follows
the existing day/sunset/night settings. The distant scenery has no collision,
navigation coverage or new airport, and does not enlarge the selectable map.

## Traffic and birds

Tehran retains Low = no traffic and raises Balanced/High populations to 120/240
nearby active cars. Cars outside the camera view are not submitted for drawing,
but retain their simulation identity. A single instanced mesh draws the visible
cars; distance fades and the retention band avoid boundary replacement. France's
population settings and road eligibility are unchanged.

Tehran additionally uses mapped surface motorways, trunks and connecting ramps.
One-way and roundabout tags were restored from the preserved source cache; a car
reaching the end of a one-way extract retires instead of turning into oncoming
traffic. Bridges and tunnels remain excluded because their height is not modeled
reliably. Traffic is decorative: no congestion solver, signals or vehicle collision.

Birds are not enabled in gameplay.

## Validation and performance

The complete-game traffic probe ran on an Apple M4 Pro using Metal-backed
Chromium at desktop 1280 × 720 and mobile-sized 844 × 390, both at DPR 2.
Balanced/High with 120/240 active cars retained an 8.3 ms median frame interval
(display-limited); sampled p95 intervals were approximately 8.5–10 ms.
Traffic updates averaged about 0.05–0.11 ms per frame and added one draw call.
Only roughly 28–60 cars were in view in the sampled highway scene: population
limits are not promises that every car is visible. These are host-GPU results,
not measurements of a phone or native iOS Safari.

Validation covers day/night horizon and individual landmark views, desktop/mobile-sized
flight lifecycle checks, traffic regressions, menu artwork, and landmark collision
openings. Lint, type checking and the production build are checked locally.
See [current map and ground rendering](MAP-DETAIL.md) for zoom levels, low-altitude
texture detail, data limits and measurements. Native-phone performance remains
unverified.

Azadi’s four outer garden islands use their cached closed footway contours and internal paths, with the same lawn and paving materials as the central island. Both traffic rings and radial roads remain outside these surfaces. The outer detail shares the existing surface batches.

Twelve Lion and Sun flags are distributed across the four outer gardens, three per island. The poles are 36 m tall and the cloth is 24 × 14.4 m, using the supplied flag artwork. Static folds, shared cloth geometry and instanced poles keep the additional rendering cost bounded.
