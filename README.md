# 3D Plane Model

A web-based 3D model of a plane using Three.js.

## Features

- Detailed 3D airplane model
- Long runway on a grass field
- Third-person camera view that follows the plane
- Keyboard controls for plane movement and pitch
- Realistic takeoff physics
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

This will start the Vite development server, typically at http://localhost:5173. Open this URL in your browser to view the 3D plane model.

Build a production version:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

Run the physics unit tests:

```bash
npm test
```

## Controls

- **W key**: Accelerate the plane forward along the runway
- **A / D keys**: Rudder left/right (yaw)
- **Arrow Left / Arrow Right**: Bank left/right and turn
- **Arrow Down**: Pitch the plane's nose up
- **Arrow Up**: Pitch the plane's nose down
- **C key**: Toggle camera mode with orbit controls
  - In camera mode, you can:
    - **Left-click + drag**: Rotate the camera around the plane
    - **Right-click + drag**: Pan the camera
    - **Scroll**: Zoom in/out

## Flight Instructions

1. **Takeoff**:
   - Accelerate to high speed by holding W
   - Once at sufficient speed, pitch up using the Down Arrow
   - The plane will lift off when it has enough speed and upward pitch
   - Continue to adjust pitch for climbing or descending

2. **Landing**:
   - Reduce speed by releasing W
   - Gently pitch down to descend
   - Level out as you approach the ground

## Scene Description

- The scene features a detailed airplane model positioned on a long runway.
- The camera is positioned in a third-person view behind and slightly above the plane.
- The propeller animates by spinning around its axis.
- The plane can be controlled to move along the runway, pitch up/down, and take off.

## Customization

You can modify the airplane model by editing the `createAirplane()` function in `src/airplane.js`. Adjust colors, dimensions, or add additional components as needed.

## Technologies Used

- Three.js - JavaScript 3D library
- Vite - Development server and production bundler
- HTML5 & CSS3
- JavaScript (ES6+) 
