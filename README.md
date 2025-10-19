# Markdown Link Indexer

> Automatically collects, indexes, and maintains all links found in Markdown (.md) and Jupyter Notebook (.ipynb) files - keeping your documentation links valid even after file renames and moves.

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=ZelinYang21.markdown-link-indexer)
[![Visual Studio Marketplace](https://img.shields.io/badge/marketplace-install-blue)](https://marketplace.visualstudio.com/items?itemName=ZelinYang21.markdown-link-indexer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code](https://img.shields.io/badge/vscode-1.105.0%2B-blue)](https://code.visualstudio.com/)

## 🚀 Features

### 📊 Automatic Link Indexing
- Scans workspace for all Markdown (`.md`) and Jupyter Notebook (`.ipynb`) files
- Extracts **inline links** `[text](target)` and **reference links** `[text][ref]`
- Supports **absolute** (`/absolute/path.md`) and **relative** (`../file.md`, `./folder/`) paths
- Handles **URL-encoded** filenames (`Static%20Shock.md` → `Static Shock.md`)
- Supports **Unicode filenames** (`一个文件.md`, `молоток.md`)
- Real-time monitoring as you edit files

### 🔄 Intelligent Link Maintenance
- **Automatically fixes broken links** when files are renamed or moved
- Calculates correct relative paths from each document's location
- Updates all references across your workspace instantly
- Prevents broken documentation links during refactoring
- Smart path resolution with `./` and `../` normalization

### 🔧 Interactive Broken Link Repair
- **Detects existing broken links** from past file moves or reorganizations
- **Smart candidate finding** using multiple strategies:
  - **Exact folder matches** (preserves directory structure)
  - **Loose filename matches** (finds same filenames anywhere)
  - **Cross-format search** (`.md` ↔ `.ipynb` conversions)
- **Interactive verification** - preview replacement files before choosing
- **Batch processing** with progress tracking and detailed skip reports
- **User-controlled decisions** for ambiguous matches

### 🔍 Supported Link Types

| Link Type | Example | Processing |
|-----------|---------|------------|
| ✅ **Inline links** | `[text](./file.md)` | Extracted & indexed |
| ✅ **Image links** | `![alt](image.png)` | Extracted & indexed |
| ✅ **Reference links** | `[text][ref]` | Extracted (if defined) |
| ✅ **Absolute paths** | `[/usr/local/file.md]` | Extracted & indexed |
| ✅ **Relative paths** | `[../folder/file.md]` | Resolved & indexed |
| ✅ **Complex paths** | `[../../../docs/../src/./utils/file.md]` | Normalized |
| ❌ **HTTP URLs** | `[github](https://github.com)` | Skipped (filtered) |
| ❌ **mailto links** | `[email](mailto:user@domain.com)` | Skipped (unsupported) |
| ❌ **Anchor links** | `[section](#heading)` | Skipped (unsupported) |
| ❌ **Javascript** | `[code](javascript:alert)` | Skipped (unsupported) |

### 🌳 Interactive Tree View
- Clean sidebar panel: **Markdown Links** (in VS Code Explorer)
- Intelligent filtering: only shows files containing links
- Expandable nodes: drill down from files → individual links
- One-click navigation: open source files directly
- Real-time updates: reflects live workspace changes

### 💾 Persistent Storage & Transparency
- Saves index to `.vscode/link-index.json` in workspace root
- Survives VS Code restarts without rescanning
- Human-readable JSON format for inspection and debugging
- No external services or dependencies required
- Respects your workspace privacy

### 🛠 Comprehensive Debugging & Logging
- Detailed output in VS Code **Debug Console**
- Link discovery progress and results
- Broken link analysis with replacement candidates
- File operation tracking and error handling
- Search strategy explanations for troubleshooting

## 📖 Usage

### Basic Operation
1. Install and open the extension
2. Work in a workspace containing `.md` or `.ipynb` files
3. The extension automatically scans and indexes links on startup
4. See indexed files in the "Markdown Links" sidebar panel
5. Links are maintained automatically when you rename or move files

### Command Reference

#### Available Commands
- **`Markdown Link Indexer: Fix Broken Links`** (`Ctrl+Shift+P`)
  - Scans all files for broken links and guides you through repairs
- **`Markdown Link Indexer: Export Links`** (`Ctrl+Shift+P`)
  - Forces immediate export of current index to JSON file

#### Quick Access
1. **Command Palette**: Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
2. **Type**: "Markdown Link" to see all extension commands
3. **Tree View**: Navigate via VS Code Explorer sidebar

### Step-by-Step Broken Link Repair
1. **Trigger Repair**: `Ctrl+Shift+P` → "Markdown Link Indexer: Fix Broken Links"
2. **Wait for Scan**: Extension finds all broken file links in workspace
3. **Review Problems**: For each broken link, see what's broken and source file
4. **Examine Candidates**: Extension shows matching files using smart algorithms
5. **Choose Replacement**: Preview candidates and select the correct match
6. **Apply or Skip**: Confirm changes or skip if unsure
7. **Check Results**: Detailed summary shows what was fixed vs skipped

### Tree View Navigation
- **Open Sidebar**: `Ctrl+Shift+E` to open VS Code Explorer
- **Find Section**: Look for "📗 Markdown Links" in bottom of sidebar
- **Expand Files**: Click ▶️ next to file names to see contained links
- **Navigate**: Click any file or link to open in editor
- **Auto-Filter**: Only shows files that actually contain links

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

## ❓ What It Doesn't Do

To manage expectations, here's what the extension **intentionally does not handle**:

### 🚫 Not Supported
- **HTTP/HTTPS URLs**: `[github](https://github.com/repo)` - external links are filtered
- **Email/mailto links**: `[contact](mailto:user@domain.com)` - not tracked
- **Anchor/internal links**: `[section](#heading)` - not parsed or indexed
- **Cross-file references**: Links to other sections or documents via IDs
- **Non-file links**: Protocol handlers, data URIs, etc.

### 🔍 Why Not?
- **Focus on file management**: Extension specializes in file link maintenance
- **Scope limitation**: Complex web scraping or external validation would require different architecture
- **Performance**: Restricting to file links enables fast, local-only operation

### 💡 Use Cases
- ✅ **Documentation maintenance**: Fixing broken links in READMEs, guides, API docs
- ✅ **Notebook organization**: Keeping data science documentation links valid
- ✅ **Code refactoring**: Safe file renames without breaking documentation
- ✅ **Project cleanup**: Detecting and fixing stale links during reorganization

## 🐛 Troubleshooting

### Common Issues & Solutions

#### "Extension not activating"
- **Check**: Ensure you're working in a workspace folder (not single file mode)
- **Solution**: Open a folder in VS Code and reload the extension

#### "Tree view not showing"
- **Check**: Restart VS Code or run "Markdown Link Indexer: Export Links"
- **Check**: Ensure your workspace contains `.md` or `.ipynb` files

#### "Links not updating after rename"
- **Check**: Wait a moment for the file watcher to detect changes
- **Solution**: Manual trigger via "Markdown Link Indexer: Export Links"
- **Check**: Ensure renamed files still have valid paths

#### "Debug console shows errors"
- **Check**: VS Code Debug Console for detailed error information
- **Solution**: Report issues with full console output on GitHub

#### "Broken link repair not finding candidates"
- **Check**: Files may be deleted (shows as "no candidates found")
- **Check**: System file permissions may block access
- **Check**: Files outside workspace scope can't be fixed

#### "Extension slow on large workspaces"
- **Fix**: This is normal - initial scan analyzes all files
- **Tip**: Restructure workspace or use git ignore patterns if needed

### Debug Mode Operation
```bash
# Enable detailed logging in VS Code:
1. Ctrl+Shift+P → "Developer: Toggle Developer Tools"
2. Check "Console" tab for extension output
3. Look for "Markdown Link Indexer" prefixed messages
```

### Inspecting the Link Database
```bash
# View current index:
cat .vscode/link-index.json | jq .

# Example output:
{
  "/home/user/docs/readme.md": [
    "./images/logo.png",
    "../config/settings.md"
  ]
}
```

## 📋 Extension Settings

This extension has no additional user-configurable settings. It activates automatically in workspace mode.

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
