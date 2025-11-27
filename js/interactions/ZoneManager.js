// js/interactions/ZoneManager.js
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { AppState } from '../AppState.js';

export class ZoneManager {
    constructor() {
        Object.assign(this, { group: new THREE.Group(), ZONE_SIZE: 0.15, raycaster: new THREE.Raycaster() });
        this.group.name = "ZoneMarkersGroup";

        const baseMat = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide };
        this.editMat = new THREE.MeshBasicMaterial({ ...baseMat, color: 0x3b82f6, opacity: 0.5 });
        this.errorMat = new THREE.MeshBasicMaterial({ ...baseMat, color: 0xef4444, opacity: 0.6 });
        this.correctMat = new THREE.MeshBasicMaterial({ ...baseMat, color: 0x10b981, opacity: 0.6 });
    }

    exportZonesToJSON() {
        const { loadedModel, definedZones, uiManager } = AppState;
        if (!loadedModel) return uiManager?.showAlert("Ошибка", "Нет загруженной модели!");
        if (!definedZones.length) return uiManager?.showAlert("Внимание", "Список зон пуст.");

        const modelName = loadedModel.userData.filename || "model";
        const data = {
            modelName,
            timestamp: new Date().toISOString(),
            zones: definedZones.map(({ position, normal, expectedChar }) => ({
                position: position.toArray(), normal: normal.toArray(), expectedChar
            }))
        };

        const jsonStr = JSON.stringify(data, null, 2);

        console.log('%c📄 КОНФИГУРАЦИЯ ЗОН (JSON):', 'font-weight: bold; color: #3b82f6; margin-top: 10px;');
        console.log(`%c${jsonStr}`, 'background: #1e1e1e; color: #9cdcfe; font-family: "Fira Code", monospace; padding: 10px; border-radius: 6px; display: block; white-space: pre;');

        try {
            const a = document.createElement('a');
            a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(jsonStr);
            a.download = `zones_${modelName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
            a.style.display = 'none';
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            console.log(`%c[EXPORT] Файл сохранить тут: ${a.download}`, 'color: gray; font-style: italic;');
        } catch (e) {
            console.error("Сбой экспорта:", e);
            uiManager?.showAlert("Ошибка экспорта", "См. консоль.");
        }
    }

    importZonesFromJSON(jsonContent, isAutoLoad = false) {
        try {
            const data = JSON.parse(jsonContent);
            if (!Array.isArray(data.zones)) throw new Error("Неверный формат JSON");

            this.clearZones();
            AppState.definedZones = data.zones.map(d => ({
                id: Date.now() + Math.random(),
                position: new THREE.Vector3().fromArray(d.position),
                normal: new THREE.Vector3().fromArray(d.normal),
                expectedChar: d.expectedChar
            }));

            this.renderZones();
            const msg = `Загружено зон: ${AppState.definedZones.length}`;
            console.log(`%c[IMPORT] ${msg}`, 'color: #8b5cf6;');
            if (!isAutoLoad) AppState.uiManager?.showAlert("Успех", msg);

        } catch (e) {
            console.error("Ошибка импорта JSON:", e);
            if (!isAutoLoad) AppState.uiManager?.showAlert("Ошибка", "Не удалось прочитать файл.");
        }
    }

    addZone(worldPosition, worldNormal, char) {
        if (!AppState.loadedModel) return;
        
        const localPosition = AppState.loadedModel.worldToLocal(worldPosition.clone());
        const localNormal = worldNormal.clone().applyQuaternion(AppState.loadedModel.quaternion.clone().invert()).normalize();

        AppState.definedZones.push({ id: Date.now(), position: localPosition, normal: localNormal, expectedChar: char });
        this.renderZones();
        console.log(`%c[ZONE] Добавлена: ${char}`, 'color: #3b82f6; font-weight: bold;', localPosition);
    }

    clearZones() {
        AppState.definedZones.forEach(z => z.cachedDecalGeometry?.dispose());
        AppState.definedZones = [];
        this.renderZones();
    }

    renderZones() {
        const { loadedModel, isZoneEditMode, isReviewMode, scene, modelScale } = AppState;
        
        if (loadedModel) {
            const toRemove = [];
            loadedModel.traverse(c => c.userData.isZoneMarker && toRemove.push(c));
            toRemove.forEach(c => { c.geometry?.dispose(); c.removeFromParent(); });
        }

        if ((!isZoneEditMode && !isReviewMode) || !loadedModel) return;

        loadedModel.updateMatrixWorld(true);
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(loadedModel.matrixWorld);

        AppState.definedZones.forEach(zone => {
            const worldPos = zone.position.clone().applyMatrix4(loadedModel.matrixWorld);
            const worldNormal = zone.normal.clone().applyNormalMatrix(normalMatrix).normalize();
            const sizeVal = this.ZONE_SIZE * modelScale;

            if (!zone.cachedDecalGeometry) {
                const helper = new THREE.Object3D();
                helper.position.copy(worldPos);
                helper.lookAt(worldPos.clone().add(worldNormal));
                helper.updateMatrix();

                this.raycaster.set(worldPos.clone().add(worldNormal.clone().multiplyScalar(2)), worldNormal.clone().negate());
                const hit = this.raycaster.intersectObjects(loadedModel.children, true)[0];

                try {
                    if (hit?.object.isMesh) {
                        zone.cachedDecalGeometry = new DecalGeometry(hit.object, worldPos, new THREE.Euler().setFromRotationMatrix(helper.matrix), new THREE.Vector3(sizeVal, sizeVal, sizeVal * 0.4));
                        zone.isDecal = true;
                    } else throw new Error("No mesh");
                } catch {
                    zone.cachedDecalGeometry = new THREE.PlaneGeometry(sizeVal, sizeVal);
                    zone.isDecal = false;
                }
            }

            const mat = isReviewMode 
                ? (zone.lastStatus === 'correct' ? this.correctMat : this.errorMat) 
                : this.editMat;

            const mesh = new THREE.Mesh(zone.cachedDecalGeometry, mat.clone());
            
            if (!zone.isDecal) {
                mesh.position.copy(worldPos).add(worldNormal.clone().multiplyScalar(0.02));
                mesh.lookAt(worldPos.clone().add(worldNormal));
            }

            Object.assign(mesh, { renderOrder: 2, userData: { isZoneMarker: true } });
            scene.add(mesh);
            loadedModel.attach(mesh);
        });
    }

    validate() {
        if (!AppState.loadedModel) return { total: 0, correct: 0, isPerfect: false };

        let correctCount = 0;
        const limit = (this.ZONE_SIZE * AppState.modelScale) * 0.8;

        console.group('%c🔍 ОТЧЕТ ВАЛИДАЦИИ', 'font-size: 12px; font-weight: bold; color: #fff; background: #4b5563; padding: 2px 6px; border-radius: 3px;');
        
        AppState.definedZones.forEach((zone, i) => {
            const stickers = AppState.placedStickers.map(s => ({
                dist: (s.userData.localPosition || new THREE.Vector3()).distanceTo(zone.position),
                char: s.userData.char
            })).sort((a, b) => a.dist - b.dist);

            const closest = stickers[0];
            let status = 'missing';
            let style = 'color: #ef4444';
            let logMsg = 'НЕТ СТИКЕРА';

            if (closest && closest.dist <= limit) {
                if (closest.char === zone.expectedChar) {
                    status = 'correct'; correctCount++; 
                    logMsg = 'ВЕРНО'; style = 'color: #10b981; font-weight: bold';
                } else {
                    status = 'wrong_type'; 
                    logMsg = 'НЕВЕРНЫЙ СИМВОЛ'; style = 'color: #f59e0b';
                }
            } else if (closest) {
                logMsg = 'СЛИШКОМ ДАЛЕКО';
            }

            zone.lastStatus = status;
            console.log(
                `Зона #${i + 1} (${zone.expectedChar}): %c${logMsg}%c [Дист: ${closest?.dist.toFixed(3) ?? 'N/A'}]`,
                style, 
                'color: gray'
            );
        });
        console.groupEnd();

        return { total: AppState.definedZones.length, correct: correctCount, isPerfect: correctCount === AppState.definedZones.length };
    }

    showGhostStickers() {
        if (!AppState.loadedModel) return;
        const ghosts = [];
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(AppState.loadedModel.matrixWorld);

        AppState.definedZones.forEach(zone => {
            if (zone.lastStatus === 'correct') return;
            const texture = AppState.textureCache.get(zone.expectedChar);
            if (!texture) return;

            const worldPos = zone.position.clone().applyMatrix4(AppState.loadedModel.matrixWorld);
            const worldNormal = zone.normal.clone().applyNormalMatrix(normalMatrix).normalize();
            const size = AppState.stickerSize * AppState.modelScale;

            const mesh = new THREE.Mesh(
                new THREE.PlaneGeometry(size, size),
                new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide })
            );

            mesh.position.copy(worldPos).add(worldNormal.clone().multiplyScalar(0.05));
            mesh.lookAt(worldPos.clone().add(worldNormal));
            mesh.renderOrder = 9999;

            AppState.scene.add(mesh);
            AppState.loadedModel.attach(mesh);
            ghosts.push(mesh);
        });

        setTimeout(() => ghosts.forEach(g => { g.removeFromParent(); g.geometry?.dispose(); g.material?.dispose(); }), 3000);
    }
}