// js/core/ControlsManager.js
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { AppState } from '../AppState.js';

export class ControlsManager {
    constructor(camera, canvas) {
        this.camera = camera;
        this.canvas = canvas;
        this.orbitControls = new OrbitControls(this.camera, this.canvas);
        this.orbitControls.enableDamping = false;
        this.orbitControls.zoomSpeed = 0.7;
        this.transformControls = new TransformControls(this.camera, this.canvas);
        this.transformControls.addEventListener('dragging-changed', (event) => this.orbitControls.enabled = !event.value);
        AppState.scene.add(this.transformControls);
    }

    update() { this.orbitControls.update(); }
    
    getControls() { return { orbitControls: this.orbitControls, transformControls: this.transformControls }; }
}