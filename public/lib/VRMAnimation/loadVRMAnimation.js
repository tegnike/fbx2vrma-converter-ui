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
    
    // Show user-friendly error message
    const errorMessage = getErrorMessage(error);
    showVRMAError(errorMessage, error);
    
    return null;
  }
}

function getErrorMessage(error) {
  const errorStr = error.toString();
  
  if (errorStr.includes('Invalid path "scale"')) {
    return 'このVRMAファイルには無効なスケール情報が含まれています。Mixamoアニメーションの変換時にスケール情報が含まれた可能性があります。';
  } else if (errorStr.includes('Invalid path')) {
    return 'VRMAファイルに無効なアニメーションパスが含まれています。VRM対応のボーン構造でない可能性があります。';
  } else if (errorStr.includes('Failed to fetch') || errorStr.includes('NetworkError')) {
    return 'VRMAファイルの読み込みに失敗しました。ファイルが存在しないか、ネットワークエラーが発生しています。';
  } else if (errorStr.includes('Invalid GLB') || errorStr.includes('GLB')) {
    return 'VRMAファイルの形式が正しくありません。ファイルが破損している可能性があります。';
  } else {
    return `VRMAファイルの読み込み中にエラーが発生しました: ${error.message || errorStr}`;
  }
}

function showVRMAError(message, originalError) {
  // Create error alert
  alert(`❌ VRMAアニメーション読み込みエラー\n\n${message}\n\n詳細な情報はブラウザのコンソールをご確認ください。`);
  
  // Also show in result area if available
  const resultDiv = document.getElementById('result');
  if (resultDiv) {
    const resultMessage = document.getElementById('resultMessage');
    if (resultMessage) {
      resultDiv.className = 'result error';
      resultDiv.style.display = 'block';
      resultMessage.textContent = `❌ ${message}`;
      
      // Hide download button
      const downloadBtn = document.getElementById('downloadBtn');
      if (downloadBtn) {
        downloadBtn.style.display = 'none';
      }
    }
  }
}