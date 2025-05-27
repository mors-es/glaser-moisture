// This file contains all the JavaScript functionality for the Glaser Method - Moisture Risk Assessment application.
console.log("loader");
class Material {
    constructor(name, thickness, thermalConductivity, vaporPermeability) {
        this.name = name;
        this.thickness = thickness; // [m]
        this.thermalConductivity = thermalConductivity; // [W/m·K]
        this.vaporPermeability = vaporPermeability; // [kg/m·s·Pa]
    }
}

class GlaserMethod {
    constructor() {
        this.materials = [];
        this.boundaryConditions = {
            tempInterior: 20,
            tempExterior: -10,
            rhInterior: 0.5,
            rhExterior: 0.8
        };
    }

    setBoundaryConditions(tempInt, tempExt, rhInt, rhExt) {
        this.boundaryConditions = {
            tempInterior: tempInt,
            tempExterior: tempExt,
            rhInterior: rhInt / 100.0,
            rhExterior: rhExt / 100.0
        };
    }

    addMaterial(material) {
        this.materials.push(material);
    }

    clearMaterials() {
        this.materials = [];
    }

    saturationVaporPressure(T) {
        return 610.78 * Math.exp(17.27 * T / (T + 237.3));
    }

    calculateThermalProfile() {
        const RSi = 0.13; 
        const RSe = 0.04; 
        
        let RTotal = 0;
        const RCumulative = [0];
        const positions = [0];

        for (const material of this.materials) {
            const RLayer = material.thickness / material.thermalConductivity;
            RTotal += RLayer;
            RCumulative.push(RTotal);
            positions.push(positions[positions.length - 1] + material.thickness);
        }

        const RTotalWithSurfaces = RSi + RTotal + RSe;
        const temperatures = [];

        for (let i = 0; i < RCumulative.length; i++) {
            let T;
            if (i === 0) {
                T = this.boundaryConditions.tempInterior - 
                    (this.boundaryConditions.tempInterior - this.boundaryConditions.tempExterior) * 
                    RSi / RTotalWithSurfaces;
            } else {
                T = this.boundaryConditions.tempInterior - 
                    (this.boundaryConditions.tempInterior - this.boundaryConditions.tempExterior) * 
                    (RSi + RCumulative[i]) / RTotalWithSurfaces;
            }
            temperatures.push(T);
        }

        return { positions, temperatures };
    }

    calculateVaporPressureProfile() {
        const { positions, temperatures } = this.calculateThermalProfile();
        
        let ZTotal = 0;
        const ZCumulative = [0];

        for (const material of this.materials) {
            let ZLayer;
            if (material.vaporPermeability > 1e-6) {
                ZLayer = material.thickness / material.vaporPermeability;
            } else {
                ZLayer = material.vaporPermeability * material.thickness / (2e-12);
            }
            ZTotal += ZLayer;
            ZCumulative.push(ZTotal);
        }

        const pSatInt = this.saturationVaporPressure(this.boundaryConditions.tempInterior);
        const pSatExt = this.saturationVaporPressure(this.boundaryConditions.tempExterior);
        const pVInt = this.boundaryConditions.rhInterior * pSatInt;
        const pVExt = this.boundaryConditions.rhExterior * pSatExt;

        const vaporPressures = [];
        const saturationPressures = [];

        for (let i = 0; i < positions.length; i++) {
            let pV;
            if (i === 0) {
                pV = pVInt;
            } else {
                pV = pVInt - (pVInt - pVExt) * ZCumulative[i] / ZTotal;
            }

            const pSat = this.saturationVaporPressure(temperatures[i]);

            vaporPressures.push(pV);
            saturationPressures.push(pSat);
        }

        return { positions, vaporPressures, saturationPressures, temperatures };
    }

    assessCondensationRisk() {
        const { positions, vaporPressures, saturationPressures, temperatures } = 
            this.calculateVaporPressureProfile();

        const condensationRisk = vaporPressures.map((pV, i) => pV > saturationPressures[i]);
        const riskDifferences = vaporPressures.map((pV, i) => pV - saturationPressures[i]);
        
        let maxRiskLocation = null;
        let maxRiskValue = Math.max(...riskDifferences);
        
        if (maxRiskValue > 0) {
            const maxIndex = riskDifferences.indexOf(maxRiskValue);
            maxRiskLocation = positions[maxIndex];
        }

        return {
            positions,
            vaporPressures,
            saturationPressures,
            temperatures,
            condensationRisk,
            maxRiskLocation,
            maxRiskValue
        };
    }
}

let glaserInstance = new GlaserMethod();
let materialCounter = 0;
let temperatureChart = null;
let vaporChart = null;

const materialDatabase = {
    'Gypsum Board': { thermalConductivity: 0.25, vaporPermeability: 2e-12 },
    'Mineral Wool': { thermalConductivity: 0.04, vaporPermeability: 5e-11 },
    'OSB': { thermalConductivity: 0.13, vaporPermeability: 3e-12 },
    'Concrete': { thermalConductivity: 1.7, vaporPermeability: 3e-12 },
    'Brick': { thermalConductivity: 0.77, vaporPermeability: 1e-12 },
    'Air Gap': { thermalConductivity: 0.18, vaporPermeability: 1e-9 },
    'XPS Insulation': { thermalConductivity: 0.034, vaporPermeability: 1e-13 },
    'Custom': { thermalConductivity: 0.1, vaporPermeability: 1e-11 }
};

function addMaterial() {
    materialCounter++;
    const container = document.getElementById('materials-container');
    
    const materialDiv = document.createElement('div');
    materialDiv.className = 'material-section';
    materialDiv.id = `material-${materialCounter}`;
    
    materialDiv.innerHTML = `
        <div class="material-header">
            <h4>Material Layer ${materialCounter}</h4>
            <button class="remove-btn" onclick="removeMaterial(${materialCounter})">Remove</button>
        </div>
        <div class="input-grid">
            <div class="input-group">
                <label>Material Type</label>
                <select onchange="updateMaterialProperties(${materialCounter})" id="materialType-${materialCounter}">
                    ${Object.keys(materialDatabase).map(name => 
                        `<option value="${name}">${name}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="input-group">
                <label>Thickness (mm)</label>
                <input type="number" id="thickness-${materialCounter}" value="100" min="1" step="1">
            </div>
            <div class="input-group">
                <label>Thermal Conductivity (W/m·K)</label>
                <input type="number" id="thermalCond-${materialCounter}" value="0.04" step="0.001">
            </div>
            <div class="input-group">
                <label>Vapor Permeability (kg/m·s·Pa)</label>
                <input type="number" id="vaporPerm-${materialCounter}" value="5e-11" step="1e-12">
            </div>
        </div>
    `;
    
    container.appendChild(materialDiv);
    updateMaterialProperties(materialCounter);
}

function removeMaterial(id) {
    const element = document.getElementById(`material-${id}`);
    element.remove();
}

function updateMaterialProperties(id) {
    const materialType = document.getElementById(`materialType-${id}`).value;
    const properties = materialDatabase[materialType];
    
    document.getElementById(`thermalCond-${id}`).value = properties.thermalConductivity;
    document.getElementById(`vaporPerm-${id}`).value = properties.vaporPermeability.toExponential(2);
}

function loadDefaultWall() {
    document.getElementById('materials-container').innerHTML = '';
    materialCounter = 0;
    
    const defaultMaterials = [
        { name: 'Gypsum Board', thickness: 12 },
        { name: 'Mineral Wool', thickness: 100 },
        { name: 'OSB', thickness: 12 },
        { name: 'Air Gap', thickness: 20 },
        { name: 'Brick', thickness: 100 }
    ];
    
    defaultMaterials.forEach(material => {
        addMaterial();
        document.getElementById(`materialType-${materialCounter}`).value = material.name;
        document.getElementById(`thickness-${materialCounter}`).value = material.thickness;
        updateMaterialProperties(materialCounter);
    });
}

function collectMaterials() {
    glaserInstance.clearMaterials();
    
    const materialSections = document.querySelectorAll('.material-section');
    materialSections.forEach(section => {
        const id = section.id.split('-')[1];
        const name = document.getElementById(`materialType-${id}`).value;
        const thickness = parseFloat(document.getElementById(`thickness-${id}`).value) / 1000; 
        const thermalConductivity = parseFloat(document.getElementById(`thermalCond-${id}`).value);
        const vaporPermeability = parseFloat(document.getElementById(`vaporPerm-${id}`).value);
        
        const material = new Material(name, thickness, thermalConductivity, vaporPermeability);
        glaserInstance.addMaterial(material);
    });
}

function calculateRisk() {
    const tempInt = parseFloat(document.getElementById('tempInterior').value);
    const tempExt = parseFloat(document.getElementById('tempExterior').value);
    const rhInt = parseFloat(document.getElementById('rhInterior').value);
    const rhExt = parseFloat(document.getElementById('rhExterior').value);
    
    glaserInstance.setBoundaryConditions(tempInt, tempExt, rhInt, rhExt);
    
    collectMaterials();
    
    if (glaserInstance.materials.length === 0) {
        alert('Please add at least one material layer.');
        return;
    }
    
    const results = glaserInstance.assessCondensationRisk();
    
    displayResults(results);
    visualizeWall();
    createCharts(results);
}

function displayResults(results) {
    const resultsPanel = document.getElementById('results-panel');
    const riskAssessment = document.getElementById('risk-assessment');
    
    let html = `
        <h4>Boundary Conditions:</h4>
        <p>Interior: ${glaserInstance.boundaryConditions.tempInterior}°C, ${(glaserInstance.boundaryConditions.rhInterior * 100).toFixed(1)}% RH</p>
        <p>Exterior: ${glaserInstance.boundaryConditions.tempExterior}°C, ${(glaserInstance.boundaryConditions.rhExterior * 100).toFixed(1)}% RH</p>
        
        <h4>Wall Composition (Interior to Exterior):</h4>
        <ul>
    `;
    
    glaserInstance.materials.forEach((material, i) => {
        html += `<li>${material.name}: ${(material.thickness * 1000).toFixed(0)}mm</li>`;
    });
    
    html += '</ul>';
    
    if (results.maxRiskLocation !== null && results.maxRiskValue > 0) {
        html += `
            <div class="risk-warning">
                <strong>⚠️ CONDENSATION RISK DETECTED</strong><br>
                Location: ${(results.maxRiskLocation * 1000).toFixed(1)}mm from interior surface<br>
                Excess vapor pressure: ${results.maxRiskValue.toFixed(1)} Pa
            </div>
        `;
    } else {
        html += `
            <div class="risk-safe">
                <strong>✅ NO CONDENSATION RISK DETECTED</strong><br>
                Maximum vapor pressure deficit: ${(-results.maxRiskValue).toFixed(1)} Pa
            </div>
        `;
    }
    
    riskAssessment.innerHTML = html;
    resultsPanel.style.display = 'block';
}

function visualizeWall() {
    const container = document.getElementById('wallVisualization');
    container.innerHTML = '<h4 style="text-align: center; margin: 10px;">Wall Cross-Section</h4>';
    
    const totalThickness = glaserInstance.materials.reduce((sum, material) => sum + material.thickness, 0);
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    
    let position = 0;
    glaserInstance.materials.forEach((material, i) => {
        const width = (material.thickness / totalThickness) * 100;
        
        const layerDiv = document.createElement('div');
        layerDiv.style.cssText = `
            position: absolute;
            left: ${(position / totalThickness) * 100}%;
            width: ${width}%;
            height: 80px;
            top: 50%;
            transform: translateY(-50%);
            background-color: ${colors[i % colors.length]};
            border: 1px solid #333;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            text-align: center;
            box-sizing: border-box;
        `;
        
        layerDiv.innerHTML = `${material.name}<br>${(material.thickness * 1000).toFixed(0)}mm`;
        container.appendChild(layerDiv);
        
        position += material.thickness;
    });
}

function createCharts(results) {
    createTemperatureChart(results);
    createVaporChart(results);
}

function createTemperatureChart(results) {
    const ctx = document.getElementById('temperatureChart').getContext('2d');
    
    if (temperatureChart) {
        temperatureChart.destroy();
    }
    
    temperatureChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: results.positions.map(pos => (pos * 1000).toFixed(1)),
            datasets: [{
                label: 'Temperature (°C)',
                data: results.temperatures,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                tension: 0.1,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Temperature Profile'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Position (mm)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            }
        }
    });
}

function createVaporChart(results) {
    const ctx = document.getElementById('vaporChart').getContext('2d');
    
    if (vaporChart) {
        vaporChart.destroy();
    }
    
    vaporChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: results.positions.map(pos => (pos * 1000).toFixed(1)),
            datasets: [{
                label: 'Vapor Pressure (Pa)',
                data: results.vaporPressures,
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                tension: 0.1,
                pointRadius: 6,
                pointHoverRadius: 8
            }, {
                label: 'Saturation Vapor Pressure (Pa)',
                data: results.saturationPressures,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Vapor Pressure Profile'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Position (mm)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Pressure (Pa)'
                    }
                }
            }
        }
    });
}

window.onload = function() {
    loadDefaultWall();
};