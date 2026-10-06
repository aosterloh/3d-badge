/**
 * Google Badge 3D Customizer Application Logic
 * Fixed Front-Only View featuring images/badge.png inside 3D Printable Frame
 * Supports 0 to 4 Corner Logos (Max 15x15mm each) matching the frame color
 */

// Available Emblems Pools
const GOOGLE_LOGOS = ['cloud', 'android', 'chrome', 'youtube', 'deepmind'];
const POPCULTURE_LOGOS = [
  'vader', 'yoda', 'mando', 'rebel', 'empire', 'starfleet', 'deathstar',
  'batman', 'superman', 'spiderman', 'punisher', 'deadpool',
  'invader', 'pacman', 'triforce', 'pokeball', 'mushroom', 'aperture', 'halflife',
  'tux', 'octocat', 'nasa'
];
const ALL_AVAILABLE_LOGOS = [...GOOGLE_LOGOS, ...POPCULTURE_LOGOS];

// Helper to pick random logo for the lower-right corner medallion
function getRandomCornerLogos() {
  const chosen = ALL_AVAILABLE_LOGOS[Math.floor(Math.random() * ALL_AVAILABLE_LOGOS.length)];
  return {
    'top-left': 'none',
    'top-right': 'none',
    'bottom-left': 'none',
    'bottom-right': chosen
  };
}

// Sample Google Badges (Male & Female)
const SAMPLE_BADGES = [
  {
    id: 'male',
    name: 'Alex (Male)',
    src: (typeof BADGE_PLACEHOLDER_DATA_URL !== 'undefined') ? BADGE_PLACEHOLDER_DATA_URL : 'images/badge.png',
    originalSrc: 'images/badge.png',
    icon: '👨'
  },
  {
    id: 'female',
    name: 'Jordan (Female)',
    src: 'images/badge2.jpeg',
    originalSrc: 'images/badge2.jpeg',
    icon: '👩'
  }
];

// Pick random badge on startup
const _initialBadgeIndex = Math.floor(Math.random() * SAMPLE_BADGES.length);
const _initialBadge = SAMPLE_BADGES[_initialBadgeIndex];

// Application State
const state = {
  frameStyle: 'plain',
  colorHex: '#4285F4',
  colorName: 'Google Blue',
  logoColorHex: '#FFFFFF',
  logoColorName: 'White',
  logoColorUserSet: false,
  showBadge: true, // Default view with sample badge visible
  corners: getRandomCornerLogos(),
  isEmbossed: true,
  customText: 'Cloud AI',
  customSvgShapes: null,
  badgePhotoSrc: _initialBadge.src,
  activeBadgeId: _initialBadge.id,
  customSpecs: {
    pocketDepth: 1.30,
    pocketWidth: 54.4,
    pocketHeight: 85.8,
    bezelCoverage: 3.0,
    backplateThickness: 0.50,
    frontLipThickness: 0.45,
    wallThickness: 1.2,
    slotWidth: 14.0,
    slotHeight: 3.0,
    thumbWidth: 16.0,
    thumbHeight: 28.0
  }
};

// Three.js Globals
let scene, camera, renderer, controls;
let badgePivotGroup = null;
let holderAssembly = null;
let badgeMesh = null;
let badgeTexture = null;

// Intro 3D Multi-Axis Swivel Showcase Animation State
let introAnimation = {
  active: false,
  startTime: 0,
  duration: 3000, // 3.0 seconds smooth multi-axis 3D turntable swivel
  pendingVisibility: false
};

function startIntroXFlip() {
  // If the document is currently in a background tab or hidden, defer until focused
  if (document.hidden) {
    introAnimation.pendingVisibility = true;
    return;
  }
  introAnimation.pendingVisibility = false;
  introAnimation.active = true;
  introAnimation.startTime = performance.now();
  if (badgePivotGroup) badgePivotGroup.rotation.set(0, Math.PI * 2, 0);

  const hintPill = document.querySelector('.orbit-hint-pill');
  if (hintPill) {
    hintPill.classList.add('pulse');
    setTimeout(() => {
      if (hintPill) hintPill.classList.remove('pulse');
    }, 3200);
  }
}

function cancelIntroXFlip() {
  introAnimation.pendingVisibility = false;
  if (introAnimation.active) {
    introAnimation.active = false;
    if (badgePivotGroup) badgePivotGroup.rotation.set(0, 0, 0);
    const hintPill = document.querySelector('.orbit-hint-pill');
    if (hintPill) hintPill.classList.remove('pulse');
  }
}

// When user switches back to this tab, trigger showcase flip if it was queued
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && introAnimation.pendingVisibility) {
    setTimeout(() => {
      startIntroXFlip();
    }, 200);
  }
});

// Initialize on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  initThree();
  initBadgeCard();
  updateHolderAssembly();
  initUIHandlers();
  initOnboardingModal();
  initAuthGate();
  animate();
});

/**
 * Initialize Three.js scene, studio lighting, camera, and fixed front renderer
 */
function initThree() {
  const container = document.querySelector('.canvas-wrapper');
  const canvas = document.getElementById('viewport');

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf6f8fa);

  // Camera - Default straight-on Front View
  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(36, aspect, 1, 1000);
  camera.position.set(0, 3, 175);
  camera.lookAt(0, 3, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  // OrbitControls - Interactive 3D Rotation with Inertia Damping
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableRotate = true; // Rotate in 3D space
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enableZoom = true;   // Zoom in/out to inspect details
  controls.minDistance = 90;
  controls.maxDistance = 320;
  controls.enablePan = false;   // Maintain centered pivot
  controls.target.set(0, 3, 0);

  // Studio Lighting (Optimized for monochrome single-material 3D print relief)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.82);
  scene.add(ambientLight);

  // Key Directional Light (Angled to cast contact shadows and highlights along embossed edges)
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.65);
  keyLight.position.set(35, 65, 100);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 10;
  keyLight.shadow.camera.far = 300;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  // Subtle Fill Light from bottom-left
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-45, -45, 80);
  scene.add(fillLight);

  // Soft Ground Shadow
  const shadowPlaneGeo = new THREE.PlaneGeometry(300, 300);
  const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.12 });
  const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
  shadowPlane.position.set(0, 0, -2);
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  // Central Pivot Group for entire badge assembly (allows 360° X-axis showcase flip)
  badgePivotGroup = new THREE.Group();
  badgePivotGroup.name = "BadgePivotGroup";
  scene.add(badgePivotGroup);

  // User interaction seamlessly cancels intro flip and takes manual control
  controls.addEventListener('start', cancelIntroXFlip);
  renderer.domElement.addEventListener('pointerdown', cancelIntroXFlip);

  // Window Resize
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  const container = document.querySelector('.canvas-wrapper');
  if (!container || !renderer || !camera) return;
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

// Texture cache for fast instant switching between male and female badges
const badgeTextureCache = {};

function switchSampleBadge(badgeId) {
  const badge = SAMPLE_BADGES.find(b => b.id === badgeId) || SAMPLE_BADGES[0];
  state.badgePhotoSrc = badge.src;
  state.activeBadgeId = badge.id;

  if (badgeMesh && badgeMesh.material && badgeMesh.material[4]) {
    if (badgeTextureCache[badge.id]) {
      badgeMesh.material[4].map = badgeTextureCache[badge.id];
      badgeMesh.material[4].needsUpdate = true;
    } else {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(badge.src, (tex) => {
        tex.anisotropy = 16;
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        badgeTextureCache[badge.id] = tex;
        if (badgeMesh && badgeMesh.material && badgeMesh.material[4]) {
          badgeMesh.material[4].map = tex;
          badgeMesh.material[4].needsUpdate = true;
        }
      });
    }
  }

  updateBadgeUIState(badge);
}

function updateBadgeUIState(badge) {
  const badgePhotoPreview = document.getElementById('badgePhotoPreview');
  const badgeNameLabel = document.getElementById('badgeNameLabel');
  const badgeSourceLabel = document.getElementById('badgeSourceLabel');
  const badgeSwitchIcon = document.getElementById('badgeSwitchIcon');
  const badgeSwitchText = document.getElementById('badgeSwitchText');
  const btnSelectBadgeMale = document.getElementById('btnSelectBadgeMale');
  const btnSelectBadgeFemale = document.getElementById('btnSelectBadgeFemale');

  if (badgePhotoPreview) {
    badgePhotoPreview.src = badge.originalSrc || badge.src;
  }
  if (badgeNameLabel) {
    badgeNameLabel.textContent = badge.name;
  }
  if (badgeSourceLabel) {
    badgeSourceLabel.innerHTML = `Source: <code>${badge.originalSrc || badge.src}</code>`;
  }
  if (badgeSwitchIcon) {
    badgeSwitchIcon.textContent = badge.icon;
  }
  if (badgeSwitchText) {
    badgeSwitchText.textContent = badge.id === 'male' ? 'Male' : 'Female';
  }

  if (btnSelectBadgeMale && btnSelectBadgeFemale) {
    if (badge.id === 'male') {
      btnSelectBadgeMale.classList.add('active');
      btnSelectBadgeFemale.classList.remove('active');
    } else {
      btnSelectBadgeMale.classList.remove('active');
      btnSelectBadgeFemale.classList.add('active');
    }
  }
}

/**
 * Initializes the Badge Card displaying the active sample badge inside the holder pocket
 */
function initBadgeCard() {
  const cardW = BADGE_SPECS.cardWidth;
  const cardH = BADGE_SPECS.cardHeight;
  const cardT = BADGE_SPECS.cardThickness;

  const cardGeo = new THREE.BoxGeometry(cardW, cardH, cardT);

  // Front material showing the badge image
  const frontMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.05
  });

  const edgeMaterial = new THREE.MeshStandardMaterial({
    color: 0xf5f5f5,
    roughness: 0.4
  });

  const materials = [
    edgeMaterial,  // +X right
    edgeMaterial,  // -X left
    edgeMaterial,  // +Y top
    edgeMaterial,  // -Y bottom
    frontMaterial, // +Z front face (shows badge photo)
    edgeMaterial   // -Z back face
  ];

  // Load the active badge placeholder image
  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(state.badgePhotoSrc, (tex) => {
    tex.anisotropy = 16;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    badgeTextureCache[state.activeBadgeId] = tex;
    frontMaterial.map = tex;
    frontMaterial.needsUpdate = true;
  });

  badgeMesh = new THREE.Mesh(cardGeo, materials);
  badgeMesh.castShadow = true;
  badgeMesh.name = "MockBadgeCard";

  // Center badge cleanly inside the holder card pocket
  const posY = 0.0;
  const posZ = BADGE_SPECS.backplateThickness + BADGE_SPECS.pocketDepth / 2;
  badgeMesh.position.set(0, posY, posZ);

  if (badgePivotGroup) {
    badgePivotGroup.add(badgeMesh);
  } else {
    scene.add(badgeMesh);
  }
}

/**
 * Re-generates the 3D frame assembly whenever any frame style, color, corner logo, or dimension changes
 */
function updateHolderAssembly() {
  if (holderAssembly) {
    if (badgePivotGroup) badgePivotGroup.remove(holderAssembly);
    else scene.remove(holderAssembly);
    holderAssembly.traverse(child => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (child.material.dispose) child.material.dispose();
      }
    });
  }

  holderAssembly = createBadgeHolderAssembly({
    frameStyle: state.frameStyle,
    colorHex: state.colorHex,
    logoColorHex: state.logoColorHex,
    corners: state.corners,
    isEmbossed: state.isEmbossed,
    customShapes: state.customSvgShapes,
    specs: state.customSpecs
  });

  holderAssembly.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  if (badgePivotGroup) {
    badgePivotGroup.add(holderAssembly);
  } else {
    scene.add(holderAssembly);
  }

  // Dynamically center sample badge card inside the customized pocket
  if (badgeMesh) {
    const specs = (holderAssembly && holderAssembly.userData.specs) ? holderAssembly.userData.specs : BADGE_SPECS;
    const posZ = specs.backplateThickness + specs.pocketDepth / 2;
    badgeMesh.position.set(0, 0.0, posZ);
  }

  // Update HUD specs
  updateHUDSpecs();
}

/**
 * Updates Live Dimension HUD overlay with active parameters
 */
function updateHUDSpecs() {
  const specs = (holderAssembly && holderAssembly.userData.specs) ? holderAssembly.userData.specs : BADGE_SPECS;
  const hudContainer = document.querySelector('.hud-specs');
  if (hudContainer) {
    const clearance = (specs.pocketDepth - 0.82).toFixed(2);
    hudContainer.innerHTML = `
      <span>📐 Outer: ${specs.baseWidth.toFixed(1)} × ${specs.baseHeight.toFixed(1)} × ${specs.baseThickness.toFixed(2)} mm</span>
      <span>💳 Slot Opening: ${specs.pocketWidth.toFixed(1)} × ${specs.pocketDepth.toFixed(2)} mm</span>
      <span>🪶 Thickness: ${specs.baseThickness.toFixed(2)} mm (+${clearance} mm clearance)</span>
      <span>📎 Slot: ${specs.slotWidth.toFixed(1)} × ${specs.slotHeight.toFixed(1)} mm</span>
    `;
  }
}

/**
 * Wire UI Event Handlers
 */
// Harmonious high-contrast color pairings for frame + logo
const HARMONIOUS_COLOR_PAIRS = [
  // 1. Classic Google Brand
  { frame: { hex: '#4285F4', name: 'Google Blue' }, logo: { hex: '#FFFFFF', name: 'White' } },
  { frame: { hex: '#EA4335', name: 'Google Red' }, logo: { hex: '#FFFFFF', name: 'White' } },
  { frame: { hex: '#34A853', name: 'Google Green' }, logo: { hex: '#FFFFFF', name: 'White' } },
  { frame: { hex: '#FBBC04', name: 'Google Yellow' }, logo: { hex: '#202124', name: 'Stealth Black' } },

  // 2. High-Tech Stealth Black & Accent
  { frame: { hex: '#202124', name: 'Stealth Black' }, logo: { hex: '#4285F4', name: 'Google Blue' } },
  { frame: { hex: '#202124', name: 'Stealth Black' }, logo: { hex: '#EA4335', name: 'Google Red' } },
  { frame: { hex: '#202124', name: 'Stealth Black' }, logo: { hex: '#FBBC04', name: 'Google Yellow' } },
  { frame: { hex: '#202124', name: 'Stealth Black' }, logo: { hex: '#34A853', name: 'Google Green' } },
  { frame: { hex: '#202124', name: 'Stealth Black' }, logo: { hex: '#FFFFFF', name: 'White' } },

  // 3. Clean Minimalist Pure White & Accent
  { frame: { hex: '#F8F9FA', name: 'Pure White' }, logo: { hex: '#4285F4', name: 'Google Blue' } },
  { frame: { hex: '#F8F9FA', name: 'Pure White' }, logo: { hex: '#EA4335', name: 'Google Red' } },
  { frame: { hex: '#F8F9FA', name: 'Pure White' }, logo: { hex: '#34A853', name: 'Google Green' } },
  { frame: { hex: '#F8F9FA', name: 'Pure White' }, logo: { hex: '#202124', name: 'Stealth Black' } },

  // 4. Vibrant Dual-Tone
  { frame: { hex: '#4285F4', name: 'Google Blue' }, logo: { hex: '#FBBC04', name: 'Google Yellow' } },
  { frame: { hex: '#EA4335', name: 'Google Red' }, logo: { hex: '#FBBC04', name: 'Google Yellow' } },
  { frame: { hex: '#34A853', name: 'Google Green' }, logo: { hex: '#FBBC04', name: 'Google Yellow' } }
];

function initUIHandlers() {
  // 1. Frame Style Cards (Plain Edge vs Wave Edge)
  const styleLabel = document.getElementById('currentStyleLabel');

  function setFrameStyle(style) {
    state.frameStyle = style;
    document.querySelectorAll('.frame-card').forEach(c => {
      if (c.dataset.style === style) c.classList.add('active');
      else c.classList.remove('active');
    });
    if (styleLabel) {
      styleLabel.textContent = (style === 'wave') ? 'Wave Edge' : 'Plain Edge';
    }
  }

  document.querySelectorAll('.frame-card').forEach(card => {
    card.addEventListener('click', () => {
      setFrameStyle(card.dataset.style);
      updateHolderAssembly();
    });
  });

  // 1b. Camera View Preset Buttons (Front, 3D Iso, Top View, Back)
  const btnFront = document.getElementById('btnViewFront');
  const btnIso = document.getElementById('btnViewIso');
  const btnTop = document.getElementById('btnViewTop');
  const btnBack = document.getElementById('btnViewBack');

  function setCameraAngle(type) {
    cancelIntroXFlip();
    [btnFront, btnIso, btnTop, btnBack].forEach(b => { if (b) b.classList.remove('active'); });

    // Reset default vertical orientation
    camera.up.set(0, 1, 0);

    if (type === 'front') {
      camera.position.set(0, 3, 175);
      controls.target.set(0, 3, 0);
      if (btnFront) btnFront.classList.add('active');
    } else if (type === 'iso') {
      camera.position.set(65, 45, 155);
      controls.target.set(0, 3, 0);
      if (btnIso) btnIso.classList.add('active');
    } else if (type === 'top') {
      // Look straight down into the top slide-in pocket opening
      camera.position.set(0, 185, 1.125);
      camera.up.set(0, 0, -1);
      controls.target.set(0, 3, 1.125);
      if (btnTop) btnTop.classList.add('active');
    } else if (type === 'back') {
      camera.position.set(0, 3, -175);
      controls.target.set(0, 3, 0);
      if (btnBack) btnBack.classList.add('active');
    }
    controls.update();
  }

  if (btnFront) btnFront.addEventListener('click', () => setCameraAngle('front'));
  if (btnIso) btnIso.addEventListener('click', () => setCameraAngle('iso'));
  if (btnTop) btnTop.addEventListener('click', () => setCameraAngle('top'));
  if (btnBack) btnBack.addEventListener('click', () => setCameraAngle('back'));

  // 1c. Sample Badge Visibility Toggle (With or Without Badge)
  const btnToggleBadge = document.getElementById('btnToggleBadge');
  const btnSectionBadgeToggle = document.getElementById('btnSectionBadgeToggle');
  const badgeBtnText = document.getElementById('badgeBtnText');
  const badgeStatusSubtext = document.getElementById('badgeStatusSubtext');

  function updateBadgeVisibility(shown) {
    state.showBadge = shown;
    if (badgeMesh) {
      badgeMesh.visible = state.showBadge;
    }
    if (state.showBadge) {
      if (btnToggleBadge) {
        btnToggleBadge.classList.add('active');
        btnToggleBadge.classList.remove('inactive');
      }
      if (badgeBtnText) badgeBtnText.textContent = 'Badge: ON';
      if (badgeStatusSubtext) {
        badgeStatusSubtext.textContent = 'Status: Inserted in 3D View';
        badgeStatusSubtext.style.color = 'var(--google-blue)';
      }
    } else {
      if (btnToggleBadge) {
        btnToggleBadge.classList.remove('active');
        btnToggleBadge.classList.add('inactive');
      }
      if (badgeBtnText) badgeBtnText.textContent = 'Badge: OFF';
      if (badgeStatusSubtext) {
        badgeStatusSubtext.textContent = 'Status: Hidden (Showing empty holder interior)';
        badgeStatusSubtext.style.color = '#ea4335';
      }
    }
  }

  if (btnToggleBadge) {
    btnToggleBadge.addEventListener('click', () => {
      updateBadgeVisibility(!state.showBadge);
    });
  }

  if (btnSectionBadgeToggle) {
    btnSectionBadgeToggle.addEventListener('click', () => {
      updateBadgeVisibility(!state.showBadge);
    });
  }

  // 1d. Sample Badge Photo Switcher (Male vs Female)
  const btnSwitchBadge = document.getElementById('btnSwitchBadge');
  const btnSelectBadgeMale = document.getElementById('btnSelectBadgeMale');
  const btnSelectBadgeFemale = document.getElementById('btnSelectBadgeFemale');

  if (btnSwitchBadge) {
    btnSwitchBadge.addEventListener('click', () => {
      const nextId = state.activeBadgeId === 'male' ? 'female' : 'male';
      switchSampleBadge(nextId);
    });
  }

  if (btnSelectBadgeMale) {
    btnSelectBadgeMale.addEventListener('click', () => {
      switchSampleBadge('male');
    });
  }

  if (btnSelectBadgeFemale) {
    btnSelectBadgeFemale.addEventListener('click', () => {
      switchSampleBadge('female');
    });
  }

  // Sync initial badge UI state
  updateBadgeUIState(_initialBadge);

  // 2. Color Swatches (4 Google Colors + Neutrals)
  const colorLabel = document.getElementById('currentColorLabel');

  function setFrameColor(hex, name, autoUpdateLogo = true) {
    state.colorHex = hex;
    state.colorName = name;
    document.querySelectorAll('.color-swatch-btn').forEach(s => {
      if (s.dataset.color.toUpperCase() === hex.toUpperCase()) s.classList.add('active');
      else s.classList.remove('active');
    });
    if (colorLabel) {
      colorLabel.textContent = name;
      colorLabel.style.color = hex === '#F8F9FA' ? '#202124' : hex;
    }

    if (autoUpdateLogo) {
      // Smart auto-switch logo color:
      // Default is White unless frame is White, then default is Google Blue
      const isWhiteFrame = (state.colorHex === '#F8F9FA' || state.colorHex.toUpperCase() === '#FFFFFF');
      if (isWhiteFrame) {
        if (!state.logoColorUserSet || state.logoColorHex === '#FFFFFF') {
          setLogoColor('#4285F4', 'Google Blue', false);
        }
      } else {
        if (!state.logoColorUserSet && state.logoColorHex === '#4285F4') {
          setLogoColor('#FFFFFF', 'White', false);
        }
      }
    }
  }

  document.querySelectorAll('.color-swatch-btn').forEach(swatch => {
    swatch.addEventListener('click', () => {
      setFrameColor(swatch.dataset.color, swatch.dataset.name, true);
      updateHolderAssembly();
    });
  });

  // Logo Color Selection Swatches
  const logoColorLabel = document.getElementById('currentLogoColorLabel');

  function setLogoColor(hex, name, userSet = true) {
    state.logoColorHex = hex;
    state.logoColorName = name;
    if (userSet) state.logoColorUserSet = true;
    if (logoColorLabel) {
      logoColorLabel.textContent = name;
      logoColorLabel.style.color = (hex === '#FFFFFF') ? '#3c4043' : hex;
    }
    document.querySelectorAll('.logo-color-swatch').forEach(s => {
      if (s.dataset.logoColor.toUpperCase() === hex.toUpperCase()) {
        s.classList.add('active');
      } else {
        s.classList.remove('active');
      }
    });
  }

  // Top Randomizer Action
  function randomizeDesign() {
    // 1. Pick a random harmonious color pair (frame + logo)
    const pair = HARMONIOUS_COLOR_PAIRS[Math.floor(Math.random() * HARMONIOUS_COLOR_PAIRS.length)];
    setFrameColor(pair.frame.hex, pair.frame.name, false);
    setLogoColor(pair.logo.hex, pair.logo.name, true);

    // 2. Pick a random edge shape (plain vs wave)
    const newStyle = Math.random() < 0.5 ? 'plain' : 'wave';
    setFrameStyle(newStyle);

    // 3. Pick 4 distinct random corner logos
    state.corners = getRandomCornerLogos();
    updateCornerUI();

    // 4. Randomly pick sample badge photo (Male vs Female)
    const randomBadge = SAMPLE_BADGES[Math.floor(Math.random() * SAMPLE_BADGES.length)];
    switchSampleBadge(randomBadge.id);

    // 5. Update 3D Assembly
    updateHolderAssembly();

    // 6. Trigger showcase 3D flip animation
    startIntroXFlip();

    // 7. Toast feedback
    const styleTitle = (newStyle === 'wave') ? 'Wave Edge' : 'Plain Edge';
    showToast(`🎲 Generated: ${styleTitle} • ${pair.frame.name} + ${pair.logo.name} • ${randomBadge.name}`);
  }

  document.querySelectorAll('.logo-color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      setLogoColor(swatch.dataset.logoColor, swatch.dataset.name, true);
      updateHolderAssembly();
    });
  });

  // 3. Lower-Right Corner Dual Coordinated Logo Selectors (Google vs Pop Culture)
  const selectGoogleLogo = document.getElementById('selectGoogleLogo');
  const selectPopCultureLogo = document.getElementById('selectPopCultureLogo');
  const countLabel = document.getElementById('activeLogoCountLabel');

  function updateCornerUI() {
    const val = (state.corners && state.corners['bottom-right']) ? state.corners['bottom-right'] : 'cloud';

    if (GOOGLE_LOGOS.includes(val)) {
      if (selectGoogleLogo) selectGoogleLogo.value = val;
      if (selectPopCultureLogo) selectPopCultureLogo.value = 'none';
    } else if (POPCULTURE_LOGOS.includes(val)) {
      if (selectGoogleLogo) selectGoogleLogo.value = 'none';
      if (selectPopCultureLogo) selectPopCultureLogo.value = val;
    } else {
      // 'none' (plain medallion)
      if (selectGoogleLogo) selectGoogleLogo.value = 'none';
      if (selectPopCultureLogo) selectPopCultureLogo.value = 'none';
    }

    if (countLabel) {
      countLabel.textContent = (val !== 'none') ? 'Bed-Anchored (Zero Overhang)' : 'Plain Medallion';
    }
  }

  if (selectGoogleLogo) {
    selectGoogleLogo.addEventListener('change', (e) => {
      const chosen = e.target.value;
      if (chosen !== 'none') {
        if (selectPopCultureLogo) selectPopCultureLogo.value = 'none';
        state.corners = {
          'top-left': 'none',
          'top-right': 'none',
          'bottom-left': 'none',
          'bottom-right': chosen
        };
      } else {
        // Switched Google to None: if Pop Culture is also None, state is none
        if (!selectPopCultureLogo || selectPopCultureLogo.value === 'none') {
          state.corners = {
            'top-left': 'none',
            'top-right': 'none',
            'bottom-left': 'none',
            'bottom-right': 'none'
          };
        }
      }
      updateCornerUI();
      updateHolderAssembly();
    });
  }

  if (selectPopCultureLogo) {
    selectPopCultureLogo.addEventListener('change', (e) => {
      const chosen = e.target.value;
      if (chosen !== 'none') {
        if (selectGoogleLogo) selectGoogleLogo.value = 'none';
        state.corners = {
          'top-left': 'none',
          'top-right': 'none',
          'bottom-left': 'none',
          'bottom-right': chosen
        };
      } else {
        // Switched Pop Culture to None: if Google is also None, state is none
        if (!selectGoogleLogo || selectGoogleLogo.value === 'none') {
          state.corners = {
            'top-left': 'none',
            'top-right': 'none',
            'bottom-left': 'none',
            'bottom-right': 'none'
          };
        }
      }
      updateCornerUI();
      updateHolderAssembly();
    });
  }

  // 4. Relief Toggle (Embossed vs Debossed)
  document.querySelectorAll('.relief-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.relief-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.isEmbossed = btn.dataset.emboss === 'true';
      updateHolderAssembly();
    });
  });

  // 6. Advanced Dimensions & Custom Fit
  initAdvancedDimensionsUI();

  // 7. STL & 3MF Download Buttons & Floating Randomizer Action
  const btnFloatingRandomize = document.getElementById('btnFloatingRandomize');
  if (btnFloatingRandomize) {
    btnFloatingRandomize.addEventListener('click', randomizeDesign);
  }

  // Quick keyboard shortcut: Press 'R' anywhere (outside text inputs) to trigger Randomizer
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      randomizeDesign();
    }
  });

  // Dual 3MF (Bambu Studio & Universal Maker Space) and STL exports
  const btnDownloadBambu3MF = document.getElementById('btnDownloadBambu3MF');
  if (btnDownloadBambu3MF) btnDownloadBambu3MF.addEventListener('click', () => download3MF(true));

  const btnHeaderExportBambu = document.getElementById('btnHeaderExportBambu');
  if (btnHeaderExportBambu) btnHeaderExportBambu.addEventListener('click', () => download3MF(true));

  const btnDownloadUniversal3MF = document.getElementById('btnDownloadUniversal3MF');
  if (btnDownloadUniversal3MF) btnDownloadUniversal3MF.addEventListener('click', () => download3MF(false));

  const btnHeaderExportUniversal = document.getElementById('btnHeaderExportUniversal');
  if (btnHeaderExportUniversal) btnHeaderExportUniversal.addEventListener('click', () => download3MF(false));

  const btnDownload3MF = document.getElementById('btnDownload3MF');
  if (btnDownload3MF) btnDownload3MF.addEventListener('click', () => download3MF(true));

  const btnHeaderExport3MF = document.getElementById('btnHeaderExport3MF');
  if (btnHeaderExport3MF) btnHeaderExport3MF.addEventListener('click', () => download3MF(true));

  const btnDownloadSTL = document.getElementById('btnDownloadSTL');
  if (btnDownloadSTL) btnDownloadSTL.addEventListener('click', downloadSTL);

  const btnHeaderExport = document.getElementById('btnHeaderExport');
  if (btnHeaderExport) btnHeaderExport.addEventListener('click', downloadSTL);

  // Initialize corner UI states
  updateCornerUI();
}

/**
 * Advanced Dimensions & Custom Fit Handlers
 */
function initAdvancedDimensionsUI() {
  const fitPresetBadge = document.getElementById('fitPresetBadge');
  const presetButtons = document.querySelectorAll('.preset-pill-btn');
  const btnReset = document.getElementById('btnResetDimensions');

  // Sliders and value readout elements mapping
  const sliderConfigs = [
    { id: 'sliderPocketDepth', valId: 'valPocketDepth', key: 'pocketDepth', unit: 'mm', decimals: 2, clearanceId: 'clearancePocketDepth', cardBase: 0.82 },
    { id: 'sliderPocketWidth', valId: 'valPocketWidth', key: 'pocketWidth', unit: 'mm', decimals: 1, clearanceId: 'clearancePocketWidth', cardBase: 54.0 },
    { id: 'sliderPocketHeight', valId: 'valPocketHeight', key: 'pocketHeight', unit: 'mm', decimals: 1 },
    { id: 'sliderBezelCoverage', valId: 'valBezelCoverage', key: 'bezelCoverage', unit: 'mm', decimals: 1 },
    { id: 'sliderBackplateThickness', valId: 'valBackplateThickness', key: 'backplateThickness', unit: 'mm', decimals: 2 },
    { id: 'sliderFrontLipThickness', valId: 'valFrontLipThickness', key: 'frontLipThickness', unit: 'mm', decimals: 2 },
    { id: 'sliderWallThickness', valId: 'valWallThickness', key: 'wallThickness', unit: 'mm', decimals: 1 },
    { id: 'sliderSlotWidth', valId: 'valSlotWidth', key: 'slotWidth', unit: 'mm', decimals: 1 },
    { id: 'sliderSlotHeight', valId: 'valSlotHeight', key: 'slotHeight', unit: 'mm', decimals: 2 },
    { id: 'sliderThumbWidth', valId: 'valThumbWidth', key: 'thumbWidth', unit: 'mm', decimals: 1 },
    { id: 'sliderThumbHeight', valId: 'valThumbHeight', key: 'thumbHeight', unit: 'mm', decimals: 1 },
  ];

  function updateSliderDisplay(cfg, val) {
    const valEl = document.getElementById(cfg.valId);
    if (valEl) valEl.textContent = `${val.toFixed(cfg.decimals)} ${cfg.unit}`;
    if (cfg.clearanceId) {
      const clearEl = document.getElementById(cfg.clearanceId);
      if (clearEl) {
        const diff = val - cfg.cardBase;
        const sign = diff >= 0 ? '+' : '';
        clearEl.textContent = `${sign}${diff.toFixed(2)} mm clearance`;
      }
    }
  }

  function syncAllSliderControls() {
    sliderConfigs.forEach(cfg => {
      const slider = document.getElementById(cfg.id);
      const val = state.customSpecs[cfg.key];
      if (slider) slider.value = val;
      updateSliderDisplay(cfg, val);
    });
  }

  function updatePresetPills(activePresetName) {
    presetButtons.forEach(btn => {
      if (btn.dataset.preset === activePresetName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    if (fitPresetBadge) {
      if (activePresetName === 'snug') {
        fitPresetBadge.textContent = 'Snug (1.05 mm)';
      } else if (activePresetName === 'standard') {
        fitPresetBadge.textContent = 'Standard (1.30 mm)';
      } else if (activePresetName === 'loose') {
        fitPresetBadge.textContent = 'Loose (1.65 mm)';
      } else {
        fitPresetBadge.textContent = `Custom (${state.customSpecs.pocketDepth.toFixed(2)} mm)`;
      }
    }
  }

  // 1. Sliders input listeners
  sliderConfigs.forEach(cfg => {
    const slider = document.getElementById(cfg.id);
    if (slider) {
      slider.addEventListener('input', (e) => {
        const numVal = parseFloat(e.target.value);
        state.customSpecs[cfg.key] = numVal;
        updateSliderDisplay(cfg, numVal);

        // Check if depth matches known presets
        if (cfg.key === 'pocketDepth') {
          if (Math.abs(numVal - 1.05) < 0.01) {
            updatePresetPills('snug');
          } else if (Math.abs(numVal - 1.30) < 0.01) {
            updatePresetPills('standard');
          } else if (Math.abs(numVal - 1.65) < 0.01) {
            updatePresetPills('loose');
          } else {
            updatePresetPills('custom');
          }
        }

        updateHolderAssembly();
      });
    }
  });

  // 2. Preset Pill buttons
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (preset === 'snug') {
        state.customSpecs.pocketDepth = 1.05;
        state.customSpecs.pocketWidth = 54.2;
      } else if (preset === 'standard') {
        state.customSpecs.pocketDepth = 1.30;
        state.customSpecs.pocketWidth = 54.4;
      } else if (preset === 'loose') {
        state.customSpecs.pocketDepth = 1.65;
        state.customSpecs.pocketWidth = 54.8;
      }
      updatePresetPills(preset);
      syncAllSliderControls();
      updateHolderAssembly();
    });
  });

  // 3. Reset Button
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      state.customSpecs = {
        pocketDepth: 1.30,
        pocketWidth: 54.4,
        pocketHeight: 85.8,
        bezelCoverage: 3.0,
        backplateThickness: 0.50,
        frontLipThickness: 0.45,
        wallThickness: 1.2,
        slotWidth: 14.0,
        slotHeight: 3.0,
        thumbWidth: 16.0,
        thumbHeight: 28.0
      };
      updatePresetPills('standard');
      syncAllSliderControls();
      updateHolderAssembly();
      showToast("Reset all dimensions to Google defaults (1.30 mm standard fit)");
    });
  }

  // Initial sync
  syncAllSliderControls();
}

/**
 * Generates custom 3D vector text monogram for team names (Max 15x15mm area)
 */
function generateCustomTextShapes() {
  const text = (state.customText || 'GOOG').toUpperCase();
  const shapes = [];

  const letterW = 5.2;
  const letterH = 8.5;
  const count = Math.min(text.length, 2);
  const startX = -((count * (letterW + 1.2)) / 2);

  for (let i = 0; i < count; i++) {
    const char = text[i];
    const x = startX + i * (letterW + 1.2);
    const shape = new THREE.Shape();

    // Box letter silhouette
    shape.moveTo(x, -letterH / 2);
    shape.lineTo(x + letterW, -letterH / 2);
    shape.lineTo(x + letterW, letterH / 2);
    shape.lineTo(x, letterH / 2);
    shape.closePath();

    // Cut hole for enclosed characters
    if ('AODPBQR0'.includes(char)) {
      const hole = new THREE.Path();
      hole.moveTo(x + 1.2, -letterH / 2 + 2.0);
      hole.lineTo(x + letterW - 1.2, -letterH / 2 + 2.0);
      hole.lineTo(x + letterW - 1.2, letterH / 2 - 2.0);
      hole.lineTo(x + 1.2, letterH / 2 - 2.0);
      hole.closePath();
      shape.holes.push(hole);
    }
    shapes.push(shape);
  }

  state.customSvgShapes = shapes;
}

/**
 * Exports the 3D Badge Holder as multi-material .3MF package
 * @param {boolean} isBambu - true for native Bambu Studio bundle (with model_settings.config & AMS mapping), false for universal 3MF (Prusa, Orca, Cura)
 */
async function download3MF(isBambu = true) {
  if (!holderAssembly) {
    alert("3D model is still initializing...");
    return;
  }

  if (typeof JSZip === 'undefined' || typeof generate3MFPackage !== 'function') {
    alert("3MF packaging library is loading, please try again in a moment.");
    return;
  }

  const targetName = isBambu ? "Bambu Studio" : "Universal Maker Space";
  showToast(`Packaging ${targetName} multi-material .3MF...`);

  try {
    const options = {
      colorHex: state.colorHex,
      logoColorHex: state.logoColorHex,
      isBambu: isBambu
    };
    const blob = await generate3MFPackage(THREE, JSZip, holderAssembly, options);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);

    const styleClean = state.frameStyle.charAt(0).toUpperCase() + state.frameStyle.slice(1);
    const colorClean = state.colorName.replace(/\s+/g, '_');
    const logoColorClean = state.logoColorName.replace(/\s+/g, '_');
    const suffix = isBambu ? 'BambuStudio' : 'Universal';
    const filename = `Google_Badge_Holder_${styleClean}_${colorClean}_Logo_${logoColorClean}_${suffix}.3mf`;

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    showToast(`✓ Downloaded ${targetName} .3MF: ${filename}`);
  } catch (err) {
    console.error("Failed to generate 3MF", err);
    showToast(`✕ Error creating .3MF: ${err.message}`);
  }
}

/**
 * Exports the 3D Badge Holder as binary STL and triggers browser download
 */
function downloadSTL() {
  if (!holderAssembly) {
    alert("3D model is still initializing...");
    return;
  }

  const exporter = new THREE.STLExporter();
  const stlBinary = exporter.parse(holderAssembly, { binary: true });

  const blob = new Blob([stlBinary], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);

  // Descriptive filename indicating frame style, color, logo color, logo count, and relief
  const styleClean = state.frameStyle.charAt(0).toUpperCase() + state.frameStyle.slice(1);
  const colorClean = state.colorName.replace(/\s+/g, '_');
  const logoColorClean = state.logoColorName.replace(/\s+/g, '_');
  const activeCount = Object.values(state.corners).filter(v => v !== 'none').length;
  const reliefClean = state.isEmbossed ? 'Embossed' : 'Debossed';
  const filename = `Google_Badge_Holder_${styleClean}_${colorClean}_Logo_${logoColorClean}_${activeCount}Logos_${reliefClean}.stl`;

  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);

  // Toast feedback
  showToast(`Downloaded: ${filename}`);
}

/**
 * Toast Notification Helper
 */
function showToast(message) {
  let toast = document.getElementById('toastNotice');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotice';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = '#202124';
    toast.style.color = '#ffffff';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '24px';
    toast.style.fontSize = '0.86rem';
    toast.style.fontWeight = '600';
    toast.style.boxShadow = '0 6px 16px rgba(0,0,0,0.25)';
    toast.style.zIndex = '9999';
    toast.style.transition = 'opacity 0.25s ease';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 3500);
}

/**
 * Main Render Loop
 */
function animate() {
  requestAnimationFrame(animate);

  // Smooth 3D Multi-Axis Opening Swivel (Y turntable yaw, X card slot pitch, Z perspective roll)
  if (introAnimation.active && badgePivotGroup) {
    const elapsed = performance.now() - introAnimation.startTime;
    const progress = Math.min(elapsed / introAnimation.duration, 1.0);

    // Smooth cubic ease-in-out curve
    const ease = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    // Y-axis (turntable yaw spin): Smooth 360-degree rotation returning precisely to 0
    badgePivotGroup.rotation.y = (1.0 - ease) * Math.PI * 2;

    // X-axis (pitch tilt): Gentle forward & back tilt revealing top pocket opening and lanyard tab
    badgePivotGroup.rotation.x = Math.sin(progress * Math.PI) * 0.45;

    // Z-axis (roll tilt): Subtle dynamic roll emphasizing 3D thickness and embossed relief
    badgePivotGroup.rotation.z = Math.sin(progress * Math.PI * 2) * 0.14;

    if (progress >= 1.0) {
      introAnimation.active = false;
      badgePivotGroup.rotation.set(0, 0, 0);
    }
  }

  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// ==============================================================================
// SECURITY & DUAL GATE AUTHENTICATION (Google Corporate Sign-In + Passcode Fallback)
// Mandatory Passcode: "Cloudspac5"
// Corporate Domain: @google.com
// ==============================================================================
const REQUIRED_PASSWORD = "Cloudspac5";

const firebaseConfig = {
  apiKey: "AIzaSyCSfXvqsDb182855Qsvh1nbqThkOalDwLA",
  authDomain: "techno-machine.firebaseapp.com",
  projectId: "techno-machine",
  storageBucket: "techno-machine.firebasestorage.app",
  messagingSenderId: "478149822613",
  appId: "1:478149822613:web:ba07416fb03fda5fb1339c"
};

let firebaseAuthInstance = null;
let firebaseAppInstance = null;
let GoogleAuthProviderClass = null;
let signInWithPopupFn = null;
let signOutFn = null;

async function getFirebaseAuthService() {
  if (!firebaseAuthInstance) {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
    const { getAuth, GoogleAuthProvider, signInWithPopup, signOut } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
    firebaseAppInstance = initializeApp(firebaseConfig);
    firebaseAuthInstance = getAuth(firebaseAppInstance);
    GoogleAuthProviderClass = GoogleAuthProvider;
    signInWithPopupFn = signInWithPopup;
    signOutFn = signOut;
  }
  return {
    auth: firebaseAuthInstance,
    provider: new GoogleAuthProviderClass(),
    signInWithPopup: signInWithPopupFn,
    signOut: signOutFn
  };
}

function initAuthGate() {
  const authOverlay = document.getElementById('auth-overlay');
  const authCard = document.getElementById('authCard');
  const authForm = document.getElementById('authForm');
  const authPassword = document.getElementById('authPassword');
  const authStatusMsg = document.getElementById('authStatusMsg');
  const btnTogglePwd = document.getElementById('btnTogglePwd');
  const btnAuthUnlock = document.getElementById('btnAuthUnlock');
  const btnGoogleSignIn = document.getElementById('btnGoogleSignIn');
  const btnLockApp = document.getElementById('btnLockApp');
  const userProfilePill = document.getElementById('userProfilePill');
  const userAvatar = document.getElementById('userAvatar');
  const userEmailLabel = document.getElementById('userEmailLabel');

  if (!authOverlay) return;

  function renderUserProfile(user) {
    if (!userProfilePill) return;
    if (user && user.photoURL && userAvatar) {
      userAvatar.src = user.photoURL;
      userAvatar.style.display = 'inline-block';
    } else if (userAvatar) {
      userAvatar.style.display = 'none';
    }

    if (userEmailLabel) {
      userEmailLabel.textContent = user.email || user.displayName || 'Authorized';
    }
    userProfilePill.style.display = 'inline-flex';
  }

  function clearUserProfile() {
    if (userProfilePill) userProfilePill.style.display = 'none';
    if (userAvatar) userAvatar.src = '';
    if (userEmailLabel) userEmailLabel.textContent = '';
  }

  function isAuthGranted() {
    return sessionStorage.getItem('google_badge_auth') === 'granted';
  }

  function unlockApp() {
    sessionStorage.setItem('google_badge_auth', 'granted');
    authOverlay.classList.add('unlocked');
    setTimeout(() => {
      onWindowResize();
      startIntroXFlip();
      checkAndShowOnboarding();
    }, 250);
  }

  async function lockApp() {
    sessionStorage.removeItem('google_badge_auth');
    sessionStorage.removeItem('google_badge_user');
    clearUserProfile();

    if (firebaseAuthInstance && signOutFn) {
      try {
        await signOutFn(firebaseAuthInstance);
      } catch (err) {
        console.warn("Sign out err:", err);
      }
    }

    if (authPassword) authPassword.value = '';
    if (authStatusMsg) {
      authStatusMsg.textContent = '';
      authStatusMsg.className = 'auth-status-msg';
    }
    authOverlay.classList.remove('unlocked');
    setTimeout(() => {
      if (authPassword) authPassword.focus();
    }, 150);
  }

  // 1. Google Corporate Sign-in Handler (@google.com)
  if (btnGoogleSignIn) {
    btnGoogleSignIn.addEventListener('click', async () => {
      btnGoogleSignIn.disabled = true;
      if (authStatusMsg) {
        authStatusMsg.className = 'auth-status-msg';
        authStatusMsg.textContent = 'Connecting to Google Authentication...';
      }

      try {
        const { auth, provider, signInWithPopup, signOut } = await getFirebaseAuthService();
        provider.setCustomParameters({
          hd: 'google.com',
          prompt: 'select_account'
        });

        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const email = (user.email || '').toLowerCase().trim();

        if (email.endsWith('@google.com')) {
          const userData = {
            displayName: user.displayName || email.split('@')[0],
            email: email,
            photoURL: user.photoURL || ''
          };
          sessionStorage.setItem('google_badge_auth', 'granted');
          sessionStorage.setItem('google_badge_user', JSON.stringify(userData));
          renderUserProfile(userData);

          if (authStatusMsg) {
            authStatusMsg.className = 'auth-status-msg success';
            authStatusMsg.textContent = `✓ Signed in as ${email}. Initializing 3D engine...`;
          }
          setTimeout(() => {
            unlockApp();
          }, 350);
        } else {
          // Reject non-google.com domain
          await signOut(auth);
          if (authStatusMsg) {
            authStatusMsg.className = 'auth-status-msg error';
            authStatusMsg.textContent = `✕ ${email || 'Account'} is not an @google.com corporate account. Access restricted.`;
          }
          if (authCard) {
            authCard.classList.remove('shake');
            void authCard.offsetWidth;
            authCard.classList.add('shake');
          }
        }
      } catch (err) {
        console.warn("Google Auth error:", err);
        if (err.code === 'auth/popup-closed-by-user') {
          if (authStatusMsg) {
            authStatusMsg.className = 'auth-status-msg';
            authStatusMsg.textContent = 'Sign-in cancelled. You can also use the passcode below.';
          }
        } else if (err.code === 'auth/popup-blocked') {
          if (authStatusMsg) {
            authStatusMsg.className = 'auth-status-msg error';
            authStatusMsg.textContent = '✕ Sign-in popup was blocked. Please allow popups or use passcode.';
          }
        } else {
          if (authStatusMsg) {
            authStatusMsg.className = 'auth-status-msg error';
            authStatusMsg.textContent = `✕ Sign-in notice: ${err.message || 'Please use team passcode below.'}`;
          }
        }
      } finally {
        btnGoogleSignIn.disabled = false;
      }
    });
  }

  // 2. Secondary Passcode Fallback Handler ("Cloudspac5")
  function handlePasscodeSubmit() {
    const inputVal = authPassword ? authPassword.value.trim() : '';
    if (inputVal === REQUIRED_PASSWORD) {
      const userData = {
        displayName: 'Team Member',
        email: 'Demo Passcode',
        photoURL: ''
      };
      sessionStorage.setItem('google_badge_auth', 'granted');
      sessionStorage.setItem('google_badge_user', JSON.stringify(userData));
      renderUserProfile(userData);

      if (authStatusMsg) {
        authStatusMsg.className = 'auth-status-msg success';
        authStatusMsg.textContent = '✓ Passcode verified. Initializing 3D engine...';
      }
      if (authPassword) authPassword.classList.remove('error');
      setTimeout(() => {
        unlockApp();
      }, 350);
    } else {
      if (authStatusMsg) {
        authStatusMsg.className = 'auth-status-msg error';
        authStatusMsg.textContent = '✕ Incorrect passcode. Access restricted.';
      }
      if (authPassword) {
        authPassword.classList.add('error');
        authPassword.focus();
        authPassword.select();
      }
      if (authCard) {
        authCard.classList.remove('shake');
        void authCard.offsetWidth;
        authCard.classList.add('shake');
      }
    }
  }

  if (authForm) {
    authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handlePasscodeSubmit();
    });
  }

  if (btnAuthUnlock) {
    btnAuthUnlock.addEventListener('click', (e) => {
      e.preventDefault();
      handlePasscodeSubmit();
    });
  }

  if (btnTogglePwd && authPassword) {
    btnTogglePwd.addEventListener('click', () => {
      if (authPassword.type === 'password') {
        authPassword.type = 'text';
        btnTogglePwd.textContent = '🔒';
      } else {
        authPassword.type = 'password';
        btnTogglePwd.textContent = '👁️';
      }
    });
  }

  if (btnLockApp) {
    btnLockApp.addEventListener('click', () => {
      lockApp();
    });
  }

  // Check existing session on load
  if (isAuthGranted()) {
    const savedUser = sessionStorage.getItem('google_badge_user');
    if (savedUser) {
      try {
        renderUserProfile(JSON.parse(savedUser));
      } catch (e) {
        renderUserProfile({ email: 'Authorized' });
      }
    } else {
      renderUserProfile({ email: 'Authorized' });
    }
    unlockApp();
  } else {
    authOverlay.classList.remove('unlocked');
    setTimeout(() => {
      if (authPassword) authPassword.focus();
    }, 100);
  }
}

/**
 * First-Time User Onboarding Guide Dialog
 */
function initOnboardingModal() {
  const modal = document.getElementById('onboardingModal');
  const btnClose = document.getElementById('btnCloseOnboarding');
  const btnStart = document.getElementById('btnStartCustomizing');
  const chkDoNotShow = document.getElementById('chkDoNotShowAgain');
  const btnHelpGuide = document.getElementById('btnHelpGuide');

  if (!modal) return;

  function closeModal() {
    if (chkDoNotShow && chkDoNotShow.checked) {
      localStorage.setItem('google_badge_hide_onboarding_v1', 'true');
    }
    modal.close();
  }

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnStart) btnStart.addEventListener('click', closeModal);

  if (btnHelpGuide) {
    btnHelpGuide.addEventListener('click', () => {
      if (chkDoNotShow) {
        chkDoNotShow.checked = localStorage.getItem('google_badge_hide_onboarding_v1') === 'true';
      }
      modal.showModal();
    });
  }

  // Light dismiss fallback for browsers without native <dialog closedby="any">
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    modal.addEventListener('click', (event) => {
      if (event.target !== modal) return;
      const rect = modal.getBoundingClientRect();
      const isContent = (
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width
      );
      if (!isContent) closeModal();
    });
  }

  modal.addEventListener('close', () => {
    if (chkDoNotShow && chkDoNotShow.checked) {
      localStorage.setItem('google_badge_hide_onboarding_v1', 'true');
    }
  });
}

function checkAndShowOnboarding() {
  const modal = document.getElementById('onboardingModal');
  if (!modal) return;
  const hidePref = localStorage.getItem('google_badge_hide_onboarding_v1');
  if (hidePref !== 'true') {
    setTimeout(() => {
      if (modal.open) return;
      modal.showModal();
    }, 750);
  }
}


