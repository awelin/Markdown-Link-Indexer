# Markdown Link Indexer

Automatically maintains Markdown and Jupyter Notebook links when you move or rename files.

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](https://marketplace.visualstudio.com/items?itemName=ZelinYang21/markdown-link-indexer)
[![Marketplace](https://img.shields.io/badge/marketplace-install-blue)](https://marketplace.visualstudio.com/items?itemName=ZelinYang21/markdown-link-indexer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features

* 🔁 **Auto-updates links** when files are moved or renamed — both incoming and outgoing references
* 🧭 **Interactive broken link repair** with smart candidate suggestions
* ⚡ **Real-time link indexing** for `.md` and `.ipynb` files
* 🧩 **Intelligent path handling**, with automatic angle brackets for spaces and special characters

> The index is stored at `.vscode/link-index.json`

---

## 🚀 Usage

### 🔄 Auto-Updating Links

Whenever you **move** or **rename** a file, the extension automatically adjusts all related links across your workspace.
No manual intervention — it runs quietly in the background.

#### How It Works

**Phase 1 — External References (Incoming Links)**
When you move `guide.md`:

1. The extension finds all files referencing `./old-docs/guide.md`
2. It recalculates correct relative paths from each referencing file
3. It updates links automatically, e.g.
   `→ [guide](./docs/guide.md)`

**Phase 2 — Internal References (Outgoing Links)**
When a file containing links is moved:

1. The file’s contents are scanned for relative links (e.g. `./images/logo.png`)
2. Each link is recalculated relative to the file’s **new** location
3. Paths are updated to maintain correctness
   e.g. `[./images/logo.png] → [../docs/images/logo.png]`

**Example**

```
Before: docs/tutorials/README.md  →  moved to archive/README.md
Links:  [./images/logo.png], [../API-doc]

After:  archive/README.md
Links:  [../docs/images/logo.png], [../API-doc]
```

**Triggered automatically when you:**

* Rename or move files/folders in the VS Code Explorer
* Drag and drop files/folders
* Perform refactors — all updates happen in milliseconds

---

### 🧩 Fixing Broken Links

For pre-existing broken links (e.g. from earlier file moves):

1. Open the Command Palette (`Ctrl+Shift+P`)
2. Run **“Markdown Link Indexer: Fix Broken Links”**
3. The extension scans all Markdown and Notebook files
4. For each broken link:

   * If only one candidate file matches the tail of the path, it auto-fixes it
   * Otherwise, it shows smart suggestions:

     * ✅ *Exact path matches* (same folder structure)
     * ✅ *Filename matches* (similar files elsewhere)
     * 🔄 *Format variants* (`.md` ↔ `.ipynb`)
5. You can confirm or skip each suggestion interactively

**Example**
Broken: `[guide](./old-folder/guide.md)`
Suggestions:

* ✅ `./docs/guide.md` — exact match
* ✅ `./other-folder/guide.md` — filename match
* ❌ Skip

---

### 🧰 Commands

| Command                                     | Description                                | Shortcut       |
| ------------------------------------------- | ------------------------------------------ | -------------- |
| **Markdown Link Indexer: Fix Broken Links** | Scan and repair broken links interactively | `Ctrl+Shift+P` |
| **Markdown Link Indexer: Export Links**     | Force rebuild of the link index            | `Ctrl+Shift+P` |

---

## 🔧 Requirements

* **VS Code** ≥ 1.105.0
* **Workspace**: at least one folder open

---

## 🛠️ Development

### Build from Source

```bash
npm install
npm run compile
```

### Run Tests

```bash
npm test
```

### Debug Mode

1. Press **F5** in VS Code to launch the Extension Development Host
2. Create `.md` or `.ipynb` files with links
3. Inspect logs in the **Debug Console**
4. View the link database at `.vscode/link-index.json`

---

### 🧱 Architecture

```
src/
├── extension.ts     # Activation, watchers, and commands
├── parser.ts        # Link extraction and parsing logic
├── registry.ts      # Index persistence and management
└── test/
    └── extension.test.ts  # Unit tests
```

---

## 📖 Changelog

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

---

## 📄 License

Licensed under the [MIT License](LICENSE).

---

## 💬 Support

For issues or feature requests, please use the [GitHub Issues](https://github.com/ZelinYang21/markdown-link-indexer/issues) page.