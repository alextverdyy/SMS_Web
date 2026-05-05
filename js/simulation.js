// js/simulation.js

import { showToast } from './utils.js';

export class Simulation {
    constructor(torqueElementId = 'torque-chart', powerElementId = 'power-chart') {
        this.torqueElementId  = torqueElementId;
        this.powerElementId   = powerElementId;
        this.torqueChart     = null;
        this.powerChart      = null;
        this.currentChart    = null;
        this.bemfChart       = null;
        this.impedanceChart  = null;
        this.efficiencyChart = null;
        this.copperLossChart = null;
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

        const currentEl     = document.getElementById('current-chart');
        const bemfEl        = document.getElementById('bemf-chart');
        const impedanceEl   = document.getElementById('impedance-chart');
        const efficiencyEl  = document.getElementById('efficiency-chart');
        const copperLossEl  = document.getElementById('copperloss-chart');
        if (currentEl)    this.currentChart    = echarts.init(currentEl,    'dark', { renderer: 'canvas' });
        if (bemfEl)       this.bemfChart       = echarts.init(bemfEl,       'dark', { renderer: 'canvas' });
        if (impedanceEl)  this.impedanceChart  = echarts.init(impedanceEl,  'dark', { renderer: 'canvas' });
        if (efficiencyEl) this.efficiencyChart = echarts.init(efficiencyEl, 'dark', { renderer: 'canvas' });
        if (copperLossEl) this.copperLossChart = echarts.init(copperLossEl, 'dark', { renderer: 'canvas' });

        this._applyBaseOptions();
        this._initialized = true;
    }

    _baseOpt(yName, labelColor, gridColor) {
        return {
            backgroundColor: 'transparent',
            grid: { 
                top: 40, 
                right: 50, 
                bottom: 45, 
                left: 60, 
                containLabel: true 
            },
            xAxis: { 
                type: 'value', 
                name: 'Speed (mm/s)', 
                nameLocation: 'middle',
                nameGap: 30,
                axisLine: { lineStyle: { color: labelColor } }, 
                splitLine: { lineStyle: { color: gridColor } },
                axisLabel: { color: labelColor }
            },
            yAxis: { 
                type: 'value', 
                name: yName,          
                nameLocation: 'middle',
                nameGap: 45,
                axisLine: { lineStyle: { color: labelColor } }, 
                splitLine: { lineStyle: { color: gridColor } },
                axisLabel: { color: labelColor }
            },
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
        const gridColor  = style.getPropertyValue('--line').trim()           || '#323232';
        const labelColor = style.getPropertyValue('--ink-2').trim()          || '#888888';
        const tooltipBg  = style.getPropertyValue('--bg-1').trim()           || '#252525';
        const borderColor = style.getPropertyValue('--line-strong').trim()   || '#444444';
        const textColor   = style.getPropertyValue('--ink-0').trim()         || '#a7a7a7';

        // Torque chart: richer tooltip with motor specs
        const torqueTip = {
            trigger: 'axis',
            backgroundColor: tooltipBg, borderColor: borderColor,
            textStyle: { color: textColor }, axisPointer: { type: 'cross' },
            formatter: (params) => {
                let html = `<div style="font-weight:bold;margin-bottom:8px;border-bottom:1px solid ${borderColor};padding-bottom:5px;">Speed: ${params[0].axisValue} mm/s</div>`;
                params.forEach(p => {
                    const motor = this.torqueChart.motors?.find(m => m.brandModel === p.seriesName);
                    if (!motor) return;
                    html += `<div style="margin-bottom:6px;">
                        <div style="display:flex;align-items:center;gap:6px;font-weight:bold;">
                            <span style="width:10px;height:10px;border-radius:50%;background:${p.color}"></span>
                            ${p.seriesName} <span style="margin-left:auto;">${p.value[1]} N·cm</span>
                        </div>
                        <div style="font-size:0.75rem;color:${labelColor};margin-left:16px;">
                            ${motor.inductanceMH}mH | ${motor.resistanceOhms}Ω | ${motor.ratedCurrentA}A rated
                        </div>
                    </div>`;
                });
                return html;
            }
        };

        const base = this._baseOpt('Torque (N·cm)', labelColor, gridColor);
        base.tooltip = { ...base.tooltip, backgroundColor: tooltipBg, borderColor: borderColor, textStyle: { color: textColor } };

        this.torqueChart.setOption({ ...this._baseOpt('Torque (N·cm)', labelColor, gridColor), tooltip: torqueTip });
        this.powerChart.setOption(this._baseOpt('Power (W)', labelColor, gridColor));
        this.currentChart?.setOption(this._baseOpt('Current (A)', labelColor, gridColor));
        this.bemfChart?.setOption(this._baseOpt('Back-EMF (V)', labelColor, gridColor));
        this.impedanceChart?.setOption(this._baseOpt('Impedance |Z| (Ω)', labelColor, gridColor));
        const effOpt = this._baseOpt('Efficiency (%)', labelColor, gridColor);
        effOpt.yAxis.min = 0; effOpt.yAxis.max = 100;
        this.efficiencyChart?.setOption(effOpt);
        this.copperLossChart?.setOption(this._baseOpt('Copper Loss I²R (W)', labelColor, gridColor));
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
            this.impedanceChart?.resize();
            this.efficiencyChart?.resize();
            this.copperLossChart?.resize();
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
        const impedanceSeries = [], efficiencySeries = [], copperLossSeries = [];
        this.torqueChart.motors = selectedMotors;
        this.powerChart.motors  = selectedMotors;

        selectedMotors.forEach((motor, index) => {
            const color          = this.getMotorColor(index, selectedMotors.length);
            const ePulley        = motor.pulleySizeMM    ?? pulleySize;
            const eVoltage       = motor.inputVoltageV   ?? inputVoltage;
            const eCurrent       = motor.maxDriveCurrentA ?? motor.ratedCurrentA;
            const calcCurrent    = motor.useRms ? eCurrent * 0.707 : eCurrent;

            const tPts = [], pPts = [], cPts = [], bPts = [], zPts = [], ePts = [], clPts = [];
            rpsValues.forEach(rps => {
                const spd   = rps * (ePulley * 2);
                const state = this._motorState(motor, eVoltage, calcCurrent, rps, driverMode, holdRatio);
                const inert = this._inertiaTorque(acceleration, ePulley, motor.rotorInertiaGCm2 || 0);
                tPts.push([+spd.toFixed(2), +(Math.max(0, state.torque - inert)).toFixed(4)]);
                pPts.push([+spd.toFixed(2), +state.elecPower.toFixed(4)]);
                cPts.push([+spd.toFixed(2), +state.iActual.toFixed(4)]);
                bPts.push([+spd.toFixed(2), +state.vBemf.toFixed(4)]);

                // Impedance |Z| = sqrt(R² + X²)
                const fCoil = rps * (360 / (motor.stepAngleDeg || 1.8)) / 4;
                const X = 2 * Math.PI * fCoil * (motor.inductanceMH / 1000);
                const Z = Math.sqrt(motor.resistanceOhms ** 2 + X ** 2);
                zPts.push([+spd.toFixed(2), +Z.toFixed(4)]);

                // Efficiency η = Pmech / Pelec  (%)
                const eta = state.elecPower > 0.001
                    ? Math.min(100, (state.mechPower / state.elecPower) * 100)
                    : 0;
                ePts.push([+spd.toFixed(2), +Math.max(0, eta).toFixed(2)]);

                // Copper loss I²R  (W)
                clPts.push([+spd.toFixed(2), +(state.copperLoss || 0).toFixed(4)]);
            });

            const s = (data) => ({ name: motor.brandModel, type: 'line', data, itemStyle: { color } });
            torqueSeries.push(s(tPts));
            powerSeries.push(s(pPts));
            currentSeries.push(s(cPts));
            bemfSeries.push(s(bPts));
            impedanceSeries.push(s(zPts));
            efficiencySeries.push(s(ePts));
            copperLossSeries.push(s(clPts));
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
        this.impedanceChart?.setOption({ series: impedanceSeries, legend, xAxis: { max: maxX }, yAxis: { min: 0 } }, { replaceMerge: ['series'] });
        this.efficiencyChart?.setOption({ series: efficiencySeries, legend, xAxis: { max: maxX }, yAxis: { min: 0, max: 100 } }, { replaceMerge: ['series'] });
        this.copperLossChart?.setOption({ series: copperLossSeries, legend, xAxis: { max: maxX }, yAxis: { min: 0 } }, { replaceMerge: ['series'] });
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

    /**
     * Returns static electrical analysis for a motor at given operating conditions.
     * Used to populate the advanced stats strip.
     */
    getMotorAnalysis(motor, inputVoltage, pulleySize) {
        const { inductanceMH, resistanceOhms: R, ratedCurrentA, torqueNCm } = motor;
        const L = inductanceMH / 1000; // H
        const circum = pulleySize * 2; // mm per motor revolution

        // Back-EMF constant Ke [V·s/rad], then converted to V/(mm/s)
        const Ke_rad = torqueNCm / (100 * Math.SQRT2 * ratedCurrentA);
        const Ke_mms = Ke_rad * 2 * Math.PI / circum;

        // Torque constant Kt [N·cm/A] (bipolar: divide by √2)
        const Kt = torqueNCm / (ratedCurrentA * Math.SQRT2);

        // Electrical time constant τ = L/R [ms]
        const tau_ms = (L / R) * 1000;

        // Rated copper loss at full current I²R [W]
        const Prated = ratedCurrentA * ratedCurrentA * R;

        // Theoretical EMF-limited speed [mm/s]: where back-EMF = supply voltage
        const speedLimit = Ke_mms > 0 ? inputVoltage / Ke_mms : Infinity;

        return { Ke_mVperMms: Ke_mms * 1000, Kt_NcmA: Kt, tau_ms, Prated_W: Prated, speedLimit_mms: speedLimit };
    }
}
