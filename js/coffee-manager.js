// Coffee Manager - Fetches and manages coffee shops from OpenStreetMap

class CoffeeManager {
    constructor(parser) {
        this.parser = parser;
        this.coffeeShops = [];
    }

    async fetchCoffeeShops(lat, lon, radius = 500) {
        const query = `
            [out:json][timeout:25];
            (
              node["amenity"="cafe"](around:${radius},${lat},${lon});
              node["amenity"="restaurant"]["outdoor_seating"="yes"](around:${radius},${lat},${lon});
              node["amenity"="bar"]["outdoor_seating"="yes"](around:${radius},${lat},${lon});
              way["amenity"="cafe"](around:${radius},${lat},${lon});
            );
            out body center;
        `;

        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            this.coffeeShops = data.elements.map(el => {
                const lat = el.lat || el.center?.lat;
                const lon = el.lon || el.center?.lon;
                const pos = this.parser.latLonToMeters(lat, lon);

                return {
                    id: el.id,
                    name: el.tags?.name || 'Unnamed Cafe',
                    lat,
                    lon,
                    x: pos.x,
                    z: pos.z,
                    outdoor: el.tags?.outdoor_seating === 'yes',
                    type: el.tags?.amenity,
                    isSunny: null
                };
            });

            return this.coffeeShops;
        } catch (error) {
            console.error('Failed to fetch coffee shops:', error);
            return [];
        }
    }

    getCoffeeShops() {
        return this.coffeeShops;
    }

    updateSunStatus(id, isSunny) {
        const shop = this.coffeeShops.find(s => s.id === id);
        if (shop) shop.isSunny = isSunny;
    }

    getSunnyShops() {
        return this.coffeeShops.filter(s => s.isSunny === true);
    }

    getShadedShops() {
        return this.coffeeShops.filter(s => s.isSunny === false);
    }
}
