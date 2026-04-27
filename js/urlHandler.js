// js/urlHandler.js

import { showToast, shortUrl } from './utils.js';

export class URLHandler {
    constructor(motorManager, uiManager) {
        this.motorManager = motorManager;
        this.uiManager    = uiManager;
    }

    generateShareableURL() {
        const data = {
            motorsForSimulation: this.motorManager.getMotorsForSimulation(),
            simulationParams:    this.uiManager.getSimulationParameters(),
            driveSetup:          this.uiManager.getDriveSetup(),
        };
        try {
            const json   = JSON.stringify(data);
            const b64    = btoa(unescape(encodeURIComponent(json)));
            const origin = window.location.origin;
            const path   = window.location.pathname;
            return `${origin}${path}?data=${b64}`;
        } catch (err) {
            console.error('Error generating URL:', err);
            showToast('Error creating shareable link.', 'error');
            return window.location.href;
        }
    }

    loadSimulationFromURL() {
        const params = new URLSearchParams(window.location.search);
        const b64    = params.get('data');
        if (!b64) return false;

        try {
            const json = decodeURIComponent(escape(atob(b64)));
            const data = JSON.parse(json);

            if (data.motorsForSimulation) {
                this.motorManager.setMotorsForSimulation(data.motorsForSimulation);
            }
            if (data.simulationParams) {
                this.uiManager.setSimulationParameters({
                    ...data.simulationParams,
                    driveSetup: data.driveSetup || '1motor'
                });
            }

            history.replaceState(null, '', window.location.origin + window.location.pathname);
            return true;
        } catch (err) {
            console.error('Error loading from URL:', err);
            showToast('Invalid simulation data in URL.', 'error');
            history.replaceState(null, '', window.location.origin + window.location.pathname);
            return false;
        }
    }

    async shareSimulationLink() {
        const motors = this.motorManager.getMotorsForSimulation();
        if (motors.length === 0) {
            showToast('Add at least one motor first.', 'error');
            return;
        }

        const longUrl = this.generateShareableURL();

        // Try to shorten URL
        let finalUrl = longUrl;
        const shortened = await shortUrl(longUrl);
        if (shortened) {
            finalUrl = shortened;
        }

        // Show in share modal immediately
        this.uiManager.setShareUrl(finalUrl);

        // Try to also copy to clipboard
        try {
            await navigator.clipboard.writeText(finalUrl);
            showToast('Simulation link copied to clipboard!', 'success');
        } catch {
            showToast('Link generated. Click Copy to copy it.', 'info');
        }
    }
}
