# Contributing

Thanks for thinking about contributing!

## Quick start
1. Fork the repo
2. Create a branch: `git checkout -b feature/my-change`
3. Install deps: `npm install`
4. Run dev:
   - `npm run dev`
   - `npm run electron:dev` (in another terminal)
5. Open a PR

## Guidelines
- Keep changes focused and easy to review
- Prefer small PRs with a clear description
- If you change behavior, add a short note to the README

## Dev notes
- The Keep import logic lives in `electron/main.cjs`
- UI lives in `src/App.jsx`
