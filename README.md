# Keep Sticky Board

Desktop app that imports your **Google Keep** export (Google Takeout) and visualizes your notes as **draggable sticky notes**—like a big infinite board you can rearrange.

<img src="https://raw.githubusercontent.com/monapdx/keep-stickyboard/refs/heads/main/screenshot.png">

## Features

- Import Google Keep exports (`.json` / `.html`) from **Google Takeout**
- Draggable sticky notes (drag by the header)
- Search by title/text
- Filter by Keep labels
- Saves your board layout locally (persists positions between launches)

## Getting your Google Keep export

1. Go to Google Takeout and export **Keep**  
   - https://takeout.google.com/
2. Download the export ZIP and extract it.
3. In the app, click **Import Keep…** and select either:
   - the extracted **Takeout** folder (recommended), or
   - the **Keep** folder inside it

The importer will automatically detect `Takeout/Keep` or `Keep`.

## Development

### Prereqs
- Node.js 18+ recommended
- npm

### Install
```bash
npm install
```

### Run (Vite only)
```bash
npm run dev
```

### Run the desktop app (Electron + Vite dev server)
In one terminal:
```bash
npm run dev
```
In another terminal:
```bash
npm run electron:dev
```

## Build

### Build the web bundle
```bash
npm run build
```

### Build the desktop installer (electron-builder)
```bash
npm run electron:build
```

Output goes to `release/`.

## How layout is saved

Board state is stored in Electron's `userData` directory as `board_state.json` (positions, imported notes metadata).  
Your Keep export is only read during import.

## License

MIT — see [LICENSE](LICENSE).
