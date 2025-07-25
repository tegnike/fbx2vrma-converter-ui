import * as THREE from 'three';

export class VRMAnimation {
  constructor() {
    this.duration = 0.0;
    this.restHipsPosition = new THREE.Vector3();
    
    this.humanoidTracks = {
      translation: new Map(),
      rotation: new Map(),
    };
    
    this.expressionTracks = new Map();
    this.lookAtTrack = null;
  }
  
  createAnimationClip(vrm) {
    const tracks = [];
    
    tracks.push(...this.createHumanoidTracks(vrm));
    
    if (vrm.expressionManager != null) {
      tracks.push(...this.createExpressionTracks(vrm.expressionManager));
    }
    
    if (vrm.lookAt != null) {
      const track = this.createLookAtTrack('lookAtTargetParent.quaternion');
      
      if (track != null) {
        tracks.push(track);
      }
    }
    
    return new THREE.AnimationClip('Clip', this.duration, tracks);
  }
  
  createHumanoidTracks(vrm) {
    const humanoid = vrm.humanoid;
    const metaVersion = vrm.meta.metaVersion;
    const tracks = [];
    
    for (const [name, origTrack] of this.humanoidTracks.rotation.entries()) {
      const nodeName = humanoid.getNormalizedBoneNode(name)?.name;
      
      if (nodeName != null) {
        const track = new THREE.VectorKeyframeTrack(
          `${nodeName}.quaternion`,
          origTrack.times,
          origTrack.values.map((v, i) =>
            metaVersion === '0' && i % 2 === 0 ? -v : v
          )
        );
        tracks.push(track);
      }
    }
    
    for (const [name, origTrack] of this.humanoidTracks.translation.entries()) {
      const nodeName = humanoid.getNormalizedBoneNode(name)?.name;
      
      if (nodeName != null) {
        const animationY = this.restHipsPosition.y;
        const humanoidY = humanoid.getNormalizedAbsolutePose().hips.position[1];
        const scale = humanoidY / animationY;
        
        const track = origTrack.clone();
        track.values = track.values.map(
          (v, i) => (metaVersion === '0' && i % 3 !== 1 ? -v : v) * scale
        );
        track.name = `${nodeName}.position`;
        tracks.push(track);
      }
    }
    
    return tracks;
  }
  
  createExpressionTracks(expressionManager) {
    const tracks = [];
    
    for (const [name, origTrack] of this.expressionTracks.entries()) {
      const trackName = expressionManager.getExpressionTrackName(name);
      
      if (trackName != null) {
        const track = origTrack.clone();
        track.name = trackName;
        tracks.push(track);
      }
    }
    
    return tracks;
  }
  
  createLookAtTrack(trackName) {
    if (this.lookAtTrack == null) {
      return null;
    }
    
    const track = this.lookAtTrack.clone();
    track.name = trackName;
    return track;
  }
}