


const { storage } = require("uxp");
const fs = storage.localFileSystem;
const formats = storage.formats;

const FILE_NAME = "app-config.json";
const DEFAULTS = {
  renderDir: null,



  renderDirToken: null,



  projectFolders: {},
  format: "png",


  binName: "Tiny QRs",

  updateLastDismissed: null,
  updateCache: null,
};

async function loadConfig() {
  const folder = await fs.getDataFolder();
  let file;
  try {
    file = await folder.getEntry(FILE_NAME);
  } catch (_missing) {
    return { ...DEFAULTS };
  }
  try {
    const text = await file.read({ format: formats.utf8 });
    const parsed = JSON.parse(text);
    return { ...DEFAULTS, ...parsed };
  } catch (_error) {
    return { ...DEFAULTS };
  }
}

async function saveConfig(config) {
  const folder = await fs.getDataFolder();
  const file = await folder.createFile(FILE_NAME, { overwrite: true });
  const merged = { ...DEFAULTS, ...config };
  await file.write(JSON.stringify(merged), { format: formats.utf8 });
  return merged;
}

module.exports = { loadConfig, saveConfig, DEFAULTS };
