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

// 4. Test Single Bed-Anchored Corner Medallion Disc Geometry
let cornerDiscCount = 0;
assemblyCustomColor.traverse(child => {
  if (child.name && child.name.startsWith('CornerDisc_')) {
    cornerDiscCount++;
  }
});
if (cornerDiscCount !== 1) throw new Error(`Expected 1 corner medallion disc, found ${cornerDiscCount}`);

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
  console.log("All circular corner disc, logo color, plain edge, wave edge, parametric, and dual .3MF multi-color tests passed!");
})();
