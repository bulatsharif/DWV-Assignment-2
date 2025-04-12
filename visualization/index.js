// importing needed packages
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js";
import { OrbitControls } from './lib/OrbitControls.js';

// this function is used for creating charts for the three countries
function createChart(ctxId, label) {
    const ctx = document.getElementById(ctxId).getContext('2d');
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                borderColor: 'yellow',
                borderWidth: 2,
                fill: false,
                tension: 0.2
            }]
        },
        options: {
            responsive: false,
            animation: false,
            plugins: {
                legend: { labels: { color: 'white' } }
            },
            scales: {
                x: { ticks: { color: 'white' } },
                y: { ticks: { color: 'white' } }
            }
        }
    });
}

// Initialize charts for 3 countries
const charts = {
    US: createChart("chartUS", "USA Requests"),
    RU: createChart("chartRU", "Russia Requests"),
    CN: createChart("chartCN", "China Requests")
};
setInterval(updateCountryCharts, 1000);


// function to update the country charts
function updateCountryCharts() {
    const now = new Date();
    const label = now.toLocaleTimeString();

    const counts = { US: 0, RU: 0, CN: 0 };

    activeDots.forEach(dot => {
        const code = dot.userData.country_code;
        if (counts[code] !== undefined) {
            counts[code]++;
        }
    });

    for (const code of ["US", "RU", "CN"]) {
        const chart = charts[code];
        chart.data.labels.push(label);
        chart.data.datasets[0].data.push(counts[code]);

        if (chart.data.labels.length > 60) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }

        chart.update();
    }
}

let scene, camera, renderer, earth, controls;
let activeDots = [];  // Array to store currently visible dots
let tooltip = document.getElementById('tooltip');
let countryTable = document.getElementById('countryTable');

// A counter that indicates which packet we are going to request next.
let nextIndex = 0;

// Initialize the scene and start the animation loop.
init();
animate();

// Fetch a new packet every 100ms 
setInterval(fetchAndPlot, 100); 

// Update the country table every second
setInterval(updateCountryTable, 100);




function init() {
    scene = new THREE.Scene();

    // Camera setup
    camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 3);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Create the Earth using a texture map
    const textureLoader = new THREE.TextureLoader();
    const earthMaterial = new THREE.MeshPhongMaterial({
        map: textureLoader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg'),
    });
    earth = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthMaterial);
    scene.add(earth);

    // Lighting to illuminate the globe
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(5, 3, 5);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x222222));

    // Orbit Controls for interaction 
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.5;
    controls.maxDistance = 5;
    
    // Handle window resize events
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Set up mousemove events to display tooltips when hovering over dots
    window.addEventListener("mousemove", onMouseMove);
}

// Converts latitude and longitude to a 3D vector on a sphere.
// The radius is set slightly larger than 1 to "lift" the dots.
function latLonToVector3(lat, lon, radius = 1.01) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}


// Converts a two-letter country code to an emoji flag (used for country table).
function isoToFlagEmoji(isoCode) {
    if (!isoCode || isoCode.length !== 2) return "";
    return String.fromCodePoint(
        ...isoCode.toUpperCase().split('').map(c => 127397 + c.charCodeAt())
    );
}


// gets name and code from ip using specific api
async function getCountryFromIP(ip) {
    try {
        const res = await fetch(`https://api.ipinfo.io/lite/${ip}?token=75b9299eb7bc80`);
        if (!res.ok) throw new Error("Network response was not ok");
        const geoData = await res.json();

        return {
            country: geoData.country || "Unknown",         // full name
            country_code: geoData.country_code || "XX"     // 2-letter ISO
        };
    } catch (err) {
        console.error("Error fetching country:", err);
        return {
            country: "Unknown",
            country_code: "XX"
        };
    } 

}


// Plots a dot on the globe using the provided latitude, longitude, and additional data.
function plotDot(lat, lon, ip, suspicious) {
    const dotGeometry = new THREE.SphereGeometry(0.01, 8, 8);
    const color = suspicious === 1 ? 0xff0000 : 0x00ff00;
    const dotMaterial = new THREE.MeshBasicMaterial({ color });
    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    dot.position.copy(latLonToVector3(lat, lon));

    dot.userData = { ip, suspicious };

    scene.add(dot);
    activeDots.push(dot);

    getCountryFromIP(ip).then(({ country, country_code }) => {
        dot.userData.country = country;
        dot.userData.country_code = country_code;
    });

    setTimeout(() => {
        scene.remove(dot);
        activeDots = activeDots.filter(d => d !== dot);
    }, 10000);
}


// Fetches one packet from the backend using the next available index.
async function fetchAndPlot() {
    try {
        const res = await fetch(`http://localhost:5001/get_data/${nextIndex}`);
        if (res.status === 200) {
            const packet = await res.json();
            plotDot(packet.Latitude, packet.Longitude, packet.ip, packet.suspicious);
            nextIndex++;  // Increment counter for the next request
        } else {
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

// Displays tooltips when hovering over a plotted dot.
function onMouseMove(event) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(activeDots);
    if (intersects.length > 0) {
        const { ip, suspicious, country, country_code } = intersects[0].object.userData;
        const flag = isoToFlagEmoji(country_code);

        tooltip.innerHTML = `
            <b>IP:</b> ${ip}<br>
            <b>Country:</b> ${flag} ${country || "Loading..."}<br>
            <b>Suspicious:</b> ${suspicious === 1 ? "Yes" : "No"}
        `;
        tooltip.style.display = "block";
        tooltip.style.left = `${event.clientX + 10}px`;
        tooltip.style.top = `${event.clientY + 10}px`;
    } else {
        tooltip.style.display = "none";
    }
}


// Updates the left-side table to list the top countries by count of visible dots.
// This function recalculates the counts from the currently active dots.
function updateCountryTable() {
    const counts = {}; 

    activeDots.forEach(dot => {
        const name = dot.userData.country;
        const code = dot.userData.country_code;

        if (name && code && code !== "XX") {
            if (!counts[name]) {
                counts[name] = { code: code, count: 0 };
            }
            counts[name].count += 1;
        }
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1].count - a[1].count);

    let html = "<table>";
    if (sorted.length === 0) {
        html += "<tr><td>No data</td></tr>";
    } else {
        sorted.forEach(([name, { code, count }]) => {
            const flagEmoji = isoToFlagEmoji(code);
            html += `
                <tr>
                    <td>${flagEmoji}</td>
                    <td>${name}</td>
                    <td>${count}</td>
                </tr>
            `;
        });
    }
    html += "</table>";
    countryTable.innerHTML = html;
}








