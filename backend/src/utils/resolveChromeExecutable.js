import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer";

const SNAP_STUB_RE =
  /snap install chromium|chromium snap to be installed|requires the chromium snap/i;

/** Atalhos Snap no Ubuntu (/usr/bin/chromium-browser); não vale para o Chrome do Puppeteer. */
function isSnapChromiumStub(filePath) {
  if (!filePath.startsWith("/usr/bin/")) return false;
  try {
    const sample = fs.readFileSync(filePath, { encoding: "utf8" }).slice(0, 4096);
    return SNAP_STUB_RE.test(sample);
  } catch {
    return false;
  }
}

function isExecutableFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;
    fs.accessSync(filePath, fs.constants.X_OK);
    if (isSnapChromiumStub(filePath)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Procura chrome/chrome-linux64/chrome dentro do cache do Puppeteer. */
function findChromeInCacheDir(cacheDir) {
  const chromeRoot = path.join(cacheDir, "chrome");
  if (!fs.existsSync(chromeRoot)) return null;

  const names = fs.readdirSync(chromeRoot).sort().reverse();
  for (const name of names) {
    const base = path.join(chromeRoot, name);
    const candidates = [
      path.join(base, "chrome-linux64", "chrome"),
      path.join(base, "chrome-win64", "chrome-win64", "chrome.exe"),
      path.join(
        base,
        "chrome-mac",
        "Google Chrome for Testing.app",
        "Contents",
        "MacOS",
        "Google Chrome for Testing",
      ),
    ];
    for (const candidate of candidates) {
      if (isExecutableFile(candidate)) return candidate;
    }
  }
  return null;
}

function puppeteerCacheDirs() {
  const dirs = [];
  if (process.env.PUPPETEER_CACHE_DIR) {
    dirs.push(path.resolve(process.env.PUPPETEER_CACHE_DIR));
  }
  dirs.push(path.join(process.cwd(), ".cache", "puppeteer"));
  if (process.env.HOME) {
    dirs.push(path.join(process.env.HOME, ".cache", "puppeteer"));
  }
  return [...new Set(dirs)];
}

/**
 * Caminho do Chrome/Chromium para PDFs (Puppeteer).
 * Ordem: env válido → puppeteer.executablePath() → varredura do cache → /usr/bin/chromium.
 */
export function resolveChromeExecutable() {
  const envPath = (process.env.PUPPETEER_EXECUTABLE_PATH || "").trim();
  if (envPath && isExecutableFile(envPath)) return envPath;

  try {
    const fromPuppeteer = puppeteer.executablePath();
    if (isExecutableFile(fromPuppeteer)) return fromPuppeteer;
  } catch {
    /* instalado via browsers install ou ensure-chrome.mjs */
  }

  for (const cacheDir of puppeteerCacheDirs()) {
    const found = findChromeInCacheDir(cacheDir);
    if (found) return found;
  }

  for (const systemPath of [
    "/usr/bin/chromium",
    "/usr/bin/google-chrome-stable",
  ]) {
    if (isExecutableFile(systemPath)) return systemPath;
  }

  return null;
}
