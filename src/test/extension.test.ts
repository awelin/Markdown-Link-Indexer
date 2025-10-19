import * as assert from 'assert';
import * as path from 'path';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { extractMarkdownLinks, extractLinksFromNotebook } from '../parser';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('extractMarkdownLinks', () => {
		const markdown = '[link](https://example.com) ![image](image.png) [relative](../file.md)';
		const baseDir = '/home/user/docs';
		const links = extractMarkdownLinks(markdown, baseDir);
		assert.deepStrictEqual(links, [
			'https://example.com',
			path.resolve(baseDir, 'image.png'),
			path.resolve(baseDir, '../file.md')
		]);
	});

	test('extractLinksFromNotebook', () => {
		const notebookContent = JSON.stringify({
			cells: [
				{
					cell_type: 'markdown',
					source: ['This has a [link](file.md).']
				},
				{
					cell_type: 'code',
					source: ['print("hello")']
				}
			]
		});
		const baseDir = '/home/user/docs';
		const links = extractLinksFromNotebook(notebookContent, baseDir);
		assert.deepStrictEqual(links, [path.resolve(baseDir, 'file.md')]);
	});
});
