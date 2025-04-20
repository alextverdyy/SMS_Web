// Js/motor manager.js

import { showToast } from './utils.js';

export class MotorManager {
    constructor() {
        this.preconfiguredMotors = [];
        this.motorsForSimulation = [];
    }

    /**
     * Load the list of engines from the JSON file.
     * @param {string} url -The json file url of engines.
     * @returns {Promise<void>}
     */
    async loadMotorList(url = 'motors.json') {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            this.preconfiguredMotors = await response.json();
            // Order to load
            this.preconfiguredMotors = this.preconfiguredMotors.map(motor => ({ ...motor, inSimulation: false, id: Math.abs(motor.model.hashCode()) }));
            
            this.preconfiguredMotors.sort((a, b) =>
                (a.brandModel || '').localeCompare(b.brandModel || '')
            );
            console.log("Motor list loaded successfully.");
        } catch (error) {
            console.error("Error loading motor list:", error);
            showToast("Error loading motor list. Check console.", 'error');
            this.preconfiguredMotors = []; // Ensure consistent status

        }
    }

    /**
     * Get the list of preconfigured engines (orderly).
     * @returns {Array<object>}
     */
    getPreconfiguredMotors() {
        return [...this.preconfiguredMotors]; // Returns copy to avoid external mutation

    }

    /**
     * Obtain the list of selected engines for simulation.
     * @returns {Array<object>}
     */
    getMotorsForSimulation() {
        return [...this.motorsForSimulation]; // Returns copy

    }

    /**
     * Add an engine to the simulation list if it does not exist.
     * @param {object} motor -The engine to add.
     * @returns {boolean} -True if added, false if it already existed.
     */
    addMotorToSimulation(motor) {
        if (!this.motorsForSimulation.some(m => m.brandModel === motor.brandModel)) {
            motor.inSimulation = true;
            this.motorsForSimulation.push(motor);
            return true;
        }
        console.log(`Motor "${motor.brandModel}" is already selected.`);
        return false;
    }

    /**
     * Eliminate an engine from the simulation list by its index.
     * @param {number} index -The engine index to be removed.
     */
    removeMotorFromSimulation(index) {
        if (index >= 0 && index < this.motorsForSimulation.length) {
            this.motorsForSimulation[index].inSimulation = false;
            this.motorsForSimulation.splice(index, 1);
        }
    }

    /**
     * Add a new personalized engine to the preconfigured list (only for the current session).
     * @param {object} motorData -Data of the new engine.
     * @returns {{success: boolean, message: string, motor?: object}} -Result of the operation.
     */
    addCustomMotor(motorData) {
        const { brandModel, stepAngleDeg, ratedCurrentA, torqueNCm, inductanceMH, resistanceOhms, rotorInertiaGCm2, nema, bodyLengthMm } = motorData;

        if (!brandModel || isNaN(stepAngleDeg) || isNaN(ratedCurrentA) || isNaN(torqueNCm) || isNaN(inductanceMH) || isNaN(resistanceOhms)) {
            return { success: false, message: 'Error: Please fill in all required fields (*) with valid numbers.' };
        }

        if (this.preconfiguredMotors.some(motor => motor.brandModel === brandModel)) {
            return { success: false, message: `Error: Motor with Brand & Model "${brandModel}" already exists.` };
        }

        const newMotor = {
            brandModel,
            brand: brandModel.split('-')[0]?.trim() || 'Custom',
            model: brandModel.substring(brandModel.indexOf('-') + 1)?.trim() || 'Motor',
            nema: nema || null,
            bodyLengthMm: bodyLengthMm || null,
            stepAngleDeg,
            ratedCurrentA,
            torqueNCm,
            inductanceMH,
            resistanceOhms,
            rotorInertiaGCm2: rotorInertiaGCm2 || null
        };

        this.preconfiguredMotors.push(newMotor);
        // Keep ordered

        this.preconfiguredMotors.sort((a, b) =>
            (a.brandModel || '').localeCompare(b.brandModel || '')
        );

        return { success: true, message: `Motor "${brandModel}" added successfully for this session.`, motor: newMotor };
    }

    /**
     * Filter the list of engines preconfigured by text.
     * @param {string} filterText -The text to filter (navigal/lowercase).
     * @returns {Array<object>} -Filrated motors.
     */
    filterMotors(filterText) {
        const cleanedFilter = filterText.toLowerCase().trim();
        if (!cleanedFilter) {
            return []; // Do not filter if the text is empty

        }
        return this.preconfiguredMotors.filter(motor =>
            motor.brandModel && motor.brandModel.toLowerCase().includes(cleanedFilter)
        );
    }

    /**
     * Establish motor simulation (used when loading from URL).
     * @param {Array<object>} motors -The list of engines.
     */
    setMotorsForSimulation(motors) {
        this.motorsForSimulation = Array.isArray(motors) ? motors : [];
    }
}
