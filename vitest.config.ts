import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Hallazgo 0.3: 'node' por defecto (jsdom en TODAS las suites ralentizaba y
    // contaminaba el realm de fetch/AbortSignal). jsdom SOLO para tests de UI.
    environment: 'node',
    environmentMatchGlobs: [['**/*.test.tsx', 'jsdom']],
    setupFiles: ['./src/test/setup.ts'],
    // Hallazgo 0.3: BD de test aislada creada una vez antes de los workers.
    globalSetup: ['./src/test/global-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    // Una sola BD compartida entre archivos de suite → ejecución secuencial
    // (alternativa aceptada por el informe: BD por worker O fileParallelism false).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
