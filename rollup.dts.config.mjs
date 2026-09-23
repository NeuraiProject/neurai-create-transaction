import { dts } from 'rollup-plugin-dts';

// CommonJS declarations for the `require` entries (dist/index.cjs and
// dist/amounts.cjs). tsc emits ESM declarations ("type": "module"), which a
// CommonJS consumer resolving with moduleResolution node16 cannot use
// (TS1471). The same declarations are bundled into .d.cts files; other
// packages (@neuraiproject/neurai-key) stay external and resolve through
// their own `require` condition.
const external = (id) => !id.startsWith('.') && !id.startsWith('/');

export default [
  { input: './dist/index.d.ts', output: { file: './dist/index.d.cts', format: 'es' }, external, plugins: [dts()] },
  { input: './dist/amounts.d.ts', output: { file: './dist/amounts.d.cts', format: 'es' }, external, plugins: [dts()] }
];
