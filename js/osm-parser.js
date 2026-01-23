// OSM Data Parser
class OSMParser {
    constructor(centerLat, centerLon) {
        this.origin = { lat: centerLat, lon: centerLon };
    }

    // Convert lat/lon to meters (relative to origin)
    latLonToMeters(lat, lon) {
        const R = 6371000; // Earth radius in meters
        const dLat = (lat - this.origin.lat) * Math.PI / 180;
        const dLon = (lon - this.origin.lon) * Math.PI / 180;
        
        const x = dLon * R * Math.cos(this.origin.lat * Math.PI / 180);
        const z = -dLat * R; // Negative because lat increases north
        
        return { x, z };
    }

    // Get building height from OSM tags
    getBuildingHeight(tags) {
        if (tags.height) {
            return parseFloat(tags.height);
        }
        if (tags['building:levels']) {
            return parseFloat(tags['building:levels']) * 3; // 3.5m per floor
        }
        // Default height - make it VISIBLE!
        return 10; // ~5 stories
    }

    // Parse OSM response into usable data
    parse(osmData) {
        const nodes = {};
        const buildings = [];

        // Index all nodes
        osmData.elements.forEach(el => {
            if (el.type === 'node') {
                nodes[el.id] = { lat: el.lat, lon: el.lon };
            }
        });

        // Extract buildings
        osmData.elements.forEach(el => {
            if (el.type === 'way' && el.tags && el.tags.building) {
                const height = this.getBuildingHeight(el.tags);
                const footprint = [];

                // Get footprint coordinates
                el.nodes.forEach(nodeId => {
                    const node = nodes[nodeId];
                    if (node) {
                        const pos = this.latLonToMeters(node.lat, node.lon);
                        footprint.push(pos);
                    }
                });

                if (footprint.length > 2) { // Valid polygon
                    buildings.push({ height, footprint });
                }
            }
        });

        return buildings;
    }
}