



const { storage } = require("uxp");
const fs = storage.localFileSystem;
const formats = storage.formats;

const FILE_NAME = "designs.json";


const DESIGN_KEYS = [
  "fgColor",
  "bgColor",
  "transparent",
  "dotStyle",
  "quietZone",
  "bgRadius",
  "finderRadius",
  "logoDataUrl",
  "logoScale",
  "logoRadius",
  "logoMaskPadding",
];

function pickDesign(settings) {
  const out = {};
  for (const key of DESIGN_KEYS) {
    out[key] = settings[key];
  }
  return out;
}

async function readDataFile() {
  const folder = await fs.getDataFolder();
  let file;
  try {
    file = await folder.getEntry(FILE_NAME);
  } catch (_missing) {
    return {};
  }
  try {
    const text = await file.read({ format: formats.utf8 });
    const parsed = JSON.parse(text);
    return parsed && parsed.designs ? parsed.designs : {};
  } catch (_error) {
    return {};
  }
}

async function writeDataFile(designs) {
  const folder = await fs.getDataFolder();
  const file = await folder.createFile(FILE_NAME, { overwrite: true });
  await file.write(JSON.stringify({ designs }), { format: formats.utf8 });
}

async function loadDesigns() {
  return readDataFile();
}

async function saveDesign(name, settings) {
  const designs = await readDataFile();
  designs[name] = pickDesign(settings);
  await writeDataFile(designs);
  return designs;
}

async function deleteDesign(name) {
  const designs = await readDataFile();
  delete designs[name];
  await writeDataFile(designs);
  return designs;
}

module.exports = { loadDesigns, saveDesign, deleteDesign };
