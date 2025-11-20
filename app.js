/**
 * RaceTracker Application
 * Refactored for better modularity and performance.
 */

class RaceTracker {
    constructor() {
        // State
        this.map = null;
        this.allWaypoints = [];
        this.waypointMarkers = [];
        this.reachedWaypointsLog = [];
        this.currentWaypointIndex = -1;
        this.stats = { total: 0, reached: 0, remaining: 0, skipped: 0 };
        this.userMarker = null;
        this.circles = [];
        this.watchId = null;

        // DOM Elements
        this.ui = {
            gpxInput: document.getElementById('gpx-file'),
            skipBtn: document.getElementById('skip-wp-btn'),
            downloadBtn: document.getElementById('download-log-btn'),
            collapsibleHeader: document.querySelector('.collapsible-header'),
            distA: document.getElementById('dist-a'),
            distB: document.getElementById('dist-b'),
            distC: document.getElementById('dist-c'),
            stats: {
                total: document.getElementById('wp-total'),
                reached: document.getElementById('wp-reached'),
                remaining: document.getElementById('wp-remaining'),
                skipped: document.getElementById('wp-skipped')
            }
        };

        this.init();
    }

    init() {
        this.initMap();
        this.addEventListeners();
        this.startGpsTracking();
    }

    initMap() {
        this.map = L.map('map').setView([41.9028, 12.4964], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
    }

    addEventListeners() {
        this.ui.gpxInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.ui.skipBtn.addEventListener('click', () => this.skipCurrentWaypoint());
        this.ui.downloadBtn.addEventListener('click', () => this.downloadLog());

        this.ui.collapsibleHeader.addEventListener('click', function () {
            this.classList.toggle('active');
            const content = this.nextElementSibling;
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const gpxData = e.target.result;
                const gpx = new gpxParser();
                gpx.parse(gpxData);

                if (gpx.waypoints && gpx.waypoints.length > 0) {
                    this.allWaypoints = gpx.waypoints.map(wp => ({
                        lat: wp.lat,
                        lon: wp.lon,
                        name: wp.name || 'Waypoint',
                        time: wp.time,
                        ele: wp.ele
                    }));

                    this.resetState();
                    this.stats.total = this.allWaypoints.length;
                    this.stats.remaining = this.allWaypoints.length;
                    this.updateStatsUI();
                    this.drawAllWaypoints();
                    this.setCurrentWaypoint(0);
                } else {
                    this.handleGpxError(gpx);
                }
            } catch (error) {
                console.error("GPX Parse Error:", error);
                alert("Error parsing GPX file. See console for details.");
            }
        };
        reader.readAsText(file);
    }

    handleGpxError(gpx) {
        if (gpx && gpx.tracks && gpx.tracks.length > 0) {
            alert("GPX contains tracks but no waypoints. This app requires waypoints (<wpt>).");
        } else {
            alert("No valid waypoints found in GPX file.");
        }
    }

    drawAllWaypoints() {
        this.allWaypoints.forEach(wp => {
            const marker = L.marker([wp.lat, wp.lon])
                .addTo(this.map)
                .bindPopup(`<b>${wp.name}</b><br>Ele: ${wp.ele || 'N/A'} m`);
            this.waypointMarkers.push(marker);
        });
    }

    resetState() {
        this.stats = { total: 0, reached: 0, remaining: 0, skipped: 0 };
        this.reachedWaypointsLog = [];
        this.currentWaypointIndex = -1;

        this.circles.forEach(c => this.map.removeLayer(c));
        this.circles = [];

        this.waypointMarkers.forEach(m => this.map.removeLayer(m));
        this.waypointMarkers = [];

        this.updateStatsUI();
    }

    setCurrentWaypoint(index) {
        if (index >= this.allWaypoints.length) {
            alert("All waypoints reached! Good job!");
            this.currentWaypointIndex = -1;
            this.circles.forEach(c => this.map.removeLayer(c));
            this.circles = [];
            return;
        }

        this.currentWaypointIndex = index;
        const waypoint = this.allWaypoints[this.currentWaypointIndex];

        this.circles.forEach(c => this.map.removeLayer(c));
        this.circles = [];

        const distA = this.ui.distA.value;
        const distB = this.ui.distB.value;
        const distC = this.ui.distC.value;

        const redCircle = L.circle([waypoint.lat, waypoint.lon], { radius: distA, color: 'red', fillOpacity: 0.1 }).addTo(this.map);
        const yellowCircle = L.circle([waypoint.lat, waypoint.lon], { radius: distB, color: 'yellow', fillOpacity: 0.1 }).addTo(this.map);
        const greenCircle = L.circle([waypoint.lat, waypoint.lon], { radius: distC, color: 'green', fillOpacity: 0.2 }).addTo(this.map);

        this.circles.push(redCircle, yellowCircle, greenCircle);
        this.map.flyTo([waypoint.lat, waypoint.lon], 15);
    }

    startGpsTracking() {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }
        const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
        this.watchId = navigator.geolocation.watchPosition(
            (pos) => this.onLocationSuccess(pos),
            (err) => this.onLocationError(err),
            options
        );
    }

    onLocationSuccess(pos) {
        const { latitude, longitude } = pos.coords;
        const userLatLng = L.latLng(latitude, longitude);

        if (this.userMarker) {
            this.userMarker.setLatLng(userLatLng);
        } else {
            this.userMarker = L.marker(userLatLng, {
                icon: L.divIcon({ className: 'user-location-dot' })
            }).addTo(this.map).bindPopup("You are here");
            this.map.setView(userLatLng, 15);
        }

        this.checkProximity(userLatLng);
    }

    checkProximity(userLatLng) {
        if (this.currentWaypointIndex === -1) return;

        const targetWaypoint = this.allWaypoints[this.currentWaypointIndex];
        const targetLatLng = L.latLng(targetWaypoint.lat, targetWaypoint.lon);
        const distance = userLatLng.distanceTo(targetLatLng);
        const arrivalDistance = this.ui.distC.value;

        if (distance <= arrivalDistance) {
            this.markWaypointAsReached();
        }
    }

    onLocationError(err) {
        console.warn(`GPS Error (${err.code}): ${err.message}`);
    }

    markWaypointAsReached() {
        const reachedWp = this.allWaypoints[this.currentWaypointIndex];
        reachedWp.reachedTime = new Date().toISOString();
        this.reachedWaypointsLog.push(reachedWp);

        this.stats.reached++;
        this.stats.remaining--;
        this.updateStatsUI();

        // Optional: Play a sound or vibrate here
        if (navigator.vibrate) navigator.vibrate(200);

        this.setCurrentWaypoint(this.currentWaypointIndex + 1);
    }

    skipCurrentWaypoint() {
        if (this.currentWaypointIndex === -1 || this.currentWaypointIndex >= this.allWaypoints.length) {
            return;
        }

        this.stats.skipped++;
        this.stats.remaining--;
        this.updateStatsUI();
        this.setCurrentWaypoint(this.currentWaypointIndex + 1);
    }

    updateStatsUI() {
        this.ui.stats.total.textContent = this.stats.total;
        this.ui.stats.reached.textContent = this.stats.reached;
        this.ui.stats.remaining.textContent = this.stats.remaining;
        this.ui.stats.skipped.textContent = this.stats.skipped;
    }

    downloadLog() {
        if (this.reachedWaypointsLog.length === 0) {
            alert("No waypoints reached yet.");
            return;
        }
        const logData = JSON.stringify(this.reachedWaypointsLog, null, 2);
        const blob = new Blob([logData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');

        a.href = url;
        a.download = `race_log_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RaceTracker();
});