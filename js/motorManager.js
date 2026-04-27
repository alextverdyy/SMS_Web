// js/motorManager.js

import { showToast, generateHashCode } from './utils.js';

let _instanceCounter = 0;
function nextInstanceId() {
    return `inst_${Date.now()}_${++_instanceCounter}`;
}

export class MotorManager {
    constructor() {
        this.preconfiguredMotors = [];
        this.motorsForSimulation = [];
    }

    async loadMotorList(url = 'motors.json') {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const raw = await response.json();
            this.preconfiguredMotors = raw.map(motor => ({
                ...motor,
                inSimulation: false,
                id: generateHashCode(motor.model || motor.brandModel || String(Math.random()))
            }));
            this.preconfiguredMotors.sort((a, b) =>
                (a.brandModel || '').localeCompare(b.brandModel || '')
            );
        } catch (error) {
            console.error('Error loading motor list:', error);
            showToast('Error loading motor list. Check console.', 'error');
            this.preconfiguredMotors = [];
        }
    }

    getPreconfiguredMotors() {
        return [...this.preconfiguredMotors];
    }

    getMotorsForSimulation() {
        return [...this.motorsForSimulation];
    }

    /**
     * Add a motor to the simulation. Always adds (allows multiple instances
     * of the same motor for parameter comparison). Returns the new instanceId.
     */
    addMotorToSimulation(motor) {
        const instance = {
            ...motor,
            instanceId: nextInstanceId(),
            inSimulation: true,
            // Per-instance parameter overrides (null = use global)
            inputVoltageV:   null,
            maxDriveCurrentA: motor.ratedCurrentA ?? null,
            pulleySizeMM:    null,
            useRms:          motor.useRms || false
        };
        this.motorsForSimulation.push(instance);

        // Mark preconfigured motor as in simulation
        const pre = this.preconfiguredMotors.find(m => m.brandModel === motor.brandModel);
        if (pre) pre.inSimulation = true;

        return instance.instanceId;
    }

    /**
     * Remove a motor instance by its unique instanceId.
     */
    removeMotorFromSimulation(instanceId) {
        const idx = this.motorsForSimulation.findIndex(m => m.instanceId === instanceId);
        if (idx === -1) return;

        const brandModel = this.motorsForSimulation[idx].brandModel;
        this.motorsForSimulation.splice(idx, 1);

        // Un-mark preconfigured motor only if no instances remain
        const stillInSim = this.motorsForSimulation.some(m => m.brandModel === brandModel);
        if (!stillInSim) {
            const pre = this.preconfiguredMotors.find(m => m.brandModel === brandModel);
            if (pre) pre.inSimulation = false;
        }
    }

    /**
     * Count how many simulation instances exist for a given brandModel.
     */
    countInstances(brandModel) {
        return this.motorsForSimulation.filter(m => m.brandModel === brandModel).length;
    }

    addCustomMotor(motorData) {
        const { brandModel, stepAngleDeg, ratedCurrentA, torqueNCm, inductanceMH, resistanceOhms, rotorInertiaGCm2, nema, bodyLengthMm, useRms } = motorData;

        if (!brandModel || isNaN(stepAngleDeg) || isNaN(ratedCurrentA) ||
            isNaN(torqueNCm) || isNaN(inductanceMH) || isNaN(resistanceOhms)) {
            return { success: false, message: 'Please fill in all required fields (*) with valid numbers.' };
        }
        if (this.preconfiguredMotors.some(m => m.brandModel === brandModel)) {
            return { success: false, message: `A motor named "${brandModel}" already exists.` };
        }

        const newMotor = {
            brandModel,
            brand: brandModel.split('-')[0]?.trim() || 'Custom',
            model: brandModel.substring(brandModel.indexOf('-') + 1)?.trim() || 'Motor',
            nema: nema || null,
            bodyLengthMm: bodyLengthMm || null,
            stepAngleDeg, ratedCurrentA, torqueNCm, inductanceMH, resistanceOhms,
            rotorInertiaGCm2: rotorInertiaGCm2 || null,
            inSimulation: false,
            id: generateHashCode(brandModel),
            useRms: !!useRms
        };

        this.preconfiguredMotors.push(newMotor);
        this.preconfiguredMotors.sort((a, b) => (a.brandModel || '').localeCompare(b.brandModel || ''));

        return { success: true, message: `Motor "${brandModel}" added to this session.`, motor: newMotor };
    }

    filterMotors(filterText) {
        const q = filterText.toLowerCase().trim();
        if (!q) return [];
        return this.preconfiguredMotors.filter(m =>
            m.brandModel && m.brandModel.toLowerCase().includes(q)
        );
    }

    setMotorsForSimulation(motors) {
        // Restore from URL — assign fresh instanceIds
        this.motorsForSimulation = (Array.isArray(motors) ? motors : []).map(m => ({
            ...m,
            instanceId: m.instanceId || nextInstanceId()
        }));
        // Sync inSimulation flags on preconfigured list
        this.motorsForSimulation.forEach(sim => {
            const pre = this.preconfiguredMotors.find(p => p.brandModel === sim.brandModel);
            if (pre) pre.inSimulation = true;
        });
    }

    exportMotors() {
        try {
            const data = this.preconfiguredMotors.map(({ inSimulation, id, ...m }) => m);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = Object.assign(document.createElement('a'), {
                href: url,
                download: `motor_list_${new Date().toISOString().slice(0, 10)}.json`
            });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Motor list exported.', 'success');
        } catch (err) {
            console.error('Export error:', err);
            showToast('Export failed. Check console.', 'error');
        }
    }

    async importMotors(file) {
        return new Promise((resolve, reject) => {
            if (!file) return reject(new Error('No file provided.'));
            if (file.type !== 'application/json') return reject(new Error('Please select a .json file.'));

            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (!Array.isArray(data)) throw new Error('File must contain an array of motors.');

                    let added = 0, skipped = 0;
                    const toAdd = [];
                    const isNum = v => v !== undefined && v !== null && !isNaN(parseFloat(v));

                    data.forEach((m, i) => {
                        const { brandModel, stepAngleDeg, ratedCurrentA, torqueNCm, inductanceMH, resistanceOhms } = m;
                        if (brandModel && typeof brandModel === 'string' && brandModel.trim() &&
                            isNum(stepAngleDeg) && isNum(ratedCurrentA) &&
                            isNum(torqueNCm) && isNum(inductanceMH) && isNum(resistanceOhms)) {
                            const bm = brandModel.trim();
                            if (!this.preconfiguredMotors.some(e => e.brandModel === bm)) {
                                toAdd.push({
                                    brandModel: bm,
                                    brand: String(m.brand || bm.split('-')[0]?.trim() || 'Imported'),
                                    model: String(m.model || bm.substring(bm.indexOf('-') + 1)?.trim() || 'Motor'),
                                    nema: m.nema ? parseInt(m.nema) : null,
                                    bodyLengthMm: m.bodyLengthMm ? parseFloat(m.bodyLengthMm) : null,
                                    stepAngleDeg: parseFloat(stepAngleDeg),
                                    ratedCurrentA: parseFloat(ratedCurrentA),
                                    torqueNCm: parseFloat(torqueNCm),
                                    inductanceMH: parseFloat(inductanceMH),
                                    resistanceOhms: parseFloat(resistanceOhms),
                                    rotorInertiaGCm2: m.rotorInertiaGCm2 ? parseFloat(m.rotorInertiaGCm2) : null,
                                    inSimulation: false,
                                    id: generateHashCode(bm)
                                });
                                added++;
                            } else { skipped++; }
                        } else { skipped++; }
                    });

                    if (added > 0) {
                        this.preconfiguredMotors.push(...toAdd);
                        this.preconfiguredMotors.sort((a, b) => (a.brandModel || '').localeCompare(b.brandModel || ''));
                    }

                    resolve({
                        success: true,
                        message: added > 0
                            ? `Imported ${added} motor(s). ${skipped} skipped.`
                            : `No new motors added. ${skipped} skipped (duplicates/invalid).`,
                        addedCount: added,
                        skippedCount: skipped
                    });
                } catch (err) {
                    reject(new Error(`Error processing file: ${err.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Error reading file.'));
            reader.readAsText(file);
        });
    }
}
