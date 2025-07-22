const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const { spawn } = require('child_process');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

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
  switch (platform) {
    case 'darwin':
      return './binaries/FBX2glTF-darwin-x64';
    case 'linux':
      return './binaries/FBX2glTF-linux-x64';
    case 'win32':
      return './binaries/FBX2glTF-windows-x64.exe';
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

function convertFBXtoGLTF(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const fbx2gltf = getFBX2glTFBinary();
    
    if (!fs.existsSync(fbx2gltf)) {
      return reject(new Error(`FBX2glTF binary not found: ${fbx2gltf}`));
    }

    const process = spawn(fbx2gltf, [
      '--input', inputPath,
      '--output', outputPath,
      '--binary'
    ]);

    let stderr = '';
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`FBX2glTF failed with code ${code}: ${stderr}`));
      }
    });

    process.on('error', (error) => {
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
    await convertFBXtoGLTF(fbxPath, tempGltfPath);

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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`FBX2VRMA Converter UI running on port ${port}`);
});