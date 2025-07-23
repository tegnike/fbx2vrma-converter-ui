#!/bin/bash

echo "Setting up FBX2VRMA Converter..."

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Download FBX2glTF binary
echo "Downloading FBX2glTF binary..."
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -L -o FBX2glTF-linux-x64 https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-linux-x64
    chmod +x FBX2glTF-linux-x64
    echo "Downloaded Linux binary: FBX2glTF-linux-x64"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    curl -L -o FBX2glTF-darwin-x64 https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-darwin-x64
    chmod +x FBX2glTF-darwin-x64
    echo "Downloaded macOS binary: FBX2glTF-darwin-x64"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    curl -L -o FBX2glTF-windows-x64.exe https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-windows-x64.exe
    echo "Downloaded Windows binary: FBX2glTF-windows-x64.exe"
else
    echo "Unknown OS type: $OSTYPE"
    echo "Please manually download the appropriate FBX2glTF binary from:"
    echo "https://github.com/facebookincubator/FBX2glTF/releases/tag/v0.9.7"
fi

# Create necessary directories
mkdir -p uploads output public

echo "Setup complete!"
echo "Run 'npm start' to start the server"