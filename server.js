const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec, spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'output');
const publicDir = path.join(__dirname, 'public');

[uploadsDir, outputDir, publicDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueId = uuidv4();
        cb(null, `${uniqueId}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.fbx') {
            cb(null, true);
        } else {
            cb(new Error('Only FBX files are allowed'), false);
        }
    },
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    }
});

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/debug', (req, res) => {
    // Determine correct binary for platform
    let binaryName;
    if (process.platform === 'darwin') {
        binaryName = 'FBX2glTF-darwin-x64';
    } else if (process.platform === 'linux') {
        binaryName = 'FBX2glTF-linux-x64';
    } else if (process.platform === 'win32') {
        binaryName = 'FBX2glTF-windows-x64.exe';
    } else {
        binaryName = 'unknown';
    }
    
    const fbx2gltfPath = path.join(__dirname, binaryName);
    const binaryExists = fs.existsSync(fbx2gltfPath);
    
    res.json({
        status: 'ok',
        binaryExists,
        binaryName,
        binaryPath: fbx2gltfPath,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        workingDir: __dirname,
        env: {
            PORT: process.env.PORT,
            NODE_ENV: process.env.NODE_ENV
        }
    });
});

// Convert FBX to GLTF using FBX2glTF
function convertFBXtoGLTF(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        // Determine correct binary for platform
        let binaryName;
        if (process.platform === 'darwin') {
            binaryName = 'FBX2glTF-darwin-x64';
        } else if (process.platform === 'linux') {
            binaryName = 'FBX2glTF-linux-x64';
        } else if (process.platform === 'win32') {
            binaryName = 'FBX2glTF-windows-x64.exe';
        } else {
            return reject(new Error(`Unsupported platform: ${process.platform}`));
        }
        
        const fbx2gltfPath = path.join(__dirname, binaryName);
        
        if (!fs.existsSync(fbx2gltfPath)) {
            return reject(new Error('FBX2glTF binary not found. Please run npm install to download it.'));
        }

        // Test binary execution
        exec(`"${fbx2gltfPath}" --help`, (error, stdout, stderr) => {
            if (error) {
                console.error('Binary test failed:', error);
                return reject(new Error(`FBX2glTF binary test failed: ${error.message}`));
            }

            // Run actual conversion
            const inputFileName = path.basename(inputPath, '.fbx');
            const workingDir = path.dirname(outputPath);
            const args = [
                `"${inputPath}"`,
                '--binary',
                '--output', `"${outputPath}"`
            ];

            const command = `"${fbx2gltfPath}" ${args.join(' ')}`;
            console.log('Executing:', command);

            exec(command, { cwd: workingDir }, (error, stdout, stderr) => {
                if (error) {
                    console.error('Conversion error:', error);
                    console.error('stderr:', stderr);
                    return reject(new Error(`FBX2glTF conversion failed: ${error.message}`));
                }

                console.log('FBX2glTF stdout:', stdout);
                if (stderr) console.warn('FBX2glTF stderr:', stderr);

                // Check if output file was created
                if (fs.existsSync(outputPath)) {
                    resolve(outputPath);
                } else {
                    // Try to find the output file
                    const possibleOutputs = [
                        outputPath,
                        path.join(workingDir, `${inputFileName}.glb`),
                        path.join(workingDir, `${inputFileName}.gltf`)
                    ];

                    const foundOutput = possibleOutputs.find(p => fs.existsSync(p));
                    if (foundOutput) {
                        resolve(foundOutput);
                    } else {
                        console.error('Output file not found. Directory contents:');
                        try {
                            const files = fs.readdirSync(workingDir);
                            console.log(files);
                        } catch (e) {
                            console.error('Could not read directory:', e);
                        }
                        reject(new Error('Output GLB file not found after conversion'));
                    }
                }
            });
        });
    });
}

// Convert GLTF to VRMA
function convertGLTFtoVRMA(gltfPath, vrmaPath, framerate = 30) {
    return new Promise((resolve, reject) => {
        try {
            console.log('Reading GLB file:', gltfPath);
            const gltfBuffer = fs.readFileSync(gltfPath);
            
            // Parse GLB binary format
            const parsedGLB = parseGLB(gltfBuffer);
            const gltfData = parsedGLB.json;
            const binaryData = parsedGLB.binary;
            
            console.log('Parsed GLTF data:', {
                hasAnimations: gltfData.animations && gltfData.animations.length > 0,
                animationCount: gltfData.animations ? gltfData.animations.length : 0,
                hasNodes: gltfData.nodes && gltfData.nodes.length > 0,
                nodeCount: gltfData.nodes ? gltfData.nodes.length : 0,
                hasBinaryData: !!binaryData,
                binarySize: binaryData ? binaryData.length : 0
            });
            
            if (!gltfData.animations || gltfData.animations.length === 0) {
                throw new Error('No animations found in GLB file');
            }

            // Create humanoid mapping first
            const humanoidMapping = createHumanoidMapping(gltfData);
            
            // Check if we have any valid bone mappings
            if (Object.keys(humanoidMapping.humanBones).length === 0) {
                throw new Error('No valid humanoid bones found. This may not be a Mixamo animation or the bone names are different.');
            }
            
            // Preserve the original GLTF structure and only add VRMA extension
            const vrmaData = {
                ...gltfData, // Keep all original GLTF data
                "asset": {
                    ...gltfData.asset,
                    "generator": "FBX2VRMA-Converter-UI"
                },
                "extensionsUsed": ["VRMC_vrm_animation"],
                "extensions": {
                    "VRMC_vrm_animation": {
                        "specVersion": "1.0",
                        "humanoid": humanoidMapping
                    }
                }
            };
            
            console.log('Final VRMA extensions:', JSON.stringify(vrmaData.extensions, null, 2));

            // Write as GLB format to maintain compatibility
            const vrmaBuffer = createGLBWithBinary(vrmaData, binaryData);
            fs.writeFileSync(vrmaPath, vrmaBuffer);
            
            console.log('VRMA file created successfully:', vrmaPath);
            resolve(vrmaPath);
        } catch (error) {
            console.error('VRMA conversion error:', error);
            reject(error);
        }
    });
}

// Parse GLB binary format
function parseGLB(buffer) {
    const header = new DataView(buffer.buffer, buffer.byteOffset, 12);
    const magic = header.getUint32(0, true);
    
    if (magic !== 0x46546C67) { // 'glTF'
        throw new Error('Invalid GLB file format');
    }
    
    const version = header.getUint32(4, true);
    const length = header.getUint32(8, true);
    
    let offset = 12;
    let jsonData = null;
    let binaryData = null;
    
    // Read chunks
    while (offset < length) {
        const chunkLength = new DataView(buffer.buffer, buffer.byteOffset + offset, 4).getUint32(0, true);
        const chunkType = new DataView(buffer.buffer, buffer.byteOffset + offset + 4, 4).getUint32(0, true);
        
        offset += 8;
        
        if (chunkType === 0x4E4F534A) { // 'JSON'
            const jsonBuffer = buffer.slice(offset, offset + chunkLength);
            jsonData = JSON.parse(jsonBuffer.toString('utf8'));
        } else if (chunkType === 0x004E4942) { // 'BIN\0'
            binaryData = buffer.slice(offset, offset + chunkLength);
        }
        
        offset += chunkLength;
    }
    
    return { json: jsonData, binary: binaryData };
}

// Create humanoid bone mapping for Mixamo animations
function createHumanoidMapping(gltfData) {
    const humanBones = {};
    
    // Mixamo to VRM bone mapping (with and without mixamorig: prefix)
    const mixamoToVRM = {
        'Hips': 'hips',
        'mixamorig:Hips': 'hips',
        'Spine': 'spine',
        'mixamorig:Spine': 'spine',
        'Spine1': 'chest', 
        'mixamorig:Spine1': 'chest',
        'Spine2': 'upperChest',
        'mixamorig:Spine2': 'upperChest',
        'Neck': 'neck',
        'mixamorig:Neck': 'neck',
        'Head': 'head',
        'mixamorig:Head': 'head',
        'LeftShoulder': 'leftShoulder',
        'mixamorig:LeftShoulder': 'leftShoulder',
        'LeftArm': 'leftUpperArm',
        'mixamorig:LeftArm': 'leftUpperArm',
        'LeftForeArm': 'leftLowerArm',
        'mixamorig:LeftForeArm': 'leftLowerArm',
        'LeftHand': 'leftHand',
        'mixamorig:LeftHand': 'leftHand',
        'RightShoulder': 'rightShoulder',
        'mixamorig:RightShoulder': 'rightShoulder',
        'RightArm': 'rightUpperArm',
        'mixamorig:RightArm': 'rightUpperArm',
        'RightForeArm': 'rightLowerArm',
        'mixamorig:RightForeArm': 'rightLowerArm',
        'RightHand': 'rightHand',
        'mixamorig:RightHand': 'rightHand',
        'LeftUpLeg': 'leftUpperLeg',
        'mixamorig:LeftUpLeg': 'leftUpperLeg',
        'LeftLeg': 'leftLowerLeg',
        'mixamorig:LeftLeg': 'leftLowerLeg',
        'LeftFoot': 'leftFoot',
        'mixamorig:LeftFoot': 'leftFoot',
        'LeftToeBase': 'leftToes',
        'mixamorig:LeftToeBase': 'leftToes',
        'RightUpLeg': 'rightUpperLeg',
        'mixamorig:RightUpLeg': 'rightUpperLeg',
        'RightLeg': 'rightLowerLeg',
        'mixamorig:RightLeg': 'rightLowerLeg',
        'RightFoot': 'rightFoot',
        'mixamorig:RightFoot': 'rightFoot',
        'RightToeBase': 'rightToes',
        'mixamorig:RightToeBase': 'rightToes'
    };
    
    // Map Mixamo bones to VRM humanoid bones
    if (gltfData.nodes) {
        console.log('Available node names:', gltfData.nodes.map(node => node.name).filter(name => name));
        
        gltfData.nodes.forEach((node, index) => {
            if (node.name && mixamoToVRM[node.name]) {
                humanBones[mixamoToVRM[node.name]] = { node: index };
                console.log(`Mapped ${node.name} (index ${index}) -> ${mixamoToVRM[node.name]}`);
            }
        });
    }
    
    console.log('Created humanoid mapping:', Object.keys(humanBones));
    console.log('Full humanoid mapping object:', JSON.stringify(humanBones, null, 2));
    
    return { humanBones };
}

// Process animations to ensure proper VRMA format (no longer needed - preserve original)
function processAnimations(animations, framerate) {
    // Simply return the original animations without modification
    // to preserve the exact GLTF animation structure
    return animations;
}

// Create GLB binary format with binary data
function createGLBWithBinary(gltfData, binaryData) {
    const jsonString = JSON.stringify(gltfData);
    const jsonBuffer = Buffer.from(jsonString, 'utf8');
    
    // Pad JSON to 4-byte boundary
    const jsonPadding = (4 - (jsonBuffer.length % 4)) % 4;
    const paddedJsonBuffer = Buffer.concat([jsonBuffer, Buffer.alloc(jsonPadding, 0x20)]);
    
    let totalLength = 12 + 8 + paddedJsonBuffer.length; // header + JSON chunk header + JSON
    let buffers = [Buffer.alloc(12), Buffer.alloc(8), paddedJsonBuffer]; // GLB header, JSON chunk header, JSON data
    
    // Add binary chunk if binary data exists
    if (binaryData && binaryData.length > 0) {
        // Pad binary data to 4-byte boundary
        const binaryPadding = (4 - (binaryData.length % 4)) % 4;
        const paddedBinaryData = Buffer.concat([binaryData, Buffer.alloc(binaryPadding, 0)]);
        
        // Binary chunk header
        const binaryChunkHeader = Buffer.alloc(8);
        binaryChunkHeader.writeUInt32LE(paddedBinaryData.length, 0); // chunk length
        binaryChunkHeader.writeUInt32LE(0x004E4942, 4); // 'BIN\0' type
        
        totalLength += 8 + paddedBinaryData.length; // binary chunk header + binary data
        buffers.push(binaryChunkHeader, paddedBinaryData);
    }
    
    // Create GLB header
    const header = buffers[0];
    header.writeUInt32LE(0x46546C67, 0); // 'glTF' magic
    header.writeUInt32LE(2, 4); // version
    header.writeUInt32LE(totalLength, 8); // total length
    
    // Create JSON chunk header
    const jsonChunkHeader = buffers[1];
    jsonChunkHeader.writeUInt32LE(paddedJsonBuffer.length, 0); // chunk length
    jsonChunkHeader.writeUInt32LE(0x4E4F534A, 4); // 'JSON' type
    
    return Buffer.concat(buffers);
}

// Create GLB binary format (legacy function for compatibility)
function createGLB(gltfData) {
    return createGLBWithBinary(gltfData, null);
}

// Main conversion endpoint
app.post('/convert', upload.single('fbxFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No FBX file uploaded' });
        }

        const framerate = parseInt(req.body.framerate) || 30;
        const inputPath = req.file.path;
        const fileName = path.basename(req.file.originalname, '.fbx');
        const uniqueId = uuidv4();
        
        const gltfPath = path.join(outputDir, `${uniqueId}-${fileName}.glb`);
        const vrmaPath = path.join(outputDir, `${uniqueId}-${fileName}.vrma`);

        console.log(`Converting ${req.file.originalname} with framerate ${framerate}`);

        // Step 1: Convert FBX to GLTF
        console.log('Step 1: Converting FBX to GLTF...');
        await convertFBXtoGLTF(inputPath, gltfPath);
        console.log('FBX to GLTF conversion completed');

        // Step 2: Convert GLTF to VRMA
        console.log('Step 2: Converting GLTF to VRMA...');
        await convertGLTFtoVRMA(gltfPath, vrmaPath, framerate);
        console.log('GLTF to VRMA conversion completed');

        // Clean up input file
        fs.unlinkSync(inputPath);

        // Return download link
        res.json({
            success: true,
            downloadUrl: `/download/${path.basename(vrmaPath)}`,
            filename: `${fileName}.vrma`
        });

    } catch (error) {
        console.error('Conversion error:', error);
        
        // Clean up files on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        res.status(500).json({
            error: 'Conversion failed',
            details: error.message
        });
    }
});

// Download endpoint
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(outputDir, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('Download error:', err);
            res.status(500).json({ error: 'Download failed' });
        } else {
            // Clean up file after download
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }, 60000); // Delete after 1 minute
        }
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} to use the converter`);
});

module.exports = app;