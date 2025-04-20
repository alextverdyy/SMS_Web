// Js/url handler.js

import { showToast, shortUrl } from './utils.js';

export class URLHandler {
    constructor(motorManager, uiManager) {
        this.motorManager = motorManager;
        this.uiManager = uiManager;
    }

    /**
     * It generates a URL shared with the current status of the simulation.
     * @returns {string} -The complete URL.
     */
    generateShareableURL() {
        const simulationData = {
            // Use getters to get current copies

            motorsForSimulation: this.motorManager.getMotorsForSimulation(),
            // Get parameters from the UI

            simulationParams: this.uiManager.getSimulationParameters()
        };

        try {
            const jsonString = JSON.stringify(simulationData);
            // Use BTOA for base64 (simple, but you can have problems with special characters if they are not handled well)
            // Consider libraries such as JS-Base64 If there are unicode problems

            const base64Data = btoa(unescape(encodeURIComponent(jsonString))); // Code for UTF-8 before BTOA


            // Create the URL
            const baseUrl = "https://alextverdyy.github.io" // Current page URL

            const shareableURL = `${baseUrl}${window.location.pathname}?data=${base64Data}`; // No encodeuricomponent here, Btoa is already safe for URL

            return shareableURL;
        } catch (error) {
            console.error("Error generating shareable URL:", error);
            showToast("Error creating shareable link.", 'error');
            return window.location.href; // Returns current URL as Fallback

        }
    }

    /**
     * Try to load the status of the simulation from the parameters of the current URL.
     * @returns {boolean} -True if data were loaded, false otherwise.
     */
    loadSimulationFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const base64Data = urlParams.get('data');

        if (!base64Data) {
            return false; // There is no data at the URL

        }

        try {
            // Decode from Base64 to Json

            const jsonString = decodeURIComponent(escape(atob(base64Data))); // Codification inverse

            const simulationData = JSON.parse(jsonString);

            // Restore simulation data

            if (simulationData.motorsForSimulation) {
                this.motorManager.setMotorsForSimulation(simulationData.motorsForSimulation);
            }
            if (simulationData.simulationParams) {
                this.uiManager.setSimulationParameters(simulationData.simulationParams);
            }

            // Clean the URL to avoid accidental recharges with the same data

            const cleanUrl = window.location.origin + window.location.pathname;
            history.replaceState(null, '', cleanUrl); // Change the URL without recharging


            console.log("Simulation data loaded from URL.");
            return true; // Loaded data


        } catch (error) {
            console.error("Error loading simulation data from URL:", error);
            showToast("Invalid simulation data in URL.", 'error');
            // Clean URL also in case of error to avoid loops

             const cleanUrl = window.location.origin + window.location.pathname;
             history.replaceState(null, '', cleanUrl);
            return false; // Error when loading

        }
    }

    /**
     * It generates a short URL and the copy to the clipboard.
     */
    async shareSimulationLink() {
        const motors = this.motorManager.getMotorsForSimulation();
        if (motors.length === 0) {
            showToast("Please add at least one motor to the simulation table.", 'error');
            return;
        }

        const longUrl = this.generateShareableURL();
        const shortenedUrl = await shortUrl(longUrl); // Use the usefulness


        if (!shortenedUrl) {
            // The error was already shown in Shorturll

            return;
        }

        try {
            await navigator.clipboard.writeText(shortenedUrl);
            showToast("Shortened simulation URL copied to clipboard!", 'success');
        } catch (err) {
            console.error("Failed to copy URL:", err);
            showToast("Failed to copy URL. Please try again.", 'error');
            // As Fallback, Show the URL to copy manually

            prompt("Could not copy automatically. Please copy this link:", shortenedUrl);
        }
    }
}
