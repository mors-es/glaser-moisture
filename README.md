# Glaser Method - Moisture Risk Assessment

## Overview
This project implements the Glaser Method for assessing moisture risk in building materials. It allows users to input boundary conditions and wall materials to evaluate the potential for condensation and moisture-related issues.

## Project Structure
```
glaser-moisture
├── index.html          # Main HTML structure for the application
├── styles              # Directory containing CSS styles
│   └── styles.css      # Styles for the application
├── scripts             # Directory containing JavaScript functionality
│   └── app.js          # JavaScript code for managing materials and calculations
└── README.md           # Documentation for the project
```

## Setup Instructions
1. **Clone the repository**:
   ```
   git clone <repository-url>
   cd glaser-moisture
   ```

2. **Open `index.html`** in your web browser to view the application.

## Usage
- Input the interior and exterior temperature and humidity values.
- Add wall materials by clicking "Add Material Layer" and selecting the material type.
- Click "Calculate Moisture Risk" to assess the risk of condensation.
- Review the results displayed below the input sections, including a wall visualization and charts.

## Dependencies
- The project uses Chart.js for visualizing temperature and vapor pressure profiles. Ensure you have an internet connection to load the library from the CDN.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.