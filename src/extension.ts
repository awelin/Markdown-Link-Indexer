import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { extractMarkdownLinks, extractLinksFromNotebook, findBrokenLinks, findReplacementCandidates, findSmartReplacementCandidates, calculateRelativePath, BrokenLinkInfo } from './parser';
import { Registry } from './registry';

interface CandidateQuickPickItem extends vscode.QuickPickItem {
  candidate: string | null;
}

let registry: Registry | undefined;
let treeView: vscode.TreeView<LinkItem>;
let treeDataProvider: LinkTreeProvider;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Markdown Link Indexer requires an open workspace.');
    return;
  }

  outputChannel = vscode.window.createOutputChannel('Markdown Link Indexer');
  context.subscriptions.push(outputChannel);
  outputChannel.appendLine('Markdown Link Indexer: Activating extension');

  // Show supported link formats
  outputChannel.appendLine('\n📋 Supported Link Formats:');
  outputChannel.appendLine('├── ✅ [text](./file.md) - relative links');
  outputChannel.appendLine('├── ✅ [text](/absolute/path.md) - absolute links');
  outputChannel.appendLine('├── ✅ ![alt](image.png) - image references');
  outputChannel.appendLine('├── ✅ [text](notebook.ipynb) - Jupyter notebooks');
  outputChannel.appendLine('├── ✅ [text](水钠.md) - Unicode filenames');
  outputChannel.appendLine('├── ✅ URL-encoded: [text](Static%20Shock.md)');
  outputChannel.appendLine('├── ✅ Cross-format: Markdown ↔ Jupyter');
  outputChannel.appendLine('├── ❌ [github](https://github.com) - URLs (filtered out)');
  outputChannel.appendLine('├── ❌ [mailto](mailto:user@domain.com) - mailto links');
  outputChannel.appendLine('├── ❌ [anchor](#section) - anchor links');
  outputChannel.appendLine('└── ⚠️  [ref][id] - reference links (partial support)');
  outputChannel.appendLine('');

  registry = new Registry(workspaceFolder.uri);

  // Initial scan
  scanWorkspace(workspaceFolder.uri).then(fileCount => {
    console.log(`Initial scan completed: ${fileCount} files`);
    vscode.window.showInformationMessage(`Link index built for ${fileCount} files.`);
    treeDataProvider.refresh();
  });

  // Set up watcher
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.{md,ipynb}');
  const debounceTimeouts = new Map<string, NodeJS.Timeout>();

  watcher.onDidCreate(uri => {
    console.log(`File created: ${uri.fsPath}`);
    handleFileUpdate(uri).then(() => treeDataProvider.refresh());
  });
  watcher.onDidChange(uri => {
    // Debounce changes (500ms)
    const key = uri.fsPath;
    if (debounceTimeouts.has(key)) {
      clearTimeout(debounceTimeouts.get(key)!);
    }
    const timeout = setTimeout(() => {
      console.log(`File changed: ${uri.fsPath}`);
      handleFileUpdate(uri).then(() => treeDataProvider.refresh());
      debounceTimeouts.delete(key);
    }, 500);
    debounceTimeouts.set(key, timeout);
  });
  watcher.onDidDelete(uri => {
    console.log(`File deleted: ${uri.fsPath}`);
    registry!.remove(uri);
    treeDataProvider.refresh();
  });
  context.subscriptions.push(watcher);

  // Handle renames to update references
  const renameSubscription = vscode.workspace.onDidRenameFiles(async (e) => {
    console.log(`Rename event: ${e.files.length} files`);
    for (const file of e.files) {
      console.log(`Renamed: ${file.oldUri.fsPath} -> ${file.newUri.fsPath}`);
      await updateReferences(file.oldUri.fsPath, file.newUri.fsPath);
      registry!.remove(file.oldUri);
      const links = await parseFile(file.newUri);
      registry!.update(file.newUri, links);
    }
    treeDataProvider.refresh();
  });
  context.subscriptions.push(renameSubscription);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownLinkIndexer.exportLinks', () => {
      console.log('Export command triggered');
      vscode.window.showInformationMessage('Link index updated.');
    })
  );

  // Register broken link repair command
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownLinkIndexer.fixBrokenLinks', async () => {
      await fixBrokenLinks();
    })
  );

  // Register Tree View
  treeDataProvider = new LinkTreeProvider(registry);
  treeView = vscode.window.createTreeView('linkExplorer', { treeDataProvider });
  context.subscriptions.push(treeView);
}

async function handleFileUpdate(uri: vscode.Uri) {
  if (!registry) {return;}
  const links = await parseFile(uri);
  registry.update(uri, links);
}

async function parseFile(uri: vscode.Uri): Promise<string[]> {
  if (!registry) {return [];}
  try {
    const content = await vscode.workspace.fs.readFile(uri);
    const text = content.toString();
    const baseDir = path.dirname(uri.fsPath);
    if (uri.fsPath.endsWith('.md')) {
      return extractMarkdownLinks(text, baseDir);
    } else if (uri.fsPath.endsWith('.ipynb')) {
      return extractLinksFromNotebook(text, baseDir);
    }
  } catch (error) {
    console.error(`Error parsing file ${uri.fsPath}:`, error);
  }
  return [];
}

async function scanWorkspace(workspaceUri: vscode.Uri): Promise<number> {
  if (!registry) {return 0;}
  const files = await vscode.workspace.findFiles('**/*.{md,ipynb}');
  let count = 0;
  for (const uri of files) {
    const links = await parseFile(uri);
    registry.update(uri, links);
    count++;
  }
  return count;
}

export function deactivate() {}

function escapeRegExp(string: string): string {
  // Proper Unicode-safe regex escaping
  return string.replace(/[.*+?^${}()\[\]|\\]/ug, '\\$&');
}

async function updateReferences(oldPath: string, newPath: string) {
  console.log(`Updating references from ${oldPath} to ${newPath}`);
  const files = await vscode.workspace.findFiles('**/*.{md,ipynb}');
  for (const fileUri of files) {
    // Calc relative path from file to old and new
    const baseDir = path.dirname(fileUri.fsPath);
    const relOld = path.relative(baseDir, oldPath);
    const relNew = path.relative(baseDir, newPath);
    // Normalize to forward slashes for markdown
    const normOld = relOld.replace(/\\/g, '/');
    const normNew = relNew.replace(/\\/g, '/');

    if (normOld === normNew) {continue;} // no change

    try {
      const content = await vscode.workspace.fs.readFile(fileUri);
      const text = content.toString();
      // Replace old relative with new relative
      const newText = text.replace(new RegExp(escapeRegExp(normOld), 'g'), normNew);
      if (newText !== text) {
        await vscode.workspace.fs.writeFile(fileUri, Buffer.from(newText));
        console.log(`Updated ${fileUri.fsPath}: ${normOld} -> ${normNew}`);
      }
    } catch (e) {
      console.error(`Error updating ${fileUri.fsPath}:`, e);
    }
  }
}

async function fixBrokenLinks(): Promise<void> {
  if (!registry) {
    vscode.window.showErrorMessage('Registry not available. Please restart the extension.');
    return;
  }

  console.log('Starting broken link repair process...');

  // Show progress notification
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'Scanning for broken links...',
    cancellable: false
  }, async (progress) => {
    progress.report({ increment: 0, message: 'Finding broken links...' });

    // Get all broken links
    const index = registry!.getAll();
    const brokenLinks: BrokenLinkInfo[] = findBrokenLinks(index);

    if (brokenLinks.length === 0) {
      vscode.window.showInformationMessage('No broken links found! 🎉');
      return;
    }

    progress.report({ increment: 50, message: `Found ${brokenLinks.length} broken links, sending for review...` });

    console.log(`Found ${brokenLinks.length} broken links`);

    // Group broken links by the missing path for batch processing
    const brokenLinksByPath = new Map<string, BrokenLinkInfo[]>();
    for (const brokenLink of brokenLinks) {
      const key = brokenLink.brokenLink;
      if (!brokenLinksByPath.has(key)) {
        brokenLinksByPath.set(key, []);
      }
      brokenLinksByPath.get(key)!.push(brokenLink);
    }

    let totalFixed = 0;
    let totalSkipped = 0;

    // Ultra-detailed skip tracking
    const skipDetails = [] as Array<{
      type: 'noCandidates' | 'userSkipped' | 'externalReferences' | 'technicalIssues';
      brokenLink: string;
      filesAffected: number;
      searchResults: {
        exactFolderSearch: { pattern: string; matches: string[] };
        looseFilenameSearch: { pattern: string; matches: string[] };
        crossFormatSearch: { performed: boolean; extensions?: string[]; matches: string[] };
      };
      diagnosis: string;
      suggestions: string[];
      examples: string[]; // source file paths where link appears
    }>;

    // Process each unique broken path in sequence
    const processed = new Set<string>();
    for (const [brokenPath, associatedLinks] of brokenLinksByPath.entries()) {
      if (processed.has(brokenPath)) {continue;}
      processed.add(brokenPath);

      console.log(`Processing broken link: ${brokenPath}`);

      // Find replacement candidates with smarter matching
      const { exactFolderMatches, looseMatches } = await findSmartReplacementCandidates(brokenPath);

      // Auto-fix if we have exactly one exact folder match (last two components)
      if (exactFolderMatches.length === 1) {
        const selectedReplacement = exactFolderMatches[0];
        console.log(`✓ Auto-fixing exact folder match: ${brokenPath} → ${selectedReplacement}`);

        // Apply the fix to all files containing this broken link
        let fixedCount = 0;
        for (const brokenLinkInfo of associatedLinks) {
          try {
            await applyLinkRepair(brokenLinkInfo, selectedReplacement);
            fixedCount++;
          } catch (error) {
            console.error(`Failed to fix link in ${brokenLinkInfo.filePath}:`, error);
          }
        }
        totalFixed += fixedCount;
        console.log(`Fixed ${fixedCount} instances of ${brokenPath}`);

      // Also auto-fix if we have exactly one loose match (filename only)
      } else if (exactFolderMatches.length === 0 && looseMatches.length === 1) {
        const selectedReplacement = looseMatches[0];
        console.log(`✓ Auto-fixing loose filename match: ${brokenPath} → ${selectedReplacement}`);

        // Apply the fix to all files containing this broken link
        let fixedCount = 0;
        for (const brokenLinkInfo of associatedLinks) {
          try {
            await applyLinkRepair(brokenLinkInfo, selectedReplacement);
            fixedCount++;
          } catch (error) {
            console.error(`Failed to fix link in ${brokenLinkInfo.filePath}:`, error);
          }
        }
        totalFixed += fixedCount;
        console.log(`Fixed ${fixedCount} instances of ${brokenPath}`);

      } else if (exactFolderMatches.length > 1 || (exactFolderMatches.length === 0 && looseMatches.length > 1)) {
        // Show interactive selection UI when we have multiple options or only loose matches
        const allCandidates = [...exactFolderMatches, ...looseMatches];
        const sourceFile = associatedLinks[0].filePath;
        const selectedReplacement = await showReplacementSelection(brokenPath, allCandidates, sourceFile);
        if (!selectedReplacement) {
          console.log(`👤 User skipped repair for ${brokenPath}`);
          skipDetails.push({
            type: 'userSkipped',
            brokenLink: brokenPath,
            filesAffected: associatedLinks.length,
            searchResults: {
              exactFolderSearch: { pattern: '', matches: [] },
              looseFilenameSearch: { pattern: '', matches: [] },
              crossFormatSearch: { performed: false, matches: [] }
            },
            diagnosis: 'User chose to skip this link during interactive selection',
            suggestions: ['Rerun repair to review again', 'Consider manual repair'],
            examples: associatedLinks.map(link => link.filePath)
          });
          totalSkipped += associatedLinks.length;
          continue;
        }

        // Apply the fix to all files containing this broken link
        let fixedCount = 0;
        for (const brokenLinkInfo of associatedLinks) {
          try {
            await applyLinkRepair(brokenLinkInfo, selectedReplacement);
            fixedCount++;
          } catch (error) {
            console.error(`Failed to fix link in ${brokenLinkInfo.filePath}:`, error);
          }
        }

        totalFixed += fixedCount;
        console.log(`Fixed ${fixedCount} instances of ${brokenPath}`);

      } else {
        // No candidates found at all - track the reason with detailed info
        console.log(`❌ No replacements found for ${brokenPath} (broken file doesn't exist or no matching filename)`);

        // Try to get search results for detailed reporting
        const { exactFolderMatches: _exact, looseMatches: _loose } = await findSmartReplacementCandidates(brokenPath);

        skipDetails.push({
          type: 'noCandidates',
          brokenLink: brokenPath,
          filesAffected: associatedLinks.length,
          searchResults: {
            exactFolderSearch: { pattern: '', matches: _exact },
            looseFilenameSearch: { pattern: '', matches: _loose },
            crossFormatSearch: { performed: true, matches: [..._exact, ..._loose] }
          },
          diagnosis: 'No replacement candidates found. File may be deleted or renamed beyond recognition.',
          suggestions: ['Check if file exists with a different name', 'Verify file hasn\'t been moved', 'Consider manual repair'],
          examples: associatedLinks.map(link => link.filePath)
        });

        totalSkipped += associatedLinks.length;
      }
    }

    progress.report({ increment: 100, message: 'Repair complete!' });

    // Show final results
    const summary = `Fixed ${totalFixed} broken links${totalSkipped > 0 ? `, skipped ${totalSkipped}` : ''}`;
    vscode.window.showInformationMessage(summary);

    // Show detailed breakdown of why links were skipped
    if (totalSkipped > 0) {
      logDetailedSkipAnalysis(skipDetails, outputChannel);
    }

    // Refresh the UI
    treeDataProvider.refresh();

    console.log(`Broken link repair complete: ${totalFixed} fixed, ${totalSkipped} skipped`);
  });
}

async function showReplacementSelection(brokenPath: string, candidates: string[], sourceFile: string): Promise<string | null> {
  // Show the complete broken link information to user
  const brokenRelativePath = path.relative(path.dirname(sourceFile), brokenPath).replace(/\\/g, '/') || brokenPath;
  outputChannel.appendLine(`🔗 Processing broken link in ${path.basename(sourceFile)}: ${brokenRelativePath}`);
  // Open the source file containing the broken link (LEFT side - ViewColumn.One)
  try {
    // For .ipynb files, try to open with default behavior (rendered notebook)
    // For other files, use text document
    let sourceDoc: vscode.TextDocument;
    if (sourceFile.endsWith('.ipynb')) {
      // Let VS Code choose the right editor for .ipynb files (notebook editor)
      sourceDoc = await vscode.workspace.openTextDocument(vscode.Uri.file(sourceFile));
      await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(sourceFile), 'jupyter-notebook');
      // Wait a bit for the notebook editor to open
      await new Promise(resolve => setTimeout(resolve, 500));
    } else {
      sourceDoc = await vscode.workspace.openTextDocument(sourceFile);
      await vscode.window.showTextDocument(sourceDoc, {
        preview: true,
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: true
      });
    }
    console.log(`📄 Opened source file with broken link: ${path.basename(sourceFile)}`);
  } catch (error) {
    console.warn('Could not open source file for preview:', error);
    // Fallback to text document opening
    try {
      const sourceDoc = await vscode.workspace.openTextDocument(sourceFile);
      await vscode.window.showTextDocument(sourceDoc, {
        preview: true,
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: true
      });
    } catch (fallbackError) {
      console.warn('Fallback opening also failed:', fallbackError);
    }
  }

  const openedDocuments: vscode.TextDocument[] = [];
  let currentlyPreviewedCandidate: string | null = null;

  try {
    const items = candidates.map((candidate, index) => ({
      label: `$(file) ${path.relative(vscode.workspace.rootPath || '', candidate)}`,
      description: `Replace broken link`,
      candidate: candidate,
      kind: vscode.QuickPickItemKind.Default
    }));

    // Add skip option
    items.push({
      label: '$(circle-slash) Skip this broken link',
      description: `Leave ${path.basename(brokenPath)} as broken`,
      candidate: null as any,
      kind: vscode.QuickPickItemKind.Separator
    });

    const quickPick = vscode.window.createQuickPick<CandidateQuickPickItem>();
    quickPick.items = items;
    // Show the complete broken link path, not just filename
    const fullBrokenLink = path.relative(vscode.workspace.rootPath || '', brokenPath).replace(/\\/g, '/') || brokenPath;
    quickPick.title = `Choose replacement for broken link: ${fullBrokenLink}`;
    quickPick.placeholder = 'Select a replacement file or skip this link';
    quickPick.ignoreFocusOut = true; // Keep QuickPick visible when clicking elsewhere

    // Handle selection changes to preview files
    quickPick.onDidChangeActive(async (activeItems) => {
      const selected = activeItems[0] as CandidateQuickPickItem;
      if (selected && selected.candidate !== currentlyPreviewedCandidate) {
        // Close previously previewed candidate if any (only right pane)
        if (currentlyPreviewedCandidate) {
          await closePreviewDocument(currentlyPreviewedCandidate);
        }

        // Open new candidate in split view (without taking focus)
        if (selected.candidate) {
          try {
            const candidateDoc = await vscode.workspace.openTextDocument(selected.candidate);
            openedDocuments.push(candidateDoc);
            await vscode.window.showTextDocument(candidateDoc, {
              preview: true,  // Use preview mode so it doesn't steal focus
              viewColumn: vscode.ViewColumn.Beside,
              preserveFocus: true  // Keep QuickPick focused
            });
            currentlyPreviewedCandidate = selected.candidate;
          } catch (error) {
            console.warn('Could not open candidate file for preview:', error);
          }
        }
      }
    });

    const selected = await new Promise<string | null>((resolve) => {
      // Only resolve when user explicitly accepts (Enter key)
      quickPick.onDidAccept(() => {
        const selection = quickPick.selectedItems[0] as CandidateQuickPickItem;
        const result = selection?.candidate || null;
        quickPick.dispose();

        // Close only the replacement preview (right side), keep source file open
        // Close all preview documents (right side only)
        for (const doc of openedDocuments) {
          closePreviewDocument(doc.uri.fsPath);
        }

        resolve(result);
      });

      // Don't auto-resolve on hide - wait for explicit action
      quickPick.onDidHide(() => {
        // Only close without resolving if no selection was made
        quickPick.dispose();
      });

      quickPick.show();

      // Set a timeout to avoid hanging indefinitely (5 minutes max)
      setTimeout(() => {
        quickPick.dispose();
        resolve(null);
      }, 5 * 60 * 1000);
    });

    return selected;

  } finally {
    // Clean up opened preview documents
    for (const doc of openedDocuments) {
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    }
  }
}

async function closePreviewDocument(filePath: string): Promise<void> {
  try {
    // Simply execute the close active editor command
    // VS Code will close the document that was opened in the beside view
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  } catch (error) {
    console.warn('Could not close preview document:', error);
  }
}

function logDetailedSkipAnalysis(
  skipDetails: Array<{
    type: 'noCandidates' | 'userSkipped' | 'externalReferences' | 'technicalIssues';
    brokenLink: string;
    filesAffected: number;
    searchResults: {
      exactFolderSearch: { pattern: string; matches: string[] };
      looseFilenameSearch: { pattern: string; matches: string[] };
      crossFormatSearch: { performed: boolean; extensions?: string[]; matches: string[] };
    };
    diagnosis: string;
    suggestions: string[];
    examples: string[];
  }>,
  outputChannel: vscode.OutputChannel
): void {
  outputChannel.appendLine('\n📊 Ultra-Detailed Skip Analysis');
  outputChannel.appendLine('===============================');
  outputChannel.appendLine(`Total individually analyzed skips: ${skipDetails.length}`);

  const stats = {
    noCandidates: skipDetails.filter(s => s.type === 'noCandidates').length,
    userSkipped: skipDetails.filter(s => s.type === 'userSkipped').length,
    externalReferences: skipDetails.filter(s => s.type === 'externalReferences').length,
    technicalIssues: skipDetails.filter(s => s.type === 'technicalIssues').length
  };

  outputChannel.appendLine(`❌ No candidates found: ${stats.noCandidates}`);
  outputChannel.appendLine(`👤 User skipped: ${stats.userSkipped}`);
  outputChannel.appendLine(`🌐 External references: ${stats.externalReferences}`);
  outputChannel.appendLine(`⚠️ Technical issues: ${stats.technicalIssues}`);

  outputChannel.appendLine('\n🔍 Individual Skip Details:');
  outputChannel.appendLine('==============================');

  skipDetails.forEach((skip, index) => {
    outputChannel.appendLine(`\n┌── Skip #${index + 1}: ${path.basename(skip.brokenLink)} ──────────────────────────────┐`);

    switch (skip.type) {
      case 'noCandidates':
        outputChannel.appendLine(`│ 🪪 Category: No Replacement Candidates Found`);
        break;
      case 'userSkipped':
        outputChannel.appendLine(`│ 🪪 Category: User Skipped During Selection`);
        break;
      case 'externalReferences':
        outputChannel.appendLine(`│ 🪪 Category: External Reference`);
        break;
      case 'technicalIssues':
        outputChannel.appendLine(`│ 🪪 Category: Technical Issue During Repair`);
        break;
    }

    outputChannel.appendLine(`│ 🔗 Broken Link: ${skip.brokenLink}`);
    outputChannel.appendLine(`│ 📊 File Count: ${skip.filesAffected} file(s) affected`);

    if (skip.examples.length > 0) {
      outputChannel.appendLine(`│ 📁 Affected Files:`);
      skip.examples.forEach(file => {
        outputChannel.appendLine(`│    • ${path.basename(file)}`);
      });
    }

    outputChannel.appendLine(`│ 🤔 Diagnosis: ${skip.diagnosis}`);

    if (skip.searchResults) {
      outputChannel.appendLine(`│ 🔍 Search Attempts:`);

      // Exact folder search
      const exact = skip.searchResults.exactFolderSearch;
      if (exact.matches.length > 0) {
        outputChannel.appendLine(`│    🗂️ Exact folder (${exact.pattern}): ${exact.matches.length} matches`);
        exact.matches.forEach(match => outputChannel.appendLine(`│       ✅ ${path.basename(match)}`));
      } else {
        outputChannel.appendLine(`│    🗂️ Exact folder (${exact.pattern}): 0 matches`);
      }

      // Loose filename search
      const loose = skip.searchResults.looseFilenameSearch;
      if (loose.matches.length > 0) {
        outputChannel.appendLine(`│    📄 Loose filename (${loose.pattern}): ${loose.matches.length} matches`);
        loose.matches.forEach(match => outputChannel.appendLine(`│       ✅ ${path.basename(match)}`));
      } else {
        outputChannel.appendLine(`│    📄 Loose filename (${loose.pattern}): 0 matches`);
      }

      // Cross-format search
      const cross = skip.searchResults.crossFormatSearch;
      if (cross.performed) {
        if (cross.matches.length > 0) {
          outputChannel.appendLine(`│    🔄 Cross-format (${cross.extensions?.join('→')}): ${cross.matches.length} matches`);
          cross.matches.forEach(match => outputChannel.appendLine(`│       ✅ ${path.basename(match)}`));
        } else {
          outputChannel.appendLine(`│    🔄 Cross-format (${cross.extensions?.join('→')}): 0 matches`);
        }
      }
    }

    if (skip.suggestions.length > 0) {
      outputChannel.appendLine(`│ 💡 Suggestions:`);
      skip.suggestions.forEach(suggestion => {
        outputChannel.appendLine(`│    • ${suggestion}`);
      });
    }

    outputChannel.appendLine(`└──────────────────────────────────────────────────────────────────┘`);
  });

  outputChannel.appendLine('\n📋 Summary of Common Issues:');
  outputChannel.appendLine('============================');

  if (stats.noCandidates > 0) {
    outputChannel.appendLine(`- ${stats.noCandidates} links have no replacement candidates. Check if files were renamed, moved, or deleted.`);
  }

  if (stats.userSkipped > 0) {
    outputChannel.appendLine(`- ${stats.userSkipped} links were manually skipped during user selection. These may have multiple ambiguous options.`);
  }

  if (stats.externalReferences > 0) {
    outputChannel.appendLine(`- ${stats.externalReferences} links point outside the workspace. These exist but are outside automatic repair scope.`);
  }

  if (stats.technicalIssues > 0) {
    outputChannel.appendLine(`- ${stats.technicalIssues} links failed due to technical issues (permissions, encoding, etc.).`);
  }

  outputChannel.appendLine('\n🔄 Next Steps:');
  outputChannel.appendLine('- Review the detailed analysis above for each skipped link');
  outputChannel.appendLine('- Address specific issues (missing files, encoding problems, etc.)');
  outputChannel.appendLine('- Rerun the repair process to see if previously skipped links can now be fixed');
  outputChannel.appendLine('- Consider manual fixes for external references or complex scenarios');

  outputChannel.show();
}

async function applyLinkRepair(brokenLinkInfo: BrokenLinkInfo, replacementPath: string): Promise<void> {
  const { filePath, brokenLink } = brokenLinkInfo;

  // Calculate the new relative path from the source file to the replacement
  const newRelativePath = calculateRelativePath(filePath, replacementPath);

  // We need to extract the original link text from the file to replace it
  // Since we have the normalized brokenLink, we need to find the original form

  // For now, we'll use a simple string replacement approach
  // This assumes the link appears as written in the original markdown
  try {
    const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    let text = content.toString();

    // We need to find the original markdown link syntax and replace it
    // This is tricky because we normalized the paths
    // For simplicity, we'll try to find patterns that match

    // Try to replace the broken path with the new path in various forms
    let replaced = false;

    // Try exact match first
    const brokenRelative = path.relative(path.dirname(filePath), brokenLink).replace(/\\/g, '/');
    if (text.includes(brokenRelative)) {
      text = text.replace(new RegExp(escapeRegExp(brokenRelative), 'ug'), newRelativePath);
      replaced = true;
    }

    if (!replaced) {
      // Try with normalized paths
      const brokenNormalized = brokenLink.replace(/\\/g, '/');
      if (text.includes(brokenNormalized)) {
        text = text.replace(new RegExp(escapeRegExp(brokenNormalized), 'ug'), newRelativePath);
        replaced = true;
      }
    }

    if (replaced) {
      await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(text));
      console.log(`Applied repair: ${brokenLinkInfo.brokenLink} → ${newRelativePath} in ${filePath}`);
    } else {
      console.warn(`Could not find link text to replace in ${filePath}`);
    }
  } catch (error) {
    console.error(`Error applying link repair to ${filePath}:`, error);
    throw error;
  }
}

class LinkTreeProvider implements vscode.TreeDataProvider<LinkItem> {
  constructor(private registry: Registry) {}

  private _onDidChangeTreeData: vscode.EventEmitter<LinkItem | undefined | null | void> = new vscode.EventEmitter<LinkItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<LinkItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: LinkItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: LinkItem): LinkItem[] {
    if (!element) {
      // Root level: files
      const index = this.registry.getAll();
      return Object.keys(index)
        .filter(filePath => (index[filePath] || []).length > 0)
        .map(filePath => new LinkItem(filePath, filePath, vscode.TreeItemCollapsibleState.Collapsed));
    } else if (element.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
      // Links for the file
      const index = this.registry.getAll();
      const links = index[element.resourceUri!.fsPath] || [];
      return links.map(link => new LinkItem(link, '', vscode.TreeItemCollapsibleState.None));
    }
    return [];
  }
}

class LinkItem extends vscode.TreeItem {
  constructor(label: string, uri: string, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState);
    this.tooltip = label;
    this.description = '';
    if (uri) {
      this.resourceUri = vscode.Uri.file(uri);
    }
    if (collapsibleState === vscode.TreeItemCollapsibleState.Collapsed) {
      this.iconPath = vscode.ThemeIcon.File;
    } else {
      this.iconPath = vscode.ThemeIcon.File; // Use same or remove for links
    }
  }
}
