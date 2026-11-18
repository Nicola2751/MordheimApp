import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: funziona sia su GitHub Pages (/nome-repo/) sia dentro l'app Android.
export default defineConfig({
  base: './',
  plugins: [react()],
});
