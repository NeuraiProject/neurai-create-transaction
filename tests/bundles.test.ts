import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

describe('bundles', () => {
  it('loads the browser ESM bundle', async () => {
    const browserModule = await import(pathToFileURL(path.join(distDir, 'browser.js')).href);
    expect(typeof browserModule.createQualifierTagTransaction).toBe('function');
    expect(typeof browserModule.createIssueDepinTransaction).toBe('function');
  });

  it('exposes the global bundle on globalThis', async () => {
    const source = await readFile(path.join(distDir, 'NeuraiCreateTransaction.global.js'), 'utf8');
    const context = vm.createContext({
      globalThis: {}
    });

    vm.runInContext(source, context);

    const exported = (context.globalThis as { NeuraiCreateTransaction?: Record<string, unknown> }).NeuraiCreateTransaction;
    expect(exported).toBeDefined();
    expect(typeof exported?.createQualifierTagTransaction).toBe('function');
    expect(typeof exported?.createIssueDepinTransaction).toBe('function');
  });
});
