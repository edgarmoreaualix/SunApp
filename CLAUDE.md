# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sunny Coffee is a browser-based application that helps users find coffee shops with sunny outdoor seating. It renders a 3D visualization of real buildings from OpenStreetMap and uses sun position calculations to determine which cafes are currently in sunlight.

## Running the Project

No build step required. Serve files via HTTP (needed for CORS and geolocation):

```bash
python3 -m http.server 8000
# or: npx http-server
# or: npx live-server
```

Open `http://localhost:8000` in browser. Requires WebGL, geolocation permission, and internet connection for external APIs.

## Architecture

**Entry Point:** `index.html` contains inline CSS and main application logic

**Modules in `js/`:**
- `scene.js` - Three.js scene management, 3D building rendering, camera controls, raycasting for shadow detection
- `sun-manager.js` - Real sun position calculations using SunCalc.js, updates directional lighting
- `coffee-manager.js` - Fetches cafes from Overpass API, calculates distances, predicts when shaded cafes will get sun
- `osm-parser.js` - Parses OpenStreetMap data, converts lat/lon to local meter coordinates

**Data Flow:**
1. User grants geolocation → OSM building + Overpass cafe queries run in parallel
2. OSMParser converts coordinates → SceneManager renders 3D scene
3. SunManager positions light → Raycasting determines sunny/shaded status
4. CoffeeManager sorts cafes by sun status and distance → UI renders list

## External APIs

- **Overpass API** (overpass-api.de): Fetches building footprints and coffee shops from OpenStreetMap
- **ArcGIS** (server.arcgisonline.com): Satellite imagery tiles
- **SunCalc.js** (CDN): Sun position calculations
- **Three.js r128** (CDN): 3D rendering

## Key Configuration

In `index.html`:
- `LAT`, `LON`: Default location (Nantes, France)
- `RADIUS`: Search radius in meters (currently 1000m)
