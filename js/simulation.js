// Js/simulation.js

import { showToast } from './utils.js'; // If you need to show toasts from here


export class Simulation {
    constructor(chartElementId = 'torque-speed-chart') {
        this.chartElementId = chartElementId;
        this.torqueSpeedChart = null; // Will be initialized in Initchart

        this.initializeChart();
    }

    initializeChart() {
        const ctx = document.getElementById(this.chartElementId)?.getContext('2d');
        if (!ctx) {
            console.error(`Chart element with ID "${this.chartElementId}" not found.`);
            return;
        }
        // Destroy previous graph if it exists to avoid problems

        if (this.torqueSpeedChart) {
            this.torqueSpeedChart.destroy();
        }
        this.torqueSpeedChart = new Chart(ctx, {
            type: 'line',
            data: [],
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: { display: true, text: 'Speed (mm/s)', color: '#ABB2BF' },
                        ticks: { color: '#ABB2BF' }
                    },
                    y: {
                        title: { display: true, text: 'Torque (N-cm)', color: '#ABB2BF' },
                        ticks: { color: '#ABB2BF' }
                    }
                },
                plugins: {
                    legend: { labels: { color: '#ABB2BF' } }
                }
            }
        });
    }

    /**
     * Update the graph with the engines and given parameters.
     * @param {Array<object>} selectedMotors -Motors to simulate.
     * @param {object} params -Simulation parameters (Voltage, Current, etc.).
     */
    updateSimulationChart(selectedMotors, params) {
        if (!this.torqueSpeedChart) {
            console.error("Chart not initialized yet.");
            return;
        }

        if (selectedMotors.length === 0) {
            showToast("Please add at least one motor to the simulation table.");
            this.torqueSpeedChart.data.labels = [];
            this.torqueSpeedChart.data.datasets = [];
            this.torqueSpeedChart.update();
            return;
        }

        const { inputVoltage, maxCurrent, pulleySize, acceleration, toolheadMass } = params;

        // Generate speed points (eg: 0 to 500 mm/s in steps of 5)

        const maxSpeedMmS = 50;
        const speedStep = 0.5;
        const speedsMmS = Array.from({ length: Math.ceil(maxSpeedMmS / speedStep) + 1 }, (_, i) => i * speedStep);


        const datasets = selectedMotors.map((motor, index) => {
            // Validate engine data before using

            if (isNaN(motor.stepAngleDeg) || isNaN(motor.ratedCurrentA) || isNaN(motor.torqueNCm) || isNaN(motor.inductanceMH) || isNaN(motor.resistanceOhms)) {
                console.warn(`Motor "${motor.brandModel}" has invalid data, skipping.`);
                return null; // Or return an empty/marked dataset as an error

            }

            const hue = (index * (360 / selectedMotors.length)) % 360;
            const color = `hsl(${hue}, 70%, 60%)`;

            // Calculate torque available for each speed

            const torqueData = speedsMmS.map(speed => {
                const availableTorque = this.calculateSingleCoilTorque(
                    motor.stepAngleDeg,
                    motor.ratedCurrentA,
                    motor.torqueNCm,
                    motor.inductanceMH,
                    motor.resistanceOhms,
                    motor.rotorInertiaGCm2,
                    inputVoltage,
                    maxCurrent,
                    speed
                );
                // Calculate torque necessary for the inertia of the engine itself

                const motorInertiaTorque = this.calculateRequiredTorqueForMotor(acceleration, pulleySize, motor.rotorInertiaGCm2);
                // Return the available torque less the necessary for your own inertia

                return Math.max(0, availableTorque - motorInertiaTorque); // Ensure non -negative

            }).filter(t => !isNaN(t)); // Filter nan if there were mistakes


            return {
                label: motor.brandModel || `Motor ${index + 1}`,
                data: torqueData,
                borderColor: color,
                borderWidth: 2,
                fill: false,
                pointRadius: 1, // Smaller points

                tension: 0.1 // Light softest

            };
        }).filter(ds => ds !== null); // Filter engines with invalid data


        // Calculate torque required by the head of the head

        const requiredTorqueMass = this.calculateRequiredTorqueForMass(toolheadMass, acceleration, pulleySize);

        // Add requested torque line

        datasets.push({
            label: "Required Torque (Toolhead Mass)",
            // Use the same data points as the engines

            data: Array(speedsMmS.length).fill(requiredTorqueMass).map(t => isNaN(t) ? 0 : t),
            borderColor: "#F38BA8", // Rojo

            borderWidth: 2,
            borderDash: [5, 5], // Discontinuous line

            fill: false,
            pointRadius: 0 // No points

        });

        this.torqueSpeedChart.data.labels = speedsMmS.map(speed => `${speed * (pulleySize * 2) / 1}`); // X -axis in mm/s

        this.torqueSpeedChart.data.datasets = datasets;
        this.torqueSpeedChart.update(); // Update the graph

    }

    /**
     * Calculate the torque required to accelerate a dough linearly.
     * @param {number} massKg -Mass in kg.
     * @param {number} accelerationMmS2 -Acceleration in mm/s^2.
     * @param {number} pulleyDiameterMm -Pulley diameter in mm.
     * @returns {number} -Torque required in N-CM.
     */
    calculateRequiredTorqueForMass(toolheadMass, acceleration, pulleySize) {
        const accelReq = acceleration / 1000;
        const torqueReq = toolheadMass / 1000;
        const gearRatio = (pulleySize * 2) / 1;
        const piCalc = 2 * Math.PI * 10;
        const radiusMeters = ((pulleySize / 2) * piCalc) / (gearRatio * 1000);
        return accelReq * torqueReq * gearRatio / piCalc;
    }

    /**
     * Calculate the torque required to accelerate the inertia of the motor rotor.
     * @param {number} linearAccelerationMmS2 -Desired linear acceleration in mm/s^2.
     * @param {number} pulleyDiameterMm -Pulley diameter in mm.
     * @param {number|null} rotorInertiaGCm2 -Rotor inertia in g-cm^2.
     * @returns {number} -Torque required in N-CM.
     */
    calculateRequiredTorqueForMotor(acceleration, pulleySize, inertia) {
        return acceleration / (pulleySize * 2) * 2 * Math.PI * (inertia / (1000 * Math.pow(100, 2))) * 100;
    }


    /**
     * Calculate the approximate torque of an engine coil at a given speed.
     * (This is a simplification and you may need adjustments according to the real engine model)
     * @param {number} stepAngleDeg
     * @param {number} ratedCurrentA
     * @param {number} holdingTorqueNCm
     * @param {number} inductanceMH
     * @param {number} resistanceOhms
     * @param {number} inputVoltageV
     * @param {number} driveCurrentA -Maximum current delivered by the driver.
     * @param {number} rps -Revolutions per second.
     * @returns {number} -Approximate available torque in N-CM.
     */
    calculateSingleCoilTorque(stepAngle, ratedCurrent, torque, inductance, resistance, rotorInertia, inputVoltage, driveCurrent, rps) {
        const pi = Math.PI;
        const sqrt2 = Math.sqrt(2); // Square root of 2 (1,414)
        const fCoil = rps * (360 / stepAngle) / 4;
        const xCoil = 2 * pi * fCoil * (inductance / 1000);
    
        const zCoil = xCoil + resistance;
        const vGen = 2 * pi * rps * (torque / (100 * sqrt2) / ratedCurrent);
    
        const vAvail = inputVoltage > vGen ? inputVoltage - vGen : 0;
    
        const iAvail = vAvail / zCoil;
        const iActual = iAvail > driveCurrent ? driveCurrent : iAvail;
    
        const torquePercent = iActual / ratedCurrent;
    
        const t1Coil = torquePercent * torque / (100 * sqrt2);
        const t2Coil = t1Coil * sqrt2;
    
        const vCoil = iActual * resistance;
    
        const power = (vCoil + vGen) * iActual;
    
        return t1Coil * 100;
    }
}
