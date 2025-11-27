// js/core/CameraManager.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraManager {
    constructor(camera, canvas) {
        this.camera = camera;
        this.canvas = canvas;
        this.orbitControls = new OrbitControls(this.camera, this.canvas);
        this.orbitControls.enableDamping = false;
        this.orbitControls.zoomSpeed = 0.7;
        this.flySpeed = 12;
        this.movement = { forward: 0, right: 0, up: 0 };
    }
    
    handleKeyDown(e) {
        const speed = e.shiftKey ? this.flySpeed * 2.5 : this.flySpeed;
        const keyMap = { w: ['forward', speed], s: ['forward', -speed], a: ['right', -speed], d: ['right', speed], e: ['up', speed], q: ['up', -speed] };
        if (keyMap[e.key.toLowerCase()]) {
            const [axis, value] = keyMap[e.key.toLowerCase()];
            this.movement[axis] = value;
        }
    }

    handleKeyUp(e) {
        const keyMap = { w: 'forward', s: 'forward', a: 'right', d: 'right', e: 'up', q: 'up' };
        if (keyMap[e.key.toLowerCase()]) this.movement[keyMap[e.key.toLowerCase()]] = 0;
    }

    update(deltaTime) {
        this.orbitControls.update();
        if (this.movement.forward || this.movement.right || this.movement.up) {
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            this.camera.position.addScaledVector(direction, this.movement.forward * deltaTime);
            this.camera.position.addScaledVector(new THREE.Vector3().crossVectors(this.camera.up, direction).normalize(), -this.movement.right * deltaTime);
            this.camera.position.y += this.movement.up * deltaTime;
        }
    }

    getOrbitControls() { return this.orbitControls; }
}