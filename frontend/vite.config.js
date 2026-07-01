/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// The React app runs on :5173 in dev and proxies all /api (and /api/backup)
// calls to the FastAPI backend on :8080, so the browser talks to a single
// origin and there are no CORS concerns.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  // Vitest unit-test config (jsdom + Testing Library).
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    // Emit a JSON report alongside the console output so the in-app Test Report
    // view can display the latest frontend results.
    reporters: ['default', 'json'],
    outputFile: { json: './test-results/frontend.json' },
  },
})
