const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const cors = require('cors');
const https = require('https');

const app = express();
const port = process.env.PORT || 3000;

// Download binary on startup if not exists
async function ensureBinaryExists() {
  const binariesDir = path.join(__dirname, 'binaries');
  const binaryPath = getFBX2glTFBinary();
  
  if (fs.existsSync(binaryPath)) {
    console.log('Binary already exists:', binaryPath);
    return;
  }

  console.log('Downloading FBX2glTF binary...');
  await fs.ensureDir(binariesDir);
  
  const url = 'https://github.com/facebookincubator/FBX2glTF/releases/download/v0.9.7/FBX2glTF-linux-x64';
  
  return new Promise((resolve, reject) => {
    let file = null;
    
    const downloadFile = (downloadUrl) => {
      https.get(downloadUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 302 || response.statusCode === 301) {
          console.log('Following redirect to:', response.headers.location);
          return downloadFile(response.headers.location);
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: ${response.statusCode}`));
          return;
        }
        
        // Create file stream only when we have a successful response
        file = fs.createWriteStream(binaryPath);
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          try {
            fs.chmodSync(binaryPath, 0o755); // Make executable
            console.log('Binary downloaded successfully:', binaryPath);
            resolve();
          } catch (error) {
            fs.unlinkSync(binaryPath);
            reject(error);
          }
        });
        
        file.on('error', (error) => {
          if (fs.existsSync(binaryPath)) {
            fs.unlinkSync(binaryPath);
          }
          reject(error);
        });
      }).on('error', (error) => {
        if (file) {
          file.close();
        }
        if (fs.existsSync(binaryPath)) {
          fs.unlinkSync(binaryPath);
        }
        reject(error);
      });
    };
    
    downloadFile(url);
  });
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.fbx') {
      return cb(new Error('Only .fbx files are allowed'));
    }
    cb(null, true);
  }
});

function getFBX2glTFBinary() {
  const platform = process.platform;
  let binaryName;
  
  switch (platform) {
    case 'darwin':
      binaryName = 'FBX2glTF-darwin-x64';
      break;
    case 'linux':
      binaryName = 'FBX2glTF-linux-x64';
      break;
    case 'win32':
      binaryName = 'FBX2glTF-windows-x64.exe';
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
  
  return path.join(__dirname, 'binaries', binaryName);
}

function convertFBXtoGLTF(inputPath, outputDir, outputBaseName) {
  return new Promise((resolve, reject) => {
    const fbx2gltf = getFBX2glTFBinary();
    
    console.log(`Platform: ${process.platform}`);
    console.log(`Looking for binary at: ${fbx2gltf}`);
    console.log(`Binary exists: ${fs.existsSync(fbx2gltf)}`);
    console.log(`Converting: ${inputPath} -> ${outputDir}/${outputBaseName}`);
    
    if (!fs.existsSync(fbx2gltf)) {
      const binariesDir = path.join(__dirname, 'binaries');
      console.log(`Binaries directory exists: ${fs.existsSync(binariesDir)}`);
      if (fs.existsSync(binariesDir)) {
        console.log('Available files in binaries:', fs.readdirSync(binariesDir));
      }
      return reject(new Error(`FBX2glTF binary not found: ${fbx2gltf}. Platform: ${process.platform}`));
    }

    const childProcess = spawn(fbx2gltf, [
      '--input', inputPath,
      '--output', outputDir,
      '--dst-name', outputBaseName
    ]);

    let stderr = '';
    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        const expectedOutput = path.join(outputDir, `${outputBaseName}.gltf`);
        if (fs.existsSync(expectedOutput)) {
          console.log(`FBX2glTF output created: ${expectedOutput}`);
          resolve();
        } else {
          reject(new Error(`FBX2glTF completed but output file not found: ${expectedOutput}`));
        }
      } else {
        reject(new Error(`FBX2glTF failed with code ${code}: ${stderr}`));
      }
    });

    childProcess.on('error', (error) => {
      reject(error);
    });
  });
}

function generateVRMA(gltfPath, vrmaPath, framerate = 30) {
  return new Promise(async (resolve, reject) => {
    try {
      const gltfData = await fs.readJson(gltfPath);
      
      if (!gltfData.animations || gltfData.animations.length === 0) {
        throw new Error('No animations found in GLTF file');
      }

      const animation = gltfData.animations[0];
      const vrmaData = {
        specVersion: "1.0",
        meta: {
          name: path.basename(vrmaPath, '.vrma'),
          version: "1.0.0",
          authors: ["FBX2VRMA Converter"],
          copyrightInformation: "",
          contactInformation: "",
          reference: "",
          allowedUserName: "Everyone",
          violentUssageName: "Disallow",
          sexualUssageName: "Disallow",
          gameUssageName: "Allow",
          commercialUssageName: "Allow",
          politicalOrReligiousUsageName: "Disallow",
          otherPermissionUrl: "",
          otherLicenseUrl: ""
        },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{}],
        animations: [animation],
        accessors: gltfData.accessors || [],
        bufferViews: gltfData.bufferViews || [],
        buffers: gltfData.buffers || [],
        extensions: {},
        extensionsUsed: [],
        extensionsRequired: []
      };

      await fs.writeJson(vrmaPath, vrmaData, { spaces: 2 });
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

app.post('/convert', upload.single('fbxFile'), async (req, res) => {
  let tempGltfPath = null;
  let tempVrmaPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No FBX file uploaded' });
    }

    const framerate = parseInt(req.body.framerate) || 30;
    const fbxPath = req.file.path;
    const baseFilename = path.basename(req.file.originalname, '.fbx');
    
    tempGltfPath = path.join('temp', `${baseFilename}.gltf`);
    tempVrmaPath = path.join('temp', `${baseFilename}.vrma`);

    await fs.ensureDir('temp');

    console.log('Converting FBX to glTF...');
    await convertFBXtoGLTF(fbxPath, 'temp', baseFilename);
    
    // FBX2glTF creates .gltf file, so we need to update the path
    tempGltfPath = path.join('temp', `${baseFilename}.gltf`);

    console.log('Generating VRMA...');
    await generateVRMA(tempGltfPath, tempVrmaPath, framerate);

    console.log('Conversion completed successfully');

    res.download(tempVrmaPath, `${baseFilename}.vrma`, (err) => {
      if (!err) {
        setTimeout(async () => {
          try {
            await fs.remove(fbxPath);
            if (tempGltfPath && await fs.pathExists(tempGltfPath)) {
              await fs.remove(tempGltfPath);
            }
            if (tempVrmaPath && await fs.pathExists(tempVrmaPath)) {
              await fs.remove(tempVrmaPath);
            }
          } catch (cleanupError) {
            console.error('Cleanup error:', cleanupError);
          }
        }, 5000);
      }
    });

  } catch (error) {
    console.error('Conversion error:', error);
    
    try {
      if (req.file && req.file.path) {
        await fs.remove(req.file.path);
      }
      if (tempGltfPath && await fs.pathExists(tempGltfPath)) {
        await fs.remove(tempGltfPath);
      }
      if (tempVrmaPath && await fs.pathExists(tempVrmaPath)) {
        await fs.remove(tempVrmaPath);
      }
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    res.status(500).json({ 
      error: 'Conversion failed', 
      message: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const publicDir = path.join(__dirname, 'public');
  const indexPath = path.join(publicDir, 'index.html');
  const binariesDir = path.join(__dirname, 'binaries');
  
  res.json({
    status: 'ok',
    dirname: __dirname,
    publicDir: publicDir,
    publicExists: fs.existsSync(publicDir),
    indexExists: fs.existsSync(indexPath),
    binariesExists: fs.existsSync(binariesDir),
    publicFiles: fs.existsSync(publicDir) ? fs.readdirSync(publicDir) : [],
    binariesFiles: fs.existsSync(binariesDir) ? fs.readdirSync(binariesDir) : []
  });
});

app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'public', 'index.html');
  console.log(`Serving index.html from: ${indexPath}`);
  console.log(`File exists: ${fs.existsSync(indexPath)}`);
  
  if (!fs.existsSync(indexPath)) {
    return res.status(404).send('index.html not found');
  }
  
  res.sendFile(indexPath);
});

// Fallback for 404 errors
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// Initialize server with binary download
async function startServer() {
  try {
    await ensureBinaryExists();
    app.listen(port, () => {
      console.log(`FBX2VRMA Converter UI running on port ${port}`);
      console.log(`Static files served from: ${path.join(__dirname, 'public')}`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

startServer();