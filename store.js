// ============================================================================
// HOLO//ARCADE — Landing Page
// 3D holographic background + UI wiring (auth lives in auth.js)
// ============================================================================

import * as THREE from 'three';
import { initAuth, openAuthModal, isConfigured, getUser } from './auth.js';

// ============================================================================
// §1  3D BACKGROUND
// ============================================================================

const canvas = document.getElementById('bg-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060c, 0.026);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 2.4, 9);

// — Holographic grid floor —
const gridMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vWorldPos;
    void main() {
      vWorldPos = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vWorldPos;

    void main() {
      vec2 gp = vWorldPos;
      vec2 grid = abs(fract(gp * 0.4) - 0.5);
      float line = max(
        smoothstep(0.035, 0.0, grid.x),
        smoothstep(0.035, 0.0, grid.y)
      );

      float dist = length(gp);
      float fade = 1.0 - smoothstep(8.0, 65.0, dist);
      float pulse = 0.8 + 0.2 * sin(uTime * 1.5 - dist * 0.15);

      vec3 nearCol = vec3(0.0, 1.0, 0.95);
      vec3 farCol = vec3(0.1, 0.3, 0.8);
      vec3 col = mix(farCol, nearCol, fade) * line * fade * pulse * 0.7;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const grid = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), gridMaterial);
grid.rotation.x = -Math.PI / 2;
scene.add(grid);

// — Floating wireframe shapes —
function makeShape(geo, color, pos, rotSpeed) {
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.32,
    })
  );
  mesh.position.set(...pos);
  mesh.userData = {
    rotSpeed,
    baseY: pos[1],
    bobPhase: Math.random() * Math.PI * 2,
  };
  scene.add(mesh);
  return mesh;
}

const shapes = [
  makeShape(new THREE.IcosahedronGeometry(1.7, 0), 0x00ffff, [-5.5, 3.4, -5], 0.22),
  makeShape(new THREE.TorusGeometry(1.5, 0.4, 8, 26), 0xff00ff, [5.8, 4.2, -8], 0.16),
  makeShape(new THREE.OctahedronGeometry(1.3, 0), 0x4488ff, [1.5, 5.4, -13], 0.3),
];

// — Floating holographic dust —
const PARTICLE_COUNT = 380;
const pGeo = new THREE.BufferGeometry();
const pPositions = new Float32Array(PARTICLE_COUNT * 3);
const pColors = new Float32Array(PARTICLE_COUNT * 3);
const pSpeeds = new Float32Array(PARTICLE_COUNT);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  pPositions[i * 3] = (Math.random() - 0.5) * 60;
  pPositions[i * 3 + 1] = Math.random() * 14;
  pPositions[i * 3 + 2] = -38 + Math.random() * 44;
  const isCyan = Math.random() > 0.45;
  pColors[i * 3] = isCyan ? 0 : 1;
  pColors[i * 3 + 1] = isCyan ? 1 : 0;
  pColors[i * 3 + 2] = 1;
  pSpeeds[i] = 0.15 + Math.random() * 0.35;
}

pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));

const particles = new THREE.Points(
  pGeo,
  new THREE.PointsMaterial({
    size: 0.07,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
);
scene.add(particles);

// — Mouse parallax —
let mouseX = 0;
let mouseY = 0;
window.addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
  mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
});

// — Animation loop —
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  gridMaterial.uniforms.uTime.value = time;

  for (const s of shapes) {
    s.rotation.x += s.userData.rotSpeed * dt * 0.6;
    s.rotation.y += s.userData.rotSpeed * dt;
    s.position.y =
      s.userData.baseY + Math.sin(time * 0.6 + s.userData.bobPhase) * 0.4;
  }

  const pos = particles.geometry.attributes.position;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    let y = pos.getY(i) + pSpeeds[i] * dt;
    if (y > 14) y = 0;
    pos.setY(i, y);
  }
  pos.needsUpdate = true;

  camera.position.x += (mouseX * 1.4 - camera.position.x) * 0.03;
  camera.position.y += (2.4 - mouseY * 0.7 - camera.position.y) * 0.03;
  camera.lookAt(0, 2.2, -8);

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();

// ============================================================================
// §2  UI WIRING
// ============================================================================

// Nav background on scroll
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

// Scroll-reveal sections
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.12 }
);
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));

// Any "sign in" / "get access" button opens the auth terminal
document.querySelectorAll('[data-auth-trigger]').forEach((btn) => {
  btn.addEventListener('click', () => openAuthModal());
});

// Gate game launches behind sign-in (only once Firebase is configured,
// so the vault stays explorable during local development)
document.querySelectorAll('[data-play]').forEach((link) => {
  link.addEventListener('click', (e) => {
    if (isConfigured() && !getUser()) {
      e.preventDefault();
      openAuthModal('⌁ AUTHENTICATE TO ENTER THE GRID');
    }
  });
});

initAuth();
