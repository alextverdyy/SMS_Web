// js/uiManager.js

import { debounce, showToast } from './utils.js';

export class UIManager {
    constructor(motorManager, simulation, appCallbacks) {
        this.motorManager  = motorManager;
        this.simulation    = simulation;
        this.appCallbacks  = appCallbacks;

        this.activeChart   = 'torque';
        this.driveSetup    = '1motor';

        this._initializeDOMElements();
        this._setupEventListeners();
        this._setupModals();
    }

    _initializeDOMElements() {
        // Layout
        this.sidebar             = document.querySelector('.sidebar');
        this.simulationForm      = document.getElementById('simulation-form');
        this.simulationMotorsList = document.getElementById('simulation-motors-list');
        this.motorsEmptyState    = document.getElementById('motors-empty-state');

        // Main controls
        this.motorFilterInput    = document.getElementById('motor-filter-input');
        this.suggestionsDiv      = document.getElementById('motor-suggestions');
        this.driveSetupSelector  = document.getElementById('drive-setup-selector');

        // Actions
        this.shareBtn            = document.getElementById('share-btn');
        this.exportChartBtn      = document.getElementById('export-chart-btn');
        this.copyChartBtn        = document.getElementById('copy-chart-panel-btn'); // btn inside chart header
        this.browseMotorsBtn     = document.getElementById('browse-motors-btn');
        this.addCustomBtn        = document.getElementById('add-custom-btn');

        // Modals
        this.modals              = document.querySelectorAll('.modal');
        this.closeModalBtns      = document.querySelectorAll('.modal-close');
        this.addMotorForm        = document.getElementById('add-motor-form');
        this.addMotorStatus      = document.getElementById('add-motor-status');
        this.modalMotorFilter    = document.getElementById('modal-motor-filter');
        this.motorListContent    = document.getElementById('motor-list-content');
        this.exportMotorsBtn     = document.getElementById('export-motors-btn');
        this.importMotorsBtn     = document.getElementById('import-motors-btn');
        this.importFileInput     = document.getElementById('import-file-input');

        // Chart tabs
        this.chartTabs           = document.querySelectorAll('.chart-tab');
        this.chartInstances      = document.querySelectorAll('.chart-instance');

        // Share modal
        this.shareUrlInput      = document.getElementById('share-url-input');
        this.copyUrlBtn         = document.getElementById('copy-url-btn');
        this.generateShareBtn   = document.getElementById('generate-share-btn');

        // Theme selector
        this.themeSwatches      = document.getElementById('theme-swatches');
    }

    _setupEventListeners() {
        // Simulation parameter changes
        const debouncedUpdate = debounce(() => this.appCallbacks.updateSimulation(), 400);
        this.simulationForm.addEventListener('input', debouncedUpdate);

        // Global RMS toggle
        document.getElementById('global-rms')?.addEventListener('change', () => {
            this.appCallbacks.updateSimulation();
            this.updateSimulationMotorsList();
        });

        // Drive setup selector
        this.driveSetupSelector.addEventListener('click', e => {
            const btn = e.target.closest('.drive-opt');
            if (!btn) return;
            document.querySelectorAll('.drive-opt').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.driveSetup = btn.dataset.setup;
            this.appCallbacks.updateSimulation();
        });

        // Chart tabs
        this.chartTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const which = tab.dataset.chart;
                this.chartTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.chartInstances.forEach(c => c.classList.remove('active'));
                document.getElementById(`${which}-chart`)?.classList.add('active');
                this.activeChart = which;
                if (this.simulation) this.simulation.onChartTabSwitch(which);
                this.appCallbacks.updateSimulation();
            });
        });

        // Motor search (sidebar)
        this.motorFilterInput.addEventListener('input', () => this._handleSidebarSearch());
        this.motorFilterInput.addEventListener('focus', () => this._handleSidebarSearch());
        document.addEventListener('click', e => {
            if (!this.motorFilterInput.contains(e.target) && !this.suggestionsDiv.contains(e.target)) {
                this._hideSuggestions();
            }
            const popChip = e.target.closest('.pop-chip');
            if (popChip) {
                const brandModel = popChip.dataset.motor;
                const motor = this.motorManager.getPreconfiguredMotors().find(m => m.brandModel === brandModel);
                if (motor) this.appCallbacks.addMotorToSimulation(motor);
            }
        });

        // Actions
        const handleCopyChart = async () => {
            const params = this.getSimulationParameters();
            const motors = this.motorManager.getMotorsForSimulation();
            const ok = await this.simulation?.copyChartToClipboard(params, motors);
            showToast(ok ? 'Chart copied!' : 'Copy failed.', ok ? 'success' : 'error');
        };
        this.exportChartBtn?.addEventListener('click', handleCopyChart);
        this.copyChartBtn?.addEventListener('click', handleCopyChart);

        this.shareBtn?.addEventListener('click', () => {
            if (this.motorManager.getMotorsForSimulation().length === 0) {
                showToast('Add a motor first.', 'error');
                return;
            }
            this.shareUrlInput.value = '';
            this.openModal('share-modal');
        });
        this.generateShareBtn?.addEventListener('click', () => this.appCallbacks.shareSimulation());
        this.copyUrlBtn?.addEventListener('click', () => {
            this.shareUrlInput.select();
            navigator.clipboard.writeText(this.shareUrlInput.value)
                .then(() => showToast('Link copied!', 'success'))
                .catch(() => showToast('Failed to copy.', 'error'));
        });

        // Modal triggers
        this.browseMotorsBtn?.addEventListener('click', () => {
            this.displayMotorList();
            this.openModal('motor-browser-modal');
        });
        this.addCustomBtn?.addEventListener('click', () => this.openModal('add-motor-modal'));
        this.addMotorForm?.addEventListener('submit', e => {
            e.preventDefault();
            this._handleAddCustomMotor();
        });
        this.modalMotorFilter?.addEventListener('input', () => this._filterMotorGrid(this.modalMotorFilter.value));
        this.exportMotorsBtn?.addEventListener('click', () => this.appCallbacks.exportMotors());
        this.importMotorsBtn?.addEventListener('click', () => this.importFileInput.click());
        this.importFileInput?.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const result = await this.motorManager.importMotors(file);
                showToast(result.message, result.addedCount > 0 ? 'success' : 'info');
                if (result.addedCount > 0) this.displayMotorList();
            } catch (err) {
                showToast(`Import failed: ${err.message}`, 'error');
            } finally {
                e.target.value = null;
            }
        });

        // Theme
        this.themeSwatches?.addEventListener('click', e => {
            const swatch = e.target.closest('.theme-swatch');
            if (!swatch) return;
            const theme = swatch.dataset.theme;
            this._applyTheme(theme);
            localStorage.setItem('stepsim-theme', theme);
        });

        const savedTheme = localStorage.getItem('stepsim-theme');
        if (savedTheme) this._applyTheme(savedTheme);
    }

    _applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (this.themeSwatches) {
            this.themeSwatches.querySelectorAll('.theme-swatch').forEach(s => {
                s.classList.toggle('active', s.dataset.theme === theme);
            });
        }
        if (this.simulation) this.simulation.updateThemeColors();
    }

    // ── Sidebar search ────────────────────────────────────────────

    _handleSidebarSearch() {
        const q = this.motorFilterInput.value;
        if (q.trim().length < 1) { this._hideSuggestions(); return; }
        const matches = this.motorManager.filterMotors(q).slice(0, 8);
        this._showSuggestions(matches);
    }

    _showSuggestions(motors) {
        this.suggestionsDiv.innerHTML = '';
        if (motors.length === 0) {
            this.suggestionsDiv.innerHTML = '<div class="suggestion-item empty">No motors found</div>';
        } else {
            motors.forEach(m => {
                const div = document.createElement('div');
                div.className = 'suggestion-item';
                div.innerHTML = `
                    <span class="sugg-name">${m.brandModel}</span>
                `;
                div.addEventListener('click', () => {
                    this.appCallbacks.addMotorToSimulation(m);
                    this.motorFilterInput.value = '';
                    this._hideSuggestions();
                });
                this.suggestionsDiv.appendChild(div);
            });
        }
        this.suggestionsDiv.style.display = 'block';
    }

    _hideSuggestions() {
        this.suggestionsDiv.style.display = 'none';
    }

    // ── Simulation motors sidebar list ────────────────────────────

    updateSimulationMotorsList() {
        const motors = this.motorManager.getMotorsForSimulation();

        // Clear existing, preserve empty state if needed
        Array.from(this.simulationMotorsList.children).forEach(c => {
            if (!c.id?.includes('empty')) c.remove();
        });

        if (motors.length === 0) {
            this.motorsEmptyState.style.display = '';
            return;
        }
        this.motorsEmptyState.style.display = 'none';

        const params = this.getSimulationParameters();
        const countMap = {};
        motors.forEach(m => { countMap[m.brandModel] = (countMap[m.brandModel] || 0) + 1; });
        const idxMap = {};

        motors.forEach((motor, index) => {
            const color = this.simulation?.getMotorColor(index, motors.length) || '#3b82f6';
            idxMap[motor.brandModel] = (idxMap[motor.brandModel] || 0) + 1;
            const showBadge = countMap[motor.brandModel] > 1;

            const mVolt = motor.inputVoltageV ?? params.inputVoltage;
            const mCurr = motor.maxDriveCurrentA ?? motor.ratedCurrentA;
            const mPull = motor.pulleySizeMM ?? params.pulleySize;
            
            const displayCurrent = motor.useRms ? (mCurr * 0.707) : mCurr;
            
            const torqueAt200 = this.simulation?.getTorqueAtSpeed(motor, mVolt, mCurr, 200, mPull, params.acceleration) || 0;
            const reqTorque   = this.simulation?.getRequiredTorque(params, this.driveSetup) || 0;
            const isUnderpowered = torqueAt200 < reqTorque;

             const card = document.createElement('div');
             card.className = `sim-motor-card${isUnderpowered ? ' underpowered' : ''}`;
             card.innerHTML = `
                 <div class="sim-motor-top">
                     <div class="sim-motor-color" style="background:${color}"></div>
                     <div class="sim-motor-name" title="${motor.brandModel}">${motor.brandModel}</div>
                     ${isUnderpowered ? '<i class="fas fa-triangle-exclamation warn-icon" title="Potentially underpowered"></i>' : ''}
                     ${showBadge ? `<div class="sim-motor-badge">#${idxMap[motor.brandModel]}</div>` : ''}
                     <button class="sim-motor-remove" title="Remove motor"><i class="fas fa-times"></i></button>
                 </div>
                 <div class="sim-motor-params">
                     <div class="sim-param-field">
                         <label class="sim-param-label">V</label>
                         <input class="sim-param-input" type="number" step="any" value="${motor.inputVoltageV ?? params.inputVoltage}" data-field="inputVoltageV">
                     </div>
                     <div class="sim-param-field">
                         <label class="sim-param-label" data-current-label>${motor.useRms ? 'Arms' : 'A'}</label>
                         <input class="sim-param-input" type="number" step="any" value="${+displayCurrent.toFixed(4)}" ${motor.useRms ? 'disabled' : ''} data-field="maxDriveCurrentA" title="${motor.useRms ? 'RMS current (peak × 0.707) — edit the peak value via the motor settings' : 'Peak drive current'}">
                     </div>
                     <div class="sim-param-field">
                         <label class="sim-param-label">T</label>
                         <input class="sim-param-input" type="number" step="any" value="${motor.pulleySizeMM ?? params.pulleySize}" data-field="pulleySizeMM">
                     </div>
                 </div>
                 <div class="sim-motor-options">
                     <div class="rms-header">
                         <span class="rms-title">RMS Safe</span>
                         <label class="switch">
                             <input type="checkbox" class="motor-rms-toggle" ${motor.useRms ? 'checked' : ''}>
                             <span class="slider"></span>
                         </label>
                     </div>
                 </div>
             `;

            // Remove button
            card.querySelector('.sim-motor-remove').onclick = (e) => {
                e.stopPropagation();
                this.appCallbacks.removeMotorFromSimulation(motor.instanceId);
            };

            card.querySelector('.motor-rms-toggle').onchange = (e) => {
                motor.useRms = e.target.checked;
                const currInput = card.querySelector('[data-field="maxDriveCurrentA"]');
                const currLabel = card.querySelector('[data-current-label]');
                if (currInput) {
                    const peakCurr = motor.maxDriveCurrentA ?? motor.ratedCurrentA;
                    currInput.value = +(motor.useRms ? peakCurr * 0.707 : peakCurr).toFixed(4);
                    currInput.disabled = motor.useRms;
                    currInput.title = motor.useRms
                        ? 'RMS current (peak × 0.707) — edit the peak value via the motor settings'
                        : 'Peak drive current';
                }
                if (currLabel) currLabel.textContent = motor.useRms ? 'Arms' : 'A';
                this.appCallbacks.updateSimulation();
            };

            const debouncedUpdate = debounce(() => this.appCallbacks.updateSimulation(), 400);

            card.querySelectorAll('.sim-param-input').forEach(input => {
                input.oninput = () => {
                    const field = input.dataset.field;
                    let val = parseFloat(input.value);
                    if (field === 'maxDriveCurrentA' && motor.useRms) {
                        val = val / 0.707;
                    }
                    motor[field] = isNaN(val) ? null : val;
                    debouncedUpdate();
                };
            });


            this.simulationMotorsList.appendChild(card);
        });
    }

    // ── Motor browser grid ────────────────────────────────────────

    displayMotorList(filterText = '') {
        this.motorListContent.innerHTML = '';
        let motors = this.motorManager.getPreconfiguredMotors();
        if (filterText) {
            const q = filterText.toLowerCase();
            motors = motors.filter(m => m.brandModel?.toLowerCase().includes(q));
        }

        if (motors.length === 0) {
            this.motorListContent.innerHTML = '<p style="color:var(--text-muted);font-size:.82rem;padding:.5rem 0">No motors found.</p>';
            return;
        }

        motors.forEach(motor => {
            const card = this._createMotorCard(motor);
            this.motorListContent.appendChild(card);
        });
    }

    _filterMotorGrid(text) {
        this.displayMotorList(text);
    }

    _createMotorCard(motor) {
        const count    = this.motorManager.countInstances(motor.brandModel);
        const card     = document.createElement('div');
        card.className = `motor-card${count > 0 ? ' in-simulation' : ''}`;
        card.id        = `motor-card-${motor.id}`;

        card.innerHTML = `
            <div class="motor-card-name">
                ${motor.brand} <span class="model">${motor.model ?? ''}</span>
            </div>
            <div class="motor-card-specs">
                <div class="motor-spec"><strong>Step</strong>${motor.stepAngleDeg ?? 'N/A'}°</div>
                <div class="motor-spec"><strong>Rated I</strong>${motor.ratedCurrentA ?? 'N/A'} A</div>
                <div class="motor-spec"><strong>Torque</strong>${motor.torqueNCm ?? 'N/A'} N·cm</div>
                <div class="motor-spec"><strong>L</strong>${motor.inductanceMH ?? 'N/A'} mH</div>
                <div class="motor-spec"><strong>R</strong>${motor.resistanceOhms ?? 'N/A'} Ω</div>
                <div class="motor-spec"><strong>Inertia</strong>${motor.rotorInertiaGCm2 ?? 'N/A'} g·cm²</div>
            </div>
            <div class="motor-card-actions">
                <div class="motor-instance-count">${count > 0 ? `${count} in simulation` : ''}</div>
                <button class="motor-add-btn" title="Add instance to simulation">
                    <i class="fas fa-plus"></i> Add
                </button>
            </div>
        `;

        card.querySelector('.motor-add-btn').addEventListener('click', e => {
            e.stopPropagation();
            this.appCallbacks.addMotorToSimulation(motor);
            const updatedCard = this._createMotorCard(
                this.motorManager.getPreconfiguredMotors().find(m => m.brandModel === motor.brandModel) || motor
            );
            card.replaceWith(updatedCard);
        });

        return card;
    }

    // ── Add custom motor ──────────────────────────────────────────

    _handleAddCustomMotor() {
        this.addMotorStatus.textContent = '';
        this.addMotorStatus.className   = 'form-status';

        const motorData = {
            brandModel:      document.getElementById('new-motor-brandmodel').value.trim(),
            stepAngleDeg:    parseFloat(document.getElementById('new-motor-stepangle').value),
            ratedCurrentA:   parseFloat(document.getElementById('new-motor-current').value),
            torqueNCm:       parseFloat(document.getElementById('new-motor-torque').value),
            inductanceMH:    parseFloat(document.getElementById('new-motor-inductance').value),
            resistanceOhms:  parseFloat(document.getElementById('new-motor-resistance').value),
            rotorInertiaGCm2: parseFloat(document.getElementById('new-motor-inertia').value) || null,
            nema:            parseInt(document.getElementById('new-motor-nema')?.value) || null,
            bodyLengthMm:    parseFloat(document.getElementById('new-motor-length').value) || null,
            useRms:          document.getElementById('new-motor-rms').checked
        };

        this.appCallbacks.addCustomMotor(motorData);
    }

    displayAddMotorStatus(success, message) {
        this.addMotorStatus.textContent = message;
        this.addMotorStatus.className   = `form-status ${success ? 'success' : 'error'}`;
        if (success) {
            setTimeout(() => {
                this.closeAllModals();
                this.addMotorForm.reset();
            }, 1000);
        }
    }

    // ── Parameters ────────────────────────────────────────────────

    getSimulationParameters() {
        return {
            inputVoltage: parseFloat(document.getElementById('input-voltage').value) || 24,
            pulleySize:   parseFloat(document.getElementById('pulley-size').value)   || 20,
            acceleration: parseFloat(document.getElementById('acceleration').value)  || 20000,
            toolheadMass: parseFloat(document.getElementById('toolhead-mass').value) || 500,
            globalRms:    document.getElementById('global-rms').checked
        };
    }

    setSimulationParameters(params) {
        if (params.inputVoltage !== undefined) document.getElementById('input-voltage').value = params.inputVoltage;
        if (params.pulleySize   !== undefined) document.getElementById('pulley-size').value   = params.pulleySize;
        if (params.acceleration !== undefined) document.getElementById('acceleration').value  = params.acceleration;
        if (params.toolheadMass !== undefined) document.getElementById('toolhead-mass').value = params.toolheadMass;
        if (params.globalRms    !== undefined) document.getElementById('global-rms').checked = params.globalRms;
        if (params.driveSetup) {
            this.driveSetup = params.driveSetup;
            document.querySelectorAll('.drive-opt').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.setup === params.driveSetup);
            });
        }
    }

    getDriveSetup() { return this.driveSetup; }
    setShareUrl(url) { this.shareUrlInput.value = url; }

    // ── Modal system ──────────────────────────────────────────────

    _setupModals() {
        this.modals.forEach(modal => {
            modal.addEventListener('click', e => { if (e.target === modal) this.closeAllModals(); });
        });
        this.closeModalBtns.forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });
        window.addEventListener('keydown', e => { if (e.key === 'Escape') this.closeAllModals(); });
    }

    openModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    closeAllModals() {
        this.modals.forEach(m => m.classList.remove('active'));
        document.body.style.overflow = '';
    }
}
