// Three.js Scene Manager

class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.buildingMeshes = [];
        this.coffeeMarkers = [];
        this.userMarker = null;
        this.raycaster = new THREE.Raycaster();

        this.init();
    }

    init() {
        // Scene
        this.scene.background = new THREE.Color(0x87ceeb); // Sky blue

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            60,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            2000
        );
        this.camera.position.set(200, 150, 200);
        this.camera.lookAt(0, 0, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Ground plane - will be textured with satellite imagery
        const groundGeometry = new THREE.PlaneGeometry(3000, 3000);
        this.groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x3a5a40,
            roughness: 0.9
        });
        this.ground = new THREE.Mesh(groundGeometry, this.groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);

        // Lights - REDUCED ambient so shadows are visible!
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Reduced from 0.4
        this.scene.add(ambientLight);

        // Sun light (directional)
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.2); // Increased intensity
        this.sunLight.position.set(100, 200, 100);
        this.sunLight.castShadow = true;
        
        // CRITICAL: Shadow camera must cover the entire area!
        this.sunLight.shadow.camera.left = -600;
        this.sunLight.shadow.camera.right = 600;
        this.sunLight.shadow.camera.top = 600;
        this.sunLight.shadow.camera.bottom = -600;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 2000;
        
        // High quality shadows
        this.sunLight.shadow.mapSize.width = 4096;  // Increased from 2048
        this.sunLight.shadow.mapSize.height = 4096;
        this.sunLight.shadow.bias = -0.0001; // Prevent shadow acne
        
        this.scene.add(this.sunLight);

        // Optional: Shadow camera helper (uncomment to debug shadows)
        // const shadowHelper = new THREE.CameraHelper(this.sunLight.shadow.camera);
        // this.scene.add(shadowHelper);

        // Visual sun sphere
        const sunGeometry = new THREE.SphereGeometry(20, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 1
        });
        this.sunSphere = new THREE.Mesh(sunGeometry, sunMaterial);
        this.sunLight.add(this.sunSphere); // Attach to light so it moves together
        this.scene.add(this.sunLight);

        // Mouse controls
        this.setupMouseControls();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Start animation
        this.animate();
    }

    setupMouseControls() {
        let isDragging = false;
        let previousPosition = { x: 0, y: 0 };
        let initialPinchDistance = 0;
        const rotationSpeed = 0.005;

        const getPosition = (e) => {
            if (e.touches) {
                return { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
            return { x: e.clientX, y: e.clientY };
        };

        const onStart = (e) => {
            if (e.touches && e.touches.length === 2) {
                initialPinchDistance = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                return;
            }
            isDragging = true;
            previousPosition = getPosition(e);
        };

        const onMove = (e) => {
            if (e.touches && e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                const delta = (initialPinchDistance - dist) * 0.5;
                initialPinchDistance = dist;
                this.zoom(delta);
                return;
            }

            if (!isDragging) return;

            const pos = getPosition(e);
            const deltaX = pos.x - previousPosition.x;
            const deltaY = pos.y - previousPosition.y;

            const radius = Math.sqrt(this.camera.position.x ** 2 + this.camera.position.z ** 2);
            const currentAngle = Math.atan2(this.camera.position.z, this.camera.position.x);
            const newAngle = currentAngle - deltaX * rotationSpeed;

            this.camera.position.x = radius * Math.cos(newAngle);
            this.camera.position.z = radius * Math.sin(newAngle);
            this.camera.position.y = Math.max(10, this.camera.position.y - deltaY * 0.5);

            this.camera.lookAt(0, 0, 0);
            previousPosition = pos;
        };

        const onEnd = () => { isDragging = false; };

        // Mouse events
        this.renderer.domElement.addEventListener('mousedown', onStart);
        this.renderer.domElement.addEventListener('mousemove', onMove);
        this.renderer.domElement.addEventListener('mouseup', onEnd);

        // Touch events
        this.renderer.domElement.addEventListener('touchstart', onStart, { passive: true });
        this.renderer.domElement.addEventListener('touchmove', onMove, { passive: true });
        this.renderer.domElement.addEventListener('touchend', onEnd);

        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.zoom(e.deltaY * 0.1);
        }, { passive: false });
    }

    zoom(delta) {
        const direction = new THREE.Vector3();
        direction.subVectors(this.camera.position, new THREE.Vector3(0, 0, 0)).normalize();
        this.camera.position.addScaledVector(direction, delta);

        const minDistance = 50;
        const distance = this.camera.position.length();
        if (distance < minDistance) {
            this.camera.position.multiplyScalar(minDistance / distance);
        }
    }

    createBuilding(footprint, height) {
        // Create shape from footprint points
        const shape = new THREE.Shape();
        
        footprint.forEach((point, i) => {
            if (i === 0) {
                shape.moveTo(point.x, point.z);
            } else {
                shape.lineTo(point.x, point.z);
            }
        });

        // Extrude settings - THIS IS THE KEY!
        const extrudeSettings = {
            steps: 1,
            depth: height,
            bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        
        // Rotate so extrusion goes UP (Y-axis) instead of along Z
        geometry.rotateX(-Math.PI / 2);

        const material = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            roughness: 0.7,
            metalness: 0.1
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    addBuildings(buildings) {
        console.log(`Adding ${buildings.length} buildings to scene`);
        
        let successCount = 0;
        buildings.forEach((building, index) => {
            console.log(`Building ${index}: height=${building.height}, footprint points=${building.footprint.length}`);
            const mesh = this.createBuilding(building.footprint, building.height);
            if (mesh) {
                this.scene.add(mesh);
                this.buildingMeshes.push(mesh); // Track buildings
                successCount++;
                
                // Log first building details
                if (index === 0) {
                    console.log('First building mesh:', mesh);
                    console.log('First building position:', mesh.position);
                    console.log('First building geometry:', mesh.geometry);
                }
            }
        });
        console.log(`Successfully added ${successCount} building meshes to scene`);
    }

    clearBuildings() {
        this.buildingMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.buildingMeshes = [];

        this.coffeeMarkers.forEach(marker => {
            this.scene.remove(marker);
            if (marker.geometry) marker.geometry.dispose();
            if (marker.material) marker.material.dispose();
        });
        this.coffeeMarkers = [];

        if (this.userMarker) {
            this.scene.remove(this.userMarker);
            this.userMarker = null;
        }
    }

    addUserMarker() {
        if (this.userMarker) {
            this.scene.remove(this.userMarker);
        }

        const group = new THREE.Group();

        // Blue circle on ground
        const ringGeometry = new THREE.RingGeometry(8, 12, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x3b82f6, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.5;
        group.add(ring);

        // Inner dot
        const dotGeometry = new THREE.CircleGeometry(6, 32);
        const dotMaterial = new THREE.MeshBasicMaterial({ color: 0x60a5fa });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        dot.rotation.x = -Math.PI / 2;
        dot.position.y = 0.6;
        group.add(dot);

        // Pulsing outer ring (will be animated)
        const pulseGeometry = new THREE.RingGeometry(12, 14, 32);
        const pulseMaterial = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        this.pulseRing = new THREE.Mesh(pulseGeometry, pulseMaterial);
        this.pulseRing.rotation.x = -Math.PI / 2;
        this.pulseRing.position.y = 0.4;
        group.add(this.pulseRing);

        group.position.set(0, 0, 0);
        this.userMarker = group;
        this.scene.add(this.userMarker);
    }

    addCoffeeMarkers(coffeeShops) {
        coffeeShops.forEach(shop => {
            const geometry = new THREE.CylinderGeometry(3, 3, 15, 8);
            const material = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
            const marker = new THREE.Mesh(geometry, material);

            marker.position.set(shop.x, 7.5, shop.z);
            marker.userData = { shopId: shop.id, shop };
            marker.castShadow = false;
            marker.receiveShadow = true;

            this.scene.add(marker);
            this.coffeeMarkers.push(marker);
        });
    }

    checkSunAtPosition(x, z, sunDirection) {
        // Check from slightly above ground level (terrace table height ~0.75m)
        const groundPoint = new THREE.Vector3(x, 0.75, z);

        // sunDirection should be a normalized THREE.Vector3 pointing TOWARD the sun
        // We raycast in that direction to see if any building blocks the sun
        this.raycaster.set(groundPoint, sunDirection);
        this.raycaster.far = 2000; // Limit raycast distance

        // Check all buildings including their children
        const intersects = this.raycaster.intersectObjects(this.buildingMeshes, true);

        return intersects.length === 0;
    }

    updateCoffeeMarkerColors(sunDirection) {
        // Convert to THREE.Vector3 and normalize for consistent raycasting
        const sunDir = new THREE.Vector3(sunDirection.x, sunDirection.y, sunDirection.z).normalize();

        this.coffeeMarkers.forEach(marker => {
            const isSunny = this.checkSunAtPosition(
                marker.position.x,
                marker.position.z,
                sunDir
            );

            marker.userData.shop.isSunny = isSunny;
            marker.material.color.setHex(isSunny ? 0xffd700 : 0x4a5568);
        });
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.renderer.render(this.scene, this.camera);
    }

    loadSatelliteImagery(lat, lon, radius) {
        const zoom = 18; // Higher zoom for better alignment
        const tileSize = 256;
        const earthCircumference = 40075016.686;
        const metersPerPixel = earthCircumference * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom + 8);

        // Calculate fractional tile coordinates for exact position
        const tileXFloat = (lon + 180) / 360 * Math.pow(2, zoom);
        const tileYFloat = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom);

        const centerTileX = Math.floor(tileXFloat);
        const centerTileY = Math.floor(tileYFloat);

        // Calculate sub-tile offset (0-1 range, where user is within the center tile)
        const subTileOffsetX = tileXFloat - centerTileX; // 0 = left edge, 1 = right edge
        const subTileOffsetY = tileYFloat - centerTileY; // 0 = top edge, 1 = bottom edge

        const tilesNeeded = Math.ceil(radius * 2 / (tileSize * metersPerPixel)) + 2; // +2 for padding
        const halfTiles = Math.floor(tilesNeeded / 2);

        const canvas = document.createElement('canvas');
        const canvasSize = tilesNeeded * tileSize;
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const ctx = canvas.getContext('2d');

        let loadedCount = 0;
        const totalTiles = tilesNeeded * tilesNeeded;

        for (let dy = -halfTiles; dy <= halfTiles; dy++) {
            for (let dx = -halfTiles; dx <= halfTiles; dx++) {
                const tileX = centerTileX + dx;
                const tileY = centerTileY + dy;

                const img = new Image();
                img.crossOrigin = 'anonymous';

                const canvasX = (dx + halfTiles) * tileSize;
                const canvasY = (dy + halfTiles) * tileSize;

                img.onload = () => {
                    ctx.drawImage(img, canvasX, canvasY, tileSize, tileSize);
                    loadedCount++;

                    if (loadedCount === totalTiles) {
                        const texture = new THREE.CanvasTexture(canvas);
                        texture.minFilter = THREE.LinearFilter;
                        texture.magFilter = THREE.LinearFilter;

                        this.groundMaterial.map = texture;
                        this.groundMaterial.color.setHex(0xffffff);
                        this.groundMaterial.needsUpdate = true;

                        const groundSize = tilesNeeded * tileSize * metersPerPixel;
                        this.ground.geometry.dispose();
                        this.ground.geometry = new THREE.PlaneGeometry(groundSize, groundSize);

                        // Calculate offset to align satellite imagery with buildings
                        // User is at (0,0,0) in 3D space
                        // subTileOffset is 0-1 within the center tile (0=left/top, 1=right/bottom)
                        // Canvas center is at the center of the tile grid (halfTiles + 0.5 tiles from edge)
                        // User is at (halfTiles + subTileOffsetX) tiles from left edge

                        // How far from canvas center (in tiles) is the user?
                        const userFromCenterX = subTileOffsetX - 0.5; // -0.5 to +0.5
                        const userFromCenterY = subTileOffsetY - 0.5; // -0.5 to +0.5

                        // Convert to meters
                        // Positive X in tiles = East = positive X in 3D
                        // Positive Y in tiles = South = positive Z in 3D
                        const offsetXMeters = userFromCenterX * tileSize * metersPerPixel;
                        const offsetZMeters = userFromCenterY * tileSize * metersPerPixel;

                        // Move ground so that user position aligns with (0,0)
                        // If user is 50m east of tile center, move ground 50m west (-X)
                        this.ground.position.set(-offsetXMeters, 0, -offsetZMeters);

                        console.log('Satellite imagery aligned', {
                            subTileOffset: { x: subTileOffsetX.toFixed(3), y: subTileOffsetY.toFixed(3) },
                            userFromCenter: { x: userFromCenterX.toFixed(3), y: userFromCenterY.toFixed(3) },
                            groundOffset: { x: -offsetXMeters.toFixed(1), z: -offsetZMeters.toFixed(1) },
                            groundSize: groundSize.toFixed(0),
                            metersPerPixel: metersPerPixel.toFixed(3)
                        });
                    }
                };

                img.onerror = () => {
                    loadedCount++;
                };

                img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${tileY}/${tileX}`;
            }
        }
    }
}