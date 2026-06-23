import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base='./' giúp build chạy được cả khi deploy ở subpath (vd. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, open: true },
});
