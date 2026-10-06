/**
 * Google Badge Holder 3D Procedural CAD Generator
 * Ultra-Slim Minimalist Architecture:
 * - Fits standard CR80 credit card dimensions (54.0 x 85.6 x 0.82 mm)
 * - Exactly 3.0 mm bezel coverage on sides
 * - Smooth half-circle / circular quadrant corner plates (~15 mm diameter) instead of boxy rectangles
 * - User-selectable logo color (default White, auto-switches to Google Blue on white frames)
 * - Embossed logos with user-chosen color relief
 * - Ultra-slim total thickness: ~1.82 mm (Badge + 1.0 mm)
 */

// If running in Node, ensure THREE is available globally
if (typeof window === 'undefined') {
  global.THREE = require('./libs/three.min.js');
  require('./libs/STLExporter.js');
}

const BADGE_SPECS = {
  // CR80 credit card dimensions
  cardWidth: 54.0,
  cardHeight: 85.6,
  cardThickness: 0.82,
  cardRadius: 3.18,

  // Snug pocket specs with 1.30 mm slide-in clearance
  pocketWidth: 54.4,
  pocketHeight: 85.8,
  pocketDepth: 1.30,

  // Frame covers 3.0 mm on rails, with 18.0 mm diameter bed-anchored lower-right medallion disc
  bezelCoverage: 3.0,
  cornerDiscRadius: 7.5,
  medallionRadius: 9.0,  // 18 mm diameter solid disc centered over lower-right corner

  // Ultra-minimal outer envelope
  baseWidth: 56.8,       // 54.4 pocket + 2 x 1.2mm side walls
  baseHeight: 88.2,      // 85.8 pocket + 2 x 1.2mm bottom stop & rails
  backplateThickness: 0.50, // 0.5mm backplate (flat bed print)
  frontLipThickness: 0.45,  // 0.45mm retaining rails
  baseThickness: 2.25,   // 0.50 + 1.30 + 0.45 mm
  outerRadius: 3.0,

  // Compact top lanyard tab with 14.0 x 3.0 mm standard clip slot
  tabWidth: 26.0,
  tabHeight: 7.0,
  slotWidth: 14.0,
  slotHeight: 3.0,
  slotRadius: 1.5,

  // Thumb slide-out slot on backplate
  thumbWidth: 16.0,
  thumbHeight: 28.0,
  thumbY: -6.0,
};

/**
 * Creates a 2D rounded rectangle path (for cutouts/holes)
 */
function createRoundedRectPath(width, height, radius, centerX = 0, centerY = 0) {
  const path = new THREE.Path();
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  const w = width;
  const h = height;
  const r = Math.min(radius, width / 2, height / 2);

  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);

  return path;
}

/**
 * Creates a U-channel path (open at the top) for top-loading slide-in card pockets
 */
function createUChannelPath(width, bottomY, topY, radius) {
  const path = new THREE.Path();
  const halfW = width / 2;
  const r = Math.min(radius, halfW);

  path.moveTo(-halfW, topY);
  path.lineTo(-halfW, bottomY + r);
  path.quadraticCurveTo(-halfW, bottomY, -halfW + r, bottomY);
  path.lineTo(halfW - r, bottomY);
  path.quadraticCurveTo(halfW, bottomY, halfW, bottomY + r);
  path.lineTo(halfW, topY);
  path.closePath();

  return path;
}

/**
 * Creates 2D contour for the bed-anchored lower-right medallion disc (18 mm diameter).
 * Centered directly over the frame corner (cx, cy) and trimmed by the card pocket boundary (px, py)
 * so that it is 100% solid from bed to top face without intruding into the card pocket.
 */
function createMedallionShape(specs = BADGE_SPECS) {
  const cx = specs.baseWidth / 2;
  const cy = -specs.baseHeight / 2;
  const px = specs.pocketWidth / 2;
  const py = -specs.pocketHeight / 2;
  const r = specs.medallionRadius || 9.0;

  const dy = Math.sqrt(Math.max(0, r * r - (px - cx) * (px - cx)));
  const y1 = cy + dy;

  const dx = Math.sqrt(Math.max(0, r * r - (py - cy) * (py - cy)));
  const x2 = cx - dx;

  const shape = new THREE.Shape();
  const startAngle = Math.atan2(y1 - cy, px - cx);
  const endAngle = Math.atan2(py - cy, x2 - cx);

  // Outer circle arc from startAngle clockwise to endAngle
  shape.moveTo(px, y1);
  shape.absarc(cx, cy, r, startAngle, endAngle, true);
  shape.lineTo(px, py);
  shape.lineTo(px, y1);
  shape.closePath();

  return shape;
}

/**
 * Creates side rail 2D shape (left or right) matching outer perimeter contour (plain or wave)
 * Completely eliminates hole-boundary collision artifacts!
 */
function createSideRailShape(side, frameStyle, widthExtension, specs = BADGE_SPECS) {
  const w = specs.baseWidth, h = specs.baseHeight, r = specs.outerRadius;
  const halfW = w / 2, halfH = h / 2;
  const shape = new THREE.Shape();
  const innerX = (side === 'left') ? (-halfW + widthExtension) : (halfW - widthExtension);

  if (side === 'left') {
    shape.moveTo(innerX, -halfH);
    shape.lineTo(-halfW + r, -halfH);
    shape.quadraticCurveTo(-halfW, -halfH, -halfW, -halfH + r);
    if (frameStyle === 'wave') {
      const y0 = -halfH + r, y1 = halfH - r, totalH = y1 - y0, waveCount = 3, waveH = totalH / waveCount, flare = 2.0;
      for (let i = 0; i < waveCount; i++) {
        const startY = y0 + i * waveH, endY = y0 + (i + 1) * waveH;
        shape.bezierCurveTo(-halfW - flare, startY + waveH * 0.25, -halfW - flare, startY + waveH * 0.75, -halfW, endY);
      }
    } else {
      shape.lineTo(-halfW, halfH - r);
    }
    shape.quadraticCurveTo(-halfW, halfH, -halfW + r, halfH);
    if (widthExtension > specs.wallThickness) {
      shape.lineTo(innerX - 1.5, halfH);
      shape.lineTo(innerX, halfH - 3.5);
    } else {
      shape.lineTo(innerX, halfH);
    }
    shape.closePath();
  } else {
    shape.moveTo(innerX, -halfH);
    shape.lineTo(halfW - r, -halfH);
    shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);
    if (frameStyle === 'wave') {
      const y0 = -halfH + r, y1 = halfH - r, totalH = y1 - y0, waveCount = 3, waveH = totalH / waveCount, flare = 2.0;
      for (let i = 0; i < waveCount; i++) {
        const startY = y0 + i * waveH, endY = y0 + (i + 1) * waveH;
        shape.bezierCurveTo(halfW + flare, startY + waveH * 0.25, halfW + flare, startY + waveH * 0.75, halfW, endY);
      }
    } else {
      shape.lineTo(halfW, halfH - r);
    }
    shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);
    if (widthExtension > specs.wallThickness) {
      shape.lineTo(innerX + 1.5, halfH);
      shape.lineTo(innerX, halfH - 3.5);
    } else {
      shape.lineTo(innerX, halfH);
    }
    shape.closePath();
  }
  return shape;
}

/**
 * Creates 2D tab shape with standard lanyard clip slot
 */
function createTabShape(specs = BADGE_SPECS) {
  const tw = specs.tabWidth, th = specs.tabHeight;
  const shape = new THREE.Shape();
  shape.moveTo(-tw / 2, 0);
  shape.lineTo(tw / 2, 0);
  shape.lineTo(tw / 2, th - 2.5);
  shape.quadraticCurveTo(tw / 2, th, tw / 2 - 2.5, th);
  shape.lineTo(-tw / 2 + 2.5, th);
  shape.quadraticCurveTo(-tw / 2, th, -tw / 2, th - 2.5);
  shape.closePath();

  const slotHole = createPillPath(specs.slotWidth, specs.slotHeight, 0, th / 2);
  shape.holes.push(slotHole);
  return shape;
}

/**
 * Creates a 2D rounded rectangle shape with optional cutouts
 */
function createRoundedRectShape(width, height, radius) {
  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const w = width;
  const h = height;
  const r = Math.min(radius, width / 2, height / 2);

  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);

  return shape;
}

/**
 * Creates the outer silhouette path with the integrated compact lanyard tab
 */
function createMinimalFrameOuterShape(frameStyle, specs = BADGE_SPECS) {
  const w = specs.baseWidth;
  const h = specs.baseHeight;
  const r = specs.outerRadius;
  const tw = specs.tabWidth;
  const th = specs.tabHeight;
  const halfW = w / 2;
  const halfH = h / 2;

  const shape = new THREE.Shape();

  // Start bottom-left
  shape.moveTo(-halfW + r, -halfH);

  // Bottom edge
  shape.lineTo(halfW - r, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + r);

  // Right edge (Wave vs Plain)
  if (frameStyle === 'wave') {
    const y0 = -halfH + r;
    const y1 = halfH - r;
    const totalH = y1 - y0;
    const waveCount = 3;
    const waveH = totalH / waveCount;
    const flare = 2.0; // Ergonomic finger wave crest

    for (let i = 0; i < waveCount; i++) {
      const startY = y0 + i * waveH;
      const endY = y0 + (i + 1) * waveH;
      shape.bezierCurveTo(
        halfW + flare, startY + waveH * 0.25,
        halfW + flare, startY + waveH * 0.75,
        halfW, endY
      );
    }
  } else {
    // Plain straight edge
    shape.lineTo(halfW, halfH - r);
  }

  shape.quadraticCurveTo(halfW, halfH, halfW - r, halfH);

  // Top edge to right shoulder of lanyard tab
  shape.lineTo(tw / 2 + 2.0, halfH);
  shape.quadraticCurveTo(tw / 2, halfH, tw / 2, halfH + 2.0);

  // Up right side of lanyard tab
  shape.lineTo(tw / 2, halfH + th - 2.5);
  shape.quadraticCurveTo(tw / 2, halfH + th, tw / 2 - 2.5, halfH + th);

  // Top edge of tab
  shape.lineTo(-tw / 2 + 2.5, halfH + th);
  shape.quadraticCurveTo(-tw / 2, halfH + th, -tw / 2, halfH + th - 2.5);

  // Down left side of tab
  shape.lineTo(-tw / 2, halfH + 2.0);
  shape.quadraticCurveTo(-tw / 2, halfH, -tw / 2 - 2.0, halfH);

  // Top left edge
  shape.lineTo(-halfW + r, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - r);

  // Left edge (Wave vs Plain)
  if (frameStyle === 'wave') {
    const y0 = -halfH + r;
    const y1 = halfH - r;
    const totalH = y1 - y0;
    const waveCount = 3;
    const waveH = totalH / waveCount;
    const flare = 2.0;

    for (let i = waveCount - 1; i >= 0; i--) {
      const startY = y0 + (i + 1) * waveH;
      const endY = y0 + i * waveH;
      shape.bezierCurveTo(
        -halfW - flare, startY - waveH * 0.25,
        -halfW - flare, startY - waveH * 0.75,
        -halfW, endY
      );
    }
  } else {
    // Plain straight edge
    shape.lineTo(-halfW, -halfH + r);
  }

  shape.quadraticCurveTo(-halfW, -halfH, -halfW + r, -halfH);

  return shape;
}

/**
 * Creates a 2D pill path (for lanyard slot or thumb cutout)
 */
function createPillPath(width, height, centerX = 0, centerY = 0) {
  const path = new THREE.Path();
  const r = height / 2;
  const halfW = width / 2 - r;

  path.moveTo(centerX - halfW, centerY - r);
  path.lineTo(centerX + halfW, centerY - r);
  path.absarc(centerX + halfW, centerY, r, -Math.PI / 2, Math.PI / 2, false);
  path.lineTo(centerX - halfW, centerY + r);
  path.absarc(centerX - halfW, centerY, r, Math.PI / 2, -Math.PI / 2, false);

  return path;
}

/**
 * Hex honeycomb cutouts through backplate for Hex-Matrix style
 */
function createHexGridPaths() {
  const paths = [];
  const hexRadius = 3.2;
  const spacingX = hexRadius * Math.sqrt(3) + 1.0;
  const spacingY = hexRadius * 1.5 + 1.0;

  for (let row = -5; row <= 5; row++) {
    const y = row * spacingY - 4.0;
    const xOffset = (row % 2 === 0) ? 0 : spacingX / 2;
    for (let col = -3; col <= 3; col++) {
      const x = col * spacingX + xOffset;

      // Restrict within pocket boundary with 3mm margin
      if (Math.abs(x) > 20 || y > 34 || y < -36) continue;
      // Avoid thumb slot center
      if (Math.abs(x) < 7 && Math.abs(y - BADGE_SPECS.thumbY) < 14) continue;

      const hex = new THREE.Path();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i + Math.PI / 6;
        const px = x + hexRadius * Math.cos(angle);
        const py = y + hexRadius * Math.sin(angle);
        if (i === 0) hex.moveTo(px, py);
        else hex.lineTo(px, py);
      }
      hex.closePath();
      paths.push(hex);
    }
  }
  return paths;
}

/**
 * Parametric 2D vector shapes for the top 5 Google Services
 * Scaled to fill ~12.5 mm inside the 15 mm circular disc
 */
function getDirectServiceShapes(serviceName) {
  const name = serviceName.toLowerCase();
  const shapes = [];

  if (name.includes('cloud')) {
    // Google Cloud silhouette (scaled ~12.5 mm)
    const cloud = new THREE.Shape();
    cloud.moveTo(-5.4, -2.2);
    cloud.lineTo(5.4, -2.2);
    cloud.absarc(4.2, 0.0, 2.5, -Math.PI / 2, Math.PI / 4, false);
    cloud.absarc(1.8, 2.5, 3.0, 0, Math.PI * 0.75, false);
    cloud.absarc(-2.2, 1.8, 2.7, Math.PI * 0.3, Math.PI * 0.95, false);
    cloud.absarc(-4.2, -0.2, 2.2, Math.PI * 0.8, Math.PI * 1.5, false);
    cloud.closePath();
    shapes.push(cloud);
  } else if (name.includes('android')) {
    // Android Bugdroid Head (scaled ~12.5 mm)
    const head = new THREE.Shape();
    head.absarc(0, -1.0, 5.2, 0, Math.PI, false);
    head.lineTo(-5.2, -1.0);
    head.closePath();
    shapes.push(head);

    // Left antenna
    const antL = new THREE.Shape();
    antL.moveTo(-2.5, 3.6);
    antL.lineTo(-4.1, 6.2);
    antL.lineTo(-3.4, 6.5);
    antL.lineTo(-2.0, 4.0);
    antL.closePath();
    shapes.push(antL);

    // Right antenna
    const antR = new THREE.Shape();
    antR.moveTo(2.5, 3.6);
    antR.lineTo(4.1, 6.2);
    antR.lineTo(3.4, 6.5);
    antR.lineTo(2.0, 4.0);
    antR.closePath();
    shapes.push(antR);
  } else if (name.includes('chrome')) {
    // Chrome circular emblem (scaled ~12.5 mm)
    const outerRing = new THREE.Shape();
    outerRing.absarc(0, 0, 5.5, 0, Math.PI * 2, false);
    const innerHole = new THREE.Path();
    innerHole.absarc(0, 0, 2.7, 0, Math.PI * 2, true);
    outerRing.holes.push(innerHole);
    shapes.push(outerRing);

    // Center core
    const core = new THREE.Shape();
    core.absarc(0, 0, 1.6, 0, Math.PI * 2, false);
    shapes.push(core);
  } else if (name.includes('youtube')) {
    // YouTube TV badge (scaled ~12.5 mm)
    const tv = new THREE.Shape();
    const w = 11.5;
    const h = 8.0;
    const r = 2.1;
    tv.moveTo(-w / 2 + r, -h / 2);
    tv.lineTo(w / 2 - r, -h / 2);
    tv.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    tv.lineTo(w / 2, h / 2 - r);
    tv.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    tv.lineTo(-w / 2 + r, h / 2);
    tv.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    tv.lineTo(-w / 2, -h / 2 + r);
    tv.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

    // Play triangle cutout inside
    const tri = new THREE.Path();
    tri.moveTo(-1.6, -2.1);
    tri.lineTo(2.8, 0.0);
    tri.lineTo(-1.6, 2.1);
    tri.closePath();
    tv.holes.push(tri);
    shapes.push(tv);
  } else {
    // Google DeepMind / Gemini 4-Point Sparkle Star (scaled ~12.5 mm)
    const star = new THREE.Shape();
    const rOuter = 5.8;
    const rInner = 1.4;
    star.moveTo(0, rOuter);
    star.quadraticCurveTo(rInner * 0.4, rInner * 0.4, rOuter, 0);
    star.quadraticCurveTo(rInner * 0.4, -rInner * 0.4, 0, -rOuter);
    star.quadraticCurveTo(-rInner * 0.4, -rInner * 0.4, -rOuter, 0);
    star.quadraticCurveTo(-rInner * 0.4, rInner * 0.4, 0, rOuter);
    star.closePath();
    shapes.push(star);
  }

  return shapes;
}

/**
 * Creates emblem 3D mesh for the corner (Max 15x15mm, Embossed with user-chosen color)
 */
function createEmblemMesh(serviceName, isEmbossed, corner, customSvgShapes, bodyMaterial, logoMaterial, specs = BADGE_SPECS) {
  let shapes = customSvgShapes;
  if (!shapes || shapes.length === 0) {
    shapes = getDirectServiceShapes(serviceName);
  }
  if (!shapes || shapes.length === 0) return null;

  const extrudeDepth = isEmbossed ? 0.60 : 0.50; // 0.60 mm for multi-material AMS volumetric lock
  const extrudeSettings = {
    depth: extrudeDepth,
    bevelEnabled: false,
    steps: 1
  };

  const geom = new THREE.ExtrudeGeometry(shapes, extrudeSettings);
  geom.computeBoundingBox();
  geom.center();

  // Position at the 15 mm circular disc center (top discs shifted down 3mm for top slide-in clearance)
  const topDrop = 3.0;
  const cornerX = specs.baseWidth / 2 - specs.cornerDiscRadius;
  const cornerY = specs.baseHeight / 2 - specs.cornerDiscRadius;

  let posX = 0;
  let posY = 0;
  switch (corner) {
    case 'top-left':
      posX = -cornerX;
      posY = cornerY - topDrop;
      break;
    case 'top-right':
      posX = cornerX;
      posY = cornerY - topDrop;
      break;
    case 'bottom-left':
      posX = -cornerX;
      posY = -cornerY;
      break;
    case 'bottom-right':
    default:
      posX = specs.baseWidth / 2;
      posY = -specs.baseHeight / 2;
      break;
  }

  // Embossed with user's chosen logo color!
  const emblemMat = isEmbossed ? logoMaterial : bodyMaterial.clone().multiplyScalar(0.7);

  // Embossed: penetrates 0.20 mm (1 full layer at 0.20 mm) into the solid medallion disc,
  // and stands 0.40 mm (2 full layers) proudly above the front face.
  // This multi-material overlap locks the color into Bambu Studio / AMS without dropping during slicing!
  // Debossed: inset 0.50 mm into the front plate
  const overlap = 0.20;
  const posZ = isEmbossed ? (specs.baseThickness - overlap + extrudeDepth / 2) : (specs.baseThickness - extrudeDepth / 2);

  const mesh = new THREE.Mesh(geom, emblemMat);
  mesh.position.set(posX, posY, posZ);
  mesh.name = `EmblemMesh_${corner}`;
  mesh.userData = { isEmbossed, corner, serviceName };

  return mesh;
}

/**
 * Builds the complete Ultra-Slim Minimal Badge Holder 3D Assembly
 * - Half-circle / circular quadrant corner discs (~15 mm diameter)
 * - User-selectable logo color for embossed emblems
 * - Fully parametric dimensional custom fit support
 */
function createBadgeHolderAssembly(options = {}) {
  const {
    frameStyle = 'minimalist',
    colorHex = '#4285F4',
    logoColorHex = null, // User-selected logo color
    corners = null,      // Object: { 'top-left': 'cloud', ... }
    service = 'cloud',
    corner = 'bottom-right',
    isEmbossed = true,
    customShapes = null,
    specs: inputSpecs = null
  } = options;

  // Resolve parametric dimensions merging input overrides with BADGE_SPECS defaults
  const custom = inputSpecs || {};
  const pocketWidth = Number(custom.pocketWidth ?? BADGE_SPECS.pocketWidth);
  const pocketHeight = Number(custom.pocketHeight ?? BADGE_SPECS.pocketHeight);
  const pocketDepth = Number(custom.pocketDepth ?? BADGE_SPECS.pocketDepth);
  const wallThickness = Number(custom.wallThickness ?? 1.2);
  const backplateThickness = Number(custom.backplateThickness ?? BADGE_SPECS.backplateThickness);
  const frontLipThickness = Number(custom.frontLipThickness ?? BADGE_SPECS.frontLipThickness);
  const bezelCoverage = Number(custom.bezelCoverage ?? BADGE_SPECS.bezelCoverage);
  const slotWidth = Number(custom.slotWidth ?? BADGE_SPECS.slotWidth);
  const slotHeight = Number(custom.slotHeight ?? BADGE_SPECS.slotHeight);
  const thumbWidth = Number(custom.thumbWidth ?? BADGE_SPECS.thumbWidth);
  const thumbHeight = Number(custom.thumbHeight ?? BADGE_SPECS.thumbHeight);

  const baseWidth = Number(custom.baseWidth ?? (pocketWidth + 2 * wallThickness));
  const bottomWallH = Number(custom.bottomWallH ?? 1.2);
  const baseHeight = Number(custom.baseHeight ?? (pocketHeight + 2 * bottomWallH));
  const baseThickness = backplateThickness + pocketDepth + frontLipThickness;

  const specs = {
    ...BADGE_SPECS,
    ...custom,
    pocketWidth,
    pocketHeight,
    pocketDepth,
    wallThickness,
    backplateThickness,
    frontLipThickness,
    bezelCoverage,
    slotWidth,
    slotHeight,
    thumbWidth,
    thumbHeight,
    baseWidth,
    bottomWallH,
    baseHeight,
    baseThickness
  };

  const holderGroup = new THREE.Group();
  holderGroup.name = "BadgeHolderAssembly";

  // Frame Body Material
  const mainColor = new THREE.Color(colorHex);
  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: mainColor,
    roughness: 0.42,
    metalness: 0.06
  });

  // Logo Material (Default is White, unless frame is White, then default is Google Blue)
  const isFrameWhite = (colorHex.toUpperCase() === '#F8F9FA' || colorHex.toUpperCase() === '#FFFFFF');
  const defaultLogoColor = isFrameWhite ? '#4285F4' : '#FFFFFF';
  const effectiveLogoColor = logoColorHex || defaultLogoColor;

  const logoMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(effectiveLogoColor),
    roughness: 0.32,
    metalness: 0.08
  });

  // 1. Backplate with lanyard slot and thumb cutout
  const outerShape = createMinimalFrameOuterShape(frameStyle, specs);
  const slotCenterY = specs.baseHeight / 2 + specs.tabHeight / 2;

  // Lanyard slot in top tab
  const lanyardHole = createPillPath(
    specs.slotWidth,
    specs.slotHeight,
    0,
    slotCenterY
  );
  outerShape.holes.push(lanyardHole);

  // Thumb push cutout in backplate to slide card out
  const thumbHole = createPillPath(
    specs.thumbWidth,
    specs.thumbHeight,
    0,
    specs.thumbY
  );
  outerShape.holes.push(thumbHole);

  const backplateExtrude = {
    depth: specs.backplateThickness,
    bevelEnabled: false,
    steps: 1
  };

  const backplateGeom = new THREE.ExtrudeGeometry(outerShape, backplateExtrude);
  const backplateMesh = new THREE.Mesh(backplateGeom, bodyMaterial);
  backplateMesh.name = "Backplate";
  holderGroup.add(backplateMesh);

  // 2. Pocket Walls & Spacer (Depth: specs.pocketDepth, open at top for slide-in badge insertion)
  const wallZ = specs.backplateThickness;

  // Left Wall
  const wallLeftGeo = new THREE.ExtrudeGeometry(createSideRailShape('left', frameStyle, wallThickness, specs), { depth: specs.pocketDepth, bevelEnabled: false });
  const wallLeftMesh = new THREE.Mesh(wallLeftGeo, bodyMaterial);
  wallLeftMesh.position.z = wallZ;
  wallLeftMesh.name = "WallLeft";
  holderGroup.add(wallLeftMesh);

  // Right Wall
  const wallRightGeo = new THREE.ExtrudeGeometry(createSideRailShape('right', frameStyle, wallThickness, specs), { depth: specs.pocketDepth, bevelEnabled: false });
  const wallRightMesh = new THREE.Mesh(wallRightGeo, bodyMaterial);
  wallRightMesh.position.z = wallZ;
  wallRightMesh.name = "WallRight";
  holderGroup.add(wallRightMesh);

  // Bottom Wall (Card stop)
  const bottomWallGeo = new THREE.BoxGeometry(specs.baseWidth, bottomWallH, specs.pocketDepth);
  const bottomWallMesh = new THREE.Mesh(bottomWallGeo, bodyMaterial);
  bottomWallMesh.position.set(0, -specs.baseHeight / 2 + bottomWallH / 2, wallZ + specs.pocketDepth / 2);
  bottomWallMesh.name = "WallBottom";
  holderGroup.add(bottomWallMesh);

  // 2b. Internal Friction Retention Nubs (Vertical ribs anchored to backplate - zero floating cantilevers)
  const nubProtrusion = 0.35;
  const nubLength = 6.0;
  const nubY = specs.baseHeight / 2 - 22.0;

  function createVerticalNubShape(side) {
    const s = new THREE.Shape();
    const halfL = nubLength / 2;
    const sign = (side === 'left') ? 1 : -1;
    s.moveTo(0, -halfL);
    s.quadraticCurveTo(sign * nubProtrusion, -halfL / 2, sign * nubProtrusion, 0);
    s.quadraticCurveTo(sign * nubProtrusion, halfL / 2, 0, halfL);
    s.closePath();
    return s;
  }

  const nubExtrude = { depth: specs.pocketDepth, bevelEnabled: false };
  const nubLeftGeo = new THREE.ExtrudeGeometry(createVerticalNubShape('left'), nubExtrude);
  const nubLeftMesh = new THREE.Mesh(nubLeftGeo, bodyMaterial);
  nubLeftMesh.position.set(-specs.pocketWidth / 2, nubY, wallZ);
  nubLeftMesh.name = "FrictionNubLeft";
  holderGroup.add(nubLeftMesh);

  const nubRightGeo = new THREE.ExtrudeGeometry(createVerticalNubShape('right'), nubExtrude);
  const nubRightMesh = new THREE.Mesh(nubRightGeo, bodyMaterial);
  nubRightMesh.position.set(specs.pocketWidth / 2, nubY, wallZ);
  nubRightMesh.name = "FrictionNubRight";
  holderGroup.add(nubRightMesh);

  // 3. Front Retaining Bezel (Open at top for zero-bending straight drop-in)
  const frontZ = specs.backplateThickness + specs.pocketDepth;
  const frontLipWidth = wallThickness + specs.bezelCoverage;

  // Left Front Rail
  const frontLeftGeo = new THREE.ExtrudeGeometry(createSideRailShape('left', frameStyle, frontLipWidth, specs), { depth: frontLipThickness, bevelEnabled: false });
  const frontLeftMesh = new THREE.Mesh(frontLeftGeo, bodyMaterial);
  frontLeftMesh.position.z = frontZ;
  frontLeftMesh.name = "FrontLeftRail";
  holderGroup.add(frontLeftMesh);

  // Right Front Rail
  const frontRightGeo = new THREE.ExtrudeGeometry(createSideRailShape('right', frameStyle, frontLipWidth, specs), { depth: frontLipThickness, bevelEnabled: false });
  const frontRightMesh = new THREE.Mesh(frontRightGeo, bodyMaterial);
  frontRightMesh.position.z = frontZ;
  frontRightMesh.name = "FrontRightRail";
  holderGroup.add(frontRightMesh);

  // Bottom Front Lip
  const frontBottomH = bottomWallH + specs.bezelCoverage;
  const frontBottomGeo = new THREE.BoxGeometry(specs.baseWidth, frontBottomH, frontLipThickness);
  const frontBottomMesh = new THREE.Mesh(frontBottomGeo, bodyMaterial);
  frontBottomMesh.position.set(0, -specs.baseHeight / 2 + frontBottomH / 2, frontZ + frontLipThickness / 2);
  frontBottomMesh.name = "FrontBottomLip";
  holderGroup.add(frontBottomMesh);

  // 4. Single Bed-Anchored Lower-Right Corner Medallion Disc
  // Centered directly over the frame corner (cx, cy) and printed continuously on all layers from bed (Z=0) to top (Z=baseThickness)
  // Flush with the front face, zero hovering, zero cantilevers!
  const medallionShape = createMedallionShape(specs);
  const medallionExtrude = { depth: specs.baseThickness, bevelEnabled: false, steps: 1 };
  const medallionGeom = new THREE.ExtrudeGeometry(medallionShape, medallionExtrude);
  const medallionMesh = new THREE.Mesh(medallionGeom, bodyMaterial);
  medallionMesh.name = "CornerDisc_0"; // Grouped into Badge_Holder_Frame in 3MF
  holderGroup.add(medallionMesh);

  // 5. Single Lower-Right Corner Logo (Embossed on the bed-anchored medallion)
  const chosenService = (corners && corners['bottom-right'] && corners['bottom-right'] !== 'none')
    ? corners['bottom-right']
    : ((corners && corners['top-left'] && corners['top-left'] !== 'none')
      ? corners['top-left']
      : (service && service !== 'none' ? service : 'cloud'));

  if (chosenService && chosenService !== 'none') {
    const emblemMesh = createEmblemMesh(chosenService, isEmbossed, 'bottom-right', customShapes, bodyMaterial, logoMaterial, specs);
    if (emblemMesh) {
      holderGroup.add(emblemMesh);
    }
  }

  holderGroup.userData = { specs };
  return holderGroup;
}

/**
 * Formats a hex color to 3MF 8-digit RGBA hex string
 */
function format3MFColor(hex) {
  let clean = (hex || '#4285F4').replace('#', '').toUpperCase();
  if (clean.length === 6) clean += 'FF';
  return '#' + clean;
}

/**
 * Extracts world-space vertices and triangle indices from an array of Three.js meshes
 * Employs spatial vertex welding / deduplication to guarantee watertight manifold geometry
 * (eliminating unstitched/open edges in 3MF)
 */
function extract3MFGeometryData(meshes) {
  const vertices = [];
  const triangles = [];
  const vertexMap = new Map();

  function getOrAddVertex(x, y, z) {
    // 3 decimal places (0.001 mm tolerance) welds duplicate vertices across touching meshes
    const key = x.toFixed(3) + '_' + y.toFixed(3) + '_' + z.toFixed(3);
    if (vertexMap.has(key)) {
      return vertexMap.get(key);
    }
    const idx = vertices.length;
    vertices.push(x.toFixed(4) + ' ' + y.toFixed(4) + ' ' + z.toFixed(4));
    vertexMap.set(key, idx);
    return idx;
  }

  meshes.forEach(mesh => {
    mesh.updateMatrixWorld(true);
    const geom = mesh.geometry.clone();
    geom.applyMatrix4(mesh.matrixWorld);

    const pos = geom.attributes.position;
    const index = geom.index;

    const triCount = index ? index.count / 3 : pos.count / 3;
    for (let i = 0; i < triCount; i++) {
      const i1 = index ? index.getX(i * 3) : i * 3;
      const i2 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
      const i3 = index ? index.getX(i * 3 + 2) : i * 3 + 2;

      const v1 = getOrAddVertex(pos.getX(i1), pos.getY(i1), pos.getZ(i1));
      const v2 = getOrAddVertex(pos.getX(i2), pos.getY(i2), pos.getZ(i2));
      const v3 = getOrAddVertex(pos.getX(i3), pos.getY(i3), pos.getZ(i3));

      // Filter degenerate zero-area triangles
      if (v1 !== v2 && v2 !== v3 && v3 !== v1) {
        triangles.push({ v1, v2, v3 });
      }
    }
  });

  return { vertices, triangles };
}

/**
 * Generates a multi-material .3MF package compatible with all Maker Space slicers
 * Supports both Universal 3MF and Native Bambu Studio project bundles
 */
async function generate3MFPackage(THREE, JSZip, assembly, options = {}) {
  const frameHex = options.colorHex || '#4285F4';
  const logoHex = options.logoColorHex || '#FFFFFF';
  const isBambu = !!options.isBambu;

  const frameMeshes = assembly.children.filter(c => !c.name || !c.name.startsWith('EmblemMesh_'));
  const emblemMeshes = assembly.children.filter(c => c.name && c.name.startsWith('EmblemMesh_'));

  const frameData = extract3MFGeometryData(frameMeshes);
  const emblemData = extract3MFGeometryData(emblemMeshes);
  const hasEmblems = emblemData.vertices.length > 0;

  let modelXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  modelXml += '<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:m="http://schemas.microsoft.com/3dmanufacturing/material/2015/02">\n';
  modelXml += '  <metadata name="Title">Google Badge Holder</metadata>\n';
  modelXml += '  <metadata name="Application">Google Badge 3D Customizer</metadata>\n';
  modelXml += '  <metadata name="Designer">Google Badge 3D Customizer</metadata>\n';
  modelXml += '  <resources>\n';
  modelXml += '    <m:colorgroup id="1">\n';
  modelXml += '      <m:color color="' + format3MFColor(frameHex) + '"/>\n';
  modelXml += '      <m:color color="' + format3MFColor(logoHex) + '"/>\n';
  modelXml += '    </m:colorgroup>\n';

  // Object 2: Badge Holder Frame
  modelXml += '    <object id="2" type="model" name="Badge_Holder_Frame" pid="1" pindex="0">\n';
  modelXml += '      <mesh>\n';
  modelXml += '        <vertices>\n';
  frameData.vertices.forEach(v => {
    const p = v.split(' ');
    modelXml += '          <vertex x="' + p[0] + '" y="' + p[1] + '" z="' + p[2] + '"/>\n';
  });
  modelXml += '        </vertices>\n';
  modelXml += '        <triangles>\n';
  frameData.triangles.forEach(t => {
    modelXml += '          <triangle v1="' + t.v1 + '" v2="' + t.v2 + '" v3="' + t.v3 + '"/>\n';
  });
  modelXml += '        </triangles>\n';
  modelXml += '      </mesh>\n';
  modelXml += '    </object>\n';

  if (hasEmblems) {
    // Object 3: Corner Emblems
    modelXml += '    <object id="3" type="model" name="Corner_Emblems" pid="1" pindex="1">\n';
    modelXml += '      <mesh>\n';
    modelXml += '        <vertices>\n';
    emblemData.vertices.forEach(v => {
      const p = v.split(' ');
      modelXml += '          <vertex x="' + p[0] + '" y="' + p[1] + '" z="' + p[2] + '"/>\n';
    });
    modelXml += '        </vertices>\n';
    modelXml += '        <triangles>\n';
    emblemData.triangles.forEach(t => {
      modelXml += '          <triangle v1="' + t.v1 + '" v2="' + t.v2 + '" v3="' + t.v3 + '"/>\n';
    });
    modelXml += '        </triangles>\n';
    modelXml += '      </mesh>\n';
    modelXml += '    </object>\n';

    // Object 4: Assembly Component combining Frame and Emblems
    modelXml += '    <object id="4" type="model" name="Google_Badge_Holder">\n';
    modelXml += '      <components>\n';
    modelXml += '        <component objectid="2"/>\n';
    modelXml += '        <component objectid="3"/>\n';
    modelXml += '      </components>\n';
    modelXml += '    </object>\n';
  }

  modelXml += '  </resources>\n';
  modelXml += '  <build>\n';
  modelXml += '    <item objectid="' + (hasEmblems ? '4' : '2') + '"/>\n';
  modelXml += '  </build>\n';
  modelXml += '</model>\n';

  const zip = new JSZip();
  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
    '  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>\n' +
    (isBambu ? '  <Default Extension="config" ContentType="text/xml"/>\n' : '') +
    '</Types>\n'
  );
  zip.folder('_rels').file('.rels',
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    '  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n' +
    '</Relationships>\n'
  );
  zip.folder('3D').file('3dmodel.model', modelXml);

  if (isBambu) {
    const modelSettingsXml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<config>\n' +
      '  <object id="2">\n' +
      '    <metadata key="name" value="Badge_Holder_Frame"/>\n' +
      '    <metadata key="extruder" value="1"/>\n' +
      '  </object>\n' +
      (hasEmblems ?
        '  <object id="3">\n' +
        '    <metadata key="name" value="Corner_Emblems"/>\n' +
        '    <metadata key="extruder" value="2"/>\n' +
        '  </object>\n' : '') +
      '  <plate>\n' +
      '    <metadata key="plater_id" value="1"/>\n' +
      '    <metadata key="plater_name" value=""/>\n' +
      '    <metadata key="locked" value="false"/>\n' +
      '  </plate>\n' +
      '</config>\n';

    const sliceInfoXml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<config>\n' +
      '  <header>\n' +
      '    <header_version>1</header_version>\n' +
      '  </header>\n' +
      '  <plate>\n' +
      '    <index>1</index>\n' +
      '    <prediction>1</prediction>\n' +
      '    <weight>15.2</weight>\n' +
      '  </plate>\n' +
      '</config>\n';

    zip.folder('Metadata').file('model_settings.config', modelSettingsXml);
    zip.folder('Metadata').file('slice_info.config', sliceInfoXml);
  }

  return await zip.generateAsync({
    type: (typeof window === 'undefined') ? 'nodebuffer' : 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

// Export for module/browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BADGE_SPECS,
    createBadgeHolderAssembly,
    getDirectServiceShapes,
    generate3MFPackage
  };
}
if (typeof window !== 'undefined') {
  window.generate3MFPackage = generate3MFPackage;
}
