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

        // Ground plane - BIG to catch all shadows
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xa0d890, // Lighter green for better shadow contrast
            roughness: 0.9
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

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

        // Grid helper - bigger grid
        const gridHelper = new THREE.GridHelper(2000, 100, 0x888888, 0x444444);
        this.scene.add(gridHelper);

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

    checkSunAtPosition(x, z, sunPosition) {
        const groundPoint = new THREE.Vector3(x, 1, z);
        const sunDir = new THREE.Vector3(
            sunPosition.x - groundPoint.x,
            sunPosition.y - groundPoint.y,
            sunPosition.z - groundPoint.z
        ).normalize();

        this.raycaster.set(groundPoint, sunDir);
        const intersects = this.raycaster.intersectObjects(this.buildingMeshes);

        return intersects.length === 0;
    }

    updateCoffeeMarkerColors(sunPosition) {
        this.coffeeMarkers.forEach(marker => {
            const isSunny = this.checkSunAtPosition(
                marker.position.x,
                marker.position.z,
                sunPosition
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
}