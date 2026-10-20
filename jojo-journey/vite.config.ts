import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The production build is a portable HTML file: it also works when opened
// directly from disk, with no external font, script, or stylesheet requests.
export default defineConfig({ plugins: [react(), viteSingleFile()] });
