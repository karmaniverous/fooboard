import { describe, expect, it } from 'vitest';

import { filesContaining, noDevInstrumentation } from './noDevInstrumentation';

const MARKER = 'fooboard-timing';

describe('filesContaining', () => {
  it('finds the marker in chunks and in text assets, not elsewhere', () => {
    const bundle = {
      'a.js': { type: 'chunk' as const, fileName: 'a.js', code: 'x' },
      'b.js': {
        type: 'chunk' as const,
        fileName: 'b.js',
        code: `performance.mark("${MARKER}:open")`,
      },
      'c.map': {
        type: 'asset' as const,
        fileName: 'c.map',
        source: `{"names":["${MARKER}"]}`,
      },
      'd.png': {
        type: 'asset' as const,
        fileName: 'd.png',
        source: new Uint8Array([1, 2]),
      },
    };
    expect(filesContaining(bundle, MARKER)).toEqual(['b.js', 'c.map']);
  });
});

describe('noDevInstrumentation', () => {
  const env = (command: 'build' | 'serve', mode: string) => ({
    command,
    mode,
    isSsrBuild: false,
    isPreview: false,
  });

  it('fails the build naming the files that contain the marker', () => {
    const { generateBundle } = noDevInstrumentation(MARKER);
    if (typeof generateBundle !== 'function')
      throw new Error('generateBundle is a function');
    const context = {
      error: (message: string): never => {
        throw new Error(message);
      },
    };
    const run = (code: string) => {
      const bundle = { 'a.js': { type: 'chunk', fileName: 'a.js', code } };
      // The hook reads only `this.error` and the bundle.
      Reflect.apply(generateBundle, context, [{}, bundle, false]);
    };
    expect(() => {
      run('clean');
    }).not.toThrow();
    expect(() => {
      run(`"${MARKER}:open"`);
    }).toThrow(/production bundle: a\.js/);
  });

  it('applies to production builds only', () => {
    const { apply } = noDevInstrumentation(MARKER);
    if (typeof apply !== 'function') throw new Error('apply is a function');
    expect(apply({}, env('build', 'production'))).toBe(true);
    expect(apply({}, env('build', 'development'))).toBe(false);
    expect(apply({}, env('serve', 'production'))).toBe(false);
  });
});
