#!/bin/bash

# FBX2glTF binaries setup script for different platforms
echo "Setting up FBX2glTF binaries..."

# Create binaries directory
mkdir -p binaries

# Download binaries for different platforms
echo "Downloading FBX2glTF binaries..."

# Linux x64
curl -L -o binaries/FBX2glTF-linux-x64 \
  https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-linux-x64

# macOS x64  
curl -L -o binaries/FBX2glTF-darwin-x64 \
  https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-darwin-x64

# Windows x64
curl -L -o binaries/FBX2glTF-windows-x64.exe \
  https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-windows-x64.exe

# Make binaries executable
chmod +x binaries/FBX2glTF-linux-x64
chmod +x binaries/FBX2glTF-darwin-x64
chmod +x binaries/FBX2glTF-windows-x64.exe

echo "Setup completed!"
echo "FBX2glTF binaries are now available in the binaries/ directory"