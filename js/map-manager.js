// Map Manager - Mapbox GL JS wrapper for visual rendering

class MapManager {
    constructor(containerId, accessToken) {
        mapboxgl.accessToken = accessToken;

        this.map = null;
        this.markers = new Map();
        this.userMarker = null;
        this.containerId = containerId;
        this.isReady = false;
        this.onReadyCallbacks = [];
    }

    init(lat, lon) {
        this.map = new mapboxgl.Map({
            container: this.containerId,
            style: 'mapbox://styles/mapbox/satellite-streets-v12',
            center: [lon, lat],
            zoom: 16,
            pitch: 45,
            bearing: 0,
            antialias: true
        });

        // Add navigation controls
        this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Add geolocation control
        this.map.addControl(new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: false,
            showUserHeading: false
        }), 'top-right');

        this.map.on('load', () => {
            this.add3DBuildings();
            this.isReady = true;
            this.onReadyCallbacks.forEach(cb => cb());
            this.onReadyCallbacks = [];
        });
    }

    onReady(callback) {
        if (this.isReady) {
            callback();
        } else {
            this.onReadyCallbacks.push(callback);
        }
    }

    add3DBuildings() {
        const layers = this.map.getStyle().layers;
        const labelLayerId = layers.find(
            layer => layer.type === 'symbol' && layer.layout['text-field']
        )?.id;

        this.map.addLayer({
            'id': '3d-buildings',
            'source': 'composite',
            'source-layer': 'building',
            'filter': ['==', 'extrude', 'true'],
            'type': 'fill-extrusion',
            'minzoom': 14,
            'paint': {
                'fill-extrusion-color': '#ddd',
                'fill-extrusion-height': ['get', 'height'],
                'fill-extrusion-base': ['get', 'min_height'],
                'fill-extrusion-opacity': 0.85
            }
        }, labelLayerId);
    }

    setCenter(lat, lon) {
        if (this.map) {
            this.map.flyTo({
                center: [lon, lat],
                zoom: 16,
                pitch: 45,
                duration: 1500
            });
        }
    }

    addUserMarker(lat, lon) {
        if (this.userMarker) {
            this.userMarker.remove();
        }

        const el = document.createElement('div');
        el.className = 'user-marker';
        el.innerHTML = `
            <div class="user-marker-pulse"></div>
            <div class="user-marker-dot"></div>
        `;

        this.userMarker = new mapboxgl.Marker(el)
            .setLngLat([lon, lat])
            .addTo(this.map);
    }

    addCoffeeMarker(shop, onClick) {
        const el = document.createElement('div');
        el.className = `coffee-marker ${shop.isSunny ? 'sunny' : 'shaded'}`;
        el.innerHTML = shop.isSunny ? '☀️' : '🌥️';
        el.dataset.shopId = shop.id;

        if (onClick) {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                onClick(shop);
            });
        }

        const marker = new mapboxgl.Marker(el)
            .setLngLat([shop.lon, shop.lat])
            .addTo(this.map);

        this.markers.set(shop.id, { marker, element: el });
    }

    addCoffeeMarkers(shops, onClick) {
        shops.forEach(shop => this.addCoffeeMarker(shop, onClick));
    }

    updateMarkerStatus(shopId, isSunny) {
        const markerData = this.markers.get(shopId);
        if (markerData) {
            const { element } = markerData;
            element.className = `coffee-marker ${isSunny ? 'sunny' : 'shaded'}`;
            element.innerHTML = isSunny ? '☀️' : '🌥️';
        }
    }

    updateAllMarkers(shops) {
        shops.forEach(shop => {
            this.updateMarkerStatus(shop.id, shop.isSunny);
        });
    }

    clearMarkers() {
        this.markers.forEach(({ marker }) => marker.remove());
        this.markers.clear();
    }

    highlightMarker(shopId) {
        // Fly to the selected cafe
        const markerData = this.markers.get(shopId);
        if (markerData) {
            const lngLat = markerData.marker.getLngLat();
            this.map.flyTo({
                center: [lngLat.lng, lngLat.lat],
                zoom: 17,
                duration: 800
            });

            // Add highlight class
            this.markers.forEach(({ element }, id) => {
                element.classList.toggle('highlighted', id === shopId);
            });
        }
    }

    resize() {
        if (this.map) {
            this.map.resize();
        }
    }
}
