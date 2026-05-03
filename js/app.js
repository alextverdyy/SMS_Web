// js/app.js

import { MotorManager } from './motorManager.js';
import { UIManager }    from './uiManager.js';
import { Simulation }   from './simulation.js';
import { URLHandler }   from './urlHandler.js';
import { showToast }    from './utils.js';

class App {
    constructor() {
        this.motorManager = new MotorManager();
        this.simulation   = new Simulation('torque-chart', 'power-chart');

        this.uiManager = new UIManager(this.motorManager, this.simulation, {
            addCustomMotor:          this._addCustomMotor.bind(this),
            addMotorToSimulation:    this._addMotorToSimulation.bind(this),
            removeMotorFromSimulation: this._removeMotorFromSimulation.bind(this),
            updateSimulation:        this._updateSimulation.bind(this),
            shareSimulation:         this._shareSimulation.bind(this),
            exportMotors:            () => this.motorManager.exportMotors(),
        });

        this.urlHandler = new URLHandler(this.motorManager, this.uiManager);
        this._initializeApp();
    }

    async _initializeApp() {
        await this.motorManager.loadMotorList();

        const loadedFromUrl = this.urlHandler.loadSimulationFromURL();
        this.uiManager.updateSimulationMotorsList();

        if (loadedFromUrl || this.motorManager.getMotorsForSimulation().length > 0) {
            this._updateSimulation();
        }
    }

    // ── Callbacks ─────────────────────────────────────────────────

    _addCustomMotor(motorData) {
        const result = this.motorManager.addCustomMotor(motorData);
        this.uiManager.displayAddMotorStatus(result.success, result.message);
        if (result.success) {
            this._addMotorToSimulation(result.motor);
        }
    }

    _addMotorToSimulation(motor) {
        this.motorManager.addMotorToSimulation(motor);
        this.uiManager.updateSimulationMotorsList();
        this._updateSimulation();
        showToast(`${motor.brandModel} added.`, 'info');
    }

    _removeMotorFromSimulation(instanceId) {
        this.motorManager.removeMotorFromSimulation(instanceId);
        this.uiManager.updateSimulationMotorsList();
        this._updateSimulation();
        showToast(`Motor removed.`, 'info');
    }

    _updateSimulation() {
        const motors = this.motorManager.getMotorsForSimulation();
        const params = this.uiManager.getSimulationParameters();
        const drive  = this.uiManager.getDriveSetup();
        this.simulation.updateSimulationChart(motors, params, drive);
    }

    _shareSimulation() {
        this.urlHandler.shareSimulationLink();
    }
}

document.addEventListener('DOMContentLoaded', () => new App());
