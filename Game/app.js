/* ═══════════════════════════════════════════════════════════
   ARENA FIGHTERS - 3D Characters v4 (GLB/GLTF)
   Loads real 3D models (.glb) + fallback primitives
   Drag & drop + loading from models/
   ═══════════════════════════════════════════════════════════ */

const HEROES = [
  {
    id:'saul', name:'Saul', title:'Terrestrial War Bear',
    element:'earth', gradeClass:'excellent', gradeLabel:'Excellent', glowColor:0xFF6B35,
    modelFile:'saul.glb', modelScale:1.0, modelOffset:[0,0,0], modelRotationY:0,
    evolutions:[
      {level:1,name:'Cub',stars:1,mult:0.3},
      {level:60,name:'Warrior',stars:2,mult:0.5},
      {level:100,name:'Champion',stars:3,mult:0.7},
      {level:140,name:'Excellent',stars:4,mult:0.85},
      {level:180,name:'5+ Excellent',stars:5,mult:1.0}
    ],
    baseStats:{hp:409094,atk:24382,def:2113,spd:145,crit:18}, basePower:139054
  },
  {
    id:'alvarez', name:'Alvarez', title:'Shadow of the Exile',
    element:'shadow', gradeClass:'mythique', gradeLabel:'Mythic', glowColor:0x9B59B6,
    modelFile:'alvarez.glb', modelScale:1.0, modelOffset:[0,0,0], modelRotationY:-Math.PI/2,
    evolutions:[
      {level:1,name:'Novice',stars:1,mult:0.2},
      {level:80,name:'Elite',stars:2,mult:0.4},
      {level:140,name:'Legendary',stars:3,mult:0.6},
      {level:200,name:'Mythic',stars:4,mult:0.8},
      {level:240,name:'5+ Mythic',stars:5,mult:1.0}
    ],
    baseStats:{hp:2118524,atk:110419,def:2905,spd:210,crit:35}, basePower:574345
  },
  {
    id:'garuda', name:'Garuda', title:'Dragon Slayer',
    element:'light', gradeClass:'legendaire', gradeLabel:'Legendary+', glowColor:0xF1C40F,
    modelFile:'garuda.glb', modelScale:1.0, modelOffset:[0,0,0], modelRotationY:-Math.PI/2,
    evolutions:[
      {level:1,name:'Hatching',stars:1,mult:0.25},
      {level:60,name:'Warrior',stars:2,mult:0.45},
      {level:120,name:'Champion',stars:3,mult:0.65},
      {level:160,name:'Legendary',stars:4,mult:0.82},
      {level:200,name:'5 Legendary+',stars:5,mult:1.0}
    ],
    baseStats:{hp:1104862,atk:59317,def:3078,spd:175,crit:25}, basePower:304423
  },
  {
    id:'calisto', name:'Calisto', title:'Primordial Guardian',
    element:'ice', gradeClass:'epique', gradeLabel:'Epic+', glowColor:0x3498DB,
    modelFile:'calisto.glb', modelScale:1.0, modelOffset:[0,0,0], modelRotationY:Math.PI,
    evolutions:[
      {level:1,name:'Awakening',stars:1,mult:0.25},
      {level:60,name:'Guardian',stars:2,mult:0.45},
      {level:100,name:'Epic',stars:3,mult:0.65},
      {level:140,name:'Epic+',stars:4,mult:0.82},
      {level:180,name:'5+ Epic+',stars:5,mult:1.0}
    ],
    baseStats:{hp:656319,atk:45277,def:2015,spd:190,crit:22}, basePower:209551
  },
  {
    id:'fenixia', name:'Fenixia', title:'Blazing Phoenix',
    element:'fire', gradeClass:'excellent', gradeLabel:'Excellent', glowColor:0xFF8C00,
    modelFile:'fenixia.glb', modelScale:1.0, modelOffset:[0,0,0], modelRotationY:0,
    evolutions:[
      {level:1,name:'Spark',stars:1,mult:0.25},
      {level:60,name:'Ember',stars:2,mult:0.45},
      {level:100,name:'Inferno',stars:3,mult:0.65},
      {level:140,name:'Excellent',stars:4,mult:0.82},
      {level:180,name:'5+ Excellent',stars:5,mult:1.0}
    ],
    baseStats:{hp:594731,atk:42716,def:1974,spd:200,crit:28}, basePower:322173
  }
];

// ─── STATE ───
// Pick two different random heroes
const playerIdx = Math.floor(Math.random() * HEROES.length);
let opponentIdx;
do { opponentIdx = Math.floor(Math.random() * HEROES.length); } while (opponentIdx === playerIdx);

let currentHero = HEROES[playerIdx];
let opponentHero = HEROES[opponentIdx];
let currentEvoIndex = currentHero.evolutions.length - 1;
let opponentEvoIndex = opponentHero.evolutions.length - 1;

let scene, camera, renderer, controls, heroGroup, opponentGroup, particleSystem, groundPlane, heroLight, glowRing1, glowRing2;
let clock, animState='idle', animTime=0;
let gltfLoader;
let loadedModels = {};       // Cache: heroId -> { scene, animations, mixer }
let currentMixer = null;     // AnimationMixer for current model
let currentActions = [];     // Current animation actions
let usingGLB = false;        // Is current hero using a GLB model?

// Battle state
let playerGauge = 0;
let opponentGauge = 0;
const GAUGE_MAX = 100;
const GAUGE_PER_HIT = 25;

// ─── SCENE SETUP ───
function initScene() {
  const canvas = document.getElementById('gameCanvas');
  const cont = canvas.parentElement;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;
  renderer.physicallyCorrectLights = true;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.setClearColor(0x000000, 0); // Transparent background - video shows through

  scene = new THREE.Scene();
  // No fog - video background shows through
  // scene.fog = new THREE.FogExp2(0x0a0e1a, 0.025);

  camera = new THREE.PerspectiveCamera(32, cont.clientWidth / cont.clientHeight, 0.1, 100);
  // Side view camera - positioned to frame fighters on the arena circle
  camera.position.set(0, 0.7, 4.5);

  // OrbitControls - locked camera for battle mode
  controls = new THREE.OrbitControls(camera, canvas);
  controls.target.set(0, 0.35, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0;
  controls.enableRotate = false;  // No rotation - fixed battle view
  controls.enablePan = false;     // No panning
  controls.enableZoom = false;    // No zoom
  controls.update();

  // Dramatic fighting game lighting
  const ambient = new THREE.AmbientLight(0x667799, 1.0);
  scene.add(ambient);

  // Strong top-down key light
  const mainLight = new THREE.DirectionalLight(0xffeedd, 2.0);
  mainLight.position.set(0, 12, 4);
  mainLight.castShadow = true;
  mainLight.shadow.mapSize.set(2048, 2048);
  mainLight.shadow.camera.near = 0.5;
  mainLight.shadow.camera.far = 30;
  mainLight.shadow.camera.left = -8;
  mainLight.shadow.camera.right = 8;
  mainLight.shadow.camera.top = 8;
  mainLight.shadow.camera.bottom = -8;
  scene.add(mainLight);

  // Blue rim light from behind (dramatic edge lighting)
  const rim = new THREE.DirectionalLight(0x4488ff, 0.8);
  rim.position.set(0, 4, -6);
  scene.add(rim);

  // Warm fill from front
  const fill = new THREE.DirectionalLight(0xffaa66, 0.5);
  fill.position.set(0, 3, 8);
  scene.add(fill);

  // Player side light (warm)
  const playerLight = new THREE.PointLight(0xFF8844, 0.6, 10);
  playerLight.position.set(-3, 3, 2);
  scene.add(playerLight);

  // Opponent side light (cool)
  const oppLight = new THREE.PointLight(0x4488FF, 0.6, 10);
  oppLight.position.set(3, 3, 2);
  scene.add(oppLight);

  heroLight = new THREE.PointLight(0xFFFFFF, 0.4, 10);
  heroLight.position.set(0, 4, 3);
  scene.add(heroLight);

  // No ground platform or circles - video arena is the ground
  groundPlane = new THREE.Object3D(); // Dummy for compatibility
  glowRing1 = new THREE.Object3D();
  glowRing2 = new THREE.Object3D();

  // Fighters face each other on the arena circle, profile to camera
  heroGroup = new THREE.Group();
  heroGroup.position.set(-0.45, 0, 0);       // Player left
  heroGroup.rotation.y = Math.PI / 2;       // Face right (toward opponent)
  scene.add(heroGroup);

  opponentGroup = new THREE.Group();
  opponentGroup.position.set(0.45, 0, 0);     // Opponent right
  opponentGroup.rotation.y = -Math.PI / 2;   // Face left (toward player)
  scene.add(opponentGroup);

  clock = new THREE.Clock();
  gltfLoader = new THREE.GLTFLoader();

  // Resize
  function resize() {
    camera.aspect = cont.clientWidth / cont.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(cont.clientWidth, cont.clientHeight);
  }
  window.addEventListener('resize', resize);
  resize();

  // Drag & Drop
  setupDragDrop(cont);
}

// ─── DRAG & DROP GLB FILES ───
function setupDragDrop(container) {
  const dropZone = document.getElementById('dropZone');

  ['dragenter', 'dragover'].forEach(evt => {
    container.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('active');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    container.addEventListener(evt, e => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('active');
    });
  });

  container.addEventListener('drop', e => {
    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    for (const file of files) {
      if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
        loadGLBFromFile(file);
      }
    }
  });
}

function loadGLBFromFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const buffer = e.target.result;
    gltfLoader.parse(buffer, '', function(gltf) {
      processLoadedModel(gltf, currentHero.id, file.name);
    }, function(error) {
      console.error('GLB loading error:', error);
      updateModelStatus('error', 'Error:' + error.message);
    });
  };
  reader.readAsArrayBuffer(file);
}

function loadGLBFromURL(heroId, url) {
  gltfLoader.load(url,
    function(gltf) {
      processLoadedModel(gltf, heroId, url);
    },
    function(progress) {
      // Loading progress
    },
    function(error) {
      // File not found - use fallback
      console.log('No GLB model for' + heroId + ', using fallback primitives.');
      if (heroId === currentHero.id) {
        spawnFallback();
      }
    }
  );
}

// ═══ PER-HERO ANIMATION DATA (Elden Ring style) ═══
const HERO_ANIMS = {
  // ── SAUL: Heavy Axe Slam (Strength build) ──
  saul: {
    attack: {
      arm: [
        // No arm distortion - body rotation sells the sword swing
        { t: 0.00, swing: 0, side: 0 },
        { t: 1.00, swing: 0, side: 0 },
      ],
      body: [
        { t: 0.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
        // Wind-up: turn LEFT, pulling axe back on the weapon side
        { t: 0.10, px: 0, py: 0.01, pz: -0.03, rx: 0.02, ry: -0.12, rz: 0.01, s: 1.0 },
        { t: 0.22, px: 0, py: 0.03, pz: -0.06, rx: 0.04, ry: -0.28, rz: 0.02, s: 1.0 },
        // Peak: full coil left (axe side wound back)
        { t: 0.35, px: 0, py: 0.04, pz: -0.05, rx: 0.05, ry: -0.35, rz: 0.02, s: 1.0 },
        // SLASH: fast rotation RIGHT + step forward (axe swings across)
        { t: 0.43, px: 0, py: 0.02, pz: 0.06, rx: 0, ry: -0.05, rz: -0.01, s: 1.01 },
        { t: 0.50, px: 0, py: 0, pz: 0.14, rx: -0.03, ry: 0.25, rz: -0.02, s: 1.02 },
        { t: 0.57, px: 0, py: -0.01, pz: 0.18, rx: -0.04, ry: 0.45, rz: -0.02, s: 1.03 },
        // Follow through
        { t: 0.65, px: 0, py: -0.02, pz: 0.16, rx: -0.03, ry: 0.5, rz: -0.01, s: 1.01 },
        // Heavy recovery: slowly return
        { t: 0.78, px: 0, py: -0.01, pz: 0.1, rx: -0.01, ry: 0.28, rz: -0.01, s: 1.0 },
        { t: 0.90, px: 0, py: 0, pz: 0.03, rx: 0, ry: 0.08, rz: 0, s: 1.0 },
        { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
      ],
      duration: 1100
    },
    dodge: {
      body: [
        { t: 0.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
        // Quick heavy sidestep left — shoulder-first like a juggernaut dodge
        { t: 0.06, px: -0.08, py: -0.06, pz: 0.05, rx: 0.05, ry: 0.15, rz: 0.06, s: 0.98 },
        // Explosive lateral dash — low and fast
        { t: 0.18, px: -0.5, py: -0.15, pz: 0.1, rx: 0.1, ry: 0.3, rz: 0.12, s: 0.93 },
        // Full extension — deep sidestep, body leaning
        { t: 0.32, px: -0.75, py: -0.12, pz: 0.08, rx: 0.08, ry: 0.25, rz: 0.1, s: 0.94 },
        // Hold the dodge — braced and ready
        { t: 0.48, px: -0.7, py: -0.05, pz: 0.05, rx: 0.04, ry: 0.15, rz: 0.06, s: 0.97 },
        // Heavy return — shifting weight back
        { t: 0.68, px: -0.35, py: 0, pz: 0.02, rx: 0.01, ry: 0.05, rz: 0.02, s: 0.99 },
        // Settle back into stance
        { t: 0.85, px: -0.1, py: 0, pz: 0, rx: 0, ry: 0.01, rz: 0, s: 1.0 },
        { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
      ],
      duration: 750
    }
  },

  // ── ALVAREZ: Fast 3-Hit Dagger Combo (Dex/Bleed build) ──
  alvarez: {
    attack: {
      arm: [
        { t: 0.00, swing: 0, side: 0 },
        // 1st strike: quick right slash
        { t: 0.06, swing: 0.3, side: -0.2 },
        { t: 0.14, swing: -0.7, side: 0.4 },
        // Return
        { t: 0.22, swing: -0.2, side: 0.1 },
        // 2nd strike: quick left slash (reverse)
        { t: 0.28, swing: -0.3, side: -0.3 },
        { t: 0.38, swing: 0.5, side: -0.6 },
        // Return
        { t: 0.48, swing: 0.1, side: -0.1 },
        // 3rd strike: forward thrust - finishing blow
        { t: 0.55, swing: 0.4, side: 0 },
        { t: 0.65, swing: -1.0, side: 0.15 },
        // Hold thrust
        { t: 0.72, swing: -0.9, side: 0.1 },
        // Quick recovery
        { t: 0.85, swing: -0.3, side: 0 },
        { t: 1.00, swing: 0, side: 0 },
      ],
      body: [
        { t: 0.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
        // 1st hit: slight sway right
        { t: 0.10, px: 0.1, py: 0, pz: 0.15, rx: 0, ry: -0.15, rz: -0.05, s: 1.0 },
        { t: 0.20, px: -0.05, py: 0, pz: 0.2, rx: 0, ry: 0.1, rz: 0.03, s: 1.0 },
        // 2nd hit: sway left
        { t: 0.32, px: -0.1, py: 0, pz: 0.25, rx: 0, ry: 0.2, rz: 0.05, s: 1.0 },
        { t: 0.45, px: 0.05, py: 0, pz: 0.2, rx: 0, ry: -0.05, rz: -0.02, s: 1.0 },
        // 3rd hit: thrust forward
        { t: 0.58, px: 0, py: 0, pz: 0.5, rx: -0.1, ry: -0.1, rz: 0, s: 1.04 },
        { t: 0.68, px: 0, py: 0, pz: 0.55, rx: -0.08, ry: -0.08, rz: 0, s: 1.02 },
        // Quick backstep recovery
        { t: 0.82, px: 0, py: 0, pz: 0.15, rx: 0, ry: 0, rz: 0, s: 1.0 },
        { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
      ],
      duration: 650
    },
    dodge: {
      body: [
        { t: 0.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
        // Bloodborne quickstep: instant blink back
        { t: 0.05, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 0.95 },
        // Vanish frame - scale down fast (like a blur)
        { t: 0.12, px: 0, py: -0.1, pz: -0.3, rx: 0.05, ry: 0, rz: 0, s: 0.7 },
        // Reappear behind - instant backstep
        { t: 0.25, px: 0, py: -0.05, pz: -0.9, rx: 0.02, ry: 0.1, rz: 0, s: 0.75 },
        // Materialize
        { t: 0.40, px: 0, py: 0, pz: -0.85, rx: 0, ry: 0.05, rz: 0, s: 0.95 },
        // Ready stance
        { t: 0.60, px: 0, py: 0, pz: -0.6, rx: -0.03, ry: 0, rz: 0, s: 1.0 },
        // Slide back to position
        { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
      ],
      duration: 500
    }
  },

  // ── GARUDA: Greatsword Horizontal Sweep (Quality build) ──
  garuda: {
    attack: {
      arm: [
        { t: 0.00, swing: 0, side: 0 },
        // Pull arm far back and to the side - coiling
        { t: 0.12, swing: 0.3, side: -0.3 },
        { t: 0.25, swing: 0.6, side: -0.7 },
        // Hold the coil
        { t: 0.33, swing: 0.65, side: -0.75 },
        // EXPLOSIVE horizontal sweep - side rotation dominates
        { t: 0.40, swing: 0.2, side: -0.2 },
        { t: 0.48, swing: -0.3, side: 0.6 },
        { t: 0.55, swing: -0.5, side: 1.0 },
        // Full extension - sword at max horizontal reach
        { t: 0.62, swing: -0.4, side: 0.9 },
        // Follow through
        { t: 0.75, swing: -0.2, side: 0.5 },
        { t: 0.88, swing: -0.05, side: 0.15 },
        { t: 1.00, swing: 0, side: 0 },
      ],
      body: [
        { t: 0.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
        // Twist torso right - winding up
        { t: 0.15, px: 0, py: 0, pz: -0.1, rx: 0, ry: 0.4, rz: -0.05, s: 1.0 },
        { t: 0.30, px: 0, py: 0.03, pz: -0.1, rx: 0, ry: 0.6, rz: -0.08, s: 1.02 },
        // Explosive sweep LEFT - full torso rotation
        { t: 0.42, px: 0, py: 0.05, pz: 0.2, rx: -0.05, ry: -0.3, rz: 0.05, s: 1.05 },
        { t: 0.52, px: 0.1, py: 0.03, pz: 0.35, rx: -0.08, ry: -0.9, rz: 0.08, s: 1.08 },
        // Follow through momentum
        { t: 0.62, px: 0.08, py: 0, pz: 0.3, rx: -0.05, ry: -1.2, rz: 0.05, s: 1.04 },
        // Decelerate
        { t: 0.78, px: 0.03, py: 0, pz: 0.15, rx: 0, ry: -0.8, rz: 0.02, s: 1.01 },
        // Recovery
        { t: 0.90, px: 0, py: 0, pz: 0.05, rx: 0, ry: -0.2, rz: 0, s: 1.0 },
        { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
      ],
      duration: 900
    },
    dodge: {
      body: [
        { t: 0.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
        // Quick dash forward - aggressive sidestep through
        { t: 0.08, px: 0.1, py: -0.08, pz: 0.2, rx: 0.08, ry: -0.15, rz: -0.05, s: 0.96 },
        // Low dash through - leaning forward
        { t: 0.22, px: 0.15, py: -0.15, pz: 0.6, rx: 0.15, ry: -0.3, rz: -0.08, s: 0.92 },
        // Passing through
        { t: 0.38, px: 0.1, py: -0.12, pz: 0.8, rx: 0.1, ry: -0.2, rz: -0.05, s: 0.94 },
        // Coming out of dash
        { t: 0.55, px: 0.05, py: -0.05, pz: 0.7, rx: 0.04, ry: -0.1, rz: -0.02, s: 0.98 },
        // Stand tall
        { t: 0.75, px: 0, py: 0, pz: 0.4, rx: 0, ry: -0.03, rz: 0, s: 1.0 },
        // Return
        { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
      ],
      duration: 700
    }
  },

  // ── CALISTO: Shield Bash + Lance Thrust (Tank/Paladin) ──
  calisto: {
    attack: {
      arm: [
        // No arm distortion - body movement only
        { t: 0.00, swing: 0, side: 0 },
        { t: 1.00, swing: 0, side: 0 },
      ],
      body: [
        { t: 0.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
        // Quick sidestep right - shield stays facing forward
        { t: 0.08, px: 0.1, py: -0.05, pz: 0, rx: 0, ry: 0, rz: -0.08, s: 0.98 },
        { t: 0.20, px: 0.5, py: -0.08, pz: 0, rx: 0, ry: -0.1, rz: -0.12, s: 0.95 },
        { t: 0.35, px: 0.8, py: -0.05, pz: 0.05, rx: 0, ry: -0.15, rz: -0.1, s: 0.96 },
        // Hold position - guard up
        { t: 0.55, px: 0.75, py: 0, pz: 0, rx: 0, ry: -0.1, rz: -0.05, s: 0.98 },
        // Return to center
        { t: 0.80, px: 0.3, py: 0, pz: 0, rx: 0, ry: -0.03, rz: -0.02, s: 1.0 },
        { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
      ],
      duration: 650
    },
    dodge: {
      body: [
        { t: 0.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
        // Brace: slight crouch, turn shoulder into bash
        { t: 0.08, px: 0, py: -0.02, pz: -0.03, rx: 0.03, ry: 0.12, rz: 0, s: 1.0 },
        // BASH: whole body pushes forward (like a shoulder charge)
        { t: 0.18, px: 0, py: 0, pz: 0.12, rx: -0.04, ry: -0.08, rz: 0, s: 1.02 },
        { t: 0.25, px: 0, py: -0.01, pz: 0.18, rx: -0.05, ry: -0.12, rz: 0, s: 1.02 },
        // Settle after bash - brief pause
        { t: 0.38, px: 0, py: 0, pz: 0.12, rx: -0.02, ry: -0.05, rz: 0, s: 1.0 },
        { t: 0.46, px: 0, py: 0, pz: 0.1, rx: 0, ry: 0, rz: 0, s: 1.0 },
        // THRUST: lean forward with whole body (lance extends)
        { t: 0.55, px: 0, py: 0.01, pz: 0.15, rx: -0.03, ry: -0.05, rz: 0, s: 1.01 },
        { t: 0.65, px: 0, py: 0, pz: 0.28, rx: -0.06, ry: -0.08, rz: 0, s: 1.02 },
        // Hold thrust at full extension
        { t: 0.73, px: 0, py: 0, pz: 0.3, rx: -0.05, ry: -0.07, rz: 0, s: 1.02 },
        // Pull back smoothly - guard up
        { t: 0.85, px: 0, py: 0, pz: 0.12, rx: -0.01, ry: -0.02, rz: 0, s: 1.0 },
        { t: 0.94, px: 0, py: 0, pz: 0.03, rx: 0, ry: 0, rz: 0, s: 1.0 },
        { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
      ],
      duration: 950
    }
  },

  // ── FENIXIA: Spinning Staff Strike (Caster/Dex hybrid) ──
  fenixia: {
    attack: {
      arm: [
        { t: 0.00, swing: 0, side: 0 },
        // Lift staff up - preparing spin
        { t: 0.10, swing: 0.5, side: -0.2 },
        { t: 0.18, swing: 0.8, side: -0.4 },
        // Circular spin motion - staff goes around
        { t: 0.28, swing: 0.3, side: -0.7 },
        { t: 0.38, swing: -0.5, side: -0.3 },
        { t: 0.48, swing: -0.9, side: 0.3 },
        // Strike at bottom of arc
        { t: 0.55, swing: -1.1, side: 0.5 },
        // Continue through
        { t: 0.65, swing: -0.6, side: 0.7 },
        { t: 0.75, swing: -0.2, side: 0.4 },
        // Graceful return
        { t: 0.88, swing: -0.05, side: 0.1 },
        { t: 1.00, swing: 0, side: 0 },
      ],
      body: [
        { t: 0.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
        // Rise slightly - light on feet
        { t: 0.12, px: 0, py: 0.08, pz: 0, rx: -0.03, ry: 0.2, rz: 0, s: 1.02 },
        // Begin spin
        { t: 0.25, px: 0, py: 0.15, pz: 0.1, rx: -0.05, ry: 1.2, rz: 0.03, s: 1.04 },
        // Full spin - 180 degrees
        { t: 0.40, px: 0, py: 0.18, pz: 0.15, rx: -0.05, ry: 2.5, rz: 0.02, s: 1.06 },
        // Strike moment at 180
        { t: 0.52, px: 0, py: 0.1, pz: 0.2, rx: -0.08, ry: 3.14, rz: 0, s: 1.08 },
        // Follow through spin
        { t: 0.65, px: 0, py: 0.05, pz: 0.15, rx: -0.03, ry: 4.0, rz: 0, s: 1.04 },
        // Decelerate gracefully
        { t: 0.80, px: 0, py: 0.02, pz: 0.08, rx: 0, ry: 5.0, rz: 0, s: 1.01 },
        // Land softly
        { t: 0.92, px: 0, py: 0, pz: 0.03, rx: 0, ry: 5.8, rz: 0, s: 1.0 },
        { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 6.283, rz: 0, s: 1.0 },
      ],
      duration: 750
    },
    dodge: {
      body: [
        { t: 0.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
        // Graceful backward leap - push off
        { t: 0.08, px: 0, py: 0.05, pz: -0.1, rx: -0.05, ry: 0, rz: 0, s: 1.0 },
        // Float upward and back
        { t: 0.20, px: 0, py: 0.35, pz: -0.5, rx: -0.15, ry: 0.1, rz: 0, s: 1.02 },
        // Peak of leap - floating
        { t: 0.35, px: 0, py: 0.45, pz: -0.8, rx: -0.12, ry: 0.15, rz: 0.03, s: 1.03 },
        // Hang in air briefly (phoenix grace)
        { t: 0.50, px: 0, py: 0.4, pz: -0.9, rx: -0.1, ry: 0.1, rz: 0.02, s: 1.02 },
        // Descend elegantly
        { t: 0.65, px: 0, py: 0.2, pz: -0.8, rx: -0.05, ry: 0.05, rz: 0, s: 1.01 },
        { t: 0.80, px: 0, py: 0.05, pz: -0.5, rx: -0.02, ry: 0.02, rz: 0, s: 1.0 },
        // Land softly
        { t: 0.92, px: 0, py: -0.03, pz: -0.2, rx: 0.02, ry: 0, rz: 0, s: 0.99 },
        { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
      ],
      duration: 700
    }
  }
};

// ─── VERTEX SHADER: ARM-ONLY DEFORMATION (no body distortion) ───
const armUniforms = {
  u_armSwing: { value: 0.0 },    // Arm swing angle (forward/back)
  u_armSide: { value: 0.0 },     // Arm side swing
};

function injectBendShader(mesh) {
  const mat = mesh.material;
  if (!mat || mat._bendInjected) return;

  mat.onBeforeCompile = function(shader) {
    shader.uniforms.u_armSwing = armUniforms.u_armSwing;
    shader.uniforms.u_armSide = armUniforms.u_armSide;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>

      // Arm-only deformation: only vertices on one side + above shoulder height
      // Shoulder pivot at Y=0.2 in local coords (upper 40% of model)
      float shoulderY = 0.15;
      float armRelY = (transformed.y - shoulderY) / 0.8;
      // Only affect upper area
      float yBlend = smoothstep(0.0, 0.3, armRelY);
      // Only affect the right side (X > 0 in local coords = weapon arm)
      float xBlend = smoothstep(0.0, 0.15, transformed.x);
      // Combined: only right arm area above shoulder
      float armBlend = yBlend * xBlend;

      if (armBlend > 0.001) {
        // Pivot around shoulder point
        float pivotY = shoulderY + 0.3;
        float pivotX = 0.15;

        // Forward/back swing (rotate around X axis at shoulder)
        float swingAngle = u_armSwing * armBlend;
        float cS = cos(swingAngle);
        float sS = sin(swingAngle);
        float dy = transformed.y - pivotY;
        float dz = transformed.z;
        transformed.y = pivotY + dy * cS - dz * sS;
        transformed.z = dy * sS + dz * cS;

        // Side swing (rotate around Z axis at shoulder)
        float sideAngle = u_armSide * armBlend;
        float cA = cos(sideAngle);
        float sA = sin(sideAngle);
        float dx = transformed.x - pivotX;
        float dy2 = transformed.y - pivotY;
        transformed.x = pivotX + dx * cA - dy2 * sA;
        transformed.y = pivotY + dx * sA + dy2 * cA;
      }
      `
    );

    shader.vertexShader = 'uniform float u_armSwing;\nuniform float u_armSide;\n' + shader.vertexShader;
  };

  mat._bendInjected = true;
  mat.needsUpdate = true;
}

// Animate arm swing for attack
let armAnimRunning = false;

function animateArmSwing() {
  if (armAnimRunning) return;
  armAnimRunning = true;

  // Per-hero arm keyframes
  const heroAnim = HERO_ANIMS[currentHero.id];
  const keyframes = heroAnim ? heroAnim.attack.arm : [
    { t: 0.00, swing: 0, side: 0 },
    { t: 0.25, swing: 0.8, side: -0.3 },
    { t: 0.50, swing: -1.0, side: 0.2 },
    { t: 0.75, swing: -0.3, side: 0 },
    { t: 1.00, swing: 0, side: 0 },
  ];
  const duration = heroAnim ? heroAnim.attack.duration : 750;
  const startTime = performance.now();

  const anim = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);

    let k0 = keyframes[0], k1 = keyframes[1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (progress >= keyframes[i].t && progress <= keyframes[i+1].t) {
        k0 = keyframes[i];
        k1 = keyframes[i+1];
        break;
      }
    }

    const segP = (progress - k0.t) / (k1.t - k0.t);
    // Smooth ease
    const ease = segP < 0.5 ? 2*segP*segP : 1 - Math.pow(-2*segP+2, 2)/2;

    armUniforms.u_armSwing.value = k0.swing + (k1.swing - k0.swing) * ease;
    armUniforms.u_armSide.value = k0.side + (k1.side - k0.side) * ease;

    if (progress < 1) {
      requestAnimationFrame(anim);
    } else {
      armUniforms.u_armSwing.value = 0;
      armUniforms.u_armSide.value = 0;
      armAnimRunning = false;
    }
  };
  requestAnimationFrame(anim);
}

function processLoadedModel(gltf, heroId, sourceName) {
  const model = gltf.scene;

  // Auto-scale: fit model to roughly 3 units tall
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const targetHeight = 0.95;
  const scale = targetHeight / maxDim;
  model.scale.setScalar(scale);

  // Center the model
  const boxScaled = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  boxScaled.getCenter(center);
  model.position.x = -center.x;
  model.position.z = -center.z;
  model.position.y = -boxScaled.min.y; // Place on ground

  // Apply per-model rotation correction to normalize orientation
  const heroData = HEROES.find(h => h.id === heroId);
  if (heroData && heroData.modelRotationY) {
    model.rotation.y = heroData.modelRotationY;
  }

  // Enable shadows + inject vertex deformation shader
  model.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      injectBendShader(child);
    }
  });

  // Store animations
  let mixer = null;
  let actions = [];
  if (gltf.animations && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach(clip => {
      const action = mixer.clipAction(clip);
      actions.push({ name: clip.name, action, clip });
    });
  }

  // Cache
  loadedModels[heroId] = {
    scene: model,
    animations: gltf.animations || [],
    mixer,
    actions,
    sourceName
  };

  // If this is for the currently selected hero, display it
  if (heroId === currentHero.id) {
    displayGLBModel(heroId);
  }

  updateModelStatus('loaded',
    '\u2705 Model loaded: ' + sourceName +
    (actions.length > 0 ? ' (' + actions.length + ' animations)' : ' (no animations)')
  );
}

function displayGLBModel(heroId) {
  clearHeroGroup();

  const cached = loadedModels[heroId];
  if (!cached) return;

  // Clone the model so we can reuse the cache
  const model = cached.scene.clone();
  heroGroup.add(model);

  // Re-inject bend shader on cloned meshes (cloning doesn't preserve onBeforeCompile)
  model.traverse(child => {
    if (child.isMesh) {
      injectBendShader(child);
    }
  });

  // Reset arm uniforms
  armUniforms.u_armSwing.value = 0;
  armUniforms.u_armSide.value = 0;

  // Apply hero-specific scale override
  const hero = HEROES.find(h => h.id === heroId);
  if (hero && hero.modelScale !== 1.0) {
    model.scale.multiplyScalar(hero.modelScale);
  }

  // Setup animation mixer for the clone
  currentMixer = null;
  currentActions = [];

  if (cached.animations.length > 0) {
    currentMixer = new THREE.AnimationMixer(model);
    cached.animations.forEach(clip => {
      const action = currentMixer.clipAction(clip);
      currentActions.push({ name: clip.name, action, clip });
    });
    // Play first (idle) animation by default
    if (currentActions.length > 0) {
      currentActions[0].action.play();
    }
  }

  usingGLB = true;

  // Apply evo-based effects
  applyEvoEffects();
  updateSceneColors();
  createParticles(currentHero);
}

// ─── EVOLUTION EFFECTS (applied on top of GLB models) ───
function applyEvoEffects() {
  const e = currentEvoIndex;
  const hero = currentHero;
  const glowColor = hero.glowColor;

  // Scale increase with evolution
  const evoScale = 0.85 + e * 0.075;
  heroGroup.scale.setScalar(evoScale);

  // Aura ring removed

  // Glow point light at hero position (brighter with evo)
  if (e >= 1) {
    const evoLight = new THREE.PointLight(glowColor, 0.2 + e * 0.15, 5);
    evoLight.position.set(0, 1.5, 0);
    evoLight.name = 'evoLight';
    heroGroup.add(evoLight);
  }

  // Floating orbs removed

  // Energy pillar removed
}

// ─── FALLBACK PRIMITIVES (when no GLB available) ───
function spawnFallback() {
  clearHeroGroup();
  usingGLB = false;
  currentMixer = null;
  currentActions = [];

  const model = buildFallbackModel(currentHero, currentEvoIndex);
  heroGroup.add(model);

  applyEvoEffects();
  updateSceneColors();
  createParticles(currentHero);

  updateModelStatus('fallback',
    '\u26A0 No GLB model for' + currentHero.name +
    '. Place a <b>' + currentHero.modelFile + '</b> file in Perso Eth/ or drag it onto the scene.'
  );
}

function buildFallbackModel(hero, evo) {
  const g = new THREE.Group();
  const s = 0.7 + evo * 0.1;
  const glowC = hero.glowColor;
  const bodyMat = new THREE.MeshStandardMaterial({
    color: glowC, metalness: 0.5, roughness: 0.4, flatShading: true
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x222233, metalness: 0.7, roughness: 0.3, flatShading: true
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xF0C8A0, metalness: 0.05, roughness: 0.85
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: glowC, emissive: glowC, emissiveIntensity: 1.2,
    transparent: true, opacity: 0.8
  });

  // Legs
  [-0.2, 0.2].forEach(x => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08*s, 0.1*s, 0.8*s, 12), darkMat);
    leg.position.set(x*s, 0.4, 0); leg.castShadow = true; g.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14*s, 0.1*s, 0.2*s), darkMat);
    boot.position.set(x*s, 0.02, 0.02); boot.castShadow = true; g.add(boot);
  });

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6*s, 0.8*s, 0.35*s), bodyMat);
  torso.position.y = 1.3; torso.castShadow = true; g.add(torso);

  // Shoulders
  [-1, 1].forEach(side => {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(0.25*s, 0.15*s, 0.2*s), bodyMat);
    sh.position.set(side*0.4*s, 1.65, 0); sh.castShadow = true; g.add(sh);
    if (evo >= 3) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05*s, 0.2*s, 8), bodyMat);
      spike.position.set(side*0.5*s, 1.78, 0);
      spike.rotation.z = side * -0.5;
      g.add(spike);
    }
    // Arms
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.06*s, 0.07*s, 0.6*s, 10), skinMat);
    arm.position.set(side*0.38*s, 1.2, 0); g.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05*s, 10, 10), skinMat);
    hand.position.set(side*0.4*s, 0.85, 0); g.add(hand);
  });

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18*s, 16, 16), skinMat);
  head.position.y = 2.0; head.castShadow = true; g.add(head);

  // Eyes
  [-0.06, 0.06].forEach(x => {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.025*s, 8, 8),
      new THREE.MeshBasicMaterial({ color: glowC })
    );
    eye.position.set(x*s, 2.0, 0.15*s); g.add(eye);
  });

  // Helmet/crown (evo >= 2)
  if (evo >= 2) {
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.2*s, 12, 12, 0, Math.PI*2, 0, Math.PI*0.6),
      bodyMat
    );
    helmet.position.y = 2.05; g.add(helmet);
  }

  // Weapon glow
  if (evo >= 1) {
    const weapon = new THREE.Mesh(new THREE.CylinderGeometry(0.015*s, 0.02*s, 1.5*s, 8), darkMat);
    weapon.position.set(-0.45*s, 1.5, -0.1);
    weapon.rotation.z = 0.15;
    g.add(weapon);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06*s, 0.2*s, 8), glowMat);
    tip.position.set(-0.47*s, 2.28, -0.12);
    g.add(tip);
  }

  // Wings/cape (evo >= 3)
  if (evo >= 3) {
    [-1, 1].forEach(side => {
      for (let i = 0; i < (evo >= 4 ? 3 : 2); i++) {
        const wing = new THREE.Mesh(
          new THREE.PlaneGeometry((0.4 + i*0.2)*s, (0.6 + i*0.1)*s),
          new THREE.MeshStandardMaterial({
            color: glowC, emissive: glowC, emissiveIntensity: 0.6 - i*0.1,
            transparent: true, opacity: 0.4 - i*0.05, side: THREE.DoubleSide
          })
        );
        wing.position.set(side*(0.3+i*0.25)*s, 1.5, -0.2-i*0.08);
        wing.rotation.y = side * (0.3 + i*0.1);
        g.add(wing);
      }
    });
  }

  // Add a big "?" text indicator
  const textGeo = new THREE.PlaneGeometry(0.5, 0.5);
  const canvas2d = document.createElement('canvas');
  canvas2d.width = 128; canvas2d.height = 128;
  const ctx = canvas2d.getContext('2d');
  ctx.fillStyle = 'transparent'; ctx.fillRect(0,0,128,128);
  ctx.font = 'bold 80px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillText('GLB', 64, 50);
  ctx.font = '24px Arial';
  ctx.fillText('model required', 64, 95);
  const tex = new THREE.CanvasTexture(canvas2d);
  const label = new THREE.Mesh(textGeo, new THREE.MeshBasicMaterial({
    map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false
  }));
  label.position.set(0, 2.8, 0);
  label.name = 'glbLabel';
  g.add(label);

  return g;
}

// ─── UTILITIES ───
function clearHeroGroup() {
  while (heroGroup.children.length) {
    const child = heroGroup.children[0];
    heroGroup.remove(child);
    // Dispose geometry/materials recursively
    child.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
        else obj.material.dispose();
      }
    });
  }
  heroGroup.scale.setScalar(1);
}

function updateSceneColors() {
  const gc = currentHero.glowColor;
  heroLight.color.set(gc);
  heroLight.intensity = 0.4 + currentEvoIndex * 0.15;
  groundPlane.material.emissive.set(gc);
  groundPlane.material.emissiveIntensity = 0.04 + currentEvoIndex * 0.015;
  glowRing1.material.color.set(gc);
  glowRing2.material.color.set(gc);
}

function updateModelStatus(type, message) {
  const el = document.getElementById('modelStatus');
  el.innerHTML = message;
  el.className = 'model-status ' + type;
}

// ─── PARTICLES ───
function createParticles(hero) {
  if (particleSystem) {
    scene.remove(particleSystem);
    particleSystem.geometry.dispose();
    particleSystem.material.dispose();
  }
  const N = 300;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const c = new THREE.Color(hero.glowColor);
  for (let i = 0; i < N; i++) {
    pos[i*3] = (Math.random()-0.5)*7;
    pos[i*3+1] = Math.random()*6;
    pos[i*3+2] = (Math.random()-0.5)*7;
    const v = 0.5 + Math.random()*0.5;
    col[i*3]=c.r*v; col[i*3+1]=c.g*v; col[i*3+2]=c.b*v;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  particleSystem = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.04, vertexColors: true, transparent: true, opacity: 0.6,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(particleSystem);
}

function updateParticles(dt) {
  if (!particleSystem) return;
  const p = particleSystem.geometry.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) {
    p[i+1] += dt * (0.2 + Math.sin(i)*0.12);
    if (p[i+1] > 6) {
      p[i+1] = 0;
      p[i] = (Math.random()-0.5)*7;
      p[i+2] = (Math.random()-0.5)*7;
    }
  }
  particleSystem.geometry.attributes.position.needsUpdate = true;
  particleSystem.rotation.y += dt * 0.04;
}

// ─── SPAWN HERO ───
function spawnHero() {
  if (loadedModels[currentHero.id]) {
    displayGLBModel(currentHero.id);
  } else {
    loadGLBFromURL(currentHero.id, 'Perso Eth/' + currentHero.modelFile);
  }
}

function spawnOpponent() {
  // Load opponent model into opponentGroup
  gltfLoader.load('Perso Eth/' + opponentHero.modelFile,
    function(gltf) {
      const model = gltf.scene;
      // Auto-scale
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 0.95 / maxDim;
      model.scale.setScalar(scale);
      // Center
      const boxScaled = new THREE.Box3().setFromObject(model);
      const center = new THREE.Vector3();
      boxScaled.getCenter(center);
      model.position.x = -center.x;
      model.position.z = -center.z;
      model.position.y = -boxScaled.min.y;
      // Apply per-model rotation correction
      if (opponentHero.modelRotationY) {
        model.rotation.y = opponentHero.modelRotationY;
      }
      // Shadows
      model.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      // Clear opponent group and add model
      while (opponentGroup.children.length) opponentGroup.remove(opponentGroup.children[0]);
      opponentGroup.add(model);
      // Apply evo scale
      const evoScale = 0.85 + opponentEvoIndex * 0.075;
      opponentGroup.scale.setScalar(evoScale);
    },
    null,
    function(error) {
      console.log('No GLB model for opponent ' + opponentHero.id);
    }
  );
}

// ─── BATTLE UI ───
function renderBattleUI() {
  const pSt = getStats(currentHero, currentEvoIndex);
  const oSt = getStats(opponentHero, opponentEvoIndex);

  // Player side
  document.getElementById('playerTitle').textContent = currentHero.name;
  document.getElementById('playerSubtitle').textContent = currentHero.title;
  document.getElementById('playerStars').textContent = '\u2733'.repeat(pSt.stars);
  const pgl = document.getElementById('playerGradeLabel');
  pgl.textContent = currentHero.gradeLabel;
  pgl.className = 'grade-label ' + currentHero.gradeClass;
  document.getElementById('playerPower').textContent = pSt.power.toLocaleString();
  document.getElementById('hudPlayerName').textContent = currentHero.name;

  // Player stats grid
  renderStatsGrid('playerStats', pSt);

  // Opponent side - show only name + level in HUD and badge
  document.getElementById('hudOpponentName').textContent = opponentHero.name;
  const oppLevel = Math.floor(Math.random() * 100) + 1;
  if (document.getElementById('oppBadgeName')) {
    document.getElementById('oppBadgeName').textContent = opponentHero.name;
    document.getElementById('oppBadgeLevel').textContent = 'Lv. ' + oppLevel;
  }

  // Update gauges
  updateGauges();
}

function renderStatsGrid(elementId, st) {
  const sd = [
    {k:'hp', l:'HP', i:'\u2764', c:'#e74c3c', mx:2500000},
    {k:'atk', l:'ATK', i:'\u2694', c:'#e67e22', mx:120000},
    {k:'def', l:'DEF', i:'\uD83D\uDEE1', c:'#3498db', mx:4000},
    {k:'spd', l:'SPD', i:'\u26A1', c:'#2ecc71', mx:300},
    {k:'crit', l:'CRIT', i:'\uD83D\uDCA5', c:'#9b59b6', mx:50}
  ];
  document.getElementById(elementId).innerHTML = sd.map(s => `
    <div class="stat-item">
      <div class="stat-icon">${s.i}</div>
      <div class="stat-label">${s.l}</div>
      <div class="stat-value">${st[s.k].toLocaleString()}</div>
      <div class="stat-bar" style="width:${Math.min(100,(st[s.k]/s.mx)*100)}%;background:${s.c}"></div>
    </div>
  `).join('');
}

function updateGauges() {
  // Update gauge bars
  document.getElementById('playerGaugeBar').style.width = playerGauge + '%';
  document.getElementById('opponentGaugeBar').style.width = opponentGauge + '%';

  // Gauge full state
  const pg = document.getElementById('playerGaugeBar');
  const skillBtn = document.getElementById('skillBtn');
  if (playerGauge >= GAUGE_MAX) {
    pg.classList.add('gauge-full');
    skillBtn.disabled = false;
    skillBtn.classList.add('skill-ready');
  } else {
    pg.classList.remove('gauge-full');
    skillBtn.disabled = true;
    skillBtn.classList.remove('skill-ready');
  }

  const og = document.getElementById('opponentGaugeBar');
  if (opponentGauge >= GAUGE_MAX) {
    og.classList.add('gauge-full');
  } else {
    og.classList.remove('gauge-full');
  }
}

function addPlayerGauge(amount) {
  playerGauge = Math.min(GAUGE_MAX, playerGauge + amount);
  updateGauges();
}

// ─── ANIMATION LOOP ───
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  animTime += dt;

  // Update OrbitControls
  controls.update();

  // Update animation mixer (for GLB animations)
  if (currentMixer) {
    currentMixer.update(dt);
  }

  // Idle float (for models without animations or for fallback)
  if (heroGroup.children.length > 0) {
    const firstChild = heroGroup.children[0];

    // Idle float removed

    heroGroup.children.forEach(child => {
      if (child.name === 'glbLabel') {
        child.lookAt(camera.position);
      }
    });
  }

  updateParticles(dt);
  renderer.render(scene, camera);
}

// ─── ANIMATION TRIGGERS (for GLB models with multiple animations) ───
function playAnimation(name) {
  if (!currentMixer || currentActions.length === 0) return false;

  const target = currentActions.find(a =>
    a.name.toLowerCase().includes(name.toLowerCase())
  );

  if (target) {
    currentActions.forEach(a => a.action.fadeOut(0.3));
    target.action.reset().fadeIn(0.3).play();

    if (name !== 'idle') {
      const duration = target.clip.duration;
      setTimeout(() => {
        const idle = currentActions.find(a =>
          a.name.toLowerCase().includes('idle') ||
          a.name.toLowerCase().includes('stand') ||
          a.name.toLowerCase().includes('breath')
        ) || currentActions[0];
        if (idle) {
          currentActions.forEach(a => a.action.fadeOut(0.3));
          idle.action.reset().fadeIn(0.3).play();
        }
      }, duration * 1000);
    }
    return true;
  }
  return false;
}

// ─── SCREEN FX HELPERS ───
function triggerScreenFlash(type) {
  const el = document.getElementById('screenFlash');
  el.className = 'screen-flash';
  void el.offsetWidth; // force reflow
  el.classList.add('active', type);
  setTimeout(() => { el.className = 'screen-flash'; }, 600);
}

function triggerCameraShake() {
  const cont = document.querySelector('.scene-container');
  cont.classList.remove('shaking');
  void cont.offsetWidth;
  cont.classList.add('shaking');
  setTimeout(() => cont.classList.remove('shaking'), 450);
}

function triggerVignette(duration) {
  const v = document.getElementById('screenVignette');
  v.classList.add('active');
  setTimeout(() => v.classList.remove('active'), duration || 800);
}

function setActiveButton(btnId) {
  document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active-action'));
  if (btnId) document.getElementById(btnId).classList.add('active-action');
}

// ─── 3D VISUAL EFFECTS ───
let effectObjects = []; // track temporary 3D effect objects

function clearEffects() {
  effectObjects.forEach(obj => {
    scene.remove(obj);
    obj.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material.dispose();
      }
    });
  });
  effectObjects = [];
}

function createSlashEffect() {
  const color = currentHero.glowColor;
  const group = new THREE.Group();

  // Create 3 slash arcs
  for (let i = 0; i < 3; i++) {
    const curve = new THREE.EllipseCurve(0, 0, 1.5, 2.0, -0.8 + i * 0.3, 1.2 + i * 0.2, false, 0);
    const points = curve.getPoints(32);
    const geo = new THREE.BufferGeometry().setFromPoints(
      points.map(p => new THREE.Vector3(p.x, p.y + 1.2, 0.5))
    );
    const mat = new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: 0.9,
      linewidth: 2
    });
    const line = new THREE.Line(geo, mat);
    line.rotation.y = i * 0.2 - 0.2;
    group.add(line);
  }

  // Add impact sphere
  const impactGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const impactMat = new THREE.MeshBasicMaterial({
    color: color, transparent: true, opacity: 0.8
  });
  const impact = new THREE.Mesh(impactGeo, impactMat);
  impact.position.set(0, 1.5, 1.2);
  group.add(impact);

  scene.add(group);
  effectObjects.push(group);

  // Animate slash
  let t = 0;
  const anim = () => {
    t += 0.05;
    group.children.forEach((child, idx) => {
      if (child.isLine) {
        child.material.opacity = Math.max(0, 0.9 - t * 1.5);
        child.scale.setScalar(1 + t * 0.5);
      } else {
        child.material.opacity = Math.max(0, 0.8 - t * 2);
        child.scale.setScalar(1 + t * 3);
      }
    });
    if (t < 1) requestAnimationFrame(anim);
    else { scene.remove(group); effectObjects = effectObjects.filter(o => o !== group); }
  };
  requestAnimationFrame(anim);
}

function createBurstParticles(color, count, speed) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i*3] = 0; pos[i*3+1] = 1.5; pos[i*3+2] = 0;
    vel[i*3] = (Math.random()-0.5) * speed;
    vel[i*3+1] = Math.random() * speed * 0.8;
    vel[i*3+2] = (Math.random()-0.5) * speed;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    color: color, size: 0.08, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const particles = new THREE.Points(geo, mat);
  scene.add(particles);
  effectObjects.push(particles);

  let t = 0;
  const anim = () => {
    t += 0.016;
    const p = particles.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      p[i*3] += vel[i*3] * 0.016 * 60;
      p[i*3+1] += vel[i*3+1] * 0.016 * 60 - t * 2;
      p[i*3+2] += vel[i*3+2] * 0.016 * 60;
    }
    particles.geometry.attributes.position.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - t * 1.5);
    if (t < 1) requestAnimationFrame(anim);
    else { scene.remove(particles); effectObjects = effectObjects.filter(o => o !== particles); }
  };
  requestAnimationFrame(anim);
}

function createMagicCircle(color) {
  const group = new THREE.Group();

  // Outer ring
  const ring1 = new THREE.Mesh(
    new THREE.TorusGeometry(2.0, 0.04, 8, 64),
    new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 })
  );
  ring1.rotation.x = -Math.PI / 2;
  ring1.position.y = 0.1;
  group.add(ring1);

  // Inner ring
  const ring2 = new THREE.Mesh(
    new THREE.TorusGeometry(1.4, 0.03, 8, 64),
    new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.6 })
  );
  ring2.rotation.x = -Math.PI / 2;
  ring2.position.y = 0.1;
  group.add(ring2);

  // Rune symbols (small spheres around the circle)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const rune = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.08, 0),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.9 })
    );
    rune.position.set(Math.sin(angle) * 1.7, 0.15, Math.cos(angle) * 1.7);
    group.add(rune);
  }

  scene.add(group);
  effectObjects.push(group);

  // Animate: spin, rise, fade
  let t = 0;
  const anim = () => {
    t += 0.012;
    group.rotation.y += 0.03;
    group.position.y = t * 3;
    group.children.forEach(c => {
      c.material.opacity = Math.max(0, (c === ring1 ? 0.8 : 0.6) * (1 - t));
    });
    group.scale.setScalar(1 + t * 0.5);
    if (t < 1.5) requestAnimationFrame(anim);
    else { scene.remove(group); effectObjects = effectObjects.filter(o => o !== group); }
  };
  requestAnimationFrame(anim);
}

function createEnergyPillar(color) {
  const geo = new THREE.CylinderGeometry(0.1, 0.8, 8, 16, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color: color, transparent: true, opacity: 0.4,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending
  });
  const pillar = new THREE.Mesh(geo, mat);
  pillar.position.y = 4;
  scene.add(pillar);
  effectObjects.push(pillar);

  let t = 0;
  const anim = () => {
    t += 0.015;
    pillar.material.opacity = Math.max(0, 0.5 * Math.sin(t * Math.PI));
    pillar.scale.x = 1 + Math.sin(t * 8) * 0.1;
    pillar.scale.z = 1 + Math.cos(t * 8) * 0.1;
    pillar.rotation.y += 0.02;
    if (t < 1) requestAnimationFrame(anim);
    else { scene.remove(pillar); effectObjects = effectObjects.filter(o => o !== pillar); }
  };
  requestAnimationFrame(anim);
}

function createSpiralParticles(color) {
  const N = 120;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos[i*3] = 0; pos[i*3+1] = 0.1; pos[i*3+2] = 0;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: color, size: 0.06, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  effectObjects.push(pts);

  let t = 0;
  const anim = () => {
    t += 0.016;
    const p = pts.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const progress = (t * 2 + i / N) % 1;
      const angle = progress * Math.PI * 6 + i * 0.5;
      const radius = progress * 2.5;
      const height = progress * 5;
      p[i*3] = Math.sin(angle) * radius;
      p[i*3+1] = height;
      p[i*3+2] = Math.cos(angle) * radius;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    mat.opacity = Math.max(0, 0.9 - t * 0.6);
    if (t < 1.8) requestAnimationFrame(anim);
    else { scene.remove(pts); effectObjects = effectObjects.filter(o => o !== pts); }
  };
  requestAnimationFrame(anim);
}

function createEvolutionBurst(color) {
  // Expanding energy sphere
  const sphereGeo = new THREE.SphereGeometry(0.1, 32, 32);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0.8,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending
  });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  sphere.position.y = 1.5;
  scene.add(sphere);
  effectObjects.push(sphere);

  // Concentric ground rings
  const rings = [];
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.03, 8, 64),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.05;
    scene.add(ring);
    effectObjects.push(ring);
    rings.push({ mesh: ring, delay: i * 0.1 });
  }

  let t = 0;
  const anim = () => {
    t += 0.012;
    // Sphere expands and fades
    sphere.scale.setScalar(1 + t * 20);
    sphereMat.opacity = Math.max(0, 0.8 - t * 2);
    // Rings expand outward
    rings.forEach(r => {
      const rt = Math.max(0, t - r.delay);
      const scale = 1 + rt * 30;
      r.mesh.scale.setScalar(scale);
      r.mesh.material.opacity = Math.max(0, 0.7 - rt * 2);
    });
    if (t < 1.2) requestAnimationFrame(anim);
    else {
      scene.remove(sphere);
      rings.forEach(r => scene.remove(r.mesh));
      effectObjects = effectObjects.filter(o => o !== sphere && !rings.some(r => r.mesh === o));
    }
  };
  requestAnimationFrame(anim);
}

// ─── WEAPON TRAIL ARC (SoulCalibur style slash arc) ───
function createWeaponTrail(color) {
  const group = new THREE.Group();

  // Create a curved slash trail - like a glowing weapon arc
  const trailPoints = [];
  const segments = 40;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // Big sweeping arc from upper-right to lower-left
    const angle = -0.8 + t * 2.5;
    const radius = 1.5 + Math.sin(t * Math.PI) * 0.8;
    const x = Math.sin(angle) * radius;
    const y = 1.2 + Math.cos(angle) * radius * 0.6;
    const z = 0.3 + Math.sin(t * Math.PI) * 0.8;
    trailPoints.push(new THREE.Vector3(x, y, z));
  }

  // Main trail - thick glowing ribbon
  for (let w = 0; w < 3; w++) {
    const offset = (w - 1) * 0.08;
    const curvePoints = trailPoints.map(p =>
      new THREE.Vector3(p.x, p.y + offset, p.z + offset * 0.5)
    );
    const geo = new THREE.BufferGeometry().setFromPoints(curvePoints);
    const mat = new THREE.LineBasicMaterial({
      color: w === 1 ? 0xffffff : color,
      transparent: true,
      opacity: w === 1 ? 0.95 : 0.6,
      linewidth: 2,
      blending: THREE.AdditiveBlending
    });
    const line = new THREE.Line(geo, mat);
    group.add(line);
  }

  // Add glow particles along the trail
  const glowN = 25;
  const glowGeo = new THREE.BufferGeometry();
  const glowPos = new Float32Array(glowN * 3);
  for (let i = 0; i < glowN; i++) {
    const t = i / glowN;
    const idx = Math.floor(t * (trailPoints.length - 1));
    const p = trailPoints[idx];
    glowPos[i*3] = p.x + (Math.random()-0.5)*0.15;
    glowPos[i*3+1] = p.y + (Math.random()-0.5)*0.15;
    glowPos[i*3+2] = p.z + (Math.random()-0.5)*0.15;
  }
  glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3));
  const glowMat = new THREE.PointsMaterial({
    color: color, size: 0.1, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const glowPts = new THREE.Points(glowGeo, glowMat);
  group.add(glowPts);

  scene.add(group);
  effectObjects.push(group);

  // Animate: appear with the slash then fade
  let t = 0;
  const anim = () => {
    t += 0.025;
    group.children.forEach(child => {
      if (child.material) {
        child.material.opacity = Math.max(0, child.material.opacity * 0.92);
      }
    });
    group.rotation.y += 0.01;
    if (t < 0.8) requestAnimationFrame(anim);
    else {
      scene.remove(group);
      effectObjects = effectObjects.filter(o => o !== group);
    }
  };
  // Delay appearance to sync with weapon swing peak
  setTimeout(() => requestAnimationFrame(anim), 120);
}

// ─── IMPACT SPARKS (SoulCalibur hit sparks) ───
function createImpactSparks(color, position) {
  const N = 60;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  const px = position ? position.x : 0;
  const py = position ? position.y : 1.8;
  const pz = position ? position.z : 0.8;

  for (let i = 0; i < N; i++) {
    pos[i*3] = px;
    pos[i*3+1] = py;
    pos[i*3+2] = pz;
    // Sparks fly outward in a cone from impact point
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.05 + Math.random() * 0.15;
    vel[i*3] = Math.cos(angle) * speed;
    vel[i*3+1] = Math.random() * 0.12;
    vel[i*3+2] = Math.sin(angle) * speed * 0.5 + 0.05;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xFFDD44, size: 0.05, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const sparks = new THREE.Points(geo, mat);
  scene.add(sparks);
  effectObjects.push(sparks);

  // Impact flash light
  const flashLight = new THREE.PointLight(color, 3, 8);
  flashLight.position.set(px, py, pz);
  scene.add(flashLight);
  effectObjects.push(flashLight);

  let t = 0;
  const anim = () => {
    t += 0.02;
    const p = sparks.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      p[i*3] += vel[i*3];
      p[i*3+1] += vel[i*3+1] - t * 0.08;
      p[i*3+2] += vel[i*3+2];
      // Slow down
      vel[i*3] *= 0.96;
      vel[i*3+1] *= 0.96;
      vel[i*3+2] *= 0.96;
    }
    sparks.geometry.attributes.position.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - t * 2);
    mat.size = 0.05 + t * 0.03;
    flashLight.intensity = Math.max(0, 3 - t * 8);
    if (t < 0.7) requestAnimationFrame(anim);
    else {
      scene.remove(sparks);
      scene.remove(flashLight);
      effectObjects = effectObjects.filter(o => o !== sparks && o !== flashLight);
    }
  };
  requestAnimationFrame(anim);
}

function createGroundShockwave(color) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.1, 0.3, 64),
    new THREE.MeshBasicMaterial({
      color: color, transparent: true, opacity: 0.8,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  scene.add(ring);
  effectObjects.push(ring);

  let t = 0;
  const anim = () => {
    t += 0.02;
    ring.scale.setScalar(1 + t * 15);
    ring.material.opacity = Math.max(0, 0.8 - t * 1.5);
    if (t < 0.8) requestAnimationFrame(anim);
    else { scene.remove(ring); effectObjects = effectObjects.filter(o => o !== ring); }
  };
  requestAnimationFrame(anim);
}

// Add ground slam effect for skill landing
function createGroundSlam(color) {
  // Multiple debris-like particles shooting up from ground
  const N = 40;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.5;
    pos[i*3] = Math.cos(angle) * r;
    pos[i*3+1] = 0.1;
    pos[i*3+2] = Math.sin(angle) * r;
    vel[i*3] = Math.cos(angle) * 0.05;
    vel[i*3+1] = 0.1 + Math.random() * 0.15;
    vel[i*3+2] = Math.sin(angle) * 0.05;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: color, size: 0.1, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  effectObjects.push(pts);

  let t = 0;
  const anim = () => {
    t += 0.016;
    const p = pts.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      p[i*3] += vel[i*3];
      p[i*3+1] += vel[i*3+1] - t * 0.15; // gravity
      p[i*3+2] += vel[i*3+2];
    }
    pts.geometry.attributes.position.needsUpdate = true;
    mat.opacity = Math.max(0, 1 - t * 1.2);
    if (t < 1) requestAnimationFrame(anim);
    else { scene.remove(pts); effectObjects = effectObjects.filter(o => o !== pts); }
  };
  requestAnimationFrame(anim);
}

// ─── HERO MODEL COMBAT ANIMATIONS ───
let combatAnimRunning = false;

function attackAnimation() {
  if (heroGroup.children.length === 0 || combatAnimRunning) return;
  combatAnimRunning = true;

  const origPos = heroGroup.position.clone();
  const origRot = heroGroup.rotation.clone();
  const origScale = heroGroup.scale.clone();

  // Per-hero attack body keyframes
  const heroAnim = HERO_ANIMS[currentHero.id];
  const keyframes = heroAnim ? heroAnim.attack.body : [
    { t: 0.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
    { t: 0.30, px: 0, py: 0, pz: 0.4, rx: -0.1, ry: -0.3, rz: 0, s: 1.05 },
    { t: 0.60, px: 0, py: 0, pz: 0.2, rx: -0.05, ry: -0.1, rz: 0, s: 1.0 },
    { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
  ];
  const duration = heroAnim ? heroAnim.attack.duration : 850;
  const startTime = performance.now();

  const anim = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);

    // Find current keyframe pair
    let k0 = keyframes[0], k1 = keyframes[1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (progress >= keyframes[i].t && progress <= keyframes[i+1].t) {
        k0 = keyframes[i];
        k1 = keyframes[i+1];
        break;
      }
    }

    // Interpolate
    const segProgress = (progress - k0.t) / (k1.t - k0.t);
    const ease = segProgress < 0.5
      ? 2 * segProgress * segProgress
      : 1 - Math.pow(-2 * segProgress + 2, 2) / 2; // ease-in-out quad

    heroGroup.position.set(
      origPos.x + k0.px + (k1.px - k0.px) * ease,
      origPos.y + k0.py + (k1.py - k0.py) * ease,
      origPos.z + k0.pz + (k1.pz - k0.pz) * ease
    );
    heroGroup.rotation.set(
      origRot.x + k0.rx + (k1.rx - k0.rx) * ease,
      origRot.y + k0.ry + (k1.ry - k0.ry) * ease,
      origRot.z + k0.rz + (k1.rz - k0.rz) * ease
    );
    const sc = k0.s + (k1.s - k0.s) * ease;
    heroGroup.scale.copy(origScale).multiplyScalar(sc);

    if (progress < 1) {
      requestAnimationFrame(anim);
    } else {
      heroGroup.position.copy(origPos);
      heroGroup.rotation.copy(origRot);
      heroGroup.scale.copy(origScale);
      combatAnimRunning = false;
    }
  };
  requestAnimationFrame(anim);
}

function skillAnimation() {
  if (heroGroup.children.length === 0 || combatAnimRunning) return;
  combatAnimRunning = true;

  const origPos = heroGroup.position.clone();
  const origRot = heroGroup.rotation.clone();
  const origScale = heroGroup.scale.clone();

  // Skill sequence: channel energy -> levitate -> power burst -> descend
  const keyframes = [
    // Start: crouch down, gathering energy
    { t: 0.00, px: 0, py: 0, pz: 0, rx: 0.1, ry: 0, rz: 0, s: 0.95 },
    // Crouch more + slight spin
    { t: 0.15, px: 0, py: -0.1, pz: 0, rx: 0.2, ry: 0.3, rz: 0, s: 0.9 },
    // Launch upward! Arms up feeling
    { t: 0.30, px: 0, py: 0.6, pz: 0, rx: -0.15, ry: 0.8, rz: 0, s: 1.15 },
    // Peak - hovering, spinning slowly
    { t: 0.50, px: 0, py: 0.8, pz: 0, rx: -0.1, ry: 2.0, rz: 0.05, s: 1.2 },
    // Power release - expand
    { t: 0.60, px: 0, py: 0.7, pz: 0, rx: -0.2, ry: 3.5, rz: 0, s: 1.3 },
    // Descend with authority
    { t: 0.75, px: 0, py: 0.2, pz: 0.1, rx: 0.05, ry: 5.0, rz: 0, s: 1.1 },
    // Ground slam
    { t: 0.85, px: 0, py: -0.05, pz: 0.05, rx: 0.15, ry: 5.8, rz: 0, s: 0.95 },
    // Recover
    { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 6.283, rz: 0, s: 1.0 },
  ];

  const duration = 1500; // ms
  const startTime = performance.now();

  const anim = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);

    let k0 = keyframes[0], k1 = keyframes[1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (progress >= keyframes[i].t && progress <= keyframes[i+1].t) {
        k0 = keyframes[i];
        k1 = keyframes[i+1];
        break;
      }
    }

    const segProgress = (progress - k0.t) / (k1.t - k0.t);
    const ease = segProgress < 0.5
      ? 2 * segProgress * segProgress
      : 1 - Math.pow(-2 * segProgress + 2, 2) / 2;

    heroGroup.position.set(
      origPos.x + k0.px + (k1.px - k0.px) * ease,
      origPos.y + k0.py + (k1.py - k0.py) * ease,
      origPos.z + k0.pz + (k1.pz - k0.pz) * ease
    );
    heroGroup.rotation.set(
      origRot.x + k0.rx + (k1.rx - k0.rx) * ease,
      origRot.y + k0.ry + (k1.ry - k0.ry) * ease,
      origRot.z + k0.rz + (k1.rz - k0.rz) * ease
    );
    const sc = k0.s + (k1.s - k0.s) * ease;
    heroGroup.scale.copy(origScale).multiplyScalar(sc);

    if (progress < 1) {
      requestAnimationFrame(anim);
    } else {
      heroGroup.position.copy(origPos);
      heroGroup.rotation.copy(origRot);
      heroGroup.scale.copy(origScale);
      combatAnimRunning = false;
    }
  };
  requestAnimationFrame(anim);
}

function dodgeAnimation() {
  if (heroGroup.children.length === 0 || combatAnimRunning) return;
  combatAnimRunning = true;

  const origPos = heroGroup.position.clone();
  const origRot = heroGroup.rotation.clone();
  const origScale = heroGroup.scale.clone();

  // Per-hero dodge keyframes
  const heroAnim = HERO_ANIMS[currentHero.id];
  const keyframes = heroAnim ? heroAnim.dodge.body : [
    { t: 0.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
    { t: 0.25, px: 0, py: -0.4, pz: -0.6, rx: 0.2, ry: 0, rz: 0, s: 0.88 },
    { t: 0.50, px: 0, py: -0.3, pz: -0.5, rx: 0.15, ry: 0, rz: 0, s: 0.9 },
    { t: 1.00, px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, s: 1.0 },
  ];
  const duration = heroAnim ? heroAnim.dodge.duration : 800;
  const startTime = performance.now();

  const anim = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);

    let k0 = keyframes[0], k1 = keyframes[1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (progress >= keyframes[i].t && progress <= keyframes[i+1].t) {
        k0 = keyframes[i];
        k1 = keyframes[i+1];
        break;
      }
    }

    const segProgress = (progress - k0.t) / (k1.t - k0.t);
    const ease = segProgress < 0.5
      ? 2 * segProgress * segProgress
      : 1 - Math.pow(-2 * segProgress + 2, 2) / 2;

    heroGroup.position.set(
      origPos.x + k0.px + (k1.px - k0.px) * ease,
      origPos.y + k0.py + (k1.py - k0.py) * ease,
      origPos.z + k0.pz + (k1.pz - k0.pz) * ease
    );
    heroGroup.rotation.set(
      origRot.x + k0.rx + (k1.rx - k0.rx) * ease,
      origRot.y + k0.ry + (k1.ry - k0.ry) * ease,
      origRot.z + k0.rz + (k1.rz - k0.rz) * ease
    );
    const sc = k0.s + (k1.s - k0.s) * ease;
    heroGroup.scale.copy(origScale).multiplyScalar(sc);

    if (progress < 1) {
      requestAnimationFrame(anim);
    } else {
      heroGroup.position.copy(origPos);
      heroGroup.rotation.copy(origRot);
      heroGroup.scale.copy(origScale);
      combatAnimRunning = false;
    }
  };
  requestAnimationFrame(anim);
}

function idleBreathAnimation() {
  // Gentle floating breath-like animation
  if (heroGroup.children.length === 0) return;
  const origY = heroGroup.position.y;
  const origScale = heroGroup.scale.clone();
  let t = 0;
  const duration = 2000;
  const startTime = performance.now();

  const anim = (now) => {
    const elapsed = now - startTime;
    const progress = elapsed / duration;
    // Gentle sine bob
    heroGroup.position.y = origY + Math.sin(progress * Math.PI * 2) * 0.05;
    const breathScale = 1 + Math.sin(progress * Math.PI * 2) * 0.015;
    heroGroup.scale.copy(origScale).multiplyScalar(breathScale);
    if (progress < 1) requestAnimationFrame(anim);
    else {
      heroGroup.position.y = origY;
      heroGroup.scale.copy(origScale);
    }
  };
  requestAnimationFrame(anim);
}

// ─── HERO SCALE BOUNCE (for evolution) ───
function bounceScale(target, duration) {
  const origScale = heroGroup.scale.clone();
  let t = 0;
  const anim = () => {
    t += 0.016;
    const progress = t / (duration / 1000);
    if (progress < 0.3) {
      // Shrink
      const s = 1 - progress * 1.5;
      heroGroup.scale.copy(origScale).multiplyScalar(Math.max(0.3, s));
    } else if (progress < 0.6) {
      // Expand beyond target
      const s = 0.55 + (progress - 0.3) * 5;
      heroGroup.scale.copy(origScale).multiplyScalar(Math.min(1.3, s) * target);
    } else if (progress < 1) {
      // Settle to target
      const s = 1.3 - (progress - 0.6) * 0.75;
      heroGroup.scale.copy(origScale).multiplyScalar(s * target);
    }
    if (progress < 1) requestAnimationFrame(anim);
    else heroGroup.scale.copy(origScale).multiplyScalar(target);
  };
  requestAnimationFrame(anim);
}

// ─── ANIMATED STAT COUNTER ───
function animateStatCounters() {
  const statValues = document.querySelectorAll('.stat-value');
  statValues.forEach(el => {
    const target = parseInt(el.textContent.replace(/\s/g, '').replace(/,/g, ''));
    if (isNaN(target)) return;
    el.classList.add('counting');
    const start = Math.round(target * 0.5);
    const duration = 800;
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = Math.round(start + (target - start) * eased);
      el.textContent = current.toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
      else {
        el.textContent = target.toLocaleString();
        setTimeout(() => el.classList.remove('counting'), 300);
      }
    };
    requestAnimationFrame(tick);
  });

  // Animate power value too
  const powerEl = document.getElementById('powerValue');
  const powerTarget = parseInt(powerEl.textContent.replace(/\s/g, '').replace(/,/g, ''));
  if (!isNaN(powerTarget)) {
    const powerStart = Math.round(powerTarget * 0.4);
    const startTime = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / 1000);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(powerStart + (powerTarget - powerStart) * eased);
      powerEl.textContent = current.toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
      else powerEl.textContent = powerTarget.toLocaleString();
    };
    requestAnimationFrame(tick);
  }
}

// ─── STATS & UI ───
function getStats(hero, idx) {
  const ev = hero.evolutions[idx], m = ev.mult;
  return {
    hp: Math.round(hero.baseStats.hp*m),
    atk: Math.round(hero.baseStats.atk*m),
    def: Math.round(hero.baseStats.def*m),
    spd: Math.round(hero.baseStats.spd*m),
    crit: Math.round(hero.baseStats.crit*m),
    power: Math.round(hero.basePower*m),
    level: ev.level, stars: ev.stars, name: ev.name
  };
}

function renderUI() {
  // Redirect to battle UI in 1v1 mode
  renderBattleUI();
  return;
  const st = getStats(currentHero, currentEvoIndex);
  const ev = currentHero.evolutions[currentEvoIndex];

  document.getElementById('heroTitle').textContent = currentHero.name;
  document.getElementById('heroSubtitle').textContent = currentHero.title;
  document.getElementById('gradeStars').textContent = '\u2733'.repeat(ev.stars);
  const gl = document.getElementById('gradeLabel');
  gl.textContent = currentHero.gradeLabel;
  gl.className = 'grade-label ' + currentHero.gradeClass;
  document.getElementById('powerValue').textContent = st.power.toLocaleString();
  document.getElementById('levelBadge').textContent = 'Lv. ' + st.level;

  const sd = [
    {k:'hp', l:'HP', i:'\u2764', c:'#e74c3c', mx:2500000},
    {k:'atk', l:'ATK', i:'\u2694', c:'#e67e22', mx:120000},
    {k:'def', l:'DEF', i:'\uD83D\uDEE1', c:'#3498db', mx:4000},
    {k:'spd', l:'SPD', i:'\u26A1', c:'#2ecc71', mx:300},
    {k:'crit', l:'CRIT', i:'\uD83D\uDCA5', c:'#9b59b6', mx:50}
  ];

  document.getElementById('statsGrid').innerHTML = sd.map(s => `
    <div class="stat-item">
      <div class="stat-icon">${s.i}</div>
      <div class="stat-label">${s.l}</div>
      <div class="stat-value">${st[s.k].toLocaleString()}</div>
      <div class="stat-bar" style="width:${Math.min(100,(st[s.k]/s.mx)*100)}%;background:${s.c}"></div>
    </div>
  `).join('');

  document.getElementById('evoButtons').innerHTML = currentHero.evolutions.map((ev, i) => `
    <button class="evo-btn ${i===currentEvoIndex?'active':''}" data-evo="${i}">
      <span class="evo-level">Lv.${ev.level}</span>${ev.name}
    </button>
  `).join('');

  document.querySelectorAll('.evo-btn').forEach(b => b.addEventListener('click', () => {
    const newIdx = parseInt(b.dataset.evo);
    if (newIdx === currentEvoIndex) return;
    const goingUp = newIdx > currentEvoIndex;
    currentEvoIndex = newIdx;

    if (goingUp) {
      triggerScreenFlash('evo');
      createBurstParticles(currentHero.glowColor, 60, 0.1);
    }

    spawnHero();
    renderUI();
    animateStatCounters();
  }));

  renderRoster();
}

function renderRoster() {
  const ec = {earth:'#FF6B35', shadow:'#9B59B6', light:'#F1C40F', ice:'#3498DB', fire:'#FF8C00'};
  const ei = {earth:'\uD83D\uDC3B', shadow:'\uD83D\uDDE1\uFE0F', light:'\u2694\uFE0F', ice:'\u2744\uFE0F', fire:'\uD83D\uDD25'};

  document.getElementById('roster').innerHTML = HEROES.map(h => {
    const me = h.evolutions[h.evolutions.length-1];
    const hasModel = !!loadedModels[h.id];
    return `
      <div class="roster-card ${h.id===currentHero.id?'active':''}" data-id="${h.id}">
        <div class="roster-thumb">
          <div style="width:100%;height:100%;background:linear-gradient(135deg,${ec[h.element]}33,${ec[h.element]}11);display:flex;align-items:center;justify-content:center;font-size:28px;position:relative;">
            ${ei[h.element]}
            ${hasModel ? '<div style="position:absolute;bottom:2px;right:2px;width:10px;height:10px;background:#2ecc71;border-radius:50%;border:1px solid #000;"></div>' : ''}
          </div>
          <div class="element-dot" style="background:${ec[h.element]}"></div>
        </div>
        <div class="roster-info">
          <div class="roster-name">${h.name}</div>
          <div class="roster-class">${h.title}</div>
          <div class="roster-stars">${'\u2733'.repeat(me.stars)}</div>
          <div class="roster-power">\u2694 ${h.basePower.toLocaleString()}</div>
        </div>
      </div>`;
  }).join('');

  document.querySelectorAll('.roster-card').forEach(c => c.addEventListener('click', () => {
    const newHero = HEROES.find(h => h.id === c.dataset.id);
    if (newHero === currentHero) return;

    // Flash transition on canvas
    const centerScene = document.querySelector('.center-scene');
    centerScene.classList.add('hero-switching');
    triggerScreenFlash('evo');

    setTimeout(() => {
      // Reset skill buff when switching hero
      if (skillBuffActive) { skillBuffActive = false; skillRoundsLeft = 0; }
      currentHero = newHero;
      currentEvoIndex = currentHero.evolutions.length - 1;
      spawnHero();
      renderUI();
      updateSkillButton();
      animateStatCounters();
      centerScene.classList.remove('hero-switching');
    }, 250);
  }));
}

// ─── BUTTONS ───
let actionCooldown = false;

// evolveBtn removed in battle mode

document.getElementById('attackBtn').addEventListener('click', () => {
  if (actionCooldown) return;
  const atkDur = HERO_ANIMS[currentHero.id] ? HERO_ANIMS[currentHero.id].attack.duration + 200 : 1200;
  actionCooldown = true;
  setTimeout(() => { actionCooldown = false; }, atkDur);

  setActiveButton('attackBtn');
  animState = 'attack'; animTime = 0;

  // Try GLB animation
  if (usingGLB) playAnimation('attack');

  // Per-hero arm swing + body movement
  animateArmSwing();
  attackAnimation();

  // Weapon trail arc at swing moment
  setTimeout(() => {
    createWeaponTrail(currentHero.glowColor);
    triggerScreenFlash('attack');
  }, 200);

  // Impact sparks at hit moment
  setTimeout(() => {
    createImpactSparks(currentHero.glowColor);
    createGroundShockwave(currentHero.glowColor);
    triggerCameraShake();
  }, 300);

  // Fill skill gauge on successful hit
  setTimeout(() => {
    addPlayerGauge(GAUGE_PER_HIT);
    // Opponent gauge also fills (simulated)
    opponentGauge = Math.min(GAUGE_MAX, opponentGauge + Math.floor(Math.random() * 15) + 5);
    updateGauges();
    tickSkillRound();
  }, 500);

  // Pause auto-rotate during action
  setTimeout(() => {
    setActiveButton(null);
    animState = 'idle';
  }, atkDur);
});

// ─── SKILL: SIZE BUFF (grow bigger + stats boost for 2 rounds) ───
let skillBuffActive = false;
let skillRoundsLeft = 0;
const SKILL_BUFF_SCALE = 1.5;
const SKILL_BUFF_STAT_MULT = 1.4;

function activateSkillBuff() {
  if (skillBuffActive) return;
  skillBuffActive = true;
  skillRoundsLeft = 2;

  // Grow animation: smooth scale up
  const origScale = heroGroup.scale.clone();
  const targetScale = SKILL_BUFF_SCALE;
  const startTime = performance.now();

  const growAnim = (now) => {
    const progress = Math.min(1, (now - startTime) / 800);
    const ease = 1 - Math.pow(1 - progress, 3);
    const s = 1 + (targetScale - 1) * ease;
    heroGroup.scale.copy(origScale).multiplyScalar(s);
    if (progress < 1) requestAnimationFrame(growAnim);
  };
  requestAnimationFrame(growAnim);

  // Boost stats display
  updateBuffedStats(true);

  // Update button to show rounds left
  updateSkillButton();
}

function deactivateSkillBuff() {
  if (!skillBuffActive) return;
  skillBuffActive = false;
  skillRoundsLeft = 0;

  // Shrink back animation
  const currentScale = heroGroup.scale.clone();
  const startTime = performance.now();

  const shrinkAnim = (now) => {
    const progress = Math.min(1, (now - startTime) / 600);
    const ease = 1 - Math.pow(1 - progress, 3);
    const evoScale = 0.85 + currentEvoIndex * 0.075;
    const s = (currentScale.x / evoScale) + (1 - (currentScale.x / evoScale)) * ease;
    heroGroup.scale.setScalar(evoScale * s);
    if (progress < 1) requestAnimationFrame(shrinkAnim);
    else heroGroup.scale.setScalar(evoScale);
  };
  requestAnimationFrame(shrinkAnim);

  // Restore normal stats
  updateBuffedStats(false);
  updateSkillButton();

  // Visual feedback
  triggerScreenFlash('skill');
  createBurstParticles(0x88AACC, 40, 0.06);
}

function updateBuffedStats(buffed) {
  const st = getStats(currentHero, currentEvoIndex);
  if (buffed) {
    // Apply buff multiplier
    st.hp = Math.round(st.hp * SKILL_BUFF_STAT_MULT);
    st.atk = Math.round(st.atk * SKILL_BUFF_STAT_MULT);
    st.def = Math.round(st.def * SKILL_BUFF_STAT_MULT);
    st.power = Math.round(st.power * SKILL_BUFF_STAT_MULT);
  }

  // Update stat displays with animation
  document.getElementById('powerValue').textContent = st.power.toLocaleString();
  const statEls = document.querySelectorAll('.stat-value');
  const vals = [st.hp, st.atk, st.def, st.spd, st.crit];
  statEls.forEach((el, i) => {
    if (i < vals.length) el.textContent = vals[i].toLocaleString();
  });

  // Color the stats when buffed
  statEls.forEach(el => {
    if (buffed) {
      el.style.color = '#FFD700';
      el.style.textShadow = '0 0 15px rgba(255,215,0,.6)';
    } else {
      el.style.color = '';
      el.style.textShadow = '';
    }
  });
  const powerEl = document.getElementById('powerValue');
  if (buffed) {
    powerEl.style.textShadow = '0 0 30px rgba(255,215,0,.8), 0 0 60px rgba(255,215,0,.4)';
  } else {
    powerEl.style.textShadow = '';
  }

  animateStatCounters();
}

function updateSkillButton() {
  const btn = document.getElementById('skillBtn');
  if (skillBuffActive) {
    btn.textContent = '\u2728 ACTIVE (' + skillRoundsLeft + ' rounds)';
    btn.style.background = 'rgba(52,152,219,.25)';
    btn.style.borderColor = '#3498db';
    btn.style.boxShadow = '0 0 20px rgba(52,152,219,.5)';
  } else {
    btn.innerHTML = '&#10040; Skill';
    btn.style.background = '';
    btn.style.borderColor = '';
    btn.style.boxShadow = '';
  }
}

// Called after each attack to count down skill rounds
function tickSkillRound() {
  if (!skillBuffActive) return;
  skillRoundsLeft--;
  updateSkillButton();
  if (skillRoundsLeft <= 0) {
    deactivateSkillBuff();
  }
}

document.getElementById('skillBtn').addEventListener('click', () => {
  if (actionCooldown) return;
  if (skillBuffActive) return;
  if (playerGauge < GAUGE_MAX) return; // Need full gauge

  // Reset gauge on use
  playerGauge = 0;
  updateGauges();

  actionCooldown = true;
  setTimeout(() => { actionCooldown = false; }, 2000);

  setActiveButton('skillBtn');

  // Visual activation effects
  triggerScreenFlash('skill');
  triggerVignette(1000);
  createEnergyPillar(currentHero.glowColor);
  createSpiralParticles(currentHero.glowColor);
  createMagicCircle(currentHero.glowColor);
  triggerCameraShake();

  // Show POWER UP text
  const evoOverlay = document.getElementById('evoTextOverlay');
  document.querySelector('.evo-text-inner').textContent = 'POWER UP!';
  evoOverlay.classList.remove('active');
  void evoOverlay.offsetWidth;
  evoOverlay.classList.add('active');
  setTimeout(() => {
    evoOverlay.classList.remove('active');
    document.querySelector('.evo-text-inner').textContent = 'EVOLUTION!';
  }, 2000);

  // Activate the buff after a brief delay
  setTimeout(() => {
    activateSkillBuff();
    setActiveButton(null);
  }, 500);
});

document.getElementById('dodgeBtn').addEventListener('click', () => {
  if (actionCooldown) return;
  const dodgeDur = HERO_ANIMS[currentHero.id] ? HERO_ANIMS[currentHero.id].dodge.duration + 100 : 900;
  actionCooldown = true;
  setTimeout(() => { actionCooldown = false; }, dodgeDur);

  setActiveButton('dodgeBtn');
  animState = 'dodge'; animTime = 0;

  if (usingGLB) playAnimation('idle');

  // Per-hero dodge animation
  dodgeAnimation();

  // Subtle wind effect
  createBurstParticles(0x88AACC, 20, 0.04);

  setTimeout(() => {
    setActiveButton(null);
    animState = 'idle';
  }, dodgeDur);
});

// ─── INIT ───
initScene();
spawnHero();
spawnOpponent();
animate();
// Render battle UI once DOM and models are ready
window.addEventListener('load', () => {
  renderBattleUI();
  setTimeout(renderBattleUI, 2000);

  // Seamless ping-pong via canvas: capture frames forward, play reverse from cache
  const vid = document.getElementById('arenaVideo');
  if (vid) {
    const bgCanvas = document.createElement('canvas');
    bgCanvas.id = 'arenaBgCanvas';
    vid.parentNode.insertBefore(bgCanvas, vid.nextSibling);
    const ctx = bgCanvas.getContext('2d');

    let capturedFrames = []; // ImageBitmap array
    let captureDone = false;
    let mode = 'forward';   // 'forward' | 'reverse'
    let reverseIdx = 0;
    let reverseStartTime = 0;
    let forwardDuration = 0; // actual duration of forward capture

    function initCanvas() {
      bgCanvas.width = vid.videoWidth || 1280;
      bgCanvas.height = vid.videoHeight || 720;
    }

    // During forward play: draw video to canvas AND capture frames
    function forwardLoop() {
      if (mode !== 'forward') return;

      if (vid.readyState >= 2 && vid.currentTime > 0) {
        ctx.drawImage(vid, 0, 0, bgCanvas.width, bgCanvas.height);

        // Capture frame as ImageBitmap (lightweight, GPU-backed)
        if (!captureDone) {
          createImageBitmap(vid).then(bmp => {
            capturedFrames.push(bmp);
          }).catch(() => {});
        }
      } else if (capturedFrames.length > 0) {
        // Video not ready yet (seeking to 0) — hold first captured frame
        ctx.drawImage(capturedFrames[0], 0, 0, bgCanvas.width, bgCanvas.height);
      }

      // Check if video is near end
      if (vid.duration && vid.currentTime >= vid.duration - 0.15) {
        // Switch to reverse
        vid.pause();
        captureDone = true;
        forwardDuration = vid.duration;
        mode = 'reverse';
        reverseIdx = capturedFrames.length - 1;
        // Draw last frame immediately
        if (reverseIdx >= 0) {
          ctx.drawImage(capturedFrames[reverseIdx], 0, 0, bgCanvas.width, bgCanvas.height);
        }
        reverseStartTime = performance.now();
        requestAnimationFrame(reverseLoop);
        return;
      }

      requestAnimationFrame(forwardLoop);
    }

    // Reverse: play captured frames backward, same speed as forward
    function reverseLoop(now) {
      if (mode !== 'reverse') return;

      // Map elapsed time to frame index so reverse takes same duration as forward
      const elapsed = (now - reverseStartTime) / 1000;
      const progress = Math.min(elapsed / (forwardDuration / SPEED), 1);
      const idx = Math.max(0, capturedFrames.length - 1 - Math.floor(progress * capturedFrames.length));

      if (idx >= 0 && idx < capturedFrames.length) {
        ctx.drawImage(capturedFrames[idx], 0, 0, bgCanvas.width, bgCanvas.height);
        reverseIdx = idx;
      }

      if (progress >= 1) {
        // Reverse done → draw first frame to hold, then restart forward
        if (capturedFrames.length > 0) {
          ctx.drawImage(capturedFrames[0], 0, 0, bgCanvas.width, bgCanvas.height);
        }
        mode = 'forward';
        vid.currentTime = 0;
        vid.playbackRate = SPEED;
        vid.play().catch(() => {});
        requestAnimationFrame(forwardLoop);
        return;
      }

      requestAnimationFrame(reverseLoop);
    }

    // Remove native loop — we handle it
    vid.removeAttribute('loop');

    const SPEED = 0.95; // slightly slower for smoother feel

    function start() {
      initCanvas();
      mode = 'forward';
      vid.currentTime = 0;
      vid.playbackRate = SPEED;
      vid.play().catch(() => {});
      requestAnimationFrame(forwardLoop);
    }

    if (vid.readyState >= 1) {
      start();
    } else {
      vid.addEventListener('loadedmetadata', start, { once: true });
    }
  }
});
