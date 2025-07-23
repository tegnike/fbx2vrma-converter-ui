import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMAnimationLoaderPlugin } from './VRMAnimationLoaderPlugin.js';

const loader = new GLTFLoader();
loader.register((parser) => new VRMAnimationLoaderPlugin(parser));

export async function loadVRMAnimation(url) {
  try {
    const gltf = await loader.loadAsync(url);
    
    const vrmAnimations = gltf.userData.vrmAnimations;
    const vrmAnimation = vrmAnimations ? vrmAnimations[0] : undefined;
    
    return vrmAnimation || null;
  } catch (error) {
    console.error('Failed to load VRM animation:', error);
    return null;
  }
}