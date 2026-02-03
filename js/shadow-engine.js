// Shadow Engine - Headless Three.js for shadow raycasting only
// No rendering, no camera, no DOM - just physics calculations

class ShadowEngine {
    constructor() {
        this.scene = new THREE.Scene();
        this.raycaster = new THREE.Raycaster();
        this.buildingMeshes = [];
        this.raycaster.far = 2000;
    }

    createBuilding(footprint, height) {
        const shape = new THREE.Shape();

        footprint.forEach((point, i) => {
            if (i === 0) {
                shape.moveTo(point.x, point.z);
            } else {
                shape.lineTo(point.x, point.z);
            }
        });

        const extrudeSettings = {
            steps: 1,
            depth: height,
            bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.rotateX(-Math.PI / 2);

        const material = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(geometry, material);

        return mesh;
    }

    addBuildings(buildings) {
        console.log(`Shadow engine: adding ${buildings.length} buildings for raycasting`);

        buildings.forEach(building => {
            if (building.footprint.length > 2) {
                const mesh = this.createBuilding(building.footprint, building.height);
                this.scene.add(mesh);
                this.buildingMeshes.push(mesh);
            }
        });

        console.log(`Shadow engine: ${this.buildingMeshes.length} building meshes ready`);
    }

    clearBuildings() {
        this.buildingMeshes.forEach(mesh => {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        });
        this.buildingMeshes = [];
    }

    checkSunAtPosition(x, z, sunDirection) {
        // Check from terrace table height (~0.75m)
        const groundPoint = new THREE.Vector3(x, 0.75, z);

        // sunDirection should be a normalized THREE.Vector3 pointing TOWARD the sun
        this.raycaster.set(groundPoint, sunDirection);

        const intersects = this.raycaster.intersectObjects(this.buildingMeshes, true);

        return intersects.length === 0;
    }

    // Batch check for multiple positions (more efficient)
    checkSunAtPositions(positions, sunDirection) {
        const sunDir = new THREE.Vector3(sunDirection.x, sunDirection.y, sunDirection.z).normalize();

        return positions.map(pos => ({
            x: pos.x,
            z: pos.z,
            id: pos.id,
            isSunny: this.checkSunAtPosition(pos.x, pos.z, sunDir)
        }));
    }
}
