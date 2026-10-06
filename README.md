# Google Badge 3D Customizer & 3MF/STL Generator

An interactive 3D WebGL web application for customizing, configuring, and 3D printing Google employee badge holders (CR80 credit card format).

Designed for Google Munich Maker Space printers (Prusa MK3/MK4, Ultimaker, Bambu Lab A1 Mini / P1S / X1C with AMS, Voron, Creality).

## Features

- **Credit Card Dimensions (CR80)**: Engineered to fit standard Google employee badges (54.0 mm × 85.6 mm × 0.82 mm).
- **Edge Profiles**:
  - **Minimalist**: Sleek chamfered perimeter with rounded corners.
  - **Classic Plain Edge**: Traditional clean perimeter with straight edges.
  - **Wave Edge**: Ergonomic scalloped grip contours along sides.
- **Bed-Anchored Corner Medallion**: Solid circular base disc in the lower right corner anchored to the print plate, housing the emblem with 0° overhangs.
- **Top 5 Google Service Emblems**:
  - Google Cloud
  - Android
  - Google Chrome
  - YouTube
  - Google DeepMind / Gemini
  - *+ Custom Team Logo / Text* (SVG upload or custom team monogram)
- **Multi-Material & Slicing Optimizations**:
  - **Watertight Manifold Topology**: Spatial vertex welding engine eliminates non-manifold open edges for error-free slicer import.
  - **Volumetric Z-Lock Penetration**: 0.20 mm (1 full layer) volumetric emblem inset into the host body, ensuring multi-filament AMS/MMU engines carve an interlocking cavity without dropping layers.
- **Export Options**:
  - **Native Bambu Studio .3MF**: Pre-packaged project with AMS slot mappings (Slot 1: Frame, Slot 2: Logo) and `model_settings.config`.
  - **Universal Multi-Color .3MF**: Open 3MF Consortium standard for PrusaSlicer, OrcaSlicer, Cura, and Maker Space multi-tool printers.
  - **Universal Single-Color .STL**: 1-click binary STL export for standard single-extruder 3D printing.
- **Parametric Fit Controls**:
  - Snug (1.05 mm pocket), Standard (1.30 mm pocket), and Loose (1.65 mm pocket) presets.
  - Sliders for pocket depth, pocket width, bezel coverage, backplate thickness, front lip, and lanyard slot dimensions.
- **Integrated Lanyard Slot & Thumb Window**: 15.0 mm × 3.5 mm top slot for clips/reels and ergonomic back thumb slide opening.
- **Dual-Gate Security**:
  - One-click Google Corporate Sign-In (`@google.com`).
  - Passcode fallback gate (`Cloudspac5`).

---

## 3D Printing Recommendations

| Parameter | Recommended Value | Notes |
| :--- | :--- | :--- |
| **Print Orientation** | Flat on backplate (0°) | **100% Support-free** printing |
| **Layer Height** | 0.20 mm | 0.16 mm for ultra-fine corner emblem detail |
| **Infill** | 20–25% | Gyroid or Grid |
| **Walls / Perimeters** | 3 loops | Ensures high tensile strength at the lanyard loop |
| **Top / Bottom Layers** | 3–4 layers | Smooth surface finish |
| **Material** | PLA, PETG, or ABS/ASA | Tough PLA or PETG recommended |
| **Estimated Print Time** | ~22–26 minutes | Based on standard modern printer speeds |
| **Filament Usage** | ~10–12 grams | Lightweight & portable |

---

## Running Locally

To launch the local web server:

```bash
# Start local server (running on port 8080)
node server.js
```

Then open [http://localhost:8080/](http://localhost:8080/) in your browser.
