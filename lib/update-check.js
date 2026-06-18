






const { storage } = require("uxp");
const fs = storage.localFileSystem;
const formats = storage.formats;
const appConfig = require("./app-config");


const REPO = "crinzip/tiny-qr-pr";

const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const FETCH_TIMEOUT_MS = 10000;


const MIN_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

const FALLBACK_VERSION = "0.0.0";



async function getCurrentVersion() {
  try {
    const folder = await fs.getPluginFolder();
    const file = await folder.getEntry("manifest.json");
    const text = await file.read({ format: formats.utf8 });
    const version = JSON.parse(text).version;
    return typeof version === "string" && version ? version : FALLBACK_VERSION;
  } catch (_error) {
    return FALLBACK_VERSION;
  }
}


function parseVersion(raw) {
  const clean = String(raw || "").trim().replace(/^v/i, "");
  const [core, pre = ""] = clean.split("-");
  const parts = core.split(".").map((n) => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return { parts, pre };
}



function compareVersions(a, b) {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (let i = 0; i < 3; i += 1) {
    if (va.parts[i] > vb.parts[i]) return 1;
    if (va.parts[i] < vb.parts[i]) return -1;
  }
  if (va.pre && !vb.pre) return -1;
  if (!va.pre && vb.pre) return 1;
  if (va.pre && vb.pre) return va.pre.localeCompare(vb.pre);
  return 0;
}

async function fetchLatestRelease(etag) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers = { Accept: "application/vnd.github+json" };
    if (etag) headers["If-None-Match"] = etag;
    const res = await fetch(API_URL, {
      method: "GET",
      headers,
      cache: "no-cache",
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}


async function checkForUpdate() {
  let config;
  try {
    config = await appConfig.loadConfig();
  } catch (_error) {
    config = { ...appConfig.DEFAULTS };
  }

  const currentVersion = await getCurrentVersion();
  const cache = config.updateCache || null;
  const fresh =
    cache && cache.checkedAt && Date.now() - cache.checkedAt < MIN_CHECK_INTERVAL_MS;


  if (fresh && cache.latestVersion) {
    return result(currentVersion, cache.latestVersion, cache.releaseUrl);
  }

  let latestVersion;
  let releaseUrl;
  try {
    const res = await fetchLatestRelease(cache && cache.etag);
    if (res.status === 304 && cache && cache.latestVersion) {

      await saveCache(config, cache.etag, cache.latestVersion, cache.releaseUrl);
      return result(currentVersion, cache.latestVersion, cache.releaseUrl);
    }
    if (!res.ok) return null;

    const data = await res.json();
    latestVersion = String(data.tag_name || "").replace(/^v/i, "");
    releaseUrl = data.html_url || `https://github.com/${REPO}/releases/latest`;
    if (!latestVersion) return null;

    await saveCache(config, res.headers.get("etag"), latestVersion, releaseUrl);
  } catch (_error) {

    return null;
  }

  return result(currentVersion, latestVersion, releaseUrl);
}

function result(currentVersion, latestVersion, releaseUrl) {
  return {
    hasUpdate: compareVersions(latestVersion, currentVersion) > 0,
    currentVersion,
    latestVersion,
    releaseUrl: releaseUrl || `https://github.com/${REPO}/releases/latest`,
  };
}

async function saveCache(config, etag, latestVersion, releaseUrl) {
  try {
    await appConfig.saveConfig({
      ...config,
      updateCache: {
        etag: etag || null,
        latestVersion,
        releaseUrl: releaseUrl || null,
        checkedAt: Date.now(),
      },
    });
  } catch (_error) {

  }
}

module.exports = { checkForUpdate, compareVersions };
