# Airport Route Explorer

Interactive world map of airports and airline routes. Click any airport to explore destinations, airlines, distances, and flight times.

## Features

- **3,888 airports** displayed on an interactive map with marker clustering
- **Search** by airport name, city, country, or IATA code
- **Route visualization** — curved lines drawn on the map for all connections
- **Side panel** with airport details: IATA/ICAO codes, elevation, timezone, continent
- **Outbound & inbound routes** with distance (km), flight duration, and airline badges
- **Click a route** to highlight it on the map and pan to show both endpoints

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Map | [Leaflet.js](https://leafletjs.com/) with [CartoDB Positron](https://carto.com/basemaps/) tiles |
| Clustering | [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) |
| Icons | [Lucide](https://lucide.dev/) |
| Fonts | [Inter](https://fonts.google.com/specimen/Inter) (Google Fonts) |
| Styling | Vanilla CSS — light, minimal design |
| Data | [airline-route-data](https://github.com/Jonty/airline-route-data) by Jonty |

No frameworks, no build step, no server. Just 3 static files.

## Getting Started

### Run Locally

Open `index.html` in any modern browser. That's it.

### Deploy to GitHub Pages

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Set source to **Deploy from a branch** → `main` / `root`
4. Your site will be live at `https://<username>.github.io/<repo>/`

## Project Structure

```
airport_map/
├── index.html   # HTML structure + CDN imports
├── style.css    # Light, minimal design with amber accent
├── app.js       # Application logic (data loading, map, search, panel)
└── README.md
```

## Data Source

Airport and route data is fetched at runtime from [Jonty/airline-route-data](https://github.com/Jonty/airline-route-data). Each airport entry includes coordinates, metadata, and a list of routes with destination IATA codes, distances, flight durations, and operating airlines.

## License

Data sourced from [Jonty/airline-route-data](https://github.com/Jonty/airline-route-data).
