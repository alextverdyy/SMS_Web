// js/simulation.js

import { showToast } from './utils.js';

export class Simulation {
    constructor(torqueElementId = 'torque-chart', powerElementId = 'power-chart') {
        this.torqueElementId = torqueElementId;
        this.powerElementId  = powerElementId;
        this.torqueChart = null;
        this.powerChart  = null;
        this.activeChart = 'torque';
        this._initialized = false;
        this.initializeCharts();
    }

    initializeCharts() {
        const torqueEl = document.getElementById(this.torqueElementId);
        const powerEl  = document.getElementById(this.powerElementId);
        if (!torqueEl || !powerEl) return;

        this.torqueChart = echarts.init(torqueEl, 'dark', { renderer: 'canvas' });
        this.powerChart  = echarts.init(powerEl, 'dark', { renderer: 'canvas' });

        this._applyBaseOptions();
        this._initialized = true;
    }

    _applyBaseOptions() {
        const style = getComputedStyle(document.documentElement);
        const gridColor = style.getPropertyValue('--grid-line').trim() || '#2A2F36';
        const labelColor = style.getPropertyValue('--text-secondary').trim() || '#9AA4AE';

        const baseOption = {
            backgroundColor: 'transparent',
            grid: { top: 30, right: 30, bottom: 30, left: 50, containLabel: true },
            xAxis: { type: 'value', name: 'Speed (mm/s)', axisLine: { lineStyle: { color: labelColor } }, splitLine: { lineStyle: { color: gridColor } } },
            yAxis: { type: 'value', axisLine: { lineStyle: { color: labelColor } }, splitLine: { lineStyle: { color: gridColor } } },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                borderColor: '#374151',
                textStyle: { color: '#f3f4f6' },
                axisPointer: { type: 'cross' },
                formatter: (params) => {
                    let html = `<div style="font-weight:bold; margin-bottom:8px; border-bottom:1px solid #374151; padding-bottom:5px;">Speed: ${params[0].axisValue} mm/s</div>`;
                    params.forEach(p => {
                        const motors = (this.activeChart === "torque" ? this.torqueChart.motors : this.powerChart.motors); const motor = motors.find(m => m.brandModel === p.seriesName);
                        if (!motor) return;
                        const val = p.value[1];
                        const unit = this.activeChart === 'torque' ? 'N·cm' : 'W';
                        
                        html += `<div style="margin-bottom:6px;">
                                    <div style="display:flex; align-items:center; gap:6px; font-weight:bold;">
                                        <span style="width:10px; height:10px; border-radius:50%; background:${p.color}"></span>
                                        ${p.seriesName} <span style="margin-left:auto;">${val} ${unit}</span>
                                    </div>
                                    <div style="font-size:0.75rem; color:#9CA3AF; margin-left:16px;">
                                        Specs: ${motor.inductanceMH}mH | ${motor.resistanceOhms}Ω | ${motor.ratedCurrentA}A
                                    </div>
                                    <div style="font-size:0.75rem; color:#9CA3AF; margin-left:16px;">
                                        Config: ${motor.inputVoltageV ?? params.inputVoltage}V | ${motor.maxDriveCurrentA ?? params.maxCurrent}A | ${motor.pulleySizeMM ?? params.pulleySize}T Pulley
                                    </div>
                                 </div>`;
                    });
                    return html;
                }
            },
            legend: { show: true, top: 0, textStyle: { color: labelColor } }
        };

        this.torqueChart.setOption({ ...baseOption, yAxis: { ...baseOption.yAxis, name: 'Torque (N·cm)' } });
        this.powerChart.setOption({ ...baseOption, yAxis: { ...baseOption.yAxis, name: 'Power (W)' } });
    }

    updateThemeColors() {
        if (!this._initialized) return;
        this._applyBaseOptions();
    }

    onChartTabSwitch(activeTab) {
        this.activeChart = activeTab;
        setTimeout(() => {
            this.torqueChart.resize();
            this.powerChart.resize();
        }, 10);
    }

    getMotorColor(index, totalMotors) {
        const hue = (index / totalMotors) * 360;
        return `hsl(${hue}, 100%, 65%)`;
    }

    updateSimulationChart(selectedMotors, params, driveSetup = '1motor') {
        if (!this._initialized) return;

        const { inputVoltage, pulleySize, acceleration, toolheadMass, globalRms } = params;
        const driveDiv = driveSetup === 'awd' ? 4 : driveSetup === '2wd' ? 2 : 1;
        
        const MAX_RPS = 50;
        const RPS_STEP = 0.5;
        const rpsValues = Array.from({ length: Math.ceil(MAX_RPS / RPS_STEP) + 1 }, (_, i) => i * RPS_STEP);

        const torqueSeries = [];
        const powerSeries = [];

        // Store motors in the chart instance for the tooltip formatter
        this.torqueChart.motors = selectedMotors;
        this.powerChart.motors = selectedMotors;

        selectedMotors.forEach((motor, index) => {
            const color = this.getMotorColor(index, selectedMotors.length);
            const effectivePulley = motor.pulleySizeMM ?? pulleySize;
            const effectiveVoltage = motor.inputVoltageV ?? inputVoltage;
            const effectiveCurrent = motor.maxDriveCurrentA ?? motor.ratedCurrentA;

            const torquePoints = [];
            const powerPoints = [];

            rpsValues.forEach(rps => {
                 const speedMmS = rps * (effectivePulley * 2);
                 const currentForCalc = motor.useRms ? effectiveCurrent * 0.707 : effectiveCurrent;
                 const state = this._motorState(motor, effectiveVoltage, currentForCalc, rps, effectivePulley);
                 const inertiaTorq = this._inertiaTorque(acceleration, effectivePulley, motor.rotorInertiaGCm2 || 0);
                 
                 // Both state.torque and inertiaTorq are now in N·m
                 torquePoints.push([+speedMmS.toFixed(2), +(Math.max(0, state.torque - inertiaTorq)).toFixed(4)]);
                 powerPoints.push([+speedMmS.toFixed(2), +state.elecPower.toFixed(4)]);
             });

            torqueSeries.push({ name: motor.brandModel, type: 'line', data: torquePoints, itemStyle: { color } });
            powerSeries.push({ name: motor.brandModel, type: 'line', data: powerPoints, itemStyle: { color } });
        });

        // Required torque reference line (already in N·cm)
        const reqTorque = (this._requiredTorque(toolheadMass, acceleration, pulleySize) / driveDiv);
        const rmsLabel = globalRms ? ' RMS' : '';

        // Span past the widest motor curve so the line always reaches the right edge
        let maxX = MAX_RPS * pulleySize * 2;
        selectedMotors.forEach(m => {
            maxX = Math.max(maxX, MAX_RPS * (m.pulleySizeMM ?? pulleySize) * 2);
        });

        // Find max torque produced to scale Y-axis properly
        let maxTorqueProduced = 0;
        torqueSeries.forEach(s => {
            s.data.forEach(p => { if (p[1] > maxTorqueProduced) maxTorqueProduced = p[1]; });
        });

        const markLine = {
            symbol: ['none', 'none'],
            silent: true,
            data: [
                {
                    yAxis: reqTorque,
                    name: `Required${rmsLabel}`,
                    lineStyle: { color: '#F38BA8', type: 'dashed', width: 2 }, // Removed shadow, reduced width
                    label: {
                        show: true,
                        position: 'insideEndTop', // Use 'insideEndTop' to keep the label within the container
                        formatter: `Required${rmsLabel} ({c} N·cm)`,
                        color: '#F38BA8',
                        fontSize: 11,
                        fontWeight: 'bold',
                        backgroundColor: 'rgba(26, 18, 40, 0.8)',
                        padding: [4, 6],
                        borderRadius: 4
                    }
                }
            ],
            z: 20
        };

        torqueSeries.push({
            name: 'Required Torque',
            type: 'line',
            data: [], 
            markLine: markLine,
            silent: true,
            lineStyle: { opacity: 0 },
            showSymbol: false
        });

        // Set the legend to ignore this series
        const yMax = Math.max(reqTorque * 1.5, maxTorqueProduced * 1.2, 50);
        const torqueOption = {
            series: torqueSeries,
            legend: { show: true, data: selectedMotors.map(m => m.brandModel) },
            xAxis: { max: maxX },
            yAxis: { max: yMax }
        };

        this.torqueChart.setOption(torqueOption, { replaceMerge: ['series'] });
        this.powerChart.setOption({ series: powerSeries, xAxis: { max: maxX } }, { replaceMerge: ['series'] });
    }

    async copyChartToClipboard(params, motors) {
        const chart = this.activeChart === 'power' ? this.powerChart : this.torqueChart;
        try {
            const dataUrl = chart.getDataURL({ pixelRatio: 2, backgroundColor: '#0e1410' });
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showToast('Chart copied to clipboard!', 'success');
            return true;
        } catch (err) {
            console.error('Copy failed:', err);
            showToast('Failed to copy chart.', 'error');
            return false;
        }
    }

    /**
     * Returns the torque of a motor at a specific speed (mm/s).
     */
    getTorqueAtSpeed(motor, inputVoltage, driveCurrent, speedMmS, pulleySize, acceleration = 20000) {
        const rps = speedMmS / (pulleySize * 2);
        const state = this._motorState(motor, inputVoltage, driveCurrent, rps, pulleySize);
        const inertiaTorq = this._inertiaTorque(acceleration, pulleySize, motor.rotorInertiaGCm2 || 0);
        return Math.max(0, state.torque - inertiaTorq);
    }

    /**
     * Returns the required torque for given parameters.
     */
    getRequiredTorque(params, driveSetup = '1motor') {
        const { toolheadMass, acceleration, pulleySize } = params;
        const driveDiv = driveSetup === 'awd' ? 4 : driveSetup === '2wd' ? 2 : 1;
        return this._requiredTorque(toolheadMass, acceleration, pulleySize) / driveDiv;
    }

    // ── Private calculation helpers ───────────────────────────────

    /**
     * Full motor state at a given RPS (revolutions per second).
     * Returns { torque [N·cm], elecPower [W] }
     */
    _motorState(motor, inputVoltage, driveCurrent, rps, pulleySize) {
        const pi = Math.PI, sqrt2 = Math.SQRT2;
        const fCoil = rps * (360 / motor.stepAngleDeg) / 4;
        const xCoil = 2 * pi * fCoil * (motor.inductanceMH / 1000);
        const zCoil = xCoil + motor.resistanceOhms;
        const vGen = 2 * pi * rps * (motor.torqueNCm / (100 * sqrt2) / motor.ratedCurrentA);
        const vAvail = inputVoltage > vGen ? inputVoltage - vGen : 0;
        const iAvail = zCoil > 0 ? vAvail / zCoil : 0;
        const iActual = Math.min(iAvail, driveCurrent);
        
        // Torque in N·cm: (I_actual / I_rated) * (Torque_holding / sqrt(2))
        const torque = (iActual / motor.ratedCurrentA) * motor.torqueNCm / sqrt2;
        
        const elecPower = ((iActual * motor.resistanceOhms) + vGen) * iActual * 2;
        return { torque, elecPower };
    }

    /** Required torque in N·cm to accelerate toolhead mass. */
    _requiredTorque(toolheadMass, acceleration, pulleySize) {
        const gearRatio = (pulleySize * 2);
        const piCalc    = 2 * Math.PI * 10; // Result in N·cm
        return (acceleration / 1000) * (toolheadMass / 1000) * gearRatio / piCalc;
    }

    /** Inertia torque in N·cm. */
    _inertiaTorque(acceleration, pulleySize, inertia) {
        // T = J * alpha
        // J [kg·m²] = inertia [g·cm²] * 1e-7
        // alpha [rad/s²] = (accel * PI / pulleySize)
        // result [N·m] * 100 = [N·cm]
        return (acceleration * Math.PI / pulleySize) * (inertia / 100000) ;
    }
}
