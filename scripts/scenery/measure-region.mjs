/* global window, document, requestAnimationFrame, performance, console, process, URL, fetch, Event */
// Run against the local Vite server. Outputs are kept in the ignored note/ folder.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { gzipSync } from 'node:zlib';

const regions = process.argv.slice(2);
if (
    !regions.length ||
    regions.some((r) => !['saint-cyr', 'luxeuil', 'tehran'].includes(r))
)
    throw new Error(
        'Usage: node scripts/scenery/measure-region.mjs tehran [luxeuil saint-cyr]'
    );
const output = 'note/region-measurements';
fs.mkdirSync(output, { recursive: true });
const origin = process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:5173';
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const reportPath = `${output}/results.json`;
const results = fs.existsSync(reportPath)
    ? JSON.parse(fs.readFileSync(reportPath, 'utf8')).filter(
          (r) => !regions.includes(r.region)
      )
    : [];
try {
    for (const region of regions) {
        for (const mobile of [false, true]) {
            const page = await browser.newPage({
                viewport: mobile
                    ? { width: 844, height: 390 }
                    : { width: 1280, height: 720 },
                deviceScaleFactor: mobile ? 2 : 1,
                isMobile: mobile,
                hasTouch: mobile
            });
            const errors = [];
            const external = [];
            page.on('pageerror', (error) => errors.push(error.message));
            page.on('console', (message) => {
                if (
                    message.type() === 'error' &&
                    /THREE|shader|WebGL/i.test(message.text())
                )
                    errors.push(message.text());
            });
            await page.route('**/*', async (route) => {
                const url = new URL(route.request().url());
                if (url.origin !== origin) {
                    external.push(url.href);
                    return route.abort();
                }
                if (url.pathname.endsWith('/__scenery-probe'))
                    return route.fulfill({
                        contentType: 'text/html',
                        body: '<html><body style="margin:0"><div id="canvas-container" style="width:100vw;height:100vh"></div><select id="graphics-quality" style="display:none"><option>low</option><option>balanced</option><option>high</option></select></body></html>'
                    });
                return route.continue();
            });
            await page.goto(`${origin}/3d-plane/__scenery-probe`);
            const session = await page.context().newCDPSession(page);
            await session.send('Performance.enable');
            const setup = await page.evaluate(async (region) => {
                const [
                    { createGeography },
                    { createTerrain },
                    { createGroundDetail },
                    { createScene },
                    { createGeographicCanvas },
                    { createParkedAircraft }
                ] = await Promise.all([
                    import('/3d-plane/src/scenery/geography.js'),
                    import('/3d-plane/src/scenery/terrain.js'),
                    import('/3d-plane/src/scenery/groundDetail.js'),
                    import('/3d-plane/src/rendering/scene.js'),
                    import('/3d-plane/src/map/cartography.js'),
                    import('/3d-plane/src/scenery/parkedAircraft.js')
                ]);
                const start = performance.now();
                const contents = await Promise.all(
                    ['map', 'elevation'].map(async (name) => {
                        const response = await fetch(
                            `/3d-plane/data/${region}/${name}.json`
                        );
                        if (!response.ok)
                            throw new Error(`Missing ${region}/${name}.json`);
                        return response.text();
                    })
                );
                const fetchMs = performance.now() - start;
                const parseStart = performance.now();
                const [data, dem] = contents.map((s) => JSON.parse(s));
                const parseMs = performance.now() - parseStart;
                data.airfield =
                    region === 'luxeuil'
                        ? 'LFSX'
                        : region === 'saint-cyr'
                          ? 'LFPZ'
                          : 'OIII';
                const buildStart = performance.now();
                const world = createGeography(
                    data,
                    dem,
                    region === 'tehran'
                        ? { icao: 'OIII', runwayRef: '11R/29L' }
                        : undefined
                );
                const { scene, camera, renderer, controls } = createScene({
                    container: document.getElementById('canvas-container')
                });
                const terrain = createTerrain(world);
                const { updateRegionDetail } =
                    await import('/3d-plane/src/scenery/regionDetail.js');
                const detail = createGroundDetail(world);
                const parked = createParkedAircraft(world);
                terrain.userData.summary.parkedAircraft = parked.spots.length;
                scene.add(terrain, detail.group, parked.group);
                const buildMs = performance.now() - buildStart;
                const firstRenderStart = performance.now();
                const startX =
                    region === 'tehran'
                        ? (51.31 - data.origin[1]) *
                          111320 *
                          Math.cos((data.origin[0] * Math.PI) / 180)
                        : world.spawn.x;
                const startZ =
                    region === 'tehran'
                        ? (data.origin[0] - 35.69) * 111320
                        : world.spawn.z;
                camera.position.set(
                    startX - 550,
                    world.height(startX, startZ) + 400,
                    startZ + 550
                );
                camera.lookAt(startX, world.height(startX, startZ), startZ);
                scene.userData.followSun(camera.position);
                renderer.render(scene, camera);
                // Complete the first GPU submission before recording initialization time.
                renderer.getContext().finish();
                const firstRenderMs = performance.now() - firstRenderStart;
                const loadToFirstFrameMs = performance.now() - start;
                const gl = renderer.getContext();
                const debug = gl.getExtension('WEBGL_debug_renderer_info');
                const gpu = debug
                    ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
                    : gl.getParameter(gl.RENDERER);
                const map = createGeographicCanvas(world, 1400, true);
                map.id = 'region-overview';
                map.style.cssText =
                    'position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;background:#222;display:none';
                document.body.append(map);
                const positions =
                    region === 'tehran'
                        ? [
                              {
                                  name: 'mehrabad',
                                  lat: 35.69,
                                  lon: 51.31,
                                  altitude: 400
                              },
                              {
                                  name: 'central-city',
                                  lat: 35.71,
                                  lon: 51.42,
                                  altitude: 700
                              },
                              {
                                  name: 'southeast',
                                  lat: 35.56,
                                  lon: 51.55,
                                  altitude: 500
                              },
                              {
                                  name: 'northern-slopes',
                                  lat: 35.8,
                                  lon: 51.45,
                                  altitude: 500
                              }
                          ].map((p) => ({
                              ...p,
                              x:
                                  (p.lon - data.origin[1]) *
                                  111320 *
                                  Math.cos((data.origin[0] * Math.PI) / 180),
                              z: (data.origin[0] - p.lat) * 111320
                          }))
                        : [
                              {
                                  name: 'airfield',
                                  x: world.spawn.x,
                                  z: world.spawn.z,
                                  altitude: 400
                              },
                              {
                                  name: 'town',
                                  x: data.places[0]?.point[0] || 0,
                                  z: data.places[0]?.point[1] || 0,
                                  altitude: 700
                              }
                          ];
                window.regionProbe = {
                    world,
                    scene,
                    camera,
                    renderer,
                    controls,
                    detail,
                    parked,
                    terrain,
                    updateRegionDetail,
                    positions
                };
                return {
                    fetchMs,
                    parseMs,
                    buildMs,
                    firstRenderMs,
                    loadToFirstFrameMs,
                    gpu,
                    widthKm: world.width / 1000,
                    depthKm: world.depth / 1000,
                    summary: terrain.userData.summary,
                    features: data.features.length,
                    places: data.places.length,
                    positions,
                    elevation: {
                        min: Math.min(...dem.values),
                        max: Math.max(...dem.values),
                        size: dem.size
                    }
                };
            }, region);
            const samples = [];
            for (const quality of ['low', 'balanced', 'high']) {
                for (let point = 0; point < setup.positions.length; point++) {
                    const sample = await page.evaluate(
                        async ({ quality, point }) => {
                            const {
                                world,
                                scene,
                                camera,
                                renderer,
                                detail,
                                parked,
                                positions
                            } = window.regionProbe;
                            const select =
                                document.getElementById('graphics-quality');
                            select.value = quality;
                            select.dispatchEvent(new Event('change'));
                            const p = positions[point];
                            const y = world.height(p.x, p.z);
                            camera.position.set(
                                p.x - 550,
                                y + p.altitude,
                                p.z + 550
                            );
                            camera.lookAt(
                                p.x + 600,
                                world.height(p.x + 600, p.z - 600),
                                p.z - 600
                            );
                            scene.userData.followSun(camera.position);
                            parked.update(camera.position, quality);
                            window.regionProbe.updateRegionDetail(
                                window.regionProbe.terrain,
                                camera.position,
                                quality
                            );
                            for (let i = 0; i < 120; i++)
                                detail.update(camera.position, quality, 0.1, 0);
                            const timings = [];
                            let previous;
                            for (let frame = 0; frame < 150; frame++) {
                                const now = await new Promise(
                                    requestAnimationFrame
                                );
                                detail.update(
                                    camera.position,
                                    quality,
                                    1 / 60,
                                    1 / 60
                                );
                                renderer.render(scene, camera);
                                if (frame >= 30) timings.push(now - previous);
                                previous = now;
                            }
                            timings.sort((a, b) => a - b);
                            const medianMs =
                                timings[Math.floor(timings.length / 2)];
                            return {
                                point: p.name,
                                quality,
                                medianMs,
                                p95Ms: timings[
                                    Math.floor(timings.length * 0.95)
                                ],
                                fps: 1000 / medianMs,
                                visibleBuildingBatches:
                                    window.regionProbe.terrain.children.filter(
                                        (child) =>
                                            child.name ===
                                                'Buildings · spatial batch' &&
                                            child.visible
                                    ).length,
                                calls: renderer.info.render.calls,
                                triangles: renderer.info.render.triangles,
                                geometries: renderer.info.memory.geometries,
                                textures: renderer.info.memory.textures,
                                detail: detail.stats()
                            };
                        },
                        { quality, point }
                    );
                    const metrics = await session.send(
                        'Performance.getMetrics'
                    );
                    sample.jsHeapMiB =
                        metrics.metrics.find((m) => m.name === 'JSHeapUsedSize')
                            .value / 1048576;
                    samples.push(sample);
                    await page.screenshot({
                        path: `${output}/${region}-${mobile ? 'mobile' : 'desktop'}-${quality}-${sample.point}.png`
                    });
                }
            }
            await page.locator('#region-overview').evaluate((el) => {
                el.style.display = 'block';
            });
            await page.screenshot({
                path: `${output}/${region}-${mobile ? 'mobile' : 'desktop'}-map.png`
            });
            if (errors.length || external.length)
                throw new Error(JSON.stringify({ errors, external }));
            const assets = Object.fromEntries(
                ['map', 'elevation'].map((name) => {
                    const bytes = fs.readFileSync(
                        `data/${region}/${name}.json`
                    );
                    return [
                        name,
                        {
                            bytes: bytes.length,
                            gzipBytes: gzipSync(bytes).length
                        }
                    ];
                })
            );
            const result = {
                region,
                mobile,
                ...setup,
                assets,
                samples,
                errors,
                external
            };
            results.push(result);
            fs.writeFileSync(
                `${output}/results.json`,
                JSON.stringify(results, null, 2)
            );
            console.log(
                JSON.stringify({
                    region,
                    mobile,
                    buildMs: setup.buildMs,
                    gpu: setup.gpu,
                    samples
                })
            );
            await page.close();
        }
    }
} finally {
    await browser.close();
}
