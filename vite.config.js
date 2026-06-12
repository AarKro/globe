import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works on GitHub Pages under any repo path
  // (https://<user>.github.io/<repo>/) as well as locally.
  base: './',
});
