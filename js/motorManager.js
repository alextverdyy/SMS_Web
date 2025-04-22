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

     /**
     * Exports the current list of preconfigured motors to a JSON file.
     */
     exportMotors() {
        try {
            // Use a deep copy to avoid exporting internal states like 'inSimulation' if not desired
            // Or filter/map properties before stringifying if needed
            const dataToExport = this.preconfiguredMotors.map(({ inSimulation, id, ...motor }) => motor); // Exclude transient state

            const dataStr = JSON.stringify(dataToExport, null, 2); // Pretty print JSON
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            // Generate a filename, e.g., with a timestamp
            const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            a.download = `motor_list_${timestamp}.json`;
            document.body.appendChild(a); // Append to body for Firefox compatibility
            a.click();

            // Clean up
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast("Motor list exported successfully.", 'success');

        } catch (error) {
            console.error("Error exporting motor list:", error);
            showToast("Error exporting motor list. Check console.", 'error');
        }
    }

    /**
     * Imports motors from a JSON file object.
     * Adds valid, non-duplicate motors to the preconfigured list.
     * @param {File} file - The JSON file selected by the user.
     * @returns {Promise<{success: boolean, message: string, addedCount: number, skippedCount: number}>} - Result of the import operation.
     */
    async importMotors(file) {
        return new Promise((resolve, reject) => {
            // 1. Validate input file
            if (!file) {
                // Use reject for consistency in async error handling
                return reject(new Error("No file provided."));
            }
            if (file.type !== "application/json") {
                 return reject(new Error("Invalid file type. Please select a .json file."));
            }

            const reader = new FileReader();

            // 2. Define onload handler (when file is read)
            reader.onload = (e) => {
                let importedData;
                try {
                    // 3. Parse JSON content
                    importedData = JSON.parse(e.target.result);

                    // 4. Validate basic structure (must be an array)
                    if (!Array.isArray(importedData)) {
                        throw new Error("Invalid JSON format: The file must contain an array of motors.");
                    }

                    let addedCount = 0;
                    let skippedCount = 0;
                    const motorsToAdd = []; // Collect valid new motors here

                    // 5. Process each motor object in the imported array
                    importedData.forEach((motor, index) => {
                        // Basic validation: Check for essential fields and types
                        const { brandModel, stepAngleDeg, ratedCurrentA, torqueNCm, inductanceMH, resistanceOhms } = motor;
                        const isValidNumber = (num) => num !== undefined && num !== null && !isNaN(parseFloat(num));

                        if (brandModel && typeof brandModel === 'string' && brandModel.trim() !== '' &&
                            isValidNumber(stepAngleDeg) && isValidNumber(ratedCurrentA) &&
                            isValidNumber(torqueNCm) && isValidNumber(inductanceMH) && isValidNumber(resistanceOhms))
                        {
                            const trimmedBrandModel = brandModel.trim();
                            // 6. Check for duplicates in the *current* preconfigured list
                            const exists = this.preconfiguredMotors.some(existingMotor => existingMotor.brandModel === trimmedBrandModel);

                            if (!exists) {
                                // 7. Prepare the motor object for addition (similar to loadMotorList/addCustomMotor)
                                const newMotor = {
                                    brandModel: trimmedBrandModel,
                                    brand: String(motor.brand || trimmedBrandModel.split('-')[0]?.trim() || 'Imported'),
                                    model: String(motor.model || trimmedBrandModel.substring(trimmedBrandModel.indexOf('-') + 1)?.trim() || 'Motor'),
                                    nema: motor.nema ? parseInt(motor.nema) : null,
                                    bodyLengthMm: motor.bodyLengthMm ? parseFloat(motor.bodyLengthMm) : null,
                                    stepAngleDeg: parseFloat(stepAngleDeg),
                                    ratedCurrentA: parseFloat(ratedCurrentA),
                                    torqueNCm: parseFloat(torqueNCm),
                                    inductanceMH: parseFloat(inductanceMH),
                                    resistanceOhms: parseFloat(resistanceOhms),
                                    rotorInertiaGCm2: motor.rotorInertiaGCm2 ? parseFloat(motor.rotorInertiaGCm2) : null,
                                    // Add default state
                                    inSimulation: false,
                                    // Add any other fields from the import if needed
                                    ...(motor.voltageV && { voltageV: parseFloat(motor.voltageV) }), // Example: include optional fields
                                };
                                motorsToAdd.push(newMotor);
                                addedCount++;
                            } else {
                                console.log(`Skipping duplicate motor during import: ${trimmedBrandModel}`);
                                skippedCount++;
                            }
                        } else {
                            console.warn(`Skipping motor at index ${index} during import due to missing/invalid required fields:`, motor);
                            skippedCount++;
                        }
                    });

                    // 8. Add collected motors and re-sort
                    if (addedCount > 0) {
                        this.preconfiguredMotors.push(...motorsToAdd);
                        this.preconfiguredMotors.sort((a, b) =>
                            (a.brandModel || '').localeCompare(b.brandModel || '')
                        );
                    }

                    // 9. Resolve the promise with the import result
                    resolve({
                        success: true,
                        message: addedCount > 0
                            ? `Successfully imported ${addedCount} new motor(s). ${skippedCount} motor(s) skipped.`
                            : `Import finished. ${skippedCount} motor(s) skipped (duplicates or invalid). No new motors were added.`,
                        addedCount,
                        skippedCount
                    });

                } catch (error) {
                    // Handle JSON parsing errors or other processing errors
                    console.error("Error processing imported JSON file:", error);
                    // Reject the promise on error
                    reject(new Error(`Error processing file: ${error.message || 'Unknown error'}`));
                }
            };

            // 10. Define onerror handler
            reader.onerror = (e) => {
                console.error("Error reading file:", reader.error);
                reject(new Error("Error reading the selected file."));
            };

            // 11. Start reading the file as text
            reader.readAsText(file);
        });
    }
}
