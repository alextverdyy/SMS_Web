// Js/app.js

/**
 * @global {import('chart.js')} Chart
 */

import { MotorManager } from './motorManager.js';
import { UIManager } from './uiManager.js';
import { Simulation } from './simulation.js';
import { URLHandler } from './urlHandler.js';
import { showToast } from './utils.js'; // Import if used directly here


class App {
    constructor() {
        this.motorManager = new MotorManager();
        // We pass references and callbacks to Uimanager

        this.uiManager = new UIManager(this.motorManager, this.simulation, {
            addCustomMotor: this.addCustomMotor.bind(this),
            addMotorToSimulation: this.addMotorToSimulation.bind(this),
            removeMotorFromSimulation: this.removeMotorFromSimulation.bind(this),
            updateSimulation: this.updateSimulation.bind(this),
            shareSimulation: this.shareSimulation.bind(this), // Sharing
            exportMotors: this.exportMotors.bind(this)

        });
        this.simulation = new Simulation('torque-speed-chart'); // Graphic Canvas ID

        this.urlHandler = new URLHandler(this.motorManager, this.uiManager);

        this.initializeApp();
    }

    async initializeApp() {
        console.log("Initializing Motor Simulator...");
        // Load initial engines list

        await this.motorManager.loadMotorList();
        // Show the List loaded in the UI

        this.uiManager.displayMotorList();

        // Try to load data from the URL

        const loadedFromUrl = this.urlHandler.loadSimulationFromURL();

        // Update selected table and initial simulation

        this.uiManager.updateSelectedMotorsTable();
        // Only updates the simulation if something was loaded or if there were already engines (although there should be no)

        if (loadedFromUrl || this.motorManager.getMotorsForSimulation().length > 0) {
             this.updateSimulation();
        }

        console.log("Motor Simulator Initialized.");
    }

    // ---Callbacks para UIManager ---


    addCustomMotor(motorData) {
        const result = this.motorManager.addCustomMotor(motorData);
        this.uiManager.displayAddMotorStatus(result.success, result.message);
        if (result.success) {
            this.uiManager.displayMotorList(); // Update general list

            showToast(`Motor "${result.motor.brandModel}" added.`, 'success');
        }
    }

    addMotorToSimulation(motor) {
        const added = this.motorManager.addMotorToSimulation(motor);
        if (added) {
            this.uiManager.updateSelectedMotorsTable();
            this.updateSimulation(); // Recalculate when adding

            showToast(`Motor "${motor.brandModel}" added to simulation.`, 'info');
        } else {
            showToast(`Motor "${motor.brandModel}" is already in the simulation.`, 'info');
        }
    }

    removeMotorFromSimulation(index) {
        const motor = this.motorManager.getMotorsForSimulation()[index]; // Obtain before erase

        this.motorManager.removeMotorFromSimulation(index);
        this.uiManager.updateSelectedMotorsTable();
        
        if (this.motorManager.getMotorsForSimulation().length >= 0) {
            this.updateSimulation(); // Recalculate all
        }

        if (motor) {
             showToast(`Motor "${motor.brandModel}" removed from simulation.`, 'info');
        }
    }

    updateSimulation() {
        const selectedMotors = this.motorManager.getMotorsForSimulation();
        const params = this.uiManager.getSimulationParameters();
        this.simulation.updateSimulationChart(selectedMotors, params);
    }

    shareSimulation() {
         this.urlHandler.shareSimulationLink();
    }

    exportMotors() {
        this.motorManager.exportMotors();
    }
}

// Start the application when the DOM is ready

document.addEventListener('DOMContentLoaded', () => {
    new App();
});
