import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

const isProd = process.env.NODE_ENV === 'prod';

export default {
  input: 'src/calendar-card-pro.ts',
  output: [
    {
      file: 'dist/calendar-card-pro.js',
      format: 'es',
      sourcemap: true,
    },
  ],
  plugins: [
    replace({
      preventAssignment: true,
      'calendar-card-pro-dev': isProd ? 'calendar-card-pro' : 'calendar-card-pro-dev',
    }),
    json(),
    typescript({
      tsconfig: './tsconfig.json',
    }),
    resolve(),
    terser(),
  ],
};
