# Changelog

All notable changes to the **Markdown Link Indexer** extension will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/), and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.2.0] - 2025-10-20

### Added
- **Internal Link Updates**: When moving files that contain links, the links inside those files are automatically recalculated from their new location
- **Interactive Broken Link Repair**: Command to fix existing broken links with smart candidate detection
- **Smart Path Handling**: Automatically adds `<>` angle brackets around paths containing spaces for proper Markdown rendering
- **Two-Way Link Maintenance**: Now handles both incoming references (external links to moved files) and outgoing links (internal links within moved files)
- **Enhanced Notebook Support**: Improved Jupyter notebook processing with preserved line structure and newlines

### Changed
- Improved angle bracket normalization for link paths
- Better notebook cell processing without losing formatting
- Enhanced test coverage (45 total tests)

### Fixed
- Issue with newlines being deleted in notebook cells during link updates
- Problems with angle bracket handling causing malformed markdown

## [0.1.0] - 2025-10-19

### Added
- Initial release with automatic link indexing for `.md` and `.ipynb` files
- Basic intelligent link maintenance on file renames and moves
- Interactive Tree View with filtered display in VS Code Explorer
- Persistent JSON storage in workspace (`.vscode/link-index.json`)
- Comprehensive debugging with console logging
- Real-time file monitoring with debounced processing
- Support for inline links `[text](target)` and reference links `[text][ref]`
- URL-encoded filename handling (`%20` spaces, etc.)
- Unicode filename support
- Path normalization and relative path resolution
