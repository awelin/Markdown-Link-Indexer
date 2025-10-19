import * as path from 'path';
const MarkdownIt = require('markdown-it');
const md = MarkdownIt();

export function extractMarkdownLinks(text: string, baseDir: string): string[] {
  const tokens = md.parse(text, {});
  const links: string[] = [];
  walkTokens(tokens, (token) => {
    if (token.type === 'link_open' || token.type === 'image') {
      let href = token.attrGet('href') || token.attrGet('src');
      if (href) {
        href = normalizeLink(href, baseDir);
        links.push(href);
      }
    }
  });
  return links;
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
  // Otherwise, resolve relative to baseDir
  return path.resolve(baseDir, href);
}
