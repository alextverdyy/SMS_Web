// Js/ui manager.js

import { debounce } from './utils.js'; // Import if necessary here too


export class UIManager {
    constructor(motorManager, simulation, appCallbacks) {
        this.motorManager = motorManager; // Necessary to obtain data

        this.simulation = simulation;     // Necessary to update graphics

        this.appCallbacks = appCallbacks; // Functions to notify APP (eg: Addcustommotor, Share)


        // References to elements del gift

        this.motorListContainer = document.getElementById('motor-list-content');
        this.addMotorStatusDiv = document.getElementById('add-motor-status');
        this.addMotorForm = document.getElementById('add-motor-form');
        this.motorFilterInput = document.getElementById('motor-filter-input');
        this.motorSuggestionsDiv = document.getElementById('motor-suggestions');
        this.selectedMotorsTableBody = document.querySelector('#selected-motors-table tbody');
        this.simulationParamsForm = document.getElementById('simulation-form'); // Assuming a parameter form

        this.shareButton = document.getElementById('share-simulation-btn'); // Assuming a sharing button

        this.addMotorButton = document.getElementById('add-motor-button'); // Add Motor Form button


        this.initializeTabs();
        this.setupEventListeners();
    }

    initializeTabs() {
        const tabHeaders = document.querySelectorAll('.tab-headers li');
        const tabContents = document.querySelectorAll('.tab-content');

        tabHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const targetTab = header.getAttribute('data-tab');
                tabHeaders.forEach(h => h.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                header.classList.add('active');
                document.getElementById(targetTab)?.classList.add('active'); // Add ? for security

            });
        });
        // Activate the first default tab if none is active

        if (!document.querySelector('.tab-headers li.active')) {
            tabHeaders[0]?.classList.add('active');
            tabContents[0]?.classList.add('active');
        }
    }

    setupEventListeners() {
        // Motor filter

        this.motorFilterInput.addEventListener('input', this.handleMotorFilterInput.bind(this));
        this.motorFilterInput.addEventListener('focus', this.handleMotorFilterInput.bind(this));
        document.addEventListener('click', (event) => {
            if (!this.motorFilterInput.contains(event.target) && !this.motorSuggestionsDiv.contains(event.target)) {
                this.hideSuggestions();
            }
        });

        // Add Motor Form

        this.addMotorForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent real shipping of the form

            this.handleAddCustomMotor();
        });

        
        const debouncedUpdateSimulation = debounce(() => {
            this.appCallbacks.updateSimulation();
        }, 700);
        
        this.simulationParamsForm.addEventListener('input', debouncedUpdateSimulation);

        // Share button

        this.shareButton.addEventListener('click', this.appCallbacks.shareSimulation);

        // Delegation of events for "stir" buttons in the table

        this.selectedMotorsTableBody.addEventListener('click', (event) => {
            if (event.target.classList.contains('remove-motor-btn')) {
                // Find the index of the row

                const row = event.target.closest('tr');
                if (row) {
                    const rowIndex = Array.from(this.selectedMotorsTableBody.rows).indexOf(row);
                    this.appCallbacks.removeMotorFromSimulation(rowIndex);
                }
            }
        });
    }

    // ---Methods to update the UI ---


    displayMotorList() {
        this.motorListContainer.innerHTML = ''; // Clean anterior content

        const motors = this.motorManager.getPreconfiguredMotors();

        if (motors.length === 0) {
            this.motorListContainer.innerHTML = '<p>No motors found or loaded.</p>';
            return;
        }

        motors.forEach(motor => {
            const card = this.createMotorCard(motor);
            this.motorListContainer.appendChild(card);
        });
    }

    createMotorCard(motor) {
        const card = document.createElement('div');
        card.classList.add('motor-card');
        card.classList.add('motor-card-' + motor.inSimulation !== undefined && motor.inSimulation ? 'in-simulation' : 'not-in-simulation');
        card.id = "motor-card-id-" + motor.id;

        card.innerHTML = `
            <h3>${motor.brandModel ?? 'Unnamed Motor'}</h3>
            <p><strong>Step Angle:</strong> ${motor.stepAngleDeg ?? 'N/A'}°</p>
            <p><strong>Rated Current:</strong> ${motor.ratedCurrentA ?? 'N/A'} A</p>
            <p><strong>Holding Torque:</strong> ${motor.torqueNCm ?? 'N/A'} N-cm</p>
            <p><strong>Inductance:</strong> ${motor.inductanceMH ?? 'N/A'} mH</p>
            <p><strong>Resistance:</strong> ${motor.resistanceOhms ?? 'N/A'} Ω</p>
            <p><strong>Rotor Inertia:</strong> ${motor.rotorInertiaGCm2 ?? 'N/A'} g-cm²</p>
            ${motor.nema ? `<p><strong>NEMA:</strong> ${motor.nema}</p>` : ''}
            ${motor.bodyLengthMm ? `<p><strong>Length:</strong> ${motor.bodyLengthMm} mm</p>` : ''}
        `;

        card.addEventListener('click', (event) => {
            event.stopPropagation();
            card.classList.toggle('selected');
            if (card.classList.contains('selected')) {
                card.classList.add('in-simulation');
                card.classList.remove('not-in-simulation');
                this.appCallbacks.addMotorToSimulation(motor)
            } else {
                const rowIndex = this.motorManager.getMotorsForSimulation().findIndex(m => m.id == motor.id);
                this.appCallbacks.removeMotorFromSimulation(rowIndex)
                card.classList.remove('in-simulation');
                card.classList.add('not-in-simulation');
            }
        });
        return card;
    }

    handleMotorFilterInput() {
        const filterText = this.motorFilterInput.value;
        if (filterText.trim().length < 1) { // Minimum 1 character to search

            this.hideSuggestions();
            return;
        }
        const filteredMotors = this.motorManager.filterMotors(filterText);
        this.displaySuggestions(filteredMotors);
    }

    displaySuggestions(suggestions) {
        this.motorSuggestionsDiv.innerHTML = '';
        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        suggestions.forEach(motor => {
            const suggestionItem = document.createElement('div');
            suggestionItem.textContent = motor.brandModel;
            suggestionItem.classList.add('suggestion-item'); // Add class for styles

            suggestionItem.addEventListener('click', () => {
                this.appCallbacks.addMotorToSimulation(motor);
                this.motorFilterInput.value = ''; // Clean input
                const card = document.getElementById(`motor-card-id-${motor.id}`);
                card.classList.add('selected');
                card.classList.add('in-simulation');
                card.classList.remove('not-in-simulation');

                this.hideSuggestions();
            });
            this.motorSuggestionsDiv.appendChild(suggestionItem);
        });
        this.motorSuggestionsDiv.style.display = 'block';
    }

    hideSuggestions() {
        this.motorSuggestionsDiv.style.display = 'none';
        this.motorSuggestionsDiv.innerHTML = ''; // Clean up

    }

    updateSelectedMotorsTable() {
        this.selectedMotorsTableBody.innerHTML = ''; // Clean table

        const motors = this.motorManager.getMotorsForSimulation();

        if (motors.length === 0) {
            this.selectedMotorsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ABB2BF;">No motors selected yet. Add one from the list or the form below.</td></tr>`;
            return;
        }

        motors.forEach((motor) => { // We do not need the index here

            const row = this.selectedMotorsTableBody.insertRow();
            row.insertCell().textContent = motor.brandModel ?? 'N/A';
            row.insertCell().textContent = motor.stepAngleDeg ?? 'N/A';
            row.insertCell().textContent = motor.ratedCurrentA ?? 'N/A';
            row.insertCell().textContent = motor.torqueNCm ?? 'N/A';
            row.insertCell().textContent = motor.inductanceMH ?? 'N/A';
            row.insertCell().textContent = motor.resistanceOhms ?? 'N/A';

            const actionCell = row.insertCell();
            actionCell.classList.add('action-cell');
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.classList.add('remove-motor-btn');
            // The event is handled by delegation in Setupeventlisteners

            actionCell.appendChild(removeButton);
        });
    }

    handleAddCustomMotor() {
        this.addMotorStatusDiv.textContent = ''; // Clean previous condition

        this.addMotorStatusDiv.className = '';

        // Collect form data

        const motorData = {
            brandModel: document.getElementById('new-motor-brandmodel').value.trim(),
            stepAngleDeg: parseFloat(document.getElementById('new-motor-stepangle').value),
            ratedCurrentA: parseFloat(document.getElementById('new-motor-current').value),
            torqueNCm: parseFloat(document.getElementById('new-motor-torque').value),
            inductanceMH: parseFloat(document.getElementById('new-motor-inductance').value),
            resistanceOhms: parseFloat(document.getElementById('new-motor-resistance').value),
            rotorInertiaGCm2: parseFloat(document.getElementById('new-motor-inertia').value) || null,
            nema: parseInt(document.getElementById('new-motor-nema').value) || null,
            bodyLengthMm: parseFloat(document.getElementById('new-motor-length').value) || null
        };

        // Call the manager method through app callback

        this.appCallbacks.addCustomMotor(motorData);
    }

    // Method to show the result of adding custom motor

    displayAddMotorStatus(success, message) {
         this.addMotorStatusDiv.textContent = message;
         this.addMotorStatusDiv.className = success ? 'status-success' : 'status-error';
         if (success) {
             this.addMotorForm.reset(); // Clean form if success

         }
    }

    /**
     * Obtains the current parameters of the simulation from the form.
     * @returns {object} -Object with parameters.
     */
    getSimulationParameters() {
        return {
            inputVoltage: parseFloat(document.getElementById("input-voltage").value) || 12,
            maxCurrent: parseFloat(document.getElementById("max-current").value) || 1.5,
            pulleySize: parseFloat(document.getElementById("pulley-size").value) || 20,
            acceleration: parseFloat(document.getElementById("acceleration").value) || 500,
            toolheadMass: parseFloat(document.getElementById("toolhead-mass").value) || 1
        };
    }

    /**
     * Establish the simulation parameters in the form (used when loading from URL).
     * @param {object} params -Object with parameters.
     */
    setSimulationParameters(params) {
        document.getElementById("input-voltage").value = params.inputVoltage ?? 12;
        document.getElementById("max-current").value = params.maxCurrent ?? 1.5;
        document.getElementById("pulley-size").value = params.pulleySize ?? 20;
        document.getElementById("acceleration").value = params.acceleration ?? 500;
        document.getElementById("toolhead-mass").value = params.toolheadMass ?? 1;
    }
}
