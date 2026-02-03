// Coffee Manager - Fetches and manages coffee shops from OpenStreetMap

class CoffeeManager {
    constructor(parser) {
        this.parser = parser;
        this.coffeeShops = [];
        this.userLat = null;
        this.userLon = null;
    }

    setUserLocation(lat, lon) {
        this.userLat = lat;
        this.userLon = lon;
        this.updateDistances();
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return Math.round(R * c);
    }

    updateDistances() {
        if (this.userLat === null) return;
        this.coffeeShops.forEach(shop => {
            shop.distance = this.calculateDistance(this.userLat, this.userLon, shop.lat, shop.lon);
        });
    }

    async fetchCoffeeShops(lat, lon, radius = 500) {
        this.setUserLocation(lat, lon);

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
                const shopLat = el.lat || el.center?.lat;
                const shopLon = el.lon || el.center?.lon;
                const pos = this.parser.latLonToMeters(shopLat, shopLon);
                const tags = el.tags || {};

                return {
                    id: el.id,
                    name: tags.name || 'Unnamed Cafe',
                    lat: shopLat,
                    lon: shopLon,
                    x: pos.x,
                    z: pos.z,
                    distance: this.calculateDistance(lat, lon, shopLat, shopLon),
                    outdoor: tags.outdoor_seating === 'yes',
                    type: tags.amenity,
                    cuisine: tags.cuisine || null,
                    openingHours: tags.opening_hours || null,
                    phone: tags.phone || tags['contact:phone'] || null,
                    website: tags.website || tags['contact:website'] || null,
                    address: this.buildAddress(tags),
                    wheelchair: tags.wheelchair || null,
                    isSunny: null,
                    sunnyAt: null,    // When shaded terrace will get sun
                    shadesAt: null    // When sunny terrace will become shaded
                };
            });

            return this.coffeeShops;
        } catch (error) {
            console.error('Failed to fetch coffee shops:', error);
            return [];
        }
    }

    buildAddress(tags) {
        const parts = [];
        if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
        if (tags['addr:street']) parts.push(tags['addr:street']);
        if (tags['addr:city']) parts.push(tags['addr:city']);
        return parts.length > 0 ? parts.join(' ') : null;
    }

    getCoffeeShops() {
        return this.coffeeShops;
    }

    getShopById(id) {
        return this.coffeeShops.find(s => s.id === id);
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

    getShopsSorted() {
        return [...this.coffeeShops].sort((a, b) => {
            if (a.isSunny !== b.isSunny) {
                return a.isSunny ? -1 : 1;
            }
            return a.distance - b.distance;
        });
    }

    predictSunnyTimes(sunManager, sceneManager) {
        const now = new Date();
        const sunset = sunManager.getSunTimes().sunset;

        this.coffeeShops.forEach(shop => {
            // Reset predictions
            shop.sunnyAt = null;
            shop.shadesAt = null;

            if (shop.isSunny) {
                // SUNNY: predict when it will become shaded
                // Check every 10 minutes from now until sunset
                for (let mins = 10; mins <= 480; mins += 10) {
                    const futureTime = new Date(now.getTime() + mins * 60000);
                    if (futureTime > sunset) {
                        // Stays sunny until sunset
                        shop.shadesAt = sunset;
                        break;
                    }

                    const sunPos = SunCalc.getPosition(futureTime, this.userLat, this.userLon);
                    if (sunPos.altitude <= 0) {
                        shop.shadesAt = futureTime;
                        break;
                    }

                    const sunDir = sunManager.sunPositionToVector(sunPos.altitude, sunPos.azimuth);
                    const sunVector = new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z).normalize();
                    const willBeSunny = sceneManager.checkSunAtPosition(shop.x, shop.z, sunVector);

                    if (!willBeSunny) {
                        shop.shadesAt = futureTime;
                        break;
                    }
                }

                // If we didn't find a shade time, it stays sunny until sunset
                if (!shop.shadesAt) {
                    shop.shadesAt = sunset;
                }
            } else {
                // SHADED: predict when it will get sun
                for (let mins = 15; mins <= 480; mins += 15) {
                    const futureTime = new Date(now.getTime() + mins * 60000);
                    if (futureTime > sunset) break;

                    const sunPos = SunCalc.getPosition(futureTime, this.userLat, this.userLon);
                    if (sunPos.altitude <= 0) continue;

                    const sunDir = sunManager.sunPositionToVector(sunPos.altitude, sunPos.azimuth);
                    const sunVector = new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z).normalize();
                    const isSunny = sceneManager.checkSunAtPosition(shop.x, shop.z, sunVector);

                    if (isSunny) {
                        shop.sunnyAt = futureTime;
                        break;
                    }
                }
            }
        });
    }
}
