import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const plugins = [
  nodeResolve({
    browser: true,
    preferBuiltins: false
  }),
  commonjs()
];

export default [
  {
    input: './build/entries/index.js',
    output: [
      {
        file: './dist/index.js',
        format: 'esm',
        sourcemap: true
      },
      {
        file: './dist/index.cjs',
        format: 'cjs',
        exports: 'named',
        sourcemap: true
      }
    ],
    plugins
  },
  {
    input: './build/entries/browser.js',
    output: {
      file: './dist/browser.js',
      format: 'esm',
      sourcemap: true
    },
    plugins
  },
  {
    input: './build/entries/global.js',
    output: {
      file: './dist/NeuraiCreateTransaction.global.js',
      format: 'iife',
      name: 'NeuraiCreateTransactionBundle',
      sourcemap: true
    },
    plugins
  }
];
