// js/api_bridge.js
import * as THREE from 'three';
import { AppState } from './AppState.js';
import { loadDefaultModel, loadModelFromURL } from './io/AssetLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

const apiImpl = {
    getSceneSummary: () => ({
        modelName: AppState.loadedModel?.name || 'none',
        performance: AppState.performance,
        cameraPosition: AppState.camera.position.toArray(),
        animationCount: AppState.animation?.actions?.length || 0,
    }),
    getLoadingState: () => ({ loading: AppState.isLoadingModel }),
    resetScene: () => {
        AppState.actionHistory.length = 0;
        AppState.redoStack.length = 0;
        loadDefaultModel();
        return { message: "Scene reset successfully." };
    },
    takeScreenshot: () => {
        AppState.renderer.render(AppState.scene, AppState.camera);
        return { image_base_64: AppState.renderer.domElement.toDataURL('image/png').split(',')[1], format: "png" };
    },
    loadModel: (payload) => typeof payload.url !== 'string' ? { error: "Payload must have a 'url' string property." } : (loadModelFromURL(payload.url), { message: `Loading started for model from ${payload.url}` }),
};

window.localApi = {
    getSceneSummary: apiImpl.getSceneSummary,
    getLoadingState: apiImpl.getLoadingState,
    executeCommand: (command, payload) => {
        console.log(`[api] Команда: ${command}`, payload);
        const handler = apiImpl[command];
        if (typeof handler !== 'function') return { error: `Unknown command: '${command}'` };
        try { return handler(payload); }
        catch (e) {
            console.error(`[api] Ошибка:`, e);
            return { error: e.message };
        }
    }
};

document.getElementById('menu-undo')?.addEventListener('click', () => window.localApi.executeCommand('undo'));
document.getElementById('menu-redo')?.addEventListener('click', () => window.localApi.executeCommand('redo'));

console.log('[api] API готов');