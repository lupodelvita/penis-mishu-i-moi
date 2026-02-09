# NodeWeaver - Modern OSINT Graph Visualization Tool

**NodeWeaver** is a powerful, cross-platform desktop application for OSINT investigations and graph-based data visualization. Weave connections between data nodes to uncover hidden patterns and relationships.

![NodeWeaver Screenshot](docs/screenshot.png)

## ✨ Features

### Core Features

- **Interactive Graph Visualization** - Powered by Cytoscape.js, supporting 100k+ nodes
- **Entity System** - Multiple entity types (IP, Domain, Email, Person, Organization, etc.)
- **Transform Engine** - Automated data gathering with 15+ built-in transforms
- **Modern UI/UX** - Dark/light themes with glassmorphism design
- **Cross-Platform Desktop App** - Windows, macOS, and Linux support via Electron
- **Real-time Collaboration** - Work together on investigations (coming soon)

### OSINT Transforms

- **DNS** - A/AAAA, MX, NS, TXT, CNAME, SOA, PTR records
- **Web Analysis** - HTTP headers, SSL certificates, robots.txt
- **Geolocation** - IP to location mapping
- **Email** - Extract domains, validate addresses
- **Social Media** - Username search across platforms (coming soon)
- **Network** - Port scanning with Nmap integration (coming soon)

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker & Docker Compose (optional, for database)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd NodeWeaver

# Install dependencies
npm install

# Install desktop app dependencies
npm run setup:desktop

# Start development (API + Web)
npm run dev
```

### Running the Desktop App

```bash
# Start API and Web servers first
npm run dev

# In a new terminal, start the desktop app
npm run dev:desktop
```

### Building Desktop App

```bash
# Build for Windows
npm run build:desktop:win

# Build for macOS
npm run build:desktop:mac

# Build for Linux
npm run build:desktop:linux
```

## 📁 Project Structure

```
NodeWeaver/
├── apps/
│   ├── web/                    # Next.js frontend (UI)
│   ├── api/                    # Express backend (API + Transforms)
│   └── desktop/                # Electron desktop wrapper
├── packages/
│   └── shared-types/           # Shared TypeScript types
└── docker-compose.yml          # Database services
```

## 🛠️ Tech Stack

| Component               | Technology                       |
| ----------------------- | -------------------------------- |
| **Desktop**             | Electron 28                      |
| **Frontend**            | Next.js 14, React 18, TypeScript |
| **Graph Visualization** | Cytoscape.js                     |
| **Styling**             | TailwindCSS, Glassmorphism       |
| **State Management**    | Zustand                          |
| **Backend**             | Node.js, Express, Socket.io      |
| **Database**            | PostgreSQL, Redis                |

## 📜 Available Scripts

```bash
# Development
npm run dev           # Start API + Web servers
npm run dev:desktop   # Start desktop app (Electron)
npm run dev:all       # Start all services

# Building
npm run build                 # Build all packages
npm run build:desktop:win     # Build Windows installer
npm run build:desktop:mac     # Build macOS app
npm run build:desktop:linux   # Build Linux AppImage

# Database (requires Docker)
npm run docker:up     # Start PostgreSQL + Redis
npm run docker:down   # Stop services
```

## ⌨️ Keyboard Shortcuts (Desktop)

| Action          | Shortcut |
| --------------- | -------- |
| New Graph       | `Ctrl+N` |
| Open Graph      | `Ctrl+O` |
| Save            | `Ctrl+S` |
| Run Transforms  | `Ctrl+T` |
| Add Entity      | `Ctrl+E` |
| Create Link     | `Ctrl+L` |
| Zoom In         | `Ctrl++` |
| Zoom Out        | `Ctrl+-` |
| Fit to Window   | `Ctrl+0` |
| Settings        | `Ctrl+,` |
| Developer Tools | `F12`    |

## 🎨 Screenshots

### Main Interface

The main interface features three panels:

- **Entity Palette** (left) - Drag entities to the canvas
- **Graph Canvas** (center) - Interactive visualization
- **Transform & Details Panel** (right) - Run transforms and view entity details

### Features

- Glassmorphism UI design
- Dark/Light theme support
- Animated transitions
- Context menus
- Export to JSON, PNG, PDF

## 🔐 Security Considerations

NodeWeaver includes security testing capabilities. Use responsibly and only on systems you have permission to test.

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

## 📧 Contact

For questions and support, please open an issue.

---

**NodeWeaver** - Weaving connections between data nodes 🕸️
