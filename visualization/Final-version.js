// ==============================
// IMPORTS AND CONFIGURATION
// ==============================

// Importing the Three.js library and required modules
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js";
import { OrbitControls } from './lib/OrbitControls.js';
import { GLTFLoader } from "./lib/GLTFLoader.js";

// Constants for simulation settings
const SIMULATION_DURATION = 60; // Total simulation duration in seconds
let TIME_ACCELERATION = 1440 / 5; // Speed multiplier for simulation time
const FLIGHT_SPEED = 0.00015; // Speed of flights in degrees per millisecond

// ==============================
// GLOBAL VARIABLES
// ==============================

let scene, camera, renderer, controls, earth, sunLight;
let flights = []; // Array to store flight objects
let clock = new THREE.Clock(); // Clock to track time
let tooltip = document.getElementById('tooltip'); // Tooltip element for flight info
let raycaster = new THREE.Raycaster(); // Raycaster for detecting mouse interactions
let mouse = new THREE.Vector2(); // Vector to store mouse position
let isUserInteracting = false; // Track whether the user is interacting
let rotationVelocity = 0; // Store the Earth's rotation velocity
let planeInstances; // Instanced mesh for planes
let airportStars = []; // Array to store airport star objects and their data

// ==============================
// FLIGHT CLASS
// ==============================

/**
 * Represents a flight and its behavior.
 * Handles flight data, path creation, and dynamic updates.
 */
class Flight {
    constructor(data) {
        this.data = data; // Flight data from the dataset
        this.startTime = this.parseTime(data.departure_time); // Start time in simulation seconds
        this.duration = this.calculateDuration(); // Duration of the flight
        this.curvePoints = calculateCurvePoints(
            this.data.origin_lat,
            this.data.origin_lon,
            this.data.destination_lat,
            this.data.destination_lon,
            50 // Number of segments for smoothness
        ); // Precompute the curved path
        this.dynamicPath = this.createDynamicPath(this.curvePoints); // Dynamic path for visualization
        this.dynamicPathAdded = false; // Track if dynamicPath is added to the scene
        this.dynamicSegmentIndex = 0; // Track the last drawn segment index
    }

    /**
     * Parses the departure time string into simulation seconds.
     * @param {string} timeString - Time in "HH:MM" format.
     * @returns {number} Time in seconds.
     */
    parseTime(timeString) {
        if (!timeString || typeof timeString !== 'string') return 0; // Default to 0 seconds if invalid
        const [hours, minutes] = timeString.trim().split(':').map(Number);
        return (hours * 60 + minutes) * 60; // Convert to seconds
    }

    /**
     * Calculates the flight duration based on the distance between origin and destination.
     * Uses the haversine formula to calculate the great-circle distance.
     */
    calculateDuration() {
        const dLat = THREE.MathUtils.degToRad(this.data.destination_lat - this.data.origin_lat);
        const dLon = THREE.MathUtils.degToRad(this.data.destination_lon - this.data.origin_lon);
        const a = Math.sin(dLat / 2) ** 2 +
                 Math.cos(THREE.MathUtils.degToRad(this.data.origin_lat)) *
                 Math.cos(THREE.MathUtils.degToRad(this.data.destination_lat)) *
                 Math.sin(dLon / 2) ** 2;
        const distance = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return distance / FLIGHT_SPEED; // Duration based on speed
    }

    /**
     * Creates a dynamic line for the flight path.
     * @param {Array} curvePoints - Precomputed curve points for the path.
     */
    createDynamicPath(curvePoints) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array((curvePoints.length - 1) * 6); // Allocate space for all segments
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        return new THREE.LineSegments(
            geometry,
            new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 })
        );
    }

    /**
     * Updates the flight's position and dynamically draws the path.
     * @param {number} currentTime - Current simulation time in seconds.
     */
    update(currentTime) {
        if (currentTime >= this.startTime && !this.dynamicPathAdded) {
            this.dynamicPathAdded = true;
            scene.add(this.dynamicPath); // Add the dynamic path to the scene
            this.dynamicPath.visible = true; // Ensure visibility
        }

        if (this.dynamicPathAdded && currentTime <= this.startTime + this.duration) {
            const t = (currentTime - this.startTime) / this.duration; // Progress of the flight
            const targetSegmentIndex = Math.floor(t * (this.curvePoints.length - 1));

            // Draw segments up to the current progress
            if (targetSegmentIndex > this.dynamicSegmentIndex) {
                const positions = this.dynamicPath.geometry.attributes.position.array;
                for (let i = this.dynamicSegmentIndex; i <= targetSegmentIndex; i++) {
                    const start = this.curvePoints[i];
                    const end = this.curvePoints[i + 1];

                    if (end) {
                        const offset = i * 6; // Each segment has 6 values (start and end points)
                        positions[offset] = start.x;
                        positions[offset + 1] = start.y;
                        positions[offset + 2] = start.z;
                        positions[offset + 3] = end.x;
                        positions[offset + 4] = end.y;
                        positions[offset + 5] = end.z;
                    }
                }
                this.dynamicPath.geometry.attributes.position.needsUpdate = true; // Mark as updated
                this.dynamicSegmentIndex = targetSegmentIndex; // Update the last drawn segment index
            }
        }
    }

    /**
     * Converts latitude and longitude to a 3D vector on a sphere.
     * @param {number} lat - Latitude in degrees.
     * @param {number} lon - Longitude in degrees.
     * @param {number} radius - Radius of the sphere (default is 1).
     * @returns {THREE.Vector3} A 3D vector representing the position on the sphere.
     */
    latLongToVector3(lat, lon, radius = 1) {
        const phi = THREE.MathUtils.degToRad(90 - lat); // Convert latitude to polar angle
        const theta = THREE.MathUtils.degToRad(lon + 90); // Convert longitude to azimuthal angle
        return new THREE.Vector3().setFromSphericalCoords(radius, phi, theta);
    }
}

// Add the method to the Flight class
Flight.prototype.latLongToVector3 = Flight.prototype.latLongToVector3;

// ==============================
// SCENE INITIALIZATION
// ==============================

/**
 * Initializes the Three.js scene, camera, renderer, and other components.
 */
async function init() {
    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    renderer.autoClear = false; // Ensure the renderer does not clear the DOM

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Set background to black

    // Camera setup
    camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(3, 3, 3); // Position the camera
    camera.lookAt(0, 0, 0); // Point the camera at the center of the scene

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x000000, 10); // Dim ambient light
    scene.add(ambientLight);

    sunLight = new THREE.DirectionalLight(0xffffff, 1); // Directional light to simulate the sun
    sunLight.position.set(5, 3, 5); // Initial position of the sun
    scene.add(sunLight);

    // Earth setup
    createEarth();

    // Controls setup
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 10;

    // Load flight data
    await loadFlightData();

    // Setup UI elements
    setupToggleButtons();
    setupSpeedControl();

    // Start the animation loop
    animate();
}

/**
 * Creates the Earth with textures and lighting effects.
 */
function createEarth() {
    const textureLoader = new THREE.TextureLoader();
    earth = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 64), // Sphere geometry for Earth
        new THREE.MeshPhongMaterial({
            map: textureLoader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
            normalMap: textureLoader.load('https://threejs.org/examples/textures/planets/earth_normal_2048.jpg'),
            specularMap: textureLoader.load('https://threejs.org/examples/textures/planets/earth_specular_2048.jpg'),
            emissiveMap: textureLoader.load('./assets/earth_lights.gif'), // Replace with higher-resolution texture
            emissive: new THREE.Color(0xffffff), // Set emissive color to white
            emissiveIntensity: 0.5, // Adjust intensity of city lights
            normalScale: new THREE.Vector2(0.85, 0.85)
        })
    );
    scene.add(earth);
}

// ==============================
// FLIGHT DATA LOADING
// ==============================

/**
 * Loads flight data from a CSV file and initializes flights.
 */
async function loadFlightData() {
    const response = await fetch('flight_dataset.csv');
    const csvData = await response.text();
    await new Promise(resolve => Papa.parse(csvData, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
            results.data.forEach(data => {
                if (data && data.departure_time) {
                    const flight = new Flight(data); // Create a flight object
                    flights.push(flight); // Add to the flights array
                }
            });
            createInstancedPlanes(); // Create the instanced mesh after flights are populated
            createAirportStars(); // Add stars at airport positions
            resolve();
        }
    }));
}

// ==============================
// ANIMATION LOOP
// ==============================

/**
 * Continuously renders the scene and updates flight positions.
 */
function animate() {
    requestAnimationFrame(animate); // Request the next frame
    const delta = clock.getDelta(); // Time elapsed since the last frame
    const currentTime = clock.getElapsedTime() * TIME_ACCELERATION; // Simulated time

    // Rotate the Earth
    if (!isUserInteracting) {
        earth.rotation.y += rotationVelocity * delta;
        rotationVelocity *= 0.95; // Gradually reduce velocity
        if (Math.abs(rotationVelocity) < 0.00001) rotationVelocity = 0; // Stop rotation when velocity is very small
    }

    // Update the sun's position to match Earth's rotation
    const sunDistance = 10; // Distance of the sun from the Earth
    const sunAngle = earth.rotation.y; // Use Earth's rotation to calculate the sun's position
    sunLight.position.set(
        Math.cos(sunAngle) * sunDistance,
        0,
        Math.sin(sunAngle) * sunDistance
    );

    updateInstancedPlanes(currentTime); // Update the instanced planes
    flights.forEach(flight => flight.update(currentTime)); // Update all flights
    controls.update(); // Update the controls
    renderer.render(scene, camera); // Render the scene
}

// ==============================
// EVENT HANDLERS
// ==============================

// Handle window resize events
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Handle mouse movement for tooltips
window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // Intersect with airport stars
    const airportIntersects = raycaster.intersectObjects(airportStars.map(a => a.star));
    if (airportIntersects.length > 0) {
        const airport = airportStars.find(a => a.star === airportIntersects[0].object);
        if (airport) {
            tooltip.style.display = 'block';
            tooltip.style.left = `${event.clientX + 15}px`;
            tooltip.style.top = `${event.clientY + 15}px`;
            tooltip.innerHTML = `
                <strong>Airport</strong><br>
                Latitude: ${airport.data.lat}<br>
                Longitude: ${airport.data.lon}<br>
                Planes: ${airport.data.planes}
            `;
            return;
        }
    }

    // Intersect with the instanced mesh (planes)
    const planeIntersects = raycaster.intersectObject(planeInstances);
    if (planeIntersects.length > 0) {
        const instanceId = planeIntersects[0].instanceId; // Get the instance ID
        if (instanceId !== undefined) {
            const flight = flights[instanceId]; // Map the instance ID to the corresponding flight
            if (flight) {
                tooltip.style.display = 'block';
                tooltip.style.left = `${event.clientX + 15}px`;
                tooltip.style.top = `${event.clientY + 15}px`;
                tooltip.innerHTML = `
                    <strong>Flight Details</strong><br>
                    Plane Name: ${flight.data.plane_name || 'Unknown'}<br>
                    Plane Model: ${flight.data.plane_model || 'Unknown'}<br>
                    From: ${flight.data.origin_iata || 'Unknown'} (${flight.data.origin_lat}, ${flight.data.origin_lon})<br>
                    To: ${flight.data.destination_iata || 'Unknown'} (${flight.data.destination_lat}, ${flight.data.destination_lon})<br>
                    Departure: ${flight.data.departure_time || 'Unknown'}<br>
                    Duration: ${Math.round(flight.duration / 60)} minutes
                `;
                return;
            }
        }
    }

    tooltip.style.display = 'none'; // Hide tooltip if no intersection
    tooltip.style.cssText = `
        position: absolute;
        background-color: rgba(0, 0, 0, 0.8);
        color: #fff;
        padding: 10px;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-size: 12px;
        pointer-events: none;
        z-index: 1000;
        display: none;
    `;
});

// ==============================
// START THE APPLICATION
// ==============================

init();

// Create flight paths and instanced planes
function createFlightPaths() {
    flights.forEach(flight => {
        const curvePoints = calculateCurvePoints(
            flight.data.origin_lat,
            flight.data.origin_lon,
            flight.data.destination_lat,
            flight.data.destination_lon,
            50 // Number of segments for smoothness
        );

        const curveGeometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const curveMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2, opacity: 0.8, transparent: true }); // Green lines with transparency
        const curveLine = new THREE.Line(curveGeometry, curveMaterial);

        curveLine.visible = false; // Hide complete lines initially
        flight.path = curveLine; // Assign the complete path to the flight
        scene.add(curveLine); // Add the complete path to the scene
    });
}

function createInstancedPlanes() {
    const dotGeometry = new THREE.SphereGeometry(0.01, 8, 8); // Small sphere for dots
    const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 , emissiveIntensity: 0.1 }); // Red color for dots

    planeInstances = new THREE.InstancedMesh(dotGeometry, dotMaterial, flights.length);

    // Ensure boundingSphere is defined for raycasting
    dotGeometry.computeBoundingSphere();

    // Override raycast method for InstancedMesh
    planeInstances.raycast = function (raycaster, intersects) {
        const inverseMatrix = new THREE.Matrix4();
        const ray = new THREE.Ray();
        const sphere = new THREE.Sphere();

        const instanceMatrix = new THREE.Matrix4();
        const localRay = new THREE.Ray();

        sphere.copy(dotGeometry.boundingSphere).applyMatrix4(instanceMatrix);

        for (let i = 0; i < this.count; i++) {
            this.getMatrixAt(i, instanceMatrix);
            inverseMatrix.copy(instanceMatrix).invert();
            localRay.copy(raycaster.ray).applyMatrix4(inverseMatrix);

            if (localRay.intersectsSphere(sphere)) {
                const intersectionPoint = new THREE.Vector3();
                localRay.intersectSphere(sphere, intersectionPoint);
                intersectionPoint.applyMatrix4(instanceMatrix);

                const distance = raycaster.ray.origin.distanceTo(intersectionPoint);
                if (distance < raycaster.near || distance > raycaster.far) continue;

                intersects.push({
                    distance: distance,
                    point: intersectionPoint.clone(),
                    object: this,
                    instanceId: i, // Add instanceId to the intersection
                });
            }
        }
    };

    scene.add(planeInstances); // Add the instanced mesh to the scene
    createFlightPaths(); // Create flight path lines
}

// Function to calculate a curved path between two points on a sphere
function calculateCurvePoints(originLat, originLon, destLat, destLon, segments = 50) {
    const curvePoints = [];
    const start = Flight.prototype.latLongToVector3(originLat, originLon, 1.05); // Slightly above the surface
    const end = Flight.prototype.latLongToVector3(destLat, destLon, 1.05); // Slightly above the surface

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const intermediate = new THREE.Vector3().lerpVectors(start, end, t).normalize().multiplyScalar(1.05); // Offset for altitude
        curvePoints.push(intermediate);
    }

    return curvePoints;
}

// Update instanced planes' positions
function updateInstancedPlanes(currentTime) {
    if (!planeInstances || !flights.length) return;

    const dummy = new THREE.Object3D(); // Temporary object for transformations

    flights.forEach((flight, index) => {
        const t = (currentTime - flight.startTime) / flight.duration; // Progress of the flight

        if (t >= 0 && t <= 1) {
            const start = Flight.prototype.latLongToVector3(flight.data.origin_lat, flight.data.origin_lon);
            const end = Flight.prototype.latLongToVector3(flight.data.destination_lat, flight.data.destination_lon);
            const radiusOffset = 0.05; // Offset for path above the sphere

            // Interpolate position smoothly along the curve
            const currentPos = new THREE.Vector3().copy(start).lerp(end, t).normalize().multiplyScalar(1 + radiusOffset);

            // Set position and orientation
            dummy.position.copy(currentPos);
            const nextPos = new THREE.Vector3().copy(start).lerp(end, Math.min(t + 0.01, 1)).normalize().multiplyScalar(1 + radiusOffset);
            dummy.lookAt(nextPos);

            // Apply transformations to the instance
            dummy.updateMatrix();
            planeInstances.setMatrixAt(index, dummy.matrix);

            // Update airport plane counts
            if (t < 0.01 && !flight.departed) {
                // Plane just departed, decrement origin airport count
                const originKey = `${flight.data.origin_lat},${flight.data.origin_lon}`;
                const originAirport = airportStars.find(a => `${a.data.lat},${a.data.lon}` === originKey);
                if (originAirport) originAirport.data.planes--;
                flight.departed = true; // Mark flight as departed
            } else if (t > 0.99 && !flight.arrived) {
                // Plane just arrived, increment destination airport count
                const destinationKey = `${flight.data.destination_lat},${flight.data.destination_lon}`;
                const destinationAirport = airportStars.find(a => `${a.data.lat},${a.data.lon}` === destinationKey);
                if (destinationAirport) destinationAirport.data.planes++;
                flight.arrived = true; // Mark flight as arrived
            }
        }
    });

    planeInstances.instanceMatrix.needsUpdate = true; // Notify Three.js of the updates
}

// Add buttons to toggle visibility of complete and dynamic lines
function setupToggleButtons() {
    const buttonStyle = `
        position: absolute;
        padding: 10px 20px;
        font-size: 14px;
        font-weight: bold;
        color: #fff;
        background-color: #007bff;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: background-color 0.3s ease;
        z-index: 1000; /* Ensure buttons stay on top */
        display: block; /* Ensure buttons are visible */
    `;

    const toggleCompleteLinesButton = document.createElement('button');
    toggleCompleteLinesButton.innerText = 'Toggle Complete Lines';
    toggleCompleteLinesButton.style.cssText = buttonStyle;
    toggleCompleteLinesButton.style.top = '10px';
    toggleCompleteLinesButton.style.left = '10px';
    document.body.appendChild(toggleCompleteLinesButton);

    const toggleDynamicLinesButton = document.createElement('button');
    toggleDynamicLinesButton.innerText = 'Toggle Dynamic Lines';
    toggleDynamicLinesButton.style.cssText = buttonStyle;
    toggleDynamicLinesButton.style.top = '60px';
    toggleDynamicLinesButton.style.left = '10px';
    document.body.appendChild(toggleDynamicLinesButton);

    let areCompleteLinesVisible = false; // Start with complete lines hidden
    let areDynamicLinesVisible = true;

    toggleCompleteLinesButton.addEventListener('click', () => {
        areCompleteLinesVisible = !areCompleteLinesVisible;
        flights.forEach(flight => {
            if (flight.path) flight.path.visible = areCompleteLinesVisible;
        });
    });

    toggleDynamicLinesButton.addEventListener('click', () => {
        areDynamicLinesVisible = !areDynamicLinesVisible;
        flights.forEach(flight => {
            if (flight.dynamicPath) flight.dynamicPath.visible = areDynamicLinesVisible;
        });
    });
}

// Add a slider to control simulation speed
function setupSpeedControl() {
    const speedControlContainer = document.createElement('div');
    speedControlContainer.style.cssText = `
        position: absolute;
        bottom: 10px;
        left: 10px;
        z-index: 1000;
        background-color: rgba(0, 0, 0, 0.8);
        color: #fff;
        padding: 10px;
        border-radius: 5px;
        font-family: Arial, sans-serif;
        font-size: 14px;
    `;

    const speedLabel = document.createElement('label');
    speedLabel.innerText = 'Simulation Speed: ';
    speedLabel.style.marginRight = '10px';

    const speedSlider = document.createElement('input');
    speedSlider.type = 'range';
    speedSlider.min = '1';
    speedSlider.max = '10';
    speedSlider.value = '5';
    speedSlider.style.width = '200px';

    speedSlider.addEventListener('input', () => {
        TIME_ACCELERATION = 1440 / speedSlider.value; // Adjust time acceleration based on slider value
    });

    speedControlContainer.appendChild(speedLabel);
    speedControlContainer.appendChild(speedSlider);
    document.body.appendChild(speedControlContainer);
}

// Create stars at airport positions
function createAirportStars() {
    const starGeometry = new THREE.SphereGeometry(0.01, 16, 16); // Slightly larger sphere for stars
    const starMaterial = new THREE.MeshStandardMaterial({ color: 0xf7a400, emissive: 0xffd700, emissiveIntensity: 1.1 }); // Gold color with emissive effect

    const airportData = {}; // Object to store airport details (e.g., number of planes)

    flights.forEach(flight => {
        const originKey = `${flight.data.origin_lat},${flight.data.origin_lon}`;
        const destinationKey = `${flight.data.destination_lat},${flight.data.destination_lon}`;

        // Increment plane count only for the origin airport at the start
        if (!airportData[originKey]) {
            airportData[originKey] = { lat: flight.data.origin_lat, lon: flight.data.origin_lon, planes: 0 };
        }
        airportData[originKey].planes++;

        // Ensure destination airport exists in the data
        if (!airportData[destinationKey]) {
            airportData[destinationKey] = { lat: flight.data.destination_lat, lon: flight.data.destination_lon, planes: 0 };
        }
    });

    Object.values(airportData).forEach(airport => {
        const position = Flight.prototype.latLongToVector3(airport.lat, airport.lon);

        const star = new THREE.Mesh(starGeometry, starMaterial);
        star.position.copy(position);
        scene.add(star);

        airportStars.push({ star, data: airport });
    });
}