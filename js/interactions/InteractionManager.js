// js/interactions/InteractionManager.js
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { AppState } from '../AppState.js';

export class InteractionManager {
    constructor(canvas, zoneManager) {
        Object.assign(this, { canvas, zoneManager, raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(), lastMouseX: 0, lastMouseY: 0, hoveredSticker: null });

        const commonMatProps = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide };
        this.previewMaterialSticker = new THREE.MeshBasicMaterial({ ...commonMatProps, opacity: 0.6 });
        this.previewMaterialZone = new THREE.MeshBasicMaterial({ ...commonMatProps, color: 0x3b82f6, opacity: 0.5 });

        this.previewMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.previewMaterialSticker);
        this.previewMesh.visible = false;
        this.previewMesh.renderOrder = 9999;
        
        if (AppState.scene) AppState.scene.add(this.previewMesh);

        this.initListeners();
    }

    getTextureForChar(char) {
        if (AppState.textureCache.has(char)) return AppState.textureCache.get(char);

        const canvas = document.createElement('canvas');
        Object.assign(canvas, { width: 256, height: 256 });
        const ctx = canvas.getContext('2d');
        
        ctx.font = 'bold 200px Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'white'; ctx.fillText(char, 128, 128);

        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        AppState.textureCache.set(char, texture);
        return texture;
    }

    getIntersection(clientX, clientY, objects) {
        if (!objects?.length) return null;
        const { left, top, width, height } = this.canvas.getBoundingClientRect();
        this.mouse.set(((clientX - left) / width) * 2 - 1, -((clientY - top) / height) * 2 + 1);
        this.raycaster.setFromCamera(this.mouse, AppState.camera);
        return this.raycaster.intersectObjects(objects, true)[0] || null;
    }

    updatePreview(intersection, toolType) {
        if (!intersection) return (this.previewMesh.visible = false);

        const { point, face, object } = intersection;
        const normal = face.normal.clone().transformDirection(object.matrixWorld).normalize();
        
        this.previewMesh.position.copy(point).add(normal.clone().multiplyScalar(0.02));
        this.previewMesh.lookAt(point.clone().add(normal));

        const isZone = toolType === 'zone_edit';
        const sizeVal = (isZone ? this.zoneManager.ZONE_SIZE : AppState.stickerSize * 0.8) * AppState.modelScale;
        this.previewMesh.scale.setScalar(sizeVal).setZ(1);

        if (!isZone && AppState.selectedStickerChar) {
            this.previewMaterialSticker.map = this.getTextureForChar(AppState.selectedStickerChar);
            this.previewMaterialSticker.color.setHex(0xffffff);
            this.previewMesh.material = this.previewMaterialSticker;
        } else {
            this.previewMesh.material = this.previewMaterialZone;
        }
        this.previewMesh.visible = true;
    }

    removePreview() { if (this.previewMesh) this.previewMesh.visible = false; }

    updatePreviewFromLoop() {
        if (!AppState.loadedModel) return this.removePreview();
        const { activeTool, isZoneEditMode, selectedStickerChar: char } = AppState;
        
        if ((activeTool === 'sticker' && char) || (isZoneEditMode && char)) {
            const hit = this.getIntersection(this.lastMouseX, this.lastMouseY, [AppState.loadedModel]);
            this.updatePreview(hit, isZoneEditMode ? 'zone_edit' : 'sticker');
        } else {
            this.removePreview();
        }
    }

    handleClick(e) {
        if (e.button !== 0 || !AppState.loadedModel) return;
        const { activeTool, isZoneEditMode, selectedStickerChar: char } = AppState;

        if (isZoneEditMode && char) {
            const hit = this.getIntersection(e.clientX, e.clientY, [AppState.loadedModel]);
            hit && this.zoneManager.addZone(hit.point, hit.face.normal, char);
            return;
        }

        if (activeTool === 'eraser') return this.handleEraserClick(e);

        if (activeTool === 'sticker' && char) {
            const hit = this.getIntersection(e.clientX, e.clientY, [AppState.loadedModel]);
            if (hit && !hit.object.userData.isSticker) this.placeSticker(hit);
        }
    }

    placeSticker(intersection) {
        const { selectedStickerChar: char, stickerSize, modelScale, loadedModel, scene, placedStickers } = AppState;
        const { point, face, object: targetMesh } = intersection;
        
        const normal = face.normal.clone().transformDirection(targetMesh.matrixWorld).normalize();
        const lookTarget = point.clone().add(normal);
        const baseSize = stickerSize * modelScale * 0.8;
        
        let stickerMesh;
        const matProps = { map: this.getTextureForChar(char), transparent: true, side: THREE.DoubleSide };

        if (targetMesh.isMesh) {
            try {
                const helper = new THREE.Object3D();
                helper.position.copy(point);
                helper.lookAt(lookTarget);
                helper.updateMatrix();
                
                const decalGeo = new DecalGeometry(targetMesh, point, new THREE.Euler().setFromRotationMatrix(helper.matrix), new THREE.Vector3(baseSize, baseSize, baseSize * 0.4));
                stickerMesh = new THREE.Mesh(decalGeo, new THREE.MeshStandardMaterial({ 
                    ...matProps, opacity: 1.0, depthTest: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.5, metalness: 0.0, side: THREE.FrontSide 
                }));
            } catch (err) {
                console.warn('Ошибка создания декали, используем плоскость:', err);
            }
        }

        if (!stickerMesh) {
            stickerMesh = new THREE.Mesh(new THREE.PlaneGeometry(baseSize, baseSize), new THREE.MeshStandardMaterial(matProps));
            stickerMesh.position.copy(point).add(normal.multiplyScalar(0.02));
            stickerMesh.lookAt(lookTarget);
        }

        stickerMesh.renderOrder = 1;
        (loadedModel || scene).attach(stickerMesh);

        const localPosition = loadedModel.worldToLocal(point.clone());
        stickerMesh.userData = { isSticker: true, char, position: point.clone(), localPosition };
        placedStickers.push(stickerMesh);

        console.log('%c[STICKER] Размещен успешно', 'color: #10b981; font-weight: bold; font-size: 12px;');
        const logData = JSON.stringify({ символ: char, локальная_позиция: localPosition }, null, 2);
        console.log(`%c${logData}`, 'background: #282c34; color: #abb2bf; font-family: monospace; padding: 8px; border-radius: 4px; display: block;');
    }

    handleEraserClick(e) {
        const hit = this.getIntersection(e.clientX, e.clientY, AppState.placedStickers);
        if (!hit) return;

        const { object } = hit;
        object.removeFromParent();
        object.geometry?.dispose();
        object.material?.dispose();
        
        const idx = AppState.placedStickers.indexOf(object);
        if (idx > -1) AppState.placedStickers.splice(idx, 1);
    }

    handleMouseMove(e) {
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        if (AppState.activeTool !== 'eraser') return;

        const hit = this.getIntersection(e.clientX, e.clientY, AppState.placedStickers);
        document.body.style.cursor = hit ? 'crosshair' : 'default';

        if (this.hoveredSticker && this.hoveredSticker !== hit?.object) {
            this.hoveredSticker.material.color.setHex(0xffffff);
            this.hoveredSticker = null;
        }

        if (hit && this.hoveredSticker !== hit.object) {
            this.hoveredSticker = hit.object;
            this.hoveredSticker.material.color.setHex(0xff0000);
        }
    }

    initListeners() {
        this.canvas.addEventListener('mousedown', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => { this.removePreview(); this.lastMouseX = 0; this.lastMouseY = 0; });
    }
}