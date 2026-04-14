# Airport Route Explorer — Walkthrough

## What Was Built

A fully static, interactive web map that visualizes **3,888 airports** and **59,249 routes** worldwide. Click any airport to see all its outbound and inbound connections, airlines, distances, and flight times.

## Files Created

| File | Purpose |
|------|---------|
| [index.html](file:///d:/Projects/private/airport_map/index.html) | HTML structure + CDN imports (Leaflet, MarkerCluster, Lucide, Inter font) |
| [style.css](file:///d:/Projects/private/airport_map/style.css) | Light, minimal shadcn-inspired design with amber accent |
| [app.js](file:///d:/Projects/private/airport_map/app.js) | All application logic — data loading, map, search, panel, routes |

No build step, no dependencies to install. Just 3 files — ready for GitHub Pages.

## Features

### Map with Clustered Markers
3,888 airports rendered with Leaflet MarkerClusterGroup for smooth performance at any zoom level.

![Map overview with clustered airport markers](C:/Users/shmulik/.gemini/antigravity/brain/52b79174-c6e3-4111-a86a-a82070573925/map_overview.png)

### Search
Fuzzy search by airport name, city, country, or IATA code with instant dropdown results.

![Search for TLV showing Ben Gurion Airport](C:/Users/shmulik/.gemini/antigravity/brain/52b79174-c6e3-4111-a86a-a82070573925/search_tlv.png)

### Airport Details + Route Lines
Clicking an airport opens a side panel with:
- Airport metadata (IATA/ICAO, elevation, timezone, continent)
- **Outbound** and **Inbound** tabs with route counts
- Each route shows: destination name, distance (km), duration, and airline badges
- Curved amber route lines drawn on the map
- Clicking a route card highlights the line and pans to show both endpoints

![TLV selected with 111 outbound routes and route lines](C:/Users/shmulik/.gemini/antigravity/brain/52b79174-c6e3-4111-a86a-a82070573925/tlv_routes.png)

### Inbound Route Precomputation
The JSON only contains outbound routes per airport. At load time, a reverse-lookup map is built so every airport also knows which airports fly **to** it.

## GitHub Pages Deployment

To deploy:
1. Create a GitHub repository
2. Push the 3 files (`index.html`, `style.css`, `app.js`)
3. Go to **Settings → Pages → Source: Deploy from branch → `main` / `root`**
4. The site will be live at `https://<username>.github.io/<repo>/`

> [!NOTE]
> The app fetches the ~23MB JSON at runtime from GitHub's raw content URL. First load may take a few seconds on slow connections — the loading spinner handles this gracefully.

## Tested

- Map loads with all markers clustered
- Search works (tested "TLV" → Ben Gurion International Airport)
- Side panel opens with correct metadata
- 111 outbound + 111 inbound routes displayed for TLV
- Route lines render as curved amber arcs
- Route card click highlights the line and pans the map
- Panel close clears routes and resets markers
