const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#0b0f39",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;

  if (devUrl) {
    win.loadURL(devUrl);
    // Helpful while reconstructing:
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../dist/index.html"));
    // win.webContents.openDevTools({ mode: "detach" });
  }
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function findKeepDir(selected) {
  const keep1 = path.join(selected, "Keep");
  const keep2 = path.join(selected, "Takeout", "Keep");
  if (fs.existsSync(keep1)) return keep1;
  if (fs.existsSync(keep2)) return keep2;
  return selected;
}

function collectAttachments(dir, stem) {
  const items = [];
  const files = fs.readdirSync(dir);

  for (const name of files) {
    const ext = path.extname(name).toLowerCase();
    const base = path.basename(name, ext);
    if (!base.startsWith(stem)) continue;
    if (ext === ".json" || ext === ".html") continue;

    items.push({ name, path: path.join(dir, name) });
  }

  return items;
}

function parseKeepFolder(keepDir) {
  const files = fs.readdirSync(keepDir);
  const jsons = files.filter((f) => f.toLowerCase().endsWith(".json"));
  const notes = [];

  for (const jf of jsons) {
    const jp = path.join(keepDir, jf);
    const data = readJsonSafe(jp) || {};
    const stem = path.basename(jf, ".json");

    let text = (data.textContent || "").trim();

    const hp = path.join(keepDir, `${stem}.html`);
    if (!text && fs.existsSync(hp)) {
      const html = fs.readFileSync(hp, "utf-8");
      text = stripHtml(html);
    }

    const labels = Array.isArray(data.labels)
      ? data.labels.map((x) => (typeof x === "string" ? x : x?.name)).filter(Boolean)
      : [];

    notes.push({
      id: stem,
      title: (data.title || stem).trim(),
      text,
      labels,
      pinned: !!data.isPinned,
      archived: !!data.isArchived,
      color: data.color || data.backgroundColor || "yellow",
      attachments: collectAttachments(keepDir, stem),
      source: jp
    });
  }

  if (notes.length === 0) {
    for (const f of files) {
      if (!f.toLowerCase().endsWith(".html")) continue;

      const hp = path.join(keepDir, f);
      const stem = path.basename(f, ".html");
      const html = fs.readFileSync(hp, "utf-8");

      notes.push({
        id: stem,
        title: stem,
        text: stripHtml(html),
        labels: [],
        pinned: false,
        archived: false,
        color: "yellow",
        attachments: collectAttachments(keepDir, stem),
        source: hp
      });
    }
  }

  return { keepDir, count: notes.length, notes };
}

function getStatePath() {
  return path.join(app.getPath("userData"), "board_state.json");
}

ipcMain.handle("pick-keep-folder", async () => {
  const res = await dialog.showOpenDialog({
    title: "Select Google Takeout folder (or Keep folder)",
    properties: ["openDirectory"]
  });
  if (res.canceled || !res.filePaths?.[0]) return null;
  return res.filePaths[0];
});

ipcMain.handle("import-keep", async (_evt, selectedFolder) => {
  const keepDir = findKeepDir(selectedFolder);
  if (!fs.existsSync(keepDir)) return { ok: false, error: `Folder not found: ${keepDir}` };
  return { ok: true, data: parseKeepFolder(keepDir) };
});

ipcMain.handle("load-state", async () => {
  const p = getStatePath();
  if (!fs.existsSync(p)) return { ok: true, data: null };
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(p, "utf-8")) };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
});

ipcMain.handle("save-state", async (_evt, state) => {
  const p = getStatePath();
  try {
    fs.writeFileSync(p, JSON.stringify(state, null, 2), "utf-8");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
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
