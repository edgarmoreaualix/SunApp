// Sun Manager - Handles real sun position using SunCalc.js

class SunManager {
    constructor(lat, lon, sceneManager) {
        this.lat = lat;
        this.lon = lon;
        this.sceneManager = sceneManager;
        this.currentDate = new Date();
    }

    // Get sun position for current or specified time
    getSunPosition(date = this.currentDate) {
        const sunPos = SunCalc.getPosition(date, this.lat, this.lon);
        
        // sunPos.altitude: angle above horizon (radians)
        // sunPos.azimuth: direction angle (radians, 0 = south, Math.PI = north)
        
        return {
            altitude: sunPos.altitude,
            azimuth: sunPos.azimuth,
            date: date
        };
    }

    // Convert sun position to 3D coordinates
    sunPositionToVector(altitude, azimuth, distance = 1000) {
        // Convert to Cartesian coordinates
        // altitude: up/down angle from horizon
        // azimuth: compass direction (0 = south)
        
        const x = distance * Math.cos(altitude) * Math.sin(azimuth);
        const y = distance * Math.sin(altitude);
        const z = distance * Math.cos(altitude) * Math.cos(azimuth);
        
        return { x, y, z };
    }

    // Update sun light in the scene
    updateSunLight(date = this.currentDate) {
        const sunPos = this.getSunPosition(date);
        const vector = this.sunPositionToVector(sunPos.altitude, sunPos.azimuth);
        
        // Update the sun light position
        this.sceneManager.sunLight.position.set(vector.x, vector.y, vector.z);
        
        // Adjust light intensity based on sun altitude
        // Dim the light when sun is low or below horizon
        const intensity = Math.max(0, Math.sin(sunPos.altitude)) * 0.8 + 0.2;
        this.sceneManager.sunLight.intensity = intensity;
        
        // Change light color based on altitude (warmer when low)
        if (sunPos.altitude < 0.1) { // Near horizon
            this.sceneManager.sunLight.color.setHex(0xffaa66); // Warm orange
        } else {
            this.sceneManager.sunLight.color.setHex(0xffffff); // White
        }
        
        console.log('Sun updated:', {
            time: date.toLocaleTimeString(),
            altitude: (sunPos.altitude * 180 / Math.PI).toFixed(1) + '°',
            azimuth: (sunPos.azimuth * 180 / Math.PI).toFixed(1) + '°',
            position: vector,
            intensity: intensity.toFixed(2)
        });
        
        return sunPos;
    }

    // Get sun times for today
    getSunTimes(date = this.currentDate) {
        const times = SunCalc.getTimes(date, this.lat, this.lon);
        
        return {
            sunrise: times.sunrise,
            sunset: times.sunset,
            solarNoon: times.solarNoon,
            goldenHour: times.goldenHour,
            goldenHourEnd: times.goldenHourEnd
        };
    }

    // Set time and update sun
    setTime(hours, minutes) {
        const date = new Date();
        date.setHours(hours, minutes, 0, 0);
        this.currentDate = date;
        return this.updateSunLight(date);
    }

    // Start live sun (updates every minute)
    startLiveSun() {
        // Update immediately
        this.updateSunLight();
        
        // Update every minute
        this.liveInterval = setInterval(() => {
            this.currentDate = new Date();
            this.updateSunLight();
        }, 60000); // 60 seconds
        
        console.log('Live sun started');
    }

    // Stop live updates
    stopLiveSun() {
        if (this.liveInterval) {
            clearInterval(this.liveInterval);
            console.log('Live sun stopped');
        }
    }
}
