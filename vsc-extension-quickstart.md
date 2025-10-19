# Markdown Link Indexer - Development Guide

This document provides development and debugging information for the Markdown Link Indexer VS Code extension.

## Project Structure

```
markdown-link-indexer/
├── src/
│   ├── extension.ts     # Main extension logic, watchers, Tree View
│   ├── parser.ts        # Link extraction from markdown and notebooks
│   └── registry.ts      # In-memory index with JSON persistence
├── test/
│   └── extension.test.ts # Unit tests for link parsing
├── package.json         # Extension manifest and scripts
├── tsconfig.json       # TypeScript configuration
└── README.md           # User documentation
```

## Development Workflow

### Setting Up Development Environment
```bash
npm install          # Install dependencies
npm run compile      # Compile TypeScript
npm test            # Run test suite
```

### Debugging the Extension
1. **Launch Debug Mode**: Press `F5` to open Extension Development Host
2. **Create Test Files**: Add `.md` or `.ipynb` files with links to test parsing
3. **Monitor Console**: Check Debug Console for extension logs:
   - "Markdown Link Indexer: Activating extension"
   - File operations: "File created/changed/deleted"
   - Rename operations with path updates
4. **Inspect Index**: Access `.vscode/link-index.json` in workspace
5. **Test Tree View**: Check "Markdown Links" in Explorer sidebar

### Key Components

#### LinkParser (`src/parser.ts`)
- Uses [markdown-it](https://github.com/markdown-it/markdown-it) for parsing
- Handles inline links: `[text](url)` and images: `![alt](path)`
- Processes Jupyter notebooks by extracting markdown cell content
- Normalizes relative paths to absolute paths for indexing
- Returns unified string array of all links found

#### Registry (`src/registry.ts`)
- In-memory storage using Record<string, string[]>
- Persists data to `.vscode/link-index.json` on each change
- Loads existing index on extension activation
- Provides update/remove operations for registry management

#### Extension (`src/extension.ts`)
- **Activation**: Scans workspace files, loads registry, sets up UI
- **File Watchers**: Monitors `**/*.{md,ipynb}` with debounced processing
- **Rename Handler**: Detects file renames and updates all references
- **Tree View**: Displays filtered list of files with links
- **Logging**: Comprehensive console output for troubleshooting

### Testing Strategy

#### Unit Tests (`src/test/extension.test.ts`)
```bash
npm test  # Run all tests
```
- Tests markdown link extraction with various formats
- Tests notebook JSON parsing and link discovery
- Validates path normalization logic
- Verifies extraction handles edge cases

#### Manual Testing
1. **Basic Indexing**: Create files with links, verify index updates
2. **Tree View**: Confirm only files with links appear in sidebar
3. **Rename Testing**: Rename linked files, verify all references update
4. **Persistence**: Reload VS Code, confirm index is maintained
5. **Filter Validation**: Ensure empty files don't appear in tree

### Extension Architecture

#### Event Flow (File Changes)
```
File Change → Watcher → Parser → Registry Update → TreeView Refresh
 ↓                ↓         ↓              ↓
Debounced    Parse Links  Save Index     Update UI
```

#### Event Flow (Renames)
```
Rename Detected → Find References → Update All Files → Refresh Registry/Index
 ↓                    ↓                ↓             ↓
New/Old Paths   Search Workspace   Apply Changes   Update UI
```

### Debugging Tips

#### Common Issues
- **Tree View Not Refreshing**: Check that `treeDataProvider.refresh()` is called
- **Watcher Not Triggering**: Verify file patterns and path normalization
- **Rename Not Working**: Ensure onDidRenameFiles is subscribed, with file paths correct
- **Index Not Persisting**: Check `.vscode/link-index.json` permissions

#### Debug Commands
- "Developer: Reload Window" to restart extension
- "Developer: Show Logs" for VS Code internal debugging
- Check Debug Console for custom extension logs

### Building for Distribution

```bash
npm install -g vsce    # Install packaging tool
vsce package          # Create .vsix file
code --install-extension markdown-link-indexer-0.1.0.vsix  # Install locally
```

### Configuration

Extension settings are minimal - it activates automatically on workspace load. Key parameters:
- Activation: `"*"` (workspace mode)
- Dependencies: `markdown-it ^13.0.0`
- Supported files: `.md`, `.ipynb`
- Debouce delay: 500ms for file changes

### Performance Considerations

- **File Scanning**: Uses `findFiles()` with glob patterns for efficiency
- **Debouncing**: Prevents excessive parsing during editing sessions
- **Selective Updates**: Only re-parses changed files, updates affected references
- **Memory Usage**: Minimal - stores only file paths and link arrays

### Useful Links

- [VS Code Extension API](https://code.visualstudio.com/api/)
- [markdown-it Documentation](https://github.com/markdown-it/markdown-it)
- [VS Code Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
