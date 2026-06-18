
const ppro = require("premierepro");
const { storage } = require("uxp");
const fs = storage.localFileSystem;
const formats = storage.formats;
const types = storage.types;
let lottie = null;
let emptyStateAnimationData = null;

let QRCodeCore = null;
let qrLoadError = null;

if (typeof globalThis.TextEncoder === "undefined") {
  class TextEncoderFallback {
    encode(input = "") {
      const utf8 = unescape(encodeURIComponent(String(input)));
      const bytes = new Uint8Array(utf8.length);
      for (let i = 0; i < utf8.length; i += 1) {
        bytes[i] = utf8.charCodeAt(i);
      }
      return bytes;
    }
  }
  globalThis.TextEncoder = TextEncoderFallback;
}

try {

  QRCodeCore = require("./vendor/qrcode-core/core/qrcode");
} catch (error) {
  qrLoadError = error;
}

try {
  lottie = require("./vendor/lottie_light.min");
  emptyStateAnimationData = require("./assets/qr-idle-animation.json");
} catch (error) {
  console.error("Failed to load Lottie runtime or animation data.", error);
}

const { drawQr } = require("./lib/qr-renderer");
const { rasterizeQr } = require("./lib/qr-raster");
const { decodePng } = require("./lib/png-decoder");
const { encodeImage } = require("./lib/image-encoders");
const designsStore = require("./lib/designs-store");
const appConfig = require("./lib/app-config");
const updateCheck = require("./lib/update-check");
const { hsvToRgb, rgbToHsv, rgbToHex, hexToRgbTriplet, normalizeHex } = require("./lib/color");
const { base64FromBytes, dataUrlToBytes } = require("./lib/base64");
const {
  normalizePath,
  getProjectDirectoryPath,
  formatTimestampForFile,
  buildUrlSlug,
} = require("./lib/file-utils");


const EXPORT_MODULE_PX = 16;
const SUPPORTED_EXPORT_FORMATS = new Set(["png", "bmp", "gif"]);





const settings = {
  fgColor: "#000000",
  bgColor: "#ffffff",
  transparent: false,
  dotStyle: "square",
  quietZone: 4,
  bgRadius: 0,
  finderRadius: 0,
  logoDataUrl: null,
  logoRgba: null,
  logoScale: 0.2,
  logoRadius: 25,
  logoMaskPadding: 100,
};

const els = {
  urlInput: document.getElementById("url-input"),
  importBtn: document.getElementById("import-btn"),
  previewPanel: document.querySelector(".preview-panel"),
  qrCanvas: document.getElementById("qr-canvas"),
  qrLogoOverlay: document.getElementById("qr-logo-overlay"),
  emptyState: document.getElementById("empty-state"),
  emptyStateAnimation: document.getElementById("empty-state-animation"),
  footerAnim: document.getElementById("footer-anim"),
  toast: document.getElementById("toast"),
  log: document.getElementById("plugin-body"),

  customize: document.getElementById("customize"),
  customizeToggle: document.getElementById("customize-toggle"),
  customizeBody: document.getElementById("customize-body"),
  customizeGrip: document.getElementById("customize-grip"),
  designSelect: document.getElementById("design-select"),
  designName: document.getElementById("design-name"),
  designSave: document.getElementById("design-save"),
  designDelete: document.getElementById("design-delete"),
  dotStyle: document.getElementById("dot-style"),
  fgChip: document.getElementById("fg-chip"),
  fgChipDot: document.getElementById("fg-chip-dot"),
  fgChipHex: document.getElementById("fg-chip-hex"),
  bgChip: document.getElementById("bg-chip"),
  bgChipDot: document.getElementById("bg-chip-dot"),
  bgChipHex: document.getElementById("bg-chip-hex"),
  bgTransparent: document.getElementById("bg-transparent"),
  padSlider: document.getElementById("pad-slider"),
  padFill: document.getElementById("pad-fill"),
  padThumb: document.getElementById("pad-thumb"),
  padVal: document.getElementById("pad-val"),
  bgrSlider: document.getElementById("bgr-slider"),
  bgrFill: document.getElementById("bgr-fill"),
  bgrThumb: document.getElementById("bgr-thumb"),
  bgrVal: document.getElementById("bgr-val"),
  fdrSlider: document.getElementById("fdr-slider"),
  fdrFill: document.getElementById("fdr-fill"),
  fdrThumb: document.getElementById("fdr-thumb"),
  fdrVal: document.getElementById("fdr-val"),
  logoUpload: document.getElementById("logo-upload"),
  logoRemove: document.getElementById("logo-remove"),
  logoThumb: document.getElementById("logo-thumb"),
  logoSizeRow: document.getElementById("logo-size-row"),
  logoSlider: document.getElementById("logo-slider"),
  logoFill: document.getElementById("logo-fill"),
  logoThumbHandle: document.getElementById("logo-thumb-handle"),
  logoVal: document.getElementById("logo-val"),
  logoRadiusRow: document.getElementById("logo-radius-row"),
  lgrSlider: document.getElementById("lgr-slider"),
  lgrFill: document.getElementById("lgr-fill"),
  lgrThumb: document.getElementById("lgr-thumb"),
  lgrVal: document.getElementById("lgr-val"),
  logoPadRow: document.getElementById("logo-pad-row"),
  lpadSlider: document.getElementById("lpad-slider"),
  lpadFill: document.getElementById("lpad-fill"),
  lpadThumb: document.getElementById("lpad-thumb"),
  lpadVal: document.getElementById("lpad-val"),
  resetBtn: document.getElementById("reset-btn"),

  settingsBtn: document.getElementById("settings-btn"),
  settingsModal: document.getElementById("settings-modal"),
  settingsClose: document.getElementById("settings-close"),
  renderDir: document.getElementById("render-dir"),
  renderDirPick: document.getElementById("render-dir-pick"),
  renderDirClear: document.getElementById("render-dir-clear"),
  binNameInput: document.getElementById("bin-name"),
  formatSelect: document.getElementById("format-select"),

  folderSetupModal: document.getElementById("folder-setup-modal"),
  folderSetupPick: document.getElementById("folder-setup-pick"),
  folderSetupCancel: document.getElementById("folder-setup-cancel"),

  popupTestModal: document.getElementById("popup-test-modal"),
  popupTestClose: document.getElementById("popup-test-close"),
  testFolderSetup: document.getElementById("test-folder-setup"),
  testSettings: document.getElementById("test-settings"),
  testColor: document.getElementById("test-color"),
  testUpdate: document.getElementById("test-update"),
  testToastSuccess: document.getElementById("test-toast-success"),
  testToastError: document.getElementById("test-toast-error"),
  testToastInfo: document.getElementById("test-toast-info"),

  colorModal: document.getElementById("color-modal"),
  colorDone: document.getElementById("color-done"),
  colorHex: document.getElementById("color-hex"),
  colorPreview: document.getElementById("color-preview"),
  svCanvas: document.getElementById("sv-canvas"),
  hueCanvas: document.getElementById("hue-canvas"),
  svMarker: document.getElementById("sv-marker"),
  hueMarker: document.getElementById("hue-marker"),
};


let config = { ...appConfig.DEFAULTS };

let generatedQr = null;
let previewQr = null;
let currentText = "";
let inputDebounce = null;
let toastTimer = null;
let emptyStateAnimation = null;
if (els.importBtn) {
  setActionButtonDisabled(els.importBtn, true);
}

if (els.urlInput) {
  els.urlInput.value = "";
}

els.urlInput?.addEventListener("input", onInputChange);
els.importBtn?.addEventListener("click", () => {
  if (!isActionButtonDisabled(els.importBtn)) {
    onImportGeneratedQr();
  }
});
els.importBtn?.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && !isActionButtonDisabled(els.importBtn)) {
    event.preventDefault();
    onImportGeneratedQr();
  }
});
els.urlInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    clearTimeout(inputDebounce);
    updateQrPreviewFromInput();
  }
});

if (document.theme?.onUpdated?.addListener && document.theme?.getCurrent) {
  document.theme.onUpdated.addListener((theme) => {
    updateTheme(theme);
  });
  updateTheme(document.theme.getCurrent());
}

function updateTheme(theme) {
  const themeName = String(theme || "").toLowerCase();
  const dark = themeName.includes("dark");
  document.body.classList.toggle("theme-light", !dark);
}

function setActionButtonDisabled(button, disabled) {
  if (!button) return;
  button.classList.toggle("is-disabled", disabled);
  button.setAttribute("aria-disabled", disabled ? "true" : "false");
  button.tabIndex = disabled ? -1 : 0;
}

function isActionButtonDisabled(button) {
  return !button || button.classList.contains("is-disabled");
}

function setActionButtonsEnabled(enabled) {
  if (els.importBtn) {
    setActionButtonDisabled(els.importBtn, !enabled);
  }
}

function showToast(message, kind = "info", ms = 2400) {
  if (!els.toast) return;
  clearTimeout(toastTimer);
  els.toast.textContent = String(message || "");
  els.toast.classList.toggle("toast-error", kind === "error");
  els.toast.classList.add("show");
  toastTimer = setTimeout(() => {
    els.toast.classList.remove("show");
  }, ms);
}


function showUpdateToast(version, onUpdate, onDismiss) {
  if (!els.toast) return;
  clearTimeout(toastTimer);

  function hide() {
    els.toast.classList.remove("show", "toast-update");
    els.toast.textContent = "";
  }

  els.toast.textContent = "";
  els.toast.classList.remove("toast-error");

  const msg = document.createElement("span");
  msg.textContent = `Update available: v${version}`;

  const action = document.createElement("span");
  action.className = "toast-action";
  action.setAttribute("role", "button");
  action.setAttribute("tabindex", "0");
  action.textContent = "Update now";
  action.addEventListener("click", () => {
    hide();
    if (typeof onUpdate === "function") onUpdate();
  });

  const dismiss = document.createElement("span");
  dismiss.className = "toast-dismiss";
  dismiss.setAttribute("role", "button");
  dismiss.setAttribute("tabindex", "0");
  dismiss.setAttribute("aria-label", "Dismiss");
  dismiss.textContent = "×";
  dismiss.addEventListener("click", () => {
    hide();
    if (typeof onDismiss === "function") onDismiss();
  });

  els.toast.appendChild(msg);
  els.toast.appendChild(action);
  els.toast.appendChild(dismiss);
  els.toast.classList.add("show", "toast-update");
}

let logHideTimer = null;

function hideLog() {
  clearTimeout(logHideTimer);
  els.log?.classList.remove("is-visible");
}

function log(message, kind = "info", ms) {
  const text = String(message ?? "");
  const line = document.createElement("div");
  line.textContent = text;
  if (kind === "error") {
    line.className = "log-error";
    els.log.classList.add("is-visible");
    showToast(text, "error", ms);
  } else if (kind === "success") {
    line.className = "log-success";
    showToast(text, "success", ms);
  }
  els.log.appendChild(line);
  els.log.scrollTop = els.log.scrollHeight;


  if (els.log.classList.contains("is-visible")) {
    clearTimeout(logHideTimer);
    logHideTimer = setTimeout(hideLog, 5000);
  }
}

function getErrorText(error) {
  if (!error) return "unknown";
  if (typeof error === "string") return error;


  const parts = [];
  if (error.name) parts.push(String(error.name));
  if (error.code !== undefined && error.code !== null && error.code !== "") {
    parts.push(`code ${error.code}`);
  }
  if (error.message) parts.push(String(error.message));
  if (parts.length) return parts.join(": ");
  try {
    return JSON.stringify(error);
  } catch (_jsonError) {
    return String(error);
  }
}

function hasQrInput(value) {
  return String(value || "").trim().length > 0;
}

function resetSavedQrIfInputChanged(value) {
  if (generatedQr?.url && generatedQr.url !== value) {
    generatedQr = null;
  }
}

function clearQrPreview() {
  previewQr = null;
  currentText = "";
  generatedQr = null;
  if (els.qrCanvas) {
    els.qrCanvas.classList.remove("visible");
  }
  if (els.qrLogoOverlay) {
    els.qrLogoOverlay.classList.remove("is-visible");
    els.qrLogoOverlay.removeAttribute("src");
  }
  els.emptyState?.classList.remove("is-hidden");
  setFooterAnimVisible(false);
  setActionButtonsEnabled(false);
}

function initEmptyStateAnimation() {
  if (emptyStateAnimation || !els.emptyStateAnimation) return;
  if (!lottie || typeof lottie.loadAnimation !== "function" || !emptyStateAnimationData) {
    return;
  }
  try {
    emptyStateAnimation = lottie.loadAnimation({
      container: els.emptyStateAnimation,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData: JSON.parse(JSON.stringify(emptyStateAnimationData)),
      rendererSettings: {
        preserveAspectRatio: "xMidYMid meet",
      },
    });
    emptyStateAnimation.setSubframe?.(false);
  } catch (error) {
    console.error("Failed to initialize empty-state animation.", error);
  }
}



let footerAnimation = null;


let pickingActive = false;
function initFooterAnimation() {
  if (footerAnimation || !els.footerAnim) return;
  if (!lottie || typeof lottie.loadAnimation !== "function" || !emptyStateAnimationData) {
    return;
  }
  try {
    footerAnimation = lottie.loadAnimation({
      container: els.footerAnim,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData: JSON.parse(JSON.stringify(emptyStateAnimationData)),
      rendererSettings: {
        preserveAspectRatio: "xMidYMid meet",
      },
    });
    footerAnimation.setSubframe?.(false);
  } catch (error) {
    console.error("Failed to initialize footer animation.", error);
  }
}



function setFooterAnimVisible(visible) {
  if (!els.footerAnim) return;
  if (visible) initFooterAnimation();
  els.footerAnim.style.opacity = visible ? "1" : "0";



  try {
    if (pickingActive) {

      footerAnimation?.pause?.();
      emptyStateAnimation?.pause?.();
    } else if (visible) {
      footerAnimation?.play?.();
      emptyStateAnimation?.pause?.();
    } else {
      footerAnimation?.pause?.();
      emptyStateAnimation?.play?.();
    }
  } catch (_error) {

  }
}



const POPUP_TEST_PHRASE = "crinzip/tinyqr/popup-testing";

function updateQrPreviewFromInput() {
  const value = els.urlInput.value.trim();
  if (value === POPUP_TEST_PHRASE) {
    clearQrPreview();
    openPopupTestModal();
    return;
  }
  if (!hasQrInput(value)) {
    clearQrPreview();
    return;
  }
  if (value === currentText && previewQr) {
    return;
  }

  try {
    const qr = createQrMatrix(value);
    previewQr = qr;
    currentText = value;
    resetSavedQrIfInputChanged(value);
    renderPreview();
    setActionButtonsEnabled(true);
  } catch (error) {
    clearQrPreview();
    log(getErrorText(error), "error");
    console.error(error);
  }
}

function onInputChange() {
  const value = els.urlInput.value.trim();

  clearTimeout(inputDebounce);
  if (!value) {
    clearQrPreview();
    return;
  }

  inputDebounce = setTimeout(updateQrPreviewFromInput, 300);
}

if (!QRCodeCore || typeof QRCodeCore.create !== "function") {
  const reason = qrLoadError?.message ? ` (${qrLoadError.message})` : "";
  log(`Tiny QR runtime is not ready (qrcode core load failed)${reason}.`, "error");
  setActionButtonsEnabled(false);
} else {
  log("Tiny QR runtime ready.");
}

function createQrMatrix(urlValue) {
  if (!QRCodeCore || typeof QRCodeCore.create !== "function") {
    throw new Error(
      `qrcode core package did not load${qrLoadError?.message ? `: ${qrLoadError.message}` : ""}.`
    );
  }
  return QRCodeCore.create(urlValue, {

    errorCorrectionLevel: settings.logoRgba ? "H" : "M",
  });
}

function buildImageFromQr(qr) {


  const raster = rasterizeQr(qr, settings, EXPORT_MODULE_PX);
  return encodeImage(config.format, raster.data, raster.width, raster.height);
}

let drawScheduled = false;



function renderPreview() {
  if (!previewQr || !els.qrCanvas) return;
  els.qrCanvas.classList.add("visible");
  els.emptyState?.classList.add("is-hidden");
  setFooterAnimVisible(true);
  if (drawScheduled) return;
  drawScheduled = true;
  const run = () => {
    drawScheduled = false;
    drawPreviewNow();
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(run);
  } else {
    setTimeout(run, 16);
  }
}

function drawPreviewNow() {
  const qr = previewQr;
  if (!qr || !els.qrCanvas) return;

  const total = qr.modules.size + settings.quietZone * 2;
  const availableWidth = Math.max((els.previewPanel?.clientWidth || 300) - 32, 80);
  const availableHeight = Math.max((els.previewPanel?.clientHeight || 300) - 32, 80);

  const fit = Math.min(availableWidth, availableHeight);








  const dpr = window.devicePixelRatio || 1;
  const moduleDevice = Math.max(2, Math.floor((fit * dpr) / total));
  const sizeDevice = moduleDevice * total;

  const canvas = els.qrCanvas;
  canvas.width = sizeDevice;
  canvas.height = sizeDevice;
  canvas.style.width = `${sizeDevice / dpr}px`;
  canvas.style.height = `${sizeDevice / dpr}px`;

  const ctx = canvas.getContext("2d");
  drawQr(ctx, qr, settings, moduleDevice);
  positionLogoOverlay(qr, moduleDevice, dpr);
}




function positionLogoOverlay(qr, moduleDevice, dpr) {
  const overlay = els.qrLogoOverlay;
  if (!overlay) return;
  if (!settings.logoRgba || !settings.logoDataUrl) {
    overlay.classList.remove("is-visible");
    overlay.removeAttribute("src");
    return;
  }

  const bodyDevice = qr.modules.size * moduleDevice;
  const maxSide = bodyDevice * (settings.logoScale || 0.2);
  const dims = settings.logoRgba;
  const aspect = dims && dims.width && dims.height ? dims.width / dims.height : 1;
  let wDev = maxSide;
  let hDev = maxSide;
  if (aspect >= 1) hDev = maxSide / aspect;
  else wDev = maxSide * aspect;

  const wCss = wDev / dpr;
  const hCss = hDev / dpr;
  const radiusFrac =
    Math.max(0, Math.min(50, settings.logoRadius == null ? 25 : settings.logoRadius)) / 100;
  const rCss = radiusFrac * Math.min(wCss, hCss);

  if (overlay.getAttribute("src") !== settings.logoDataUrl) {
    overlay.src = settings.logoDataUrl;
  }
  overlay.style.width = `${wCss}px`;
  overlay.style.height = `${hCss}px`;
  overlay.style.borderRadius = `${rCss}px`;
  overlay.classList.add("is-visible");
}


function observePreviewResize() {
  if (!els.previewPanel) return;
  let resizeTimer = null;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (previewQr) renderPreview();
    }, 60);
  };
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(onResize).observe(els.previewPanel);
  }
  window.addEventListener("resize", onResize);
}

function normalizeExportFormat(value) {
  const format = String(value || "").toLowerCase();
  return SUPPORTED_EXPORT_FORMATS.has(format) ? format : "png";
}





function normalizeBinName(value) {
  const name = String(value || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.\s]+$/, "");
  return name || appConfig.DEFAULTS.binName;
}





function fileUrlCandidates(nativePath) {
  let p = String(nativePath || "").replace(/\\/g, "/");
  if (!p.startsWith("/")) p = `/${p}`;
  const enc = encodeURI(p);
  const noLead = enc.slice(1);
  return [`file://${enc}`, `file:/${noLead}`, `file://${noLead}`];
}





async function getExistingFolderEntry(baseDir) {
  let lastError = null;
  for (const url of fileUrlCandidates(baseDir)) {
    try {
      const entry = await fs.getEntryWithUrl(url);
      if (entry && entry.isFile) {
        throw new Error(`"${baseDir}" is a file, not a folder.`);
      }
      if (entry) return entry;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error(`Could not resolve folder "${baseDir}".`);
}



async function ensureSubfolder(baseFolder, name) {

  try {
    const existing = await baseFolder.getEntry(name);
    if (existing) return existing;
  } catch (_missing) {

  }




  let createError = null;
  try {
    return await baseFolder.createEntry(name, { type: types.folder });
  } catch (e) {
    createError = e;
  }
  if (typeof baseFolder.createFolder === "function") {
    try {
      return await baseFolder.createFolder(name);
    } catch (e) {
      createError = e;
    }
  }
  try {
    const again = await baseFolder.getEntry(name);
    if (again) return again;
  } catch (_stillMissing) {

  }
  throw createError || new Error(`Could not create folder "${name}".`);
}




let folderSetupResolve = null;
function showFolderSetupModal() {
  return new Promise((resolve) => {
    if (folderSetupResolve) folderSetupResolve(null);
    folderSetupResolve = resolve;
    setModalOpen(els.folderSetupModal, true);
  });
}

function settleFolderSetup(result) {
  setModalOpen(els.folderSetupModal, false);
  const resolve = folderSetupResolve;
  folderSetupResolve = null;
  if (resolve) resolve(result);
}

function initFolderSetupModal() {
  if (!els.folderSetupModal) return;
  onActivate(els.folderSetupPick, async () => {
    try {
      const folder = await fs.getFolder();
      if (!folder) return;
      settleFolderSetup(folder);
    } catch (error) {
      log(getErrorText(error), "error");
      settleFolderSetup(null);
    }
  });
  onActivate(els.folderSetupCancel, () => settleFolderSetup(null));
  els.folderSetupModal.addEventListener("click", (event) => {
    if (event.target === els.folderSetupModal) settleFolderSetup(null);
  });
}




function openPopupTestModal() {
  setModalOpen(els.popupTestModal, true);
}

function initPopupTestModal() {
  if (!els.popupTestModal) return;
  const close = () => setModalOpen(els.popupTestModal, false);

  const launch = (fn) => () => {
    close();
    fn();
  };
  onActivate(els.popupTestClose, close);
  els.popupTestModal.addEventListener("click", (event) => {
    if (event.target === els.popupTestModal) close();
  });
  onActivate(els.testFolderSetup, launch(() => showFolderSetupModal()));
  onActivate(els.testSettings, launch(() => setModalOpen(els.settingsModal, true)));
  onActivate(els.testColor, launch(() => openColorPicker("fg")));
  onActivate(els.testUpdate, launch(() => showUpdateToast("9.9.9", () => {}, () => {})));

  onActivate(els.testToastSuccess, () => log("This is a success message.", "success"));
  onActivate(els.testToastError, () => log("This is an error message.", "error"));
  onActivate(els.testToastInfo, () => showToast("This is an info message."));
}




async function resolveStoredBaseFolder(projectKey) {
  if (config.renderDirToken) {
    try {
      return await fs.getEntryForPersistentToken(config.renderDirToken);
    } catch (_stale) {

    }
  }
  const perProject = config.projectFolders && config.projectFolders[projectKey];
  if (perProject) {
    try {
      return await fs.getEntryForPersistentToken(perProject);
    } catch (_stale) {

    }
  }
  return null;
}










async function getConfiguredBaseFolder(projectPath) {
  const projectKey = normalizePath(projectPath);

  const stored = await resolveStoredBaseFolder(projectKey);
  if (stored) return stored;


  if (config.renderDir) {
    const dir = String(config.renderDir).replace(/\\/g, "/").replace(/\/+$/, "");
    try {
      return await getExistingFolderEntry(dir);
    } catch (_e) {

    }
  }



  const projectDir = getProjectDirectoryPath(projectPath);
  if (projectDir) {
    try {
      return await getExistingFolderEntry(projectDir);
    } catch (_e) {

    }
  }
  return null;
}


async function rememberProjectFolder(projectPath, folder) {
  const projectKey = normalizePath(projectPath);
  if (!projectKey) return;
  try {
    const token = await fs.createPersistentToken(folder);
    config.projectFolders = { ...(config.projectFolders || {}), [projectKey]: token };
    await persistConfig();
  } catch (_e) {

  }
}

async function getQrTargetFolder(projectPath) {



  const folderName = normalizeBinName(config.binName);
  const baseFolder = await getConfiguredBaseFolder(projectPath);
  if (!baseFolder) {
    throw new Error("Choose a folder to save Tiny QR codes in, then import again.");
  }
  return ensureSubfolder(baseFolder, folderName);
}






async function resolveWritableQrFolder(projectPath) {
  try {
    return await getQrTargetFolder(projectPath);
  } catch (_noUsableLocation) {
    return null;
  }
}

async function saveQrNearProject(buffer, ext, projectPath, urlValue, preResolvedFolder) {


  const qrFolder = preResolvedFolder || (await getQrTargetFolder(projectPath));

  const slug = buildUrlSlug(urlValue);
  const timestamp = formatTimestampForFile();
  const fileName = `${slug}-${timestamp}.${ext}`;
  const qrFile = await qrFolder.createFile(fileName, { overwrite: true });
  await qrFile.write(buffer, { format: formats.binary });

  return {
    file: qrFile,
    nativePath: fs.getNativePath(qrFile),
    fsUrl: fs.getFsUrl(qrFile),
    fileName,
  };
}

async function findImportedItemInFolder(folderItem, beforeIds, nativePath, fileName) {
  const afterItems = await folderItem.getItems();
  const nativePathKey = normalizePath(nativePath);
  const fileNameKey = fileName.toLowerCase();
  const candidates = [];

  for (const item of afterItems) {
    const id = item.getId ? item.getId() : "";
    const isNew = id && !beforeIds.has(id);
    const nameMatches = String(item.name || "").toLowerCase().includes(fileNameKey);

    try {
      const clip = ppro.ClipProjectItem.cast(item);
      const mediaPath = await clip.getMediaFilePath();
      const mediaMatches = normalizePath(mediaPath) === nativePathKey;

      if (isNew || mediaMatches || nameMatches) {
        candidates.push({ item, mediaMatches, isNew, nameMatches });
      }
    } catch (_error) {

    }
  }

  const exact = candidates.find((c) => c.mediaMatches);
  if (exact) return exact.item;

  const newlyImported = candidates.find((c) => c.isNew);
  if (newlyImported) return newlyImported.item;

  const byName = candidates.find((c) => c.nameMatches);
  if (byName) return byName.item;

  for (let i = afterItems.length - 1; i >= 0; i -= 1) {
    const item = afterItems[i];
    try {
      const clip = ppro.ClipProjectItem.cast(item);
      await clip.getMediaFilePath();
      return item;
    } catch (_error) {

    }
  }
  return null;
}




async function getOrCreateProjectBin(project, binName) {
  const rootItem = await project.getRootItem();
  const rootFolder = rootItem ? ppro.FolderItem.cast(rootItem) : null;
  if (!rootFolder) return null;

  const findBin = async () => {
    const items = await rootFolder.getItems();
    for (const item of items) {
      if (String(item.name || "") === binName && ppro.FolderItem.cast(item)) {
        return item;
      }
    }
    return null;
  };

  const existing = await findBin();
  if (existing) return existing;

  let created = false;
  project.lockedAccess(() => {
    created = project.executeTransaction((compoundAction) => {
      compoundAction.addAction(rootFolder.createBinAction(binName, false));
    }, "Create Tiny QR bin");
  });
  if (!created) return null;
  return findBin();
}

async function importQrProjectItem(project, qrInfo) {
  const binName = normalizeBinName(config.binName);
  const targetBin = (await getOrCreateProjectBin(project, binName)) || (await project.getInsertionBin());
  const targetFolder = ppro.FolderItem.cast(targetBin);
  const beforeItems = await targetFolder.getItems();
  const beforeIds = new Set(
    beforeItems
      .map((item) => (item.getId ? item.getId() : ""))
      .filter((id) => Boolean(id))
  );

  log("Importing Tiny QR image into project...");
  const imported = await project.importFiles([qrInfo.nativePath], true, targetBin, false);
  if (!imported) {
    throw new Error("Premiere failed to import the generated Tiny QR image.");
  }

  const importedItem = await findImportedItemInFolder(
    targetFolder,
    beforeIds,
    qrInfo.nativePath,
    qrInfo.fileName
  );
  if (!importedItem) {
    throw new Error("Imported clip was not found in the insertion bin.");
  }

  return importedItem;
}

async function getTargetVideoTrackIndex(sequence, playheadTime) {
  const videoTrackCount = await sequence.getVideoTrackCount();
  const playheadTicks = playheadTime.ticksNumber;
  let highestOccupiedAtPlayhead = -1;

  for (let trackIndex = 0; trackIndex < videoTrackCount; trackIndex += 1) {
    const track = await sequence.getVideoTrack(trackIndex);
    const items = await track.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);

    for (const item of items) {
      const start = await item.getStartTime();
      const end = await item.getEndTime();
      if (playheadTicks >= start.ticksNumber && playheadTicks < end.ticksNumber) {
        highestOccupiedAtPlayhead = trackIndex;
      }
    }
  }

  return highestOccupiedAtPlayhead + 1;
}

function insertProjectItemAtTrack(project, sequence, projectItem, playheadTime, videoTrackIndex) {
  const editor = ppro.SequenceEditor.getEditor(sequence);
  const targetAudioTrackIndex = 0;
  let transactionOk = false;

  project.lockedAccess(() => {
    transactionOk = project.executeTransaction(
      (compoundAction) => {
        const insertAction = editor.createInsertProjectItemAction(
          projectItem,
          playheadTime,
          videoTrackIndex,
          targetAudioTrackIndex,
          true
        );
        compoundAction.addAction(insertAction);
      },
      "Insert Tiny QR"
    );
  });

  if (!transactionOk) {
    throw new Error("Premiere rejected the timeline insert transaction.");
  }
}

async function saveCurrentQrToProject(options = {}) {
  const updateButtons = options.updateButtons !== false;
  const urlValue = els.urlInput.value.trim();
  if (!hasQrInput(urlValue)) {
    log("Enter URL or text to generate Tiny QR.", "error");
    return null;
  }

  const project = await ppro.Project.getActiveProject();
  if (!project) {
    throw new Error("No active Premiere project.");
  }




  const qr = previewQr && currentText === urlValue ? previewQr : createQrMatrix(urlValue);
  previewQr = qr;
  currentText = urlValue;
  renderPreview();

  const { buffer, ext } = buildImageFromQr(qr);
  const qrFileInfo = await saveQrNearProject(buffer, ext, project.path, urlValue, options.qrFolder);
  generatedQr = { ...qrFileInfo, url: urlValue, format: config.format };
  if (updateButtons) {
    setActionButtonsEnabled(true);
  }
  return generatedQr;
}

async function onImportGeneratedQr() {
  const urlValue = els.urlInput.value.trim();
  if (!hasQrInput(urlValue)) {
    log("Enter URL or text to generate Tiny QR.", "error");
    return;
  }

  setActionButtonDisabled(els.importBtn, true);
  try {
    const project = await ppro.Project.getActiveProject();
    if (!project) {
      throw new Error("No active Premiere project.");
    }






    const needSave =
      !generatedQr?.nativePath ||
      generatedQr.url !== urlValue ||
      generatedQr.format !== config.format;
    if (needSave) {



      const qrFolder = await resolveWritableQrFolder(project.path);
      if (!qrFolder) {
        const picked = await showFolderSetupModal();
        if (!picked) {
          log("Choose a folder to save Tiny QR codes in, then import again.", "error");
          return;
        }
        await rememberProjectFolder(project.path, picked);
        log("Save location set. Click Import again to add your QR code.", "success");
        return;
      }
      await saveCurrentQrToProject({ updateButtons: false, qrFolder });
    }
    if (!generatedQr?.nativePath) {
      throw new Error("Tiny QR image was not saved before import.");
    }

    const sequence = await project.getActiveSequence();
    if (!sequence) {
      throw new Error("No active sequence. Open a sequence and try again.");
    }

    const playheadTime = await sequence.getPlayerPosition();
    const targetVideoTrackIndex = await getTargetVideoTrackIndex(sequence, playheadTime);
    const importedItem = await importQrProjectItem(project, generatedQr);

    insertProjectItemAtTrack(project, sequence, importedItem, playheadTime, targetVideoTrackIndex);
    log(`Placed on video track V${targetVideoTrackIndex + 1}.`);

    log("Check your QR code to make sure it works", "success", 8000);
  } catch (error) {
    log(getErrorText(error), "error");
    console.error(error);
  } finally {
    setActionButtonsEnabled(Boolean(previewQr));
  }
}



let settingsDebounce = null;
let cachedDesigns = {};
let applyingDesign = false;



function bumpPreview() {
  generatedQr = null;
  clearTimeout(settingsDebounce);
  settingsDebounce = setTimeout(renderPreview, 100);
}



function regenerateMatrix() {
  generatedQr = null;
  if (currentText) {
    try {
      previewQr = createQrMatrix(currentText);
    } catch (error) {
      log(getErrorText(error), "error");
      return;
    }
  }
  renderPreview();
}

function onActivate(el, handler) {
  if (!el) return;
  el.addEventListener("click", handler);
  el.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handler(event);
    }
  });
}

function setHidden(el, hidden) {
  if (!el) return;
  if (hidden) {
    el.setAttribute("hidden", "");
  } else {
    el.removeAttribute("hidden");
  }
}






function setModalOpen(modalEl, open) {
  setHidden(modalEl, !open);
  if (modalEl === els.colorModal) {
    document.body.classList.toggle("color-picking", open);
  } else {
    document.body.classList.toggle("modal-open", open);
  }
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}



function updateColorChip(which) {
  if (which === "fg") {
    if (els.fgChipDot) els.fgChipDot.style.backgroundColor = settings.fgColor;
    if (els.fgChipHex) els.fgChipHex.textContent = settings.fgColor;
  } else {
    if (els.bgChipDot) els.bgChipDot.style.backgroundColor = settings.bgColor;
    if (els.bgChipHex) els.bgChipHex.textContent = settings.bgColor;
  }
}

function setFgColor(color) {
  const hex = normalizeHex(color, settings.fgColor);
  settings.fgColor = hex;
  updateColorChip("fg");
  bumpPreview();
}

function setBgColor(color) {
  const hex = normalizeHex(color, settings.bgColor);
  settings.bgColor = hex;
  updateColorChip("bg");
  bumpPreview();
}





const colorPicker = {
  target: null,
  h: 0,
  s: 0,
  v: 0,
  apply: null,
};

function currentPickerHex() {
  return rgbToHex(hsvToRgb(colorPicker.h, colorPicker.s, colorPicker.v));
}



let svDrawnHue = -1;
let hueBarDrawn = false;







function renderSvGradient(hue) {
  const canvas = els.svCanvas;
  if (!canvas) return;
  const rgb = hsvToRgb(hue, 1, 1);
  const hueColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;

  canvas.style.background =
    "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 100%), " +
    `linear-gradient(to right, #ffffff 0%, ${hueColor} 100%)`;
  svDrawnHue = hue;
}

function renderHueBar() {
  const canvas = els.hueCanvas;
  if (!canvas) return;
  canvas.style.background =
    "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, " +
    "#00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)";
  hueBarDrawn = true;
}

function positionPickerMarkers() {
  if (els.svMarker) {
    els.svMarker.style.left = `${colorPicker.s * 100}%`;
    els.svMarker.style.top = `${(1 - colorPicker.v) * 100}%`;
    els.svMarker.style.borderColor = colorPicker.v > 0.5 ? "#000000" : "#ffffff";
  }
  if (els.hueMarker) {
    els.hueMarker.style.left = `${(colorPicker.h / 360) * 100}%`;
  }
}


function updatePickerLive() {
  positionPickerMarkers();
  const hex = currentPickerHex();
  if (els.colorPreview) els.colorPreview.style.backgroundColor = hex;
  if (els.colorHex) els.colorHex.value = hex;
}


function refreshPickerUI() {
  if (!hueBarDrawn) renderHueBar();
  if (svDrawnHue !== colorPicker.h) renderSvGradient(colorPicker.h);
  updatePickerLive();
}




function applyPickerColor() {
  const hex = currentPickerHex();
  if (colorPicker.apply) colorPicker.apply(hex);
}





function applyPickerColorLive() {
  const hex = currentPickerHex();
  if (colorPicker.target === "bg") {
    settings.bgColor = normalizeHex(hex, settings.bgColor);
    updateColorChip("bg");
  } else {
    settings.fgColor = normalizeHex(hex, settings.fgColor);
    updateColorChip("fg");
  }
  generatedQr = null;
}



let pickerUpdateScheduled = false;
function schedulePickerUpdate() {
  if (pickerUpdateScheduled) return;
  pickerUpdateScheduled = true;
  const run = () => {
    pickerUpdateScheduled = false;
    updatePickerLive();
    applyPickerColorLive();
  };
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(run);
  } else {
    setTimeout(run, 16);
  }
}



function finishPickerDrag() {
  if (svDrawnHue !== colorPicker.h) renderSvGradient(colorPicker.h);
  updatePickerLive();
  applyPickerColor();
}





function setPickingAnimationsPaused(paused) {
  pickingActive = paused;
  try {
    if (paused) {
      footerAnimation?.pause?.();
      emptyStateAnimation?.pause?.();
    } else {
      setFooterAnimVisible(Boolean(previewQr));
    }
  } catch (_error) {

  }
}

function openColorPicker(target) {
  colorPicker.target = target;
  setPickingAnimationsPaused(true);
  const isFg = target === "fg";
  colorPicker.apply = isFg ? setFgColor : setBgColor;
  const startHex = isFg ? settings.fgColor : settings.bgColor;
  const rgb = hexToRgbTriplet(startHex);
  const hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
  colorPicker.h = hsv.h;
  colorPicker.s = hsv.s;
  colorPicker.v = hsv.v;

  svDrawnHue = -1;
  hueBarDrawn = false;
  setModalOpen(els.colorModal, true);
  positionColorModal();

  const paint = () => refreshPickerUI();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => requestAnimationFrame(paint));
  } else {
    setTimeout(paint, 32);
  }
}




function positionColorModal() {
  const overlay = els.colorModal;
  const anchor = els.customize;
  if (!overlay || !anchor || typeof anchor.getBoundingClientRect !== "function") return;
  const r = anchor.getBoundingClientRect();
  if (!r.width || !r.height) return;
  overlay.style.top = `${r.top}px`;
  overlay.style.left = `${r.left}px`;
  overlay.style.width = `${r.width}px`;
  overlay.style.height = `${r.height}px`;
  overlay.style.right = "auto";
  overlay.style.bottom = "auto";
}

function closeColorPicker() {
  setModalOpen(els.colorModal, false);
  setPickingAnimationsPaused(false);
}

function initColorPicker() {
  if (!els.colorModal) return;

  const svPointer = (e) => {
    const rect = els.svCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    colorPicker.s = rect.width > 0 ? x / rect.width : 0;
    colorPicker.v = rect.height > 0 ? 1 - y / rect.height : 0;
    schedulePickerUpdate();
  };
  const huePointer = (e) => {
    const rect = els.hueCanvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    colorPicker.h = rect.width > 0 ? (x / rect.width) * 360 : 0;
    schedulePickerUpdate();
  };




  let activePointerHandler = null;
  window.addEventListener("mousemove", (e) => {
    if (activePointerHandler) activePointerHandler(e);
  });
  window.addEventListener("mouseup", () => {
    if (!activePointerHandler) return;
    activePointerHandler = null;
    finishPickerDrag();
  });

  const dragOn = (canvas, handler) => {
    canvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      activePointerHandler = handler;
      handler(e);
    });
  };

  dragOn(els.svCanvas, svPointer);
  dragOn(els.hueCanvas, huePointer);

  els.colorHex?.addEventListener("change", () => {
    const hex = normalizeHex(els.colorHex.value, currentPickerHex());
    const rgb = hexToRgbTriplet(hex);
    const hsv = rgbToHsv(rgb[0], rgb[1], rgb[2]);
    colorPicker.h = hsv.h;
    colorPicker.s = hsv.s;
    colorPicker.v = hsv.v;
    refreshPickerUI();
    applyPickerColor();
  });

  onActivate(els.colorDone, closeColorPicker);
  els.colorModal.addEventListener("click", (event) => {
    if (event.target === els.colorModal) closeColorPicker();
  });
}



function syncDotStyleUI() {
  const kids = els.dotStyle.children;
  for (let i = 0; i < kids.length; i += 1) {
    const b = kids[i];
    b.classList.toggle("is-active", b.getAttribute("data-style") === settings.dotStyle);
  }
}

function setDotStyle(style) {
  settings.dotStyle = style;
  syncDotStyleUI();
  bumpPreview();
}

function setToggle(el, on) {
  el.classList.toggle("is-on", on);
  el.setAttribute("aria-checked", on ? "true" : "false");
}



let padSliderCtl = null;
let logoSliderCtl = null;
let lgrSliderCtl = null;
let lpadSliderCtl = null;
let bgrSliderCtl = null;
let fdrSliderCtl = null;

function createSlider(sliderEl, fillEl, thumbEl, min, max, onInput) {
  let value = min;
  sliderEl.setAttribute("aria-valuemin", String(min));
  sliderEl.setAttribute("aria-valuemax", String(max));
  const clamp = (v) => Math.max(min, Math.min(max, Math.round(v)));
  function paint() {
    const ratio = max === min ? 0 : (value - min) / (max - min);
    const pct = `${ratio * 100}%`;
    fillEl.style.width = pct;
    thumbEl.style.left = pct;
    sliderEl.setAttribute("aria-valuenow", String(value));
  }
  function valueFromX(clientX) {
    const rect = sliderEl.getBoundingClientRect();
    const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
    return clamp(min + ratio * (max - min));
  }
  function set(v, fire) {
    value = clamp(v);
    paint();
    if (fire) onInput(value);
  }
  let dragging = false;
  const onMove = (e) => {
    if (dragging) set(valueFromX(e.clientX), true);
  };
  const onUp = () => {
    dragging = false;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  sliderEl.addEventListener("mousedown", (e) => {
    e.preventDefault();
    dragging = true;
    set(valueFromX(e.clientX), true);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
  sliderEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      set(value - 1, true);
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      set(value + 1, true);
    }
  });
  paint();
  return { setValue: (v) => set(v, false), getValue: () => value };
}


function applyQuietZone(value) {
  settings.quietZone = clampInt(value, 0, 10, settings.quietZone);
  els.padVal.textContent = String(settings.quietZone);
  bumpPreview();
}


function applyLogoScale(percent) {
  const clamped = Math.max(10, Math.min(30, Math.round(Number(percent) || 20)));
  settings.logoScale = clamped / 100;
  els.logoVal.textContent = `${clamped}%`;
  bumpPreview();
}


function applyLogoRadius(value) {
  settings.logoRadius = clampInt(value, 0, 50, settings.logoRadius);
  els.lgrVal.textContent = `${settings.logoRadius}%`;
  bumpPreview();
}


function applyLogoMaskPadding(value) {
  settings.logoMaskPadding = clampInt(value, 0, 100, settings.logoMaskPadding);
  els.lpadVal.textContent = `${settings.logoMaskPadding}%`;
  bumpPreview();
}


function applyBgRadius(value) {
  settings.bgRadius = clampInt(value, 0, 50, settings.bgRadius);
  els.bgrVal.textContent = `${settings.bgRadius}%`;
  bumpPreview();
}


function applyFinderRadius(value) {
  settings.finderRadius = clampInt(value, 0, 100, settings.finderRadius);
  els.fdrVal.textContent = `${settings.finderRadius}%`;
  bumpPreview();
}



function updateLogoUI() {
  const has = Boolean(settings.logoDataUrl);
  if (has) {
    els.logoThumb.src = settings.logoDataUrl;
    els.logoThumb.classList.add("is-visible");
  } else {
    els.logoThumb.removeAttribute("src");
    els.logoThumb.classList.remove("is-visible");
  }
  els.logoRemove.classList.toggle("is-disabled", !has);
  setHidden(els.logoSizeRow, !has);
  setHidden(els.logoRadiusRow, !has);
  setHidden(els.logoPadRow, !has);
  els.logoVal.textContent = `${Math.round(settings.logoScale * 100)}%`;
  els.lgrVal.textContent = `${settings.logoRadius}%`;
  els.lpadVal.textContent = `${settings.logoMaskPadding}%`;
  if (logoSliderCtl) logoSliderCtl.setValue(Math.round(settings.logoScale * 100));
  if (lgrSliderCtl) lgrSliderCtl.setValue(settings.logoRadius);
  if (lpadSliderCtl) lpadSliderCtl.setValue(settings.logoMaskPadding);
}




async function applyLogo(bytes, dataUrl) {
  if (!bytes) {
    settings.logoDataUrl = null;
    settings.logoRgba = null;
    updateLogoUI();
    regenerateMatrix();
    return;
  }

  let decoded;
  try {
    decoded = decodePng(bytes);
  } catch (_error) {
    log("Logo must be a PNG image.", "error");
    return;
  }

  settings.logoRgba = decoded;
  settings.logoDataUrl = dataUrl || `data:image/png;base64,${base64FromBytes(bytes)}`;
  updateLogoUI();
  regenerateMatrix();
}

async function onUploadLogo() {
  try {
    const file = await fs.getFileForOpening({ types: ["png"] });
    if (!file) return;
    const data = await file.read({ format: formats.binary });
    const bytes = new Uint8Array(data);
    await applyLogo(bytes, `data:image/png;base64,${base64FromBytes(bytes)}`);
    if (settings.logoRgba) log("Logo added.", "success");
  } catch (error) {
    log(getErrorText(error), "error");
    console.error(error);
  }
}



async function refreshDesignList(selectedName) {
  try {
    cachedDesigns = await designsStore.loadDesigns();
  } catch (_error) {
    cachedDesigns = {};
  }

  const select = els.designSelect;
  select.innerHTML = "";
  const custom = document.createElement("option");
  custom.value = "";
  custom.textContent = "Custom (unsaved)";
  select.appendChild(custom);

  for (const name of Object.keys(cachedDesigns).sort()) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }

  select.value = selectedName && cachedDesigns[selectedName] ? selectedName : "";
}

async function applyDesignSettings(design) {
  applyingDesign = true;
  settings.fgColor = normalizeHex(design.fgColor, "#000000");
  settings.bgColor = normalizeHex(design.bgColor, "#ffffff");
  settings.transparent = Boolean(design.transparent);
  settings.dotStyle = ["square", "rounded", "smooth"].includes(design.dotStyle)
    ? design.dotStyle
    : "square";
  settings.quietZone = clampInt(design.quietZone, 0, 10, 4);
  settings.bgRadius = clampInt(design.bgRadius, 0, 50, 0);
  settings.finderRadius = clampInt(design.finderRadius, 0, 100, 0);
  settings.logoScale = typeof design.logoScale === "number" ? design.logoScale : 0.2;
  settings.logoRadius = clampInt(design.logoRadius, 0, 50, 25);
  settings.logoMaskPadding = clampInt(design.logoMaskPadding, 0, 100, 100);

  updateColorChip("fg");
  updateColorChip("bg");
  syncDotStyleUI();
  setToggle(els.bgTransparent, settings.transparent);
  els.padVal.textContent = String(settings.quietZone);
  els.bgrVal.textContent = `${settings.bgRadius}%`;
  els.fdrVal.textContent = `${settings.finderRadius}%`;
  els.logoVal.textContent = `${Math.round(settings.logoScale * 100)}%`;
  if (padSliderCtl) padSliderCtl.setValue(settings.quietZone);
  if (bgrSliderCtl) bgrSliderCtl.setValue(settings.bgRadius);
  if (fdrSliderCtl) fdrSliderCtl.setValue(settings.finderRadius);
  if (logoSliderCtl) logoSliderCtl.setValue(Math.round(settings.logoScale * 100));
  applyingDesign = false;


  if (design.logoDataUrl) {
    await applyLogo(dataUrlToBytes(design.logoDataUrl), design.logoDataUrl);
  } else {
    await applyLogo(null);
  }
}

async function onSaveDesign() {
  const name = (els.designName.value || "").trim();
  if (!name) {
    log("Enter a design name to save.", "error");
    return;
  }
  try {
    await designsStore.saveDesign(name, settings);
    await refreshDesignList(name);
    log(`Saved design "${name}".`, "success");
  } catch (error) {
    log(getErrorText(error), "error");
    console.error(error);
  }
}

async function onDeleteDesign() {
  const name = els.designSelect.value;
  if (!name) {
    log("Select a saved design to delete.", "error");
    return;
  }
  try {
    await designsStore.deleteDesign(name);
    await refreshDesignList("");
    els.designName.value = "";
    log(`Deleted design "${name}".`, "success");
  } catch (error) {
    log(getErrorText(error), "error");
    console.error(error);
  }
}

async function resetSettings() {
  settings.fgColor = "#000000";
  settings.bgColor = "#ffffff";
  settings.transparent = false;
  settings.dotStyle = "square";
  settings.quietZone = 4;
  settings.bgRadius = 0;
  settings.finderRadius = 0;
  settings.logoScale = 0.2;
  settings.logoRadius = 25;
  settings.logoMaskPadding = 100;

  updateColorChip("fg");
  updateColorChip("bg");
  syncDotStyleUI();
  setToggle(els.bgTransparent, false);
  els.padVal.textContent = String(settings.quietZone);
  els.bgrVal.textContent = `${settings.bgRadius}%`;
  els.fdrVal.textContent = `${settings.finderRadius}%`;
  if (padSliderCtl) padSliderCtl.setValue(settings.quietZone);
  if (bgrSliderCtl) bgrSliderCtl.setValue(settings.bgRadius);
  if (fdrSliderCtl) fdrSliderCtl.setValue(settings.finderRadius);
  if (els.designSelect) els.designSelect.value = "";
  els.designName.value = "";


  await applyLogo(null);
  log("Settings reset to defaults.", "success");
}



function updateConfigUI() {




  if (els.renderDir) {
    els.renderDir.value = config.renderDir || `Next to project (${normalizeBinName(config.binName)})`;
  }
  if (els.binNameInput) els.binNameInput.value = normalizeBinName(config.binName);
  if (els.formatSelect) els.formatSelect.value = normalizeExportFormat(config.format);
}

async function persistConfig() {
  try {
    config.format = normalizeExportFormat(config.format);
    config.binName = normalizeBinName(config.binName);
    config = await appConfig.saveConfig(config);
  } catch (error) {
    log(getErrorText(error), "error");
  }
}

async function pickRenderDir() {
  try {
    const folder = await fs.getFolder();
    if (!folder) return;
    config.renderDir = fs.getNativePath(folder);


    try {
      config.renderDirToken = await fs.createPersistentToken(folder);
    } catch (_e) {
      config.renderDirToken = null;
    }
    updateConfigUI();
    await persistConfig();
  } catch (error) {
    log(getErrorText(error), "error");
  }
}

function openExternal(url) {
  try {
    const uxp = require("uxp");
    if (uxp.shell && typeof uxp.shell.openExternal === "function") {
      uxp.shell.openExternal(url);
      return;
    }
  } catch (_error) {

  }
  log(`Open in your browser: ${url}`);
}




async function initUpdateCheck() {
  try {
    const res = await updateCheck.checkForUpdate();
    if (!res || !res.hasUpdate) return;
    if (res.latestVersion === config.updateLastDismissed) return;

    const rememberDismissed = async () => {
      try {
        config = await appConfig.saveConfig({
          ...config,
          updateLastDismissed: res.latestVersion,
        });
      } catch (_error) {

      }
    };

    showUpdateToast(
      res.latestVersion,
      () => {
        openExternal(res.releaseUrl);
        rememberDismissed();
      },
      rememberDismissed
    );
  } catch (_error) {

  }
}

async function initSettingsModal() {
  if (!els.settingsBtn) return;
  try {
    config = await appConfig.loadConfig();
  } catch (_error) {
    config = { ...appConfig.DEFAULTS };
  }
  config.format = normalizeExportFormat(config.format);
  updateConfigUI();

  onActivate(els.settingsBtn, () => setModalOpen(els.settingsModal, true));
  onActivate(els.settingsClose, () => setModalOpen(els.settingsModal, false));
  els.settingsModal.addEventListener("click", (event) => {
    if (event.target === els.settingsModal) setModalOpen(els.settingsModal, false);
  });
  els.formatSelect.addEventListener("change", async () => {
    config.format = normalizeExportFormat(els.formatSelect.value);
    await persistConfig();
  });
  onActivate(els.renderDirPick, pickRenderDir);
  onActivate(els.renderDirClear, async () => {
    config.renderDir = null;
    config.renderDirToken = null;
    updateConfigUI();
    await persistConfig();
  });





  let binNameDebounce = null;
  function commitBinName(persistImmediately) {
    config.binName = normalizeBinName(els.binNameInput.value);
    generatedQr = null;


    if (els.renderDir && !config.renderDir) {
      els.renderDir.value = `Next to project (${config.binName})`;
    }
    clearTimeout(binNameDebounce);
    if (persistImmediately) {
      persistConfig();
    } else {
      binNameDebounce = setTimeout(persistConfig, 400);
    }
  }
  els.binNameInput?.addEventListener("input", () => commitBinName(false));
  els.binNameInput?.addEventListener("change", () => {


    els.binNameInput.value = normalizeBinName(els.binNameInput.value);
    commitBinName(true);
  });
}

function toggleCustomize() {
  const open = els.customize.classList.toggle("is-open");
  setHidden(els.customizeBody, !open);
  els.customizeToggle.setAttribute("aria-expanded", open ? "true" : "false");

  if (open && previewQr) renderPreview();
}



function initCustomizeResize() {
  const grip = els.customizeGrip;
  const body = els.customizeBody;
  if (!grip || !body) return;

  const MIN_BODY = 80;
  const MIN_PREVIEW = 120;
  let dragging = false;
  let startY = 0;
  let startHeight = 0;
  let maxHeight = 0;

  const isOpen = () => els.customize.classList.contains("is-open");

  function applyHeight(h) {
    body.style.height = `${Math.max(MIN_BODY, Math.min(maxHeight, h))}px`;
    if (previewQr) renderPreview();
  }

  function beginDrag(clientY) {
    startY = clientY;
    startHeight = body.offsetHeight;
    const previewH = els.previewPanel ? els.previewPanel.clientHeight : 200;

    maxHeight = startHeight + Math.max(0, previewH - MIN_PREVIEW);
  }

  const onMove = (e) => {
    if (!dragging) return;
    applyHeight(startHeight + (startY - e.clientY));
  };
  const onUp = () => {
    dragging = false;
    document.body.classList.remove("is-resizing");
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };

  grip.addEventListener("mousedown", (e) => {
    if (!isOpen()) return;
    e.preventDefault();
    dragging = true;
    beginDrag(e.clientY);
    document.body.classList.add("is-resizing");
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  grip.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      beginDrag(0);
      applyHeight(startHeight + (e.key === "ArrowUp" ? 24 : -24));
    }
  });
}

function initCustomizeControls() {
  if (!els.customize) return;

  onActivate(els.customizeToggle, toggleCustomize);

  updateColorChip("fg");
  updateColorChip("bg");
  onActivate(els.fgChip, () => openColorPicker("fg"));
  onActivate(els.bgChip, () => openColorPicker("bg"));
  initColorPicker();

  const styleKids = els.dotStyle.children;
  for (let i = 0; i < styleKids.length; i += 1) {
    const b = styleKids[i];
    onActivate(b, () => setDotStyle(b.getAttribute("data-style")));
  }
  syncDotStyleUI();

  onActivate(els.bgTransparent, () => {
    settings.transparent = !settings.transparent;
    setToggle(els.bgTransparent, settings.transparent);
    bumpPreview();
  });

  padSliderCtl = createSlider(els.padSlider, els.padFill, els.padThumb, 0, 10, applyQuietZone);
  padSliderCtl.setValue(settings.quietZone);
  els.padVal.textContent = String(settings.quietZone);

  bgrSliderCtl = createSlider(els.bgrSlider, els.bgrFill, els.bgrThumb, 0, 50, applyBgRadius);
  bgrSliderCtl.setValue(settings.bgRadius);
  els.bgrVal.textContent = `${settings.bgRadius}%`;

  fdrSliderCtl = createSlider(els.fdrSlider, els.fdrFill, els.fdrThumb, 0, 100, applyFinderRadius);
  fdrSliderCtl.setValue(settings.finderRadius);
  els.fdrVal.textContent = `${settings.finderRadius}%`;

  onActivate(els.logoUpload, onUploadLogo);
  onActivate(els.logoRemove, () => applyLogo(null));
  logoSliderCtl = createSlider(els.logoSlider, els.logoFill, els.logoThumbHandle, 10, 30, applyLogoScale);
  logoSliderCtl.setValue(Math.round(settings.logoScale * 100));
  lgrSliderCtl = createSlider(els.lgrSlider, els.lgrFill, els.lgrThumb, 0, 50, applyLogoRadius);
  lgrSliderCtl.setValue(settings.logoRadius);
  els.lgrVal.textContent = `${settings.logoRadius}%`;
  lpadSliderCtl = createSlider(els.lpadSlider, els.lpadFill, els.lpadThumb, 0, 100, applyLogoMaskPadding);
  lpadSliderCtl.setValue(settings.logoMaskPadding);
  els.lpadVal.textContent = `${settings.logoMaskPadding}%`;
  updateLogoUI();

  onActivate(els.resetBtn, resetSettings);

  onActivate(els.designSave, onSaveDesign);
  onActivate(els.designDelete, onDeleteDesign);
  els.designSelect.addEventListener("change", async () => {
    const name = els.designSelect.value;
    if (!name) return;
    const design = cachedDesigns[name];
    if (!design) return;
    els.designName.value = name;
    await applyDesignSettings(design);
  });

  refreshDesignList("");
}

els.log?.addEventListener("click", hideLog);
initEmptyStateAnimation();
initCustomizeControls();
initCustomizeResize();
initFolderSetupModal();
initPopupTestModal();


initSettingsModal()
  .catch(() => {})
  .then(initUpdateCheck);
observePreviewResize();
