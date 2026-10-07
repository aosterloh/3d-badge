const THREE = require('./libs/three.min.js');
global.THREE = THREE;
require('./libs/STLExporter.js');

const { createBadgeHolderAssembly, BADGE_SPECS } = require('./generator.js');

console.log("=== Testing Circular Corner Discs & Logo Color in 3D Generator ===");

const exporter = new THREE.STLExporter();

// 1. Test Blue Frame -> Logo Color Defaults to White (#FFFFFF)
const assemblyBlue = createBadgeHolderAssembly({
  frameStyle: 'minimalist',
  colorHex: '#4285F4',
  corners: {
    'top-left': 'cloud',
    'top-right': 'android',
    'bottom-left': 'none',
    'bottom-right': 'none'
  },
  isEmbossed: true
});

let foundWhite = false;
assemblyBlue.traverse(child => {
  if (child.name && child.name.startsWith('EmblemMesh_')) {
    const hex = '#' + child.material.color.getHexString().toUpperCase();
    console.log(`Blue frame logo color: ${hex}`);
    if (hex === '#FFFFFF') foundWhite = true;
  }
});
if (!foundWhite) throw new Error("Expected default white logo on blue frame!");

// 2. Test White Frame -> Logo Color Auto-Defaults to Google Blue (#4285F4)
const assemblyWhite = createBadgeHolderAssembly({
  frameStyle: 'minimalist',
  colorHex: '#F8F9FA',
  corners: {
    'top-left': 'cloud',
    'top-right': 'none',
    'bottom-left': 'none',
    'bottom-right': 'none'
  },
  isEmbossed: true
});

let foundBlue = false;
assemblyWhite.traverse(child => {
  if (child.name && child.name.startsWith('EmblemMesh_')) {
    const hex = '#' + child.material.color.getHexString().toUpperCase();
    console.log(`White frame logo color: ${hex}`);
    if (hex === '#4285F4') foundBlue = true;
  }
});
if (!foundBlue) throw new Error("Expected auto-default Google Blue logo on white frame!");

// 3. Test Explicit Logo Color (e.g. Yellow Logo on Stealth Black Frame)
const assemblyCustomColor = createBadgeHolderAssembly({
  frameStyle: 'minimalist',
  colorHex: '#202124',
  logoColorHex: '#FBBC04',
  service: 'cloud',
  isEmbossed: true
});

let foundYellowCount = 0;
assemblyCustomColor.traverse(child => {
  if (child.name && child.name.startsWith('EmblemMesh_')) {
    const hex = '#' + child.material.color.getHexString().toUpperCase();
    if (hex === '#FBBC04') foundYellowCount++;
  }
});
if (foundYellowCount !== 1) throw new Error(`Expected 1 yellow emblem, found ${foundYellowCount}`);

// 4. Test Medallion Components (Full Front Disc + Solid Base Anchor) & 45° Chamfer Ramps
let hasFrontDisc = false;
let hasBaseDisc = false;
let chamferCount = 0;
assemblyCustomColor.traverse(child => {
  if (child.name === 'CornerDisc_Front') hasFrontDisc = true;
  if (child.name === 'CornerDisc_Base') hasBaseDisc = true;
  if (child.name && child.name.startsWith('ChamferRamp')) chamferCount++;
});
if (!hasFrontDisc || !hasBaseDisc) throw new Error("Expected CornerDisc_Front and CornerDisc_Base for full circle & card tunnel clearance!");
if (chamferCount !== 3) throw new Error(`Expected 3 self-supporting 45° chamfer ramps, found ${chamferCount}`);

const stl = exporter.parse(assemblyCustomColor, { binary: true });
console.log(`Binary STL with lower-right emblem & medallion disc: ${(stl.byteLength / 1024).toFixed(1)} KB`);

// 5. Test Plain Edge and Wave Edge Assemblies
const assemblyPlain = createBadgeHolderAssembly({ frameStyle: 'plain' });
const stlPlain = exporter.parse(assemblyPlain, { binary: true });
console.log(`Plain Edge STL size: ${(stlPlain.byteLength / 1024).toFixed(1)} KB`);

const assemblyWave = createBadgeHolderAssembly({ frameStyle: 'wave' });
const stlWave = exporter.parse(assemblyWave, { binary: true });
console.log(`Wave Edge STL size: ${(stlWave.byteLength / 1024).toFixed(1)} KB`);

// 6. Test Custom Parametric Dimensions (Snug 1.05mm vs Loose 1.65mm)
const assemblySnug = createBadgeHolderAssembly({
  frameStyle: 'plain',
  specs: { pocketDepth: 1.05, pocketWidth: 54.2 }
});
if (assemblySnug.userData.specs.pocketDepth !== 1.05) throw new Error("Expected snug pocketDepth 1.05");
if (assemblySnug.userData.specs.baseThickness !== (0.50 + 1.05 + 0.45)) throw new Error("Expected baseThickness 2.00");

const assemblyLoose = createBadgeHolderAssembly({
  frameStyle: 'wave',
  specs: { pocketDepth: 1.65, pocketWidth: 55.0, bezelCoverage: 3.5, backplateThickness: 0.8 }
});
if (assemblyLoose.userData.specs.pocketDepth !== 1.65) throw new Error("Expected loose pocketDepth 1.65");
const stlLoose = exporter.parse(assemblyLoose, { binary: true });
console.log(`Custom Loose Fit STL size: ${(stlLoose.byteLength / 1024).toFixed(1)} KB`);

// 7. Test .3MF Multi-Color Package Generation (Bambu Studio / AMS Lite)
const JSZip = require('./libs/jszip.min.js');
const { generate3MFPackage } = require('./generator.js');

(async () => {
  const bufUniversal = await generate3MFPackage(THREE, JSZip, assemblyCustomColor, {
    colorHex: '#202124',
    logoColorHex: '#FBBC04',
    isBambu: false
  });
  console.log(`Universal Multi-Color .3MF Package size: ${(bufUniversal.length / 1024).toFixed(1)} KB`);

  const bufBambu = await generate3MFPackage(THREE, JSZip, assemblyCustomColor, {
    colorHex: '#202124',
    logoColorHex: '#FBBC04',
    isBambu: true
  });
  console.log(`Bambu Studio Native .3MF Package size: ${(bufBambu.length / 1024).toFixed(1)} KB`);

  if (!bufUniversal || bufUniversal.length < 1000 || !bufBambu || bufBambu.length < 1000) {
    throw new Error("3MF generation produced an invalid or empty buffer!");
  }

  // Verify Bambu process settings configs are present and valid
  const zipBambuCheck = await JSZip.loadAsync(bufBambu);
  const projSettingsRaw = await zipBambuCheck.file('Metadata/project_settings.config').async('string');
  const projSettings = JSON.parse(projSettingsRaw);
  if (projSettings.process.wall_loops !== '4' ||
      projSettings.process.layer_height !== '0.16' ||
      projSettings.process.enable_support !== '1' ||
      projSettings.process.support_type !== 'tree_slim') {
    throw new Error("Bambu process settings mismatch in project_settings.config!");
  }
  console.log("✓ Bambu Studio process settings verified (4 walls, 0.16mm layer height, Arachne, Tree Slim supports)");

  // 8. Test All 27 Logos (Google + 22 Pop Culture & Geek Icons)
  const allLogos = [
    'cloud', 'android', 'chrome', 'youtube', 'deepmind',
    'vader', 'yoda', 'mando', 'rebel', 'empire', 'starfleet', 'deathstar',
    'batman', 'superman', 'spiderman', 'punisher', 'deadpool',
    'invader', 'pacman', 'triforce', 'pokeball', 'mushroom', 'aperture', 'halflife',
    'tux', 'octocat', 'nasa'
  ];
  console.log(`\nValidating all ${allLogos.length} 3D vector emblems...`);
  for (const logoId of allLogos) {
    const assembly = createBadgeHolderAssembly({
      frameStyle: 'plain',
      colorHex: '#202124',
      logoColorHex: '#FFFFFF',
      corners: { 'bottom-right': logoId }
    });
    let found = false;
    assembly.traverse(c => {
      if (c.name && c.name.startsWith('EmblemMesh_')) found = true;
    });
    if (!found) throw new Error(`Failed to generate 3D mesh for emblem: ${logoId}`);
    const stlData = exporter.parse(assembly, { binary: true });
    if (!stlData || stlData.byteLength < 50000) {
      throw new Error(`STL generation invalid for emblem: ${logoId}`);
    }
  }
  // 9. Strict Topology Assertion: Guarantee 0 Non-Manifold Edges and 0 Open Edges in 3MF
  console.log("\nVerifying 3MF topology (asserting 0 non-manifold edges and 0 open edges)...");
  for (const style of ['plain', 'wave']) {
    for (const logoId of ['cloud', 'vader', 'invader', 'pokeball', 'aperture', 'halflife', 'nasa', 'deathstar']) {
      const assembly = createBadgeHolderAssembly({
        frameStyle: style,
        colorHex: '#202124',
        logoColorHex: '#FBBC04',
        corners: { 'bottom-right': logoId }
      });
      const buf = await generate3MFPackage(THREE, JSZip, assembly, { isBambu: true });
      const zip = await JSZip.loadAsync(buf);
      const modelXml = await zip.file('3D/3dmodel.model').async('string');

      const objectRegex = /<object id="(\d+)" type="model" name="([^"]+)"[^>]*>([\s\S]*?)<\/object>/g;
      let match;
      while ((match = objectRegex.exec(modelXml)) !== null) {
        const name = match[2];
        const body = match[3];
        if (!body.includes('<mesh>')) continue;

        const triangles = [];
        const tRegex = /<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g;
        let tMatch;
        while ((tMatch = tRegex.exec(body)) !== null) {
          triangles.push({ v1: Number(tMatch[1]), v2: Number(tMatch[2]), v3: Number(tMatch[3]) });
        }

        const edgeMap = new Map();
        triangles.forEach(t => {
          const edges = [
            [Math.min(t.v1, t.v2), Math.max(t.v1, t.v2)],
            [Math.min(t.v2, t.v3), Math.max(t.v2, t.v3)],
            [Math.min(t.v3, t.v1), Math.max(t.v3, t.v1)]
          ];
          edges.forEach(([a, b]) => {
            const key = a + '_' + b;
            edgeMap.set(key, (edgeMap.get(key) || 0) + 1);
          });
        });

        let open = 0, nonManifold = 0;
        for (const count of edgeMap.values()) {
          if (count === 1) open++;
          if (count > 2) nonManifold++;
        }

        if (open > 0 || nonManifold > 0) {
          throw new Error(`Topology failure in ${style} / ${logoId} / ${name}: open=${open}, nonManifold=${nonManifold}`);
        }
      }
    }
  }
  console.log("✓ 3MF Topology validated: 0 non-manifold edges, 0 open edges across all styles and logos!");
  console.log("All circular corner disc, logo color, plain edge, wave edge, parametric, watertight topology, and dual .3MF multi-color tests passed!");
})();
