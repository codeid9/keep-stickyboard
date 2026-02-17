import { useEffect, useMemo, useRef, useState } from "react";
import Draggable from "react-draggable";
import "./app.css";

const COLORS = {
  yellow: true,
  orange: true,
  red: true,
  green: true,
  teal: true,
  blue: true,
  purple: true,
  gray: true
};

function autoLayout(notes) {
  const cols = 6;
  const gapX = 260;
  const gapY = 220;
  const startX = 40;
  const startY = 120;

  const positions = {};
  notes.forEach((n, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    positions[n.id] = {
      x: startX + col * gapX + (i % 3) * 8,
      y: startY + row * gapY + (i % 5) * 6
    };
  });
  return positions;
}

function linkifyText(text) {
  const input = String(text ?? "");
  const urlRegex = /((https?:\/\/|www\.)[^\s<>()]+[^\s<>().,!?;:"')\]])/gi;
  const parts = input.split(urlRegex);

  return parts.map((part, i) => {
    if (!part) return null;

    const isUrl = urlRegex.test(part);
    urlRegex.lastIndex = 0;

    if (!isUrl) return part;

    const href = part.startsWith("http") ? part : `https://${part}`;
    return (
      <a
        key={`url-${i}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    );
  });
}

export default function App() {
  const [importInfo, setImportInfo] = useState(null);
  const [notes, setNotes] = useState([]);
  const [positions, setPositions] = useState({});
  const [query, setQuery] = useState("");
  const [activeLabel, setActiveLabel] = useState("ALL");
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      if (!window.keepAPI) return;
      const res = await window.keepAPI.loadState();
      if (res?.ok && res.data) {
        setPositions(res.data.positions || {});
        setImportInfo(res.data.importInfo || null);
        setNotes(res.data.notes || []);
      }
    })();
  }, []);

  function scheduleSave(next) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!window.keepAPI) return;
      await window.keepAPI.saveState(next);
    }, 250);
  }

  async function onImportClick() {
    if (!window.keepAPI) {
      alert("Import only works in the Electron app window.");
      return;
    }

    const folder = await window.keepAPI.pickKeepFolder();
    if (!folder) return;

    const res = await window.keepAPI.importKeep(folder);
    if (!res.ok) {
      alert(res.error || "Import failed");
      return;
    }

    const parsed = res.data;
    setImportInfo({ folder, keepDir: parsed.keepDir, count: parsed.count });
    setNotes(parsed.notes);

    const existing = positions || {};
    const missing = parsed.notes.filter((n) => !existing[n.id]);
    const auto = autoLayout(missing);

    const nextPositions = { ...existing, ...auto };
    setPositions(nextPositions);

    const nextState = {
      importInfo: { folder, keepDir: parsed.keepDir, count: parsed.count },
      notes: parsed.notes,
      positions: nextPositions
    };
    scheduleSave(nextState);
  }

  const allLabels = useMemo(() => {
    const s = new Set();
    for (const n of notes) for (const l of n.labels || []) s.add(l);
    return ["ALL", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [notes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => {
      if (activeLabel !== "ALL" && !(n.labels || []).includes(activeLabel)) return false;
      if (!q) return true;
      const hay = `${n.title || ""}\n${n.text || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [notes, query, activeLabel]);

  function noteColor(n) {
    const c = String(n.color || "").toLowerCase();
    return COLORS[c] ? c : "yellow";
  }

  function updatePosition(id, x, y) {
    const nextPositions = { ...positions, [id]: { ...(positions[id] || {}), x, y } };
    setPositions(nextPositions);

    const nextState = { importInfo, notes, positions: nextPositions };
    scheduleSave(nextState);
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="logo">🗒️</div>
          <div className="titles">
            <div className="title">Keep Sticky Board</div>
            <div className="subtitle">
              {importInfo ? `Imported: ${importInfo.count} notes` : "Import your Google Keep Takeout"}
            </div>
          </div>
        </div>

        <div className="controls">
          <button className="btn" onClick={onImportClick}>Import Keep…</button>
          <input
            className="search"
            placeholder="Search title or text…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="select" value={activeLabel} onChange={(e) => setActiveLabel(e.target.value)}>
            {allLabels.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="board">
        {filtered.map((n) => {
          const pos = positions[n.id] || { x: 60, y: 140 };
          const c = noteColor(n);
          const text = ((n.text || "").trim() || "…");

          return (
            <Draggable
              key={n.id}
              position={{ x: pos.x ?? 60, y: pos.y ?? 140 }}
              onStop={(_, data) => updatePosition(n.id, data.x, data.y)}
              handle=".note-header"
            >
              <div className={`note note-${c}`}>
                <div className="note-header">
                  <div className="note-title">{n.title || "(untitled)"}</div>
                </div>

                <div className="note-body">
                  <div className="note-text">{linkifyText(text)}</div>
                </div>

                {(n.labels?.length || 0) > 0 ? (
                  <div className="note-footer">
                    {n.labels.map((l) => (
                      <button key={l} className="chip" onClick={() => setActiveLabel(l)} title="Filter by label">
                        {l}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </Draggable>
          );
        })}
      </div>
    </div>
  );
}
