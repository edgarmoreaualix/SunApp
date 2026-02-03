# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sunny Coffee is a mobile-first web app that helps users find coffee shops with sunny outdoor seating. It uses real-time sun position calculations and 3D shadow detection to show which terraces are currently sunny and predict when shaded spots will get sun.

## Running the Project

No build step required. Serve files via HTTP:

```bash
python3 -m http.server 8000
# or: npx http-server
```

**Requirements:**
- Mapbox access token (add to `MAPBOX_TOKEN` in index.html)
- Modern browser with WebGL
- Geolocation permission
- Internet connection for Mapbox, Overpass API

## Architecture

**Hybrid Approach:** Mapbox GL JS handles visual rendering while a headless Three.js engine handles shadow physics.

### Modules in `js/`

- `map-manager.js` - Mapbox GL JS wrapper: 3D map, satellite imagery, markers, user location
- `shadow-engine.js` - Headless Three.js: building meshes for raycasting, shadow detection (no rendering)
- `sun-manager.js` - Sun position calculations using SunCalc.js
- `coffee-manager.js` - Fetches cafes from Overpass API, calculates distances, predicts sun/shade times
- `osm-parser.js` - Parses OpenStreetMap building data, converts lat/lon to meters

### Data Flow

1. User grants geolocation → Map centers on user
2. OSM building query (for shadow engine) + Overpass cafe query run in parallel
3. Shadow engine loads building meshes for raycasting
4. Mapbox displays satellite imagery + 3D buildings (visual only)
5. Every second: SunCalc computes sun direction → Shadow engine raycasts → Markers update
6. CoffeeManager predicts when shaded cafes get sun and when sunny cafes lose sun

### Why Hybrid?

- **Mapbox**: Professional aligned satellite imagery + 3D buildings, touch-optimized controls
- **Three.js shadow engine**: Accurate raycasting through OSM buildings for shadow detection
- Mapbox doesn't support raycasting; Three.js doesn't have aligned imagery

## External APIs

- **Mapbox GL JS**: Map rendering, satellite imagery, 3D building extrusions
- **Overpass API** (overpass-api.de): Building footprints and coffee shops from OSM
- **SunCalc.js** (CDN): Sun position calculations
- **Three.js r128** (CDN): Headless raycasting for shadow detection

## Key Configuration

In `index.html`:
- `MAPBOX_TOKEN`: Your Mapbox access token (required)
- `RADIUS`: Search radius in meters (default 1000m)
- `LAT`, `LON`: Default location (Nantes, France)
