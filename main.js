let preconfiguredMotors = [];
let motorsForSimulation = [];

const motorListContainer = document.getElementById('motor-list-content');
const addMotorStatusDiv = document.getElementById('add-motor-status');
const addMotorForm = document.getElementById('add-motor-form');
const motorFilterInput = document.getElementById('motor-filter-input');
const motorSuggestionsDiv = document.getElementById('motor-suggestions');
const selectedMotorsTableBody = document.querySelector('#selected-motors-table tbody');

document.addEventListener('DOMContentLoaded', () => {
    const tabHeaders = document.querySelectorAll('.tab-headers li');
    const tabContents = document.querySelectorAll('.tab-content');
    tabHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const targetTab = header.getAttribute('data-tab');
            tabHeaders.forEach(h => h.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            header.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    loadMotorList();
    initializeChart();
    setupMotorFilterListeners();
});

function setupMotorFilterListeners() {
    motorFilterInput.addEventListener('input', handleMotorFilterInput);
    motorFilterInput.addEventListener('focus', handleMotorFilterInput);

    document.addEventListener('click', (event) => {
        if (!motorFilterInput.contains(event.target) && !motorSuggestionsDiv.contains(event.target)) {
            motorSuggestionsDiv.style.display = 'none';
        }
    });
}

async function loadMotorList() {
    try {
        const response = await fetch('motors.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        preconfiguredMotors = await response.json();
        displayMotorList();
    } catch (error) {
        console.error("Error loading motor list:", error);
        motorListContainer.innerHTML = `<p style="color: #F38BA8;">Error loading motor list. Check console.</p>`;
        preconfiguredMotors = [];
    }
    updateSelectedMotorsTable();
}

function displayMotorList() {
    motorListContainer.innerHTML = '';
    if (preconfiguredMotors.length === 0) {
        motorListContainer.innerHTML = '<p>No motors found or loaded.</p>';
        return;
    }

    const sortedMotors = [...preconfiguredMotors].sort((a, b) => (a.brandModel || '').localeCompare(b.brandModel || ''));
    sortedMotors.forEach(motor => {
        const card = createMotorCard(motor);
        motorListContainer.appendChild(card);
    });
}

function createMotorCard(motor) {
    const card = document.createElement('div');
    card.classList.add('motor-card');
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
    return card;
}

function handleMotorFilterInput() {
    const filterText = motorFilterInput.value.toLowerCase().trim();
    if (filterText.length < 1) {
        motorSuggestionsDiv.style.display = 'none';
        return;
    }

    const filteredMotors = preconfiguredMotors.filter(motor =>
        motor.brandModel && motor.brandModel.toLowerCase().includes(filterText)
    );
    displaySuggestions(filteredMotors);
}

function displaySuggestions(suggestions) {
    motorSuggestionsDiv.innerHTML = '';
    if (suggestions.length === 0) {
        motorSuggestionsDiv.style.display = 'none';
        return;
    }

    suggestions.forEach(motor => {
        const suggestionItem = document.createElement('div');
        suggestionItem.textContent = motor.brandModel;
        suggestionItem.addEventListener('click', () => selectMotorForSimulation(motor));
        motorSuggestionsDiv.appendChild(suggestionItem);
    });
    motorSuggestionsDiv.style.display = 'block';
}

function selectMotorForSimulation(motor) {
    if (motorsForSimulation.some(m => m.brandModel === motor.brandModel)) {
        console.log(`Motor "${motor.brandModel}" is already selected.`);
    } else {
        motorsForSimulation.push(motor);
        updateSelectedMotorsTable();
    }

    motorFilterInput.value = '';
    motorSuggestionsDiv.style.display = 'none';
}

let torqueSpeedChart;

function initializeChart() {
    const ctx = document.getElementById('torque-speed-chart').getContext('2d');
    torqueSpeedChart = new Chart(ctx, {
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

function updateSelectedMotorsTable() {
    selectedMotorsTableBody.innerHTML = '';
    if (motorsForSimulation.length === 0) {
        selectedMotorsTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ABB2BF;">No motors selected yet.</td></tr>`;
        return;
    }

    motorsForSimulation.forEach((motor, index) => {
        const row = selectedMotorsTableBody.insertRow();
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
        removeButton.onclick = () => removeMotorFromSimulation(index);
        actionCell.appendChild(removeButton);
    });
}

function removeMotorFromSimulation(indexToRemove) {
    motorsForSimulation.splice(indexToRemove, 1);
    updateSelectedMotorsTable();
}

function addMotor() {
    addMotorStatusDiv.textContent = '';
    addMotorStatusDiv.className = '';

    const brandModel = document.getElementById('new-motor-brandmodel').value.trim();
    const stepAngleDeg = parseFloat(document.getElementById('new-motor-stepangle').value);
    const ratedCurrentA = parseFloat(document.getElementById('new-motor-current').value);
    const torqueNCm = parseFloat(document.getElementById('new-motor-torque').value);
    const inductanceMH = parseFloat(document.getElementById('new-motor-inductance').value);
    const resistanceOhms = parseFloat(document.getElementById('new-motor-resistance').value);
    const rotorInertiaGCm2 = parseFloat(document.getElementById('new-motor-inertia').value) || null;
    const nema = parseInt(document.getElementById('new-motor-nema').value) || null;
    const bodyLengthMm = parseFloat(document.getElementById('new-motor-length').value) || null;

    if (!brandModel || isNaN(stepAngleDeg) || isNaN(ratedCurrentA) || isNaN(torqueNCm) || isNaN(inductanceMH) || isNaN(resistanceOhms)) {
        addMotorStatusDiv.textContent = 'Error: Please fill in all required fields (*) with valid numbers.';
        addMotorStatusDiv.className = 'status-error';
        return;
    }

    if (preconfiguredMotors.some(motor => motor.brandModel === brandModel)) {
        addMotorStatusDiv.textContent = `Error: Motor with Brand & Model "${brandModel}" already exists.`;
        addMotorStatusDiv.className = 'status-error';
        return;
    }

    const newMotor = {
        brandModel,
        brand: brandModel.split('-')[0] || 'Custom',
        model: brandModel.substring(brandModel.indexOf('-') + 1) || 'Motor',
        nema,
        bodyLengthMm,
        stepAngleDeg,
        ratedCurrentA,
        torqueNCm,
        inductanceMH,
        resistanceOhms,
        rotorInertiaGCm2
    };

    preconfiguredMotors.push(newMotor);
    displayMotorList();

    addMotorStatusDiv.textContent = `Motor "${brandModel}" added successfully for this session.`;
    addMotorStatusDiv.className = 'status-success';
    addMotorForm.reset();
}

function calculateRequiredTorque(toolheadMass, acceleration, pulleySize) {
    const accelReq = acceleration / 1000;
    const torqueReq = toolheadMass / 1000;
    const gearRatio = (pulleySize * 2) / 1;
    const piCalc = 2 * Math.PI * 10;
    const radiusMeters = ((pulleySize / 2) * piCalc) / (gearRatio * 1000);
    return accelReq * torqueReq * gearRatio / piCalc;
}

function updateSimulation() {
    if (!torqueSpeedChart) {
        console.error("Chart not initialized yet.");
        return;
    }

    const selectedMotors = motorsForSimulation;
    if (selectedMotors.length === 0) {
        alert("Please add at least one motor to the simulation table.");
        torqueSpeedChart.data.labels = [];
        torqueSpeedChart.data.datasets = [];
        torqueSpeedChart.update();
        return;
    }

    const inputVoltage = parseFloat(document.getElementById("input-voltage").value);
    const maxCurrent = parseFloat(document.getElementById("max-current").value);
    const pulleySize = parseFloat(document.getElementById("pulley-size").value);
    const acceleration = parseFloat(document.getElementById("acceleration").value);
    const toolheadMass = parseFloat(document.getElementById("toolhead-mass").value);

    const speeds = Array.from({ length: 100 }, (_, i) => i * 0.5);
    const datasets = selectedMotors.map((motor, index) => {
        const hue = (index * (360 / selectedMotors.length)) % 360;
        const color = `hsl(${hue}, 70%, 60%)`;
        return {
            label: motor.brandModel || `Motor ${index + 1}`,
            data: speeds.map(speed => {
                return singleCoilTorque(
                    motor.stepAngleDeg,
                    motor.ratedCurrentA,
                    motor.torqueNCm,
                    motor.inductanceMH,
                    motor.resistanceOhms,
                    motor.rotorInertiaGCm2,
                    inputVoltage,
                    maxCurrent,
                    speed
                ) - calculateRequiredTorqueForMotor(acceleration, pulleySize, motor.rotorInertiaGCm2);
            }),
            borderColor: color,
            borderWidth: 2,
            fill: false,
            pointRadius: 1,
            tension: 0.1
        };
    });

    const requiredTorque = calculateRequiredTorque(toolheadMass, acceleration, pulleySize);
    datasets.push({
        label: "Required Torque",
        data: Array(speeds.length).fill(requiredTorque),
        borderColor: "#F38BA8",
        borderWidth: 2,
        borderDash: [5, 5],
        fill: false,
        pointRadius: 0
    });

    torqueSpeedChart.data.labels = speeds.map(speed => `${speed * (pulleySize * 2) / 1}`);
    torqueSpeedChart.data.datasets = datasets;
    torqueSpeedChart.update();
}

function calculateRequiredTorqueForMotor(acceleration, pulleySize, inertia) {
    return acceleration / (pulleySize * 2) * 2 * Math.PI * (inertia / (1000 * Math.pow(100, 2))) * 100;
}

function singleCoilTorque(stepAngle, ratedCurrent, torque, inductance, resistance, rotorInertia, inputVoltage, driveCurrent, rps) {
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