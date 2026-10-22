'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box3,
  Color,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

type Status = 'loading' | 'ready' | 'error';

// Orbit viewer for one GLB, drawn on a transparent canvas so the grey plate shows through.
// The model spec (metres, Y up, origin at the base centre, front toward +Z) lets every object share one camera.
// It renders only when something moves: a still scene costs nothing.
export default function ModelViewer({ src, label }: { src: string; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const el = host.current;
    if (!el) return;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(new Color(0xffffff), 0);
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${label}, 3D model. Drag to turn, scroll to zoom, arrow keys to turn.`);
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    el.appendChild(canvas);

    const scene = new Scene();
    const pmrem = new PMREMGenerator(renderer);
    const envMap: Texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envMap;

    const camera = new PerspectiveCamera(35, 1, 0.01, 100);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.listenToKeyEvents(canvas);

    let dirty = true;
    let raf = 0;
    let disposed = false;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (controls.update() || dirty) {
        renderer.render(scene, camera);
        dirty = false;
      }
    };

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    const draco = new DRACOLoader().setDecoderPath('/draco/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    let root: Object3D | null = null;
    loader.load(
      src,
      (gltf) => {
        if (disposed) return;
        root = gltf.scene;
        // Fit the longest side of the bounding box to a unit, and look from the front, slightly above.
        const box = new Box3().setFromObject(root);
        const size = box.getSize(new Vector3());
        const centre = box.getCenter(new Vector3());
        const fit = 1 / Math.max(size.x, size.y, size.z, 1e-6);
        root.scale.setScalar(fit);
        root.position.copy(centre).multiplyScalar(-fit);
        scene.add(root);
        const d = 2.1;
        camera.position.set(0, d * 0.35, d);
        controls.minDistance = d * 0.5;
        controls.maxDistance = d * 2;
        controls.target.set(0, 0, 0);
        controls.update();
        dirty = true;
        setStatus('ready');
      },
      undefined,
      () => {
        if (!disposed) setStatus('error');
      },
    );

    raf = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      root?.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        o.geometry.dispose();
        const mats: Material[] = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          for (const v of Object.values(m)) if (v && (v as Texture).isTexture) (v as Texture).dispose();
          m.dispose();
        }
      });
      envMap.dispose();
      pmrem.dispose();
      draco.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [src, label]);

  return (
    <div ref={host} className="absolute inset-0">
      {status !== 'ready' && (
        <span role="status" className="absolute inset-0 grid place-items-center opacity-60">
          {status === 'loading' ? 'Loading model' : 'Model failed to load'}
        </span>
      )}
    </div>
  );
}
