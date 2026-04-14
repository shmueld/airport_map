# Statistics Feature Implementation Plan

The goal is to introduce a Statistics section to the Airport Map application. Since our airline route JSON data is quite large, I propose injecting these statistics as a **beautiful, full-screen overlay or sliding dashboard** within the existing `index.html` file. This avoids forcing the user's browser to re-download or re-parse the heavy data file on a separate page.

## Proposed Metrics & Insights

Based on the available data, here are the most interesting metrics we can calculate and display:

1. **Most Connected Airports (Destinations)**: Top 10 airports with the highest number of direct flight destinations.
2. **Top Airline Hubs (Carriers)**: Top airports hosting the highest number of distinct airlines.
3. **The Longest & Shortest Flights**:
   - The route with the maximum distance (`km`) and flight time.
   - The shortest commercial flight.
4. **Busiest Flight Corridors**: The specific routes (e.g., JFK ➔ LHR) operated by the highest number of competing airlines.
5. **Most Connected Countries**: The countries with the most international outbound routes.
6. **Top Global Airlines**: The airlines that operate the highest number of unique routes globally.

> [!TIP]
> Do these metrics sound good to you? Are there any others you'd like to add or remove from this list?

## Proposed Changes

### `index.html`
- **[MODIFY]**: Add a "Statistics" trigger button (e.g., in the bottom left stats badge or top right corner).
- **[MODIFY]**: Add the HTML structure for a full-screen `stats-overlay`. This will act as a standalone "page" but physically exist within the same file to share the JSON data memory.

### `style.css`
- **[MODIFY]**: Add styling for the `.stats-overlay`, implementing a clean, modern dashboard aesthetic with a grid layout for "Stat Cards" (resembling analytics dashboards).

### `app.js`
- **[MODIFY]**: Add a `calculateStatistics()` function to iterate over `airportsData` once the data loads.
- **[MODIFY]**: Add DOM interactions to open/close the stats overlay and dynamically populate the metrics on demand.

## User Review Required

> [!IMPORTANT]  
> 1. Do you prefer the statistics to open as a **Dashboard Overlay** (keeps the map loaded in the background for performance) or as a strictly **separate HTML file** (would require re-fetching the data)?
> 2. Which of the suggested metrics above do you like the most? Any additional requests?

Please reply with your preference so we can begin execution!
