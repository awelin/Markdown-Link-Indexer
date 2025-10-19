import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
const MarkdownIt = require('markdown-it');
const md = MarkdownIt();

export function extractMarkdownLinks(text: string, baseDir: string): string[] {
  const tokens = md.parse(text, {});
  const links: string[] = [];
  let urlCount = 0;
  let unsupportedCount = 0;

  walkTokens(tokens, (token) => {
    if (token.type === 'link_open' || token.type === 'image') {
      let href = token.attrGet('href') || token.attrGet('src');
      if (href) {
        // Strip optional angle brackets around URL
        href = href.replace(/^<(.+)>$/, '$1');
        if (isUrlLink(href)) {
          console.info(`🌐 URL link skipped: ${href}`);
          urlCount++;
        } else {
          // Check for other unsupported formats
          if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) {
            console.info(`⚠️ Unsupported link format: ${href} (${token.type})`);
            unsupportedCount++;
          } else {
            // Valid file link
            const originalHref = href;
            href = normalizeLink(href, baseDir);
            console.info(`✅ File link extracted: "${originalHref}" → ${href}`);
            links.push(href);
          }
        }
      }
    }
  });

  console.log(`📊 Link extraction result: ${links.length} valid file links, ${urlCount} URLs filtered, ${unsupportedCount} unsupported formats`);
  return links;
}

function isUrlLink(href: string): boolean {
  return href.startsWith('http://') || href.startsWith('https://');
}

function walkTokens(tokens: any[], callback: (token: any) => void) {
  for (const token of tokens) {
    callback(token);
    if (token.children) {
      walkTokens(token.children, callback);
    }
  }
}

export function extractLinksFromNotebook(content: string, baseDir: string): string[] {
  try {
    const data = JSON.parse(content);
    const links: string[] = [];
    for (const cell of data.cells || []) {
      if (cell.cell_type === 'markdown') {
        const text = cell.source.join('');
        links.push(...extractMarkdownLinks(text, baseDir));
      }
    }
    return links;
  } catch {
    return [];
  }
}

function normalizeLink(href: string, baseDir: string): string {
  // If it's an absolute path or has protocol (http://, https://, etc.), return as is
  if (path.isAbsolute(href) || /^https?:\/\//.test(href)) {
    return href;
  }
  // Decode URL-encoded characters (like %20 → space, %E6%B0%B4%E9%92%A0 → 水钠)
  const decodedHref = decodeURIComponent(href);
  // Otherwise, resolve relative to baseDir with decoded name
  return path.resolve(baseDir, decodedHref);
}

export interface BrokenLinkInfo {
  filePath: string;  // Path to the file containing the broken link
  brokenLink: string; // The broken link itself
  originalLink: string; // The original non-normalized link from the file
}

export function findBrokenLinks(index: Record<string, string[]>): BrokenLinkInfo[] {
  const brokenLinks: BrokenLinkInfo[] = [];

  console.log('🔍 Starting broken link detection...');

  for (const filePath of Object.keys(index)) {
    const links = index[filePath] || [];
    console.log(`📄 Scanning ${filePath}: found ${links.length} links`);

    for (const link of links) {
      console.log(`🔗 Checking link: ${link}`);

      // Enhanced broken link detection
      if (isLinkBroken(link)) {
        console.log(`❌ Detected broken link: ${link} in file ${filePath}`);
        brokenLinks.push({
          filePath,
          brokenLink: link,
          originalLink: link
        });
      } else {
        console.log(`✅ Link exists: ${link}`);
      }
    }
  }

  console.log(`📊 Found ${brokenLinks.length} total broken links`);
  return brokenLinks;
}

export function isLinkBroken(link: string): boolean {
  // At this point, URLs have already been filtered out during extraction
  // ALL absolute paths are filesystem paths and should be checked for existence

  try {
    // Use statSync for more detailed file checking on ALL paths
    const stat = fs.statSync(link);

    if (stat.isFile()) {
      console.info(`📄 File exists: ${link}`);
      return false; // File exists and is accessible
    }

    if (stat.isDirectory()) {
      console.info(`📂 Directory exists (not a broken file link): ${link}`);
      return false; // Directories aren't what we're looking for
    }

    // If it's neither a file nor a directory, consider it broken
    console.error(`❓ Unknown file type: ${link}`);
    return true;

  } catch (error: any) {
    // File doesn't exist or is inaccessible
    if (error.code === 'ENOENT') {
      console.error(`❌ File not found: ${link}`);
      return true;
    } else if (error.code === 'EACCES') {
      console.error(`🔒 Access denied: ${link}`);
      return true;
    } else {
      console.error(`⚠️ Other error checking ${link}: ${error.message}`);
      return true; // Treat any other errors as broken
    }
  }
}

export async function findReplacementCandidates(brokenLink: string): Promise<string[]> {
  const brokenPath = path.parse(brokenLink);
  const candidates: string[] = [];

  // Try to find matches by filename only (last component)
  try {
    const filenameMatches = await vscode.workspace.findFiles(`**/${brokenPath.base}`, undefined, 20);
    candidates.push(...filenameMatches.map(uri => uri.fsPath));
  } catch (error) {
    // Ignore errors in file search
  }

  // Try last two components (folder/filename)
  if (brokenPath.dir) {
    const lastTwoComponents = path.basename(brokenPath.dir) + path.sep + brokenPath.base;
    try {
      const twoComponentMatches = await vscode.workspace.findFiles(`**/${lastTwoComponents}`, undefined, 20);
      candidates.push(...twoComponentMatches.map(uri => uri.fsPath));
    } catch (error) {
      // Ignore errors in file search
    }
  }

  // Remove duplicates and the broken link itself if it somehow got included
  const uniqueCandidates = [...new Set(candidates)].filter(candidate => candidate !== brokenLink);

  return uniqueCandidates;
}

export async function findSmartReplacementCandidates(brokenLink: string): Promise<{exactFolderMatches: string[], looseMatches: string[]}> {
  console.log(`🎯 Analyzing broken link: ${brokenLink}`);
  const brokenPath = path.parse(brokenLink);
  const exactFolderMatches: string[] = [];
  const looseMatches: string[] = [];

  // Search 1: Exact folder structure match (last two components)
  if (brokenPath.dir) {
    const lastTwoComponents = path.basename(brokenPath.dir) + path.sep + brokenPath.base;
    console.log(`🗂️  Searching for exact folder match: **/${lastTwoComponents}`);
    try {
      const twoComponentMatches = await vscode.workspace.findFiles(`**/${lastTwoComponents}`, undefined, 20);
      exactFolderMatches.push(...twoComponentMatches.map(uri => uri.fsPath));
      twoComponentMatches.forEach(uri => {
        console.log(`   ✅ Exact match: ${uri.fsPath}`);
      });
      if (twoComponentMatches.length === 0) {
        console.log(`   ❌ No exact folder matches found`);
      }
    } catch (error: any) {
      console.log(`   ⚠️ Error in exact folder search: ${error.message}`);
    }
  } else {
    console.log(`🗂️  Skipping exact folder match (no folder structure in broken link)`);
  }

  // Search 2: Loose filename match
  console.log(`📄 Searching for loose filename match: **/${brokenPath.base}`);
  try {
    const filenameMatches = await vscode.workspace.findFiles(`**/${brokenPath.base}`, undefined, 20);
    // Only include filename matches that aren't already in exact folder matches
    looseMatches.push(...filenameMatches
      .map(uri => uri.fsPath)
      .filter(candidate => !exactFolderMatches.includes(candidate))
    );
    filenameMatches.forEach(uri => {
      const isDuplicate = exactFolderMatches.includes(uri.fsPath);
      console.log(`   ${isDuplicate ? '🔄 Duplicate' : '✅'} Loose match: ${uri.fsPath}`);
    });
    if (filenameMatches.length === 0) {
      console.log(`   ❌ No loose filename matches found`);
    }
  } catch (error: any) {
    console.log(`   ⚠️ Error in loose filename search: ${error.message}`);
  }

  // Search 3: Cross-format alternatives
  if (brokenPath.ext) {
    const baseWithoutExt = brokenPath.name; // filename without extension
    const alternativeExtensions = brokenPath.ext === '.md' ? ['.ipynb'] :
                                 brokenPath.ext === '.ipynb' ? ['.md', '.markdown'] :
                                 [];
    console.log(`🔄 Searching for cross-format alternatives (${brokenPath.ext} → ${alternativeExtensions.join(', ')})`);

    for (const altExt of alternativeExtensions) {
      try {
        // Search for exact folder structure with alternative extension
        let altExactCount = 0;
        if (brokenPath.dir) {
          const altLastTwo = path.basename(brokenPath.dir) + path.sep + baseWithoutExt + altExt;
          console.log(`   🔍 Exact cross-format: **/${altLastTwo}`);
          const altExactMatches = await vscode.workspace.findFiles(`**/${altLastTwo}`, undefined, 10);
          exactFolderMatches.push(...altExactMatches.map(uri => uri.fsPath));
          altExactMatches.forEach(uri => {
            console.log(`     ✅ Exact cross-format match: ${uri.fsPath}`);
            altExactCount++;
          });
        }

        // Search for loose filename with alternative extension
        console.log(`   🔍 Loose cross-format: **/${baseWithoutExt + altExt}`);
        const altFilenameMatches = await vscode.workspace.findFiles(`**/${baseWithoutExt + altExt}`, undefined, 10);
        const newMatches = altFilenameMatches
          .map(uri => uri.fsPath)
          .filter(candidate => !exactFolderMatches.includes(candidate) && !looseMatches.includes(candidate));
        looseMatches.push(...newMatches);
        altFilenameMatches.forEach(uri => {
          const isDuplicate = exactFolderMatches.includes(uri.fsPath) || looseMatches.includes(uri.fsPath) && !newMatches.includes(uri.fsPath);
          console.log(`     ${isDuplicate ? '🔄 Duplicate' : '✅'} Loose cross-format match: ${uri.fsPath}`);
        });

        if (altExactCount === 0 && altFilenameMatches.length === 0) {
          console.log(`   ❌ No ${altExt} cross-format matches found`);
        }
      } catch (error: any) {
        console.log(`   ⚠️ Error in cross-format search for ${altExt}: ${error.message}`);
      }
    }
  } else {
    console.log(`🔄 Skipping cross-format search (no extension detected)`);
  }

  // Remove the broken link itself if it somehow got included
  const filteredExact = exactFolderMatches.filter(candidate => candidate !== brokenLink);
  const filteredLoose = looseMatches.filter(candidate => candidate !== brokenLink);

  console.log(`📊 Candidate search complete: ${filteredExact.length} exact folder matches, ${filteredLoose.length} loose matches, ${filteredExact.length + filteredLoose.length} total candidates`);

  return {
    exactFolderMatches: filteredExact,
    looseMatches: filteredLoose
  };
}

export function calculateRelativePath(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  const relativePath = path.relative(fromDir, toFile);
  // Normalize path separators for markdown (forward slashes)
  return relativePath.replace(/\\/g, '/');
}

export function updateMarkdownLinks(text: string, oldDir: string, newDir: string): string {
  if (oldDir === newDir) return text;

  const dummyFile = path.join(newDir, 'dummy.md'); // used for relative calculation

  // Function to check if link is relative (not absolute, not URL, etc.)
  const isRelativeLink = (link: string): boolean => {
    return !path.isAbsolute(link) &&
           !link.startsWith('http://') &&
           !link.startsWith('https://') &&
           !link.startsWith('#') &&
           !link.startsWith('mailto:') &&
           !link.startsWith('javascript:');
  };

  const updateInlineLinks = (regex: RegExp) => {
    text = text.replace(regex, (match, alt, openingBrace, link, closingBrace) => {
      if (isRelativeLink(link)) {
        const target = normalizeLink(link, oldDir);
        let newLink = calculateRelativePath(dummyFile, target);
        // Wrap in angle brackets if the new path contains spaces (for safety)
        if (newLink.includes(' ')) {
          newLink = `<${newLink}>`;
        }
        const linkPart = `${openingBrace || ''}${link}${closingBrace || ''}`;
        const newLinkPart = newLink;
        return match.replace(linkPart, newLinkPart);
      }
      return match;
    });
  };

  // Update regular inline links - handle optional angle brackets around links
  updateInlineLinks(/\[([^\]]*)\]\((<)?([^>)]+)(>)?\)/g);
  // Update image links - handle optional angle brackets around links
  updateInlineLinks(/!\[([^\]]*)\]\((<)?([^>)]+)(>)?\)/g);

  return text;
}

export function updateNotebookLinks(content: string, oldDir: string, newDir: string): string {
  if (oldDir === newDir) return content;

  try {
    const data = JSON.parse(content);
    for (const cell of data.cells || []) {
      if (cell.cell_type === 'markdown' && cell.source) {
        // Update each line individually to preserve line structure and newlines
        const newSource = cell.source.map((line: string) => updateMarkdownLinks(line, oldDir, newDir));
        if (newSource.some((line: string, i: number) => line !== cell.source[i])) {
          cell.source = newSource;
        }
      }
    }
    return JSON.stringify(data, null, 1); // pretty print to match original format
  } catch (error) {
    console.error('Error updating notebook links:', error);
    return content; // return unchanged if parsing fails
  }
}
