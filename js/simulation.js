// js/simulation.js

import { showToast } from './utils.js';

export class Simulation {
    constructor(torqueElementId = 'torque-chart', powerElementId = 'power-chart') {
        this.torqueElementId  = torqueElementId;
        this.powerElementId   = powerElementId;
        this.torqueChart  = null;
        this.powerChart   = null;
        this.currentChart = null;
        this.bemfChart    = null;
        this.activeChart  = 'torque';
        this._initialized = false;
        this.initializeCharts();
    }

    initializeCharts() {
        const torqueEl = document.getElementById(this.torqueElementId);
        const powerEl  = document.getElementById(this.powerElementId);
        if (!torqueEl || !powerEl) return;

        this.torqueChart = echarts.init(torqueEl, 'dark', { renderer: 'canvas' });
        this.powerChart  = echarts.init(powerEl,  'dark', { renderer: 'canvas' });

        const currentEl = document.getElementById('current-chart');
        const bemfEl    = document.getElementById('bemf-chart');
        if (currentEl) this.currentChart = echarts.init(currentEl, 'dark', { renderer: 'canvas' });
        if (bemfEl)    this.bemfChart    = echarts.init(bemfEl,    'dark', { renderer: 'canvas' });

        this._applyBaseOptions();
        this._initialized = true;
    }

    _baseOpt(yName, labelColor, gridColor) {
        return {
            backgroundColor: 'transparent',
            grid: { top: 30, right: 30, bottom: 30, left: 50, containLabel: true },
            xAxis: { type: 'value', name: 'Speed (mm/s)', axisLine: { lineStyle: { color: labelColor } }, splitLine: { lineStyle: { color: gridColor } } },
            yAxis: { type: 'value', name: yName,          axisLine: { lineStyle: { color: labelColor } }, splitLine: { lineStyle: { color: gridColor } } },
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'rgba(15,23,42,0.9)', borderColor: '#374151',
                textStyle: { color: '#f3f4f6' }, axisPointer: { type: 'cross' },
                formatter: (params) => {
                    let html = `<div style="font-weight:bold;margin-bottom:6px;border-bottom:1px solid #374151;padding-bottom:4px;">Speed: ${params[0].axisValue} mm/s</div>`;
                    params.forEach(p => {
                        html += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:3px;">
                            <span style="width:8px;height:8px;border-radius:50%;background:${p.color};flex-shrink:0"></span>
                            <span style="flex:1">${p.seriesName}</span>
                            <span style="font-weight:600">${p.value[1]}</span>
                        </div>`;
                    });
                    return html;
                }
            },
            legend: { show: true, top: 0, textStyle: { color: labelColor } }
        };
    }

    _applyBaseOptions() {
        const style = getComputedStyle(document.documentElement);
        const gridColor  = style.getPropertyValue('--grid-line').trim()      || '#2A2F36';
        const labelColor = style.getPropertyValue('--text-secondary').trim() || '#9AA4AE';

        // Torque chart: richer tooltip with motor specs
        const torqueTip = {
            trigger: 'axis',
            backgroundColor: 'rgba(15,23,42,0.9)', borderColor: '#374151',
            textStyle: { color: '#f3f4f6' }, axisPointer: { type: 'cross' },
            formatter: (params) => {
                let html = `<div style="font-weight:bold;margin-bottom:8px;border-bottom:1px solid #374151;padding-bottom:5px;">Speed: ${params[0].axisValue} mm/s</div>`;
                params.forEach(p => {
                    const motor = this.torqueChart.motors?.find(m => m.brandModel === p.seriesName);
                    if (!motor) return;
                    html += `<div style="margin-bottom:6px;">
                        <div style="display:flex;align-items:center;gap:6px;font-weight:bold;">
                            <span style="width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
                            ${p.seriesName} <span style="margin-left:auto;">${p.value[1]} N·cm</span>
                        </div>
                        <div style="font-size:0.75rem;color:#9CA3AF;margin-left:16px;">
                            ${motor.inductanceMH}mH | ${motor.resistanceOhms}Ω | ${motor.ratedCurrentA}A rated
                        </div>
                    </div>`;
                });
                return html;
            }
        };

        this.torqueChart.setOption({ ...this._baseOpt('Torque (N·cm)', labelColor, gridColor), tooltip: torqueTip });
        this.powerChart.setOption(this._baseOpt('Power (W)', labelColor, gridColor));
        this.currentChart?.setOption(this._baseOpt('Current (A)', labelColor, gridColor));
        this.bemfChart?.setOption(this._baseOpt('Back-EMF (V)', labelColor, gridColor));
    }

    updateThemeColors() {
        if (!this._initialized) return;
        this._applyBaseOptions();
    }

    onChartTabSwitch(activeTab) {
        this.activeChart = activeTab;
        setTimeout(() => {
            this.torqueChart?.resize();
            this.powerChart?.resize();
            this.currentChart?.resize();
            this.bemfChart?.resize();
        }, 10);
    }

    getMotorColor(index, totalMotors) {
        const hue = (index / Math.max(totalMotors, 1)) * 360;
        return `hsl(${hue}, 100%, 65%)`;
    }

    updateSimulationChart(selectedMotors, params, driveSetup = '1motor') {
        if (!this._initialized) return;

        const { inputVoltage, pulleySize, acceleration, toolheadMass, globalRms,
                driverMode = 'spreadcycle', holdRatio = 0.5 } = params;
        const driveDiv = driveSetup === 'awd' ? 4 : driveSetup === '2wd' ? 2 : 1;

        const MAX_RPS = 100, RPS_STEP = 0.5;
        const rpsValues = Array.from({ length: Math.ceil(MAX_RPS / RPS_STEP) + 1 }, (_, i) => i * RPS_STEP);

        const torqueSeries = [], powerSeries = [], currentSeries = [], bemfSeries = [];
        this.torqueChart.motors = selectedMotors;
        this.powerChart.motors  = selectedMotors;

        selectedMotors.forEach((motor, index) => {
            const color          = this.getMotorColor(index, selectedMotors.length);
            const ePulley        = motor.pulleySizeMM    ?? pulleySize;
            const eVoltage       = motor.inputVoltageV   ?? inputVoltage;
            const eCurrent       = motor.maxDriveCurrentA ?? motor.ratedCurrentA;
            const calcCurrent    = motor.useRms ? eCurrent * 0.707 : eCurrent;

            const tPts = [], pPts = [], cPts = [], bPts = [];
            rpsValues.forEach(rps => {
                const spd   = rps * (ePulley * 2);
                const state = this._motorState(motor, eVoltage, calcCurrent, rps, driverMode, holdRatio);
                const inert = this._inertiaTorque(acceleration, ePulley, motor.rotorInertiaGCm2 || 0);
                tPts.push([+spd.toFixed(2), +(Math.max(0, state.torque - inert)).toFixed(4)]);
                pPts.push([+spd.toFixed(2), +state.elecPower.toFixed(4)]);
                cPts.push([+spd.toFixed(2), +state.iActual.toFixed(4)]);
                bPts.push([+spd.toFixed(2), +state.vBemf.toFixed(4)]);
            });

            const s = (data) => ({ name: motor.brandModel, type: 'line', data, itemStyle: { color } });
            torqueSeries.push(s(tPts));
            powerSeries.push(s(pPts));
            currentSeries.push(s(cPts));
            bemfSeries.push(s(bPts));
        });

        // Required torque mark line
        const reqTorque = this._requiredTorque(toolheadMass, acceleration, pulleySize) / driveDiv;
        const rmsLabel  = globalRms ? ' RMS' : '';
        let maxX = MAX_RPS * pulleySize * 2;
        selectedMotors.forEach(m => { maxX = Math.max(maxX, MAX_RPS * (m.pulleySizeMM ?? pulleySize) * 2); });
        let maxTorque = 0;
        torqueSeries.forEach(s => s.data.forEach(p => { if (p[1] > maxTorque) maxTorque = p[1]; }));

        torqueSeries.push({
            name: 'Required Torque', type: 'line', data: [], silent: true,
            lineStyle: { opacity: 0 }, showSymbol: false,
            markLine: {
                symbol: ['none', 'none'], silent: true, z: 20,
                data: [{
                    yAxis: reqTorque, name: `Required${rmsLabel}`,
                    lineStyle: { color: '#F38BA8', type: 'dashed', width: 2 },
                    label: {
                        show: true, position: 'insideEndTop',
                        formatter: `Required${rmsLabel} ({c} N·cm)`,
                        color: '#F38BA8', fontSize: 11, fontWeight: 'bold',
                        backgroundColor: 'rgba(26,18,40,0.8)', padding: [4, 6], borderRadius: 4
                    }
                }]
            }
        });

        const yMax = Math.max(reqTorque * 1.5, maxTorque * 1.2, 50);
        const legend = { data: selectedMotors.map(m => m.brandModel) };

        this.torqueChart.setOption({ series: torqueSeries, legend, xAxis: { max: maxX }, yAxis: { max: yMax } }, { replaceMerge: ['series'] });
        this.powerChart.setOption({ series: powerSeries, xAxis: { max: maxX } }, { replaceMerge: ['series'] });
        this.currentChart?.setOption({ series: currentSeries, legend, xAxis: { max: maxX }, yAxis: { min: 0 } }, { replaceMerge: ['series'] });
        this.bemfChart?.setOption({ series: bemfSeries, legend, xAxis: { max: maxX }, yAxis: { min: 0 } }, { replaceMerge: ['series'] });
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

    getTorqueAtSpeed(motor, inputVoltage, driveCurrent, speedMmS, pulleySize, acceleration = 20000, driverMode = 'spreadcycle') {
        const rps = speedMmS / (pulleySize * 2);
        const state = this._motorState(motor, inputVoltage, driveCurrent, rps, driverMode, 0.5);
        const inert = this._inertiaTorque(acceleration, pulleySize, motor.rotorInertiaGCm2 || 0);
        return Math.max(0, state.torque - inert);
    }

    getRequiredTorque(params, driveSetup = '1motor') {
        const { toolheadMass, acceleration, pulleySize } = params;
        const driveDiv = driveSetup === 'awd' ? 4 : driveSetup === '2wd' ? 2 : 1;
        return this._requiredTorque(toolheadMass, acceleration, pulleySize) / driveDiv;
    }

    // ── Motor models ──────────────────────────────────────────────

    _motorState(motor, inputVoltage, driveCurrent, rps, driverMode = 'spreadcycle', holdRatio = 0.5) {
        switch (driverMode) {
            case 'spreadcycle':  return this._motorStateSpreadCycle(motor, inputVoltage, driveCurrent, rps);
            case 'stealthchop':  return this._motorStateStealthChop(motor, inputVoltage, driveCurrent, rps, holdRatio);
            default:             return this._motorStateClassic(motor, inputVoltage, driveCurrent, rps);
        }
    }

    /**
     * Classic model (DRV8825-style): scalar back-EMF subtraction.
     * Fixed impedance to phasor magnitude |Z| = sqrt(X²+R²).
     */
    _motorStateClassic(motor, inputVoltage, driveCurrent, rps) {
        const { inductanceMH, resistanceOhms: R, stepAngleDeg, ratedCurrentA, torqueNCm } = motor;
        const pi = Math.PI, sqrt2 = Math.SQRT2;
        const fCoil  = rps * (360 / stepAngleDeg) / 4;
        const X      = 2 * pi * fCoil * (inductanceMH / 1000);
        const Z      = Math.sqrt(X * X + R * R);
        const vBemf  = 2 * pi * rps * (torqueNCm / (100 * sqrt2) / ratedCurrentA);
        const vAvail = Math.max(0, inputVoltage - vBemf);
        const iActual= Math.min(Z > 0 ? vAvail / Z : 0, driveCurrent);
        const torque = (iActual / ratedCurrentA) * torqueNCm / sqrt2;
        const copper = iActual * iActual * R;
        const mech   = vBemf * iActual;
        return { torque, elecPower: copper + mech, iActual, vBemf, copperLoss: copper, mechPower: mech };
    }

    /**
     * SpreadCycle model (TMC2xxx): phasor voltage constraint.
     * Solves the full impedance quadratic — produces smooth torque rolloff
     * instead of the sudden cliff in the classic model.
     *
     * Voltage constraint: Vbus² ≥ (R·i + Vbemf)² + (X·i)²
     * Solve for max i: (R²+X²)·i² + 2·R·Vbemf·i + (Vbemf²−Vbus²) = 0
     */
    _motorStateSpreadCycle(motor, inputVoltage, driveCurrent, rps) {
        const { inductanceMH, resistanceOhms: R, stepAngleDeg, ratedCurrentA, torqueNCm } = motor;
        const pi = Math.PI, sqrt2 = Math.SQRT2;
        const fCoil = rps * (360 / stepAngleDeg) / 4;
        const X     = 2 * pi * fCoil * (inductanceMH / 1000);
        const vBemf = 2 * pi * rps * (torqueNCm / (100 * sqrt2) / ratedCurrentA);

        // Voltage needed to push full drive current through the motor
        const vNeeded = Math.sqrt((R * driveCurrent + vBemf) ** 2 + (X * driveCurrent) ** 2);
        let iActual;
        if (vNeeded <= inputVoltage) {
            iActual = driveCurrent;
        } else {
            const a = R * R + X * X;
            const b = 2 * R * vBemf;
            const c = vBemf * vBemf - inputVoltage * inputVoltage;
            const disc = b * b - 4 * a * c;
            iActual = disc < 0 ? 0 : Math.max(0, (-b + Math.sqrt(disc)) / (2 * a));
            iActual = Math.min(iActual, driveCurrent);
        }

        const torque = (iActual / ratedCurrentA) * torqueNCm / sqrt2;
        const copper = iActual * iActual * R;
        const mech   = vBemf * iActual;
        return { torque, elecPower: copper + mech, iActual, vBemf, copperLoss: copper, mechPower: mech };
    }

    /**
     * StealthChop approximation (TMC2xxx silent mode):
     * SpreadCycle physics + hold current reduction at standstill/low speed.
     *
     * TMC drivers ramp from IHOLD (holdRatio × IRUN) at standstill up to IRUN
     * at TPWMTHRS. Above that speed, SpreadCycle voltage physics dominate.
     * This matches measured behavior: idle ~0.8A, low-speed ~1A, high-speed ~0.6A
     * when configured at 2A RMS (voltage-limiting reduces current at speed).
     */
    _motorStateStealthChop(motor, inputVoltage, driveCurrent, rps, holdRatio = 0.5) {
        const TRANSITION_RPS = 2.0; // ≈50 mm/s on 20T GT2 — TPWMTHRS equivalent
        const result = this._motorStateSpreadCycle(motor, inputVoltage, driveCurrent, rps);
        if (rps < TRANSITION_RPS) {
            const scale   = holdRatio + (1 - holdRatio) * (rps / TRANSITION_RPS);
            const iScaled = result.iActual * scale;
            const torque  = (iScaled / motor.ratedCurrentA) * motor.torqueNCm / Math.SQRT2;
            const copper  = iScaled * iScaled * motor.resistanceOhms;
            const mech    = result.vBemf * iScaled;
            return { torque, elecPower: copper + mech, iActual: iScaled, vBemf: result.vBemf, copperLoss: copper, mechPower: mech };
        }
        return result;
    }

    // ── Private helpers ───────────────────────────────────────────

    /** Required torque to accelerate toolhead mass [N·cm] */
    _requiredTorque(toolheadMass, acceleration, pulleySize) {
        return (acceleration / 1000) * (toolheadMass / 1000) * (pulleySize * 2) / (2 * Math.PI * 10);
    }

    /** Rotor inertia torque [N·cm] */
    _inertiaTorque(acceleration, pulleySize, inertia) {
        return (acceleration * Math.PI / pulleySize) * (inertia / 100000);
    }
}
