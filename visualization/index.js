// ==============================
// IMPORTS AND CONFIGURATION
// ==============================

// Importing the Three.js library and required modules
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js";
import { OrbitControls } from './lib/OrbitControls.js';

let scene, camera, renderer, earth, controls;
let activeDots = [];
let tooltip = document.getElementById('tooltip');

// A counter that indicates which packet we are going to request next.
let nextIndex = 0;

// Initialize the scene and start the animation loop.
init();
animate();

// Instead of fetching all packets at once, we fetch one new packet every 2 seconds.
setInterval(fetchAndPlot, 100); 

function init() {
    scene = new THREE.Scene();

    // Camera setup
    camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 3);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create the Earth (globe)
    const textureLoader = new THREE.TextureLoader();
    const earthMaterial = new THREE.MeshPhongMaterial({
        map: textureLoader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
    });
    earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthMaterial);
    scene.add(earth);

    // Lighting
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 3, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x222222));

    // Orbit Controls for interaction
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Handle window resize events
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Optional: Set up mousemove events for tooltip display.
    window.addEventListener("mousemove", onMouseMove);
}

// Converts latitude and longitude to a 3D vector on a sphere.
// The radius is set slightly larger than 1 (the Earth’s radius) to "lift" the dots.
function latLonToVector3(lat, lon, radius = 1.01) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}

// Plots a dot on the globe using the provided latitude, longitude, and additional data.
function plotDot(lat, lon, ip, suspicious) {
    const dotGeometry = new THREE.SphereGeometry(0.01, 8, 8); // Small sphere geometry
    const color = suspicious === 1 ? 0xff0000 : 0x00ff00;         // Red for suspicious; green otherwise
    const dotMaterial = new THREE.MeshBasicMaterial({ color });
    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    dot.position.copy(latLonToVector3(lat, lon));
    // Save packet details in the object's userData (useful for tooltips)
    dot.userData = { ip, suspicious };
    scene.add(dot);
    activeDots.push(dot);

    // Remove the point after 10 seconds (so that the visualization does not get overwhelmed)
    setTimeout(() => {
        scene.remove(dot);
        activeDots = activeDots.filter(d => d !== dot);
    }, 10000);
}

// Fetches one packet from the backend using the next available index.
// Calls the /get_data/<index> endpoint and, upon success, plots the data.
async function fetchAndPlot() {
    try {
        const res = await fetch(`http://localhost:5001/get_data/${nextIndex}`);
        if (res.status === 200) {
            const packet = await res.json();
            // Assumes packet contains 'Latitude', 'Longitude', 'ip', and 'suspicious'
            plotDot(packet.Latitude, packet.Longitude, packet.ip, packet.suspicious);
            // Increment to fetch the next packet in the next interval
            nextIndex++;
        } else {
            // Endpoint could return an error if the index is out-of-range,
            // indicating no new data is available (or a delay in arrival).
            console.log("No new packet available:", await res.json());
        }
    } catch (err) {
        console.error("Fetch failed:", err);
    }
}

// The animation loop updates controls and renders the scene continuously.
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Optional: Displays tooltips when hovering over a plotted dot.
function onMouseMove(event) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(activeDots);
    if (intersects.length > 0) {
        const { ip, suspicious } = intersects[0].object.userData;
        tooltip.innerHTML = `
            <b>IP:</b> ${ip}<br>
            <b>Suspicious:</b> ${suspicious === 1 ? "Yes" : "No"}
        `;
        tooltip.style.display = "block";
        tooltip.style.left = `${event.clientX + 10}px`;
        tooltip.style.top = `${event.clientY + 10}px`;
    } else {
        tooltip.style.display = "none";
    }
}
