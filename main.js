import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize the scene, camera, and renderer
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f0f0);

// Create a camera that will be positioned relative to the plane
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(10, 5, -120); // Updated to match the new plane position

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
document.getElementById('canvas-container').appendChild(renderer.domElement);

// Add orbit controls for debugging
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2;
controls.maxDistance = 100;

// Debug mode flag - when true, use orbit controls; when false, use third-person camera
let debugMode = false;

// Toggle debug mode with the 'D' key
window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'd') {
        debugMode = !debugMode;
        console.log('Debug mode:', debugMode ? 'ON' : 'OFF');
    }
});

// Add lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Create a simple airplane model
function createAirplane() {
    const airplane = new THREE.Group();
    
    // Materials
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x3366cc, 
        specular: 0x111111, 
        shininess: 30 
    });
    const detailMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffffff, 
        specular: 0x111111, 
        shininess: 30 
    });
    
    // Fuselage (main body)
    const fuselageGeometry = new THREE.CylinderGeometry(0.8, 0.8, 6, 16);
    fuselageGeometry.rotateZ(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeometry, bodyMaterial);
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    airplane.add(fuselage);
    
    // Nose cone
    const noseGeometry = new THREE.ConeGeometry(0.8, 2, 16);
    noseGeometry.rotateZ(-Math.PI / 2);
    const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
    nose.position.set(4, 0, 0);
    nose.castShadow = true;
    nose.receiveShadow = true;
    airplane.add(nose);
    
    // Tail
    const tailGeometry = new THREE.ConeGeometry(0.8, 1, 16);
    tailGeometry.rotateZ(Math.PI / 2);
    const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
    tail.position.set(-3.5, 0, 0);
    tail.castShadow = true;
    tail.receiveShadow = true;
    airplane.add(tail);
    
    // Wings
    const wingGeometry = new THREE.BoxGeometry(3, 0.2, 10);
    const wings = new THREE.Mesh(wingGeometry, bodyMaterial);
    wings.castShadow = true;
    wings.receiveShadow = true;
    airplane.add(wings);
    
    // Tail wings
    const tailWingGeometry = new THREE.BoxGeometry(1.5, 0.2, 3);
    const tailWing = new THREE.Mesh(tailWingGeometry, bodyMaterial);
    tailWing.position.set(-3, 0, 0);
    tailWing.castShadow = true;
    tailWing.receiveShadow = true;
    airplane.add(tailWing);
    
    // Vertical stabilizer
    const stabilizerGeometry = new THREE.BoxGeometry(1.5, 2, 0.2);
    const stabilizer = new THREE.Mesh(stabilizerGeometry, bodyMaterial);
    stabilizer.position.set(-3, 1, 0);
    stabilizer.castShadow = true;
    stabilizer.receiveShadow = true;
    airplane.add(stabilizer);
    
    // Cockpit
    const cockpitGeometry = new THREE.SphereGeometry(0.8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpit = new THREE.Mesh(cockpitGeometry, detailMaterial);
    cockpit.position.set(1.5, 0.6, 0);
    cockpit.rotation.x = Math.PI;
    cockpit.rotation.y = Math.PI / 2;
    cockpit.castShadow = true;
    cockpit.receiveShadow = true;
    airplane.add(cockpit);
    
    // Propeller
    const propellerGeometry = new THREE.BoxGeometry(0.2, 0.1, 3);
    const propeller = new THREE.Mesh(propellerGeometry, detailMaterial);
    propeller.position.set(5, 0, 0);
    propeller.castShadow = true;
    propeller.receiveShadow = true;
    airplane.add(propeller);
    
    return { airplane, propeller };
}

// Create and add the airplane to the scene
const { airplane, propeller } = createAirplane();
// Position and rotate the airplane to align with the runway
airplane.position.set(0, 0.5, -120); // Moved further back on the runway
// Fix the plane's orientation to face forward along the runway
airplane.rotation.y = -Math.PI / 2; // Rotate to face forward along the runway
scene.add(airplane);

// Create airbase tarmac
function createAirbase() {
    const airbaseGroup = new THREE.Group();
    
    // Runway - make it much longer (3x)
    const runwayGeometry = new THREE.PlaneGeometry(20, 300);
    const runwayMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x222222,
        specular: 0x333333,
        shininess: 10
    });
    const runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
    runway.rotation.x = -Math.PI / 2;
    runway.position.y = 0.01; // Slightly above grass to prevent z-fighting
    runway.receiveShadow = true;
    airbaseGroup.add(runway);
    
    // Runway center line
    const centerLineGeometry = new THREE.PlaneGeometry(0.5, 290);
    const centerLineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const centerLine = new THREE.Mesh(centerLineGeometry, centerLineMaterial);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.y = 0.02;
    airbaseGroup.add(centerLine);
    
    // Runway edge markings
    for (let i = -140; i <= 140; i += 10) {
        if (i % 20 !== 0) { // Skip every other marking for a dashed effect
            const edgeMarkGeometry = new THREE.PlaneGeometry(0.5, 2);
            const edgeMark = new THREE.Mesh(edgeMarkGeometry, centerLineMaterial);
            edgeMark.rotation.x = -Math.PI / 2;
            edgeMark.position.set(9.5, 0.02, i);
            airbaseGroup.add(edgeMark);
            
            const edgeMark2 = edgeMark.clone();
            edgeMark2.position.set(-9.5, 0.02, i);
            airbaseGroup.add(edgeMark2);
        }
    }
    
    // Runway threshold markings
    for (let i = -8; i <= 8; i += 2) {
        const thresholdMarkGeometry = new THREE.PlaneGeometry(0.5, 5);
        const thresholdMark = new THREE.Mesh(thresholdMarkGeometry, centerLineMaterial);
        thresholdMark.rotation.x = -Math.PI / 2;
        thresholdMark.position.set(i, 0.02, -147);
        airbaseGroup.add(thresholdMark);
        
        const thresholdMark2 = thresholdMark.clone();
        thresholdMark2.position.z = 147;
        airbaseGroup.add(thresholdMark2);
    }
    
    // Surrounding grass field - make it larger to match runway
    const grassGeometry = new THREE.PlaneGeometry(500, 500);
    const grassMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x4CAF50,
        specular: 0x111111,
        shininess: 5
    });
    const grass = new THREE.Mesh(grassGeometry, grassMaterial);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 0; // At ground level
    grass.receiveShadow = true;
    airbaseGroup.add(grass);
    
    return airbaseGroup;
}

// Create and add airbase to the scene
const airbase = createAirbase();
airbase.position.y = -0.5; // Position at ground level
scene.add(airbase);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Add keyboard state tracking
const keyboard = {
    w: false,
    arrowUp: false,
    arrowDown: false
};

// Plane physics properties
const planePhysics = {
    speed: 0,
    acceleration: 0.01,
    maxSpeed: 2,
    friction: 0.01,
    pitchAngle: 0,
    maxPitchAngle: 0.2, // Maximum pitch angle in radians (about 11.5 degrees)
    pitchSpeed: 0.005,  // How quickly the plane pitches
    lift: 0,            // Current lift force
    liftFactor: 0.02,   // How much lift is generated
    gravity: 0.01,      // Gravity force pulling the plane down
    minTakeoffSpeed: 1.5, // Minimum speed required for takeoff
    isAirborne: false,  // Track if the plane is in the air
    takeoffThreshold: 0.1 // Minimum height to be considered airborne
};

// Add keyboard event listeners
window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'w') {
        keyboard.w = true;
    } else if (event.key === 'ArrowUp') {
        keyboard.arrowUp = true;
    } else if (event.key === 'ArrowDown') {
        keyboard.arrowDown = true;
    }
});

window.addEventListener('keyup', (event) => {
    if (event.key.toLowerCase() === 'w') {
        keyboard.w = false;
    } else if (event.key === 'ArrowUp') {
        keyboard.arrowUp = false;
    } else if (event.key === 'ArrowDown') {
        keyboard.arrowDown = false;
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Rotate propeller around the correct axis (x-axis for forward rotation)
    propeller.rotation.x += 0.2;
    
    // Handle plane movement based on keyboard input
    if (keyboard.w) {
        // Accelerate when W is pressed
        planePhysics.speed += planePhysics.acceleration;
        // Limit to max speed
        if (planePhysics.speed > planePhysics.maxSpeed) {
            planePhysics.speed = planePhysics.maxSpeed;
        }
        
        // Increase propeller rotation speed with plane speed
        propeller.rotation.x += planePhysics.speed * 0.1;
    } else {
        // Apply friction when W is not pressed
        planePhysics.speed -= planePhysics.friction;
        if (planePhysics.speed < 0) {
            planePhysics.speed = 0;
        }
    }
    
    // Handle pitch control with arrow keys
    if (keyboard.arrowUp) {
        // Pitch down (reversed)
        planePhysics.pitchAngle -= planePhysics.pitchSpeed;
        if (planePhysics.pitchAngle < -planePhysics.maxPitchAngle) {
            planePhysics.pitchAngle = -planePhysics.maxPitchAngle;
        }
    } else if (keyboard.arrowDown) {
        // Pitch up (reversed)
        planePhysics.pitchAngle += planePhysics.pitchSpeed;
        if (planePhysics.pitchAngle > planePhysics.maxPitchAngle) {
            planePhysics.pitchAngle = planePhysics.maxPitchAngle;
        }
    } else {
        // Return to level flight gradually when no arrow keys are pressed
        if (planePhysics.pitchAngle > 0) {
            planePhysics.pitchAngle -= planePhysics.pitchSpeed / 2;
            if (planePhysics.pitchAngle < 0) planePhysics.pitchAngle = 0;
        } else if (planePhysics.pitchAngle < 0) {
            planePhysics.pitchAngle += planePhysics.pitchSpeed / 2;
            if (planePhysics.pitchAngle > 0) planePhysics.pitchAngle = 0;
        }
    }
    
    // Apply pitch rotation to the airplane
    airplane.rotation.z = planePhysics.pitchAngle;
    
    // Flight physics - calculate lift based on speed and pitch
    if (planePhysics.speed > 0) {
        // Only apply flight physics if the plane is moving
        
        // Move the plane forward based on current speed
        // For a plane facing -Z (with rotation.y = -Math.PI/2), the forward direction is +X
        const moveVector = new THREE.Vector3(planePhysics.speed, 0, 0);
        moveVector.applyQuaternion(airplane.quaternion);
        airplane.position.add(moveVector);
        
        // Calculate lift based on speed and pitch angle
        // More speed and positive pitch generate more lift
        const speedFactor = Math.max(0, (planePhysics.speed - 0.5) / planePhysics.minTakeoffSpeed);
        const pitchFactor = Math.max(0, planePhysics.pitchAngle * 10 + 0.5);
        
        // Smooth lift calculation with proper thresholds
        planePhysics.lift = speedFactor * pitchFactor * planePhysics.liftFactor;
        
        // Check if we're already airborne or have enough speed for takeoff
        if (planePhysics.isAirborne || planePhysics.speed >= planePhysics.minTakeoffSpeed) {
            // Apply lift if we have positive pitch and enough speed
            if (planePhysics.pitchAngle > 0 && planePhysics.speed > 0.8) {
                // Plane is taking off or flying
                airplane.position.y += planePhysics.lift;
                
                // Mark as airborne once we reach a certain height
                if (airplane.position.y > 0.5 + planePhysics.takeoffThreshold) {
                    planePhysics.isAirborne = true;
                }
            }
            
            // Apply gravity (always present)
            airplane.position.y -= planePhysics.gravity;
            
            // Check if we've landed
            if (airplane.position.y <= 0.5) {
                airplane.position.y = 0.5;
                // Only consider landed if speed is low enough or pitch is negative
                if (planePhysics.speed < 0.8 || planePhysics.pitchAngle < 0) {
                    planePhysics.isAirborne = false;
                }
            }
        } else {
            // Not enough speed for takeoff or not airborne, stay on ground
            airplane.position.y = 0.5;
        }
        
        // Keep the plane on the runway only if not airborne
        if (!planePhysics.isAirborne) {
            if (airplane.position.z < -145) {
                airplane.position.z = -145;
            } else if (airplane.position.z > 145) {
                airplane.position.z = 145;
            }
        }
    } else {
        // No speed, apply gravity and stay on ground
        if (airplane.position.y > 0.5) {
            airplane.position.y -= planePhysics.gravity * 2; // Fall faster when not moving
            if (airplane.position.y < 0.5) {
                airplane.position.y = 0.5;
                planePhysics.isAirborne = false;
            }
        } else {
            airplane.position.y = 0.5;
            planePhysics.isAirborne = false;
        }
    }
    
    if (!debugMode) {
        // Use third-person camera when not in debug mode
        // Position the camera in a third-person view behind and slightly above the plane
        const cameraOffset = new THREE.Vector3(-10, 4, 0); // Restored to requested values
        cameraOffset.applyQuaternion(airplane.quaternion); // Rotate the offset based on plane orientation
        
        // Set camera position relative to the plane
        camera.position.copy(airplane.position).add(cameraOffset);
        
        // Make the camera look at the plane, slightly ahead of it
        const lookAtOffset = new THREE.Vector3(2, 0, 0); // Look slightly ahead of the plane
        lookAtOffset.applyQuaternion(airplane.quaternion);
        const lookAtPoint = airplane.position.clone().add(lookAtOffset);
        camera.lookAt(lookAtPoint);
    } else {
        // In debug mode, update orbit controls
        controls.target.copy(airplane.position); // Focus orbit controls on the plane
        controls.update();
    }
    
    // Render the scene
    renderer.render(scene, camera);
}

animate(); 