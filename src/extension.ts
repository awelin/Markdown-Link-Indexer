import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { extractMarkdownLinks, extractLinksFromNotebook } from './parser';
import { Registry } from './registry';

let registry: Registry | undefined;
let treeView: vscode.TreeView<LinkItem>;
let treeDataProvider: LinkTreeProvider;

export function activate(context: vscode.ExtensionContext) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Markdown Link Indexer requires an open workspace.');
    return;
  }

  console.log('Markdown Link Indexer: Activating extension');

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
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
