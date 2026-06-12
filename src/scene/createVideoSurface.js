import * as THREE from 'three';

// Paints a warm dusk gradient so the windows read as a lit exterior even
// before any footage exists.
function makeFallbackTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#2b3a5c');
  sky.addColorStop(0.55, '#7a4a3a');
  sky.addColorStop(0.75, '#d98a4a');
  sky.addColorStop(1, '#3a2a22');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Manages the meshes reserved for animated content. All panes share one
// material so a single video drives every window. Swap footage at any time
// with setSource(url); on autoplay failure the gradient fallback stays up
// and the rest of the room is unaffected.
export function createVideoSurface(meshes) {
  const fallback = new THREE.MeshBasicMaterial({ map: makeFallbackTexture() });
  meshes.forEach((mesh) => {
    mesh.material = fallback;
  });

  let video = null;

  async function setSource(url) {
    if (video) {
      video.pause();
      video.remove();
      video = null;
    }
    if (!url) return false;

    video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    // Only needed for cross-origin footage; harmless for same-origin files.
    video.crossOrigin = 'anonymous';

    try {
      await video.play();
    } catch (err) {
      console.warn('Video autoplay blocked, keeping fallback surface:', err);
      video = null;
      return false;
    }

    const texture = new THREE.VideoTexture(video);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    meshes.forEach((mesh) => {
      mesh.material = material;
    });
    return true;
  }

  return { setSource };
}
