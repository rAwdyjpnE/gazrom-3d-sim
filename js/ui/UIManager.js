// js/ui/UIManager.js
import { AppState } from '../AppState.js';
import { tickets } from '../tickets.js';
import { loadModel } from '../io/AssetLoader.js';

export class UIManager {
    constructor(sceneManager, interactionManager, zoneManager) {
        this.sceneManager = sceneManager;
        this.interactionManager = interactionManager;
        this.zoneManager = zoneManager;
        this.modal = document.getElementById('custom-modal');
        this.modalTitle = document.getElementById('modal-title');
        this.modalMessage = document.getElementById('modal-message');
        this.confirmBtn = document.getElementById('modal-confirm');
        this.cancelBtn = document.getElementById('modal-cancel');
        this.activeCallback = null;
        
        this.initModeSwitcher();
        this.initTools();
        this.initStickerDrawer();
        this.initAdminTools();
        this.initCheckSystem();
        this.initExamSystem();

        const fileInput = document.getElementById('fileInput');
        const importBtn = document.getElementById('tool-import');
        if (importBtn && fileInput) {
            importBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files[0]) loadModel(e.target.files[0]);
                e.target.value = '';
            });
        }
    }

    showAlert(title, message, callback) {
        this.modalTitle.textContent = title;
        this.modalMessage.textContent = message;
        this.cancelBtn.classList.add('hidden');
        this.confirmBtn.textContent = "OK";
        this.confirmBtn.onclick = () => {
            this.modal.classList.add('hidden');
            if (callback) callback();
        };
        this.modal.classList.remove('hidden');
    }

    showConfirm(title, message, onConfirm, onCancel) {
        this.modalTitle.textContent = title;
        this.modalMessage.textContent = message;
        this.cancelBtn.classList.remove('hidden');
        this.confirmBtn.textContent = "Да";
        this.confirmBtn.onclick = () => (this.modal.classList.add('hidden'), onConfirm?.());
        this.cancelBtn.onclick = () => (this.modal.classList.add('hidden'), onCancel?.());
        this.modal.classList.remove('hidden');
    }

    initModeSwitcher() {
        const modeBtns = document.querySelectorAll('.mode-btn');
        const [toolsPanel, testingView, adminPanel] = ['tools-panel', 'testing-view', 'admin-panel'].map(id => document.getElementById(id));
        
        modeBtns.forEach(btn => btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const isPractice = btn.dataset.mode === 'practice';
            toolsPanel?.classList.toggle('hidden', !isPractice);
            testingView?.classList.toggle('hidden', isPractice);
            adminPanel?.classList.toggle('hidden', !isPractice);
            if (!isPractice) document.getElementById('sticker-drawer')?.classList.remove('open');
        }));
    }

    initTools() {
        ['select', 'sticker', 'eraser'].forEach(toolId => 
            document.getElementById(`tool-${toolId}`)?.addEventListener('click', () => this.setTool(toolId))
        );
    }

    setTool(toolId) {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`tool-${toolId}`)?.classList.add('active');
        
        Object.assign(AppState, { activeTool: toolId, isZoneEditMode: false, isReviewMode: false });
        this.zoneManager.renderZones();

        const [drawer, checkArea, canvas] = ['sticker-drawer', 'check-area', 'canvas'].map(id => document.getElementById(id));
        const isSticker = toolId === 'sticker';
        drawer?.classList.toggle('open', isSticker);
        checkArea?.classList.toggle('hidden', !isSticker);
        
        AppState.orbitControls.enabled = toolId === 'select';
        canvas.style.cursor = toolId === 'select' ? 'default' : toolId === 'eraser' ? 'crosshair' : 'copy';
    }

    initStickerDrawer() {
        const options = document.querySelectorAll('.sticker-option');
        options.forEach(opt => opt.addEventListener('click', () => {
            options.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            AppState.selectedStickerChar = opt.dataset.sticker;
        }));
    }

    initAdminTools() {
        const [toggleBtn, saveBtn, loadBtn, clearBtn, zoneInput] = ['btn-toggle-zone-edit', 'btn-save-zones', 'btn-load-zones', 'btn-clear-zones', 'zoneInput'].map(id => document.getElementById(id));

        toggleBtn?.addEventListener('click', () => {
            AppState.isZoneEditMode = !AppState.isZoneEditMode;
            AppState.activeTool = AppState.isZoneEditMode ? 'zone_edit' : (document.getElementById('tool-select').click(), 'select');
            AppState.isReviewMode = false;
            toggleBtn.style.background = AppState.isZoneEditMode ? '#ef4444' : '';
            toggleBtn.textContent = AppState.isZoneEditMode ? 'Stop Editing' : 'Edit Zones';
            this.zoneManager.renderZones();
        });

        saveBtn?.addEventListener('click', () => (console.log('[ui] Сохранение зон'), this.zoneManager.exportZonesToJSON()));
        
        if (loadBtn && zoneInput) {
            loadBtn.addEventListener('click', () => zoneInput.click());
            zoneInput.addEventListener('change', (e) => {
                if (!e.target.files[0]) return;
                const reader = new FileReader();
                reader.onload = (evt) => this.zoneManager.importZonesFromJSON(evt.target.result);
                reader.readAsText(e.target.files[0]);
                e.target.value = '';
            });
        }

        clearBtn?.addEventListener('click', () => this.showConfirm("Очистка зон", "Вы уверены, что хотите удалить все зоны?", () => this.zoneManager.clearZones()));
    }

    initCheckSystem() {
        const [modal, title, msg, checkBtn, closeBtn, reviewBtn] = ['result-modal', 'result-title', 'result-message', 'btn-check-task', 'btn-close-result', 'btn-review'].map(id => document.getElementById(id));

        checkBtn?.addEventListener('click', () => {
            const result = this.zoneManager.validate();
            modal?.classList.remove('hidden');
            if (result.isPerfect) {
                title.textContent = "Отлично!";
                title.style.color = "#10b981";
                msg.textContent = `Все стикеры (${result.correct}/${result.total}) расставлены верно!`;
                reviewBtn?.classList.add('hidden');
            } else {
                title.textContent = "Есть ошибки";
                title.style.color = "#ef4444";
                msg.textContent = `Верно: ${result.correct} из ${result.total}. Некоторые стикеры пропущены или неверны.`;
                reviewBtn?.classList.remove('hidden');
            }
        });

        closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
        reviewBtn?.addEventListener('click', () => {
            modal?.classList.add('hidden');
            Object.assign(AppState, { isReviewMode: true, isZoneEditMode: false });
            this.zoneManager.renderZones();
            this.zoneManager.showGhostStickers();
            document.getElementById('tool-select')?.click();
        });
    }

    initExamSystem() {
        const [startBtn, container] = ['startTestBtn', 'test-content'].map(id => document.getElementById(id));
        if (!startBtn) return;

        startBtn.addEventListener('click', () => {
            const ticketList = typeof tickets !== 'undefined' ? tickets : [{ id: 1, title: "Тестовый билет", scenario: "Описание задачи...", questions: [{ id: "q1", text: "Вопрос 1" }] }];
            const randomTicket = ticketList[Math.floor(Math.random() * ticketList.length)];
            container.innerHTML = `<h3>${randomTicket.title}</h3><p style="margin-bottom:20px; color: var(--c-text-secondary)">${randomTicket.scenario}</p>` +
                randomTicket.questions.map(q => `<div class="question-card"><h3>${q.text}</h3><textarea id="ans-${q.id}"></textarea></div>`).join('') +
                `<button id="submitExam" class="btn-primary" style="margin-top:20px">Отправить на проверку</button>`;
            
            setTimeout(() => document.getElementById('submitExam')?.addEventListener('click', () => container.innerHTML = `<h3 style="color: #4ade80">Ответы приняты!</h3>`), 100);
        });
    }
}