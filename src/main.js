import { createRoadTraffic } from './scenery/roadTraffic.js';
import { createPhotoMode } from './ui/photoMode.js';
import { createRunwayLights } from './rendering/timeOfDay.js';
import { createFpsCounter } from './ui/fps.js';
import { createServiceVehicles } from './scenery/serviceVehicles.js';
import { createParkedAircraft } from './scenery/parkedAircraft.js';
import {
    createMachEffect,
    createMachTransition
} from './effects/machTransition.js';
import { getVerticalSpeed } from './flight/flightMetrics.js';
import { createFlightAudio } from './audio/audio.js';
import { setupMobileViewport } from './ui/mobileViewport.js';
import { createGroundDetail } from './scenery/groundDetail.js';
import {
    createDestinationBeacon,
    clearDestination
} from './map/destination.js';
import { selectFlight } from './ui/missions.js';
import { createMirage, updateMirage } from './aircraft/mirage.js';
import { createJetControls } from './flight/jetControls.js';
import { createGeography, setGeography } from './scenery/geography.js';
import { createTerrain } from './scenery/terrain.js';
import { createWorldMap } from './map/worldMap.js';
import { createExperience, describeTouchdown } from './ui/experience.js';
import './ui/styles.css';
import { createSimulationClock } from './flight/simulationClock.js';
import {
    createFlightAutomation,
    registerFlightTools
} from './automation/automation.js';

import * as THREE from 'three';

import {
    createAirplane,
    updateAirplaneCockpitVisibility,
    updateAirplaneControlSurfaces
} from './aircraft/airplane.js';
import { addClouds } from './effects/clouds.js';
import { createCameraModeToggle, updateCamera } from './rendering/camera.js';
import { createCockpitOverlay } from './ui/cockpitOverlay.js';
import { createHud } from './ui/hud.js';
import { createKeyboardState } from './flight/input.js';
import { createMachineGun } from './effects/machineGun.js';
import { createMiniMap } from './map/minimap.js';
import {
    createPlanePhysics,
    createPlaneState,
    resetPlaneState,
    syncPlaneMesh,
    updatePlanePhysics
} from './flight/physics.js';
import {
    isWebGLAvailable,
    showRuntimeFallback
} from './rendering/runtimeFallback.js';
import { createScene } from './rendering/scene.js';
import {
    applyVisualScenario,
    getVisualScenario,
    useSeededRandom
} from './automation/visualScenarios.js';
import { createWarningBanner } from './ui/warnings.js';

setupMobileViewport();

/**
 * @param {unknown} error
 */
function reportRuntimeError(error) {
    console.error(error);
    showRuntimeFallback('The 3D scene could not be started.');
}

window.addEventListener('error', (event) => {
    reportRuntimeError(event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
    reportRuntimeError(event.reason);
});

const CRASH_RESTART_DELAY = 2.2;

/**
 * @param {THREE.Scene} scene
 */
function createCrashEffect(scene) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    const shockwaveGeometry = new THREE.RingGeometry(0.5, 0.58, 40);
    const shockwaveMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
    });
    const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
    shockwave.rotation.x = -Math.PI / 2;
    group.add(shockwave);

    const particleGeometry = new THREE.SphereGeometry(0.16, 10, 8);
    /** @type {THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[]} */
    const particles = [];
    const directions = [
        new THREE.Vector3(1, 0.35, 0),
        new THREE.Vector3(-1, 0.28, 0.15),
        new THREE.Vector3(0.5, 0.5, 0.75),
        new THREE.Vector3(0.2, 0.38, -0.95),
        new THREE.Vector3(-0.6, 0.45, -0.65),
        new THREE.Vector3(0.85, 0.25, -0.45),
        new THREE.Vector3(-0.25, 0.6, 0.9),
        new THREE.Vector3(0.05, 0.85, -0.1)
    ];

    for (const direction of directions) {
        const material = new THREE.MeshBasicMaterial({
            color: direction.y > 0.5 ? 0xfff3a1 : 0xff7a24,
            transparent: true,
            opacity: 0
        });
        const particle = new THREE.Mesh(particleGeometry, material);
        particle.userData.direction = direction.normalize();
        group.add(particle);
        particles.push(particle);
    }

    return {
        /**
         * @param {THREE.Vector3} position
         */
        trigger(position) {
            group.position.copy(position);
            group.position.y = position.y;
            group.visible = true;
            shockwave.scale.setScalar(0.4);
            shockwaveMaterial.opacity = 0.85;

            for (const particle of particles) {
                particle.position.set(0, 0.22, 0);
                particle.scale.setScalar(1);
                particle.material.opacity = 0.95;
            }
        },

        /**
         * @param {number} elapsed
         */
        update(elapsed) {
            if (!group.visible) return;

            const progress = Math.min(elapsed / CRASH_RESTART_DELAY, 1);
            shockwave.scale.setScalar(0.4 + progress * 6);
            shockwaveMaterial.opacity = Math.max(0, 0.85 * (1 - progress));

            for (const particle of particles) {
                /** @type {THREE.Vector3} */
                const direction = particle.userData.direction;
                particle.position
                    .copy(direction)
                    .multiplyScalar(progress * 3.8);
                particle.position.y +=
                    0.22 + Math.sin(progress * Math.PI) * 0.9;
                particle.scale.setScalar(Math.max(0.12, 1 - progress * 0.78));
                particle.material.opacity = Math.max(0, 0.95 * (1 - progress));
            }
        },

        hide() {
            group.visible = false;
        }
    };
}

async function startApp() {
    if (!isWebGLAvailable()) {
        showRuntimeFallback('WebGL is not available in this browser.');
        return;
    }

    const container = document.getElementById('canvas-container');
    if (!(container instanceof HTMLElement)) {
        throw new Error('Missing #canvas-container element');
    }
    const crashOverlay = document.getElementById('crash-overlay');
    if (!(crashOverlay instanceof HTMLElement)) {
        throw new Error('Missing #crash-overlay element');
    }
    const crashOverlayElement = crashOverlay;

    const flightAudio = createFlightAudio();
    const mission = await selectFlight();
    document.title = `${mission.title} · Open Skies`;
    if (mission.aircraft === 'mirage') {
        const list = document.querySelector('#instructions-panel ul');
        list?.querySelectorAll('li').forEach((item) => {
            if (item.textContent?.includes('Fire tracers')) item.hidden = true;
        });
        const help = document.createElement('li');
        help.textContent =
            'Mirage: hold W at full thrust for 110% afterburner; release to return to 100%. G: landing gear. Hold S at zero thrust: airbrakes. Space: cannon. P: settings. Mobile: full slider + hold Boost.';
        list?.append(help);
    }
    const loading = document.getElementById('scenery-loading');
    if (loading) loading.textContent = `Loading ${mission.title}…`;
    const mapCaption = document.querySelector('#world-map p');
    if (mapCaption)
        mapCaption.textContent = `${mission.title} · north up · live position`;
    const dataLink = document.querySelector('#world-map a[download]');
    if (dataLink)
        dataLink.setAttribute(
            'href',
            `${import.meta.env.BASE_URL}data/${mission.map}`
        );
    let closed = false;
    let disposeFlight = () => {};
    const menu = document.createElement('button');
    menu.id = 'missions-button';
    menu.textContent = 'Change flight';
    menu.onclick = () => {
        closed = true;
        disposeFlight();
        window.dispatchEvent(new Event('flight-input-clear'));
        location.assign(import.meta.env.BASE_URL);
    };
    document.querySelector('.flight-toolbar')?.append(menu);
    if (!menu.isConnected) document.body.append(menu);
    const visualScenario = getVisualScenario();
    if (visualScenario) {
        document.documentElement.classList.add('visual-test-mode');
    }

    const loadData = async (/** @type {string} */ name) => {
        const response = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
        if (!response.ok) throw new Error(`Unable to load scenery: ${name}`);
        return response.json();
    };
    const [geoData, elevationData] = await Promise.all([
        loadData(mission.map),
        loadData(mission.elevation)
    ]);
    if (closed) return;
    geoData.airfield = mission.airfield;
    const world = createGeography(geoData, elevationData);
    setGeography(world);
    const { scene, camera, renderer, controls } = createScene({ container });

    const { airplane, propeller } =
        mission.aircraft === 'mirage' ? createMirage() : createAirplane();
    const planeState = createPlaneState(mission.aircraft);
    planeState.mission = mission.id;
    syncPlaneMesh({ airplane, propeller, planeState });
    scene.add(airplane);

    const restoreRandom = visualScenario ? useSeededRandom(12345) : null;
    const airbase = createTerrain(world);
    scene.add(airbase);
    const parkedAircraft = createParkedAircraft(world);
    scene.add(parkedAircraft.group);
    airbase.userData.summary.parkedAircraft = parkedAircraft.spots.length;
    const serviceVehicles = createServiceVehicles(world, parkedAircraft.spots);
    scene.add(serviceVehicles.group);
    airbase.userData.summary.serviceVehicles = serviceVehicles.spots.length;
    const roadTraffic = createRoadTraffic(world);
    scene.add(roadTraffic.mesh);
    const groundDetail = createGroundDetail(world);
    scene.add(groundDetail.group);

    const clouds = addClouds(scene);
    scene.add(createRunwayLights(world));
    scene.userData.setTimeOfDay(scene.userData.timeOfDay);
    if (restoreRandom) {
        restoreRandom();
    }
    const crashEffect = createCrashEffect(scene);
    const machineGun = createMachineGun(scene);
    const machTransition = createMachTransition();
    let machBoomPending = false;
    const machEffect =
        mission.aircraft === 'mirage' ? createMachEffect(airplane) : null;

    const keyboard = createKeyboardState(mission.aircraft);
    const planePhysics = createPlanePhysics();
    const cameraMode = createCameraModeToggle();
    const hud = createHud();
    const cockpitOverlay = createCockpitOverlay();
    const destinationBeacon = createDestinationBeacon(scene);
    const miniMap = createMiniMap();
    const worldMap = createWorldMap(planeState);
    const warningBanner = createWarningBanner();
    const simulationClock = createSimulationClock();
    document.addEventListener('visibilitychange', () =>
        simulationClock.reset()
    );
    const timer = new THREE.Timer();
    timer.connect(document);
    disposeFlight = () => {
        photoMode.dispose();
        flightAudio.dispose();
        machEffect?.dispose();
        roadTraffic.dispose();
        groundDetail.dispose();
        destinationBeacon.dispose();
        machineGun.dispose();
        controls.dispose();
        timer.dispose();
        const geometries = new Set();
        const materials = new Set();
        const textures = new Set();
        scene.traverse((object) => {
            if (
                !(
                    object instanceof THREE.Mesh ||
                    object instanceof THREE.Sprite ||
                    object instanceof THREE.Points
                )
            )
                return;
            if (object instanceof THREE.Mesh || object instanceof THREE.Points)
                geometries.add(object.geometry);
            for (const material of Array.isArray(object.material)
                ? object.material
                : [object.material]) {
                materials.add(material);
                for (const value of Object.values(material))
                    if (value instanceof THREE.Texture) textures.add(value);
            }
        });
        if (scene.background instanceof THREE.Texture)
            textures.add(scene.background);
        for (const texture of textures) texture.dispose();
        for (const material of materials) material.dispose();
        for (const geometry of geometries) geometry.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
    };
    let crashElapsed = 0;
    let wasCrashed = false;

    const resetFlight = () => {
        clearDestination();
        worldMap.resetView();
        roadTraffic.reset();
        groundDetail.waterEffects.reset();
        machTransition.reset();
        machBoomPending = false;
        machEffect?.reset();
        flightAudio.reset();
        window.dispatchEvent(new Event('flight-input-clear'));
        resetPlaneState(planeState);
        crashElapsed = 0;
        wasCrashed = false;
        crashOverlayElement.hidden = true;
        crashEffect.hide();
        machineGun.clear();
        simulationClock.reset();
    };
    const experience = createExperience({
        planeState,
        cameraMode,
        onRestart: resetFlight,
        onTakeControl: () => {
            if (automation?.active) automation.release();
        }
    });

    const photoMode = createPhotoMode({
        camera,
        controls,
        airplane,
        canvas: renderer.domElement,
        onPause: (active) => experience.setPhotoPaused(active)
    });
    flightAudio.mount();

    const jetControls = createJetControls(planeState, () => {
        if (automation?.active) automation.release();
    });
    if (visualScenario) {
        applyVisualScenario({
            planeState,
            cameraMode,
            visualScenario
        });

        if (
            ['parking-detail', 'service-detail'].includes(
                visualScenario.name
            ) &&
            (visualScenario.name === 'service-detail'
                ? serviceVehicles
                : parkedAircraft
            ).spots.length
        ) {
            const p = (
                visualScenario.name === 'service-detail'
                    ? serviceVehicles
                    : parkedAircraft
            ).spots[0];
            planeState.position = {
                x: p.x,
                y: world.height(p.x, p.z) + 8,
                z: p.z
            };
        }

        if (visualScenario.name === 'traffic-detail') {
            const p = roadTraffic.preview();
            if (p) {
                roadTraffic.update(
                    { x: p.x, y: 0, z: p.z },
                    scene.userData.quality,
                    0
                );
                const matrix = new THREE.Matrix4();
                roadTraffic.mesh.getMatrixAt(0, matrix);
                const car = new THREE.Vector3().setFromMatrixPosition(matrix);
                planeState.position = { x: car.x, z: car.z, y: car.y + 8 };
            }
        }
        // Static screenshot scenes need fully built and faded-in detail tiles.
        for (let step = 0; step < 120; step++) {
            groundDetail.update(
                planeState.position,
                scene.userData.quality,
                0.1
            );
        }

        if (visualScenario.cameraPosition) {
            camera.position.set(
                planeState.position.x - 18,
                planeState.position.y + 8,
                planeState.position.z + 10
            );
        }

        if (visualScenario.showCrash) {
            crashOverlayElement.hidden = false;
            crashEffect.trigger(airplane.position);
            crashEffect.update(CRASH_RESTART_DELAY * 0.32);
        }

        updateAirplaneControlSurfaces({
            airplane,
            keyboard,
            planeState,
            delta: 1 / 60
        });
        syncPlaneMesh({ airplane, propeller, planeState });
        updateAirplaneCockpitVisibility({
            airplane,
            propeller,
            isCockpit: cameraMode.getMode() === 'cockpit'
        });
        updateCamera({ camera, controls, airplane, cameraMode });
        updateMirage(airplane, planeState, keyboard, 0);
        if (visualScenario.name === 'mach') {
            machEffect?.trigger();
            machEffect?.advance(0.2);
            machEffect?.render(false, false);
            airplane.updateMatrixWorld(true);
            camera.position.copy(
                airplane.localToWorld(new THREE.Vector3(-15, 7, 16))
            );
            camera.lookAt(airplane.localToWorld(new THREE.Vector3(-1, 0.8, 0)));
        }
        if (visualScenario.name === 'exhaust') {
            airplane.updateMatrixWorld(true);
            camera.position.copy(
                airplane.localToWorld(new THREE.Vector3(-14, 3, 3))
            );
            camera.lookAt(
                airplane.localToWorld(new THREE.Vector3(-5, 0.85, 0))
            );
        }
        if (visualScenario.name.endsWith('-detail')) {
            camera.position
                .copy(airplane.position)
                .add(
                    ['airfield-detail', 'shelter-detail'].includes(
                        visualScenario.name
                    )
                        ? new THREE.Vector3(65, 45, 65)
                        : ['service-detail', 'traffic-detail'].includes(
                                visualScenario.name
                            )
                          ? new THREE.Vector3(10, 8, 12)
                          : visualScenario.name === 'road-detail'
                            ? new THREE.Vector3(70, 95, 70)
                            : new THREE.Vector3(30, 35, 35)
                );
            camera.lookAt(
                airplane.position.x,
                airplane.position.y - 8,
                airplane.position.z
            );
            airplane.visible = false;
        }
        if (visualScenario.name === 'card') {
            camera.position
                .copy(airplane.position)
                .add(
                    new THREE.Vector3(
                        mission.aircraft === 'mirage' ? 16 : 9,
                        mission.aircraft === 'mirage' ? 10 : 9,
                        mission.aircraft === 'mirage' ? 12 : 13
                    )
                );
            camera.lookAt(airplane.position);
        }
        experience.update();
        hud.update({ planeState, cameraMode });
        cockpitOverlay.update({ planeState, cameraMode });
        miniMap.update({ planeState });
        warningBanner.update({
            planeState,
            cameraMode,
            stallSpeed: planePhysics.stallSpeed,
            delta: 1 / 60
        });

        clouds.update(
            visualScenario || experience.paused ? 0 : timer.getDelta(),
            camera.position
        );
        groundDetail.update(
            planeState.position,
            scene.userData.quality,
            Math.min(timer.getDelta(), 0.1),
            visualScenario || experience.paused || document.hidden
                ? 0
                : Math.min(timer.getDelta(), 0.1)
        );
        destinationBeacon.update(camera, planeState.position);
        const beacon = scene.getObjectByName('destination-beacon');
        if (photoMode.active && beacon) beacon.visible = false;
        scene.userData.followSun(airplane.position);
        parkedAircraft.update(camera.position, scene.userData.quality);
        serviceVehicles.update(camera.position, scene.userData.quality);
        renderer.render(scene, camera);
        document.getElementById('scenery-loading')?.remove();
        if (import.meta.env.DEV)
            document.documentElement.dataset.sceneryStats = JSON.stringify({
                calls: renderer.info.render.calls,
                triangles: renderer.info.render.triangles,
                ...roadTraffic.stats(),
                ...groundDetail.stats(),
                ...airbase.userData.summary
            });
        document.documentElement.dataset.visualReady = 'true';
        return;
    }

    /**
     * @param {number} delta
     * @param {import('./flight/input.js').KeyboardState} keyboard
     */
    function simulate(delta, keyboard) {
        const before = planeState.isAirborne
            ? { ...planeState, position: { ...planeState.position } }
            : null;
        updatePlanePhysics({ planeState, keyboard, planePhysics, delta });
        machEffect?.advance(delta);
        if (machTransition.update(planeState, delta)) {
            machEffect?.trigger();
            machBoomPending = true;
        }
        if (before) {
            experience.afterStep(before);
            if (!planeState.isAirborne && !planeState.isCrashed)
                flightAudio.touchdown(getVerticalSpeed(before) * 60);
        }

        if (planeState.isCrashed) {
            if (!wasCrashed) {
                crashElapsed = 0;
                wasCrashed = true;
                crashOverlayElement.hidden = false;
                const reason = document.getElementById('crash-reason');
                if (reason)
                    reason.textContent = describeTouchdown(
                        before || planeState,
                        planeState
                    );
                crashEffect.trigger(airplane.position);
            }

            crashElapsed += delta;
            crashEffect.update(crashElapsed);
        }

        updateAirplaneControlSurfaces({
            airplane,
            keyboard,
            planeState,
            delta
        });
        machineGun.update({ planeState, keyboard, delta });
        updateMirage(airplane, planeState, keyboard, performance.now() / 1000);
        warningBanner.update({
            planeState,
            cameraMode,
            stallSpeed: planePhysics.stallSpeed,
            delta
        });
    }

    // Tool commands and fixed physics steps request a frame; only RAF draws it.
    const fpsCounter = createFpsCounter();
    window.addEventListener('pagehide', () => fpsCounter.dispose(), {
        once: true
    });
    let lastHudUpdate = -Infinity;
    let lastRadarUpdate = -Infinity;
    let lastCameraMode = '';
    let statsAt = 0,
        frames = 0;
    const render = () => {
        // RAF consumes the latest state; do not submit duplicate frames here.
    };
    const automation =
        new URLSearchParams(location.search).get('automation') === '1'
            ? createFlightAutomation({
                  planeState,
                  advance: simulate,
                  render,
                  reset() {
                      resetFlight();
                      experience.reset();
                  }
              })
            : null;
    if (automation) {
        Object.assign(window, { planeAutomation: automation });
        const status = document.createElement('div');
        status.className = 'automation-status';
        const statusText = document.createTextNode(
            'Agent control • connecting browser tools'
        );
        status.append(statusText);
        const release = document.createElement('button');
        release.textContent = 'Take control';
        release.onclick = () => automation.release();
        status.append(release);
        container.append(status);
        registerFlightTools(automation)
            .then((available) => {
                statusText.textContent = available
                    ? 'Agent control • browser tools ready '
                    : 'Agent control • JavaScript API ready (WebMCP unavailable) ';
            })
            .catch((error) => {
                console.warn('Flight tools unavailable:', error);
                statusText.textContent =
                    'Agent control • JavaScript API ready (tool registration failed) ';
            });
    }
    const cancelMachineBoost = () => {
        if (automation?.active) automation.pause();
    };
    window.addEventListener('blur', cancelMachineBoost);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) cancelMachineBoost();
    });
    window.addEventListener('keydown', (event) => {
        if (
            automation?.active &&
            [
                ' ',
                'w',
                's',
                'a',
                'd',
                'arrowup',
                'arrowdown',
                'arrowleft',
                'arrowright'
            ].includes(event.key.toLowerCase())
        )
            automation.release();
    });
    document
        .getElementById('touch-controls')
        ?.addEventListener('pointerdown', () => {
            if (automation?.active) automation.release();
        });
    /** @type {{position:()=>void,sample:(timestamp:number,trafficMs:number)=>void}|null} */
    let trafficBench = null;
    if (
        import.meta.env.DEV &&
        new URLSearchParams(location.search).has('trafficBenchmark')
    ) {
        const route = [...roadTraffic.paths]
            .sort((a, b) => b.length - a.length)
            .at(0);
        Object.assign(window, {
            trafficBenchmark: {
                renderer: renderer
                    .getContext()
                    .getParameter(renderer.getContext().RENDERER),
                run(/** @type {number} */ count, frames = 90, travel = 0) {
                    if (!route) throw new Error('No traffic benchmark road');
                    return new Promise((resolve) => {
                        roadTraffic.setLimit(count);
                        roadTraffic.reset();
                        let frame = 0,
                            previous = 0;
                        /** @type {object[]} */
                        const samples = [];
                        trafficBench = {
                            position() {
                                const town = world.data.places.find((p) =>
                                    p.name.includes(
                                        mission.id === 'luxeuil'
                                            ? 'Luxeuil-les-Bains'
                                            : 'Saint-Cyr'
                                    )
                                );
                                const origin =
                                    town?.point ||
                                    route.points[
                                        Math.floor(route.points.length / 2)
                                    ];
                                const p = [
                                    origin[0] + frame * travel,
                                    origin[1]
                                ];
                                const angle = frame * 0.001;
                                planeState.position.x =
                                    p[0] + Math.sin(angle) * 200;
                                planeState.position.z =
                                    p[1] + Math.cos(angle) * 200;
                                planeState.position.y =
                                    world.height(p[0], p[1]) + 75;
                                camera.position.set(
                                    p[0] + Math.sin(angle) * 220,
                                    planeState.position.y + 30,
                                    p[1] + Math.cos(angle) * 220
                                );
                                camera.lookAt(
                                    p[0],
                                    world.height(p[0], p[1]),
                                    p[1]
                                );
                            },
                            sample(
                                /** @type {number} */ timestamp,
                                /** @type {number} */ trafficMs
                            ) {
                                if (frame >= 15)
                                    samples.push({
                                        frameMs: timestamp - previous,
                                        trafficMs,
                                        cars: roadTraffic.stats().trafficCars,
                                        ...(travel
                                            ? {
                                                  population:
                                                      roadTraffic.snapshot(),
                                                  camera: {
                                                      x: camera.position.x,
                                                      z: camera.position.z
                                                  }
                                              }
                                            : {}),
                                        calls: renderer.info.render.calls,
                                        triangles:
                                            renderer.info.render.triangles
                                    });
                                previous = timestamp;
                                frame++;
                                if (frame >= frames + 15) {
                                    trafficBench = null;
                                    resolve(samples);
                                }
                            }
                        };
                    });
                }
            }
        });
    }
    /** @param {number} timestamp */
    function animate(timestamp) {
        if (closed) return;
        requestAnimationFrame(animate);
        timer.update(timestamp);
        if (automation?.active && !document.hidden)
            automation.update(timer.getDelta());
        if (!trafficBench && !automation?.active && !experience.paused) {
            simulationClock.update(timer.getDelta(), (delta) =>
                simulate(delta, keyboard)
            );
            document.querySelector('.automation-status')?.remove();
        }
        if (!photoMode.active)
            updateMirage(airplane, planeState, keyboard, timestamp / 1000);
        syncPlaneMesh({ airplane, propeller, planeState });
        const mode = photoMode.active ? 'orbit' : cameraMode.getMode();
        machEffect?.render(mode === 'cockpit', planeState.isCrashed);
        flightAudio.update(
            planeState,
            keyboard,
            experience.paused || !document.hasFocus(),
            mode === 'cockpit'
        );
        // Resolve this frame's pause/cockpit mix before playing the crossing cue.
        if (machBoomPending) {
            flightAudio.sonicBoom();
            machBoomPending = false;
        }
        const modeChanged = mode !== lastCameraMode;
        lastCameraMode = mode;
        updateAirplaneCockpitVisibility({
            airplane,
            propeller,
            isCockpit: mode === 'cockpit'
        });
        if (photoMode.active) photoMode.update();
        else
            updateCamera({
                camera,
                controls,
                airplane,
                cameraMode,
                delta: timer.getDelta()
            });
        if (trafficBench) trafficBench.position();
        cockpitOverlay.update({ planeState, cameraMode });
        if (modeChanged || timestamp - lastHudUpdate >= 100) {
            experience.update();
            jetControls.update();
            hud.update({ planeState, cameraMode });
            lastHudUpdate = timestamp;
        }
        if (timestamp - lastRadarUpdate >= 1000 / 15) {
            miniMap.update({ planeState });
            worldMap.update();
            lastRadarUpdate = timestamp;
        }
        // Render at most once per browser frame, including automation substeps.
        clouds.update(
            visualScenario || experience.paused ? 0 : timer.getDelta(),
            camera.position
        );
        groundDetail.update(
            planeState.position,
            scene.userData.quality,
            Math.min(timer.getDelta(), 0.1),
            visualScenario || experience.paused || document.hidden
                ? 0
                : Math.min(timer.getDelta(), 0.1)
        );
        destinationBeacon.update(camera, planeState.position);
        const beacon = scene.getObjectByName('destination-beacon');
        if (photoMode.active && beacon) beacon.visible = false;
        scene.userData.followSun(airplane.position);
        parkedAircraft.update(camera.position, scene.userData.quality);
        serviceVehicles.update(camera.position, scene.userData.quality);
        const trafficStarted = performance.now();
        roadTraffic.update(
            camera.position,
            scene.userData.quality,
            experience.paused || document.hidden
                ? 0
                : Math.min(timer.getDelta(), 0.1)
        );
        const trafficMs = performance.now() - trafficStarted;
        renderer.render(scene, camera);
        document.getElementById('scenery-loading')?.remove();
        fpsCounter.update(timestamp);
        if (trafficBench) trafficBench.sample(timestamp, trafficMs);
        frames++;
        if (import.meta.env.DEV && timestamp - statsAt > 1000) {
            document.documentElement.dataset.sceneryStats = JSON.stringify({
                fps: Math.round((frames * 1000) / (timestamp - statsAt)),
                calls: renderer.info.render.calls,
                triangles: renderer.info.render.triangles,
                geometries: renderer.info.memory.geometries,
                textures: renderer.info.memory.textures,
                machTransitions: machTransition.count,
                ...roadTraffic.stats(),
                ...groundDetail.stats(),
                ...airbase.userData.summary
            });
            statsAt = timestamp;
            frames = 0;
        }
    }
    render();
    requestAnimationFrame(animate);
}

try {
    startApp().catch(reportRuntimeError);
} catch (error) {
    reportRuntimeError(error);
}
