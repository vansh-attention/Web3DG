// ============================================================================
// HOLO//RUNNER — Holographic Cyberpunk 3D Game
// Built with Three.js r164 (ES Module)
// ============================================================================

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// ============================================================================
// §0  CONSTANTS & CONFIGURATION
// ============================================================================

const CFG = {
  world: { size: 500, halfSize: 250 },
  player: {
    height: 1.7,
    speed: 8,
    sprintMultiplier: 1.9,
    acceleration: 18,
    deceleration: 12,
    jumpForce: 7.5,
    gravity: -20,
    mouseSensitivity: 0.002,
    collisionRadius: 0.4,
    maxHealth: 100,
    damageCooldown: 1.2,
    bobSpeed: 10,
    bobAmount: 0.04,
  },
  structures: { count: 80, minDist: 12 },
  fragments: { count: 30, respawnDelay: 5 },
  sentinels: { count: 10 },
  particles: { ambient: 300, burst: 60 },
  bloom: { strength: 1.5, radius: 0.4, threshold: 0.2 },
  colors: {
    cyan: 0x00ffff,
    magenta: 0xff00ff,
    blue: 0x4488ff,
    red: 0xff2244,
    orange: 0xff6622,
    bg: 0x0a0a0f,
  },
};

// ============================================================================
// §1  GLOBAL STATE
// ============================================================================

const state = {
  running: false,
  gameOver: false,
  score: 0,
  health: CFG.player.maxHealth,
  collected: 0,
  time: 0,
  damageCooldownTimer: 0,
  screenShake: 0,
  screenFlash: { r: 0, g: 0, b: 0, a: 0 },
  sprintChromaticAberration: 0,
};

const keys = {};
const velocity = new THREE.Vector3();
const moveDir = new THREE.Vector3();
const playerPos = new THREE.Vector3(0, CFG.player.height, 0);
let isOnGround = true;
let verticalVelocity = 0;
let cameraPitch = 0;
let cameraYaw = 0;
let bobPhase = 0;
let pointerLocked = false;

// ============================================================================
// §2  DOM REFERENCES
// ============================================================================

const dom = {
  loadingScreen: document.getElementById('loading-screen'),
  loadingBar: document.getElementById('loading-bar-fill'),
  startScreen: document.getElementById('start-screen'),
  hud: document.getElementById('hud'),
  gameOverScreen: document.getElementById('game-over-screen'),
  scoreDisplay: document.getElementById('score'),
  healthBar: document.getElementById('health-bar-fill'),
  healthText: document.getElementById('health-text'),
  speedDisplay: document.getElementById('speed-display'),
  compass: document.getElementById('compass'),
  collectionCount: document.getElementById('collection-count'),
  finalScore: document.getElementById('final-score'),
  startBtn: document.getElementById('start-btn'),
  rebootBtn: document.getElementById('reboot-btn'),
  flashOverlay: document.getElementById('flash-overlay'),
  canvas: document.getElementById('game-canvas'),
};

// ============================================================================
// §3  RENDERER, SCENE, CAMERA
// ============================================================================

const renderer = new THREE.WebGLRenderer({
  canvas: dom.canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(CFG.colors.bg);
scene.fog = new THREE.FogExp2(0x001122, 0.012);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.copy(playerPos);

// ============================================================================
// §4  LIGHTS
// ============================================================================

const ambientLight = new THREE.AmbientLight(0x223366, 0.3);
scene.add(ambientLight);

const playerLightCyan = new THREE.PointLight(0x00ffff, 2, 30);
const playerLightMagenta = new THREE.PointLight(0xff00ff, 1.2, 25);
const playerLightBlue = new THREE.PointLight(0x4488ff, 1.5, 28);
scene.add(playerLightCyan, playerLightMagenta, playerLightBlue);

// ============================================================================
// §5  POST-PROCESSING
// ============================================================================

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  CFG.bloom.strength,
  CFG.bloom.radius,
  CFG.bloom.threshold
);
composer.addPass(bloomPass);

// — Vignette + Chromatic Aberration combined shader —
const HoloPostShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignetteStrength: { value: 0.45 },
    uChromaticAberration: { value: 0.002 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignetteStrength;
    uniform float uChromaticAberration;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      float ca = uChromaticAberration;
      vec2 dir = uv - 0.5;
      float dist = length(dir);

      float r = texture2D(tDiffuse, uv + dir * ca).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - dir * ca).b;

      vec3 col = vec3(r, g, b);

      // Scanline hint
      col *= 0.97 + 0.03 * sin(uv.y * 800.0 + uTime * 2.0);

      // Vignette
      float vig = 1.0 - smoothstep(0.4, 1.4, dist * 2.0) * uVignetteStrength;
      col *= vig;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
const holoPass = new ShaderPass(HoloPostShader);
composer.addPass(holoPass);

// ============================================================================
// §6  GROUND / GRID PLANE
// ============================================================================

const gridShaderMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uPlayerPos: { value: new THREE.Vector3() },
  },
  vertexShader: /* glsl */ `
    varying vec2 vWorldPos;
    varying float vElevation;
    uniform float uTime;

    void main() {
      vec3 pos = position;
      // Digital terrain
      float elev = sin(pos.x * 0.05 + uTime * 0.2) * cos(pos.y * 0.07 - uTime * 0.15) * 0.3;
      pos.z += elev;
      vElevation = elev;
      vWorldPos = pos.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uPlayerPos;
    varying vec2 vWorldPos;
    varying float vElevation;

    void main() {
      vec2 gp = vWorldPos;

      // Grid lines
      vec2 grid = abs(fract(gp * 0.5) - 0.5);
      float lineX = smoothstep(0.02, 0.0, grid.x);
      float lineY = smoothstep(0.02, 0.0, grid.y);
      float line = max(lineX, lineY);

      // Finer sub-grid
      vec2 subGrid = abs(fract(gp * 2.0) - 0.5);
      float subLine = max(
        smoothstep(0.03, 0.0, subGrid.x),
        smoothstep(0.03, 0.0, subGrid.y)
      );

      // Player proximity glow
      float playerDist = distance(gp, uPlayerPos.xz);
      float proximity = 1.0 - smoothstep(0.0, 25.0, playerDist);

      // Pulse
      float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + playerDist * 0.3);

      // Holographic shimmer
      float shimmer = 0.9 + 0.1 * sin(gp.x * 10.0 + gp.y * 10.0 + uTime * 5.0);

      // Colors
      vec3 cyanCol = vec3(0.0, 1.0, 1.0);
      vec3 blueCol = vec3(0.2, 0.5, 1.0);
      vec3 gridColor = mix(blueCol, cyanCol, proximity);

      float mainAlpha = line * (0.15 + 0.6 * proximity) * pulse * shimmer;
      float subAlpha = subLine * (0.04 + 0.15 * proximity) * pulse;

      vec3 finalColor = gridColor * (mainAlpha + subAlpha);

      // Ground base
      float baseFog = 0.01 * proximity;
      finalColor += vec3(0.0, 0.15, 0.2) * baseFog;

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
  side: THREE.DoubleSide,
});

const groundGeom = new THREE.PlaneGeometry(
  CFG.world.size,
  CFG.world.size,
  256,
  256
);
const ground = new THREE.Mesh(groundGeom, gridShaderMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// ============================================================================
// §7  SKYBOX / SKY ENVIRONMENT
// ============================================================================

// Inverted sphere sky
const skyGeo = new THREE.SphereGeometry(240, 32, 32);
const skyMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec3 vPos;
    void main() {
      vPos = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec3 vPos;
    void main() {
      float h = (vPos.y + 240.0) / 480.0;
      vec3 bottom = vec3(0.01, 0.01, 0.04);
      vec3 top = vec3(0.02, 0.0, 0.06);
      vec3 col = mix(bottom, top, h);

      // Stars / data flickers
      float flicker = fract(sin(dot(vPos.xz * 0.1, vec2(12.9898, 78.233))) * 43758.5453);
      float starMask = step(0.995, flicker);
      float twinkle = 0.5 + 0.5 * sin(uTime * (3.0 + flicker * 5.0));
      col += vec3(0.3, 0.6, 1.0) * starMask * twinkle * 0.5;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
  side: THREE.BackSide,
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// Holographic sky rings
const skyRings = [];
for (let i = 0; i < 3; i++) {
  const ringGeo = new THREE.TorusGeometry(80 + i * 30, 0.15, 8, 128);
  const ringMat = new THREE.MeshBasicMaterial({
    color: [0x00ffff, 0xff00ff, 0x4488ff][i],
    transparent: true,
    opacity: 0.12 + i * 0.03,
    wireframe: true,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 100 + i * 15;
  ring.rotation.x = Math.PI / 2 + (i - 1) * 0.2;
  scene.add(ring);
  skyRings.push(ring);
}

// Distant data streams (vertical lines of light)
const dataStreamGroup = new THREE.Group();
for (let i = 0; i < 40; i++) {
  const angle = (i / 40) * Math.PI * 2;
  const radius = 150 + Math.random() * 80;
  const height = 20 + Math.random() * 80;
  const streamGeo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    Math.cos(angle) * radius, 5, Math.sin(angle) * radius,
    Math.cos(angle) * radius, 5 + height, Math.sin(angle) * radius,
  ]);
  streamGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  const streamMat = new THREE.LineBasicMaterial({
    color: [0x00ffff, 0xff00ff, 0x4488ff][i % 3],
    transparent: true,
    opacity: 0.15 + Math.random() * 0.15,
  });
  const streamLine = new THREE.Line(streamGeo, streamMat);
  streamLine.userData.baseOpacity = streamMat.opacity;
  streamLine.userData.flickerSpeed = 1 + Math.random() * 3;
  dataStreamGroup.add(streamLine);
}
scene.add(dataStreamGroup);

// ============================================================================
// §8  HOLOGRAPHIC STRUCTURES (Buildings)
// ============================================================================

const structures = [];
const structureBBs = []; // bounding boxes for collision

const holoStructureColors = [0x00ffff, 0xff00ff, 0x4488ff, 0x00ffaa, 0xaa44ff];

function createStructure(x, z) {
  const group = new THREE.Group();
  const isPyramid = Math.random() > 0.6;
  const w = 1.5 + Math.random() * 4;
  const h = 2 + Math.random() * 18;
  const d = 1.5 + Math.random() * 4;
  const color =
    holoStructureColors[
      Math.floor(Math.random() * holoStructureColors.length)
    ];

  let geo;
  if (isPyramid) {
    geo = new THREE.ConeGeometry(w, h, 4);
  } else {
    geo = new THREE.BoxGeometry(w, h, d);
  }

  // Wireframe edges
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
  });
  const lineSegs = new THREE.LineSegments(edges, lineMat);

  // Semi-transparent fill with holographic scanline shader
  const fillMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: { value: 0 },
      uOpacity: { value: 0.06 + Math.random() * 0.06 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vWorldPosition;
      void main() {
        float scanline = 0.8 + 0.2 * sin(vWorldPosition.y * 20.0 + uTime * 3.0);
        float flicker = 0.9 + 0.1 * sin(uTime * 7.0 + vWorldPosition.x * 5.0);
        gl_FragColor = vec4(uColor * scanline * flicker, uOpacity);
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const fillMesh = new THREE.Mesh(geo, fillMat);

  group.add(lineSegs);
  group.add(fillMesh);
  group.position.set(x, h / 2, z);

  // Metadata
  const rotSpeed = Math.random() > 0.7 ? (Math.random() - 0.5) * 0.3 : 0;
  const pulseSpeed = Math.random() > 0.5 ? 1 + Math.random() * 2 : 0;

  group.userData = { rotSpeed, pulseSpeed, lineMat, fillMat, h, w, d, isPyramid };
  scene.add(group);
  structures.push(group);

  // Collision box (axis-aligned, on the XZ plane)
  const halfW = (isPyramid ? w : w / 2) + CFG.player.collisionRadius;
  const halfD = (isPyramid ? w : d / 2) + CFG.player.collisionRadius;
  structureBBs.push({ cx: x, cz: z, hw: halfW, hd: halfD, h });
}

function generateStructures() {
  let placed = 0;
  let attempts = 0;
  while (placed < CFG.structures.count && attempts < 2000) {
    attempts++;
    const x = (Math.random() - 0.5) * (CFG.world.size - 20);
    const z = (Math.random() - 0.5) * (CFG.world.size - 20);
    if (Math.sqrt(x * x + z * z) < CFG.structures.minDist) continue;
    // Check distance from other structures
    let tooClose = false;
    for (const bb of structureBBs) {
      if (Math.abs(bb.cx - x) < 5 && Math.abs(bb.cz - z) < 5) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    createStructure(x, z);
    placed++;
  }
}

// ============================================================================
// §9  COLLECTIBLE DATA FRAGMENTS
// ============================================================================

const fragments = [];

function createFragment(x, z) {
  const group = new THREE.Group();
  const type = Math.random() > 0.5;
  const geo = type
    ? new THREE.OctahedronGeometry(0.4, 0)
    : new THREE.IcosahedronGeometry(0.35, 0);
  const edges = new THREE.EdgesGeometry(geo);
  const color = [0x00ffff, 0xff00ff, 0x66ffaa][
    Math.floor(Math.random() * 3)
  ];
  const lineMat = new THREE.LineBasicMaterial({ color });
  const lineSegs = new THREE.LineSegments(edges, lineMat);

  const fillMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.25,
    wireframe: true,
  });
  const fillMesh = new THREE.Mesh(geo, fillMat);

  group.add(lineSegs);
  group.add(fillMesh);

  const y = 1.0 + Math.random() * 1.5;
  group.position.set(x, y, z);

  // Point light
  const light = new THREE.PointLight(color, 0.8, 8);
  light.position.set(0, 0, 0);
  group.add(light);

  // Trail particles (small spheres orbiting)
  const trailGroup = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const tGeo = new THREE.SphereGeometry(0.04, 4, 4);
    const tMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
    });
    const tMesh = new THREE.Mesh(tGeo, tMat);
    tMesh.userData = {
      angle: (i / 6) * Math.PI * 2,
      radius: 0.5 + Math.random() * 0.3,
      speed: 1.5 + Math.random(),
      yOffset: (Math.random() - 0.5) * 0.4,
    };
    trailGroup.add(tMesh);
  }
  group.add(trailGroup);

  group.userData = {
    active: true,
    baseY: y,
    bobPhase: Math.random() * Math.PI * 2,
    rotSpeed: 1 + Math.random(),
    trailGroup,
    light,
    respawnTimer: 0,
  };

  scene.add(group);
  fragments.push(group);
}

function spawnFragments() {
  for (let i = 0; i < CFG.fragments.count; i++) {
    const x = (Math.random() - 0.5) * (CFG.world.size - 40);
    const z = (Math.random() - 0.5) * (CFG.world.size - 40);
    createFragment(x, z);
  }
}

function respawnFragment(frag) {
  const x = (Math.random() - 0.5) * (CFG.world.size - 40);
  const z = (Math.random() - 0.5) * (CFG.world.size - 40);
  frag.position.set(x, frag.userData.baseY, z);
  frag.userData.active = true;
  frag.visible = true;
}

// ============================================================================
// §10  SENTINEL OBSTACLES
// ============================================================================

const sentinels = [];

function createSentinel() {
  const group = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(0.6, 0);
  const edges = new THREE.EdgesGeometry(geo);
  const color = Math.random() > 0.5 ? 0xff2244 : 0xff6622;
  const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  const lineSegs = new THREE.LineSegments(edges, lineMat);

  const fillMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.15,
  });
  const fillMesh = new THREE.Mesh(geo, fillMat);

  // Inner glow core
  const coreGeo = new THREE.SphereGeometry(0.25, 8, 8);
  const coreMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);

  const light = new THREE.PointLight(color, 1.0, 10);

  group.add(lineSegs, fillMesh, core, light);

  // Patrol setup
  const patrolType = Math.random() > 0.5 ? 'circular' : 'linear';
  const cx = (Math.random() - 0.5) * (CFG.world.size - 60);
  const cz = (Math.random() - 0.5) * (CFG.world.size - 60);
  const patrolRadius = 8 + Math.random() * 20;
  const speed = 1.5 + Math.random() * 3;
  const patrolAngle = Math.random() * Math.PI * 2;
  const y = 1.0 + Math.random() * 1.5;

  group.position.set(cx, y, cz);

  group.userData = {
    patrolType,
    cx,
    cz,
    patrolRadius,
    speed,
    patrolAngle,
    y,
    lineMat,
    fillMat,
    coreMat,
    light,
    collisionRadius: 1.0,
  };

  scene.add(group);
  sentinels.push(group);
}

function spawnSentinels() {
  for (let i = 0; i < CFG.sentinels.count; i++) {
    createSentinel();
  }
}

// ============================================================================
// §11  PARTICLE SYSTEM (Object-pooled)
// ============================================================================

class ParticlePool {
  constructor(maxCount, scene) {
    this.pool = [];
    this.scene = scene;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(maxCount * 3);
    const colors = new Float32Array(maxCount * 3);
    const sizes = new Float32Array(maxCount);
    const alphas = new Float32Array(maxCount);

    for (let i = 0; i < maxCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = -1000;
      positions[i * 3 + 2] = 0;
      colors[i * 3] = 0;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 1;
      sizes[i] = 2;
      alphas[i] = 0;
      this.pool.push({
        active: false,
        life: 0,
        maxLife: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        index: i,
      });
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vColor = color;
          vAlpha = alpha;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.3, d) * vAlpha;
          gl_FragColor = vec4(vColor, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geo, mat);
    this.scene.add(this.points);
    this.maxCount = maxCount;
  }

  emit(x, y, z, vx, vy, vz, r, g, b, life, size) {
    for (const p of this.pool) {
      if (!p.active) {
        p.active = true;
        p.life = life;
        p.maxLife = life;
        p.vx = vx;
        p.vy = vy;
        p.vz = vz;

        const pos = this.points.geometry.attributes.position;
        const col = this.points.geometry.attributes.color;
        const sz = this.points.geometry.attributes.size;
        const al = this.points.geometry.attributes.alpha;

        pos.setXYZ(p.index, x, y, z);
        col.setXYZ(p.index, r, g, b);
        sz.setX(p.index, size || 2);
        al.setX(p.index, 1);

        pos.needsUpdate = true;
        col.needsUpdate = true;
        sz.needsUpdate = true;
        al.needsUpdate = true;
        return;
      }
    }
  }

  update(dt) {
    const pos = this.points.geometry.attributes.position;
    const al = this.points.geometry.attributes.alpha;
    let needsUpdate = false;

    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        pos.setXYZ(p.index, 0, -1000, 0);
        al.setX(p.index, 0);
        needsUpdate = true;
        continue;
      }

      const px = pos.getX(p.index) + p.vx * dt;
      const py = pos.getY(p.index) + p.vy * dt;
      const pz = pos.getZ(p.index) + p.vz * dt;
      pos.setXYZ(p.index, px, py, pz);
      al.setX(p.index, p.life / p.maxLife);
      needsUpdate = true;
    }

    if (needsUpdate) {
      pos.needsUpdate = true;
      al.needsUpdate = true;
    }
  }
}

let particles; // Initialized later
let ambientParticles; // Ambient floating holographic dust

function initParticles() {
  particles = new ParticlePool(500, scene);
  ambientParticles = new ParticlePool(CFG.particles.ambient, scene);
}

function spawnAmbientParticles() {
  for (let i = 0; i < CFG.particles.ambient; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 30;
    const x = playerPos.x + Math.cos(angle) * dist;
    const z = playerPos.z + Math.sin(angle) * dist;
    const y = Math.random() * 5;
    const c = Math.random() > 0.5 ? [0, 1, 1] : [1, 0, 1];
    ambientParticles.emit(
      x, y, z,
      (Math.random() - 0.5) * 0.3,
      0.1 + Math.random() * 0.2,
      (Math.random() - 0.5) * 0.3,
      c[0], c[1], c[2],
      3 + Math.random() * 5,
      1.5
    );
  }
}

function burstCollect(x, y, z) {
  for (let i = 0; i < CFG.particles.burst; i++) {
    const speed = 2 + Math.random() * 5;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const vx = Math.sin(phi) * Math.cos(theta) * speed;
    const vy = Math.sin(phi) * Math.sin(theta) * speed * 0.5 + 2;
    const vz = Math.cos(phi) * speed;
    const c = Math.random() > 0.3 ? [0, 1, 1] : [0.5, 1, 0.8];
    particles.emit(x, y, z, vx, vy, vz, c[0], c[1], c[2], 0.5 + Math.random() * 0.8, 3);
  }
}

function burstDamage(x, y, z) {
  for (let i = 0; i < 30; i++) {
    const speed = 1 + Math.random() * 3;
    const vx = (Math.random() - 0.5) * speed;
    const vy = Math.random() * speed;
    const vz = (Math.random() - 0.5) * speed;
    particles.emit(x, y, z, vx, vy, vz, 1, 0.1, 0.1, 0.3 + Math.random() * 0.5, 2.5);
  }
}

// ============================================================================
// §12  INPUT HANDLING
// ============================================================================

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
});

document.addEventListener('mousemove', (e) => {
  if (!pointerLocked || !state.running) return;
  cameraYaw -= e.movementX * CFG.player.mouseSensitivity;
  cameraPitch -= e.movementY * CFG.player.mouseSensitivity;
  cameraPitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, cameraPitch));
});

// ============================================================================
// §13  PLAYER CONTROLLER
// ============================================================================

function updatePlayer(dt) {
  const isSprinting =
    keys['ShiftLeft'] || keys['ShiftRight'];
  const speedMult = isSprinting ? CFG.player.sprintMultiplier : 1;
  const maxSpeed = CFG.player.speed * speedMult;

  // Build input direction
  const forward = new THREE.Vector3(
    -Math.sin(cameraYaw),
    0,
    -Math.cos(cameraYaw)
  );
  const right = new THREE.Vector3(
    Math.cos(cameraYaw),
    0,
    -Math.sin(cameraYaw)
  );

  moveDir.set(0, 0, 0);
  if (keys['KeyW'] || keys['ArrowUp']) moveDir.add(forward);
  if (keys['KeyS'] || keys['ArrowDown']) moveDir.sub(forward);
  if (keys['KeyD'] || keys['ArrowRight']) moveDir.add(right);
  if (keys['KeyA'] || keys['ArrowLeft']) moveDir.sub(right);

  if (moveDir.lengthSq() > 0) {
    moveDir.normalize();
    velocity.x += moveDir.x * CFG.player.acceleration * dt;
    velocity.z += moveDir.z * CFG.player.acceleration * dt;
  } else {
    // Decelerate
    velocity.x *= 1 - CFG.player.deceleration * dt;
    velocity.z *= 1 - CFG.player.deceleration * dt;
  }

  // Clamp horizontal speed
  const hSpeed = Math.sqrt(velocity.x * velocity.x + velocity.z * velocity.z);
  if (hSpeed > maxSpeed) {
    velocity.x *= maxSpeed / hSpeed;
    velocity.z *= maxSpeed / hSpeed;
  }

  // Jump
  if ((keys['Space']) && isOnGround) {
    verticalVelocity = CFG.player.jumpForce;
    isOnGround = false;
  }

  // Gravity
  verticalVelocity += CFG.player.gravity * dt;

  // Proposed new position
  let newX = playerPos.x + velocity.x * dt;
  let newZ = playerPos.z + velocity.z * dt;
  let newY = playerPos.y + verticalVelocity * dt;

  // Collision with structures
  for (const bb of structureBBs) {
    if (
      newX > bb.cx - bb.hw &&
      newX < bb.cx + bb.hw &&
      newZ > bb.cz - bb.hd &&
      newZ < bb.cz + bb.hd &&
      newY < bb.h + 0.5
    ) {
      // Push out – find nearest edge
      const dx1 = newX - (bb.cx - bb.hw);
      const dx2 = bb.cx + bb.hw - newX;
      const dz1 = newZ - (bb.cz - bb.hd);
      const dz2 = bb.cz + bb.hd - newZ;
      const minD = Math.min(dx1, dx2, dz1, dz2);
      if (minD === dx1) { newX = bb.cx - bb.hw; velocity.x = 0; }
      else if (minD === dx2) { newX = bb.cx + bb.hw; velocity.x = 0; }
      else if (minD === dz1) { newZ = bb.cz - bb.hd; velocity.z = 0; }
      else { newZ = bb.cz + bb.hd; velocity.z = 0; }
    }
  }

  // World bounds
  const bound = CFG.world.halfSize - 2;
  newX = Math.max(-bound, Math.min(bound, newX));
  newZ = Math.max(-bound, Math.min(bound, newZ));

  // Ground collision
  if (newY <= CFG.player.height) {
    newY = CFG.player.height;
    verticalVelocity = 0;
    isOnGround = true;
  }

  playerPos.set(newX, newY, newZ);

  // Head bob
  const currentSpeed = Math.sqrt(
    velocity.x * velocity.x + velocity.z * velocity.z
  );
  if (currentSpeed > 0.5 && isOnGround) {
    bobPhase += dt * CFG.player.bobSpeed * (isSprinting ? 1.3 : 1);
    const bobY = Math.sin(bobPhase) * CFG.player.bobAmount * (isSprinting ? 1.5 : 1);
    const bobX = Math.cos(bobPhase * 0.5) * CFG.player.bobAmount * 0.5;
    camera.position.set(
      playerPos.x + bobX,
      playerPos.y + bobY,
      playerPos.z
    );
  } else {
    camera.position.copy(playerPos);
  }

  // Camera rotation
  const euler = new THREE.Euler(cameraPitch, cameraYaw, 0, 'YXZ');
  camera.quaternion.setFromEuler(euler);

  // Screen shake
  if (state.screenShake > 0) {
    const shakeX = (Math.random() - 0.5) * state.screenShake * 0.06;
    const shakeY = (Math.random() - 0.5) * state.screenShake * 0.06;
    camera.position.x += shakeX;
    camera.position.y += shakeY;
    state.screenShake *= 0.9;
    if (state.screenShake < 0.01) state.screenShake = 0;
  }

  // Update lights
  playerLightCyan.position.set(playerPos.x, playerPos.y + 1, playerPos.z);
  playerLightMagenta.position.set(
    playerPos.x - 2,
    playerPos.y + 0.5,
    playerPos.z + 2
  );
  playerLightBlue.position.set(
    playerPos.x + 2,
    playerPos.y + 0.5,
    playerPos.z - 2
  );

  // Sprint chromatic aberration
  state.sprintChromaticAberration = isSprinting
    ? Math.min(state.sprintChromaticAberration + dt * 3, 1)
    : Math.max(state.sprintChromaticAberration - dt * 5, 0);

  // Damage cooldown
  if (state.damageCooldownTimer > 0) {
    state.damageCooldownTimer -= dt;
  }
}

// ============================================================================
// §14  GAME LOGIC
// ============================================================================

function checkFragmentCollection() {
  for (const frag of fragments) {
    if (!frag.userData.active) continue;
    const dx = playerPos.x - frag.position.x;
    const dz = playerPos.z - frag.position.z;
    const dy = playerPos.y - frag.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1.8) {
      frag.userData.active = false;
      frag.visible = false;
      state.score += 500;
      state.collected++;
      burstCollect(frag.position.x, frag.position.y, frag.position.z);
      triggerFlash(0, 1, 1, 0.3);
      pulseHUD();
      // Schedule respawn
      frag.userData.respawnTimer = CFG.fragments.respawnDelay;
    }
  }
}

function checkSentinelDamage() {
  if (state.damageCooldownTimer > 0) return;
  for (const s of sentinels) {
    const dx = playerPos.x - s.position.x;
    const dz = playerPos.z - s.position.z;
    const dy = playerPos.y - s.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < s.userData.collisionRadius + CFG.player.collisionRadius + 0.3) {
      state.health -= 15;
      state.damageCooldownTimer = CFG.player.damageCooldown;
      state.screenShake = 1;
      triggerFlash(1, 0.1, 0.1, 0.5);
      burstDamage(playerPos.x, playerPos.y, playerPos.z);
      if (state.health <= 0) {
        state.health = 0;
        gameOverSequence();
      }
      break;
    }
  }
}

function updateSentinels(dt, time) {
  for (const s of sentinels) {
    const d = s.userData;
    d.patrolAngle += d.speed * dt * 0.3;

    if (d.patrolType === 'circular') {
      s.position.x = d.cx + Math.cos(d.patrolAngle) * d.patrolRadius;
      s.position.z = d.cz + Math.sin(d.patrolAngle) * d.patrolRadius;
    } else {
      s.position.x = d.cx + Math.sin(d.patrolAngle) * d.patrolRadius;
      s.position.z = d.cz + Math.cos(d.patrolAngle * 0.7) * d.patrolRadius * 0.5;
    }

    s.position.y = d.y + Math.sin(time * 2 + d.patrolAngle) * 0.3;
    s.rotation.x += dt * 1.5;
    s.rotation.z += dt * 0.8;

    // Pulsing glow
    const pulse = 0.7 + 0.3 * Math.sin(time * 4 + d.patrolAngle);
    d.light.intensity = pulse * 1.2;
    d.coreMat.opacity = 0.3 + pulse * 0.3;
  }
}

function updateFragments(dt, time) {
  for (const frag of fragments) {
    if (!frag.userData.active) {
      frag.userData.respawnTimer -= dt;
      if (frag.userData.respawnTimer <= 0) {
        respawnFragment(frag);
      }
      continue;
    }

    const d = frag.userData;
    frag.position.y = d.baseY + Math.sin(time * 2 + d.bobPhase) * 0.3;
    frag.rotation.y += d.rotSpeed * dt;
    frag.rotation.x += d.rotSpeed * 0.3 * dt;

    // Update trail particles
    for (const child of d.trailGroup.children) {
      const td = child.userData;
      td.angle += td.speed * dt;
      child.position.set(
        Math.cos(td.angle) * td.radius,
        td.yOffset + Math.sin(td.angle * 2) * 0.1,
        Math.sin(td.angle) * td.radius
      );
    }

    d.light.intensity = 0.5 + 0.3 * Math.sin(time * 3 + d.bobPhase);
  }
}

function updateStructures(dt, time) {
  for (const s of structures) {
    const d = s.userData;
    if (d.rotSpeed) s.rotation.y += d.rotSpeed * dt;
    if (d.pulseSpeed) {
      const p = 0.5 + 0.5 * Math.sin(time * d.pulseSpeed);
      d.lineMat.opacity = 0.4 + p * 0.4;
    }
    d.fillMat.uniforms.uTime.value = time;
  }
}

// ============================================================================
// §15  HUD & UI
// ============================================================================

function updateHUD() {
  // Score (increases over time)
  if (state.running && !state.gameOver) {
    state.score += 1;
  }
  dom.scoreDisplay.textContent = String(state.score).padStart(8, '0');

  // Health
  dom.healthBar.style.width = state.health + '%';
  dom.healthText.textContent = Math.ceil(state.health);
  if (state.health > 60) {
    dom.healthBar.style.background = 'linear-gradient(90deg, #00ffff, #00ff88)';
  } else if (state.health > 30) {
    dom.healthBar.style.background = 'linear-gradient(90deg, #ffaa00, #ff6600)';
  } else {
    dom.healthBar.style.background = 'linear-gradient(90deg, #ff2244, #ff0000)';
  }

  // Speed
  const speed = Math.sqrt(
    velocity.x * velocity.x + velocity.z * velocity.z
  );
  dom.speedDisplay.textContent = speed.toFixed(1);

  // Compass
  let bearing = ((cameraYaw * 180) / Math.PI) % 360;
  if (bearing < 0) bearing += 360;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(bearing / 45) % 8;
  dom.compass.textContent = directions[idx] + ' ' + Math.round(bearing) + '°';

  // Collection count
  dom.collectionCount.textContent = state.collected;
}

function triggerFlash(r, g, b, intensity) {
  state.screenFlash = { r, g, b, a: intensity };
}

let hudPulseTimer = 0;
function pulseHUD() {
  hudPulseTimer = 0.3;
  if (dom.scoreDisplay) {
    dom.scoreDisplay.style.textShadow = '0 0 20px #00ffff, 0 0 40px #00ffff';
  }
}

function updateFlashOverlay(dt) {
  if (state.screenFlash.a > 0) {
    state.screenFlash.a -= dt * 2;
    if (state.screenFlash.a < 0) state.screenFlash.a = 0;
    const { r, g, b, a } = state.screenFlash;
    dom.flashOverlay.style.background = `rgba(${r * 255},${g * 255},${b * 255},${a})`;
    dom.flashOverlay.style.display = 'block';
  } else {
    dom.flashOverlay.style.display = 'none';
  }

  if (hudPulseTimer > 0) {
    hudPulseTimer -= dt;
    if (hudPulseTimer <= 0 && dom.scoreDisplay) {
      dom.scoreDisplay.style.textShadow = '0 0 10px #00ffff';
    }
  }
}

// ============================================================================
// §16  GAME FLOW
// ============================================================================

function startLoading() {
  dom.loadingScreen.style.display = 'flex';
  dom.startScreen.style.display = 'none';
  dom.hud.style.display = 'none';
  dom.gameOverScreen.style.display = 'none';

  let progress = 0;
  const loadInterval = setInterval(() => {
    progress += Math.random() * 8 + 2;
    if (progress >= 100) {
      progress = 100;
      clearInterval(loadInterval);
      setTimeout(() => {
        dom.loadingScreen.style.display = 'none';
        dom.startScreen.style.display = 'flex';
      }, 400);
    }
    dom.loadingBar.style.width = progress + '%';
  }, 80);
}

function initGame() {
  // Clear previous state
  for (const s of structures) scene.remove(s);
  structures.length = 0;
  structureBBs.length = 0;
  for (const f of fragments) scene.remove(f);
  fragments.length = 0;
  for (const s of sentinels) scene.remove(s);
  sentinels.length = 0;

  if (particles) {
    scene.remove(particles.points);
    scene.remove(ambientParticles.points);
  }

  // Reset state
  state.running = false;
  state.gameOver = false;
  state.score = 0;
  state.health = CFG.player.maxHealth;
  state.collected = 0;
  state.time = 0;
  state.damageCooldownTimer = 0;
  state.screenShake = 0;
  state.screenFlash = { r: 0, g: 0, b: 0, a: 0 };
  state.sprintChromaticAberration = 0;

  playerPos.set(0, CFG.player.height, 0);
  velocity.set(0, 0, 0);
  verticalVelocity = 0;
  isOnGround = true;
  cameraPitch = 0;
  cameraYaw = 0;
  bobPhase = 0;

  // Generate world
  generateStructures();
  spawnFragments();
  spawnSentinels();
  initParticles();
}

function startGame() {
  state.running = true;
  dom.startScreen.style.display = 'none';
  dom.hud.style.display = 'block';
  renderer.domElement.requestPointerLock();
}

function gameOverSequence() {
  state.running = false;
  state.gameOver = true;
  document.exitPointerLock();
  dom.hud.style.display = 'none';
  dom.finalScore.textContent = String(state.score).padStart(8, '0');
  dom.gameOverScreen.style.display = 'flex';
}

function reboot() {
  dom.gameOverScreen.style.display = 'none';
  initGame();
  startLoading();
}

// Button handlers
dom.startBtn.addEventListener('click', startGame);
dom.rebootBtn.addEventListener('click', reboot);

// ============================================================================
// §17  MAIN GAME LOOP
// ============================================================================

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05); // Cap delta
  state.time += dt;
  const time = state.time;

  if (state.running && !state.gameOver) {
    updatePlayer(dt);
    checkFragmentCollection();
    checkSentinelDamage();
  }

  // Always update visuals even when paused (for ambient effects)
  updateSentinels(dt, time);
  updateFragments(dt, time);
  updateStructures(dt, time);

  if (particles) {
    particles.update(dt);
    ambientParticles.update(dt);
  }

  // Respawn ambient particles
  if (state.running && Math.random() < 0.3) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 5 + Math.random() * 25;
    const x = playerPos.x + Math.cos(angle) * dist;
    const z = playerPos.z + Math.sin(angle) * dist;
    const y = Math.random() * 4;
    const c = Math.random() > 0.5 ? [0, 1, 1] : [1, 0, 1];
    ambientParticles.emit(
      x, y, z,
      (Math.random() - 0.5) * 0.2,
      0.1 + Math.random() * 0.15,
      (Math.random() - 0.5) * 0.2,
      c[0], c[1], c[2],
      3 + Math.random() * 4,
      1
    );
  }

  // Update shader uniforms
  gridShaderMaterial.uniforms.uTime.value = time;
  gridShaderMaterial.uniforms.uPlayerPos.value.copy(playerPos);
  skyMat.uniforms.uTime.value = time;

  // Sky rings rotation
  for (let i = 0; i < skyRings.length; i++) {
    skyRings[i].rotation.z += dt * 0.02 * (i + 1) * (i % 2 === 0 ? 1 : -1);
  }

  // Data streams flicker
  for (const child of dataStreamGroup.children) {
    child.material.opacity =
      child.userData.baseOpacity *
      (0.5 + 0.5 * Math.sin(time * child.userData.flickerSpeed));
  }

  // Post-processing uniforms
  holoPass.uniforms.uTime.value = time;
  holoPass.uniforms.uChromaticAberration.value =
    0.002 + state.sprintChromaticAberration * 0.006;

  // HUD
  if (state.running) {
    updateHUD();
  }
  updateFlashOverlay(dt);

  // Render
  composer.render();
}

// ============================================================================
// §18  WINDOW RESIZE
// ============================================================================

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
});

// ============================================================================
// §19  BOOT
// ============================================================================

initGame();
startLoading();
animate();
