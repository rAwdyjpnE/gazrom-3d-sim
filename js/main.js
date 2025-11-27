// js/main.js
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { AppState } from './AppState.js';
import { UIManager } from './ui/UIManager.js';
import { InteractionManager } from './interactions/InteractionManager.js';
import { ZoneManager } from './interactions/ZoneManager.js';
import { SceneManager } from './core/SceneManager.js';
import { CameraManager } from './core/CameraManager.js';
import { loadDefaultModel } from './io/AssetLoader.js';

function main() {
    console.log('[main] Инициализация');

    const params = new URLSearchParams(window.location.search);
    AppState.apiPort = params.get('port');
    AppState.apiBaseUrl = `http://127.0.0.1:${AppState.apiPort}`;

    const canvas = document.getElementById('canvas');
    const sceneManager = new SceneManager(canvas);
    const cameraManager = new CameraManager(AppState.camera, canvas);
    AppState.orbitControls = cameraManager.getOrbitControls();

    const transformControls = new TransformControls(AppState.camera, canvas);
    transformControls.addEventListener('dragging-changed', (event) => AppState.orbitControls.enabled = !event.value);
    transformControls.addEventListener('change', () => AppState.loadedModel?.updateMatrixWorld());
    AppState.scene.add(transformControls);
    AppState.transformControls = transformControls;

    if (!AppState.paintGroup) AppState.scene.add(AppState.paintGroup = new THREE.Group());
    
    AppState.zoneManager = new ZoneManager();
    const interactionManager = new InteractionManager(canvas, AppState.zoneManager);
    AppState.uiManager = new UIManager(sceneManager, interactionManager, AppState.zoneManager);

    setupInputListeners(transformControls, cameraManager);

    console.log('[main] Загрузка дефолтной модели');
    loadDefaultModel();

    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const deltaTime = clock.getDelta();
        AppState.animation?.mixer?.update(deltaTime);
        cameraManager.update(deltaTime);
        interactionManager.updatePreviewFromLoop();
        AppState.renderer?.render(AppState.scene, AppState.camera);
    }
    animate();
}

function setupInputListeners(transformControls, cameraManager) {
    const keyMap = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e', Digit1: '1', Digit2: '2', Digit3: '3' };
    const moveKeys = ['w', 'a', 's', 'd', 'q', 'e'];
    const isInputFocused = () => ['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName);

    window.addEventListener('keydown', (event) => {
        if (isInputFocused()) return;
        const mappedKey = keyMap[event.code] || event.key.toLowerCase();
        if (moveKeys.includes(mappedKey)) event.preventDefault();
        if (event.key === 'Control' && AppState.loadedModel) transformControls.attach(AppState.loadedModel);
        if (transformControls.object) {
            if (mappedKey === '1') transformControls.setMode('translate');
            else if (mappedKey === '2') transformControls.setMode('rotate');
            else if (mappedKey === '3') transformControls.setMode('scale');
        }
        if (moveKeys.includes(mappedKey)) cameraManager.handleKeyDown({ ...event, key: mappedKey });
    });

    window.addEventListener('keyup', (event) => {
        if (isInputFocused()) return;
        const mappedKey = keyMap[event.code] || event.key.toLowerCase();
        if (event.key === 'Control' && transformControls.object) transformControls.detach();
        if (moveKeys.includes(mappedKey)) cameraManager.handleKeyUp({ ...event, key: mappedKey });
    });
}

main();