// app.js

// -------------------
// VARIABILI GLOBALI
// -------------------
let map;
let allWaypoints = [];
let waypointMarkers = [];
let reachedWaypointsLog = [];
let currentWaypointIndex = -1;
let stats = { total: 0, reached: 0, remaining: 0, skipped: 0 };
let userMarker;
let circles = [];

let wakeLock = null;
let promptTimeout;
let promptInterval;
let promptedWaypointIndex = -1;

// ----------------------------------------------------
// INIZIALIZZAZIONE DELL'APPLICAZIONE
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    map = L.map('map').setView([41.9028, 12.4964], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Gestione salvataggio impostazioni (invariato)
    const distAInput = document.getElementById('dist-a');
    const distBInput = document.getElementById('dist-b');
    const distCInput = document.getElementById('dist-c');
    const distanceInputs = [distAInput, distBInput, distCInput];
    function saveDistanceSettings() {
        localStorage.setItem('raceTrackerDistanceSettings', JSON.stringify({ distA: distAInput.value, distB: distBInput.value, distC: distCInput.value }));
    }
    function loadDistanceSettings() {
        const savedSettings = localStorage.getItem('raceTrackerDistanceSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            distAInput.value = settings.distA;
            distBInput.value = settings.distB;
            distCInput.value = settings.distC;
        }
    }
    loadDistanceSettings();
    distanceInputs.forEach(input => input.addEventListener('change', saveDistanceSettings));

    // Listeners principali
    document.getElementById('gpx-file').addEventListener('change', handleFileUpload);
    document.getElementById('skip-wp-btn').addEventListener('click', skipCurrentWaypoint);
    document.getElementById('download-log-btn').addEventListener('click', downloadLog);
    document.getElementById('wakelock-btn').addEventListener('click', toggleWakeLock);
    document.getElementById('prompt-yes').addEventListener('click', () => handleSwitchResponse(true));
    document.getElementById('prompt-no').addEventListener('click', () => handleSwitchResponse(false));

    // Gestione collapsible (invariato)
    const collapsibleHeader = document.querySelector('.collapsible-header');
    collapsibleHeader.addEventListener('click', function() {
        this.classList.toggle('active');
        const content = this.nextElementSibling;
        content.style.maxHeight = content.style.maxHeight ? null : content.scrollHeight + "px";
    });

    // Gestione sidebar (invariato)
    const sidebar = document.getElementById('sidebar');
    const toggleButton = document.getElementById('sidebar-toggle');
    const closeButton = document.getElementById('sidebar-close-btn');
    function showSidebar() { sidebar.classList.add('visible'); }
    function hideSidebar() { sidebar.classList.remove('visible'); }
    toggleButton.addEventListener('click', (e) => { e.stopPropagation(); showSidebar(); });
    closeButton.addEventListener('click', hideSidebar);
    map.on('click', hideSidebar);

    startGpsTracking();
});

// ---------------------------------
// FUNZIONI DI GESTIONE DEL GPX
// ---------------------------------
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const gpxData = e.target.result;
            const gpx = new gpxParser();
            gpx.parse(gpxData);

            if (gpx && gpx.waypoints && gpx.waypoints.length > 0) {
                allWaypoints = gpx.waypoints.map(wp => ({
                    lat: wp.lat,
                    lon: wp.lon,
                    name: wp.name || 'Waypoint',
                    time: wp.time,
                    ele: wp.ele,
                    status: 'pending'
                }));

                resetState();
                stats.total = allWaypoints.length;
                stats.remaining = allWaypoints.length;
                updateStatsUI();
                drawAllWaypoints(allWaypoints);
                setCurrentWaypoint(0);

            } else {
                alert("File GPX non valido o non contenente waypoint (<wpt>).");
            }

        } catch (error) {
            console.error("Errore parsing GPX:", error);
            alert("Errore durante la lettura del file GPX.");
        }
    };
    reader.readAsText(file);
}

function drawAllWaypoints(waypoints) {
    waypointMarkers.forEach(m => map.removeLayer(m));
    waypointMarkers = [];
    
    waypoints.forEach(wp => {
        const marker = L.marker([wp.lat, wp.lon])
            .addTo(map)
            .bindPopup(`<b>${wp.name}</b><br>Ele: ${wp.ele || 'N/A'} m`);
        waypointMarkers.push(marker);
    });
}

function resetState() {
    stats = { total: 0, reached: 0, remaining: 0, skipped: 0 };
    reachedWaypointsLog = [];
    currentWaypointIndex = -1;
    promptedWaypointIndex = -1;

    circles.forEach(c => map.removeLayer(c));
    circles = [];

    waypointMarkers.forEach(m => map.removeLayer(m));
    waypointMarkers = [];

    updateStatsUI();
    document.getElementById('wp-distance').textContent = 'Dist: --';
}

function setCurrentWaypoint(index) {
    const distanceEl = document.getElementById('wp-distance');
    if (index >= allWaypoints.length) {
        alert("Complimenti! Hai raggiunto tutti i waypoint.");
        currentWaypointIndex = -1;
        circles.forEach(c => map.removeLayer(c));
        circles = [];
        distanceEl.textContent = 'Dist: --';
        return;
    }

    currentWaypointIndex = index;
    const waypoint = allWaypoints[currentWaypointIndex];

    circles.forEach(c => map.removeLayer(c));
    circles = [];
 // ==================================================================
    // THIS CODE PREVENTS THE ERROR
    // It ensures the distance values are always valid numbers.
    // ==================================================================
    const distA = parseFloat(document.getElementById('dist-a').value) || 0;
    const distB = parseFloat(document.getElementById('dist-b').value) || 0;
    const distC = parseFloat(document.getElementById('dist-c').value) || 0;

    // The application can now safely create circles with these values
    circles.push(L.circle([waypoint.lat, waypoint.lon], { radius: distA, color: 'red', fillOpacity: 0.1 }).addTo(map));
    circles.push(L.circle([waypoint.lat, waypoint.lon], { radius: distB, color: 'yellow', fillOpacity: 0.1 }).addTo(map));
    circles.push(L.circle([waypoint.lat, waypoint.lon], { radius: distC, color: 'green', fillOpacity: 0.2 }).addTo(map));

    map.flyTo([waypoint.lat, waypoint.lon], 15);
    promptedWaypointIndex = -1;
    distanceEl.textContent = 'Dist: Calcolo...';
}


// ---------------------------------
// FUNZIONI DI GEOLOCALIZZAZIONE
// ---------------------------------

function startGpsTracking() {
    const gpsStatusEl = document.getElementById('gps-status');
    if (!navigator.geolocation) {
        gpsStatusEl.textContent = 'Non Supportato';
        return;
    }
    navigator.geolocation.watchPosition(onSuccess, onError, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    gpsStatusEl.textContent = 'Ricerca...';
}

function onSuccess(pos) {
    const { latitude, longitude } = pos.coords;
    const userLatLng = L.latLng(latitude, longitude);
    const gpsStatusEl = document.getElementById('gps-status');
    const distanceEl = document.getElementById('wp-distance');

    if (userMarker) {
        gpsStatusEl.textContent = 'Attivo';
        gpsStatusEl.style.color = 'green';
        userMarker.setLatLng(userLatLng);
    } else {
        userMarker = L.marker(userLatLng, { icon: L.divIcon({ className: 'user-location-dot' }) }).addTo(map).bindPopup("La tua posizione");
        map.setView(userLatLng, 15);
    }

    if (currentWaypointIndex === -1) {
        distanceEl.textContent = 'Dist: --';
        return;
    }
    
    const targetWaypoint = allWaypoints[currentWaypointIndex];
    const targetLatLng = L.latLng(targetWaypoint.lat, targetWaypoint.lon);
    const distanceToTarget = userLatLng.distanceTo(targetLatLng);
    
    distanceEl.textContent = `Dist: ${formatDistance(distanceToTarget)}`;

    const arrivalDistance = parseFloat(document.getElementById('dist-c').value) || 0;
    if (distanceToTarget <= arrivalDistance) {
        markWaypointAsReached();
        return;
    }
    
    checkForNearbyWaypoints(userLatLng);
}

function onError(err) {
    const gpsStatusEl = document.getElementById('gps-status');
    gpsStatusEl.textContent = `Errore (${err.code})`;
    gpsStatusEl.style.color = 'red';
    console.warn(`ERRORE GPS (${err.code}): ${err.message}`);
}

// ---------------------------------
// FUNZIONI DI CONTROLLO E STATO
// ---------------------------------

function markWaypointAsReached() {
    if (currentWaypointIndex === -1) return;

    const reachedWp = allWaypoints[currentWaypointIndex];
    reachedWp.status = 'reached';
    reachedWp.reachedTime = new Date().toISOString();
    reachedWaypointsLog.push(reachedWp);

    stats.reached++;
    stats.remaining--;
    updateStatsUI();

    const nextPendingIndex = allWaypoints.findIndex((wp, index) => index > currentWaypointIndex && wp.status === 'pending');
    setCurrentWaypoint(nextPendingIndex !== -1 ? nextPendingIndex : allWaypoints.length);
}

function skipCurrentWaypoint() {
    if (currentWaypointIndex === -1 || currentWaypointIndex >= allWaypoints.length) {
        alert("Nessun waypoint da saltare.");
        return;
    }

    allWaypoints[currentWaypointIndex].status = 'skipped';
    stats.skipped++;
    stats.remaining--;
    updateStatsUI();

    const nextPendingIndex = allWaypoints.findIndex((wp, index) => index > currentWaypointIndex && wp.status === 'pending');
    setCurrentWaypoint(nextPendingIndex !== -1 ? nextPendingIndex : allWaypoints.length);
}

function updateStatsUI() {
    document.getElementById('wp-total').textContent = stats.total;
    document.getElementById('wp-reached').textContent = stats.reached;
    document.getElementById('wp-remaining').textContent = stats.remaining;
    document.getElementById('wp-skipped').textContent = stats.skipped;
}

function downloadLog() {
    if (reachedWaypointsLog.length === 0) {
        alert("Nessun waypoint raggiunto da scaricare.");
        return;
    }
    const logData = JSON.stringify(reachedWaypointsLog, null, 2);
    const blob = new Blob([logData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log_waypoints_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
// ---------------------------------------------------
// WAKE LOCK, SWITCH INTELLIGENTE E FORMATTAZIONE
// ---------------------------------------------------

function formatDistance(meters) {
    if (meters >= 1000) {
        return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
}

async function toggleWakeLock() {
    const button = document.getElementById('wakelock-btn');
    if (!('wakeLock' in navigator)) {
        alert('La funzione Wake Lock non è supportata su questo browser.');
        button.disabled = true;
        return;
    }

    if (wakeLock !== null) {
        await wakeLock.release();
        wakeLock = null;
        button.textContent = 'Tieni Schermo Acceso';
        button.style.backgroundColor = '';
    } else {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            button.textContent = 'Schermo Attivo';
            button.style.backgroundColor = '#28a745';
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
                button.textContent = 'Tieni Schermo Acceso';
                button.style.backgroundColor = '';
            });
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
            alert(`Impossibile attivare il Wake Lock: ${err.message}`);
        }
    }
}

function checkForNearbyWaypoints(userLatLng) {
    const proximityThreshold = parseFloat(document.getElementById('dist-c').value) || 0;
    
    let closestFutureWp = { index: -1, distance: Infinity };

    allWaypoints.forEach((wp, index) => {
        if (wp.status === 'pending' && index !== currentWaypointIndex) {
            const distance = userLatLng.distanceTo(L.latLng(wp.lat, wp.lon));
            if (distance < closestFutureWp.distance) {
                closestFutureWp = { index: index, distance: distance, name: wp.name };
            }
        }
    });

    if (closestFutureWp.index !== -1 && closestFutureWp.distance <= proximityThreshold && closestFutureWp.index !== promptedWaypointIndex) {
        showWaypointSwitchPrompt(closestFutureWp.index, closestFutureWp.name);
    }
}

function showWaypointSwitchPrompt(newWpIndex, newWpName) {
    promptedWaypointIndex = newWpIndex;
    
    const promptEl = document.getElementById('wp-prompt');
    const messageEl = document.getElementById('prompt-message');
    const timerEl = document.getElementById('prompt-timer');
    
    messageEl.textContent = `Sei vicino a "${newWpName}". Vuoi impostarlo come prossimo?`;
    promptEl.classList.remove('hidden');

    let countdown = 15;
    timerEl.textContent = `Decisione automatica in ${countdown}s...`;

    promptInterval = setInterval(() => {
        countdown--;
        timerEl.textContent = `Decisione automatica in ${countdown}s...`;
    }, 1000);

    promptTimeout = setTimeout(() => {
        clearInterval(promptInterval);
        handleSwitchResponse(true);
    }, 15000);
}

function handleSwitchResponse(shouldSwitch) {
    clearTimeout(promptTimeout);
    clearInterval(promptInterval);
    document.getElementById('wp-prompt').classList.add('hidden');

    if (shouldSwitch) {
        const newIndex = promptedWaypointIndex;
        const oldIndex = currentWaypointIndex;

        if (newIndex === -1 || oldIndex === -1) return;

        [allWaypoints[oldIndex], allWaypoints[newIndex]] = [allWaypoints[newIndex], allWaypoints[oldIndex]];
        
        setCurrentWaypoint(oldIndex);
    }
}