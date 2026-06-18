

function normalizePath(value) {
  return String(value || "").replace(/\\/g, "/").toLowerCase();
}

function getProjectDirectoryPath(projectPath) {
  const normalized = String(projectPath || "").replace(/\\/g, "/");
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex <= 0) {
    return "";
  }
  return normalized.slice(0, slashIndex);
}

function formatTimestampForFile(date = new Date()) {
  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${y}${m}${d}-${hh}${mm}${ss}`;
}


function buildUrlSlug(urlValue) {
  let parsed;
  try {
    parsed = new URL(urlValue);
  } catch (_error) {
    return "tiny-qr";
  }

  const host = parsed.hostname.replace(/^www\./i, "");
  const path = parsed.pathname === "/" ? "" : parsed.pathname;
  const query = parsed.search || "";
  const raw = `${host}${path}${query}`.toLowerCase();

  const sanitized = raw
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!sanitized) return "tiny-qr";
  return sanitized.slice(0, 80);
}

module.exports = {
  normalizePath,
  getProjectDirectoryPath,
  formatTimestampForFile,
  buildUrlSlug,
};
