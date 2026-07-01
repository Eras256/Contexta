"use client";

import { useEffect, useRef } from "react";
import type { Material, Mesh } from "three";

/**
 * Lightweight, project-themed 3D hero. A glowing "treasury core" with tokens
 * (USDC · XLM) orbiting over a Stellar starfield. Built on vanilla three.js,
 * imported dynamically so it never blocks first paint and ships as its own
 * chunk. Tuned for mobile: capped DPR, fewer stars, pauses when off-screen or
 * the tab is hidden, and respects prefers-reduced-motion.
 */
export function Hero3D({ className = "" }: { className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;
    let cleanup = () => {};

    void (async () => {
      const THREE = await import("three");
      if (disposed || !mountRef.current) return;

      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const reduced = !isMobile && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const width = () => mount.clientWidth || 1;
      const height = () => mount.clientHeight || 1;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width() / height(), 0.1, 100);
      camera.position.set(0, 0, 6.2);

      const renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.2 : 2));
      renderer.setSize(width(), height(), false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      mount.appendChild(renderer.domElement);

      const TEAL = 0x2dd4bf;
      const VIOLET = 0xa78bfa;
      const SKY = 0x38bdf8;
      const GREEN = 0x34d399;

      const root = new THREE.Group();
      scene.add(root);

      // ── Starfield (Stellar) ────────────────────────────────────────────────
      const starCount = isMobile ? 280 : 650;
      const starPos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const r = 7 + Math.random() * 12;
        const t = Math.random() * Math.PI * 2;
        const p = Math.acos(2 * Math.random() - 1);
        starPos[i * 3] = r * Math.sin(p) * Math.cos(t);
        starPos[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
        starPos[i * 3 + 2] = r * Math.cos(p);
      }
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      const starMat = new THREE.PointsMaterial({
        color: 0xbfeaff,
        size: 0.05,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const stars = new THREE.Points(starGeo, starMat);
      scene.add(stars);

      // ── Treasury core ──────────────────────────────────────────────────────
      const coreGeo = new THREE.IcosahedronGeometry(1.5, 1);
      const core = new THREE.Mesh(
        coreGeo,
        new THREE.MeshBasicMaterial({ color: TEAL, wireframe: true, transparent: true, opacity: 0.55 }),
      );
      root.add(core);

      const glow = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.05, 2),
        new THREE.MeshBasicMaterial({
          color: TEAL,
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
        }),
      );
      root.add(glow);

      // ── Orbit rings + tokens ───────────────────────────────────────────────
      type Orbit = { radius: number; speed: number; phase: number; tilt: number; color: number; mesh: Mesh };
      const orbits: Orbit[] = [];
      const specs = [
        { radius: 2.4, speed: 0.5, tilt: 0.5, color: SKY },
        { radius: 3.0, speed: -0.36, tilt: -0.7, color: VIOLET },
        { radius: 3.5, speed: 0.28, tilt: 0.25, color: GREEN },
      ];
      const tokenGeo = new THREE.SphereGeometry(0.11, 16, 16);
      for (const s of specs) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(s.radius, 0.006, 8, 120),
          new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.22 }),
        );
        ring.rotation.x = Math.PI / 2 + s.tilt;
        root.add(ring);

        const token = new THREE.Mesh(
          tokenGeo,
          new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }),
        );
        root.add(token);
        orbits.push({ radius: s.radius, speed: s.speed, phase: Math.random() * Math.PI * 2, tilt: s.tilt, color: s.color, mesh: token });
      }

      root.rotation.x = 0.5;

      // ── Pointer parallax (desktop) ─────────────────────────────────────────
      const pointer = { x: 0, y: 0 };
      const onPointer = (e: PointerEvent) => {
        const r = mount.getBoundingClientRect();
        pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
        pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      };
      if (!isMobile) window.addEventListener("pointermove", onPointer);

      const setOrbit = (o: Orbit, a: number) => {
        const x = Math.cos(a) * o.radius;
        const z = Math.sin(a) * o.radius;
        const y = Math.sin(a) * Math.sin(o.tilt) * o.radius;
        o.mesh.position.set(x, y, z * Math.cos(o.tilt));
      };

      const clock = new THREE.Clock();
      let raf = 0;
      let running = true;

      const renderFrame = () => {
        const t = clock.getElapsedTime();
        root.rotation.y = t * 0.12;
        glow.scale.setScalar(1 + Math.sin(t * 1.6) * 0.04);
        stars.rotation.y = t * 0.015;
        for (const o of orbits) setOrbit(o, t * o.speed + o.phase);
        if (isMobile) {
          camera.position.x = Math.sin(t * 0.45) * 0.35;
          camera.position.y = Math.cos(t * 0.35) * 0.25;
          camera.lookAt(0, 0, 0);
        } else {
          camera.position.x += (pointer.x * 0.6 - camera.position.x) * 0.05;
          camera.position.y += (-pointer.y * 0.4 - camera.position.y) * 0.05;
          camera.lookAt(0, 0, 0);
        }
        renderer.render(scene, camera);
      };

      const loop = () => {
        if (!running) return;
        renderFrame();
        raf = requestAnimationFrame(loop);
      };

      const start = () => {
        if (running) return;
        running = true;
        loop();
      };
      const stop = () => {
        running = false;
        cancelAnimationFrame(raf);
      };

      if (reduced) {
        // Render a single static frame; no animation loop.
        for (let i = 0; i < orbits.length; i++) setOrbit(orbits[i], i);
        renderer.render(scene, camera);
        running = false;
      } else {
        loop();
      }

      // Pause when off-screen or tab hidden.
      const io = new IntersectionObserver(
        (entries) => {
          const visible = entries[0]?.isIntersecting;
          if (reduced) return;
          if (isMobile) {
            start();
          } else if (visible) {
            start();
          } else {
            stop();
          }
        },
        { threshold: 0.05 },
      );
      io.observe(mount);
      const onVis = () => {
        if (reduced) return;
        if (document.hidden) stop();
        else start();
      };
      document.addEventListener("visibilitychange", onVis);

      const onResize = () => {
        camera.aspect = width() / height();
        camera.updateProjectionMatrix();
        renderer.setSize(width(), height(), false);
        if (!running) renderer.render(scene, camera);
      };
      const ro = new ResizeObserver(onResize);
      ro.observe(mount);

      cleanup = () => {
        stop();
        io.disconnect();
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("pointermove", onPointer);
        renderer.dispose();
        scene.traverse((obj) => {
          const m = obj as Mesh;
          if (m.geometry) m.geometry.dispose();
          const mat = m.material;
          if (Array.isArray(mat)) mat.forEach((x: Material) => x.dispose());
          else if (mat) (mat as Material).dispose();
        });
        starGeo.dispose();
        starMat.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden />;
}
