# NodeWeaver - Quick Start Guide

## 🚀 Installation

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Docker (optional, for database)

### Setup

```bash
# Clone repository
git clone <repository-url>
cd NodeWeaver

# Install all dependencies
npm install

# Install desktop app dependencies
cd apps/desktop
npm install
cd ../..
```

## 🎮 Running the Application

### Option 1: Web Version

```bash
# Start API and Web servers
npm run dev
```

Open http://localhost:3000 in your browser.

### Option 2: Desktop Application

```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start desktop app
cd apps/desktop
npm run dev
```

## 📖 Basic Usage

### Creating Your First Graph

1. **Add Entity**: Drag an entity type from the left panel to the canvas
2. **Run Transform**: Select an entity → Choose transform from right panel → Click Play
3. **View Results**: New entities appear automatically connected to source
4. **Save Graph**: Click Save button in toolbar or press `Ctrl+S`

### Keyboard Shortcuts

| Action        | Shortcut |
| ------------- | -------- |
| New Graph     | `Ctrl+N` |
| Save          | `Ctrl+S` |
| Run Transform | `Ctrl+T` |
| Add Entity    | `Ctrl+E` |
| Zoom In       | `Ctrl++` |
| Zoom Out      | `Ctrl+-` |
| Fit to Window | `Ctrl+0` |

### Available Transforms

**DNS (8 transforms)**

- Domain to IP, IP to Domain
- MX, NS, TXT, CNAME, SOA records

**WHOIS (1 transform)**

- Domain registration info

**Social Media (2 transforms)**

- Username search across 13+ platforms
- Email to social profiles

**Web Analysis (3 transforms)**

- HTTP headers, SSL certificate, robots.txt

**OSINT (2 transforms)**

- Subdomain enumeration
- HaveIBeenPwned check

**Network (1 transform)**

- IP Geolocation

## 🔧 Configuration

### Discord Webhook (Optional)

To export graphs to Discord:

1. Create a Discord webhook in your channel
2. In NodeWeaver settings, add webhook URL
3. Use Export → Send to Discord

### API Configuration

Edit `apps/api/.env`:

```env
PORT=4000
FRONTEND_URL=http://localhost:3000
```

## 🏗️ Building Desktop App

```bash
cd apps/desktop

# Build for Windows
npm run package:win

# Build for macOS
npm run package:mac

# Build for Linux
npm run package:linux
```

Installer will be in `apps/desktop/release/`

## 🐛 Troubleshooting

**Issue**: Desktop app won't start

- **Solution**: Make sure API and Web servers are running first

**Issue**: Transforms not working

- **Solution**: Check API server is running on port 4000

**Issue**: Build fails

- **Solution**: Run `npm install` in both root and `apps/desktop`

## 📚 Example Investigation

### Investigating a Domain

1. Add Domain entity: `example.com`
2. Run "Domain to IP" transform
3. Run "WHOIS Lookup" on domain
4. Run "MX Records" to find mail servers
5. Run "Subdomain Enumeration"
6. For each IP: Run "IP Geolocation"
7. Export results to Discord or JSON

### Social Media Investigation

1. Add Username entity: `johndoe`
2. Run "Username Search" transform
3. Review discovered profiles across 13+ platforms
4. Add Email entity if found
5. Run "Email to Social" transform
6. Cross-reference findings

## 🎯 Tips

- Use `Ctrl+0` to fit graph to window after adding many entities
- Right-click entities for quick actions (coming soon)
- Use search in Transform panel to quickly find transforms
- Export graphs regularly to save your work
- Use Discord integration for team collaboration

---

**NodeWeaver** - Happy investigating! 🕸️
