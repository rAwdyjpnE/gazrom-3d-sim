// js/io/AssetLoader.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { AppState } from '../AppState.js';

const createCarPaintMaterial = (originalMaterial) => {
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x8899a6, metalness: 0.7, roughness: 0.4, clearcoat: 1.0, clearcoatRoughness: 0.1 });
    if (originalMaterial?.normalMap) {
        mat.normalMap = originalMaterial.normalMap;
        mat.normalScale = new THREE.Vector2(1, 1);
        if (originalMaterial.aoMap) Object.assign(mat, { aoMap: originalMaterial.aoMap, aoMapIntensity: 1.0 });
    }
    return mat;
};

function setupModel(gltf, filename) {
    const model = gltf.scene;
    model.name = filename || gltf.scene.name || 'loaded_model';
    model.userData.filename = filename;

    (AppState.originalMaterials = AppState.originalMaterials || new Map()).clear();
    
    model.traverse(child => {
        if (child.isMesh || child.isSkinnedMesh) {
            const originalMat = Array.isArray(child.material) ? child.material[0] : child.material;
            AppState.originalMaterials.set(child.uuid, originalMat.clone());
            Object.assign(child, { material: createCarPaintMaterial(originalMat), castShadow: true, receiveShadow: true });
        }
    });

    const box = new THREE.Box3().setFromObject(model);
    console.log('[asset] Баундинг бокс:', box);
    
    if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        model.position.set(-center.x, -center.y, -center.z);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) model.scale.setScalar(AppState.modelScale = 4 / maxDim);
    }

    model.position.y = 1.2;

    if (AppState.orbitControls) {
        AppState.orbitControls.reset();
        AppState.camera.position.set(6, 6, 12);
        AppState.camera.lookAt(0, 0, 0);
        AppState.orbitControls.update();
    }
    
    if (gltf.animations?.length && AppState.animation) {
        AppState.animation.mixer = new THREE.AnimationMixer(model);
        AppState.animation.actions = gltf.animations.map(clip => AppState.animation.mixer.clipAction(clip));
        AppState.animation.actions[0]?.play();
    } else if (AppState.animation) Object.assign(AppState.animation, { mixer: null, actions: [] });

    AppState.scene.add(model);

    if (AppState.zoneManager && filename) {
        const configUrl = `zones_${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        console.log(`[asset] Проверка авто-конфига: ${configUrl}`);
        fetch(configUrl)
            .then(res => res.ok ? res.text() : Promise.reject())
            .then(json => (console.log(`[asset] Авто-загрузка зон из ${configUrl}`), AppState.zoneManager.importZonesFromJSON(json, true)))
            .catch(() => console.log(`[asset] Авто-конфиг не найден для ${filename}`));
    }

    return model;
}

const setupSTLModel = (geometry) => {
    geometry.computeVertexNormals();
    geometry.center();
    const mesh = new THREE.Mesh(geometry, createCarPaintMaterial(null));
    Object.assign(mesh, { name: 'stl_model', castShadow: true, receiveShadow: true });
    const container = new THREE.Object3D();
    container.add(mesh);
    container.name = 'loaded_stl';
    return setupModel({ scene: container, animations: [] }, 'stl_model.stl');
};

function cleanupCurrentModel() {
    if (AppState.loadedModel) {
        if (AppState.transformControls?.object === AppState.loadedModel) AppState.transformControls.detach();
        AppState.scene.remove(AppState.loadedModel);
        AppState.loadedModel.traverse((child) => {
            if (child.isMesh) {
                child.geometry?.dispose();
                (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => m?.dispose());
            }
        });
        AppState.loadedModel = null;
    }

    if (AppState.animation?.mixer) {
        AppState.animation.mixer.stopAllAction();
        Object.assign(AppState.animation, { mixer: null, actions: [] });
    }

    [AppState.placedStickers, AppState.decalMeshes].forEach((arr, idx) => {
        arr?.forEach(item => {
            (idx === 0 ? item.removeFromParent() : AppState.scene.remove(item));
            item.geometry?.dispose();
            item.material?.dispose();
        });
        if (arr) arr.length = 0;
    });
}

const getFileExtension = (filename) => filename.split('.').pop().toLowerCase();

export function loadModel(file) {
    const url = URL.createObjectURL(file);
    const extension = getFileExtension(file.name);
    cleanupCurrentModel();
    AppState.isLoadingModel = true;

    const loader = extension === 'stl' ? new STLLoader() : new GLTFLoader();
    const onLoad = extension === 'stl' 
        ? (geometry) => (AppState.loadedModel = setupSTLModel(geometry), URL.revokeObjectURL(url), AppState.isLoadingModel = false)
        : (gltf) => (AppState.loadedModel = setupModel(gltf, file.name), URL.revokeObjectURL(url), AppState.isLoadingModel = false);
    const onError = (error) => (console.error(error), AppState.isLoadingModel = false, AppState.uiManager?.showAlert("Ошибка", `Не удалось загрузить ${extension.toUpperCase()} файл.`), loadDefaultModel());

    loader.load(url, onLoad, undefined, onError);
}

export function loadModelFromURL(url) {
    const filename = url.split('/').pop();
    const extension = getFileExtension(url);
    cleanupCurrentModel();
    AppState.isLoadingModel = true;

    const loader = extension === 'stl' ? new STLLoader() : new GLTFLoader();
    const onLoad = extension === 'stl'
        ? (geometry) => (AppState.loadedModel = setupSTLModel(geometry), AppState.isLoadingModel = false)
        : (gltf) => (AppState.loadedModel = setupModel(gltf, filename), AppState.isLoadingModel = false);
    const onError = (error) => (console.error(error), AppState.isLoadingModel = false);

    loader.load(url, onLoad, undefined, onError);
}

export function loadDefaultModel() {
    cleanupCurrentModel();
    AppState.isLoadingModel = true;
    console.log('[asset] Загрузка base (4).glb');

    new GLTFLoader().load(
        'base (4).glb',
        (gltf) => (console.log('[asset] base (4).glb загружен'), AppState.loadedModel = setupModel(gltf, 'base (4).glb'), AppState.isLoadingModel = false),
        undefined,
        (error) => (console.warn('[asset] base (4).glb не найден, фолбек на куб', error), createFallbackCube(), AppState.isLoadingModel = false)
    );
}

const createFallbackCube = () => {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshPhysicalMaterial({ color: 0x3b82f6, metalness: 0.5, roughness: 0.2, clearcoat: 1.0 }));
    cube.name = "default_cube";
    AppState.loadedModel = setupModel({ scene: cube, animations: [] }, 'default_cube');
};