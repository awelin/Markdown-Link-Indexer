import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class Registry {
  private linkIndex: Record<string, string[]> = {};
  private workspaceUri: vscode.Uri;

  constructor(workspaceUri: vscode.Uri) {
    this.workspaceUri = workspaceUri;
    this.loadFromDisk();
  }

  update(uri: vscode.Uri, links: string[]): void {
    this.linkIndex[uri.fsPath] = links;
    this.persistToDisk();
  }

  remove(uri: vscode.Uri): void {
    delete this.linkIndex[uri.fsPath];
    this.persistToDisk();
  }

  getAll(): Record<string, string[]> {
    return this.linkIndex;
  }

  private loadFromDisk(): void {
    try {
      const indexPath = vscode.Uri.joinPath(this.workspaceUri, '.vscode', 'link-index.json').fsPath;
      if (fs.existsSync(indexPath)) {
        const data = fs.readFileSync(indexPath, 'utf8');
        this.linkIndex = JSON.parse(data);
      }
    } catch {
      // Ignore errors when loading
    }
  }

  private persistToDisk(): void {
    try {
      const vscodePath = vscode.Uri.joinPath(this.workspaceUri, '.vscode');
      if (!fs.existsSync(vscodePath.fsPath)) {
        fs.mkdirSync(vscodePath.fsPath);
      }
      const indexPath = vscode.Uri.joinPath(this.workspaceUri, '.vscode', 'link-index.json').fsPath;
      fs.writeFileSync(indexPath, JSON.stringify(this.linkIndex, null, 2));
    } catch {
      // Ignore errors when persisting
    }
  }
}
