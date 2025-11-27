// js/core/SceneManager.js
import * as THREE from 'three';
import { AppState } from '../AppState.js';

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.init();
    }

    init() {
        AppState.scene = this.scene = new THREE.Scene();
        Object.assign(this.scene, { background: new THREE.Color(0x0f172a), fog: new THREE.Fog(0x0f172a, 10, 45) });

        AppState.renderer = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
        Object.assign(this.renderer, { toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 });
        Object.assign(this.renderer.shadowMap, { enabled: true, type: THREE.PCFSoftShadowMap });
        this.renderer.setPixelRatio(window.devicePixelRatio);

        AppState.camera = this.camera = new THREE.PerspectiveCamera(50, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 1000);
        this.camera.position.set(5, 5, 10);

        this.scene.add(new THREE.HemisphereLight(0xddeeff, 0x2a2a35, 0.8));

        const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
        dirLight.position.set(15, 25, 15);
        Object.assign(dirLight, { castShadow: true });
        Object.assign(dirLight.shadow, { bias: -0.0001, radius: 2, mapSize: new THREE.Vector2(2048, 2048) });
        this.scene.add(dirLight);

        const rimLight = new THREE.SpotLight(0x60a5fa, 5.0);
        rimLight.position.set(-10, 10, -5);
        this.scene.add(rimLight);

        this.scene.add(this.gridHelper = new THREE.GridHelper(100, 100, 0x475569, 0x1e293b));
        this.gridHelper.position.y = -0.01;

        const plane = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8, metalness: 0.2 }));
        Object.assign(plane, { receiveShadow: true });
        plane.rotation.x = -Math.PI / 2; plane.position.y = -0.02;
        this.scene.add(this.groundPlane = plane);

        window.addEventListener('resize', () => this.onResize());
        this.onResize();
    }

    onResize() {
        const vp = document.querySelector('.main-viewport');
        if (!vp) return;
        this.camera.aspect = vp.clientWidth / vp.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(vp.clientWidth, vp.clientHeight);
    }
}