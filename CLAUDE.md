# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web application that converts FBX animation files to VRMA (VRM Animation) format. The application consists of a Node.js Express backend and a vanilla JavaScript frontend using Three.js and the VRM library.

## Development Commands

- `npm start` - Start the production server on port 3000
- `npm run build` - Install dependencies and set up FBX2glTF binary
- `npm install` - Install dependencies (postinstall script downloads FBX2glTF binary)

No test framework is configured in this project.

## Architecture

### Backend (server.js)
- **Express server** with file upload handling via Multer
- **Two-stage conversion pipeline**:
  1. FBX → GLTF using platform-specific FBX2glTF binary (darwin/linux/windows)
  2. GLTF → VRMA by adding VRM Animation extension to GLTF structure
- **File management**: uploads/ for temporary FBX files, output/ for converted files
- **GLB binary format parsing** for processing GLTF data and binary chunks
- **Mixamo bone mapping** system that maps standard/mixamorig: prefixed bones to VRM humanoid specification

### Frontend (public/index.html)
- **Three.js-based 3D preview** with VRM model loading
- **Custom VRMAnimation library** (public/lib/VRMAnimation/) for VRMA playback
- **Drag & drop interface** for both FBX upload and direct VRMA playback
- **ES6 modules** using importmap for Three.js dependencies

### Key Components

#### Conversion Logic
- `convertFBXtoGLTF()` - Executes platform-specific FBX2glTF binary
- `convertGLTFtoVRMA()` - Adds VRMC_vrm_animation extension to GLTF
- `createHumanoidMapping()` - Maps Mixamo bones to VRM humanoid bones
- `parseGLB()` / `createGLBWithBinary()` - GLB format handling

#### VRM Animation System
- Custom VRMAnimation classes in public/lib/VRMAnimation/
- Supports both Mixamo and standard bone naming conventions
- Preserves original GLTF animation data structure

## File Structure

- `server.js` - Main Express server and conversion logic
- `public/index.html` - Single-page application frontend
- `public/lib/VRMAnimation/` - Custom VRM animation loading library
- `public/nikechan_v2.vrm` - Default VRM model for preview
- `uploads/` - Temporary storage for uploaded FBX files
- `output/` - Generated VRMA files served directly
- Platform-specific FBX2glTF binaries in root directory

## Important Notes

- FBX2glTF binary is downloaded automatically via postinstall script
- Platform detection logic handles darwin/linux/windows variants
- VRMA files are GLB format with VRMC_vrm_animation extension
- Files in output/ are auto-cleaned after download/timeout
- The application expects Mixamo-style bone hierarchies but supports standard naming