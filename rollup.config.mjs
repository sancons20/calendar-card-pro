import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/calendar-card-pro.js',
  output: [
    {
      file: 'dist/calendar-card-pro.js',
      format: 'es',
    },
  ],
  plugins: [resolve(), terser()],
};
