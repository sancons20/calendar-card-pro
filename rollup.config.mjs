import terser from '@rollup/plugin-terser';

export default {
  input: 'src/calendar-card-pro.js',
  output: {
    file: 'dist/calendar-card-pro.bundle.js',
    format: 'iife',
    name: 'CalendarCardPro',
  },
  plugins: [terser()],
};
