# 3D Plane Model

A web-based 3D model of a plane using Three.js.

## Features

- Detailed 3D airplane model
- Long runway on a grass field
- Third-person camera view that follows the plane
- Keyboard controls for plane movement
- Debug mode with orbit controls
- Animated propeller
- Responsive design

## Getting Started

### Prerequisites

- Node.js and npm installed on your machine

### Installation

1. Clone this repository or download the files
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

### Running the Project

Start the development server:

```bash
npm start
```

This will start a local server, typically at http://localhost:3000. Open this URL in your browser to view the 3D plane model.

## Controls

- **W key**: Accelerate the plane forward along the runway
- **D key**: Toggle debug mode with orbit controls
  - In debug mode, you can:
    - **Left-click + drag**: Rotate the camera around the plane
    - **Right-click + drag**: Pan the camera
    - **Scroll**: Zoom in/out

## Scene Description

- The scene features a detailed airplane model positioned on a long runway.
- The camera is positioned in a third-person view behind and slightly above the plane.
- The propeller animates by spinning around its axis.
- The plane can be controlled to move along the runway.

## Customization

You can modify the airplane model by editing the `createAirplane()` function in `main.js`. Adjust colors, dimensions, or add additional components as needed.

## Technologies Used

- Three.js - JavaScript 3D library
- HTML5 & CSS3
- JavaScript (ES6+) 