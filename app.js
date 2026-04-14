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

    const CONTINENT_NAMES_HE = {
        AF: 'אפריקה',
        AN: 'אנטארקטיקה',
        AS: 'אסיה',
        EU: 'אירופה',
        NA: 'צפון אמריקה',
        OC: 'אוקיאניה',
        SA: 'דרום אמריקה',
    };

    // --- Translations ---
    const i18n = {
        en: {
            loading: 'Loading airport data...',
            legendTitle: 'Legend',
            legendDomestic: 'Domestic',
            legendInternational: 'International',
            legendRoutes: 'Routes',
            searchPlaceholder: 'Search airports by name, city, or IATA code...',
            statsLoading: 'Loading...',
            statsAction: 'View Data',
            statsTitle: 'Global Aviation Statistics',
            statsConnected: 'Most Connected Airports',
            statsConnectedTitle: 'Airports with the highest number of direct outbound flight destinations.',
            statsHubs: 'Top Carrier Hubs',
            statsHubsTitle: 'Airports hosting the highest number of distinct airlines operating inbound and outbound flights.',
            statsAirlines: 'Top Global Airlines',
            statsAirlinesTitle: 'Airlines that operate the highest number of unique flight routes globally (not the number of planes or frequency).',
            statsRecords: 'Notable Records',
            recordLongest: 'Longest Flight',
            recordShortest: 'Shortest Flight',
            recordBusiest: 'Busiest Route (Competing Airlines)',
            metaCodes: 'IATA / ICAO',
            metaElevation: 'Elevation',
            metaTimezone: 'Timezone',
            metaContinent: 'Continent',
            tabOutbound: 'Outbound',
            tabInbound: 'Inbound',
            routeSearchPlaceholder: 'Filter routes by city, IATA or airline...',
            noRoutes: 'No {tab} routes found',
            noResults: 'No airports found',
            statsText: '{count} airports · {routes} routes'
        },
        he: {
            loading: 'טוען נתוני שדות תעופה...',
            legendTitle: 'מקרא',
            legendDomestic: 'מקומי',
            legendInternational: 'בינלאומי',
            legendRoutes: 'מסלולים',
            searchPlaceholder: 'חפש שדות תעופה לפי שם, עיר או קוד IATA...',
            statsLoading: 'טוען...',
            statsAction: 'הצג נתונים',
            statsTitle: 'סטטיסטיקות תעופה גלובליות',
            statsConnected: 'שדות התעופה המחוברים ביותר',
            statsConnectedTitle: 'שדות תעופה עם המספר הגבוה ביותר של יעדי טיסות יוצאות ישירות.',
            statsHubs: 'האבים מובילים של חברות תעופה',
            statsHubsTitle: 'שדות תעופה המארחים את המספר הגבוה ביותר של חברות תעופה שונות.',
            statsAirlines: 'חברות התעופה הגלובליות המובילות',
            statsAirlinesTitle: 'חברות התעופה המפעילות את מספר מסלולי הטיסה הייחודיים הגבוה ביותר בעולם.',
            statsRecords: 'שיאים בולטים',
            recordLongest: 'הטיסה הארוכה ביותר',
            recordShortest: 'הטיסה הקצרה ביותר',
            recordBusiest: 'המסלול העמוס ביותר (חברות מתחרות)',
            metaCodes: 'IATA / ICAO',
            metaElevation: 'גובה',
            metaTimezone: 'אזור זמן',
            metaContinent: 'יבשת',
            tabOutbound: 'המראות',
            tabInbound: 'נחיתות',
            routeSearchPlaceholder: 'סנן מסלולים לפי עיר, IATA או חברה...',
            noRoutes: 'לא נמצאו מסלולי {tab}',
            noResults: 'לא נמצאו שדות תעופה',
            statsText: '{count} שדות תעופה · {routes} מסלולים'
        }
    };

    // --- State ---
    let currentLang = 'en';
    let translatedAirports = {}; // Cache for dynamically fetched Wikidata names
    let airportsData = {};       // raw JSON keyed by IATA
    let inboundMap = {};         // IATA -> [{fromIata, carriers, km, min}]
    let map = null;
    let markerCluster = null;
    let routeLinesLayer = null;
    let selectedAirportIata = null;
    let activeTab = 'outbound';
    let airportMarkers = {};     // IATA -> L.Marker
    let selectedMarkerInstance = null;

    // --- Icons ---
    const ICONS = {
        local: { sm: null, md: null, lg: null },
        intl: { sm: null, md: null, lg: null }
    };
    const SIZES = { sm: 8, md: 12, lg: 16 };
    const SIZES_SELECTED = { sm: 14, md: 18, lg: 22 };

    function initIcons() {
        for (const type of ['local', 'intl']) {
            for (const size of ['sm', 'md', 'lg']) {
                const s = SIZES[size];
                const selectedS = SIZES_SELECTED[size];
                ICONS[type][size] = {
                    default: L.divIcon({
                        className: `airport-marker-icon ${type} ${size}`,
                        iconSize: [s, s],
                        iconAnchor: [s / 2, s / 2]
                    }),
                    selected: L.divIcon({
                        className: `airport-marker-icon selected ${type} ${size}`,
                        iconSize: [selectedS, selectedS],
                        iconAnchor: [selectedS / 2, selectedS / 2]
                    })
                };
            }
        }
    }

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
    const $routeSearchInput = document.getElementById('route-search-input');
    const $statsBadge = document.getElementById('stats-badge');
    const $statsOverlay = document.getElementById('stats-overlay');
    const $statsClose = document.getElementById('stats-close');
    const $langEnBtn = document.getElementById('lang-en');
    const $langHeBtn = document.getElementById('lang-he');

    function t(key, vars = {}) {
        let str = i18n[currentLang][key] || key;
        for (const [k, v] of Object.entries(vars)) {
            str = str.replace(`{${k}}`, v);
        }
        return str;
    }

    function updateDOMTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = t(key);
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = t(key);
        });
        $searchInput.placeholder = t('searchPlaceholder');
        $routeSearchInput.placeholder = t('routeSearchPlaceholder');

        if (currentLang === 'he') {
            document.body.setAttribute('dir', 'rtl');
            document.body.classList.add('rtl-mode');
        } else {
            document.body.removeAttribute('dir');
            document.body.classList.remove('rtl-mode');
        }

        // Update active content
        updateStats();
        if (selectedAirportIata) {
            populatePanel(selectedAirportIata, airportsData[selectedAirportIata]);
        }
    }

    function initLanguageToggle() {
        $langEnBtn.addEventListener('click', () => {
            currentLang = 'en';
            $langEnBtn.classList.add('active');
            $langHeBtn.classList.remove('active');
            updateDOMTranslations();
        });
        $langHeBtn.addEventListener('click', () => {
            currentLang = 'he';
            $langHeBtn.classList.add('active');
            $langEnBtn.classList.remove('active');
            updateDOMTranslations();
        });
    }

    // --- Dynamic API Fetching ---
    async function fetchHebrewDetails(iata) {
        if (translatedAirports[iata]) return translatedAirports[iata];

        const query = `
            SELECT ?airportLabel ?cityLabel WHERE {
              ?airport wdt:P238 "${iata}".
              OPTIONAL { ?airport wdt:P131 ?city. }
              SERVICE wikibase:label { bd:serviceParam wikibase:language "he,en". }
            } LIMIT 1
        `;
        const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json&origin=*`;

        try {
            const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (res.ok) {
                const data = await res.json();
                const bindings = data.results.bindings[0];
                if (bindings) {
                    const result = {
                        airportHe: bindings.airportLabel?.value || null,
                        cityHe: bindings.cityLabel?.value || null
                    };
                    // Only cache if it's actually hebrew
                    if (result.airportHe && /[\u0590-\u05FF]/.test(result.airportHe)) {
                        translatedAirports[iata] = result;
                        return result;
                    }
                }
            }
        } catch (e) {
            console.warn('Silent Wikidata fetch failure for ' + iata);
        }
        translatedAirports[iata] = { airportHe: null, cityHe: null }; // cache null to prevent refetch
        return translatedAirports[iata];
    }

    // --- Init ---
    async function init() {
        initIcons();
        initMap();
        initLanguageToggle();
        updateDOMTranslations();
        await loadData();
        buildInboundMap();
        createMarkers();
        hideLoading();
        initSearch();
        initPanel();
        initStatsOverlay();
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

    function getAirportStats(iata, airport) {
        let isIntl = false;
        let totalRoutes = 0;
        const myCountry = airport.country_code;

        if (airport.routes) {
            totalRoutes += airport.routes.length;
            if (!isIntl) {
                for (const r of airport.routes) {
                    const dest = airportsData[r.iata];
                    if (dest && dest.country_code !== myCountry) {
                        isIntl = true;
                        break;
                    }
                }
            }
        }

        if (inboundMap[iata]) {
            totalRoutes += inboundMap[iata].length;
            if (!isIntl) {
                for (const r of inboundMap[iata]) {
                    const dest = airportsData[r.fromIata];
                    if (dest && dest.country_code !== myCountry) {
                        isIntl = true;
                        break;
                    }
                }
            }
        }

        let sizeCategory = 'sm';
        if (totalRoutes >= 50) sizeCategory = 'lg';
        else if (totalRoutes >= 15) sizeCategory = 'md';

        return { isIntl, sizeCategory };
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

            const { isIntl, sizeCategory } = getAirportStats(iata, airport);
            const type = isIntl ? 'intl' : 'local';

            const marker = L.marker([lat, lng], {
                icon: ICONS[type][sizeCategory].default
            });

            marker.bindTooltip(
                `<strong>${airport.iata}</strong> — ${airport.name}`,
                { direction: 'top', offset: [0, -6], className: '' }
            );

            marker.on('mouseover', async () => {
                let text = `<strong>${airport.iata}</strong> — ${airport.name}`;
                if (currentLang === 'he') {
                    const cached = translatedAirports[iata];
                    if (cached && cached.airportHe) {
                        text += ` - ${cached.airportHe}`;
                    } else {
                        // Optimistically update after fetching
                        fetchHebrewDetails(iata).then(heData => {
                            if (heData && heData.airportHe && currentLang === 'he') {
                                marker.setTooltipContent(`<strong>${airport.iata}</strong> — ${airport.name} - ${heData.airportHe}`);
                            }
                        });
                    }
                }
                marker.setTooltipContent(text);
            });

            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e.originalEvent);
                selectAirport(iata);
            });
            marker.airportIata = iata;
            marker.airportType = type;
            marker.airportSize = sizeCategory;
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
        $statsText.textContent = t('statsText', {
            count: count.toLocaleString(),
            routes: totalRoutes.toLocaleString()
        });
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
            $searchResults.innerHTML = `<li class="no-results" style="padding:16px;color:#a3a3a3;text-align:center;cursor:default;">${t('noResults')}</li>`;
            $searchResults.classList.add('visible');
            return;
        }

        $searchResults.innerHTML = results.map(({ iata, airport }) => {
            const cached = translatedAirports[iata];
            const nameDisplay = currentLang === 'he' && cached && cached.airportHe ? `${airport.name} - ${cached.airportHe}` : airport.name;
            const cityDisplay = currentLang === 'he' && cached && cached.cityHe ? `${airport.city_name} - ${cached.cityHe}` : airport.city_name;

            return `
            <li data-iata="${iata}">
                <span class="result-iata">${iata}</span>
                <div class="result-info">
                    <span class="result-name">${nameDisplay}</span>
                    <span class="result-location">${cityDisplay}, ${airport.country}</span>
                </div>
            </li>
            `;
        }).join('');

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
        if (selectedMarkerInstance) {
            selectedMarkerInstance.setIcon(ICONS[selectedMarkerInstance.airportType][selectedMarkerInstance.airportSize].default);
        }

        // Highlight selected
        selectedMarkerInstance = airportMarkers[iata];
        if (selectedMarkerInstance) {
            selectedMarkerInstance.setIcon(ICONS[selectedMarkerInstance.airportType][selectedMarkerInstance.airportSize].selected);
        }

        // Pan map
        const lat = parseFloat(airport.latitude);
        const lng = parseFloat(airport.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
            map.flyTo([lat, lng], Math.max(map.getZoom(), 5), { duration: 0.8 });
        }

        // Draw route lines
        drawRouteLines(iata, airport);

        // Fetch Hebrew names dynamically and populate
        fetchHebrewDetails(iata).then((heData) => {
            populatePanel(iata, airport, heData);
        });

        // Populate panel initially without hebrew
        populatePanel(iata, airport, translatedAirports[iata]);
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
            $routeSearchInput.value = '';
            renderRoutesList();
        });

        $tabInbound.addEventListener('click', () => {
            activeTab = 'inbound';
            $tabInbound.classList.add('active');
            $tabOutbound.classList.remove('active');
            $routeSearchInput.value = '';
            renderRoutesList();
        });

        $routeSearchInput.addEventListener('input', () => {
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
        if (selectedMarkerInstance) {
            selectedMarkerInstance.setIcon(ICONS[selectedMarkerInstance.airportType][selectedMarkerInstance.airportSize].default);
            selectedMarkerInstance = null;
        }
    }

    function populatePanel(iata, airport, heData = null) {
        let nameDisplay = airport.name;
        let locationDisplay = `${airport.city_name}, ${airport.country}`;

        if (currentLang === 'he' && heData) {
            if (heData.airportHe) nameDisplay = `${airport.name} - ${heData.airportHe}`;
            if (heData.cityHe) locationDisplay = `${airport.city_name} - ${heData.cityHe}, ${airport.country}`;
        }

        $panelAirportName.textContent = nameDisplay;
        $panelLocation.textContent = locationDisplay;
        $panelCodes.textContent = `${airport.iata}${airport.icao ? ' / ' + airport.icao : ''}`;
        $panelElevation.textContent = `${airport.elevation != null ? airport.elevation + ' m' : '—'}`;
        $panelTimezone.textContent = airport.timezone || '—';

        const continentNamesMap = currentLang === 'he' ? CONTINENT_NAMES_HE : CONTINENT_NAMES;
        $panelContinent.textContent = continentNamesMap[airport.continent] || airport.continent || '—';

        const outbound = airport.routes || [];
        const inbound = inboundMap[iata] || [];

        $outboundCount.textContent = outbound.length;
        $inboundCount.textContent = inbound.length;

        // Reset to outbound tab and clear search
        activeTab = 'outbound';
        $tabOutbound.classList.add('active');
        $tabInbound.classList.remove('active');
        $routeSearchInput.value = '';

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

        // Filter routes using the search input
        const query = $routeSearchInput.value.trim().toLowerCase();
        if (query) {
            routes = routes.filter(route => {
                const dest = airportsData[route.destIata];
                const destName = dest ? dest.name.toLowerCase() : '';
                const destCity = dest ? dest.city_name.toLowerCase() : '';
                const destCountry = dest ? dest.country.toLowerCase() : '';

                const iataMatch = route.destIata.toLowerCase().includes(query);
                const carriersMatch = route.carriers.some(c =>
                    c.iata.toLowerCase().includes(query) || c.name.toLowerCase().includes(query)
                );

                return iataMatch || destName.includes(query) || destCity.includes(query) || destCountry.includes(query) || carriersMatch;
            });
        }

        if (routes.length === 0) {
            const tabName = activeTab === 'outbound' ? t('tabOutbound') : t('tabInbound');
            $routesList.innerHTML = `
                <div class="no-routes">
                    <i data-lucide="plane-off"></i>
                    <p>${t('noRoutes', { tab: tabName })}</p>
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

    // --- Statistics Overlay ---
    let statsCalculated = false;

    function initStatsOverlay() {
        $statsBadge.addEventListener('click', () => {
            $statsOverlay.classList.remove('hidden');
            if (!statsCalculated) {
                calculateStatistics();
                statsCalculated = true;
            }
        });

        $statsClose.addEventListener('click', () => {
            $statsOverlay.classList.add('hidden');
        });
    }

    function calculateStatistics() {
        const topConnected = [];
        const carrierHubs = [];
        const globalAirlines = {};
        let longestFlight = null;
        let shortestFlight = null;
        let busiestRoute = null;

        for (const [iata, airport] of Object.entries(airportsData)) {
            const routes = airport.routes || [];

            topConnected.push({ iata, airport, count: routes.length });

            const uniqueCarriers = new Set();
            for (const r of routes) {
                (r.carriers || []).forEach(c => {
                    uniqueCarriers.add(c.iata);

                    if (!globalAirlines[c.iata]) {
                        globalAirlines[c.iata] = { name: c.name, count: 0 };
                    }
                    globalAirlines[c.iata].count++;
                });

                if (r.km > 0) {
                    if (!longestFlight || r.km > longestFlight.km) {
                        longestFlight = { src: airport, destIata: r.iata, km: r.km, min: r.min };
                    }
                    if (!shortestFlight || r.km < shortestFlight.km) {
                        shortestFlight = { src: airport, destIata: r.iata, km: r.km, min: r.min };
                    }
                }

                const carrierCount = (r.carriers || []).length;
                if (!busiestRoute || carrierCount > busiestRoute.carrierCount) {
                    busiestRoute = { src: airport, destIata: r.iata, carrierCount };
                }
            }

            carrierHubs.push({ iata, airport, count: uniqueCarriers.size });
        }

        topConnected.sort((a, b) => b.count - a.count);
        carrierHubs.sort((a, b) => b.count - a.count);

        const topAirlines = Object.entries(globalAirlines)
            .map(([iata, data]) => ({ iata, name: data.name, count: data.count }))
            .sort((a, b) => b.count - a.count);

        document.getElementById('stat-top-airports').innerHTML = topConnected.slice(0, 10).map((item, i) => `
            <li>
                <div class="stat-list-item-main">
                    <span class="stat-list-item-title">${i + 1}. ${item.airport.name} (${item.iata})</span>
                    <span class="stat-list-item-sub">${item.airport.city_name}, ${item.airport.country}</span>
                </div>
                <span class="stat-list-item-value">${item.count}</span>
            </li>
        `).join('');

        document.getElementById('stat-top-hubs').innerHTML = carrierHubs.slice(0, 10).map((item, i) => `
            <li>
                <div class="stat-list-item-main">
                    <span class="stat-list-item-title">${i + 1}. ${item.airport.name} (${item.iata})</span>
                    <span class="stat-list-item-sub">${item.airport.city_name}, ${item.airport.country}</span>
                </div>
                <span class="stat-list-item-value">${item.count}</span>
            </li>
        `).join('');

        document.getElementById('stat-top-airlines').innerHTML = topAirlines.slice(0, 10).map((item, i) => `
            <li>
                <div class="stat-list-item-main">
                    <span class="stat-list-item-title">${i + 1}. ${item.name}</span>
                    <span class="stat-list-item-sub">Code: ${item.iata}</span>
                </div>
                <span class="stat-list-item-value">${item.count.toLocaleString()}</span>
            </li>
        `).join('');

        if (longestFlight) {
            const dest = airportsData[longestFlight.destIata];
            document.getElementById('record-longest').textContent = `${longestFlight.km.toLocaleString()} km`;
            document.getElementById('record-longest-sub').textContent = `${longestFlight.src.iata} (${longestFlight.src.city_name}) ➔ ${longestFlight.destIata} (${dest ? dest.city_name : 'Unknown'})`;
        }

        if (shortestFlight) {
            const dest = airportsData[shortestFlight.destIata];
            document.getElementById('record-shortest').textContent = `${shortestFlight.km.toLocaleString()} km`;
            document.getElementById('record-shortest-sub').textContent = `${shortestFlight.src.iata} (${shortestFlight.src.city_name}) ➔ ${shortestFlight.destIata} (${dest ? dest.city_name : 'Unknown'})`;
        }

        if (busiestRoute) {
            const dest = airportsData[busiestRoute.destIata];
            document.getElementById('record-busiest').textContent = `${busiestRoute.carrierCount} Competing Airlines`;
            document.getElementById('record-busiest-sub').textContent = `${busiestRoute.src.iata} (${busiestRoute.src.city_name}) ➔ ${busiestRoute.destIata} (${dest ? dest.city_name : 'Unknown'})`;
        }
    }

    // --- Boot ---
    document.addEventListener('DOMContentLoaded', init);
})();
