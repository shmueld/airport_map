/* ============================================
   Airport Route Explorer — Application Logic
   ============================================ */

(function () {
    'use strict';

    // --- Constants ---
    const DATA_URL = 'https://raw.githubusercontent.com/Jonty/airline-route-data/refs/heads/main/airline_routes.json';

    const CONTINENT_NAMES = {
        AF: 'Africa',
        AN: 'Antarctica',
        AS: 'Asia',
        EU: 'Europe',
        NA: 'North America',
        OC: 'Oceania',
        SA: 'South America',
    };

    // --- State ---
    let airportsData = {};       // raw JSON keyed by IATA
    let inboundMap = {};         // IATA -> [{fromIata, carriers, km, min}]
    let map = null;
    let markerCluster = null;
    let routeLinesLayer = null;
    let selectedAirportIata = null;
    let activeTab = 'outbound';
    let airportMarkers = {};     // IATA -> L.circleMarker

    // --- DOM Refs ---
    const $loading = document.getElementById('loading-overlay');
    const $searchInput = document.getElementById('search-input');
    const $searchClear = document.getElementById('search-clear');
    const $searchResults = document.getElementById('search-results');
    const $statsText = document.getElementById('stats-text');
    const $panel = document.getElementById('side-panel');
    const $panelClose = document.getElementById('panel-close');
    const $panelAirportName = document.getElementById('panel-airport-name');
    const $panelLocation = document.getElementById('panel-airport-location');
    const $panelCodes = document.getElementById('panel-codes');
    const $panelElevation = document.getElementById('panel-elevation');
    const $panelTimezone = document.getElementById('panel-timezone');
    const $panelContinent = document.getElementById('panel-continent');
    const $outboundCount = document.getElementById('outbound-count');
    const $inboundCount = document.getElementById('inbound-count');
    const $routesList = document.getElementById('routes-list');
    const $tabOutbound = document.getElementById('tab-outbound');
    const $tabInbound = document.getElementById('tab-inbound');

    // --- Init ---
    async function init() {
        initMap();
        await loadData();
        buildInboundMap();
        createMarkers();
        hideLoading();
        initSearch();
        initPanel();
        lucide.createIcons();
        updateStats();
    }

    // --- Map ---
    function initMap() {
        map = L.map('map', {
            center: [30, 20],
            zoom: 3,
            minZoom: 2,
            maxZoom: 18,
            zoomControl: true,
            worldCopyJump: true,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20,
        }).addTo(map);

        routeLinesLayer = L.layerGroup().addTo(map);
    }

    // --- Data ---
    async function loadData() {
        try {
            const resp = await fetch(DATA_URL);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            airportsData = await resp.json();
        } catch (err) {
            console.error('Failed to load airport data:', err);
            document.querySelector('.loading-text').textContent = 'Failed to load data. Please refresh.';
        }
    }

    function buildInboundMap() {
        inboundMap = {};
        for (const [iata, airport] of Object.entries(airportsData)) {
            if (!airport.routes) continue;
            for (const route of airport.routes) {
                if (!inboundMap[route.iata]) {
                    inboundMap[route.iata] = [];
                }
                inboundMap[route.iata].push({
                    fromIata: iata,
                    carriers: route.carriers || [],
                    km: route.km,
                    min: route.min,
                });
            }
        }
    }

    // --- Markers ---
    function createMarkers() {
        markerCluster = L.markerClusterGroup({
            maxClusterRadius: 45,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            chunkedLoading: true,
            chunkInterval: 100,
            chunkDelay: 10,
        });

        for (const [iata, airport] of Object.entries(airportsData)) {
            const lat = parseFloat(airport.latitude);
            const lng = parseFloat(airport.longitude);
            if (isNaN(lat) || isNaN(lng)) continue;

            const marker = L.circleMarker([lat, lng], {
                radius: 5,
                fillColor: '#a3a3a3',
                fillOpacity: 0.7,
                color: '#737373',
                weight: 1,
            });

            marker.bindTooltip(
                `<strong>${airport.iata}</strong> — ${airport.name}`,
                { direction: 'top', offset: [0, -6], className: '' }
            );

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);
                selectAirport(iata);
            });
            marker.airportIata = iata;
            airportMarkers[iata] = marker;
            markerCluster.addLayer(marker);
        }

        map.addLayer(markerCluster);
    }

    // --- Stats ---
    function updateStats() {
        const count = Object.keys(airportsData).length;
        let totalRoutes = 0;
        for (const airport of Object.values(airportsData)) {
            totalRoutes += (airport.routes || []).length;
        }
        $statsText.textContent = `${count.toLocaleString()} airports · ${totalRoutes.toLocaleString()} routes`;
    }

    // --- Loading ---
    function hideLoading() {
        $loading.classList.add('hidden');
    }

    // --- Search ---
    function initSearch() {
        let debounceTimer;

        $searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            const query = $searchInput.value.trim();
            $searchClear.classList.toggle('visible', query.length > 0);

            if (query.length < 2) {
                $searchResults.classList.remove('visible');
                $searchResults.innerHTML = '';
                return;
            }

            debounceTimer = setTimeout(() => performSearch(query), 200);
        });

        $searchClear.addEventListener('click', () => {
            $searchInput.value = '';
            $searchClear.classList.remove('visible');
            $searchResults.classList.remove('visible');
            $searchResults.innerHTML = '';
            $searchInput.focus();
        });

        // Close results on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#search-container')) {
                $searchResults.classList.remove('visible');
            }
        });
    }

    function performSearch(query) {
        const q = query.toLowerCase();
        const results = [];

        for (const [iata, airport] of Object.entries(airportsData)) {
            if (results.length >= 20) break;

            const matchIata = iata.toLowerCase().includes(q);
            const matchName = airport.name.toLowerCase().includes(q);
            const matchCity = airport.city_name.toLowerCase().includes(q);
            const matchCountry = airport.country.toLowerCase().includes(q);

            if (matchIata || matchName || matchCity || matchCountry) {
                // Priority: exact IATA match first
                const priority = (iata.toLowerCase() === q) ? 0 : (matchIata ? 1 : 2);
                results.push({ iata, airport, priority });
            }
        }

        results.sort((a, b) => a.priority - b.priority);

        if (results.length === 0) {
            $searchResults.innerHTML = '<li class="no-results" style="padding:16px;color:#a3a3a3;text-align:center;cursor:default;">No airports found</li>';
            $searchResults.classList.add('visible');
            return;
        }

        $searchResults.innerHTML = results.map(({ iata, airport }) => `
            <li data-iata="${iata}">
                <span class="result-iata">${iata}</span>
                <div class="result-info">
                    <span class="result-name">${airport.name}</span>
                    <span class="result-location">${airport.city_name}, ${airport.country}</span>
                </div>
            </li>
        `).join('');

        $searchResults.querySelectorAll('li[data-iata]').forEach(li => {
            li.addEventListener('click', () => {
                const iata = li.dataset.iata;
                $searchResults.classList.remove('visible');
                $searchInput.value = '';
                $searchClear.classList.remove('visible');
                selectAirport(iata);
            });
        });

        $searchResults.classList.add('visible');
    }

    // --- Airport Selection ---
    function selectAirport(iata) {
        const airport = airportsData[iata];
        if (!airport) return;

        selectedAirportIata = iata;
        activeTab = 'outbound';

        // Reset previously selected marker
        for (const m of Object.values(airportMarkers)) {
            m.setStyle({ fillColor: '#a3a3a3', color: '#737373', radius: 5, fillOpacity: 0.7 });
        }

        // Highlight selected
        const selectedMarker = airportMarkers[iata];
        if (selectedMarker) {
            selectedMarker.setStyle({
                fillColor: '#d97706',
                color: '#d97706',
                radius: 8,
                fillOpacity: 1,
            });
        }

        // Pan map
        const lat = parseFloat(airport.latitude);
        const lng = parseFloat(airport.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
            map.flyTo([lat, lng], Math.max(map.getZoom(), 5), { duration: 0.8 });
        }

        // Draw route lines
        drawRouteLines(iata, airport);

        // Populate panel
        populatePanel(iata, airport);
        openPanel();
    }

    // --- Route Lines ---
    function drawRouteLines(iata, airport) {
        routeLinesLayer.clearLayers();

        const srcLat = parseFloat(airport.latitude);
        const srcLng = parseFloat(airport.longitude);
        if (isNaN(srcLat) || isNaN(srcLng)) return;

        // Collect all destination IATAs (outbound + inbound)
        const destinations = new Set();

        if (airport.routes) {
            for (const route of airport.routes) {
                destinations.add(route.iata);
            }
        }

        if (inboundMap[iata]) {
            for (const inRoute of inboundMap[iata]) {
                destinations.add(inRoute.fromIata);
            }
        }

        for (const destIata of destinations) {
            const dest = airportsData[destIata];
            if (!dest) continue;

            const dstLat = parseFloat(dest.latitude);
            const dstLng = parseFloat(dest.longitude);
            if (isNaN(dstLat) || isNaN(dstLng)) continue;

            const line = createCurvedLine(
                [srcLat, srcLng],
                [dstLat, dstLng]
            );
            line.destIata = destIata;
            line.on('click', (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);
                highlightRoute(destIata);
            });
            routeLinesLayer.addLayer(line);
        }
    }

    function createCurvedLine(from, to) {
        // Approximate a curved line with intermediate points
        const points = [];
        const numPoints = 30;

        const latDiff = to[0] - from[0];
        const lngDiff = to[1] - from[1];
        const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

        // Curve offset perpendicular to the line
        const offset = Math.min(distance * 0.2, 15);

        for (let i = 0; i <= numPoints; i++) {
            const t = i / numPoints;
            const lat = from[0] + latDiff * t;
            const lng = from[1] + lngDiff * t;

            // Parabolic arc
            const arc = offset * Math.sin(Math.PI * t);

            // Perpendicular direction
            const perpLat = -lngDiff / (distance || 1);
            const perpLng = latDiff / (distance || 1);

            points.push([lat + perpLat * arc, lng + perpLng * arc]);
        }

        return L.polyline(points, {
            color: '#d97706',
            weight: 1.8,
            opacity: 0.45,
            smoothFactor: 1,
        });
    }

    function highlightRoute(destIata) {
        // Highlight a specific route line and scroll to it in the panel
        routeLinesLayer.eachLayer((layer) => {
            if (layer.destIata === destIata) {
                layer.setStyle({ weight: 3.5, opacity: 0.9, color: '#d97706' });
                layer.bringToFront();
            } else {
                layer.setStyle({ weight: 1.8, opacity: 0.3, color: '#a3a3a3' });
            }
        });

        // Highlight matching route card
        document.querySelectorAll('.route-card').forEach(card => {
            card.classList.toggle('highlighted', card.dataset.iata === destIata);
        });

        // Scroll card into view
        const target = document.querySelector(`.route-card[data-iata="${destIata}"]`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // --- Panel ---
    function initPanel() {
        $panelClose.addEventListener('click', closePanel);

        $tabOutbound.addEventListener('click', () => {
            activeTab = 'outbound';
            $tabOutbound.classList.add('active');
            $tabInbound.classList.remove('active');
            renderRoutesList();
        });

        $tabInbound.addEventListener('click', () => {
            activeTab = 'inbound';
            $tabInbound.classList.add('active');
            $tabOutbound.classList.remove('active');
            renderRoutesList();
        });

        // Close panel on map click (not on marker)
        map.on('click', () => {
            if ($panel.classList.contains('open')) {
                closePanel();
            }
        });
    }

    function openPanel() {
        $panel.classList.add('open');

        // Re-initialize Lucide icons in dynamic content
        setTimeout(() => lucide.createIcons(), 50);
    }

    function closePanel() {
        $panel.classList.remove('open');
        routeLinesLayer.clearLayers();
        selectedAirportIata = null;

        // Reset marker styles
        for (const m of Object.values(airportMarkers)) {
            m.setStyle({ fillColor: '#a3a3a3', color: '#737373', radius: 5, fillOpacity: 0.7 });
        }
    }

    function populatePanel(iata, airport) {
        $panelAirportName.textContent = airport.name;
        $panelLocation.textContent = `${airport.city_name}, ${airport.country}`;
        $panelCodes.textContent = `${airport.iata}${airport.icao ? ' / ' + airport.icao : ''}`;
        $panelElevation.textContent = `${airport.elevation != null ? airport.elevation + ' m' : '—'}`;
        $panelTimezone.textContent = airport.timezone || '—';
        $panelContinent.textContent = CONTINENT_NAMES[airport.continent] || airport.continent || '—';

        const outbound = airport.routes || [];
        const inbound = inboundMap[iata] || [];

        $outboundCount.textContent = outbound.length;
        $inboundCount.textContent = inbound.length;

        // Reset to outbound tab
        activeTab = 'outbound';
        $tabOutbound.classList.add('active');
        $tabInbound.classList.remove('active');

        renderRoutesList();
    }

    function renderRoutesList() {
        if (!selectedAirportIata) return;

        const airport = airportsData[selectedAirportIata];
        if (!airport) return;

        let routes;
        if (activeTab === 'outbound') {
            routes = (airport.routes || []).map(r => ({
                destIata: r.iata,
                carriers: r.carriers || [],
                km: r.km,
                min: r.min,
            }));
        } else {
            routes = (inboundMap[selectedAirportIata] || []).map(r => ({
                destIata: r.fromIata,
                carriers: r.carriers || [],
                km: r.km,
                min: r.min,
            }));
        }

        if (routes.length === 0) {
            $routesList.innerHTML = `
                <div class="no-routes">
                    <i data-lucide="plane-off"></i>
                    <p>No ${activeTab} routes found</p>
                </div>
            `;
            setTimeout(() => lucide.createIcons(), 50);
            return;
        }

        // Sort by distance
        routes.sort((a, b) => (a.km || 0) - (b.km || 0));

        $routesList.innerHTML = routes.map(route => {
            const dest = airportsData[route.destIata];
            const destName = dest ? dest.name : route.destIata;
            const destCity = dest ? `${dest.city_name}, ${dest.country}` : '';
            const duration = formatDuration(route.min);
            const distance = route.km ? `${route.km.toLocaleString()} km` : '—';

            const carrierBadges = route.carriers.length > 0
                ? route.carriers.map(c =>
                    `<span class="carrier-badge"><span class="carrier-code">${c.iata}</span> ${c.name}</span>`
                ).join('')
                : '<span class="carrier-badge" style="color: #a3a3a3;">Unknown carrier</span>';

            return `
                <div class="route-card" data-iata="${route.destIata}">
                    <div class="route-card-header">
                        <div class="route-destination">
                            <span class="route-iata-badge">${route.destIata}</span>
                            <span class="route-dest-name" title="${destName}${destCity ? ' — ' + destCity : ''}">${destName}</span>
                        </div>
                        <div class="route-stats">
                            <span class="route-stat">
                                <i data-lucide="ruler"></i>
                                ${distance}
                            </span>
                            <span class="route-stat">
                                <i data-lucide="clock"></i>
                                ${duration}
                            </span>
                        </div>
                    </div>
                    <div class="route-carriers">${carrierBadges}</div>
                </div>
            `;
        }).join('');

        // Add click handlers
        $routesList.querySelectorAll('.route-card').forEach(card => {
            card.addEventListener('click', () => {
                const destIata = card.dataset.iata;
                highlightRoute(destIata);

                // Pan to show both airports
                const dest = airportsData[destIata];
                const src = airportsData[selectedAirportIata];
                if (dest && src) {
                    const bounds = L.latLngBounds(
                        [parseFloat(src.latitude), parseFloat(src.longitude)],
                        [parseFloat(dest.latitude), parseFloat(dest.longitude)]
                    );
                    map.flyToBounds(bounds.pad(0.3), { duration: 0.8 });
                }
            });
        });

        setTimeout(() => lucide.createIcons(), 50);
    }

    // --- Utilities ---
    function formatDuration(minutes) {
        if (!minutes) return '—';
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (h === 0) return `${m}m`;
        return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
    }

    // --- Boot ---
    document.addEventListener('DOMContentLoaded', init);
})();
