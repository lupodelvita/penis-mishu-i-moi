# NodeWeaver Desktop Application

Cross-platform desktop application for NodeWeaver OSINT graph visualization.

## Development

```bash
# Install dependencies
npm install

# Run in development mode (requires web and api to be running)
npm run dev
```

## Building

### Windows

```bash
npm run package:win
```

### macOS

```bash
npm run package:mac
```

### Linux

```bash
npm run package:linux
```

## Architecture

The desktop app is built with Electron and wraps the Next.js web application:

- **main.ts** - Main Electron process, window management, native menus
- **preload.ts** - Bridge between main and renderer process
- **renderer/** - Built Next.js app (production only)

## Features

- Native file dialogs (Open, Save, Export)
- Custom application menu with keyboard shortcuts
- System tray integration (planned)
- Auto-updates (planned)
- Offline support (planned)

## Menu Shortcuts

| Action         | Shortcut     |
| -------------- | ------------ |
| New Graph      | Ctrl+N       |
| Open Graph     | Ctrl+O       |
| Save           | Ctrl+S       |
| Save As        | Ctrl+Shift+S |
| Run Transforms | Ctrl+T       |
| Add Entity     | Ctrl+E       |
| Settings       | Ctrl+,       |
| Zoom In        | Ctrl++       |
| Zoom Out       | Ctrl+-       |
| Fit to Window  | Ctrl+0       |
