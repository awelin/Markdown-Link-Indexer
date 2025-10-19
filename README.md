# Markdown Link Indexer

Automatically collects, indexes, and maintains all links found in Markdown (.md) and Jupyter Notebook (.ipynb) files while ensuring links remain valid even after file renames and moves.

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://marketplace.visualstudio.com/)
[![Visual Studio Marketplace](https://img.shields.io/badge/marketplace-install-blue)](https://marketplace.visualstudio.com/vscode)

## 🚀 Features

### 📊 Automatic Link Indexing
- Scans workspace for all Markdown and Jupyter Notebook files
- Extracts inline links `[text](target)` and reference links `[text][ref]`
- Supports both absolute URLs and relative paths
- Real-time monitoring as you edit files

### 🔄 Intelligent Link Maintenance
- **Automatically fixes broken links** when files are renamed or moved
- Calculates proper relative paths from each document
- Updates all references across your workspace instantly
- Prevents the frustration of broken documentation links

### 🌳 Interactive Tree View
- Clean sidebar view showing only files with links
- Expandable file nodes reveal all discovered links
- Filtered interface - hides files without links
- One-click access to source files

### 💾 Persistent Storage
- Saves index to `.vscode/link-index.json` for transparency
- Survives VS Code restarts
- Human-readable JSON format for inspection
- No external dependencies or cloud services

### 🛠 Comprehensive Logging
- Detailed debug console output for troubleshooting
- Shows file operations, link discoveries, and updates
- Helps debug link maintenance and indexing issues

## 📖 Usage

### Basic Operation
1. Install and open the extension
2. Work in a workspace containing `.md` or `.ipynb` files
3. The extension automatically scans and indexes links on startup
4. See indexed files in the "Markdown Links" sidebar panel
5. Links are maintained automatically when you rename or move files

### Tree View Navigation
- Open VS Code's Explorer sidebar
- Look for "Markdown Links" section
- Expand files to see all links within them
- Click on files to open them in editor

### Example Workflow
```
📁 docs/
 ├── intro.md
 │    ├── ./images/logo.png
 │    └── https://example.com
 └── tutorial.ipynb
      ├── ./data/dataset.csv
      └── ./scripts/process.py
```

## 🛠 How It Works

### Link Extraction
- **Markdown files**: Uses [markdown-it](https://github.com/markdown-it/markdown-it) parser
- **Jupyter Notebooks**: Parses JSON structure and processes markdown cells
- **Path normalization**: Converts relative paths to absolute for consistent indexing
- **URL support**: Handles both relative paths and full URLs

### Automatic Link Fixing
When a file is renamed via VS Code:
1. Extension detects rename event
2. Finds all documents referencing the old path
3. Calculates new relative paths from each reference location
4. Applies bulk text replacements instantly
5. Updates internal index and UI

### File Monitoring
- **File watchers**: Monitors `**/*.{md,ipynb}` patterns
- **Debounced processing**: 500ms delay prevents excessive parsing
- **Event handling**: Tracks create, change, and delete operations
- **Registry persistence**: JSON file updated on each change

## 🔧 Requirements

- **VS Code**: Version 1.105.0 or later
- **Node.js**: Required for markdown-it parser (bundled)
- **Workspace**: Must have at least one folder open

## 📋 Extension Settings

This extension has no additional user-configurable settings. It activates automatically in workspace mode.

## 🐛 Known Issues

- Large workspaces may take time to scan on first activation
- File system watchers may occasionally miss very rapid operations
- Path normalization may not handle complex workspace structures perfectly

## 📈 Release Notes

### 0.1.0 (Current)
- ✨ Initial release with automatic link indexing
- 🔄 Intelligent link maintenance on file renames/moves
- 🌳 Interactive Tree View with filtered display
- 💾 Persistent JSON storage in workspace
- 🛠 Comprehensive debugging with console logging
- 📊 Support for both Markdown and Jupyter Notebook files
- 🎯 Real-time file monitoring with debounced processing

## 🛠️ Development

### Building from Source
```bash
npm install
npm run compile
```

### Running Tests
```bash
npm test
```

### Debug Mode
1. Press F5 in VS Code to launch Extension Development Host
2. Create `.md` or `.ipynb` files with links
3. Check Debug Console for detailed logging
4. Access `.vscode/link-index.json` for current index

### Architecture
```
src/
├── extension.ts    # Main activation, watchers, UI
├── parser.ts       # Link extraction logic
├── registry.ts     # Data persistence and management
└── test/
    └── extension.test.ts  # Unit tests
```

## 📄 License

This extension is licensed under the [MIT License](LICENSE).

## 📞 Support

For issues and feature requests, please use GitHub Issues.

---

**Enjoy automatic link management in your documentation! 🚀**
