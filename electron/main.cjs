const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const isDev = !!process.env.VITE_DEV_SERVER_URL;
const STATE_FILE = "keep-sticky-board-state.json";

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: "#f6f3ea",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

function getStatePath() {
  return path.join(app.getPath("userData"), STATE_FILE);
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function walk(dir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, results);
    } else {
      results.push(full);
    }
  }
  return results;
}

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function extractText(note) {
  if (typeof note.textContent === "string" && note.textContent.trim()) {
    return note.textContent;
  }

  if (Array.isArray(note.listContent)) {
    return note.listContent
      .map((item) => {
        if (!item) return "";
        const text = item.text || "";
        const checked = item.isChecked ? "[x] " : "[ ] ";
        return checked + text;
      })
      .filter(Boolean)
      .join("\n");
  }

  if (typeof note.text === "string") return note.text;
  return "";
}

function extractLabels(note) {
  if (!Array.isArray(note.labels)) return [];
  return note.labels
    .map((l) => {
      if (typeof l === "string") return l;
      if (l && typeof l.name === "string") return l.name;
      return null;
    })
    .filter(Boolean);
}

function resolvePossibleImage(baseDir, rawPath) {
  if (!rawPath || typeof rawPath !== "string") return null;

  if (path.isAbsolute(rawPath) && fileExists(rawPath)) return rawPath;

  const cleaned = rawPath.replace(/^\.?[\\/]/, "");
  const candidate = path.join(baseDir, cleaned);
  if (fileExists(candidate)) return candidate;

  return null;
}

function extractImages(note, jsonPath) {
  const baseDir = path.dirname(jsonPath);
  const out = [];
  const seen = new Set();

  const pushImage = (p) => {
    if (!p) return;
    const normalized = path.normalize(p);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  };

  const directFields = [
    note.image,
    note.imagePath,
    note.imageUrl,
    note.thumbnail,
  ];

  for (const item of directFields) {
    if (typeof item === "string") {
      pushImage(resolvePossibleImage(baseDir, item) || item);
    }
  }

  const collections = [
    note.images,
    note.attachments,
    note.media,
  ];

  for (const coll of collections) {
    if (!Array.isArray(coll)) continue;
    for (const item of coll) {
      if (typeof item === "string") {
        pushImage(resolvePossibleImage(baseDir, item) || item);
      } else if (item && typeof item === "object") {
        pushImage(
          resolvePossibleImage(
            baseDir,
            item.path ||
              item.filePath ||
              item.file ||
              item.src ||
              item.url ||
              item.image ||
              item.imageUrl ||
              item.thumbnail
          ) ||
            item.path ||
            item.filePath ||
            item.file ||
            item.src ||
            item.url ||
            item.image ||
            item.imageUrl ||
            item.thumbnail
        );
      }
    }
  }

  // Sidecar image with same basename as note JSON
  const parsed = path.parse(jsonPath);
  const sidecarExts = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
  for (const ext of sidecarExts) {
    const sidecar = path.join(parsed.dir, parsed.name + ext);
    if (fileExists(sidecar)) pushImage(sidecar);
  }

  return out;
}

function isLikelyKeepNote(note) {
  return note && typeof note === "object" && (
    "title" in note ||
    "textContent" in note ||
    "listContent" in note ||
    "labels" in note
  );
}

function importKeepFolder(folder) {
  const allFiles = walk(folder);
  const jsonFiles = allFiles.filter((f) => f.toLowerCase().endsWith(".json"));

  const notes = [];

  for (const file of jsonFiles) {
    const raw = safeReadJson(file);
    if (!isLikelyKeepNote(raw)) continue;

    const title = (raw.title || "").trim();
    const text = extractText(raw);
    const labels = extractLabels(raw);
    const color = (raw.color || "yellow").toLowerCase();

    const images = extractImages(raw, file);

    notes.push({
      id: raw.id || path.relative(folder, file),
      title: title || "(untitled)",
      text,
      labels,
      color,
      images,
    });
  }

  return {
    keepDir: folder,
    count: notes.length,
    notes,
  };
}

ipcMain.handle("keep:pickFolder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Select Google Keep export folder",
  });

  if (result.canceled || !result.filePaths?.length) return null;
  return result.filePaths[0];
});

ipcMain.handle("keep:import", async (_, folder) => {
  try {
    const data = importKeepFolder(folder);
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message || "Import failed" };
  }
});

ipcMain.handle("state:load", async () => {
  try {
    const statePath = getStatePath();
    if (!fs.existsSync(statePath)) return { ok: true, data: null };
    const data = JSON.parse(fs.readFileSync(statePath, "utf8"));
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: error.message || "Could not load state" };
  }
});

ipcMain.handle("state:save", async (_, data) => {
  try {
    const statePath = getStatePath();
    fs.writeFileSync(statePath, JSON.stringify(data, null, 2), "utf8");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || "Could not save state" };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});